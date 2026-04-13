const express     = require('express');
const xss         = require('xss');
const router      = express.Router();
const User        = require('../models/User');
const Ticket      = require('../models/Ticket');
const HelpRequest = require('../models/HelpRequest');
const Counter     = require('../models/Counter');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// GET /api/help-requests
router.get('/', requireAuth, async (req, res) => {
  try {
    const list = await HelpRequest.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// POST /api/help-requests
router.post('/', requireAuth, async (req, res) => {
  try {
    const { ticketId, message: rawMessage, targetDept: rawTargetDept } = req.body;
    // XSS-FIX: sanitize user-supplied text before storing
    const message    = rawMessage    ? xss(rawMessage.trim())    : '';
    const targetDept = rawTargetDept ? xss(rawTargetDept.trim()) : null;
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'technician')
      return res.status(403).json({ error: 'เฉพาะช่างเท่านั้น' });

    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    const existing = await HelpRequest.findOne({ 'ticketId': ticketId, status: 'open' });
    if (existing) return res.status(400).json({ error: 'มีคำขอช่วยเหลือสำหรับ Ticket นี้อยู่แล้ว' });

    const seq    = await Counter.nextSeq('help');
    const helpId = 'HELP-' + String(seq).padStart(3, '0');

    const help = await new HelpRequest({
      helpId, citizenId: user._id,
      citizenName: user.firstName + ' ' + user.lastName,
      message: message || '',
      // เก็บ extra fields ใน document (schema flexible)
      ticketId,
      ticketCategory: ticket.category,
      ticketLocation: ticket.location,
      ticketDesc: ticket.description,
      requesterId: user._id,
      requesterName: user.firstName + ' ' + user.lastName,
      requesterDept: user.specialty,
      targetDept: targetDept || null,
      status: 'open',
    }).save();

    res.status(201).json(help);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// PUT /api/help-requests/:id/accept
router.put('/:id/accept', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'technician')
      return res.status(403).json({ error: 'เฉพาะช่างเท่านั้น' });

    // RACE-CONDITION-FIX: ใช้ atomic findOneAndUpdate แทน findOne + check + save
    // หากช่าง 2 คน accept พร้อมกัน คนที่สองจะได้ null กลับมา (condition: status='open' ไม่ match)
    const help = await HelpRequest.findOneAndUpdate(
      { helpId: req.params.id, status: 'open', requesterId: { $ne: user._id } },
      { $set: { status: 'accepted', acceptedById: user._id, acceptedByName: user.firstName + ' ' + user.lastName } },
      { new: true }
    );

    if (!help) {
      // ตรวจว่า help request มีอยู่เลยไหม หรือมีคนรับไปแล้ว หรือเป็นของตัวเอง
      const existing = await HelpRequest.findOne({ helpId: req.params.id });
      if (!existing) return res.status(404).json({ error: 'ไม่พบคำขอ' });
      if (existing.requesterId?.toString() === user._id.toString())
        return res.status(400).json({ error: 'ไม่สามารถรับงานตัวเองได้' });
      return res.status(400).json({ error: 'คำขอนี้มีคนรับแล้ว' });
    }

    // อัปเดต ticket ด้วย
    const ticket = await Ticket.findOne({ ticketId: help.ticketId });
    if (ticket) {
      ticket.assignedTo   = user._id;
      ticket.assignedName = user.firstName + ' ' + user.lastName;
      if (['pending', 'assigned'].includes(ticket.status)) ticket.status = 'in_progress';
      await ticket.save();
    }
    res.json(help);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// PUT /api/help-requests/:id/cancel
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const help = await HelpRequest.findOne({ helpId: req.params.id });
    if (!help) return res.status(404).json({ error: 'ไม่พบคำขอ' });
    if (help.requesterId?.toString() !== user._id.toString())
      return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
    help.status = 'cancelled';
    await help.save();
    res.json(help);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
