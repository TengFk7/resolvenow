// ─── config/mailer.js ─────────────────────────────────────────
// Gmail SMTP with retry + connection pooling
// Credentials อ่านจาก Environment Variables

const nodemailer = require('nodemailer');

const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // Exponential backoff: 2s, 5s, 10s

// ─── สร้าง transporter config ────────────────────────────────
function createTransporterConfig() {
  return {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,              // SSL โดยตรง (ไม่ใช้ STARTTLS)
    family: 4,                 // Force IPv4 — Render ไม่รองรับ IPv6 outbound
    pool: true,                // ใช้ connection pool (reuse connections)
    maxConnections: 3,         // จำกัด connections พร้อมกัน
    maxMessages: 50,           // ส่งได้ 50 ข้อความต่อ connection ก่อนสร้างใหม่
    connectionTimeout: 45000,  // 45 วินาที (เผื่อ cold-start Render)
    greetingTimeout: 30000,
    socketTimeout: 45000,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  };
}

let transporter = nodemailer.createTransport(createTransporterConfig());

// ─── Recreate transporter (เมื่อ connection pool เสีย) ──────
function recreateTransporter() {
  try { transporter.close(); } catch (_) {}
  transporter = nodemailer.createTransport(createTransporterConfig());
  console.log('[Mailer] ♻️ สร้าง transporter ใหม่');
}

// ─── Sleep helper ────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ส่งอีเมลพร้อม retry ────────────────────────────────────
async function sendMailWithRetry(mailOptions) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ถ้าเป็น retry → สร้าง transporter ใหม่ (connection เดิมอาจเสีย)
      if (attempt > 1) {
        recreateTransporter();
      }

      const info = await transporter.sendMail(mailOptions);
      console.log('[Mailer] ✅ ส่งสำเร็จ (attempt ' + attempt + '):', info.messageId);
      return info;
    } catch (err) {
      lastError = err;
      console.warn('[Mailer] ❌ attempt ' + attempt + '/' + MAX_RETRIES + ' ล้มเหลว:', err.code || err.message);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 5000;
        console.log('[Mailer] ⏳ รอ ' + (delay / 1000) + 's แล้วลองใหม่...');
        await sleep(delay);
      }
    }
  }

  // หมดรอบ retry แล้ว
  console.error('[Mailer] 💀 ส่งไม่สำเร็จหลัง ' + MAX_RETRIES + ' ครั้ง:', lastError.message);
  throw lastError;
}

// ─── ส่ง OTP Email ───────────────────────────────────────────
async function sendOtpEmail(toEmail, otp, firstName) {
  await sendMailWithRetry({
    from: '"ResolveNow" <' + MAIL_USER + '>',
    to: toEmail,
    subject: '🔐 รหัส OTP สำหรับสมัครสมาชิก ResolveNow',
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#f1f5f9;padding:32px 20px;">
        <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
          <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:32px">🏛️</div>
            <h1 style="font-size:22px;font-weight:800;color:#1a56db;margin:8px 0">ResolveNow</h1>
            <p style="font-size:13px;color:#718096;margin:0">ระบบรับแจ้งเรื่องร้องเรียน</p>
          </div>
          <p style="font-size:15px;color:#1a202c">สวัสดีคุณ <strong>${firstName}</strong>,</p>
          <p style="font-size:14px;color:#4a5568;margin-bottom:24px">นี่คือรหัส OTP สำหรับยืนยันอีเมลของคุณ:</p>
          <div style="background:#eff6ff;border:2px solid #1a56db;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
            <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1a56db">${otp}</div>
          </div>
          <p style="font-size:13px;color:#718096">⏱ รหัสนี้จะหมดอายุใน <strong>5 นาที</strong></p>
          <p style="font-size:13px;color:#718096">⚠️ หากคุณไม่ได้สมัครสมาชิก กรุณาเพิกเฉยต่ออีเมลนี้</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
          <p style="font-size:11px;color:#a0aec0;text-align:center">© 2024 ResolveNow · ระบบรับแจ้งเรื่องร้องเรียน</p>
        </div>
      </div>
    `
  });
}

module.exports = { sendOtpEmail };
