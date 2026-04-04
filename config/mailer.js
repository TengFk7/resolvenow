// ─── config/mailer.js ─────────────────────────────────────────
// ใช้ SendGrid HTTP API — ไม่ใช้ SMTP → ไม่มีปัญหา port blocking
// ส่งผ่าน HTTPS (port 443) ปกติ — ใช้ได้บน Render ทุก tier

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const MAIL_FROM = process.env.MAIL_USER || 'resolvnow@gmail.com';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1500, 3000, 5000]; // 1.5s, 3s, 5s — user ไม่ต้องรอนาน

// ─── Sleep helper ────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ส่ง OTP Email ───────────────────────────────────────────
async function sendOtpEmail(toEmail, otp, firstName) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sgMail.send({
        to: toEmail,
        from: { email: MAIL_FROM, name: 'ResolveNow' },
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

      console.log('[Mailer] ✅ ส่งสำเร็จ (attempt ' + attempt + ') → ' + toEmail);
      return;
    } catch (err) {
      lastError = err;
      const statusCode = err.code || (err.response && err.response.statusCode) || 'unknown';
      const errMsg = (err.response && err.response.body && err.response.body.errors)
        ? JSON.stringify(err.response.body.errors)
        : err.message;
      console.warn('[Mailer] ❌ attempt ' + attempt + '/' + MAX_RETRIES + ' [' + statusCode + ']:', errMsg);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 3000;
        console.log('[Mailer] ⏳ รอ ' + (delay / 1000) + 's...');
        await sleep(delay);
      }
    }
  }

  console.error('[Mailer] 💀 ล้มเหลว ' + MAX_RETRIES + ' ครั้ง');
  throw lastError;
}

module.exports = { sendOtpEmail };
