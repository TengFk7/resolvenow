/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── config/mailer.js ─────────────────────────────────────────
// Multi-Provider Resilient Mailer:
// 1. Primary: Nodemailer (Gmail SMTP port 465 SSL / 587 TLS)
// 2. Secondary: SendGrid HTTP API (Fallback)
// 3. Tertiary: Resend HTTP API (Fallback)

const nodemailer = require('nodemailer');

let sgMail = null;
try {
  sgMail = require('@sendgrid/mail');
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
} catch (e) {
  // @sendgrid/mail optional
}

let Resend = null;
try {
  Resend = require('resend').Resend;
} catch (e) {
  // resend optional
}

const MAIL_USER = process.env.MAIL_USER || 'resolvnow@gmail.com';
const MAIL_PASS = (process.env.MAIL_PASS || '').replace(/\s+/g, '');

let gmailTransporter = null;

function getGmailTransporter(port = 465, secure = true) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: port,
    secure: secure,
    family: 4, // IPv4
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    }
  });
}

function getCachedGmailTransporter() {
  if (!gmailTransporter && MAIL_USER && MAIL_PASS) {
    gmailTransporter = getGmailTransporter(465, true);
  }
  return gmailTransporter;
}

// ─── ส่งด้วย Gmail SMTP (Nodemailer) ──────────────────────────
async function sendViaGmail(toEmail, subject, html) {
  if (!MAIL_USER || !MAIL_PASS) {
    throw new Error('Gmail credentials (MAIL_USER / MAIL_PASS) not configured');
  }

  const from = `"ResolveNow" <${MAIL_USER}>`;

  // ลองพอร์ต 465 (SSL) ก่อน
  try {
    const transporter = getCachedGmailTransporter();
    const info = await transporter.sendMail({ from, to: toEmail, subject, html });
    return { provider: 'Gmail SMTP (465)', info };
  } catch (err465) {
    console.warn(`[Mailer] ⚠️ Gmail 465 ล้มเหลว (${err465.message}) กำลังลองพอร์ต 587 (TLS)...`);
    gmailTransporter = null; // reset cache

    // ลองพอร์ต 587 (STARTTLS)
    const tlsTransporter = getGmailTransporter(587, false);
    const info = await tlsTransporter.sendMail({ from, to: toEmail, subject, html });
    return { provider: 'Gmail SMTP (587)', info };
  }
}

// ─── ส่งด้วย SendGrid HTTP API ────────────────────────────────
async function sendViaSendGrid(toEmail, subject, html) {
  if (!sgMail || !process.env.SENDGRID_API_KEY) {
    throw new Error('SendGrid API key not configured');
  }

  const msg = {
    to: toEmail,
    from: { email: MAIL_USER, name: 'ResolveNow' },
    subject,
    html
  };

  const [response] = await sgMail.send(msg);
  return { provider: 'SendGrid API', info: response };
}

// ─── ส่งด้วย Resend HTTP API ──────────────────────────────────
async function sendViaResend(toEmail, subject, html) {
  if (!Resend || !process.env.RESEND_API_KEY) {
    throw new Error('Resend API key not configured');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: 'ResolveNow <onboarding@resend.dev>',
    to: toEmail,
    subject,
    html
  });

  if (result.error) {
    throw new Error(result.error.message || 'Resend error');
  }
  return { provider: 'Resend API', info: result.data };
}

// ─── ส่ง OTP Email (พร้อมระบบ Auto-Fallback ข้ามผู้ให้บริการ) ───
async function sendOtpEmail(toEmail, otp, firstName) {
  const subject = '🔐 รหัส OTP สำหรับสมัครสมาชิก ResolveNow';
  const html = `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:480px;margin:0 auto;background:#f1f5f9;padding:32px 20px;">
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
        <p style="font-size:11px;color:#a0aec0;text-align:center">© 2026 ResolveNow · ระบบรับแจ้งเรื่องร้องเรียน</p>
      </div>
    </div>
  `;

  const errors = [];

  // 1. ลอง Gmail SMTP ก่อน (Primary)
  if (MAIL_USER && MAIL_PASS) {
    try {
      const res = await sendViaGmail(toEmail, subject, html);
      console.log(`[Mailer] ✅ ส่งสำเร็จผ่าน [${res.provider}] → ${toEmail}`);
      return;
    } catch (err) {
      console.warn(`[Mailer] ❌ Gmail SMTP ไม่สำเร็จ: ${err.message}`);
      errors.push(`Gmail: ${err.message}`);
    }
  }

  // 2. ลอง SendGrid API (Fallback 1)
  if (process.env.SENDGRID_API_KEY) {
    try {
      console.log('[Mailer] 🔄 กำลังลองส่งผ่าน SendGrid...');
      const res = await sendViaSendGrid(toEmail, subject, html);
      console.log(`[Mailer] ✅ ส่งสำเร็จผ่าน [${res.provider}] → ${toEmail}`);
      return;
    } catch (err) {
      const errMsg = (err.response && err.response.body && err.response.body.errors)
        ? JSON.stringify(err.response.body.errors)
        : err.message;
      console.warn(`[Mailer] ❌ SendGrid API ไม่สำเร็จ: ${errMsg}`);
      errors.push(`SendGrid: ${errMsg}`);
    }
  }

  // 3. ลอง Resend API (Fallback 2)
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('[Mailer] 🔄 กำลังลองส่งผ่าน Resend...');
      const res = await sendViaResend(toEmail, subject, html);
      console.log(`[Mailer] ✅ ส่งสำเร็จผ่าน [${res.provider}] → ${toEmail}`);
      return;
    } catch (err) {
      console.warn(`[Mailer] ❌ Resend API ไม่สำเร็จ: ${err.message}`);
      errors.push(`Resend: ${err.message}`);
    }
  }

  // หากล้มเหลวทุกช่องทาง
  console.error('[Mailer] 💀 ล้มเหลวทุก Provider:', errors.join(' | '));
  throw new Error(`ส่งอีเมลไม่สำเร็จ: ${errors.join(' | ')}`);
}

module.exports = {
  sendOtpEmail,
  sendViaGmail,
  sendViaSendGrid,
  sendViaResend
};
