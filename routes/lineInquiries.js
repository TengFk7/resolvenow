/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── routes/lineInquiries.js ──────────────────────────────────
// API สำหรับผู้ดูแลระบบ (Admin Portal) ในการจัดการข้อความติดต่อจาก LINE OA
// รองรับ Live Two-Way Chat และการปิดการสนทนา (End Chat)

const express = require('express');
const router = express.Router();
const LineInquiry = require('../models/LineInquiry');
const User = require('../models/User');
const { pushAdminReplyToCitizen, pushAdminEndChatNotification } = require('../config/lineBotService');
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

    // 2. บันทึกประวัติคำตอบลงฐานข้อมูล (ทั้ง replies และ messages array)
    const now = new Date();
    inquiry.replies.push({
      adminId: req.session.userId,
      adminName,
      message: replyMessage,
      sentAt: now
    });

    if (!inquiry.messages) inquiry.messages = [];
    inquiry.messages.push({
      sender: 'admin',
      senderName: adminName,
      text: replyMessage,
      sentAt: now
    });

    inquiry.status = 'replied';
    inquiry.isActiveSession = true;
    inquiry.lastActivityAt = now;
    // ปิด AI ชั่วคราว 15 นาทีหลังจากแอดมินตอบกลับ
    inquiry.adminTakeoverUntil = new Date(now.getTime() + 15 * 60 * 1000);
    await inquiry.save();

    // 3. ยิง Socket.IO แจ้งเตือนแอดมินคนอื่นที่เปิดหน้านี้อยู่แบบ Real-time
    const io = req.app.get('io');
    if (io) {
      io.to('admin_dm').emit('line_inquiry_message', {
        inquiryId: inquiry._id,
        sender: 'admin',
        senderName: adminName,
        text: replyMessage,
        sentAt: now
      });
      io.to('admin_dm').emit('line_inquiry_updated', {
        inquiryId: inquiry._id,
        status: inquiry.status,
        isActiveSession: inquiry.isActiveSession,
        adminTakeoverUntil: inquiry.adminTakeoverUntil,
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

// ── POST /api/line-inquiries/:id/close (แอดมินกดจบการสนทนา & ส่งแจ้งเตือน) ──
router.post('/:id/close', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const inquiry = await LineInquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ error: 'ไม่พบรายการข้อความนี้' });
    }

    // ดึงชื่อของ Admin
    let adminName = req.session.firstName ? `${req.session.firstName} ${req.session.lastName || ''}`.trim() : 'เจ้าหน้าที่แอดมิน';

    // 1. ส่ง Push Message แจ้งจบการสนทนาไปยัง LINE ประชาชน
    await pushAdminEndChatNotification(inquiry.lineUserId, adminName);

    // 2. ปิด Session และเปลี่ยนสถานะเป็น resolved
    inquiry.isActiveSession = false;
    inquiry.adminTakeoverUntil = null; // คืนสู่โหมด AI ทันที
    inquiry.status = 'resolved';
    inquiry.lastActivityAt = new Date();
    await inquiry.save();

    // 3. แจ้งเตือน Socket.IO ให้หน้าจอ Admin ปรับสถานะทันที
    const io = req.app.get('io');
    if (io) {
      io.to('admin_dm').emit('line_inquiry_updated', {
        inquiryId: inquiry._id,
        status: 'resolved',
        isActiveSession: false,
        adminTakeoverUntil: null
      });
    }

    res.json({
      success: true,
      message: 'จบการสนทนาและส่งข้อความแจ้งประชาชนเรียบร้อยแล้ว',
      inquiry
    });
  } catch (err) {
    console.error('[LineInquiries] Close session error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการปิดการสนทนา' });
  }
});

// ── PATCH /api/line-inquiries/:id/status (เปลี่ยนสถานะ เช่น เปิดใหม่) ──
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'replied', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    }

    const updateData = { status };
    if (status === 'resolved') {
      updateData.isActiveSession = false;
      updateData.adminTakeoverUntil = null;
    } else {
      updateData.isActiveSession = true;
      updateData.lastActivityAt = new Date();
    }

    const inquiry = await LineInquiry.findByIdAndUpdate(
      id,
      updateData,
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
        isActiveSession: inquiry.isActiveSession,
        adminTakeoverUntil: inquiry.adminTakeoverUntil,
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
