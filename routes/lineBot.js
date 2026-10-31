/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── routes/lineBot.js ─────────────────────────────────────────
// LINE Official Account Webhook Router
// รองรับ:
// 1. Live Ticket Tracking เฉพาะเจ้าของเคส (PDPA Compliant) พร้อม Flex Message
// 2. Gemini 2.5 Flash Citizen Support AI พร้อม Conversation Memory & Strict Guardrails
// 3. Diagnostic & Inspection Endpoint สำหรับตรวจสอบการรับ-ส่งข้อความสด

const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const {
  validateLineSignature,
  replyLineMessage,
  buildTicketFlexMessage,
  buildUnauthorizedMessage,
  buildNoTicketsMessage
} = require('../config/lineBotService');
const { askCitizenAI } = require('../utils/lineAiAgent');

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

      // ── Intent 1: ตรวจจับเลขตั๋ว TKT-xxxxx ─────────────────────
      const ticketMatch = text.match(/(TKT-\d+)/i);
      if (ticketMatch) {
        const targetTicketId = ticketMatch[1].toUpperCase();
        await handleTicketTracking(replyToken, lineUserId, targetTicketId, text);
        continue;
      }

      // ── Intent 2: ตรวจจับคำขอเช็ค "เรื่องของฉัน / สถานะของฉัน" ────
      if (/เรื่องของฉัน|สถานะของฉัน|ติดตามเรื่อง|ตั๋วของฉัน|เรื่องที่แจ้ง/i.test(text)) {
        await handleMyTicketsList(replyToken, lineUserId, text);
        continue;
      }

      // ── Intent 3: คำถามทั่วไป ส่งให้ Citizen AI ตอบ ─────────────
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
