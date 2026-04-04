// ─── config/mailer.js ─────────────────────────────────────────
// ใช้ Resend API (HTTP) แทน SMTP — ไม่มีปัญหา timeout บน Render
// ไม่ต้องพึ่ง SMTP port → เร็วและเสถียรกว่า

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // 1s, 3s, 5s

// ─── Sleep helper ────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── ส่ง OTP Email ───────────────────────────────────────────
async function sendOtpEmail(toEmail, otp, firstName) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'ResolveNow <onboarding@resend.dev>',
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

      if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log('[Mailer] ✅ ส่งสำเร็จ (attempt ' + attempt + '):', data?.id);
      return data;
    } catch (err) {
      lastError = err;
      console.warn('[Mailer] ❌ attempt ' + attempt + '/' + MAX_RETRIES + ' ล้มเหลว:', err.message);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt - 1] || 3000;
        console.log('[Mailer] ⏳ รอ ' + (delay / 1000) + 's แล้วลองใหม่...');
        await sleep(delay);
      }
    }
  }

  console.error('[Mailer] 💀 ส่งไม่สำเร็จหลัง ' + MAX_RETRIES + ' ครั้ง:', lastError.message);
  throw lastError;
}

module.exports = { sendOtpEmail };
