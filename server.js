// ─── Override DNS เป็น Google DNS ก่อน require อื่นๆ ────────────
// แก้ปัญหา ISP/network บล็อก mongodb SRV records
require('dns').setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const { MongoStore } = require('connect-mongo');  // v6: named export
const path       = require('path');
const helmet     = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit  = require('express-rate-limit');
const http       = require('http');            // socket.io requirement
const { Server } = require('socket.io');       // socket.io requirement
const connectDB  = require('./config/db');
const { seedDB } = require('./config/seed');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render/Heroku)
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Make io globally accessible to routers
app.set('io', io);

// ─── Connect MongoDB → Seed → Start ─────────────────────────────
(async () => {
  await connectDB();
  await seedDB();

  // ─── Security Middleware ────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // Disabling CSP temporarily to not break any inline scripts/styles (like those in index.html)
  }));
  app.use(mongoSanitize());

  // ─── General Middleware ───────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));
  // ใช้ mongoose connection ที่มีอยู่แล้ว (ไม่ต้อง connect ใหม่)
  const mongoose = require('mongoose');
  const sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: 'resolvenow',
      ttl: 7 * 24 * 60 * 60,
      touchAfter: 24 * 3600, // lazy session update — only update once per 24h to reduce writes
    });
  // Suppress "Unable to find the session to touch" errors (stale cookies)
  sessionStore.on('error', function(err) {
    console.warn('[Session Store] non-critical error:', err.message);
  });

  app.use(session({
    secret: process.env.SESSION_SECRET || 'resolvenow-secret-2024',
    resave: false,
    saveUninitialized: true,   // ต้อง true: ให้ session ที่มีแค่ lineLinkPending (ยังไม่ login) ถูก save ลง MongoDB
    store: sessionStore,
    cookie: { 
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',    // lax: ส่ง cookie กับ GET redirect (LINE callback) ได้
      secure: process.env.NODE_ENV === 'production'
    }
  }));

  // ─── Rate Limiting ────────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use('/api/auth', authLimiter);

  // BUG-012: Apply apiLimiter only to non-auth routes to prevent double-limiting
  const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 300
  });
  app.use('/api/tickets',       apiLimiter);
  app.use('/api/technicians',   apiLimiter);
  app.use('/api/help-requests', apiLimiter);
  app.use('/api/ai',            apiLimiter);

  // ─── Routes ──────────────────────────────────────────────────
  app.use('/api/auth',          require('./routes/auth'));
  app.use('/api/tickets',       require('./routes/tickets'));
  app.use('/api/technicians',   require('./routes/technicians'));
  app.use('/api/help-requests', require('./routes/helpRequests'));
  app.use('/api/ai',            require('./routes/ai'));
  app.use('/auth/line',         require('./routes/lineAuth'));

  // ─── Fallback (SPA) ──────────────────────────────────────────
  app.get('*', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  );

  // ─── Start ───────────────────────────────────────────────────
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log('='.repeat(55));
    console.log(`  ResolveNow: http://localhost:${PORT}`);
    console.log('  Admin: admin@resolvenow.th / admin1234');
    console.log('  Tech1-7: tech1~tech7@resolvenow.th / tech1234');
    console.log('='.repeat(55));
  });
})();