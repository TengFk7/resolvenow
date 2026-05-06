const express = require('express');
const router = express.Router();
const xss = require('xss');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');

/* ── Auth middleware ─────────────────────────────── */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'เฉพาะ admin' });
  next();
}

/* ─────────────────────────────────────────────────────────
   GET /api/direct-messages
   Citizen: ดึงประวัติแชตของตัวเอง
   ───────────────────────────────────────────────────────── */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId, role } = req.session;
    if (role !== 'citizen') return res.status(403).json({ error: 'เฉพาะ citizen' });

    const messages = await DirectMessage.find({ citizenId: userId })
      .sort({ createdAt: 1 })
      .limit(200);

    // Mark admin's messages to this citizen as read
    await DirectMessage.updateMany(
      { citizenId: userId, senderRole: 'admin', isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (err) {
    console.error('[DirectMsg] GET /:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/direct-messages/unread-count
   Citizen: นับข้อความที่ยังไม่ได้อ่าน (admin reply)
   ───────────────────────────────────────────────────────── */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const { userId, role } = req.session;
    if (role !== 'citizen') return res.json({ count: 0 });
    const count = await DirectMessage.countDocuments({
      citizenId: userId,
      senderRole: 'admin',
      isRead: false
    });
    res.json({ count });
  } catch (err) {
    res.json({ count: 0 });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/direct-messages/all
   Admin: ดึง list ของ citizen ที่มีการแชต พร้อม unread count
   ───────────────────────────────────────────────────────── */
router.get('/all', requireAdmin, async (req, res) => {
  try {
    // Group by citizenId — get latest message + unread count
    const pipeline = [
      {
        $group: {
          _id: '$citizenId',
          lastMessage: { $last: '$message' },
          lastSenderRole: { $last: '$senderRole' },
          lastAt: { $last: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$senderRole', 'citizen'] }, { $eq: ['$isRead', false] }] },
                1, 0
              ]
            }
          }
        }
      },
      { $sort: { lastAt: -1 } }
    ];
    const groups = await DirectMessage.aggregate(pipeline);

    // Populate citizen names
    const citizenIds = groups.map(g => g._id);
    const users = await User.find({ _id: { $in: citizenIds } }, 'firstName lastName avatar email').lean();
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const result = groups.map(g => ({
      citizenId: g._id,
      citizen: userMap[String(g._id)] || { firstName: 'ไม่ทราบชื่อ', lastName: '' },
      lastMessage: g.lastMessage,
      lastSenderRole: g.lastSenderRole,
      lastAt: g.lastAt,
      unreadCount: g.unreadCount
    }));

    res.json(result);
  } catch (err) {
    console.error('[DirectMsg] GET /all:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/direct-messages/admin-unread
   Admin: นับข้อความ citizen ที่ยังไม่ได้อ่าน (total)
   ───────────────────────────────────────────────────────── */
router.get('/admin-unread', requireAdmin, async (req, res) => {
  try {
    const count = await DirectMessage.countDocuments({ senderRole: 'citizen', isRead: false });
    res.json({ count });
  } catch (err) {
    res.json({ count: 0 });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/direct-messages/:citizenId
   Admin: ดึงประวัติแชตกับ citizen คนนั้น
   ───────────────────────────────────────────────────────── */
router.get('/:citizenId', requireAdmin, async (req, res) => {
  try {
    const { citizenId } = req.params;
    const messages = await DirectMessage.find({ citizenId })
      .sort({ createdAt: 1 })
      .limit(200);

    // Mark citizen messages as read
    await DirectMessage.updateMany(
      { citizenId, senderRole: 'citizen', isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (err) {
    console.error('[DirectMsg] GET /:citizenId:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/direct-messages
   Citizen หรือ Admin: ส่งข้อความ
   Body: { message, citizenId? }  (citizenId required if admin)
   ───────────────────────────────────────────────────────── */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { userId, role, firstName, lastName } = req.session;
    const rawMsg = (req.body.message || '').trim();
    if (!rawMsg) return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความ' });
    if (rawMsg.length > 500) return res.status(400).json({ error: 'ข้อความยาวเกิน 500 ตัวอักษร' });

    const cleanMsg = xss(rawMsg);

    let citizenId;
    if (role === 'citizen') {
      citizenId = userId;
    } else if (role === 'admin') {
      if (!req.body.citizenId) return res.status(400).json({ error: 'ระบุ citizenId' });
      citizenId = req.body.citizenId;
    } else {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
    }

    const senderName = [firstName, lastName].filter(Boolean).join(' ') || 'ไม่ทราบชื่อ';

    const msg = await DirectMessage.create({
      senderId: userId,
      senderName,
      senderRole: role,
      citizenId,
      message: cleanMsg,
      isRead: false
    });

    // Emit via socket.io
    const io = req.app.get('io');
    if (io) {
      // Notify the other party
      if (role === 'citizen') {
        io.to('admin_dm').emit('dm_message', msg);
      } else {
        io.to('citizen_dm_' + citizenId).emit('dm_message', msg);
      }
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error('[DirectMsg] POST /:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
