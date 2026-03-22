const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { users, tickets, STATUSES, nextTicketId } = require('../data/store');

// ─── Middleware ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// ─── Multer Setup ───────────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/tickets
router.get('/', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  let result;
  if (user.role === 'citizen') {
    result = tickets.filter(t => t.citizenId === user.id);
  } else if (user.role === 'technician') {
    result = tickets.filter(t => t.category === user.specialty || t.assignedTo === user.id);
  } else {
    result = tickets; // admin sees all
  }
  res.json(result);
});

// POST /api/tickets
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { category, description, location, urgency } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!category || !description || !location)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });

    let score = urgency === 'urgent' ? 90 : urgency === 'medium' ? 60 : 30;
    const desc = description.toLowerCase();
    for (const kw of ['flood', 'fire', 'อันตราย', 'เร่งด่วน', 'น้ำท่วม', 'ฉุกเฉิน'])
      if (desc.includes(kw)) score = Math.min(score + 10, 100);

    const ticket = {
      ticketId: nextTicketId(),
      citizenId: user.id,
      citizenName: user.firstName + ' ' + user.lastName,
      category, description, location,
      urgency: urgency || 'normal',
      priorityScore: score,
      status: 'pending',
      assignedTo: null, assignedName: null,
      citizenImage: req.file ? '/uploads/' + req.file.filename : null,
      beforeImage: null, afterImage: null,
      createdAt: new Date().toLocaleString('th-TH')
    };
    tickets.push(ticket);
    res.status(201).json(ticket);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// PUT /api/tickets/:id/status
router.put('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status ไม่ถูกต้อง' });
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });
  ticket.status = status;
  res.json(ticket);
});

// PUT /api/tickets/:id/assign
router.put('/:id/assign', requireAuth, (req, res) => {
  const { technicianId } = req.body;
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });
  const tech = users.find(u => u.id === parseInt(technicianId) && u.role === 'technician');
  if (!tech) return res.status(404).json({ error: 'ไม่พบช่าง' });
  ticket.assignedTo = tech.id;
  ticket.assignedName = tech.firstName + ' ' + tech.lastName;
  ticket.status = 'assigned';
  res.json(ticket);
});

// POST /api/tickets/:id/upload/before
router.post('/:id/upload/before', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket || !req.file) return res.status(400).json({ error: 'ไม่พบข้อมูล' });
  ticket.beforeImage = '/uploads/' + req.file.filename;
  res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.beforeImage });
});

// POST /api/tickets/:id/upload/after
router.post('/:id/upload/after', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket || !req.file) return res.status(400).json({ error: 'ไม่พบข้อมูล' });
  ticket.afterImage = '/uploads/' + req.file.filename;
  if (ticket.status === 'in_progress') ticket.status = 'completed';
  res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.afterImage });
});

module.exports = router;
