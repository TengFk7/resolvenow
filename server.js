const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

// ─── Middleware ─────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'resolvenow-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ─── Routes ─────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/technicians', require('./routes/technicians'));
app.use('/api/help-requests', require('./routes/helpRequests'));

// ─── Fallback (SPA) ─────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Start ──────────────────────────────────────────────────────
app.listen(3000, () => {
  console.log('='.repeat(55));
  console.log('  ResolveNow: http://localhost:3000');
  console.log('  Admin: admin@resolvenow.th / admin1234');
  console.log('  Tech1-7: tech1~tech7@resolvenow.th / tech1234');
  console.log('='.repeat(55));
});