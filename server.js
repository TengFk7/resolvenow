// ─── Override DNS + บังคับ IPv4 ก่อน require อื่นๆ ──────────────
// Render ไม่รองรับ IPv6 outbound → ต้อง force IPv4 ทุก connection
const _dns = require('dns');
const _net = require('net');
_dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// ปิด Happy Eyeballs (autoSelectFamily) — Node 18.13+ จะลอง IPv6 ก่อนเสมอ
if (typeof _net.setDefaultAutoSelectFamily === 'function') {
  _net.setDefaultAutoSelectFamily(false);
}

// Monkey-patch dns.lookup → บังคับ family: 4 (IPv4) เสมอ
const _originalLookup = _dns.lookup;
_dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = { family: 4 };
  } else if (typeof options === 'number') {
    options = { family: 4 };
  } else {
    options = Object.assign({}, options || {}, { family: 4 });
  }
  return _originalLookup.call(_dns, hostname, options, callback);
};

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
const { startSlaJob } = require('./config/slaJob');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render/Heroku)
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Make io globally accessible to routers
app.set('io', io);

// FIX-#3 Heartbeat: ตอบ ping_heartbeat ด้วย pong_heartbeat ยืนยัน connection ยังมีชีวิต
io.on('connection', (socket) => {
  socket.on('ping_heartbeat', () => {
    socket.emit('pong_heartbeat');
  });
});

// ─── Connect MongoDB → Seed → Start ─────────────────────────────
(async () => {
  await connectDB();
  await seedDB();
  startSlaJob(); // SLA breach checker — runs every 5 min in background

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

  // FIX-1.2: แยก 2 limiter:
  //   pollingLimiter → GET-only read endpoints (tickets, technicians, help-requests)
  //     หลังแก้ FIX-4.2 แล้ว: citizen/tech จะ poll ทุก 30s (ไม่ใช่ 8s)
  //     1500 req / 5 min = 5 req/sec → รองรับ admin 50 คน + tech 50 คน พร้อมกันได้
  //   apiLimiter → POST/PUT/DELETE (write operations) ยังคง 300/5min
  const pollingLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 1500,
    skip: (req) => req.method !== 'GET', // เฉพาะ GET เท่านั้น
    message: { error: 'Too many requests, please try again later.' }
  });
  const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 300,
    skip: (req) => req.method === 'GET', // ข้าม GET (จัดการโดย pollingLimiter)
    message: { error: 'Too many requests, please try again later.' }
  });
  // GET reads → pollingLimiter (หลวม)
  app.use('/api/tickets',       pollingLimiter);
  app.use('/api/technicians',   pollingLimiter);
  app.use('/api/help-requests', pollingLimiter);
  // Write ops → apiLimiter (เข้มงวด)
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
  app.use('/api/categories',    require('./routes/categories'));
  app.use('/api/track',         require('./routes/track'));
  app.use('/auth/line',         require('./routes/lineAuth'));

  // ─── LIFF Rating Page ──────────────────────────────────────────
  app.get('/liff-rating', (req, res) => {
    const liffId = process.env.LINE_LIFF_ID || '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const fs2 = require('fs');
    const htmlPath = path.join(__dirname, 'public', 'liff-rating.html');
    let html = fs2.readFileSync(htmlPath, 'utf8');
    // Inject LIFF ID as a global variable before closing </head>
    html = html.replace('</head>', `<script>window.__LIFF_ID__ = "${liffId}";</script>\n</head>`);
    res.send(html);
  });

  // ─── Data Dictionary (Admin Protected) ────────────────────────
  const bcryptDadic = require('bcryptjs');
  const UserModel   = require('./models/User');

  const DADIC_PAGE = (errorMsg = '') => `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Data Dictionary — ResolveNow</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Sarabun',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#0a0e27 0%,#16213e 50%,#0f3460 100%);padding:20px;}
    body::before{content:'';position:fixed;inset:0;
      background:radial-gradient(ellipse at 30% 20%,rgba(99,179,237,0.08) 0%,transparent 50%),
                 radial-gradient(ellipse at 70% 80%,rgba(26,86,219,0.12) 0%,transparent 50%);pointer-events:none;}
    .card{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);
      border-radius:24px;padding:48px 40px;width:100%;max-width:420px;box-shadow:0 24px 64px rgba(0,0,0,0.5);position:relative;}
    .icon{width:64px;height:64px;background:linear-gradient(135deg,#1a56db,#3b82f6);border-radius:18px;
      display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 20px;
      box-shadow:0 8px 24px rgba(59,130,246,0.4);}
    h1{font-size:22pt;font-weight:800;color:#fff;text-align:center;margin-bottom:6px;letter-spacing:-0.5px;}
    .sub{text-align:center;color:rgba(255,255,255,0.55);font-size:10pt;margin-bottom:32px;}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:3px 12px;font-size:8.5pt;
      color:#90cdf4;margin:0 auto 28px;display:flex;width:fit-content;}
    label{display:block;font-size:9.5pt;font-weight:600;color:rgba(255,255,255,0.7);margin-bottom:7px;letter-spacing:0.3px;}
    input{width:100%;padding:13px 16px;background:rgba(255,255,255,0.07);border:1.5px solid rgba(255,255,255,0.12);
      border-radius:12px;color:#fff;font-family:'Sarabun',sans-serif;font-size:10.5pt;outline:none;
      transition:border-color 0.2s,background 0.2s;margin-bottom:16px;}
    input::placeholder{color:rgba(255,255,255,0.3);}
    input:focus{border-color:#3b82f6;background:rgba(59,130,246,0.1);}
    button{width:100%;padding:14px;background:linear-gradient(135deg,#1a56db,#3b82f6);border:none;
      border-radius:12px;color:#fff;font-family:'Sarabun',sans-serif;font-size:11.5pt;font-weight:700;
      cursor:pointer;margin-top:8px;box-shadow:0 6px 20px rgba(59,130,246,0.4);
      transition:transform 0.15s,box-shadow 0.15s;}
    button:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(59,130,246,0.6);}
    button:active{transform:translateY(0);}
    .error{background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.4);border-radius:10px;
      padding:11px 16px;color:#fca5a5;font-size:9.5pt;margin-bottom:20px;text-align:center;}
    .lock{text-align:center;margin-top:24px;color:rgba(255,255,255,0.3);font-size:8.5pt;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📋</div>
    <h1>Data Dictionary</h1>
    <div class="badge">🔒 เฉพาะผู้ดูแลระบบ (Admin)</div>
    <div class="sub">กรุณาเข้าสู่ระบบด้วยบัญชี Admin เพื่อดูเอกสาร</div>
    ${errorMsg ? `<div class="error">⚠️ ${errorMsg}</div>` : ''}
    <form method="POST" action="/Datadic" autocomplete="on">
      <label for="dd_email">อีเมล (Email)</label>
      <input id="dd_email" type="email" name="email" required placeholder="admin@resolvenow.th" autofocus/>
      <label for="dd_pw">รหัสผ่าน (Password)</label>
      <input id="dd_pw" type="password" name="password" required placeholder="••••••••"/>
      <button type="submit">เข้าสู่ระบบ →</button>
    </form>
    <div class="lock">🛡️ ResolveNow · Secure Admin Access</div>
  </div>
</body>
</html>`;

  app.get('/Datadic', (req, res) => {
    if (req.session && req.session.dadicAuth) {
      return res.sendFile(path.join(__dirname, 'data_dictionary.html'));
    }
    res.send(DADIC_PAGE());
  });

  app.post('/Datadic', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.send(DADIC_PAGE('กรุณากรอกอีเมลและรหัสผ่าน'));
    }
    try {
      const user = await UserModel.findOne({
        email: email.toLowerCase().trim(),
        role: 'admin'
      });
      if (!user) return res.send(DADIC_PAGE('ไม่พบบัญชี Admin หรืออีเมลไม่ถูกต้อง'));
      const ok = await bcryptDadic.compare(password, user.password);
      if (!ok) return res.send(DADIC_PAGE('รหัสผ่านไม่ถูกต้อง'));
      req.session.dadicAuth = true;
      return res.redirect('/Datadic');
    } catch (err) {
      console.error('[Datadic] login error:', err.message);
      return res.send(DADIC_PAGE('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'));
    }
  });

  // ─── Public Track Page ─────────────────────────────────────────
  app.get('/track', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'track.html'))
  );

  // ─── Fallback (SPA) ──────────────────────────────────────────
  app.get('*', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  );

  // ─── Start ───────────────────────────────────────────────────
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log('='.repeat(40));
    console.log(`  ResolveNow: http://localhost:${PORT}`);
    console.log('='.repeat(40));
  });
})();