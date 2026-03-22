const express = require('express');
const router = express.Router();
const { users, tickets } = require('../data/store');

// ─── Middleware ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// GET /api/technicians
router.get('/', requireAuth, (req, res) => {
  const techs = users.filter(u => u.role === 'technician').map(u => {
    const active = tickets.filter(t =>
      t.assignedTo === u.id && t.status !== 'completed' && t.status !== 'rejected'
    ).length;
    const total = tickets.filter(t => t.assignedTo === u.id).length;
    const capacity = active >= 5 ? 100 : active >= 3 ? 75 : active >= 1 ? 40 : 10;
    const statusLabel = active >= 5 ? 'FULL' : active >= 3 ? 'BUSY' : 'READY';
    return {
      id: u.id,
      name: u.firstName + ' ' + u.lastName,
      specialty: u.specialty,
      activeJobs: active,
      totalJobs: total,
      capacity,
      statusLabel
    };
  });
  res.json(techs);
});

module.exports = router;
