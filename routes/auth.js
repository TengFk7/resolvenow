const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const User    = require('../models/User');
const Ticket  = require('../models/Ticket');
const Comment = require('../models/Comment');
const { otpStore } = require('../data/store');
const { sendOtpEmail } = require('../config/mailer');
const { cloudinary } = require('../config/cloudinary');

// ─── Cloudinary Helpers ─────────────────────────────────────────
// แปลง Cloudinary URL → public_id (เช่น "resolvenow/abc123")
function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    // ตัวอย่าง URL: https://res.cloudinary.com/<cloud>/image/upload/v1234567890/resolvenow/abc123.jpg
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/);
    return match ? match[1] : null;
  } catch { return null; }
}

// รับ array ของ Ticket documents → เก็บ public_ids ทั้งหมดแล้ว destroy พร้อมกัน
async function purgeTicketImages(tickets) {
  const publicIds = [];
  for (const t of tickets) {
    for (const field of ['citizenImage', 'beforeImage', 'afterImage']) {
      const pid = extractPublicId(t[field]);
      if (pid) publicIds.push(pid);
    }
  }
  if (publicIds.length === 0) return;
  // destroy ทีละอัน (แบบ parallel เพื่อความเร็ว)
  await Promise.allSettled(
    publicIds.map(pid =>
      cloudinary.uploader.destroy(pid).catch(err =>
        console.warn('[Cloudinary] ลบรูปไม่สำเร็จ:', pid, err?.message)
      )
    )
  );
  console.log(`[Cloudinary] ลบรูป ${publicIds.length} ไฟล์ออกจาก Cloud สำเร็จ`);
}

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

    // FIX-3.1: ตรวจ email ซ้ำก่อน (กรณีปกติ) เพื่อ error message ที่เข้าใจได้
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      otpStore.delete(token);
      return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
    }

    // FIX-3.1: ใช้ User.create() แทน new User().save()
    // ถ้า double-submit ผ่านพร้อมกัน → MongoDB E11000 unique index จะ throw
    // → catch แล้วคืน 400 แทน 500
    let user;
    try {
      user = await User.create({
        firstName, lastName, email,
        password: await bcrypt.hash(password, 10),
        role: 'citizen',
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        otpStore.delete(token);
        return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
      }
      throw createErr;
    }
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

    const emailLower = email.toLowerCase();
    const user = await User.findOne({ email: emailLower });
    console.log('[Login] email:', emailLower, '→ found:', !!user);
    if (!user) return res.status(401).json({ error: 'ไม่พบ Email นี้ในระบบ' });

    const pwMatch = await bcrypt.compare(password, user.password);
    console.log('[Login] password match:', pwMatch);
    if (!pwMatch) return res.status(401).json({ error: 'Password ไม่ถูกต้อง' });

    req.session.userId = user._id.toString();
    req.session.role   = user.role;
    if (remember) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;

    res.json({
      message: 'Login สำเร็จ',
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName,
              email: user.email, role: user.role, specialty: user.specialty }
    });
  } catch (e) { console.error('[Login] error:', e); res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ─── POST /api/auth/logout ───────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout สำเร็จ' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) return res.json({ loggedIn: false });
    res.json({ id: user._id, firstName: user.firstName, lastName: user.lastName,
               email: user.email, role: user.role, specialty: user.specialty,
               lineUserId: user.lineUserId, avatar: user.avatar, loggedIn: true });
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

// ─── POST /api/auth/register-line ────────────────────────────
// Step 1: ส่ง OTP ไปยัง email ก่อนสร้างบัญชี
router.post('/register-line', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const pending = req.session.lineLinkPending;

    if (!pending || !pending.lineUserId)
      return res.status(400).json({ error: 'ไม่พบข้อมูล LINE session กรุณา login ด้วย LINE ใหม่อีกครั้ง' });

    if (!firstName || !firstName.trim())
      return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
    if (!email || !email.trim())
      return res.status(400).json({ error: 'กรุณากรอก Email' });
    if (!password || password.length < 6)
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

    const emailLower = email.toLowerCase().trim();

    // ตรวจ email ซ้ำ
    const existing = await User.findOne({ email: emailLower });
    if (existing) return res.status(400).json({ error: 'Email นี้มีในระบบแล้ว กรุณาใช้ Email อื่น' });

    // ตรวจ lineUserId ซ้ำ (ป้องกัน race condition)
    const existingLine = await User.findOne({ lineUserId: pending.lineUserId });
    if (existingLine) {
      // มีบัญชีแล้ว — login เลย
      delete req.session.lineLinkPending;
      req.session.userId = existingLine._id.toString();
      req.session.role   = existingLine.role;
      return res.json({
        message: 'เข้าสู่ระบบสำเร็จ',
        user: {
          id: existingLine._id, firstName: existingLine.firstName, lastName: existingLine.lastName,
          email: existingLine.email, role: existingLine.role, specialty: existingLine.specialty,
          lineUserId: existingLine.lineUserId, avatar: existingLine.avatar
        }
      });
    }

    // สร้าง OTP และเก็บข้อมูลไว้
    const otp   = generateOtp();
    const token = generateToken();
    otpStore.set(token, {
      otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0,
      userData: { firstName: firstName.trim(), lastName: (lastName || '').trim() || '-', email: emailLower, password },
      isLineRegister: true  // flag ว่าเป็น LINE registration
    });

    await sendOtpEmail(emailLower, otp, firstName.trim());
    console.log('[Register-LINE] ส่ง OTP ไปที่:', emailLower);
    res.json({ message: 'ส่ง OTP แล้ว', token });
  } catch (e) {
    console.error('register-line error:', e);
    res.status(500).json({ error: 'ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบ Email อีกครั้ง' });
  }
});

// ─── POST /api/auth/verify-line-otp ────────────────────────────
// Step 2: ยืนยัน OTP แล้วสร้างบัญชี + ผูก LINE
router.post('/verify-line-otp', async (req, res) => {
  try {
    const { token, otp } = req.body;
    const pending = req.session.lineLinkPending;

    if (!pending || !pending.lineUserId)
      return res.status(400).json({ error: 'ไม่พบข้อมูล LINE session กรุณา login ด้วย LINE ใหม่อีกครั้ง' });

    const entry = otpStore.get(token);
    if (!entry) return res.status(400).json({ error: 'OTP หมดอายุ กรุณาขอใหม่' });
    if (Date.now() > entry.expiresAt) { otpStore.delete(token); return res.status(400).json({ error: 'OTP หมดอายุ กรุณาขอใหม่' }); }
    if (entry.attempts >= 5) { otpStore.delete(token); return res.status(400).json({ error: 'กรอก OTP ผิดเกินกำหนด กรุณาขอใหม่' }); }
    if (entry.otp !== otp) { entry.attempts++; return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง (เหลือ ' + (5 - entry.attempts) + ' ครั้ง)' }); }

    // OTP ถูกต้อง — สร้างบัญชี
    const { firstName, lastName, email, password } = entry.userData;
    otpStore.delete(token);

    // ตรวจซ้ำอีกครั้ง (ป้องกัน race condition)
    const existCheck = await User.findOne({ email });
    if (existCheck) return res.status(400).json({ error: 'Email นี้มีในระบบแล้ว' });

    const hashed = await bcrypt.hash(password, 10);
    console.log('[Register-LINE] OTP ถูกต้อง, สร้างบัญชี:', email);

    const user = new User({
      firstName, lastName, email,
      password:  hashed,
      role:      'citizen',
      lineUserId:      pending.lineUserId,
      lineDisplayName: pending.lineDisplayName || null,
      avatar:          pending.lineAvatar || null,
      createdViaLine:  true
    });
    await user.save();

    delete req.session.lineLinkPending;
    req.session.userId = user._id.toString();
    req.session.role   = user.role;

    console.log('[Register-LINE] สร้างบัญชีใหม่:', user.email, 'line:', user.lineUserId);
    res.json({
      message: 'สร้างบัญชีและผูก LINE สำเร็จ!',
      user: {
        id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, role: user.role, specialty: user.specialty,
        lineUserId: user.lineUserId, avatar: user.avatar
      }
    });
  } catch (e) {
    console.error('verify-line-otp error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

// ─── POST /api/auth/admin-unlink-line ────────────────────────
// Admin ลบ user ที่ผูก LINE หรือสร้างผ่าน LINE (รายคน)
router.post('/admin-unlink-line', requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'กรุณาระบุ Email' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    // ยอมรับทั้ง users ที่มี lineUserId และที่ createdViaLine: true
    if (!user.lineUserId && !user.createdViaLine)
      return res.status(400).json({ error: 'บัญชีนี้ไม่ได้สร้างหรือผูกผ่าน LINE' });

    const userId = user._id;

    // CLOUDINARY CLEANUP: ดึง tickets พร้อมรูปก่อนลบ แล้วค่อย purge รูปบน Cloud
    const userTickets = await Ticket.find({ citizenId: userId })
      .select('citizenImage beforeImage afterImage');
    await purgeTicketImages(userTickets);

    // CASCADE-FIX: clean up all data belonging to this user before deleting
    await Ticket.deleteMany({ citizenId: userId });         // tickets they created
    await Comment.deleteMany({ userId });                   // comments they wrote
    await Ticket.updateMany(                               // remove from other tickets' upvotes
      { 'upvotes.userId': userId },
      { $pull: { upvotes: { userId } } }
    );
    await Ticket.updateMany(                               // remove from other tickets' followers
      { 'followers.userId': userId },
      { $pull: { followers: { userId } } }
    );
    await User.deleteOne({ _id: userId });
    console.log('[Admin] ลบ user + cascade:', user.email);
    res.json({ message: `ลบบัญชี ${user.firstName} ${user.lastName} สำเร็จ` });
  } catch (e) {
    console.error('admin-unlink-line error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── GET /api/auth/admin-linked-lines ────────────────────────
// Admin ดึงรายชื่อ user ทุกคนที่ผูก LINE หรือสร้างผ่าน LINE
router.get('/admin-linked-lines', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({
      $or: [
        { lineUserId: { $exists: true, $ne: null } },
        { createdViaLine: true }
      ]
    })
      .select('firstName lastName email role lineUserId lineDisplayName avatar createdViaLine')
      .sort({ updatedAt: -1 });
    res.json(users.map(u => ({
      email: u.email,
      name:  u.firstName + (u.lastName && u.lastName !== '-' ? ' ' + u.lastName : ''),
      role:  u.role,
      lineDisplayName: u.lineDisplayName || '',
      avatar: u.avatar || null,
      hasLine: !!u.lineUserId,          // true = ยังผูก LINE อยู่
      createdViaLine: !!u.createdViaLine // true = สร้างผ่าน LINE
    })));
  } catch (e) {
    console.error('admin-linked-lines error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ─── POST /api/auth/admin-unlink-all ─────────────────────────
// Admin ลบ user ทุกคนที่ผูก LINE หรือสร้างผ่าน LINE ออกจาก DB
router.post('/admin-unlink-all', requireAdmin, async (req, res) => {
  try {
    // Find IDs of all users being deleted before removing them
    const usersToDelete = await User.find({
      $or: [
        { lineUserId: { $exists: true, $ne: null } },
        { createdViaLine: true }
      ]
    }).select('_id');
    const userIds = usersToDelete.map(u => u._id);

    // CLOUDINARY CLEANUP: ดึงรูปทั้งหมดจาก tickets ของ users เหล่านี้ก่อนลบ
    if (userIds.length > 0) {
      const allTickets = await Ticket.find({ citizenId: { $in: userIds } })
        .select('citizenImage beforeImage afterImage');
      await purgeTicketImages(allTickets);
    }

    const result = await User.deleteMany({
      $or: [
        { lineUserId: { $exists: true, $ne: null } },
        { createdViaLine: true }
      ]
    });

    // CASCADE-FIX: clean up all data belonging to deleted users
    if (userIds.length > 0) {
      await Ticket.deleteMany({ citizenId: { $in: userIds } });
      await Comment.deleteMany({ userId: { $in: userIds } });
      await Ticket.updateMany(
        { 'upvotes.userId': { $in: userIds } },
        { $pull: { upvotes: { userId: { $in: userIds } } } }
      );
      await Ticket.updateMany(
        { 'followers.userId': { $in: userIds } },
        { $pull: { followers: { userId: { $in: userIds } } } }
      );
    }
    console.log(`[Admin] ลบ user + cascade: ${result.deletedCount} คน`);
    res.json({ message: `ลบบัญชีที่เชื่อม/สร้างผ่าน LINE จำนวน ${result.deletedCount} บัญชีสำเร็จ` });
  } catch (e) {
    console.error('admin-unlink-all error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;

