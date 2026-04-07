const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// ─── Middleware ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}
async function requireAdmin(req, res, next) {
  const user = await User.findById(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' });
  req.caller = user;
  next();
}

// ─── GET /api/categories ─────────────────────────────────────────
// Public — ดึงหมวดหมู่ทั้งหมดพร้อมชื่อช่าง
router.get('/', async (req, res) => {
  try {
    const cats = await Category.find().sort({ isDefault: -1, createdAt: 1 });
    // populate technician names
    const result = [];
    for (const cat of cats) {
      const techs = await User.find({ _id: { $in: cat.technicianIds }, role: 'technician' })
        .select('firstName lastName specialty');
      result.push({
        _id: cat._id,
        name: cat.name,
        label: cat.label,
        icon: cat.icon,
        isDefault: cat.isDefault,
        technicians: techs.map(t => ({
          _id: t._id,
          name: t.firstName + ' ' + t.lastName,
          specialty: t.specialty
        })),
        techCount: techs.length,
        createdAt: cat.createdAt
      });
    }
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/categories ────────────────────────────────────────
// Admin — สร้างหมวดหมู่ใหม่
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, label, icon } = req.body;
    if (!name || !label) return res.status(400).json({ error: 'กรุณากรอกชื่อและ label' });
    if (!icon) return res.status(400).json({ error: 'กรุณาเลือก icon' });

    // ตรวจ duplicate
    const exists = await Category.findOne({ name: name.trim() });
    if (exists) return res.status(400).json({ error: 'หมวดหมู่นี้มีอยู่แล้ว' });

    const cat = await new Category({
      name: name.trim(),
      label: label.trim(),
      icon: icon.trim(),
      isDefault: false
    }).save();

    res.status(201).json(cat);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── PUT /api/categories/:id ─────────────────────────────────────
// Admin — แก้ไขหมวดหมู่
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { label, icon } = req.body;
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });

    if (label) cat.label = label.trim();
    if (icon) cat.icon = icon.trim();
    await cat.save();

    res.json(cat);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── PUT /api/categories/:id/technicians ─────────────────────────
// Admin — ผูก/ลบช่างจากหมวดหมู่
router.put('/:id/technicians', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { technicianIds } = req.body; // array of user IDs
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });

    if (!Array.isArray(technicianIds)) return res.status(400).json({ error: 'technicianIds ต้องเป็น array' });

    // Validate all IDs are real technicians
    const validTechs = await User.find({ _id: { $in: technicianIds }, role: 'technician' });
    cat.technicianIds = validTechs.map(t => t._id);

    // Also update each technician's specialty to match this category
    for (const tech of validTechs) {
      if (tech.specialty !== cat.name) {
        tech.specialty = cat.name;
        await tech.save();
      }
    }

    await cat.save();

    res.json({ message: 'อัปเดตช่างสำเร็จ', techCount: cat.technicianIds.length });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── DELETE /api/categories/:id ──────────────────────────────────
// Admin — ลบหมวดหมู่ (ป้องกันถ้ามี ticket ค้าง)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });

    // ตรวจ ticket ที่ยังไม่เสร็จ
    const activeTickets = await Ticket.countDocuments({
      category: cat.name,
      status: { $nin: ['completed', 'rejected'] }
    });
    if (activeTickets > 0) {
      return res.status(400).json({
        error: `ไม่สามารถลบได้ — ยังมี ${activeTickets} เรื่องร้องเรียนที่ยังไม่เสร็จ`,
        activeTickets
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'ลบหมวดหมู่สำเร็จ' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
