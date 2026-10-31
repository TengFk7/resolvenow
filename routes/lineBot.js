/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── routes/lineBot.js ─────────────────────────────────────────
// LINE Official Account Webhook Router
// รองรับ:
// 1. Live Ticket Tracking เฉพาะเจ้าของเคส (PDPA Compliant) พร้อม Flex Message
// 2. Gemini 2.5 Flash Citizen Support AI พร้อม Conversation Memory & Strict Guardrails
// 3. Smart Service Navigator (เมนูนำทางบริการประชาชน)
// 4. AI Handoff ส่งเรื่องต่อให้ Admin Portal พร้อมแจ้งเตือน Socket.IO สด
// 5. Diagnostic & Inspection Endpoint สำหรับตรวจสอบการรับ-ส่งข้อความสด

const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const LineInquiry = require('../models/LineInquiry');
const {
  validateLineSignature,
  replyLineMessage,
  buildTicketFlexMessage,
  buildUnauthorizedMessage,
  buildNoTicketsMessage,
  buildServiceNavigatorFlexMessage,
  getLineUserProfile
} = require('../config/lineBotService');
const { askCitizenAI } = require('../utils/lineAiAgent');

// ── In-Memory State สำหรับติดตามผู้ใช้ที่กำลังส่งเรื่องให้ Admin ────────
const PENDING_INQUIRIES = new Map();
const INQUIRY_TTL_MS = 15 * 60 * 1000; // 15 นาที

// ── In-Memory Ring Buffer สำหรับ Diagnostic Logs (เก็บ 20 รายการล่าสุด) ──
const DEBUG_LOGS = [];
function recordDiagnosticEvent(entry) {
  DEBUG_LOGS.unshift({
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (DEBUG_LOGS.length > 20) {
    DEBUG_LOGS.pop();
  }
}

// ── GET /api/line/webhook (Health / Uptime Check) ────────────────
router.get('/webhook', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ResolveNow LINE Official Account Webhook',
    timestamp: new Date().toISOString()
  });
});

// ── GET /api/line/diagnostic (Live Diagnostic Dashboard) ────────
router.get('/diagnostic', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    config: {
      hasChannelToken: !!process.env.LINE_CHANNEL_TOKEN,
      hasChannelSecret: !!process.env.LINE_CHANNEL_SECRET,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      baseUrl: process.env.BASE_URL || 'http://localhost:3001'
    },
    totalRecentEvents: DEBUG_LOGS.length,
    recentEvents: DEBUG_LOGS
  });
});

// ── POST /api/line/webhook (LINE Messaging API Events) ───────────
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-line-signature'];

  // ตรวจสอบความถูกต้องของ Signature (HMAC-SHA256)
  const isValid = validateLineSignature(req.rawBody || JSON.stringify(req.body), signature);
  if (!isValid) {
    console.warn('[LINE Webhook] Rejected invalid signature.');
    recordDiagnosticEvent({
      type: 'signature_rejected',
      signature: signature ? 'present' : 'missing',
      headers: req.headers
    });
    return res.status(401).send('Invalid signature');
  }

  // ส่ง 200 OK ให้ LINE ทันที ป้องกัน Webhook Timeout
  res.status(200).send('OK');

  const events = req.body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    console.log('[LINE Webhook] Received webhook ping/verify (0 events).');
    recordDiagnosticEvent({ type: 'webhook_ping', eventsCount: 0 });
    return;
  }

  console.log(`[LINE Webhook] Processing ${events.length} event(s)...`);

  // ประมวลผลแต่ละ Event แบบ Asynchronous
  for (const event of events) {
    try {
      if (event.type !== 'message' || event.message?.type !== 'text') {
        recordDiagnosticEvent({
          type: event.type,
          messageType: event.message?.type,
          info: 'Non-text event skipped'
        });
        continue;
      }

      const replyToken = event.replyToken;
      const lineUserId = event.source?.userId;
      const text = (event.message?.text || '').trim();

      console.log(`[LINE Webhook] Message received from ${lineUserId}: "${text}"`);

      if (!replyToken || !text) continue;

      // ── ตรวจสอบว่าผู้ใช้กำลังอยู่ในขั้นตอน "พิมพ์เรื่องส่งต่อให้ Admin" หรือไม่ ──
      const pendingInquiry = PENDING_INQUIRIES.get(lineUserId);
      if (pendingInquiry && (Date.now() - pendingInquiry.startedAt < INQUIRY_TTL_MS)) {
        if (/ยกเลิก|cancel|ไม่เอาแล้ว/i.test(text)) {
          PENDING_INQUIRIES.delete(lineUserId);
          const cancelMsg = 'ยกเลิกการส่งเรื่องถึงเจ้าหน้าที่เรียบร้อยแล้วครับ หากต้องการสอบถามเรื่องอื่น สามารถพิมพ์ถามผมได้เลยนะครับ 😊';
          const replyResult = await replyLineMessage(replyToken, cancelMsg);
          recordDiagnosticEvent({ lineUserId, userText: text, intent: 'admin_handoff_cancelled', replyResult });
          continue;
        }

        // ประมวลผลบันทึกเรื่องส่งต่อให้ Admin
        await handleCitizenInquirySubmission(req, replyToken, lineUserId, text);
        PENDING_INQUIRIES.delete(lineUserId);
        continue;
      }

      // ── ตรวจสอบว่าผู้ใช้กำลังอยู่ใน "โหมดคุยสดกับเจ้าหน้าที่ (Live Admin Chat Session)" หรือไม่ ──
      const activeInquiry = await LineInquiry.findOne({
        lineUserId,
        isActiveSession: true,
        lastActivityAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) }
      });

      if (activeInquiry) {
        console.log(`[LINE Webhook] Active live chat for ${lineUserId}. Forwarding to Admin: "${text}"`);
        activeInquiry.messages.push({
          sender: 'citizen',
          senderName: activeInquiry.displayName || 'ประชาชน',
          text,
          sentAt: new Date()
        });
        activeInquiry.status = 'pending';
        activeInquiry.lastActivityAt = new Date();
        await activeInquiry.save();

        const io = req.app.get('io');
        if (io) {
          io.to('admin_dm').emit('line_inquiry_message', {
            inquiryId: activeInquiry._id,
            sender: 'citizen',
            senderName: activeInquiry.displayName,
            text,
            sentAt: new Date()
          });
        }

        recordDiagnosticEvent({
          lineUserId,
          userText: text,
          intent: 'live_admin_chat_forwarded',
          inquiryId: activeInquiry._id
        });

        // จบการทำงานในรอบนี้ทันที ไม่ส่งต่อให้ AI ตอบแทรก!
        continue;
      }

      // ── Intent 1: Smart Service Navigator (ติดต่อสอบถาม / ขอสอบถาม / เมนู) ──
      if (/ติดต่อสอบถาม|ขอสอบถาม|ต้องการสอบถาม|เมนู|menu|บริการ/i.test(text)) {
        const navFlex = buildServiceNavigatorFlexMessage();
        const replyResult = await replyLineMessage(replyToken, navFlex);
        recordDiagnosticEvent({ lineUserId, userText: text, intent: 'service_navigator', replyResult });
        continue;
      }

      // ── Intent 2: ขอยื่นเรื่องติดต่อเจ้าหน้าที่ (Admin Handoff Trigger) ──────
      if (/ติดต่อเจ้าหน้าที่|คุยกับแอดมิน|ติดต่อแอดมิน|คุยกับคน|แจ้งแอดมิน/i.test(text)) {
        PENDING_INQUIRIES.set(lineUserId, { startedAt: Date.now() });
        const promptMsg = 'รับทราบครับ! เพื่อให้เจ้าหน้าที่แอดมินดูแลและประสานงานให้คุณได้อย่างรวดเร็ว กรุณาพิมพ์แจ้ง "เรื่องที่ต้องการติดต่อหรือปัญหาที่พบ" และ "เบอร์โทรศัพท์ติดต่อกลับ (ถ้าสะดวก)" เข้ามาในแชตนี้ได้เลยครับ 📝\n\n(หากต้องการยกเลิก สามารถพิมพ์ว่า "ยกเลิก" ได้ครับ)';
        const replyResult = await replyLineMessage(replyToken, promptMsg);
        recordDiagnosticEvent({ lineUserId, userText: text, intent: 'admin_handoff_initiated', replyResult });
        continue;
      }

      // ── Intent 3: ตรวจจับเลขตั๋ว TKT-xxxxx ─────────────────────
      const ticketMatch = text.match(/(TKT-\d+)/i);
      if (ticketMatch) {
        const targetTicketId = ticketMatch[1].toUpperCase();
        await handleTicketTracking(replyToken, lineUserId, targetTicketId, text);
        continue;
      }

      // ── Intent 4: ตรวจจับคำขอเช็ค "เรื่องของฉัน / สถานะของฉัน" ────
      if (/เรื่องของฉัน|สถานะของฉัน|ติดตามเรื่อง|ตั๋วของฉัน|เรื่องที่แจ้ง/i.test(text)) {
        await handleMyTicketsList(replyToken, lineUserId, text);
        continue;
      }

      // ── Intent 5: คำถามทั่วไป ส่งให้ Citizen AI ตอบ ─────────────
      console.log(`[LINE Webhook] Calling Gemini AI for: "${text}"...`);
      const aiReply = await askCitizenAI(text, lineUserId);
      console.log(`[LINE Webhook] Gemini AI generated reply (${aiReply.length} chars). Sending to LINE...`);

      const replyResult = await replyLineMessage(replyToken, aiReply);
      recordDiagnosticEvent({
        lineUserId,
        userText: text,
        intent: 'ai_citizen_qa',
        aiReply,
        replyResult
      });

    } catch (err) {
      console.error('[LINE Webhook] Error processing event:', err);
      recordDiagnosticEvent({
        type: 'error',
        error: err.message || String(err)
      });
    }
  }
});

/**
 * บันทึกข้อความและข้อมูลติดต่อของประชาชนส่งต่อให้ Admin Portal
 */
async function handleCitizenInquirySubmission(req, replyToken, lineUserId, text) {
  try {
    const phoneMatch = text.match(/(0\d{8,9}|\+66\d{8,9})/);
    const phone = phoneMatch ? phoneMatch[1] : null;

    // ดึงโปรไฟล์ LINE (ถ้ามีสิทธิ์)
    const profile = await getLineUserProfile(lineUserId);

    const inquiry = await LineInquiry.create({
      lineUserId,
      displayName: profile?.displayName || 'ผู้ใช้งาน LINE',
      pictureUrl: profile?.pictureUrl || null,
      phone,
      message: text,
      status: 'pending',
      isActiveSession: true,
      lastActivityAt: new Date(),
      messages: [{
        sender: 'citizen',
        senderName: profile?.displayName || 'ผู้ใช้งาน LINE',
        text,
        sentAt: new Date()
      }]
    });

    // ส่งสัญญาณเตือน Socket.IO เข้าห้อง admin_dm แบบเรียลไทม์
    const io = req.app.get('io');
    if (io) {
      io.to('admin_dm').emit('line_inquiry_new', {
        _id: inquiry._id,
        lineUserId: inquiry.lineUserId,
        displayName: inquiry.displayName,
        pictureUrl: inquiry.pictureUrl,
        phone: inquiry.phone,
        message: inquiry.message,
        status: inquiry.status,
        createdAt: inquiry.createdAt
      });
    }

    const confirmMsg = '✅ ส่งเรื่องถึงเจ้าหน้าที่แอดมินเรียบร้อยแล้วครับ!\n\nเจ้าหน้าที่จะตรวจสอบข้อมูลและตอบกลับทางแชต LINE นี้ หรือติดต่อกลับตามเบอร์โทรศัพท์โดยเร็วที่สุดครับ (วันและเวลาทำการ จ.-ศ. 08:30 - 16:30 น.)';
    const replyResult = await replyLineMessage(replyToken, confirmMsg);

    recordDiagnosticEvent({
      lineUserId,
      userText: text,
      intent: 'admin_inquiry_submitted',
      inquiryId: inquiry._id,
      phone,
      replyResult
    });
  } catch (err) {
    console.error('[LINE Webhook] handleCitizenInquirySubmission error:', err);
    await replyLineMessage(replyToken, 'ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองส่งใหม่อีกครั้ง');
  }
}

/**
 * จัดการตรวจสอบและแสดงผลตั๋วร้องเรียน (Strict Ownership / PDPA Check)
 */
async function handleTicketTracking(replyToken, lineUserId, ticketId, originalText) {
  try {
    const ticket = await Ticket.findOne({ ticketId }).lean();

    if (!ticket) {
      const msg = `🔍 ไม่พบข้อมูลเรื่องร้องเรียนรหัส "${ticketId}" ในระบบครับ กรุณาตรวจสอบรหัสตั๋วอีกครั้ง`;
      const replyResult = await replyLineMessage(replyToken, msg);
      recordDiagnosticEvent({
        lineUserId,
        userText: originalText,
        intent: 'ticket_not_found',
        ticketId,
        replyResult
      });
      return;
    }

    // ตรวจสอบสิทธิ์ความเป็นเจ้าของเคส (PDPA Guard)
    let isOwner = false;

    // เงื่อนไข 1: ticket.citizenLineId ตรงกับ lineUserId
    if (ticket.citizenLineId && ticket.citizenLineId === lineUserId) {
      isOwner = true;
    }

    // เงื่อนไข 2: หาก citizenId ตรงกับบัญชี User ที่ผูก lineUserId นี้ไว้
    if (!isOwner && ticket.citizenId && lineUserId) {
      const user = await User.findOne({ lineUserId }).select('_id').lean();
      if (user && ticket.citizenId.toString() === user._id.toString()) {
        isOwner = true;
      }
    }

    if (isOwner) {
      // เป็นเจ้าของเคสตัวจริง -> ส่งการ์ด Flex Message สวยงาม
      const flexMsg = buildTicketFlexMessage(ticket);
      const replyResult = await replyLineMessage(replyToken, flexMsg);
      recordDiagnosticEvent({
        lineUserId,
        userText: originalText,
        intent: 'ticket_tracking_authorized',
        ticketId,
        isOwner: true,
        replyResult
      });
    } else {
      // ไม่ใช่เจ้าของเคส หรือยังไม่ได้ผูกบัญชี -> ปฏิเสธอย่างสุภาพตามหลัก PDPA
      const unauthMsgs = buildUnauthorizedMessage(ticketId);
      const replyResult = await replyLineMessage(replyToken, unauthMsgs);
      recordDiagnosticEvent({
        lineUserId,
        userText: originalText,
        intent: 'ticket_tracking_unauthorized',
        ticketId,
        isOwner: false,
        replyResult
      });
    }
  } catch (err) {
    console.error('[LINE Webhook] handleTicketTracking error:', err);
    await replyLineMessage(replyToken, 'ขออภัยครับ เกิดข้อผิดพลาดในการดึงข้อมูลสถานะตั๋ว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * จัดการแสดงรายการเรื่องร้องเรียนล่าสุดของบัญชีผู้ใช้ LINE นี้
 */
async function handleMyTicketsList(replyToken, lineUserId, originalText) {
  try {
    if (!lineUserId) {
      const msgs = buildNoTicketsMessage();
      const replyResult = await replyLineMessage(replyToken, msgs);
      recordDiagnosticEvent({
        lineUserId,
        userText: originalText,
        intent: 'my_tickets_no_userid',
        replyResult
      });
      return;
    }

    // หา user จาก lineUserId (ถ้ามี)
    const user = await User.findOne({ lineUserId }).select('_id').lean();

    const query = {
      $or: [
        { citizenLineId: lineUserId },
        ...(user ? [{ citizenId: user._id }] : [])
      ]
    };

    const tickets = await Ticket.find(query).sort({ createdAt: -1 }).limit(3).lean();

    if (!tickets || tickets.length === 0) {
      const msgs = buildNoTicketsMessage();
      const replyResult = await replyLineMessage(replyToken, msgs);
      recordDiagnosticEvent({
        lineUserId,
        userText: originalText,
        intent: 'my_tickets_empty',
        replyResult
      });
      return;
    }

    // ส่งการ์ด Flex Message ทีละเรื่อง (สูงสุด 3 เรื่องล่าสุด)
    const flexMessages = tickets.map(t => buildTicketFlexMessage(t));
    const replyResult = await replyLineMessage(replyToken, flexMessages);
    recordDiagnosticEvent({
      lineUserId,
      userText: originalText,
      intent: 'my_tickets_found',
      count: tickets.length,
      replyResult
    });

  } catch (err) {
    console.error('[LINE Webhook] handleMyTicketsList error:', err);
    await replyLineMessage(replyToken, 'ขออภัยครับ เกิดข้อผิดพลาดในการค้นหาเรื่องร้องเรียน กรุณาลองใหม่อีกครั้ง');
  }
}

module.exports = router;
