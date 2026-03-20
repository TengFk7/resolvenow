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

const users   = [];
const tickets = [];
let ticketCounter = 1;
const STATUSES = ['pending','assigned','in_progress','completed','rejected'];

// Seed admin + technicians
(async () => {
  users.push({ id:1, firstName:'Admin', lastName:'Dispatcher', email:'admin@resolvenow.th', password: await bcrypt.hash('admin1234',10), role:'admin', createdAt: new Date().toISOString() });
  users.push({ id:2, firstName:'วิชัย', lastName:'ไฟฟ้า', email:'tech1@resolvenow.th', password: await bcrypt.hash('tech1234',10), role:'technician', specialty:'Electricity', createdAt: new Date().toISOString() });
  users.push({ id:3, firstName:'มานะ', lastName:'โยธา', email:'tech2@resolvenow.th', password: await bcrypt.hash('tech1234',10), role:'technician', specialty:'Road', createdAt: new Date().toISOString() });
  users.push({ id:4, firstName:'สมบัติ', lastName:'ประปา', email:'tech3@resolvenow.th', password: await bcrypt.hash('tech1234',10), role:'technician', specialty:'Water', createdAt: new Date().toISOString() });
  console.log('✅ Seed สำเร็จ | Admin: admin@resolvenow.th / admin1234 | Tech: tech1@resolvenow.th / tech1234');
})();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (!email.includes('@')) return res.status(400).json({ error: 'รูปแบบ Email ไม่ถูกต้อง' });
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
    if (password.length < 6) return res.status(400).json({ error: 'Password ต้องมีอย่างน้อย 6 ตัว' });
    const userRole = ['citizen','technician'].includes(role) ? role : 'citizen';
    const user = { id: users.length+1, firstName, lastName, email, password: await bcrypt.hash(password,10), role: userRole, createdAt: new Date().toISOString() };
    users.push(user);
    req.session.userId = user.id; req.session.role = user.role;
    res.json({ message:'สมัครสำเร็จ', user:{ id:user.id, firstName, lastName, email, role:userRole } });
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'ไม่พบ Email นี้ในระบบ' });
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Password ไม่ถูกต้อง' });
    req.session.userId = user.id; req.session.role = user.role;
    if (remember) req.session.cookie.maxAge = 30*24*60*60*1000;
    res.json({ message:'Login สำเร็จ', user:{ id:user.id, firstName:user.firstName, lastName:user.lastName, email:user.email, role:user.role } });
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

// Logout
app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ message:'Logout สำเร็จ' }); });

// Me
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error:'Not logged in' });
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error:'ไม่พบผู้ใช้' });
  res.json({ id:user.id, firstName:user.firstName, lastName:user.lastName, email:user.email, role:user.role });
});

// Change Password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error:'ไม่พบผู้ใช้' });
    if (!currentPassword || !newPassword) return res.status(400).json({ error:'กรุณากรอกข้อมูลให้ครบ' });
    if (newPassword.length < 6) return res.status(400).json({ error:'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว' });
    if (!await bcrypt.compare(currentPassword, user.password)) return res.status(401).json({ error:'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    user.password = await bcrypt.hash(newPassword, 10);
    res.json({ message:'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

// Get Tickets
app.get('/api/tickets', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  const result = user.role === 'citizen' ? tickets.filter(t => t.citizenId === user.id) : tickets;
  res.json(result);
});

// Create Ticket
app.post('/api/tickets', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { category, description, location } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!category || !description || !location) return res.status(400).json({ error:'กรุณากรอกข้อมูลให้ครบ' });
    let score = 50;
    const desc = description.toLowerCase();
    for (const kw of ['flood','fire','dangerous','urgent','broken','collapse','อันตราย','เร่งด่วน','น้ำท่วม','ด่วน','ฉุกเฉิน'])
      if (desc.includes(kw)) score += 15;
    if (category === 'Electricity') score += 10;
    score = Math.min(score, 100);
    const ticket = {
      ticketId: 'TKT-' + String(ticketCounter++).padStart(3,'0'),
      citizenId: user.id, citizenName: user.firstName+' '+user.lastName,
      category, description, location, priorityScore: score,
      status: 'pending', assignedTo: null, assignedName: null,
      citizenImage: req.file ? '/uploads/'+req.file.filename : null,
      beforeImage: null, afterImage: null,
      createdAt: new Date().toLocaleString('th-TH')
    };
    tickets.push(ticket);
    res.status(201).json(ticket);
  } catch(e){ res.status(500).json({ error:'เกิดข้อผิดพลาด' }); }
});

// Update Status
app.put('/api/tickets/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error:'Status ไม่ถูกต้อง' });
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error:'ไม่พบ Ticket' });
  ticket.status = status;
  res.json(ticket);
});

// Assign Ticket to Technician
app.put('/api/tickets/:id/assign', requireAuth, (req, res) => {
  const { technicianId } = req.body;
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error:'ไม่พบ Ticket' });
  const tech = users.find(u => u.id === parseInt(technicianId) && u.role === 'technician');
  if (!tech) return res.status(404).json({ error:'ไม่พบช่าง' });
  ticket.assignedTo = tech.id;
  ticket.assignedName = tech.firstName+' '+tech.lastName;
  ticket.status = 'assigned';
  res.json(ticket);
});

// Get Technicians with workload
app.get('/api/technicians', requireAuth, (req, res) => {
  const techs = users.filter(u => u.role === 'technician').map(u => {
    const active = tickets.filter(t => t.assignedTo === u.id && t.status !== 'completed' && t.status !== 'rejected').length;
    const total  = tickets.filter(t => t.assignedTo === u.id).length;
    const capacity = active >= 5 ? 100 : active >= 3 ? 75 : active >= 1 ? 40 : 10;
    const statusLabel = active >= 5 ? 'FULL' : active >= 3 ? 'BUSY' : 'READY';
    return { id:u.id, name:u.firstName+' '+u.lastName, specialty:u.specialty||'ทั่วไป', activeJobs:active, totalJobs:total, capacity, statusLabel };
  });
  res.json(techs);
});

// Upload Before/After
app.post('/api/tickets/:id/upload/before', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error:'ไม่พบ Ticket' });
  if (!req.file) return res.status(400).json({ error:'ไม่พบไฟล์' });
  ticket.beforeImage = '/uploads/'+req.file.filename;
  res.json({ message:'อัปโหลดสำเร็จ', url:ticket.beforeImage });
});
app.post('/api/tickets/:id/upload/after', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error:'ไม่พบ Ticket' });
  if (!req.file) return res.status(400).json({ error:'ไม่พบไฟล์' });
  ticket.afterImage = '/uploads/'+req.file.filename;
  if (ticket.status === 'in_progress') ticket.status = 'completed';
  res.json({ message:'อัปโหลดสำเร็จ', url:ticket.afterImage });
});

// Fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(3000, () => {
  console.log('='.repeat(50));
  console.log('  ResolveNow: http://localhost:3000');
  console.log('  Admin: admin@resolvenow.th / admin1234');
  console.log('  Tech:  tech1@resolvenow.th / tech1234');
  console.log('='.repeat(50));
});
