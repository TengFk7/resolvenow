const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const User    = require('../models/User');
const { otpStore } = require('../data/store');
const { sendOtpEmail } = require('../config/mailer');

// ─── Helpers ────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}
function generateOtp()   { return String(Math.floor(100000 + Math.random() * 900000)); }
function generateToken() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

// ─── POST /api/auth/send-otp ────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (typeof email !== 'string' || typeof password !== 'string')
      return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
    if (!email.includes('@'))
      return res.status(400).json({ error: 'รูปแบบ Email ไม่ถูกต้อง' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password ต้องมีอย่างน้อย 6 ตัว' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });

    const otp   = generateOtp();
    const token = generateToken();
    otpStore.set(token, {
      otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0,
      userData: { firstName, lastName, email, password }
    });

    await sendOtpEmail(email, otp, firstName);
    res.json({ message: 'ส่ง OTP แล้ว', token });
  } catch (e) {
    console.error('send-otp error:', e);
    res.status(500).json({ error: 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบ Email อีกครั้ง' });
  }
});

// ─── POST /api/auth/register ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { token, otp } = req.body;
    if (!token || !otp) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

    const entry = otpStore.get(token);
    if (!entry) return res.status(400).json({ error: 'OTP หมดอายุหรือไม่ถูกต้อง กรุณาส่งใหม่' });
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(token);
      return res.status(400).json({ error: 'OTP หมดอายุแล้ว กรุณาส่งใหม่', expired: true });
    }
    if (entry.attempts >= 3) {
      otpStore.delete(token);
      return res.status(400).json({ error: 'ใส่ OTP ผิดเกิน 3 ครั้ง กรุณาส่ง OTP ใหม่', locked: true });
    }
    if (entry.otp !== String(otp).trim()) {
      entry.attempts += 1;
      const remaining = 3 - entry.attempts;
      if (remaining <= 0) {
        otpStore.delete(token);
        return res.status(400).json({ error: 'OTP ไม่ถูกต้อง คุณหมดสิทธิ์แล้ว กรุณาส่ง OTP ใหม่', locked: true });
      }
      return res.status(400).json({ error: `OTP ไม่ถูกต้อง เหลืออีก ${remaining} ครั้ง`, remaining });
    }

    const { firstName, lastName, email, password } = entry.userData;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });

    const user = await new User({
      firstName, lastName, email,
      password: await bcrypt.hash(password, 10),
      role: 'citizen',
    }).save();
    otpStore.delete(token);

    req.session.userId = user._id.toString();
    req.session.role   = user.role;
    res.json({ message: 'สมัครสำเร็จ', user: { id: user._id, firstName, lastName, email, role: 'citizen' } });
  } catch (e) {
    console.error('register error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'ไม่พบ Email นี้ในระบบ' });
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Password ไม่ถูกต้อง' });

    req.session.userId = user._id.toString();
    req.session.role   = user.role;
    if (remember) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;

    res.json({
      message: 'Login สำเร็จ',
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName,
              email: user.email, role: user.role, specialty: user.specialty }
    });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/auth/logout ───────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout สำเร็จ' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ id: user._id, firstName: user.firstName, lastName: user.lastName,
               email: user.email, role: user.role, specialty: user.specialty,
               lineUserId: user.lineUserId, avatar: user.avatar });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/auth/change-password ─────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว' });

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    if (!await bcrypt.compare(currentPassword, user.password))
      return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── Helpers ใหม่ ─────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin')
    return res.status(403).json({ error: 'Admin เท่านั้น' });
  next();
}

// ─── GET /api/auth/line-pending ──────────────────────────────
// คืนข้อมูล LINE ที่รอเชื่อมบัญชี (จาก session.lineLinkPending)
router.get('/line-pending', (req, res) => {
  if (!req.session.lineLinkPending)
    return res.status(404).json({ error: 'ไม่มีข้อมูล LINE pending' });
  const { lineDisplayName, lineAvatar } = req.session.lineLinkPending;
  res.json({ lineDisplayName, lineAvatar });
});

// ─── POST /api/auth/link-line ────────────────────────────────
// เชื่อม LINE account กับ email account ที่มีอยู่แล้ว
router.post('/link-line', async (req, res) => {
  try {
    if (!req.session.lineLinkPending)
      return res.status(400).json({ error: 'ไม่มีข้อมูล LINE ที่รอเชื่อม กรุณา Login ด้วย LINE ใหม่' });

    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'ไม่พบ Email นี้ในระบบ' });
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Password ไม่ถูกต้อง' });
    if (user.lineUserId)
      return res.status(400).json({ error: 'บัญชีนี้เชื่อมกับ LINE อื่นไปแล้ว' });

    const { lineUserId, lineDisplayName, lineAvatar } = req.session.lineLinkPending;

    // ตรวจว่า lineUserId นี้ยังไม่ถูกใช้กับ user อื่น
    const existingLine = await User.findOne({ lineUserId });
    if (existingLine && existingLine._id.toString() !== user._id.toString())
      return res.status(400).json({ error: 'LINE account นี้เชื่อมกับบัญชีอื่นแล้ว' });

    user.lineUserId      = lineUserId;
    user.lineDisplayName = lineDisplayName;
    if (lineAvatar) user.avatar = lineAvatar;
    await user.save();

    delete req.session.lineLinkPending;
    req.session.userId = user._id.toString();
    req.session.role   = user.role;

    console.log('[LINE Link] เชื่อมสำเร็จ:', user.email, '↔', lineUserId);
    res.json({
      message: 'เชื่อมบัญชี LINE สำเร็จ',
      user: {
        id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, specialty: user.specialty,
        lineUserId: user.lineUserId, avatar: user.avatar
      }
    });
  } catch (e) {
    console.error('link-line error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── POST /api/auth/link-line-skip ──────────────────────────
// user กด "ข้าม" → สร้าง LINE-only citizen account จาก pending session
router.post('/link-line-skip', async (req, res) => {
  try {
    if (!req.session.lineLinkPending)
      return res.status(400).json({ error: 'ไม่มีข้อมูล LINE ที่รอเชื่อม กรุณา Login ด้วย LINE ใหม่' });

    const { lineUserId, lineDisplayName, lineAvatar } = req.session.lineLinkPending;

    // ตรวจว่า lineUserId นี้ยังไม่มีใน DB (กรณี race condition)
    let user = await User.findOne({ lineUserId });
    if (!user) {
      const nameParts = lineDisplayName.split(' ');
      user = await new User({
        firstName:      nameParts[0] || lineDisplayName,
        lastName:       nameParts.slice(1).join(' ') || '-',
        email:          'line_' + lineUserId + '@line.me',
        password:       await bcrypt.hash('LINE_NO_PW_' + lineUserId + '_' + Date.now(), 10),
        role:           'citizen',
        lineUserId,
        lineDisplayName,
        avatar:          lineAvatar || null,
      }).save();
      console.log('[LINE Skip] สร้าง LINE-only citizen:', user.firstName, lineUserId);
    }

    delete req.session.lineLinkPending;
    req.session.userId = user._id.toString();
    req.session.role   = user.role;

    res.json({
      message: 'เข้าสู่ระบบด้วย LINE สำเร็จ',
      user: {
        id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, specialty: user.specialty,
        lineUserId: user.lineUserId, avatar: user.avatar
      }
    });
  } catch (e) {
    console.error('link-line-skip error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── POST /api/auth/admin-unlink-line ────────────────────────
// Admin ล้างการเชื่อม LINE ของ user (สำหรับทดสอบ)
router.post('/admin-unlink-line', requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'กรุณาระบุ Email' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    if (!user.lineUserId) return res.status(400).json({ error: 'บัญชีนี้ยังไม่ได้เชื่อม LINE' });

    const oldLineId = user.lineUserId;
    user.lineUserId      = undefined;
    user.lineDisplayName = undefined;
    await user.save();

    console.log('[Admin] ล้าง LINE link:', user.email, 'lineId:', oldLineId);
    res.json({ message: `ล้างการเชื่อม LINE ของ ${user.firstName} ${user.lastName} สำเร็จ` });
  } catch (e) {
    console.error('admin-unlink-line error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;

