/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const express = require('express');
const router  = express.Router();
const Ticket  = require('../models/Ticket');

// ─── Public Ticket Status Lookup ─────────────────────────────────
// POST /api/track
// Body: { ticketId: "TKT-001" }
// Returns ONLY location + status (no PII)
// ──────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId || typeof ticketId !== 'string' || !ticketId.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสอ้างอิง (Ticket ID)' });
    }

    const sanitized = ticketId.trim().toUpperCase();

    // Find ticket — select ONLY safe fields, explicitly exclude PII
    const ticket = await Ticket.findOne(
      { ticketId: sanitized },
      'ticketId location status category createdAt updatedAt assignedName timeline materials totalRepairCost'
    ).lean();

    if (!ticket) {
      return res.status(404).json({ error: 'ไม่พบข้อมูล กรุณาตรวจสอบรหัสอีกครั้ง' });
    }

    // Sanitize timeline events for public view (PDPA Masking)
    let rawTimeline = (ticket.timeline && ticket.timeline.length) ? ticket.timeline : [];
    if (!rawTimeline.length) {
      // Fallback timeline for old tickets
      rawTimeline = [
        {
          action: 'created',
          actorRole: 'citizen',
          actorName: 'ประชาชนผู้แจ้ง',
          details: 'รับแจ้งเรื่องร้องเรียนเข้าสู่ระบบ',
          timestamp: ticket.createdAt
        }
      ];
      if (ticket.status !== 'pending') {
        rawTimeline.push({
          action: 'assigned',
          actorRole: 'admin',
          actorName: 'เจ้าหน้าที่ศูนย์สั่งการ',
          details: 'มอบหมายงานให้ช่างผู้รับผิดชอบ',
          timestamp: ticket.updatedAt || ticket.createdAt
        });
      }
      if (ticket.status === 'in_progress' || ticket.status === 'completed') {
        rawTimeline.push({
          action: 'status_changed',
          actorRole: 'technician',
          actorName: 'ช่างผู้รับผิดชอบ',
          details: 'เปลี่ยนสถานะเป็น กำลังดำเนินการ ลงพื้นที่เข้าตรวจสอบ',
          timestamp: ticket.updatedAt || ticket.createdAt
        });
      }
      if (ticket.status === 'completed') {
        rawTimeline.push({
          action: 'status_changed',
          actorRole: 'technician',
          actorName: 'ช่างผู้รับผิดชอบ',
          details: 'ดำเนินการแก้ไขปัญหาแล้วเสร็จ',
          timestamp: ticket.updatedAt || ticket.createdAt
        });
      }
    }

    const safeTimeline = rawTimeline.map(ev => {
      let safeActor = 'เจ้าหน้าที่';
      if (ev.actorRole === 'citizen') safeActor = 'ประชาชนผู้แจ้ง';
      else if (ev.actorRole === 'technician') safeActor = ev.actorName ? ('ช่าง ' + ev.actorName.split(' ')[0]) : 'ช่างผู้รับผิดชอบ';
      else if (ev.actorRole === 'admin') safeActor = 'เจ้าหน้าที่ศูนย์สั่งการ';
      else if (ev.actorRole === 'system') safeActor = 'ระบบอัตโนมัติ';

      return {
        action: ev.action,
        actorRole: ev.actorRole,
        actorName: safeActor,
        details: ev.details,
        oldValue: ev.oldValue,
        newValue: ev.newValue,
        timestamp: ev.timestamp
      };
    });

    // Return safe data
    res.json({
      ticketId:        ticket.ticketId,
      location:        ticket.location,
      status:          ticket.status,
      category:        ticket.category,
      createdAt:       ticket.createdAt,
      updatedAt:       ticket.updatedAt,
      timeline:        safeTimeline,
      materialsCount:  ticket.materials ? ticket.materials.length : 0,
      totalRepairCost: ticket.totalRepairCost || 0
    });

  } catch (err) {
    console.error('[Track] Error:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
