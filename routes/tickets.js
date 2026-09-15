/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const express = require('express');
const xss = require('xss');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const Counter = require('../models/Counter');
const Comment = require('../models/Comment');
const { STATUSES } = require('../data/store');
const { notifyNewTicket, notifyAssigned, notifyInProgress, notifyCompleted, notifyRejected, notifyFollowers, notifyRatingThanks } = require('../config/lineNotify');
const { upload: cloudinaryUpload, isCloudinaryConfigured, cloudinary, purgeTicketImages } = require('../config/cloudinary');

const { calcSlaDeadlines, checkIsSlaBreached } = require('../utils/slaHelper');

// ─── Middleware & Helpers ──────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

function emitUpdate(req) {
  const io = req.app.get('io');
  if (io) io.emit('ticket_updated');
}

// ─── Multer Setup ────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXTS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = ALLOWED_EXTS[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const fileFilter = (req, file, cb) => {
  if (ALLOWED_EXTS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('ประเภทไฟล์ไม่ได้รับอนุญาต'), false);
  }
};
const localUpload = multer({ storage: localStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
const upload = isCloudinaryConfigured() ? cloudinaryUpload : localUpload;

function getFileUrl(req) {
  if (!req.file) return null;
  if (isCloudinaryConfigured()) return req.file.path;
  const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
  return BASE_URL ? BASE_URL + '/uploads/' + req.file.filename : '/uploads/' + req.file.filename;
}

function getFileUrls(req) {
  if (!req.files || !req.files.length) return [];
  return req.files.map(file => {
    if (isCloudinaryConfigured()) return file.path;
    const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
    return BASE_URL ? BASE_URL + '/uploads/' + file.filename : '/uploads/' + file.filename;
  });
}

// ─── Reverse Geocoding ───────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const https = require('https');
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th&zoom=17`;
    return await new Promise((resolve) => {
      https.get(url, { headers: { 'User-Agent': 'ResolveNow/1.0' } }, (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const a = json.address || {};
            const parts = [
              a.road || a.pedestrian || a.path,
              a.suburb || a.neighbourhood || a.quarter,
              a.city_district || a.district,
              a.city || a.town || a.village || a.county
            ].filter(Boolean);
            resolve(parts.length ? parts.join(', ') : json.display_name || `${lat},${lng}`);
          } catch { resolve(`${lat},${lng}`); }
        });
      }).on('error', () => resolve(`${lat},${lng}`));
    });
  } catch { return `${lat},${lng}`; }
}

// ─── Helper: format ticket for API response ──────────────────────
// ─── Distance Calculation (Haversine formula in meters) ─────────
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

const STATUS_TH = {
  pending: 'รอดำเนินการ',
  assigned: 'รับงานแล้ว',
  in_progress: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  rejected: 'ปฏิเสธ',
  reopened: 'ขอตรวจสอบซ้ำ',
  merged: 'รวมตั๋ว'
};

function logTicketActivity(ticket, { action, actorRole, actorId, actorName, details, oldValue, newValue, timestamp }) {
  if (!ticket.timeline) ticket.timeline = [];
  ticket.timeline.push({
    action: action || 'status_changed',
    actorRole: actorRole || 'system',
    actorId: actorId || null,
    actorName: actorName || 'ระบบ',
    details: details || '',
    oldValue: oldValue != null ? String(oldValue) : null,
    newValue: newValue != null ? String(newValue) : null,
    timestamp: timestamp || new Date()
  });
}

function buildSyntheticTimeline(t) {
  const events = [];
  const created = t.createdAt ? new Date(t.createdAt) : new Date();

  // 1. Created
  events.push({
    action: 'created',
    actorRole: 'citizen',
    actorName: t.citizenName || 'ประชาชนผู้แจ้ง',
    details: 'แจ้งเรื่องร้องเรียนใหม่: ' + (t.category || 'ทั่วไป'),
    oldValue: null,
    newValue: 'pending',
    timestamp: created
  });

  // 2. Assigned
  if (t.assignedName || t.status !== 'pending') {
    const assignDate = new Date(created.getTime() + 15 * 60 * 1000);
    events.push({
      action: 'assigned',
      actorRole: 'admin',
      actorName: 'ศูนย์สั่งการ (Dispatcher)',
      details: 'มอบหมายงานให้ ' + (t.assignedName || 'เจ้าหน้าที่ผู้เชี่ยวชาญ'),
      oldValue: 'รอดำเนินการ',
      newValue: t.assignedName || 'ช่างผู้รับผิดชอบ',
      timestamp: assignDate < (t.updatedAt || new Date()) ? assignDate : (t.updatedAt || created)
    });
  }

  // 3. Before image
  if (t.beforeImage) {
    const beforeDate = new Date(created.getTime() + 30 * 60 * 1000);
    events.push({
      action: 'before_image_uploaded',
      actorRole: 'technician',
      actorName: t.assignedName || 'ช่างประจำแผนก',
      details: 'อัปโหลดภาพถ่ายตรวจสอบก่อนการซ่อมบำรุง',
      oldValue: null,
      newValue: null,
      timestamp: beforeDate < (t.updatedAt || new Date()) ? beforeDate : (t.updatedAt || created)
    });
  }

  // 4. In Progress
  if (t.status === 'in_progress' || t.status === 'completed') {
    const inpgDate = new Date(created.getTime() + 45 * 60 * 1000);
    events.push({
      action: 'status_changed',
      actorRole: 'technician',
      actorName: t.assignedName || 'ช่างประจำแผนก',
      details: 'เปลี่ยนสถานะเป็น กำลังดำเนินการ ลงพื้นที่เข้าปฏิบัติงาน',
      oldValue: 'รับงานแล้ว',
      newValue: 'กำลังดำเนินการ',
      timestamp: inpgDate < (t.updatedAt || new Date()) ? inpgDate : (t.updatedAt || created)
    });
  }

  // 5. Materials
  if (t.materials && t.materials.length > 0) {
    events.push({
      action: 'materials_updated',
      actorRole: 'technician',
      actorName: t.assignedName || 'ช่างประจำแผนก',
      details: 'บันทึกรายการวัสดุ/อุปกรณ์ ' + t.materials.length + ' รายการ (฿' + (t.totalRepairCost || 0).toLocaleString('th-TH') + ')',
      oldValue: null,
      newValue: '฿' + (t.totalRepairCost || 0).toLocaleString('th-TH'),
      timestamp: t.updatedAt || created
    });
  }

  // 6. After image
  if (t.afterImage || (t.afterImages && t.afterImages.length)) {
    events.push({
      action: 'after_image_uploaded',
      actorRole: 'technician',
      actorName: t.assignedName || 'ช่างประจำแผนก',
      details: 'อัปโหลดภาพถ่ายหลักฐานหลังดำเนินการแล้วเสร็จ',
      oldValue: null,
      newValue: null,
      timestamp: t.updatedAt || created
    });
  }

  // 7. Completed or Rejected
  if (t.status === 'completed') {
    events.push({
      action: 'status_changed',
      actorRole: 'technician',
      actorName: t.assignedName || 'ช่างประจำแผนก',
      details: 'ดำเนินการแก้ไขปัญหาเสร็จสิ้น และส่งมอบงาน',
      oldValue: 'กำลังดำเนินการ',
      newValue: 'เสร็จสิ้น',
      timestamp: t.updatedAt || created
    });
  } else if (t.status === 'rejected') {
    events.push({
      action: 'status_changed',
      actorRole: 'admin',
      actorName: 'ศูนย์สั่งการ (Admin)',
      details: 'ปฏิเสธเรื่องร้องเรียน' + (t.rejectReason ? ' (เหตุผล: ' + t.rejectReason + ')' : ''),
      oldValue: 'รอดำเนินการ',
      newValue: 'ปฏิเสธ',
      timestamp: t.updatedAt || created
    });
  }

  // 8. Rated
  if (t.rating) {
    events.push({
      action: 'rated',
      actorRole: 'citizen',
      actorName: t.citizenName || 'ประชาชนผู้แจ้ง',
      details: 'ประเมินความพึงพอใจ ' + t.rating + ' ดาว' + (t.ratingReason ? ' (' + t.ratingReason + ')' : ''),
      oldValue: null,
      newValue: t.rating + ' ดาว',
      timestamp: t.ratedAt ? new Date(t.ratedAt) : (t.updatedAt || created)
    });
  }

  return events;
}

function formatTicket(t, currentUserId) {
  const rawTimeline = (t.timeline && t.timeline.length) ? t.timeline : buildSyntheticTimeline(t);
  const obj = {
    ticketId: t.ticketId,
    citizenId: t.citizenId,
    citizenName: t.citizenName,
    citizenLineId: t.citizenLineId,
    category: t.category,
    description: t.description,
    location: t.location,
    lat: t.lat,
    lng: t.lng,
    urgency: t.urgency,
    priorityScore: t.priorityScore,
    status: t.status,
    assignedTo: t.assignedTo,
    assignedName: t.assignedName,
    rejectReason: t.rejectReason,
    citizenImage: t.citizenImage,
    citizenImages: t.citizenImages || [],
    beforeImage: t.beforeImage,
    afterImage: t.afterImage,
    afterImages: t.afterImages || [],
    rating: t.rating,
    ratingReason: t.ratingReason,
    ratedAt: t.ratedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    _id: t._id,
    // SLA
    slaAssignDeadline: t.slaAssignDeadline || null,
    slaCompleteDeadline: t.slaCompleteDeadline || null,
    slaBreached: t.slaBreached || false,
    // Upvote & Follow
    upvoteCount: t.upvoteCount || 0,
    followerCount: t.followerCount || 0,
    // Merge & Duplicates
    isMerged: t.isMerged || false,
    mergedInto: t.mergedInto || null,
    mergedTickets: t.mergedTickets || [],
    // Reopen / Dispute
    reopenCount: t.reopenCount || 0,
    reopenReason: t.reopenReason || null,
    reopenImages: t.reopenImages || [],
    reopenedAt: t.reopenedAt || null,
    // SLA Pause / Hold
    slaPauseStatus: t.slaPauseStatus || 'none',
    slaPauseReason: t.slaPauseReason || null,
    slaPauseRequestedAt: t.slaPauseRequestedAt || null,
    slaPausedAt: t.slaPausedAt || null,
    slaTotalPausedMs: t.slaTotalPausedMs || 0,
    // Work Order
    workOrder: t.workOrder || null,
    // Timeline & Activity Audit Trail
    timeline: rawTimeline,
    // Cost & Material Tracking
    materials: t.materials || [],
    totalRepairCost: t.totalRepairCost || 0,
    repairCostNotes: t.repairCostNotes || null,
  };
  // Per-user flags
  if (currentUserId) {
    const uid = currentUserId.toString();
    obj.hasUpvoted = (t.upvotes || []).some(u => u.userId && u.userId.toString() === uid);
    obj.isFollowing = (t.followers || []).some(f => f.userId && f.userId.toString() === uid);
  }
  return obj;
}

// ─── Report Date-Range Helper ────────────────────────────────────
function getDateRange(range) {
  const now = new Date();
  if (range === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, label: 'เดือน ' + start.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) };
  }
  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end, label: 'เดือน ' + start.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) };
  }
  return { start: null, end: null, label: 'ทั้งหมด' };
}

// ─── GET /api/tickets/report (JSON for PDF) ─────────────────────
router.get('/report', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' });

    const { range } = req.query;
    const dr = getDateRange(range);
    const query = dr.start ? { createdAt: { $gte: dr.start, $lte: dr.end } } : {};
    const tickets = await Ticket.find(query).sort({ createdAt: -1 });

    res.json({
      rangeLabel: dr.label,
      tickets: tickets.map(t => ({
        ticketId: t.ticketId,
        citizenName: t.citizenName,
        category: t.category,
        description: t.description,
        location: t.location,
        urgency: t.urgency,
        priorityScore: t.priorityScore,
        status: t.status,
        assignedName: t.assignedName || null,
        rating: t.rating || null,
        ratingReason: t.ratingReason || null,
        citizenImage: t.citizenImage || null,
        citizenImages: t.citizenImages || [],
        beforeImage: t.beforeImage || null,
        afterImage: t.afterImage || null,
        slaBreached: t.slaBreached || false,
        totalRepairCost: t.totalRepairCost || 0,
        materials: t.materials || [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ไม่สามารถออกรายงานได้' });
  }
});

// ─── GET /api/tickets/report/excel (.xlsx) ──────────────────────
router.get('/report/excel', requireAuth, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' });

    const { range } = req.query;
    const dr = getDateRange(range);
    const query = dr.start ? { createdAt: { $gte: dr.start, $lte: dr.end } } : {};
    const tickets = await Ticket.find(query).sort({ createdAt: -1 });

    // Status translation map
    const stMap = { pending: 'รอดำเนินการ', assigned: 'รับงานแล้ว', in_progress: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', rejected: 'ปฏิเสธ' };
    const catMap = { Road: 'ถนน/ทางเท้า', Water: 'ท่อแตก/น้ำ', Electricity: 'ไฟฟ้า', Garbage: 'ขยะ', Animal: 'สัตว์', Tree: 'กิ่งไม้', Hazard: 'ภัยพิบัติ' };

    const rows = tickets.map(t => {
      const created = new Date(t.createdAt);
      const updated = new Date(t.updatedAt);
      let durationText = '—';
      if (t.status === 'completed') {
        const diffMs = updated - created;
        const diffMins = Math.round(diffMs / 60000);
        if (diffMins < 60) durationText = diffMins + ' นาที';
        else {
          const hrs = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          durationText = hrs + ' ชม. ' + mins + ' นาที';
        }
      }
      return {
        'รหัสเคส': t.ticketId,
        'วันที่รับแจ้ง': created.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }),
        'วันที่ปิดงาน': t.status === 'completed' ? updated.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—',
        'ระยะเวลาดำเนินการ': durationText,
        'สถานะ': stMap[t.status] || t.status,
        'หมวดหมู่': catMap[t.category] || t.category,
        'ช่างที่รับผิดชอบ': t.assignedName || '—',
        'คะแนนดาว': t.rating ? t.rating + ' / 5' : '—',
        'งบประมาณ (บาท)': Number(t.totalRepairCost || 0),
        'วัสดุ/อุปกรณ์ที่ใช้': (t.materials && t.materials.length) ? t.materials.map(m => `${m.name} (${m.quantity} ${m.unit || 'ชิ้น'})`).join(', ') : '—',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Set column widths for readability
    ws['!cols'] = [
      { wch: 12 }, // รหัสเคส
      { wch: 22 }, // วันที่รับแจ้ง
      { wch: 22 }, // วันที่ปิดงาน
      { wch: 20 }, // ระยะเวลา
      { wch: 16 }, // สถานะ
      { wch: 18 }, // หมวดหมู่
      { wch: 22 }, // ช่าง
      { wch: 12 }, // คะแนน
      { wch: 16 }, // งบประมาณ (บาท)
      { wch: 32 }, // วัสดุ/อุปกรณ์ที่ใช้
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ResolveNow Report');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fname = 'ResolveNow_Report_' + new Date().toISOString().slice(0, 10) + '.xlsx';

    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', 'attachment; filename="' + fname + '"');
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ไม่สามารถออกรายงานได้' });
  }
});

// ─── GET /api/tickets/export ─────────────────────────────────────
router.get('/export', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' });

    const tickets = await Ticket.find().sort({ createdAt: -1 });
    const fields = [
      { label: 'รหัสเรื่อง', value: 'ticketId' },
      { label: 'ผู้แจ้ง', value: 'citizenName' },
      { label: 'หมวดหมู่', value: 'category' },
      { label: 'รายละเอียด', value: 'description' },
      { label: 'พิกัด', value: 'location' },
      { label: 'Lat', value: 'lat' },
      { label: 'Lng', value: 'lng' },
      { label: 'คะแนนด่วน', value: 'priorityScore' },
      { label: 'สถานะ', value: 'status' },
      { label: 'ช่างที่รับผิดชอบ', value: 'assignedName' },
      { label: 'สร้างเมื่อ', value: 'createdAt' }
    ];
    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(tickets);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`resolvnow_tickets_${Date.now()}.csv`);
    return res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ไม่สามารถออกรายงานได้' });
  }
});

// ─── GET /api/tickets ────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    let query = {};
    if (user.role === 'citizen') query = { citizenId: user._id };
    else if (user.role === 'technician') query = {
      $or: [{ category: user.specialty }, { assignedTo: user._id }]
    };
    const tickets = await Ticket.find(query).sort({ createdAt: -1 });

    // SLA breach evaluation — use central helper
    for (const t of tickets) {
      if (t.slaBreached) continue;
      t.slaBreached = checkIsSlaBreached(t);
    }

    res.json(tickets.map(t => formatTicket(t, user._id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/tickets ───────────────────────────────────────────
router.post('/', requireAuth, upload.array('images', 5), async (req, res) => {
  try {
    const { category, description: rawDescription, location, urgency, lat, lng } = req.body;
    const user = await User.findById(req.session.userId);
    if (!category || !rawDescription || !location)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'กรุณาแนบรูปภาพก่อนส่งอย่างน้อย 1 รูป' });

    // Validate category exists
    const categoryExists = await Category.findOne({ name: category });
    if (!categoryExists) {
      return res.status(400).json({ error: 'หมวดหมู่ไม่ถูกต้อง' });
    }

    // XSS-FIX: sanitize user-supplied text before storing
    const description = xss(rawDescription.trim());

    let score = urgency === 'urgent' ? 90 : urgency === 'medium' ? 60 : 30;
    const desc = description.toLowerCase();
    for (const kw of ['flood', 'fire', 'อันตราย', 'เร่งด่วน', 'น้ำท่วม', 'ฉุกเฉิน'])
      if (desc.includes(kw)) score = Math.min(score + 10, 100);

    let locationName = location;
    if (lat && lng) locationName = await reverseGeocode(lat, lng);

    // สร้าง ticketId แบบ TKT-00001 (5 หลัก รองรับถึง 99,999 เคส)
    const seq = await Counter.nextSeq('ticket');
    const ticketId = 'TKT-' + String(seq).padStart(5, '0');

    // คำนวณ SLA deadlines
    const urg = urgency || 'normal';
    const sla = calcSlaDeadlines(urg);

    const ticket = await new Ticket({
      ticketId,
      citizenId: user._id,
      citizenName: user.firstName + ' ' + user.lastName,
      citizenLineId: user.lineUserId || null,
      category, description,
      location: locationName,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      urgency: urg,
      priorityScore: score,
      status: 'pending',
      citizenImage: getFileUrls(req)[0], // For backward compatibility
      citizenImages: getFileUrls(req),
      slaAssignDeadline: sla.slaAssignDeadline,
      slaCompleteDeadline: sla.slaCompleteDeadline,
      timeline: [{
        action: 'created',
        actorRole: 'citizen',
        actorId: user._id,
        actorName: user.firstName + ' ' + user.lastName,
        details: 'แจ้งเรื่องร้องเรียนใหม่: ' + category,
        oldValue: null,
        newValue: 'pending',
        timestamp: new Date()
      }]
    }).save();

    notifyNewTicket(formatTicket(ticket, user._id)).catch(e => console.error('[LINE] notifyNewTicket error:', e));
    emitUpdate(req);
    res.status(201).json(formatTicket(ticket, user._id));
  } catch (e) {
    console.error(e);
    // ROLLBACK-FIX: ถ้า DB save ล้มเหลว ให้ลบรูปที่ upload ขึ้น Cloudinary ไปแล้วออก
    if (req.files && isCloudinaryConfigured()) {
      for (const file of req.files) {
        const publicId = file.filename || file.public_id;
        if (publicId) {
          cloudinary.uploader.destroy(publicId).catch(err =>
            console.warn('[Cloudinary] rollback destroy failed:', err?.message)
          );
        }
      }
    }
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── PUT /api/tickets/:id/status ─────────────────────────────────
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, reason: rawReason } = req.body;
    const reason = rawReason ? xss(rawReason.trim()) : undefined;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status ไม่ถูกต้อง' });

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    const caller = await User.findById(req.session.userId);
    if (caller.role === 'citizen') return res.status(403).json({ error: 'ไม่มีสิทธิ์เปลี่ยนสถานะ' });

    // BUG-014: Validate status transitions to prevent skipping workflow steps
    const TRANSITIONS = {
      // technicians: can only move forward or reject
      technician: {
        pending:     ['assigned'],
        assigned:    ['in_progress', 'rejected'],
        in_progress: ['completed', 'rejected'],
        completed:   [],
        rejected:    []
      },
      // admin: can change to any status except backward (but allow override for corrections)
      admin: {
        pending:     ['assigned', 'rejected'],
        assigned:    ['in_progress', 'completed', 'rejected', 'pending'],
        in_progress: ['completed', 'rejected', 'assigned'],
        completed:   ['in_progress'],   // admin can reopen
        rejected:    ['pending']        // admin can revert reject
      }
    };

    const allowed = TRANSITIONS[caller.role]?.[ticket.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `ไม่สามารถเปลี่ยนสถานะจาก "${ticket.status}" เป็น "${status}" ได้`
      });
    }

    // FIX-#6 IDOR: ตรวจว่าช่างเป็นเจ้าของงานนี้จริงๆ
    // ยกเว้น: pending → assigned (รับงานใหม่) ช่าง B ไม่สามารถแตะ ticket ที่ ช่าง A ถืออยู่แล้ว
    if (caller.role === 'technician') {
      const isSelfAssign = ticket.status === 'pending' && status === 'assigned';
      const isOwner = ticket.assignedTo &&
        ticket.assignedTo.toString() === caller._id.toString();
      if (!isSelfAssign && !isOwner) {
        return res.status(403).json({ error: 'คุณไม่ใช่ช่างที่รับผิดชอบงานนี้' });
      }
    }

    const oldStatus = ticket.status;

    let isInitialAssign = ((status === 'assigned' || status === 'in_progress') && caller.role === 'technician' && !ticket.assignedTo);

    if (isInitialAssign) {
      const updated = await Ticket.findOneAndUpdate(
        { ticketId: req.params.id, status: ticket.status },
        { 
          assignedTo: caller._id, 
          assignedName: caller.firstName + ' ' + caller.lastName, 
          status: status,
          $push: {
            timeline: {
              action: 'assigned',
              actorRole: caller.role,
              actorId: caller._id,
              actorName: caller.firstName + ' ' + caller.lastName,
              details: 'ช่างรับงานและเตรียมลงพื้นที่',
              oldValue: 'ยังไม่ระบุ',
              newValue: caller.firstName + ' ' + caller.lastName,
              timestamp: new Date()
            }
          }
        },
        { returnDocument: 'after' }
      );
      if (!updated) return res.status(400).json({ error: 'Ticket นี้ถูกทำรายการไปแล้ว โปรดรีเฟรชหน้าจอ' });
      Object.assign(ticket, updated);
      if (status !== 'assigned') {
        logTicketActivity(ticket, {
          action: 'status_changed',
          actorRole: caller.role,
          actorId: caller._id,
          actorName: caller.firstName + ' ' + caller.lastName,
          details: 'เปลี่ยนสถานะเป็น ' + (STATUS_TH[status] || status),
          oldValue: oldStatus,
          newValue: status
        });
        await ticket.save();
      }
    } else {
      ticket.status = status;
      if (status === 'rejected' && reason) ticket.rejectReason = reason;
      logTicketActivity(ticket, {
        action: 'status_changed',
        actorRole: caller.role,
        actorId: caller._id,
        actorName: caller.firstName + ' ' + caller.lastName,
        details: 'เปลี่ยนสถานะเป็น ' + (STATUS_TH[status] || status) + (reason ? ' (เหตุผล: ' + reason + ')' : ''),
        oldValue: oldStatus,
        newValue: status
      });
      await ticket.save();
    }

    // SLA breach check — use central helper
    if (!ticket.slaBreached && checkIsSlaBreached(ticket)) {
      ticket.slaBreached = true;
      await ticket.save();
    }

    // Chat expiry — set 24-hour window when ticket is completed
    if (status === 'completed' && !ticket.chatExpiresAt) {
      ticket.chatExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await ticket.save();
    }

    try {
      // Re-fetch ticket from DB for completed — ensures beforeImage/afterImage are included
      let notifyTicket = ticket;
      if (status === 'completed') {
        const fresh = await Ticket.findOne({ ticketId: ticket.ticketId });
        if (fresh) notifyTicket = fresh;
      }
      const ft = formatTicket(notifyTicket, caller._id);
      if (status === 'assigned') await notifyAssigned(ft);
      if (status === 'in_progress') await notifyInProgress(ft);
      if (status === 'completed') await notifyCompleted(ft);
      if (status === 'rejected') await notifyRejected(ft, reason || '');
      // Notify followers on any status change
      if (ticket.followers && ticket.followers.length > 0) {
        notifyFollowers(ticket, status).catch(e => console.error('[LINE] notifyFollowers error:', e));
      }
    } catch (e) { console.error('[LINE] status notify error:', e); }


    emitUpdate(req);
    res.json(formatTicket(ticket, caller._id));
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── PUT /api/tickets/:id/assign ─────────────────────────────────
router.put('/:id/assign', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (caller.role !== 'admin') return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });

    const { technicianId } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    const tech = await User.findOne({ _id: technicianId, role: 'technician' });
    if (!tech) return res.status(404).json({ error: 'ไม่พบช่าง' });

    const oldAssignedName = ticket.assignedName || 'ยังไม่ระบุ';
    ticket.assignedTo = tech._id;
    ticket.assignedName = tech.firstName + ' ' + tech.lastName;
    ticket.status = 'assigned';
    logTicketActivity(ticket, {
      action: 'assigned',
      actorRole: 'admin',
      actorId: caller._id,
      actorName: caller.firstName + ' ' + caller.lastName,
      details: 'แอดมินมอบหมายงานให้ ' + tech.firstName + ' ' + tech.lastName,
      oldValue: oldAssignedName,
      newValue: tech.firstName + ' ' + tech.lastName
    });
    // SLA breach check — mark if already past assign deadline
    if (!ticket.slaBreached && checkIsSlaBreached(ticket)) {
      ticket.slaBreached = true;
    }
    await ticket.save();

    notifyAssigned(formatTicket(ticket)).catch(e => console.error('[LINE] notifyAssigned error:', e));
    emitUpdate(req);
    res.json(formatTicket(ticket));
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/tickets/:id/upload/before ─────────────────────────
// FIX-#7 Broken Access Control + FIX-#1 Workflow:
// ❶ ต้องเป็น technician  ❷ ต้องเป็นช่างเจ้าของงาน  ❸ ticket ต้องอยู่สถานะ assigned
router.post('/:id/upload/before', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);

    // ❶ เฉพาะช่างเท่านั้น
    if (!caller || caller.role !== 'technician')
      return res.status(403).json({ error: 'เฉพาะช่างเท่านั้นที่อัปโหลดรูปได้' });

    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพ' });
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    // ❷ ต้องเป็นช่างเจ้าของงานนี้
    if (!ticket.assignedTo || ticket.assignedTo.toString() !== caller._id.toString())
      return res.status(403).json({ error: 'คุณไม่ใช่ช่างที่รับผิดชอบงานนี้' });

    // ❸ Workflow: ticket ต้องอยู่สถานะ assigned ถึงจะอัปรูปก่อนทำงานได้
    if (ticket.status !== 'assigned')
      return res.status(400).json({ error: 'ต้องอยู่ในสถานะ "รับงานแล้ว" จึงจะอัปโหลดรูปก่อนทำงานได้' });

    ticket.beforeImage = getFileUrl(req);
    await ticket.save();
    emitUpdate(req);
    res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.beforeImage });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/tickets/:id/upload/after ──────────────────────────
// รองรับ multi-upload สูงสุด 5 รูป (afterImages[])
// ❶ ต้องเป็น technician  ❷ ต้องเป็นช่างเจ้าของงาน  ❸ ticket ต้องอยู่สถานะ in_progress
router.post('/:id/upload/after', requireAuth, upload.array('image', 5), async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);

    // ❶ เฉพาะช่างเท่านั้น
    if (!caller || caller.role !== 'technician')
      return res.status(403).json({ error: 'เฉพาะช่างเท่านั้นที่อัปโหลดรูปได้' });

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพ' });
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    // ❷ ต้องเป็นช่างเจ้าของงานนี้
    if (!ticket.assignedTo || ticket.assignedTo.toString() !== caller._id.toString())
      return res.status(403).json({ error: 'คุณไม่ใช่ช่างที่รับผิดชอบงานนี้' });

    // ❸ Workflow: ticket ต้องอยู่สถานะ in_progress ถึงจะอัปรูปหลังทำงานได้
    if (ticket.status !== 'in_progress')
      return res.status(400).json({ error: 'ต้องอยู่ในสถานะ "กำลังดำเนินการ" จึงจะอัปโหลดรูปหลังทำงานได้' });

    const newUrls = getFileUrls(req);
    const MAX_AFTER = 5;
    // รวม URLs ใหม่เข้ากับที่มีอยู่ ไม่เกิน 5 รูป
    const merged = [...(ticket.afterImages || []), ...newUrls].slice(0, MAX_AFTER);
    if (merged.length >= MAX_AFTER && (ticket.afterImages || []).length >= MAX_AFTER) {
      return res.status(400).json({ error: 'อัปโหลดรูปหลังซ่อมได้สูงสุด 5 รูปแล้ว' });
    }
    ticket.afterImages = merged;
    ticket.afterImage = merged[0] || null;   // backward compat
    logTicketActivity(ticket, {
      action: 'after_image_uploaded',
      actorRole: 'technician',
      actorId: caller._id,
      actorName: caller.firstName + ' ' + caller.lastName,
      details: 'อัปโหลดภาพถ่ายหลักฐานหลังการซ่อมบำรุง (' + merged.length + ' รูป)'
    });
    await ticket.save();
    emitUpdate(req);
    res.json({ message: 'อัปโหลดสำเร็จ', urls: merged, url: merged[0] || null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── PUT /api/tickets/:id/rating ─────────────────────────────────
router.put('/:id/rating', requireAuth, async (req, res) => {
  try {
    const { rating, reason } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'citizen')
      return res.status(403).json({ error: 'เฉพาะประชาชนเท่านั้น' });
    if (ticket.citizenId.toString() !== caller._id.toString())
      return res.status(403).json({ error: 'ไม่ใช่ Ticket ของคุณ' });
    if (ticket.status !== 'completed')
      return res.status(400).json({ error: 'Ticket ยังไม่เสร็จสิ้น' });

    const stars = parseInt(rating);
    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ error: 'คะแนนต้องอยู่ระหว่าง 1-5' });

    ticket.rating = stars;
    // XSS-FIX: Sanitize ratingReason using xss()
    ticket.ratingReason = (stars < 3 && reason && typeof reason === 'string') ? xss(reason.trim()) : null;
    ticket.ratedAt = new Date().toLocaleString('th-TH');
    logTicketActivity(ticket, {
      action: 'rated',
      actorRole: 'citizen',
      actorId: caller._id,
      actorName: caller.firstName + ' ' + caller.lastName,
      details: 'ประเมินความพึงพอใจ ' + stars + ' ดาว' + (ticket.ratingReason ? ' (' + ticket.ratingReason + ')' : ''),
      newValue: stars + ' ดาว'
    });
    await ticket.save();

    res.json({ message: 'บันทึกคะแนนสำเร็จ', ticket: formatTicket(ticket) });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── GET /api/tickets/public/:id/rating-status ───────────────────
// Public — no auth. ใช้จาก LIFF เพื่อตรวจว่า ticket ถูก rate แล้วหรือยัง
router.get('/public/:id/rating-status', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id }).select('rating status');
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });
    res.json({
      ticketId: req.params.id,
      status: ticket.status,
      rated: ticket.rating != null
    });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── PUT /api/tickets/:id/rating/liff ────────────────────────────
// LIFF rating — ไม่ใช้ session, ตรวจสอบความเป็นเจ้าของด้วย citizenLineId
router.put('/:id/rating/liff', async (req, res) => {
  try {
    const { rating, reason, lineUserId } = req.body;

    if (!lineUserId) return res.status(400).json({ error: 'ไม่พบข้อมูล LINE User' });

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    // ตรวจสอบสิทธิ์: citizenLineId ต้องตรงกัน
    if (!ticket.citizenLineId || ticket.citizenLineId !== lineUserId)
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ประเมิน Ticket นี้' });

    // Ticket ต้องเสร็จสิ้นแล้ว
    if (ticket.status !== 'completed')
      return res.status(400).json({ error: 'Ticket ยังไม่เสร็จสิ้น' });

    // ป้องกัน rating ซ้ำ
    if (ticket.rating != null)
      return res.status(409).json({ error: 'ประเมินแล้ว', alreadyRated: true });

    const stars = parseInt(rating);
    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ error: 'คะแนนต้องอยู่ระหว่าง 1-5' });

    ticket.rating = stars;
    ticket.ratingReason = (stars < 3 && reason) ? xss(reason.trim()) : null;
    ticket.ratedAt = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    await ticket.save();

    emitUpdate(req);
    console.log('[LIFF Rating] Ticket:', ticket.ticketId, '→', stars, 'ดาว');

    // ส่ง LINE ขอบคุณ + แสดงดาวที่ user กด (non-blocking)
    notifyRatingThanks(ticket, stars).catch(e => console.error('[LINE] notifyRatingThanks error:', e));

    res.json({ message: 'บันทึกคะแนนสำเร็จ', rating: stars });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── GET /api/tickets/public-map ─────────────────────────────────
// Public endpoint — no auth required, returns sanitized data for heatmap
router.get('/public-map', async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30); // 30 days
    const tickets = await Ticket.find({ createdAt: { $gte: since }, lat: { $ne: null }, lng: { $ne: null } })
      .select('ticketId category lat lng status location upvoteCount createdAt')
      .sort({ createdAt: -1 })
      .limit(200);
    // PII-FIX: description ถูกตัดออก — ผู้ร้องเรียนมักใส่ชื่อ/เบอร์/ข้อมูลส่วนตัวในบรรทัดแรก
    // PRIVACY-FIX-#2: ตัด lat/lng เหลือ 2 decimal places (~1.1 กม.) เพื่อป้องกันการระบุตำแหน่งบ้านเรือน
    // 2 decimal = ±550 เมตร เพียงพอสำหรับ heatmap แต่ไม่สามารถนำทางถึงบ้านที่แน่นอนได้
    res.json(tickets.map(t => ({
      ticketId: t.ticketId, category: t.category,
      lat: Math.round(t.lat * 100) / 100,
      lng: Math.round(t.lng * 100) / 100,
      status: t.status,
      location: t.location, upvoteCount: t.upvoteCount || 0,
      createdAt: t.createdAt
    })));
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── GET /api/tickets/search ─────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const caller = req.session.userId ? await User.findById(req.session.userId) : null;
    const { q, status: st, category: cat } = req.query;

    // FIX NoSQL Injection & TypeError
    const searchQ = typeof q === 'string' ? q : '';
    const searchSt = typeof st === 'string' ? st : '';
    const searchCat = typeof cat === 'string' ? cat : '';

    if (!caller && (!searchQ || !searchQ.trim())) return res.json([]);

    let query = {};
    if (caller && caller.role === 'citizen') query.citizenId = caller._id;
    else if (caller && caller.role === 'technician') {
      query.$or = [{ category: caller.specialty }, { assignedTo: caller._id }];
    }
    if (searchSt && searchSt !== 'all') query.status = searchSt;
    if (searchCat && searchCat !== 'all') query.category = searchCat;

    let tickets = await Ticket.find(query).sort({ createdAt: -1 });

    if (searchQ && searchQ.trim()) {
      const kw = searchQ.trim().toLowerCase();
      tickets = tickets.filter(t =>
        (t.ticketId || '').toLowerCase().includes(kw) ||
        (t.description || '').toLowerCase().includes(kw) ||
        (t.location || '').toLowerCase().includes(kw) ||
        (t.citizenName || '').toLowerCase().includes(kw) ||
        (t.assignedName || '').toLowerCase().includes(kw)
      );
    }

    // ซ่อนข้อมูลส่วนตัวสำหรับผู้ที่ไม่ได้ login
    if (!caller) {
      tickets = tickets.map(t => ({
        ticketId: t.ticketId, category: t.category,
        // PRIVACY-FIX: Mask description and location for unauthenticated users
        description: 'ปกปิดข้อมูลเพื่อความเป็นส่วนตัว', location: 'ปกปิดข้อมูลเพื่อความเป็นส่วนตัว',
        status: t.status, urgency: t.urgency,
        assignedName: t.assignedName || null,
        rating: t.rating || null, createdAt: t.createdAt,
        upvoteCount: t.upvoteCount || 0, followerCount: t.followerCount || 0
      }));
    } else {
      tickets = tickets.map(t => formatTicket(t, caller._id));
    }

    res.json(tickets);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── DELETE /api/tickets/:id ──────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin')
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้น' });

    // CLOUDINARY-FIX: ดึงรูปก่อนลบแล้วค่อย purge
    const ticket = await Ticket.findOne({ ticketId: req.params.id }).select('citizenImage citizenImages beforeImage afterImage ticketId');
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    if (isCloudinaryConfigured()) {
      await purgeTicketImages([ticket]);
    }
    await Ticket.deleteOne({ _id: ticket._id });

    res.json({ message: 'ลบ Ticket เรียบร้อยแล้ว', ticketId: req.params.id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── DELETE /api/tickets (all) ───────────────────────────────────
router.delete('/', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin')
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้น' });

    // PASSWORD-FIX: server-side password check (ไม่ hardcode สำรอง 'admin1234')
    const { password } = req.body;
    if (!password)
      return res.status(400).json({ error: 'กรุณากรอกรหัสผ่าน' });

    if (!process.env.ADMIN_DELETE_PASSWORD) {
      return res.status(403).json({ error: 'ระบบไม่อนุญาตให้ลบข้อมูลทั้งหมดเนื่องจากไม่ได้ตั้งรหัสผ่านสำหรับลบข้อมูลไว้' });
    }

    let isPasswordValid = (password === process.env.ADMIN_DELETE_PASSWORD);

    if (!isPasswordValid)
      return res.status(403).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    // CLOUDINARY-FIX: ดึงรูปทั้งหมดก่อนลบ แล้วค่อย purge
    if (isCloudinaryConfigured()) {
      const allTickets = await Ticket.find({}).select('citizenImage citizenImages beforeImage afterImage');
      await purgeTicketImages(allTickets);
    }

    const result = await Ticket.deleteMany({});
    res.json({ message: 'ลบ Ticket ทั้งหมดเรียบร้อยแล้ว', deleted: result.deletedCount });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ═══════════════════════════════════════════════════════════════════
// ── COMMENTS (CHAT) ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// GET /api/tickets/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id }).select('chatExpiresAt status citizenId assignedTo');
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    const caller = await User.findById(req.session.userId);
    // IDOR Protection: เช็คสิทธิ์การเข้าถึง Chat
    if (caller && caller.role === 'citizen' && ticket.citizenId.toString() !== caller._id.toString()) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูแชทของ Ticket นี้' });
    }
    if (caller && caller.role === 'technician' && ticket.assignedTo && ticket.assignedTo.toString() !== caller._id.toString()) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูแชทของ Ticket ที่ไม่ได้มอบหมายให้คุณ' });
    }

    // ถ้า chat หมดอายุแล้ว ให้คืน array เปล่า
    if (ticket.chatExpiresAt && new Date() > ticket.chatExpiresAt) {
      return res.json([]);
    }
    const comments = await Comment.find({ ticketId: req.params.id }).sort({ createdAt: 1 });
    res.json(comments);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// POST /api/tickets/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { message: rawMessage } = req.body;
    if (!rawMessage || !rawMessage.trim()) return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความ' });
    if (rawMessage.length > 500) return res.status(400).json({ error: 'ข้อความยาวเกินไป (สูงสุด 500 ตัวอักษร)' });
    // XSS-FIX: sanitize message before storing
    const message = xss(rawMessage.trim());

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    // Block new messages after chat expiry
    if (ticket.chatExpiresAt && new Date() > ticket.chatExpiresAt) {
      return res.status(403).json({ error: 'แชทนี้ปิดแล้ว เนื่องจากงานเสร็จสิ้นมากกว่า 24 ชั่วโมง' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'ไม่พบผู้ใช้' });

    // citizen can only comment on own tickets
    if (user.role === 'citizen' && ticket.citizenId.toString() !== user._id.toString())
      return res.status(403).json({ error: 'ไม่สามารถแสดงความคิดเห็นใน Ticket ของคนอื่นได้' });

    const comment = await new Comment({
      ticketId: req.params.id,
      userId: user._id,
      userName: user.firstName + ' ' + (user.lastName && user.lastName !== '-' ? user.lastName : ''),
      userRole: user.role,
      message: message.trim()
    }).save();

    // Emit socket event for real-time
    const io = req.app.get('io');
    if (io) io.emit('comment_added', { ticketId: req.params.id, comment });

    res.status(201).json(comment);
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ═══════════════════════════════════════════════════════════════════
// ── UPVOTE SYSTEM ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// POST /api/tickets/:id/upvote — toggle
router.post('/:id/upvote', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'กรุณา Login ก่อน' });

    // ตรวจก่อนว่ามี ticket และไม่ใช่ของตัวเอง (ไม่ต้องทำ atomic)
    const ticketCheck = await Ticket.findOne({ ticketId: req.params.id }).select('citizenId upvotes');
    if (!ticketCheck) return res.status(404).json({ error: 'ไม่พบ Ticket' });
    if (ticketCheck.citizenId.toString() === user._id.toString())
      return res.status(400).json({ error: 'ไม่สามารถโหวต Ticket ของตัวเองได้' });

    const alreadyVoted = (ticketCheck.upvotes || []).some(u => u.userId && u.userId.toString() === user._id.toString());

    let updated;
    if (alreadyVoted) {
      // FIX-3.3: atomic $pull — ป้องกัน lost update จาก concurrent operations
      updated = await Ticket.findOneAndUpdate(
        { ticketId: req.params.id },
        { $pull: { upvotes: { userId: user._id } } },
        { new: true }
      );
    } else {
      // FIX-3.3: atomic $addToSet — ป้องกัน duplicate upvote จาก race condition
      updated = await Ticket.findOneAndUpdate(
        { ticketId: req.params.id, 'upvotes.userId': { $ne: user._id } },
        { $addToSet: { upvotes: { userId: user._id } } },
        { new: true }
      );
      if (!updated) {
        // ถ้า null — มีคนอื่น vote พร้อมกัน หรือมี duplicate → ดึงล่าสุด
        updated = await Ticket.findOne({ ticketId: req.params.id });
      }
    }
    if (!updated) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    // คำนวณ upvoteCount และ priority จาก upvotes array ที่ atomic แล้ว
    updated.upvoteCount = (updated.upvotes || []).length;
    let basePriority = updated.urgency === 'urgent' ? 90 : updated.urgency === 'medium' ? 60 : 30;
    if (updated.upvoteCount >= 10) basePriority = 100;
    else if (updated.upvoteCount >= 5) basePriority = Math.min(basePriority + 15, 100);
    updated.priorityScore = basePriority;
    await updated.save();

    emitUpdate(req);
    const action = alreadyVoted ? 'removed' : 'added';
    res.json({
      action,
      upvoteCount: updated.upvoteCount,
      hasUpvoted: !alreadyVoted,
      priorityScore: updated.priorityScore
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ═══════════════════════════════════════════════════════════════════
// ── FOLLOW/SUBSCRIBE SYSTEM ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// POST /api/tickets/:id/follow — toggle
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'กรุณา Login ก่อน' });

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    const idx = (ticket.followers || []).findIndex(f => f.userId && f.userId.toString() === user._id.toString());
    let action;
    if (idx >= 0) {
      ticket.followers.splice(idx, 1);
      action = 'unfollowed';
    } else {
      ticket.followers.push({ userId: user._id, lineUserId: user.lineUserId || null });
      action = 'followed';
    }
    ticket.followerCount = ticket.followers.length;
    await ticket.save();

    res.json({
      action,
      followerCount: ticket.followerCount,
      isFollowing: action === 'followed'
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});


// ═══════════════════════════════════════════════════════════════════
// ── 1. DUPLICATE TICKET DETECTION & MERGE ─────────────────────────
// ═══════════════════════════════════════════════════════════════════

// GET /api/tickets/detect-duplicates?lat=...&lng=...&category=...&radius=100
router.get('/detect-duplicates', async (req, res) => {
  try {
    const { lat, lng, category, radius, excludeTicketId } = req.query;
    if (!lat || !lng || !category) {
      return res.status(400).json({ error: 'lat, lng, and category are required' });
    }
    const cLat = parseFloat(lat);
    const cLng = parseFloat(lng);
    const radMeters = parseFloat(radius) || 100;

    const candidates = await Ticket.find({
      category,
      ticketId: { $ne: excludeTicketId },
      status: { $in: ['pending', 'assigned', 'in_progress', 'reopened'] },
      lat: { $ne: null },
      lng: { $ne: null }
    }).select('ticketId category description location lat lng status urgency citizenImage createdAt upvoteCount followerCount');

    const duplicates = [];
    for (const t of candidates) {
      const dist = getDistanceFromLatLonInM(cLat, cLng, t.lat, t.lng);
      if (dist <= radMeters) {
        duplicates.push({
          ticketId: t.ticketId,
          category: t.category,
          description: t.description,
          location: t.location,
          status: t.status,
          urgency: t.urgency,
          citizenImage: t.citizenImage,
          distanceMeters: Math.round(dist),
          upvoteCount: t.upvoteCount || 0,
          followerCount: t.followerCount || 0,
          createdAt: t.createdAt
        });
      }
    }

    duplicates.sort((a, b) => a.distanceMeters - b.distanceMeters);
    res.json(duplicates);
  } catch (e) {
    console.error('[Duplicate Detection] error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบเรื่องซ้ำ' });
  }
});

// POST /api/tickets/:id/merge (Admin only)
router.post('/:id/merge', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถรวมเรื่องได้' });
    }

    const { targetTicketId } = req.body;
    if (!targetTicketId) return res.status(400).json({ error: 'กรุณาระบุรหัสตั๋วหลักที่จะรวมเข้า' });
    if (req.params.id === targetTicketId) return res.status(400).json({ error: 'ไม่สามารถรวมตั๋วเข้ากับตัวเองได้' });

    const sourceTicket = await Ticket.findOne({ ticketId: req.params.id });
    if (!sourceTicket) return res.status(404).json({ error: 'ไม่พบตั๋วต้นทาง' });

    const targetTicket = await Ticket.findOne({ ticketId: targetTicketId });
    if (!targetTicket) return res.status(404).json({ error: 'ไม่พบตั๋วปลายทาง' });

    if (sourceTicket.isMerged) {
      return res.status(400).json({ error: 'ตั๋วนี้ถูกรวมเรื่องไปแล้ว' });
    }

    // Combine followers
    const targetFollowerUserIds = new Set((targetTicket.followers || []).map(f => f.userId?.toString()));
    if (sourceTicket.citizenId && !targetFollowerUserIds.has(sourceTicket.citizenId.toString())) {
      targetTicket.followers.push({
        userId: sourceTicket.citizenId,
        lineUserId: sourceTicket.citizenLineId || null
      });
      targetFollowerUserIds.add(sourceTicket.citizenId.toString());
    }
    for (const f of sourceTicket.followers || []) {
      if (f.userId && !targetFollowerUserIds.has(f.userId.toString())) {
        targetTicket.followers.push(f);
        targetFollowerUserIds.add(f.userId.toString());
      }
    }
    targetTicket.followerCount = targetTicket.followers.length;

    // Combine upvotes
    const targetUpvoteUserIds = new Set((targetTicket.upvotes || []).map(u => u.userId?.toString()));
    for (const u of sourceTicket.upvotes || []) {
      if (u.userId && !targetUpvoteUserIds.has(u.userId.toString())) {
        targetTicket.upvotes.push(u);
        targetUpvoteUserIds.add(u.userId.toString());
      }
    }
    targetTicket.upvoteCount = targetTicket.upvotes.length;

    if (!targetTicket.mergedTickets.includes(sourceTicket.ticketId)) {
      targetTicket.mergedTickets.push(sourceTicket.ticketId);
    }
    await targetTicket.save();

    // Mark source ticket as merged
    sourceTicket.status = 'merged';
    sourceTicket.isMerged = true;
    sourceTicket.mergedInto = targetTicket.ticketId;
    sourceTicket.rejectReason = 'รวมเรื่องเข้ากับเคสหลัก ' + targetTicket.ticketId;
    await sourceTicket.save();

    // Post comments to both
    await new Comment({
      ticketId: targetTicket.ticketId,
      userId: caller._id,
      userName: caller.firstName + ' (Admin)',
      userRole: 'admin',
      message: '🔗 มีการรวมเรื่องร้องเรียนเคส ' + sourceTicket.ticketId + ' เข้ามาในเคสนี้เพื่อดำเนินการร่วมกัน'
    }).save();

    await new Comment({
      ticketId: sourceTicket.ticketId,
      userId: caller._id,
      userName: caller.firstName + ' (Admin)',
      userRole: 'admin',
      message: '🔗 เรื่องร้องเรียนนี้ถูกรวมเข้ากับเคสหลัก ' + targetTicket.ticketId + ' โดยอัตโนมัติ คุณจะได้รับการอัปเดตสถานะของเคสดังกล่าว'
    }).save();

    emitUpdate(req);
    res.json({
      message: 'รวมเคส ' + sourceTicket.ticketId + ' เข้ากับ ' + targetTicket.ticketId + ' สำเร็จ',
      sourceTicket: formatTicket(sourceTicket, caller._id),
      targetTicket: formatTicket(targetTicket, caller._id)
    });
  } catch (e) {
    console.error('[Merge Ticket] error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการรวมเรื่อง' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ── 2. TICKET RE-OPEN / DISPUTE FLOW ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// POST /api/tickets/:id/reopen
router.post('/:id/reopen', requireAuth, upload.array('images', 3), async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    const { reason: rawReason } = req.body;
    if (!rawReason || !rawReason.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุเหตุผลที่ขอให้ตรวจสอบใหม่' });
    }
    const reason = xss(rawReason.trim());

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    if (caller.role === 'citizen' && ticket.citizenId.toString() !== caller._id.toString()) {
      return res.status(403).json({ error: 'คุณไม่ใช่ผู้แจ้งเรื่องของ Ticket นี้' });
    }

    if (ticket.status !== 'completed') {
      return res.status(400).json({ error: 'สามารถขอตรวจสอบใหม่ได้เฉพาะเคสที่ปิดงานแล้วเท่านั้น' });
    }

    const uploadedUrls = getFileUrls(req);

    ticket.status = 'reopened';
    ticket.reopenCount = (ticket.reopenCount || 0) + 1;
    ticket.reopenedAt = new Date();
    ticket.reopenReason = reason;
    if (uploadedUrls.length > 0) {
      ticket.reopenImages = uploadedUrls;
    }
    ticket.chatExpiresAt = null; // Re-open chat

    // Extend completion deadline by 24 hours for investigation/rework
    ticket.slaCompleteDeadline = new Date(Date.now() + 24 * 3600000);
    ticket.slaBreached = false;
    await ticket.save();

    await new Comment({
      ticketId: ticket.ticketId,
      userId: caller._id,
      userName: caller.firstName + ' ' + (caller.lastName || ''),
      userRole: caller.role,
      message: '🔄 ขอตรวจสอบใหม่ (Re-open): ' + reason
    }).save();

    emitUpdate(req);
    res.json({ message: 'ส่งคำขอตรวจสอบใหม่สำเร็จ', ticket: formatTicket(ticket, caller._id) });
  } catch (e) {
    console.error('[Reopen Ticket] error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการขอตรวจสอบใหม่' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ── 3. SLA PAUSE / HOLD ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// POST /api/tickets/:id/sla/request-pause (Technician)
router.post('/:id/sla/request-pause', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || (caller.role !== 'technician' && caller.role !== 'admin')) {
      return res.status(403).json({ error: 'เฉพาะช่างผู้รับผิดชอบหรือ Admin เท่านั้น' });
    }

    const { reason: rawReason } = req.body;
    if (!rawReason || !rawReason.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุเหตุผลในการขอพักเวลา SLA' });
    }
    const reason = xss(rawReason.trim());

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    if (caller.role === 'technician' && ticket.assignedTo?.toString() !== caller._id.toString()) {
      return res.status(403).json({ error: 'คุณไม่ใช่ช่างที่รับผิดชอบ Ticket นี้' });
    }

    if (ticket.status !== 'assigned' && ticket.status !== 'in_progress' && ticket.status !== 'reopened') {
      return res.status(400).json({ error: 'สามารถขอพักเวลาได้เฉพาะงานที่อยู่ระหว่างดำเนินการเท่านั้น' });
    }

    if (caller.role === 'admin') {
      ticket.slaPauseStatus = 'paused';
      ticket.slaPauseReason = reason;
      ticket.slaPausedAt = new Date();
      await ticket.save();

      await new Comment({
        ticketId: ticket.ticketId,
        userId: caller._id,
        userName: caller.firstName + ' (Admin)',
        userRole: 'admin',
        message: '⏸️ ผู้ดูแลระบบสั่งหยุดเวลา SLA ชั่วคราว เนื่องจาก: ' + reason
      }).save();

      emitUpdate(req);
      return res.json({ message: 'สั่งพักเวลา SLA สำเร็จ', ticket: formatTicket(ticket, caller._id) });
    }

    ticket.slaPauseStatus = 'requested';
    ticket.slaPauseReason = reason;
    ticket.slaPauseRequestedAt = new Date();
    await ticket.save();

    await new Comment({
      ticketId: ticket.ticketId,
      userId: caller._id,
      userName: caller.firstName + ' (ช่าง)',
      userRole: caller.role,
      message: '⏸️ ขอหยุดเวลา SLA ชั่วคราว เนื่องจาก: ' + reason + ' (รอการอนุมัติจากผู้ดูแลระบบ)'
    }).save();

    emitUpdate(req);
    res.json({ message: 'ส่งคำขอพักเวลา SLA แล้ว', ticket: formatTicket(ticket, caller._id) });
  } catch (e) {
    console.error('[SLA Request Pause] error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการขอพักเวลา' });
  }
});

// POST /api/tickets/:id/sla/approve-pause (Admin)
router.post('/:id/sla/approve-pause', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้นที่อนุมัติได้' });
    }

    const { approved } = req.body;
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    if (ticket.slaPauseStatus !== 'requested') {
      return res.status(400).json({ error: 'Ticket นี้ไม่มีคำขอพักเวลาที่รออนุมัติ' });
    }

    if (approved) {
      ticket.slaPauseStatus = 'paused';
      ticket.slaPausedAt = new Date();
      await ticket.save();

      await new Comment({
        ticketId: ticket.ticketId,
        userId: caller._id,
        userName: caller.firstName + ' (Admin)',
        userRole: 'admin',
        message: '⏸️ อนุมัติการพักเวลา SLA ชั่วคราว: "' + (ticket.slaPauseReason || 'ตามที่แจ้ง') + '"'
      }).save();
    } else {
      ticket.slaPauseStatus = 'none';
      const prevReason = ticket.slaPauseReason;
      ticket.slaPauseReason = null;
      await ticket.save();

      await new Comment({
        ticketId: ticket.ticketId,
        userId: caller._id,
        userName: caller.firstName + ' (Admin)',
        userRole: 'admin',
        message: '❌ ไม่อนุมัติคำขอพักเวลา SLA (เหตุผลเดิม: ' + (prevReason || '—') + ') กำหนดเวลาดำเนินต่อตามปกติ'
      }).save();
    }

    emitUpdate(req);
    res.json({ message: approved ? 'อนุมัติการพักเวลาสำเร็จ' : 'ปฏิเสธคำขอพักเวลาแล้ว', ticket: formatTicket(ticket, caller._id) });
  } catch (e) {
    console.error('[SLA Approve Pause] error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// POST /api/tickets/:id/sla/resume (Technician or Admin)
router.post('/:id/sla/resume', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || (caller.role !== 'technician' && caller.role !== 'admin')) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' });
    }

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    if (ticket.slaPauseStatus !== 'paused') {
      return res.status(400).json({ error: 'Ticket นี้ไม่ได้ถูกพักเวลาอยู่' });
    }

    const pausedAt = ticket.slaPausedAt || ticket.updatedAt;
    const now = new Date();
    const durationMs = Math.max(0, now.getTime() - new Date(pausedAt).getTime());

    if (ticket.slaCompleteDeadline) {
      ticket.slaCompleteDeadline = new Date(ticket.slaCompleteDeadline.getTime() + durationMs);
    }
    ticket.slaTotalPausedMs = (ticket.slaTotalPausedMs || 0) + durationMs;

    ticket.slaPauseHistory.push({
      reason: ticket.slaPauseReason,
      requestedAt: ticket.slaPauseRequestedAt,
      approvedAt: pausedAt,
      resumedAt: now,
      resumedByName: caller.firstName + ' ' + (caller.lastName || ''),
      durationMs
    });

    const durationMins = Math.round(durationMs / 60000);
    const durationHours = (durationMs / 3600000).toFixed(1);

    ticket.slaPauseStatus = 'none';
    ticket.slaPausedAt = null;
    ticket.slaPauseReason = null;
    await ticket.save();

    await new Comment({
      ticketId: ticket.ticketId,
      userId: caller._id,
      userName: caller.firstName + ' (' + caller.role + ')',
      userRole: caller.role,
      message: '▶️ สิ้นสุดการพักเวลา SLA และนับเวลาต่อ (ขยายเวลาเพิ่ม ' + (durationHours >= 1 ? durationHours + ' ชม.' : durationMins + ' นาที') + ')'
    }).save();

    emitUpdate(req);
    res.json({ message: 'กลับมานับเวลาต่อเรียบร้อย', ticket: formatTicket(ticket, caller._id) });
  } catch (e) {
    console.error('[SLA Resume] error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการยกเลิกพักเวลา' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ── 4. DIGITAL WORK ORDER & SIGNATURE ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════

// POST /api/tickets/:id/work-order/sign
router.post('/:id/work-order/sign', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    const { signatureData, signedByName: rawName, notes: rawNotes } = req.body;

    if (!signatureData) {
      return res.status(400).json({ error: 'กรุณาลงลายมือชื่อก่อนบันทึก' });
    }
    const signedByName = rawName ? xss(rawName.trim()) : (caller ? caller.firstName + ' ' + (caller.lastName || '') : 'ผู้รับมอบงาน');
    const notes = rawNotes ? xss(rawNotes.trim()) : '';

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    ticket.workOrder = {
      signedByName,
      signedAt: new Date(),
      signatureData,
      notes
    };
    await ticket.save();

    await new Comment({
      ticketId: ticket.ticketId,
      userId: caller._id,
      userName: caller.firstName + ' (' + caller.role + ')',
      userRole: caller.role,
      message: '📋 ลงนามในใบงานดิจิทัลเรียบร้อย โดย: ' + signedByName
    }).save();

    emitUpdate(req);
    res.json({ message: 'บันทึกลายเซ็นใบงานสำเร็จ', workOrder: ticket.workOrder });
  } catch (e) {
    console.error('[Work Order Sign] error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกลายเซ็น' });
  }
});

// GET /api/tickets/:id/work-order (Print-ready document)
router.get('/:id/work-order', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).send('<h2>ไม่พบข้อมูลใบงาน (Ticket not found)</h2>');

    const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
    const qrTargetUrl = baseUrl ? (baseUrl + '/track?q=' + encodeURIComponent(ticket.ticketId)) : ('/track?q=' + encodeURIComponent(ticket.ticketId));
    const qrImgUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(qrTargetUrl);

    const stMap = {
      pending: 'รอดำเนินการ',
      assigned: 'รับมอบหมายงาน',
      in_progress: 'กำลังดำเนินการ',
      completed: 'เสร็จสิ้นสมบูรณ์',
      rejected: 'ปฏิเสธคำขอ',
      reopened: 'ตีกลับตรวจสอบใหม่',
      merged: 'รวมเข้ากับเคสอื่น'
    };
    const urgMap = { normal: 'ปกติ', medium: 'ด่วน', urgent: 'ด่วนที่สุด (เร่งด่วน)' };
    const createdDate = new Date(ticket.createdAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });
    const signedDate = ticket.workOrder?.signedAt ? new Date(ticket.workOrder.signedAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) : '—';

    const html = '<!DOCTYPE html>' +
'<html lang="th">' +
'<head>' +
'  <meta charset="UTF-8" />' +
'  <title>ใบงานปฏิบัติการและส่งมอบงาน — ' + ticket.ticketId + '</title>' +
'  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet" />' +
'  <style>' +
'    @page { size: A4; margin: 12mm 15mm; }' +
'    * { box-sizing: border-box; margin: 0; padding: 0; }' +
'    body { font-family: "Sarabun", sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; font-size: 13px; line-height: 1.5; }' +
'    .print-container { max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 32px 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }' +
'    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }' +
'    .logo-area { display: flex; align-items: center; gap: 12px; }' +
'    .logo-icon { width: 44px; height: 44px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: bold; }' +
'    .title-main { font-size: 18px; font-weight: 700; color: #0f172a; }' +
'    .title-sub { font-size: 12px; color: #64748b; }' +
'    .qr-area { text-align: center; }' +
'    .qr-area img { width: 84px; height: 84px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 2px; }' +
'    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; }' +
'    .badge-urgent { background: #fee2e2; color: #991b1b; }' +
'    .badge-medium { background: #fef3c7; color: #92400e; }' +
'    .badge-normal { background: #e0f2fe; color: #075985; }' +
'    .badge-status { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }' +
'    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }' +
'    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }' +
'    .box-title { font-weight: 700; font-size: 12px; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; }' +
'    .row { display: flex; margin-bottom: 4px; font-size: 12.5px; }' +
'    .row-label { width: 110px; color: #64748b; font-weight: 500; flex-shrink: 0; }' +
'    .row-val { color: #0f172a; font-weight: 600; word-break: break-word; }' +
'    .photos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }' +
'    .photo-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; background: #fafafa; }' +
'    .photo-card img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; }' +
'    .photo-label { font-size: 11px; font-weight: 600; color: #475569; margin-top: 6px; }' +
'    .signatures-area { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }' +
'    .sig-box { border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px; text-align: center; min-height: 120px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; background: #fdfdfd; }' +
'    .sig-img { max-height: 60px; max-width: 180px; object-fit: contain; }' +
'    .sig-line { width: 80%; border-bottom: 1px solid #334155; margin: 8px 0 4px; }' +
'    .print-actions { text-align: center; margin-bottom: 20px; }' +
'    .btn-print { background: #2563eb; color: #fff; border: none; padding: 10px 22px; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.25); }' +
'    .btn-print:hover { background: #1d4ed8; }' +
'    @media print {' +
'      body { background: #fff; padding: 0; }' +
'      .print-container { border: none; box-shadow: none; padding: 0; max-width: 100%; }' +
'      .print-actions { display: none !important; }' +
'    }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="print-actions">' +
'    <button class="btn-print" onclick="window.print()">🖨️ พิมพ์ / บันทึกเป็น PDF (Print Document)</button>' +
'  </div>' +
'  <div class="print-container">' +
'    <div class="header">' +
'      <div class="logo-area">' +
'        <div class="logo-icon">RN</div>' +
'        <div>' +
'          <div class="title-main">ใบงานปฏิบัติการและส่งมอบงานซ่อมบำรุง</div>' +
'          <div class="title-sub">ResolveNow Municipal Incident & Work Order Report</div>' +
'        </div>' +
'      </div>' +
'      <div class="qr-area">' +
'        <img src="' + qrImgUrl + '" alt="QR Code" />' +
'        <div style="font-size:10px;color:#64748b;margin-top:2px;">สแกนตรวจสอบสถานะ</div>' +
'      </div>' +
'    </div>' +
'    <div class="grid-2">' +
'      <div class="box">' +
'        <div class="box-title">ข้อมูลเคสเรื่องร้องเรียน (Ticket Details)</div>' +
'        <div class="row"><div class="row-label">รหัสเคส:</div><div class="row-val" style="color:#2563eb;font-size:14px">' + ticket.ticketId + '</div></div>' +
'        <div class="row"><div class="row-label">หมวดหมู่งาน:</div><div class="row-val">' + ticket.category + '</div></div>' +
'        <div class="row"><div class="row-label">ความเร่งด่วน:</div><div class="row-val"><span class="badge badge-' + ticket.urgency + '">' + (urgMap[ticket.urgency] || ticket.urgency) + '</span></div></div>' +
'        <div class="row"><div class="row-label">สถานะปัจจุบัน:</div><div class="row-val"><span class="badge badge-status">' + (stMap[ticket.status] || ticket.status) + '</span></div></div>' +
'        <div class="row"><div class="row-label">วันที่รับแจ้ง:</div><div class="row-val">' + createdDate + '</div></div>' +
'      </div>' +
'      <div class="box">' +
'        <div class="box-title">ข้อมูลสถานที่และเจ้าหน้าที่ (Location & Dispatch)</div>' +
'        <div class="row"><div class="row-label">ผู้แจ้งเรื่อง:</div><div class="row-val">' + ticket.citizenName + '</div></div>' +
'        <div class="row"><div class="row-label">สถานที่เกิดเหตุ:</div><div class="row-val">' + ticket.location + '</div></div>' +
'        ' + (ticket.lat && ticket.lng ? ('<div class="row"><div class="row-label">พิกัด GPS:</div><div class="row-val" style="font-family:monospace">' + ticket.lat.toFixed(5) + ', ' + ticket.lng.toFixed(5) + '</div></div>') : '') +
'        <div class="row"><div class="row-label">เจ้าหน้าที่รับงาน:</div><div class="row-val">' + (ticket.assignedName || '— ยังไม่ได้มอบหมาย —') + '</div></div>' +
'        ' + (ticket.slaBreached ? '<div class="row"><div class="row-label">สถานะ SLA:</div><div class="row-val" style="color:#dc2626">เกินกำหนดเวลา (Breached)</div></div>' : '<div class="row"><div class="row-label">สถานะ SLA:</div><div class="row-val" style="color:#16a34a">ภายในกำหนดเวลา (On-Track)</div></div>') +
'      </div>' +
'    </div>' +
'    <div class="box" style="margin-bottom:16px">' +
'      <div class="box-title">รายละเอียดปัญหาและการแก้ไข (Description & Resolution Notes)</div>' +
'      <div style="margin: 6px 0; font-size:12.5px; color:#334155;"><strong>รายละเอียดจากผู้แจ้ง:</strong> ' + ticket.description + '</div>' +
'      ' + (ticket.workOrder?.notes ? ('<div style="margin: 6px 0; font-size:12.5px; color:#0f172a; padding:6px 10px; background:#eff6ff; border-radius:4px;"><strong>บันทึกผลการปฏิบัติงานของช่าง:</strong> ' + ticket.workOrder.notes + '</div>') : '') +
'    </div>' +
'    <div class="photos-grid">' +
'      <div class="photo-card">' +
'        ' + (ticket.beforeImage || ticket.citizenImage ? ('<img src="' + (ticket.beforeImage || ticket.citizenImage) + '" alt="Before" />') : '<div style="height:140px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">ไม่มีภาพก่อนซ่อม</div>') +
'        <div class="photo-label">📸 ภาพก่อนดำเนินการซ่อม (Before Action)</div>' +
'      </div>' +
'      <div class="photo-card">' +
'        ' + (ticket.afterImage ? ('<img src="' + ticket.afterImage + '" alt="After" />') : '<div style="height:140px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">ยังไม่มีภาพหลังซ่อม</div>') +
'        <div class="photo-label">✨ ภาพหลังดำเนินการแล้วเสร็จ (After Action)</div>' +
'      </div>' +
'    </div>' +
'    <div class="signatures-area">' +
'      <div class="sig-box">' +
'        <div style="font-weight:600;font-size:12px;color:#475569">เจ้าหน้าที่ผู้ปฏิบัติงาน / ช่างผู้รับผิดชอบ</div>' +
'        <div style="height:50px;display:flex;align-items:center;justify-content:center;color:#64748b;font-style:italic;">' +
'          ' + (ticket.assignedName ? ('(ลงชื่อ) ' + ticket.assignedName) : '(ยังไม่ได้รับงาน)') +
'        </div>' +
'        <div class="sig-line"></div>' +
'        <div style="font-size:11px;color:#64748b">วันที่: ' + new Date().toLocaleDateString('th-TH') + '</div>' +
'      </div>' +
'      <div class="sig-box">' +
'        <div style="font-weight:600;font-size:12px;color:#475569">ผู้ตรวจรับมอบงาน / ประชาชนผู้แจ้งเรื่อง</div>' +
'        ' + (ticket.workOrder?.signatureData ? ('<img src="' + ticket.workOrder.signatureData + '" class="sig-img" alt="Digital Signature" />') : '<div style="height:50px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;">[ ยังไม่ได้ลงนามดิจิทัล ]</div>') +
'        <div class="sig-line"></div>' +
'        <div style="font-size:12px;font-weight:600;color:#0f172a">' + (ticket.workOrder?.signedByName || '(ลงชื่อผู้ตรวจรับมอบงาน)') + '</div>' +
'        <div style="font-size:11px;color:#64748b">วันที่: ' + signedDate + '</div>' +
'      </div>' +
'    </div>' +
'    <div style="margin-top:24px;text-align:center;font-size:10.5px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:10px;">' +
'      ResolveNow Smart City Incident Dispatch System • เอกสารออกโดยระบบอัตโนมัติ • ' + new Date().toLocaleString('th-TH') +
'    </div>' +
'  </div>' +
'</body>' +
'</html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('[Work Order Page] error:', e);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดใบงาน');
  }
});


// ─── POST /api/tickets/:id/materials ───────────────────────────
// บันทึก/อัปเดตรายการวัสดุและค่าใช้จ่ายในการซ่อม (ช่างเจ้าของงาน หรือ แอดมิน)
router.post('/:id/materials', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || (caller.role !== 'technician' && caller.role !== 'admin')) {
      return res.status(403).json({ error: 'เฉพาะช่างหรือผู้ดูแลระบบเท่านั้น' });
    }

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    if (caller.role === 'technician') {
      const isOwner = ticket.assignedTo && ticket.assignedTo.toString() === caller._id.toString();
      if (!isOwner) return res.status(403).json({ error: 'คุณไม่ใช่ช่างที่รับผิดชอบงานนี้' });
    }

    const { materials, repairCostNotes } = req.body;
    if (!Array.isArray(materials)) {
      return res.status(400).json({ error: 'รูปแบบรายการวัสดุไม่ถูกต้อง' });
    }

    const sanitizedMaterials = [];
    let totalCost = 0;

    for (const item of materials) {
      const name = (item.name || '').trim();
      if (!name) continue;
      const quantity = Math.max(1, parseFloat(item.quantity) || 1);
      const unit = (item.unit || 'ชิ้น').trim();
      const unitPrice = Math.max(0, parseFloat(item.unitPrice) || 0);
      const totalPrice = Math.round(quantity * unitPrice * 100) / 100;
      totalCost += totalPrice;

      sanitizedMaterials.push({
        name: xss(name),
        quantity,
        unit: xss(unit),
        unitPrice,
        totalPrice,
        addedBy: caller.firstName + ' ' + caller.lastName,
        addedAt: new Date()
      });
    }

    ticket.materials = sanitizedMaterials;
    ticket.totalRepairCost = Math.round(totalCost * 100) / 100;
    if (repairCostNotes !== undefined) {
      ticket.repairCostNotes = xss((repairCostNotes || '').trim());
    }

    logTicketActivity(ticket, {
      action: 'materials_updated',
      actorRole: caller.role,
      actorId: caller._id,
      actorName: caller.firstName + ' ' + caller.lastName,
      details: 'บันทึกรายการวัสดุ/อุปกรณ์ ' + sanitizedMaterials.length + ' รายการ งบประมาณรวม ฿' + totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
      newValue: '฿' + totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })
    });

    await ticket.save();
    emitUpdate(req);

    res.json({
      message: 'บันทึกรายการวัสดุและค่าใช้จ่ายเรียบร้อยแล้ว',
      materials: ticket.materials,
      totalRepairCost: ticket.totalRepairCost,
      repairCostNotes: ticket.repairCostNotes,
      ticket: formatTicket(ticket, caller._id)
    });
  } catch (e) {
    console.error('[Materials Endpoint] Error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกวัสดุ' });
  }
});

module.exports = router;

