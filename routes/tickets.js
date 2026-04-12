const express = require('express');
const xss = require('xss');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const multer = require('multer');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const Comment = require('../models/Comment');
const { STATUSES } = require('../data/store');
const { notifyNewTicket, notifyAssigned, notifyInProgress, notifyCompleted, notifyRejected, notifyFollowers } = require('../config/lineNotify');
const { upload: cloudinaryUpload, isCloudinaryConfigured } = require('../config/cloudinary');

// ─── SLA Deadline Helper ─────────────────────────────────────────
const SLA_RULES = {
  urgent:  { assignHours: 2,  completeHours: 8  },
  medium:  { assignHours: 8,  completeHours: 48 },
  normal:  { assignHours: 24, completeHours: 72 }
};
function calcSlaDeadlines(urgency) {
  const rule = SLA_RULES[urgency] || SLA_RULES.normal;
  const now = new Date();
  return {
    slaAssignDeadline:   new Date(now.getTime() + rule.assignHours * 3600000),
    slaCompleteDeadline: new Date(now.getTime() + rule.completeHours * 3600000)
  };
}

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
const localUpload = multer({ storage: localStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const upload = isCloudinaryConfigured() ? cloudinaryUpload : localUpload;

function getFileUrl(req) {
  if (!req.file) return null;
  if (isCloudinaryConfigured()) return req.file.path;
  const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
  return BASE_URL ? BASE_URL + '/uploads/' + req.file.filename : '/uploads/' + req.file.filename;
}

// ─── Reverse Geocoding ───────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const https = require('https');
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th&zoom=17`;
    return await new Promise((resolve) => {
      https.get(url, { headers: { 'User-Agent': 'ResolvNow/1.0' } }, (res) => {
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
function formatTicket(t, currentUserId) {
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
    beforeImage: t.beforeImage,
    afterImage: t.afterImage,
    rating: t.rating,
    ratingReason: t.ratingReason,
    ratedAt: t.ratedAt,
    createdAt: t.createdAt,
    _id: t._id,
    // SLA
    slaAssignDeadline: t.slaAssignDeadline || null,
    slaCompleteDeadline: t.slaCompleteDeadline || null,
    slaBreached: t.slaBreached || false,
    // Upvote
    upvoteCount: t.upvoteCount || 0,
    // Follow
    followerCount: t.followerCount || 0,
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
        beforeImage: t.beforeImage || null,
        afterImage: t.afterImage || null,
        slaBreached: t.slaBreached || false,
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
    // Category translation
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

    // SLA breach evaluation — in-memory only (DB update handled by slaJob.js background job)
    const now = new Date();
    for (const t of tickets) {
      if (t.slaBreached) continue;
      if (t.status === 'pending' && t.slaAssignDeadline && now > t.slaAssignDeadline) {
        t.slaBreached = true;
      } else if (['assigned', 'in_progress'].includes(t.status) && t.slaCompleteDeadline && now > t.slaCompleteDeadline) {
        t.slaBreached = true;
      }
    }

    res.json(tickets.map(t => formatTicket(t, user._id)));
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/tickets ───────────────────────────────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { category, description: rawDescription, location, urgency, lat, lng } = req.body;
    const user = await User.findById(req.session.userId);
    if (!category || !rawDescription || !location)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (!req.file)
      return res.status(400).json({ error: 'กรุณาแนบรูปภาพก่อนส่ง' });

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
      citizenImage: getFileUrl(req),
      slaAssignDeadline: sla.slaAssignDeadline,
      slaCompleteDeadline: sla.slaCompleteDeadline,
    }).save();

    notifyNewTicket(formatTicket(ticket, user._id)).catch(e => console.error('[LINE] notifyNewTicket error:', e));
    emitUpdate(req);
    res.status(201).json(formatTicket(ticket, user._id));
  } catch (e) {
    console.error(e);
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

    let isInitialAssign = ((status === 'assigned' || status === 'in_progress') && caller.role === 'technician' && !ticket.assignedTo);

    if (isInitialAssign) {
      const updated = await Ticket.findOneAndUpdate(
        { ticketId: req.params.id, status: ticket.status },
        { 
          assignedTo: caller._id, 
          assignedName: caller.firstName + ' ' + caller.lastName, 
          status: status 
        },
        { returnDocument: 'after' }
      );
      if (!updated) return res.status(400).json({ error: 'Ticket นี้ถูกทำรายการไปแล้ว โปรดรีเฟรชหน้าจอ' });
      Object.assign(ticket, updated);
    } else {
      ticket.status = status;
      if (status === 'rejected' && reason) ticket.rejectReason = reason;
      await ticket.save();
    }

    // SLA breach check
    if (status === 'assigned' && ticket.slaAssignDeadline && new Date() > ticket.slaAssignDeadline) {
      ticket.slaBreached = true;
      await ticket.save();
    }
    if (status === 'completed' && ticket.slaCompleteDeadline && new Date() > ticket.slaCompleteDeadline) {
      ticket.slaBreached = true;
      await ticket.save();
    }

    // Chat expiry — set 24-hour window when ticket is completed
    if (status === 'completed' && !ticket.chatExpiresAt) {
      ticket.chatExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await ticket.save();
    }

    try {
      const ft = formatTicket(ticket, caller._id);
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

    ticket.assignedTo = tech._id;
    ticket.assignedName = tech.firstName + ' ' + tech.lastName;
    ticket.status = 'assigned';
    await ticket.save();

    notifyAssigned(formatTicket(ticket)).catch(e => console.error('[LINE] notifyAssigned error:', e));
    emitUpdate(req);
    res.json(formatTicket(ticket));
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/tickets/:id/upload/before ─────────────────────────
router.post('/:id/upload/before', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket || !req.file) return res.status(400).json({ error: 'ไม่พบข้อมูล' });
    ticket.beforeImage = getFileUrl(req);
    await ticket.save();
    emitUpdate(req);
    res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.beforeImage });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/tickets/:id/upload/after ──────────────────────────
router.post('/:id/upload/after', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket || !req.file) return res.status(400).json({ error: 'ไม่พบข้อมูล' });
    ticket.afterImage = getFileUrl(req);
    await ticket.save();
    emitUpdate(req);
    res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.afterImage });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
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
    ticket.ratingReason = (stars < 3 && reason) ? reason.trim() : null;
    ticket.ratedAt = new Date().toLocaleString('th-TH');
    await ticket.save();

    res.json({ message: 'บันทึกคะแนนสำเร็จ', ticket: formatTicket(ticket) });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
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
    res.json(tickets.map(t => ({
      ticketId: t.ticketId, category: t.category,
      lat: t.lat, lng: t.lng, status: t.status,
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

    if (!caller && (!q || !q.trim())) return res.json([]);

    let query = {};
    if (caller && caller.role === 'citizen') query.citizenId = caller._id;
    else if (caller && caller.role === 'technician') {
      query.$or = [{ category: caller.specialty }, { assignedTo: caller._id }];
    }
    if (st && st !== 'all') query.status = st;
    if (cat && cat !== 'all') query.category = cat;

    let tickets = await Ticket.find(query).sort({ createdAt: -1 });

    if (q && q.trim()) {
      const kw = q.trim().toLowerCase();
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
        description: t.description, location: t.location,
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

    const ticket = await Ticket.findOneAndDelete({ ticketId: req.params.id });
    if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

    res.json({ message: 'ลบ Ticket เรียบร้อยแล้ว', ticketId: req.params.id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── DELETE /api/tickets (all) ───────────────────────────────────
router.delete('/', requireAuth, async (req, res) => {
  try {
    const caller = await User.findById(req.session.userId);
    if (!caller || caller.role !== 'admin')
      return res.status(403).json({ error: 'เฉพาะ Admin เท่านั้น' });

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
    const ticket = await Ticket.findOne({ ticketId: req.params.id }).select('chatExpiresAt status');
    // ถ้า chat หมดอายุแล้ว ให้คืน array เปล่า
    if (ticket && ticket.chatExpiresAt && new Date() > ticket.chatExpiresAt) {
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

module.exports = router;

