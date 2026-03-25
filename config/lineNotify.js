// ─── config/lineNotify.js ─────────────────────────────────────
// ส่งการแจ้งเตือนผ่าน LINE Messaging API (Push Message)
// ต้องตั้งค่าใน .env:
//   LINE_CHANNEL_TOKEN   = Channel Access Token จาก LINE Developers
//   LINE_ADMIN_USER_ID   = User ID ของ admin ที่จะรับการแจ้งเตือน
//   BASE_URL             = URL หลักของระบบ เช่น https://your-app.onrender.com
//                          (ถ้าไม่ตั้ง รูปภาพจะไม่ถูกส่งใน LINE)

const https = require('https');

const TOKEN = process.env.LINE_CHANNEL_TOKEN;
const TO = process.env.LINE_ADMIN_USER_ID;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, ''); // ตัด / ท้าย URL

// ── ส่งข้อความ text ──────────────────────────────────────────
function sendText(text) {
  return pushMessages([{ type: 'text', text }]);
}

// ── ส่งรูปภาพ (ต้องการ URL สาธารณะ HTTPS) ────────────────────
function sendImage(imageUrl) {
  // encode เฉพาะ path segment (ไม่ encode ://  และ /)
  const safeUrl = imageUrl.replace(/\/uploads\/(.+)$/, (_, fname) => '/uploads/' + encodeURIComponent(fname));
  console.log('[LINE] ส่งรูป URL:', safeUrl);
  return pushMessages([{
    type: 'image',
    originalContentUrl: safeUrl,
    previewImageUrl: safeUrl
  }]);
}

// ── ส่ง messages array ไปยัง LINE ────────────────────────────
async function pushMessages(messages) {
  if (!TOKEN || !TO) {
    console.warn('[LINE] LINE_CHANNEL_TOKEN หรือ LINE_ADMIN_USER_ID ไม่ได้ตั้งค่า — ข้ามการแจ้งเตือน');
    return;
  }

  const body = JSON.stringify({ to: TO, messages });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200)
          console.error('[LINE] API error', res.statusCode, data);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Event Functions ──────────────────────────────────────────

function notifyNewTicket(ticket) {
  const urgencyLabel =
    ticket.urgency === 'urgent' ? '🔴 เร่งด่วน' :
      ticket.urgency === 'medium' ? '🟡 ปานกลาง' : '🟢 ปกติ';

  return sendText(
    '🆕 มีเรื่องร้องเรียนใหม่เข้ามา!\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    // '📁 ประเภท: ' + ticket.category + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '⚠️  รายละเอียด: ' + ticket.description + '\n' +
    '⏱️  ความเร่งด่วน: ' + urgencyLabel + '\n' +
    '👤 ผู้แจ้ง: ' + ticket.citizenName + '\n' +
    '━━━━━━━━━━━━━━━━━━\n'
  );
}

function notifyAssigned(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';
  return sendText(
    '🔧 มอบหมายงานให้ช่างแล้ว\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    // '📁 ประเภท: ' + ticket.category + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้รับงาน: ' + techName + '\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '⏳ รอช่างเข้าดำเนินการ'
  );
}

function notifyInProgress(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';
  return sendText(
    '⚙️  เริ่มดำเนินการแล้ว\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    // '📁 ประเภท: ' + ticket.category + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้ดำเนินการ: ' + techName + '\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '🔨 กำลังเร่งดำเนินการแก้ไข'
  );
}

async function notifyCompleted(ticket) {
  const techName = ticket.assignedName || 'ช่างผู้รับงาน';
  const now = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const summaryText =
    '✅ ดำเนินการซ่อมแซมเสร็จสิ้นแล้ว\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    // '📁 ประเภท: ' + ticket.category + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้ดำเนินการ: ' + techName + '\n' +
    '👤 ผู้แจ้ง: ' + ticket.citizenName + '\n' +
    '🕐 เสร็จสิ้นเมื่อ: ' + now + '\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '🙏 ขอบคุณที่ไว้วางใจในบริการของเรา\n' +
    'หากพบปัญหาใหม่สามารถแจ้งเรื่องเข้ามาได้ตลอดเวลา\n' +
    '📲 ระบบ ResolvNow พร้อมรับเรื่องร้องเรียนทุกเมื่อ';

  // ส่งข้อความสรุปก่อน
  await sendText(summaryText);

  // ส่งรูปก่อน-หลังต่อเนื่อง (ต้องการ BASE_URL ที่เป็น public HTTPS)
  if (BASE_URL) {
    if (ticket.beforeImage) {
      await sendText('📷 รูปภาพก่อนดำเนินการ (Ticket ' + ticket.ticketId + '):');
      await sendImage(BASE_URL + ticket.beforeImage);
    }
    if (ticket.afterImage) {
      await sendText('📷 รูปภาพหลังดำเนินการ (Ticket ' + ticket.ticketId + '):');
      await sendImage(BASE_URL + ticket.afterImage);
    }
  } else {
    // ถ้าไม่มี BASE_URL ให้แจ้ง path ของรูปแทน
    const images = [];
    if (ticket.beforeImage) images.push('ก่อน: ' + ticket.beforeImage);
    if (ticket.afterImage) images.push('หลัง: ' + ticket.afterImage);
    if (images.length > 0) {
      await sendText('🖼️  หลักฐานรูปภาพ:\n' + images.join('\n') + '\n\n💡 ตั้งค่า BASE_URL ใน .env เพื่อแสดงรูปใน LINE');
    }
  }
}

function notifyRejected(ticket) {
  return sendText(
    '❌ ปฏิเสธการรับงาน\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    // '📁 ประเภท: ' + ticket.category + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👤 ผู้แจ้ง: ' + ticket.citizenName + '\n' +
    '━━━━━━━━━━━━━━━━━━\n'
  );
}

module.exports = {
  notifyNewTicket,
  notifyAssigned,
  notifyInProgress,
  notifyCompleted,
  notifyRejected
};
