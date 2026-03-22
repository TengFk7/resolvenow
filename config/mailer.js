// ─── config/mailer.js ─────────────────────────────────────────
// ใช้ Resend API (HTTPS) แทน SMTP — ทำงานได้บน Render free plan
// Local: อ่านจาก .env  |  Render: ตั้งใน Dashboard → Environment

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOtpEmail(toEmail, otp, firstName) {
  await resend.emails.send({
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
}

module.exports = { sendOtpEmail };
