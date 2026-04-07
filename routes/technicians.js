const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const Ticket  = require('../models/Ticket');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}
async function requireAdmin(req, res, next) {
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' });
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
        firstName: u.firstName, lastName: u.lastName,
        email: u.email,
        specialty: u.specialty, activeJobs: active,
        totalJobs: total, capacity, statusLabel
      };
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// PUT /api/technicians/:id — Admin edit technician name/specialty
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, specialty } = req.body;
    const tech = await User.findOne({ _id: req.params.id, role: 'technician' });
    if (!tech) return res.status(404).json({ error: 'ไม่พบช่าง' });

    if (firstName) tech.firstName = firstName.trim();
    if (lastName) tech.lastName = lastName.trim();
    if (specialty !== undefined) tech.specialty = specialty.trim();
    await tech.save();

    res.json({ message: 'อัปเดตข้อมูลช่างสำเร็จ', name: tech.firstName + ' ' + tech.lastName });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// POST /api/technicians — Admin add new technician
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, password, specialty } = req.body;
    if (!firstName || !email || !password) {
      return res.status(400).json({ error: 'กรุณากรอก ชื่อ, อีเมล, และรหัสผ่าน' });
    }

    // Check duplicate email
    const exists = await User.findOne({ email: email.trim().toLowerCase() });
    if (exists) return res.status(400).json({ error: 'อีเมลนี้มีอยู่ในระบบแล้ว' });

    const hashed = await bcrypt.hash(password, 10);
    const tech = await new User({
      firstName: firstName.trim(),
      lastName: (lastName || '-').trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role: 'technician',
      specialty: (specialty || '').trim()
    }).save();

    res.status(201).json({
      message: 'เพิ่มช่างสำเร็จ',
      id: tech._id,
      name: tech.firstName + ' ' + tech.lastName
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// DELETE /api/technicians/:id — Admin delete technician
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tech = await User.findOne({ _id: req.params.id, role: 'technician' });
    if (!tech) return res.status(404).json({ error: 'ไม่พบช่าง' });

    // Check if tech has active tickets
    const activeCount = await Ticket.countDocuments({
      assignedTo: tech._id,
      status: { $nin: ['completed', 'rejected'] }
    });
    if (activeCount > 0) {
      return res.status(400).json({ error: 'ไม่สามารถลบได้ — ช่างยังมีงานค้าง ' + activeCount + ' งาน' });
    }

    await User.findByIdAndDelete(tech._id);
    res.json({ message: 'ลบช่างสำเร็จ' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;

