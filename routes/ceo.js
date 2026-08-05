const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Category = require('../models/Category');
const { checkIsSlaBreached } = require('../utils/slaHelper');

// GET /api/ceo/tickets - ดึง tickets ทั้งหมดแบบ read-only สำหรับ dashboard
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });

    const formattedTickets = tickets.map(t => {
      return {
        ticketId: t.ticketId,
        category: t.category,
        location: t.location,
        urgency: t.urgency,
        status: t.status,
        slaBreached: checkIsSlaBreached(t),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      };
    });

    res.json(formattedTickets);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/ceo/technicians - ดึงข้อมูลช่างทั้งหมด
router.get('/technicians', async (req, res) => {
  try {
    const techs = await User.find({ role: 'technician' }).select('firstName lastName specialty email');
    const result = await Promise.all(techs.map(async (u) => {
      const active = await Ticket.countDocuments({
        assignedTo: u._id,
        status: { $nin: ['completed', 'rejected'] }
      });
      const total = await Ticket.countDocuments({ assignedTo: u._id });
      const capacity = active >= 5 ? 100 : active >= 3 ? 75 : active >= 1 ? 40 : 10;
      const statusLabel = active >= 5 ? 'FULL' : active >= 3 ? 'BUSY' : 'READY';
      return {
        id: u._id,
        name: u.firstName + ' ' + u.lastName,
        specialty: u.specialty,
        activeJobs: active,
        totalJobs: total,
        capacity,
        statusLabel
      };
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/ceo/categories - ดึงหมวดหมู่ (ไม่ต้องมี auth)
router.get('/categories', async (req, res) => {
  try {
    const cats = await Category.find().sort({ isDefault: -1, createdAt: 1 });
    res.json(cats.map(c => ({ name: c.name, label: c.label })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
