const express = require('express');
const router  = express.Router();
const Ticket  = require('../models/Ticket');

// ─── Public Ticket Status Lookup ─────────────────────────────────
// POST /api/track
// Body: { ticketId: "TKT-001" }
// Returns ONLY location + status (no PII)
// ──────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId || typeof ticketId !== 'string' || !ticketId.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสอ้างอิง (Ticket ID)' });
    }

    const sanitized = ticketId.trim().toUpperCase();

    // Find ticket — select ONLY safe fields, explicitly exclude PII
    const ticket = await Ticket.findOne(
      { ticketId: sanitized },
      'ticketId location status category createdAt'   // whitelist: no citizenName, citizenId, citizenLineId, etc.
    ).lean();

    if (!ticket) {
      return res.status(404).json({ error: 'ไม่พบข้อมูล กรุณาตรวจสอบรหัสอีกครั้ง' });
    }

    // Return only safe, minimal data
    res.json({
      ticketId:  ticket.ticketId,
      location:  ticket.location,
      status:    ticket.status,
      category:  ticket.category,
      createdAt: ticket.createdAt,
    });

  } catch (err) {
    console.error('[Track] Error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
