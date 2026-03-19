const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const app = express();

// ─── Upload folder ─────────────────────────────────────────
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'resolvenow-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ─── In-memory DB ──────────────────────────────────────────
const users   = [];
const tickets = [];
let ticketCounter = 1;

const STATUSES = ['pending','assigned','in_progress','completed','rejected'];

// Seed admin
(async () => {
  users.push({
    id: 1,
    firstName: 'Admin',
    lastName:  'ResolveNow',
    email:     'admin@resolvenow.th',
    password:  await bcrypt.hash('admin1234', 10),
    role:      'admin',
    createdAt: new Date().toISOString()
  });
  console.log('✅ Admin seed สำเร็จ');
})();

// ─── Auth middleware ───────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// ─── Register ─────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (!email.includes('@'))
      return res.status(400).json({ error: 'รูปแบบ Email ไม่ถูกต้อง' });
    if (users.find(u => u.email === email))
      return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' });

    const userRole = ['citizen','technician'].includes(role) ? role : 'citizen';
    const hashed   = await bcrypt.hash(password, 10);
    const user = {
      id: users.length + 1, firstName, lastName, email,
      password: hashed, role: userRole, createdAt: new Date().toISOString()
    };
    users.push(user);
    req.session.userId = user.id;
    req.session.role   = user.role;
    console.log(`✅ Register: ${email} (${userRole})`);
    res.json({ message: 'สมัครสมาชิกสำเร็จ', user: { id: user.id, firstName, lastName, email, role: userRole } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

// ─── Login ─────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'กรุณากรอก Email และ Password' });
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'ไม่พบ Email นี้ในระบบ' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Password ไม่ถูกต้อง' });
    req.session.userId = user.id;
    req.session.role   = user.role;
    if (remember) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    console.log(`✅ Login: ${email}`);
    res.json({ message: 'Login สำเร็จ', user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

// ─── Logout ────────────────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout สำเร็จ' });
});

// ─── Me ────────────────────────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
});

// ─── Change Password ───────────────────────────────────────
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    user.password = await bcrypt.hash(newPassword, 10);
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── Get Tickets ───────────────────────────────────────────
app.get('/api/tickets', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  const result = user.role === 'citizen' ? tickets.filter(t => t.citizenId === user.id) : tickets;
  res.json(result);
});

// ─── Create Ticket ─────────────────────────────────────────
app.post('/api/tickets', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { category, description, location } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!category || !description || !location)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });

    let score = 50;
    const desc = description.toLowerCase();
    for (const kw of ['flood','fire','dangerous','urgent','broken','collapse','อันตราย','เร่งด่วน','น้ำท่วม'])
      if (desc.includes(kw)) score += 15;
    if (category === 'Electricity') score += 10;
    score = Math.min(score, 100);

    const ticket = {
      ticketId:      `TKT-${String(ticketCounter++).padStart(3,'0')}`,
      citizenId:     user.id,
      citizenName:   `${user.firstName} ${user.lastName}`,
      category, description, location,
      priorityScore: score,
      status:        'pending',
      citizenImage:  req.file ? `/uploads/${req.file.filename}` : null,
      beforeImage:   null,
      afterImage:    null,
      createdAt:     new Date().toLocaleString('th-TH')
    };
    tickets.push(ticket);
    console.log(`✅ Ticket: ${ticket.ticketId}`);
    res.status(201).json(ticket);
  } catch (err) {
    console.error('Ticket error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── Update Status ─────────────────────────────────────────
app.put('/api/tickets/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status ไม่ถูกต้อง' });
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });
  ticket.status = status;
  res.json(ticket);
});

// ─── Upload Before ─────────────────────────────────────────
app.post('/api/tickets/:id/upload/before', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์' });
  ticket.beforeImage = `/uploads/${req.file.filename}`;
  res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.beforeImage });
});

// ─── Upload After ──────────────────────────────────────────
app.post('/api/tickets/:id/upload/after', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์' });
  ticket.afterImage = `/uploads/${req.file.filename}`;
  if (ticket.status === 'in_progress') ticket.status = 'completed';
  res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.afterImage });
});

// ─── Fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────
app.listen(3000, () => {
  console.log('='.repeat(50));
  console.log('  🏙️  ResolveNow พร้อมใช้งานที่:');
  console.log('  👉  http://localhost:3000');
  console.log('  🔑  Admin: admin@resolvenow.th / admin1234');
  console.log('='.repeat(50));
});