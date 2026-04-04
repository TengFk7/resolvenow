// ─── config/mailer.js ─────────────────────────────────────────
// Gmail SMTP with retry + manual IPv4 DNS resolution
// IPv4 ถูกบังคับ global ใน server.js แต่เพื่อความชัวร์ resolve เองด้วย

const nodemailer = require('nodemailer');
const dns = require('dns');
const { promisify } = require('util');
const resolve4 = promisify(dns.resolve4);

const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 6000];

// ─── Resolve Gmail IPv4 address ─────────────────────────────
let _gmailIPv4 = null;
async function getGmailIPv4() {
  try {
    const addrs = await resolve4('smtp.gmail.com');
    _gmailIPv4 = addrs[0];
    console.log('[Mailer] 🌐 Gmail IPv4:', _gmailIPv4);
    return _gmailIPv4;
  } catch (e) {
    console.warn('[Mailer] DNS resolve4 failed, using hostname:', e.message);
    return 'smtp.gmail.com';
  }
}

// ─── สร้าง transporter ─────────────────────────────────────
function createTransporter(host) {
  return nodemailer.createTransport({
    host: host,
    port: 465,
    secure: true,
    name: 'smtp.gmail.com',       // EHLO hostname
    tls: {
      servername: 'smtp.gmail.com', // TLS SNI — ต้องตรงกับ cert
      rejectUnauthorized: false
    },
    pool: true,
    maxConnections: 2,
    maxMessages: 30,
    connectionTimeout: 30000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    }
  });
}

let transporter = createTransporter('smtp.gmail.com');

// ── Init: resolve IPv4 ตั้งแต่เริ่มต้น ──
getGmailIPv4().then(ip => {
  transporter = createTransporter(ip);
  console.log('[Mailer] ✅ transporter ใช้ IPv4:', ip);
}).catch(() => {});

// ─── Sleep helper ────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ส่งอีเมลพร้อม retry ────────────────────────────────────
async function sendMailWithRetry(mailOptions) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        // Retry: resolve IPv4 ใหม่ + สร้าง transporter ใหม่
        try { transporter.close(); } catch (_) {}
        const ip = await getGmailIPv4();
        transporter = createTransporter(ip);
        console.log('[Mailer] ♻️ recreated with IPv4:', ip);
      }

      const info = await transporter.sendMail(mailOptions);
      console.log('[Mailer] ✅ ส่งสำเร็จ (attempt ' + attempt + '):', info.messageId);
      return info;
    } catch (err) {
      lastError = err;
      console.warn('[Mailer] ❌ attempt ' + attempt + '/' + MAX_RETRIES + ':', err.code || err.message);
      if (err.address) console.warn('[Mailer]    → ' + err.address + ':' + err.port);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 4000;
        console.log('[Mailer] ⏳ รอ ' + (delay / 1000) + 's...');
        await sleep(delay);
      }
    }
  }

  console.error('[Mailer] 💀 ล้มเหลว ' + MAX_RETRIES + ' ครั้ง:', lastError.message);
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
