const express = require('express');
const router = express.Router();
const { users, tickets, helpRequests, nextHelpId } = require('../data/store');

// ─── Middleware ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// GET /api/help-requests
router.get('/', requireAuth, (req, res) => {
  res.json(helpRequests);
});

// POST /api/help-requests
router.post('/', requireAuth, (req, res) => {
  const { ticketId, message, targetDept } = req.body;
  const user = users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'technician')
    return res.status(403).json({ error: 'เฉพาะช่างเท่านั้น' });
  const ticket = tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

  const existing = helpRequests.find(h => h.ticketId === ticketId && h.status === 'open');
  if (existing) return res.status(400).json({ error: 'มีคำขอช่วยเหลือสำหรับ Ticket นี้อยู่แล้ว' });

  const help = {
    id: nextHelpId(),
    ticketId,
    ticketCategory: ticket.category,
    ticketLocation: ticket.location,
    ticketDesc: ticket.description,
    requesterId: user.id,
    requesterName: user.firstName + ' ' + user.lastName,
    requesterDept: user.specialty,
    targetDept: targetDept || null,
    message: message || '',
    status: 'open',
    acceptedById: null,
    acceptedByName: null,
    createdAt: new Date().toLocaleString('th-TH')
  };
  helpRequests.push(help);
  res.status(201).json(help);
});

// PUT /api/help-requests/:id/accept
router.put('/:id/accept', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'technician')
    return res.status(403).json({ error: 'เฉพาะช่างเท่านั้น' });
  const help = helpRequests.find(h => h.id === req.params.id);
  if (!help) return res.status(404).json({ error: 'ไม่พบคำขอ' });
  if (help.status !== 'open') return res.status(400).json({ error: 'คำขอนี้มีคนรับแล้ว' });
  if (help.requesterId === user.id) return res.status(400).json({ error: 'ไม่สามารถรับงานตัวเองได้' });

  help.status = 'accepted';
  help.acceptedById = user.id;
  help.acceptedByName = user.firstName + ' ' + user.lastName;

  const ticket = tickets.find(t => t.ticketId === help.ticketId);
  if (ticket) {
    ticket.assignedTo = user.id;
    ticket.assignedName = user.firstName + ' ' + user.lastName;
    if (ticket.status === 'pending' || ticket.status === 'assigned') ticket.status = 'in_progress';
  }
  res.json(help);
});

// PUT /api/help-requests/:id/cancel
router.put('/:id/cancel', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  const help = helpRequests.find(h => h.id === req.params.id);
  if (!help) return res.status(404).json({ error: 'ไม่พบคำขอ' });
  if (help.requesterId !== user.id) return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
  help.status = 'cancelled';
  res.json(help);
});

module.exports = router;
