/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── routes/lineInquiries.js ──────────────────────────────────
// API สำหรับผู้ดูแลระบบ (Admin Portal) ในการจัดการข้อความติดต่อจาก LINE OA

const express = require('express');
const router = express.Router();
const LineInquiry = require('../models/LineInquiry');
const User = require('../models/User');
const { pushAdminReplyToCitizen } = require('../config/lineBotService');
const xss = require('xss');

// ── Middleware ตรวจสอบสิทธิ์ Admin ──────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น' });
  }
  next();
}

// ── GET /api/line-inquiries (ดึงรายการข้อความและจำนวนรอดำเนินการ) ──
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    const [inquiries, unreadCount] = await Promise.all([
      LineInquiry.find(query).sort({ createdAt: -1 }).limit(100).lean(),
      LineInquiry.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      unreadCount,
      inquiries
    });
  } catch (err) {
    console.error('[LineInquiries] GET error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// ── POST /api/line-inquiries/:id/reply (แอดมินพิมพ์ตอบกลับส่งเข้า LINE) ──
router.post('/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { replyMessage } = req.body;

    if (!replyMessage || typeof replyMessage !== 'string' || !replyMessage.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกข้อความตอบกลับ' });
    }

    replyMessage = xss(replyMessage.trim());

    const inquiry = await LineInquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ error: 'ไม่พบรายการข้อความนี้' });
    }

    // ดึงชื่อของ Admin จาก Session หรือ Database
    let adminName = req.session.firstName ? `${req.session.firstName} ${req.session.lastName || ''}`.trim() : 'เจ้าหน้าที่แอดมิน';
    if (!req.session.firstName) {
      const adminUser = await User.findById(req.session.userId).select('firstName lastName').lean();
      if (adminUser && adminUser.firstName) {
        adminName = `${adminUser.firstName} ${adminUser.lastName || ''}`.trim();
      }
    }

    // 1. ส่ง Push Message เข้าแชต LINE ของประชาชนโดยตรง
    const pushResult = await pushAdminReplyToCitizen(inquiry.lineUserId, adminName, replyMessage);

    // 2. บันทึกประวัติคำตอบลงฐานข้อมูล
    inquiry.replies.push({
      adminId: req.session.userId,
      adminName,
      message: replyMessage,
      sentAt: new Date()
    });
    inquiry.status = 'replied';
    await inquiry.save();

    // 3. ยิง Socket.IO แจ้งเตือนแอดมินคนอื่นที่เปิดหน้านี้อยู่
    const io = req.app.get('io');
    if (io) {
      io.to('admin_dm').emit('line_inquiry_updated', {
        inquiryId: inquiry._id,
        status: inquiry.status,
        replies: inquiry.replies
      });
    }

    res.json({
      success: true,
      pushDelivered: pushResult.success,
      inquiry
    });
  } catch (err) {
    console.error('[LineInquiries] Reply error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตอบกลับข้อความ' });
  }
});

// ── PATCH /api/line-inquiries/:id/status (เปลี่ยนสถานะ เช่น เสร็จสิ้น) ──
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'replied', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    }

    const inquiry = await LineInquiry.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!inquiry) {
      return res.status(404).json({ error: 'ไม่พบรายการข้อความนี้' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to('admin_dm').emit('line_inquiry_updated', {
        inquiryId: inquiry._id,
        status: inquiry.status,
        replies: inquiry.replies
      });
    }

    res.json({
      success: true,
      inquiry
    });
  } catch (err) {
    console.error('[LineInquiries] Status update error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ' });
  }
});

module.exports = router;

