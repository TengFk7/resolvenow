const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const app = express();

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'resolvenow-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ─── Data ──────────────────────────────────────────────────
const users   = [];
const tickets = [];
const helpRequests = []; // { id, ticketId, requesterId, requesterName, dept, message, status:'open'|'accepted', acceptedById, createdAt }
let ticketCounter = 1;
let helpCounter   = 1;

const STATUSES = ['pending','assigned','in_progress','completed','rejected'];

const DEPT_MAP = {
  Road:        { th: 'ถนน/ทางเท้า',           icon: '🛣️' },
  Water:       { th: 'ท่อแตก/น้ำไม่ไหล',      icon: '💧' },
  Electricity: { th: 'ไฟฟ้าสาธารณะดับ',       icon: '💡' },
  Garbage:     { th: 'ขยะตกค้าง',              icon: '🗑️' },
  Animal:      { th: 'สัตว์มีพิษ/จรจัด',       icon: '🐕' },
  Tree:        { th: 'กิ่งไม้วางทาง',           icon: '🌿' },
  Hazard:      { th: 'เพลิง/ภัยพิบัติ',        icon: '🚨' },
};

// ─── Seed ──────────────────────────────────────────────────
(async () => {
  // Admin
  users.push({ id:1, firstName:'Admin', lastName:'Dispatcher', email:'admin@resolvenow.th', password: await bcrypt.hash('admin1234',10), role:'admin', specialty:null, createdAt: new Date().toISOString() });

  // Technicians — 1 per department
  const depts = Object.keys(DEPT_MAP);
  const techNames = [
    { f:'วิชัย',   l:'โยธา'  },
    { f:'มานะ',    l:'ประปา' },
    { f:'สมชาย',  l:'ไฟฟ้า' },
    { f:'สุรัตน์', l:'สุขา'  },
    { f:'บุญมี',   l:'ปราบ'  },
    { f:'สมศรี',  l:'ป่าไม้' },
    { f:'อนันต์',  l:'กู้ภัย'},
  ];
  for (let i = 0; i < depts.length; i++) {
    users.push({
      id: i+2,
      firstName: techNames[i].f,
      lastName:  techNames[i].l,
      email:     'tech'+(i+1)+'@resolvenow.th',
      password:  await bcrypt.hash('tech1234', 10),
      role:      'technician',
      specialty: depts[i],
      createdAt: new Date().toISOString()
    });
  }
  console.log('✅ Seed สำเร็จ');
  console.log('   Admin: admin@resolvenow.th / admin1234');
  console.log('   Tech:  tech1@resolvenow.th ~ tech7@resolvenow.th / tech1234');
})();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// ─── Auth ──────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (!email.includes('@')) return res.status(400).json({ error: 'รูปแบบ Email ไม่ถูกต้อง' });
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
    if (password.length < 6) return res.status(400).json({ error: 'Password ต้องมีอย่างน้อย 6 ตัว' });
    const user = { id: users.length+1, firstName, lastName, email, password: await bcrypt.hash(password,10), role:'citizen', specialty:null, createdAt: new Date().toISOString() };
    users.push(user);
    req.session.userId = user.id; req.session.role = user.role;
    res.json({ message:'สมัครสำเร็จ', user:{ id:user.id, firstName, lastName, email, role:'citizen' } });
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'ไม่พบ Email นี้ในระบบ' });
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Password ไม่ถูกต้อง' });
    req.session.userId = user.id; req.session.role = user.role;
    if (remember) req.session.cookie.maxAge = 30*24*60*60*1000;
    res.json({ message:'Login สำเร็จ', user:{ id:user.id, firstName:user.firstName, lastName:user.lastName, email:user.email, role:user.role, specialty:user.specialty } });
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ message:'Logout สำเร็จ' }); });

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error:'Not logged in' });
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error:'ไม่พบผู้ใช้' });
  res.json({ id:user.id, firstName:user.firstName, lastName:user.lastName, email:user.email, role:user.role, specialty:user.specialty });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!user || !currentPassword || !newPassword) return res.status(400).json({ error:'ข้อมูลไม่ครบ' });
    if (newPassword.length < 6) return res.status(400).json({ error:'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว' });
    if (!await bcrypt.compare(currentPassword, user.password)) return res.status(401).json({ error:'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    user.password = await bcrypt.hash(newPassword, 10);
    res.json({ message:'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

// ─── Tickets ───────────────────────────────────────────────
app.get('/api/tickets', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  let result;
  if (user.role === 'citizen') {
    result = tickets.filter(t => t.citizenId === user.id);
  } else if (user.role === 'technician') {
    // Tech sees only tickets matching their specialty OR assigned to them
    result = tickets.filter(t => t.category === user.specialty || t.assignedTo === user.id);
  } else {
    result = tickets; // admin sees all
  }
  res.json(result);
});

app.post('/api/tickets', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { category, description, location, urgency } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!category || !description || !location) return res.status(400).json({ error:'กรุณากรอกข้อมูลให้ครบ' });
    let score = urgency === 'urgent' ? 90 : urgency === 'medium' ? 60 : 30;
    const desc = description.toLowerCase();
    for (const kw of ['flood','fire','อันตราย','เร่งด่วน','น้ำท่วม','ฉุกเฉิน'])
      if (desc.includes(kw)) score = Math.min(score + 10, 100);
    const ticket = {
      ticketId:      'TKT-' + String(ticketCounter++).padStart(3,'0'),
      citizenId:     user.id,
      citizenName:   user.firstName + ' ' + user.lastName,
      category, description, location, urgency: urgency || 'normal',
      priorityScore: score, status: 'pending',
      assignedTo: null, assignedName: null,
      citizenImage: req.file ? '/uploads/' + req.file.filename : null,
      beforeImage: null, afterImage: null,
      createdAt: new Date().toLocaleString('th-TH')
    };
    tickets.push(ticket);
    res.status(201).json(ticket);
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

app.put('/api/tickets/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error:'Status ไม่ถูกต้อง' });
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error:'ไม่พบ Ticket' });
  ticket.status = status;
  res.json(ticket);
});

app.put('/api/tickets/:id/assign', requireAuth, (req, res) => {
  const { technicianId } = req.body;
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error:'ไม่พบ Ticket' });
  const tech = users.find(u => u.id === parseInt(technicianId) && u.role === 'technician');
  if (!tech) return res.status(404).json({ error:'ไม่พบช่าง' });
  ticket.assignedTo   = tech.id;
  ticket.assignedName = tech.firstName + ' ' + tech.lastName;
  ticket.status = 'assigned';
  res.json(ticket);
});

// ─── Upload ────────────────────────────────────────────────
app.post('/api/tickets/:id/upload/before', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket || !req.file) return res.status(400).json({ error:'ไม่พบข้อมูล' });
  ticket.beforeImage = '/uploads/' + req.file.filename;
  res.json({ message:'อัปโหลดสำเร็จ', url: ticket.beforeImage });
});
app.post('/api/tickets/:id/upload/after', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket || !req.file) return res.status(400).json({ error:'ไม่พบข้อมูล' });
  ticket.afterImage = '/uploads/' + req.file.filename;
  if (ticket.status === 'in_progress') ticket.status = 'completed';
  res.json({ message:'อัปโหลดสำเร็จ', url: ticket.afterImage });
});

// ─── Technicians ───────────────────────────────────────────
app.get('/api/technicians', requireAuth, (req, res) => {
  const techs = users.filter(u => u.role === 'technician').map(u => {
    const active   = tickets.filter(t => t.assignedTo === u.id && t.status !== 'completed' && t.status !== 'rejected').length;
    const total    = tickets.filter(t => t.assignedTo === u.id).length;
    const capacity = active >= 5 ? 100 : active >= 3 ? 75 : active >= 1 ? 40 : 10;
    const statusLabel = active >= 5 ? 'FULL' : active >= 3 ? 'BUSY' : 'READY';
    return { id:u.id, name:u.firstName+' '+u.lastName, specialty:u.specialty, activeJobs:active, totalJobs:total, capacity, statusLabel };
  });
  res.json(techs);
});

// ─── Help Requests ─────────────────────────────────────────
// GET all open help requests (visible to all techs)
app.get('/api/help-requests', requireAuth, (req, res) => {
  res.json(helpRequests);
});

// POST create help request
app.post('/api/help-requests', requireAuth, (req, res) => {
  const { ticketId, message, targetDept } = req.body;
  const user = users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'technician') return res.status(403).json({ error:'เฉพาะช่างเท่านั้น' });
  const ticket = tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return res.status(404).json({ error:'ไม่พบ Ticket' });

  // Check no duplicate open request for same ticket
  const existing = helpRequests.find(h => h.ticketId === ticketId && h.status === 'open');
  if (existing) return res.status(400).json({ error:'มีคำขอช่วยเหลือสำหรับ Ticket นี้อยู่แล้ว' });

  const help = {
    id:            'HELP-' + String(helpCounter++).padStart(3,'0'),
    ticketId,
    ticketCategory: ticket.category,
    ticketLocation: ticket.location,
    ticketDesc:    ticket.description,
    requesterId:   user.id,
    requesterName: user.firstName + ' ' + user.lastName,
    requesterDept: user.specialty,
    targetDept:    targetDept || null,
    message:       message || '',
    status:        'open',
    acceptedById:  null,
    acceptedByName: null,
    createdAt:     new Date().toLocaleString('th-TH')
  };
  helpRequests.push(help);
  res.status(201).json(help);
});

// PUT accept help request
app.put('/api/help-requests/:id/accept', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'technician') return res.status(403).json({ error:'เฉพาะช่างเท่านั้น' });
  const help = helpRequests.find(h => h.id === req.params.id);
  if (!help) return res.status(404).json({ error:'ไม่พบคำขอ' });
  if (help.status !== 'open') return res.status(400).json({ error:'คำขอนี้มีคนรับแล้ว' });
  if (help.requesterId === user.id) return res.status(400).json({ error:'ไม่สามารถรับงานตัวเองได้' });
  help.status        = 'accepted';
  help.acceptedById   = user.id;
  help.acceptedByName = user.firstName + ' ' + user.lastName;
  // Also assign ticket to helper
  const ticket = tickets.find(t => t.ticketId === help.ticketId);
  if (ticket) {
    ticket.assignedTo   = user.id;
    ticket.assignedName = user.firstName + ' ' + user.lastName;
    if (ticket.status === 'pending' || ticket.status === 'assigned') ticket.status = 'in_progress';
  }
  res.json(help);
});

// PUT cancel help request
app.put('/api/help-requests/:id/cancel', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  const help = helpRequests.find(h => h.id === req.params.id);
  if (!help) return res.status(404).json({ error:'ไม่พบคำขอ' });
  if (help.requesterId !== user.id) return res.status(403).json({ error:'ไม่มีสิทธิ์' });
  help.status = 'cancelled';
  res.json(help);
});

// ─── Fallback ──────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(3000, () => {
  console.log('='.repeat(55));
  console.log('  ResolveNow: http://localhost:3000');
  console.log('  Admin: admin@resolvenow.th / admin1234');
  console.log('  Tech1-7: tech1~tech7@resolvenow.th / tech1234');
  console.log('='.repeat(55));
});