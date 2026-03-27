const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { users, tickets, STATUSES, nextTicketId } = require('../data/store');
const { notifyNewTicket, notifyAssigned, notifyInProgress, notifyCompleted, notifyRejected } = require('../config/lineNotify');
const { upload: cloudinaryUpload, isCloudinaryConfigured } = require('../config/cloudinary');

// ─── Middleware ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// ─── Multer Setup (Local fallback เมื่อไม่มี Cloudinary) ────────
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

// เลือก uploader ตาม config
const upload = isCloudinaryConfigured() ? cloudinaryUpload : localUpload;

// ดึง URL ของไฟล์ที่อัปโหลด (Cloudinary คืน URL ตรง, local ต้องสร้างเอง)
function getFileUrl(req) {
  if (!req.file) return null;
  if (isCloudinaryConfigured()) {
    // Cloudinary: req.file.path คือ secure_url
    return req.file.path;
  }
  // Local fallback
  const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
  return BASE_URL
    ? BASE_URL + '/uploads/' + req.file.filename
    : '/uploads/' + req.file.filename;
}

// GET /api/tickets
router.get('/', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.userId);
  let result;
  if (user.role === 'citizen') {
    result = tickets.filter(t => t.citizenId === user.id);
  } else if (user.role === 'technician') {
    result = tickets.filter(t => t.category === user.specialty || t.assignedTo === user.id);
  } else {
    result = tickets; // admin sees all
  }
  res.json(result);
});


// ─── Reverse Geocoding (OpenStreetMap Nominatim) ────────────
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
            // ประกอบชื่อสถานที่จากส่วนที่มีค่า (ใกล้เคียงที่สุดก่อน)
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

// POST /api/tickets
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { category, description, location, urgency, lat, lng } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!category || !description || !location)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (!req.file)
      return res.status(400).json({ error: 'กรุณาแนบรูปภาพก่อนส่ง' });

    let score = urgency === 'urgent' ? 90 : urgency === 'medium' ? 60 : 30;
    const desc = description.toLowerCase();
    for (const kw of ['flood', 'fire', 'อันตราย', 'เร่งด่วน', 'น้ำท่วม', 'ฉุกเฉิน'])
      if (desc.includes(kw)) score = Math.min(score + 10, 100);

    // แปลง GPS พิกัดเป็นชื่อสถานที่ด้วย reverse geocoding
    let locationName = location;
    if (lat && lng) {
      locationName = await reverseGeocode(lat, lng);
    }

    const fileUrl = getFileUrl(req);
    const ticket = {
      ticketId: nextTicketId(),
      citizenId:     user.id,
      citizenName:   user.firstName + ' ' + user.lastName,
      citizenLineId: user.lineUserId || null,   // สำหรับ push personal notification
      category, description,
      location: locationName,  // ชื่อสถานที่จาก reverse geocoding
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      urgency: urgency || 'normal',
      priorityScore: score,
      status: 'pending',
      assignedTo: null, assignedName: null,
      citizenImage: fileUrl,
      beforeImage: null, afterImage: null,
      createdAt: new Date().toLocaleString('th-TH')
    };
    tickets.push(ticket);

    // แจ้งเตือน LINE
    notifyNewTicket(ticket).catch(e => console.error('[LINE] notifyNewTicket error:', e));

    res.status(201).json(ticket);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/tickets/:id/status
router.put('/:id/status', requireAuth, async (req, res) => {
  const { status, reason } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status ไม่ถูกต้อง' });
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });

  const caller = users.find(u => u.id === req.session.userId);

  // ถ้าช่างกดรับงานเองผ่าน status route → เซ็ตชื่อช่างด้วย
  if (status === 'assigned' && caller && caller.role === 'technician') {
    if (!ticket.assignedTo) {
      ticket.assignedTo   = caller.id;
      ticket.assignedName = caller.firstName + ' ' + caller.lastName;
    }
  }

  // ถ้าช่างกด in_progress และยังไม่มีชื่อ → เซ็ตจาก session
  if (status === 'in_progress' && caller && caller.role === 'technician') {
    if (!ticket.assignedTo) {
      ticket.assignedTo   = caller.id;
      ticket.assignedName = caller.firstName + ' ' + caller.lastName;
    }
  }

  ticket.status = status;
  if (status === 'rejected' && reason) ticket.rejectReason = reason;

  // แจ้งเตือน LINE ตาม status
  try {
    if (status === 'assigned')    await notifyAssigned(ticket);
    if (status === 'in_progress') await notifyInProgress(ticket);
    if (status === 'completed')   await notifyCompleted(ticket);
    if (status === 'rejected')    await notifyRejected(ticket, reason || '');
  } catch (e) { console.error('[LINE] status notify error:', e); }

  res.json(ticket);
});

// PUT /api/tickets/:id/assign
router.put('/:id/assign', requireAuth, async (req, res) => {
  const { technicianId } = req.body;
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'ไม่พบ Ticket' });
  const tech = users.find(u => u.id === parseInt(technicianId) && u.role === 'technician');
  if (!tech) return res.status(404).json({ error: 'ไม่พบช่าง' });
  ticket.assignedTo = tech.id;
  ticket.assignedName = tech.firstName + ' ' + tech.lastName;
  ticket.status = 'assigned';

  // แจ้งเตือน LINE
  notifyAssigned(ticket).catch(e => console.error('[LINE] notifyAssigned error:', e));

  res.json(ticket);
});

// POST /api/tickets/:id/upload/before
router.post('/:id/upload/before', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket || !req.file) return res.status(400).json({ error: 'ไม่พบข้อมูล' });
  ticket.beforeImage = getFileUrl(req);
  res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.beforeImage });
});

// POST /api/tickets/:id/upload/after
router.post('/:id/upload/after', requireAuth, upload.single('image'), (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.id);
  if (!ticket || !req.file) return res.status(400).json({ error: 'ไม่พบข้อมูล' });
  ticket.afterImage = getFileUrl(req);
  // ไม่ auto-complete — ช่างต้องกดปุ่ม "ยืนยันปิดเรื่องร้องเรียน" เองผ่าน PUT /status
  res.json({ message: 'อัปโหลดสำเร็จ', url: ticket.afterImage });
});

module.exports = router;
