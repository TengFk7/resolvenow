const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Ticket  = require('../models/Ticket');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// GET /api/technicians
router.get('/', requireAuth, async (req, res) => {
  try {
    const techs = await User.find({ role: 'technician' }).select('-password');
    const result = await Promise.all(techs.map(async (u) => {
      const active = await Ticket.countDocuments({
        assignedTo: u._id,
        status: { $nin: ['completed', 'rejected'] }
      });
      const total = await Ticket.countDocuments({ assignedTo: u._id });
      const capacity   = active >= 5 ? 100 : active >= 3 ? 75 : active >= 1 ? 40 : 10;
      const statusLabel = active >= 5 ? 'FULL' : active >= 3 ? 'BUSY' : 'READY';
      return {
        id: u._id, name: u.firstName + ' ' + u.lastName,
        specialty: u.specialty, activeJobs: active,
        totalJobs: total, capacity, statusLabel
      };
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
