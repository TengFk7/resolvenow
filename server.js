// ─── Override DNS เป็น Google DNS ก่อน require อื่นๆ ────────────
// แก้ปัญหา ISP/network บล็อก mongodb SRV records
require('dns').setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const { MongoStore } = require('connect-mongo');  // v6: named export
const path       = require('path');
const connectDB  = require('./config/db');
const { seedDB } = require('./config/seed');

const app = express();

// ─── Connect MongoDB → Seed → Start ─────────────────────────────
(async () => {
  await connectDB();
  await seedDB();

  // ─── Middleware ───────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  // ใช้ mongoose connection ที่มีอยู่แล้ว (ไม่ต้อง connect ใหม่)
  const mongoose = require('mongoose');
  app.use(session({
    secret: process.env.SESSION_SECRET || 'resolvenow-secret-2024',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: 'resolvenow',
      ttl: 7 * 24 * 60 * 60,
    }),
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));

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
  app.listen(PORT, () => {
    console.log('='.repeat(55));
    console.log(`  ResolveNow: http://localhost:${PORT}`);
    console.log('  Admin: admin@resolvenow.th / admin1234');
    console.log('  Tech1-7: tech1~tech7@resolvenow.th / tech1234');
    console.log('='.repeat(55));
  });
})();