const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { users } = require('../data/store');

// ─── Middleware ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'กรุณา Login ก่อน' });
  next();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (!email.includes('@'))
      return res.status(400).json({ error: 'รูปแบบ Email ไม่ถูกต้อง' });
    if (users.find(u => u.email === email))
      return res.status(400).json({ error: 'Email นี้ถูกใช้แล้ว' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password ต้องมีอย่างน้อย 6 ตัว' });

    const user = {
      id: users.length + 1, firstName, lastName, email,
      password: await bcrypt.hash(password, 10),
      role: 'citizen', specialty: null,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ message: 'สมัครสำเร็จ', user: { id: user.id, firstName, lastName, email, role: 'citizen' } });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'ไม่พบ Email นี้ในระบบ' });
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Password ไม่ถูกต้อง' });
    req.session.userId = user.id;
    req.session.role = user.role;
    if (remember) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    res.json({
      message: 'Login สำเร็จ',
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, specialty: user.specialty }
    });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout สำเร็จ' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, specialty: user.specialty });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = users.find(u => u.id === req.session.userId);
    if (!user || !currentPassword || !newPassword)
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว' });
    if (!await bcrypt.compare(currentPassword, user.password))
      return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    user.password = await bcrypt.hash(newPassword, 10);
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
