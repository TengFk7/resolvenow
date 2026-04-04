// ─── config/mailer.js ─────────────────────────────────────────
// Gmail SMTP with retry + FORCED IPv4 DNS lookup
// Credentials อ่านจาก Environment Variables

const nodemailer = require('nodemailer');
const dns = require('dns');

const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

const MAX_RETRIES = 3;
const RETRY_DELAYS = [3000, 6000, 12000]; // 3s, 6s, 12s (เพิ่มเวลารอ)

// ─── Custom DNS Lookup — บังคับ IPv4 เท่านั้น ────────────────
// Render ไม่รองรับ IPv6 outbound → ต้อง force IPv4
function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  options.family = 4; // บังคับ IPv4 เสมอ
  return dns.lookup(hostname, options, callback);
}

// ─── สร้าง transporter config ────────────────────────────────
function createTransporterConfig() {
  return {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 2,
    maxMessages: 30,
    connectionTimeout: 60000,  // 60 วินาที
    greetingTimeout: 45000,
    socketTimeout: 60000,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    // บังคับ IPv4 ผ่าน custom DNS lookup (แทน family: 4 ที่ไม่ทำงานกับ pool)
    dnsLookup: ipv4Lookup
  };
}

let transporter = nodemailer.createTransport(createTransporterConfig());

// ─── Recreate transporter (เมื่อ connection pool เสีย) ──────
function recreateTransporter() {
  try { transporter.close(); } catch (_) {}
  transporter = nodemailer.createTransport(createTransporterConfig());
  console.log('[Mailer] ♻️ สร้าง transporter ใหม่ (IPv4 forced)');
}

// ─── Sleep helper ────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ส่งอีเมลพร้อม retry ────────────────────────────────────
async function sendMailWithRetry(mailOptions) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ถ้าเป็น retry → สร้าง transporter ใหม่
      if (attempt > 1) {
        recreateTransporter();
      }

      const info = await transporter.sendMail(mailOptions);
      console.log('[Mailer] ✅ ส่งสำเร็จ (attempt ' + attempt + '):', info.messageId);
      return info;
    } catch (err) {
      lastError = err;
      console.warn('[Mailer] ❌ attempt ' + attempt + '/' + MAX_RETRIES + ' ล้มเหลว:', err.code || err.message);
      if (err.address) console.warn('[Mailer]    address:', err.address, 'port:', err.port);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 6000;
        console.log('[Mailer] ⏳ รอ ' + (delay / 1000) + 's แล้วลองใหม่...');
        await sleep(delay);
      }
    }
  }

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
