// ─── config/lineNotify.js ─────────────────────────────────────
// ส่งการแจ้งเตือนผ่าน LINE Messaging API (Push Message)
// .env: LINE_CHANNEL_TOKEN, LINE_ADMIN_USER_ID, BASE_URL

const https = require('https');

const TOKEN = process.env.LINE_CHANNEL_TOKEN;
const ADMIN_ID = process.env.LINE_ADMIN_USER_ID;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

// ── push ไปหา userId เดียว ────────────────────────────────────
async function pushTo(userId, messages) {
  if (!TOKEN || !userId) return;
  const body = JSON.stringify({ to: userId, messages });
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
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode !== 200)
          console.error('[LINE] push error to', userId, res.statusCode, data,
            res.statusCode === 400 ? '→ user อาจยังไม่ได้ Add Friend bot' : '');
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── push ไปหา admin (เสมอ) และ citizen (ถ้ามี lineUserId) ────
async function pushAll(citizenLineId, adminMessages, citizenMessages) {
  const tasks = [];
  if (ADMIN_ID) tasks.push(pushTo(ADMIN_ID, adminMessages));
  if (citizenLineId && citizenLineId !== ADMIN_ID)
    tasks.push(pushTo(citizenLineId, citizenMessages || adminMessages));
  await Promise.all(tasks);
}

// ── ส่งรูปภาพ (URL สาธารณะ HTTPS เท่านั้น) ───────────────────
async function pushImageTo(userId, imageUrl) {
  if (!imageUrl) return;
  const safeUrl = imageUrl.startsWith('http')
    ? imageUrl
    : BASE_URL + imageUrl;
  console.log('[LINE] push image:', safeUrl, '→', userId);
  return pushTo(userId, [{
    type: 'image',
    originalContentUrl: safeUrl,
    previewImageUrl: safeUrl
  }]);
}

// ── Event Functions ──────────────────────────────────────────

function notifyNewTicket(ticket) {
  const urgencyLabel =
    ticket.urgency === 'urgent' ? '🔴 เร่งด่วน' :
      ticket.urgency === 'medium' ? '🟡 ปานกลาง' : '🟢 ปกติ';

  const msg = '🆕 มีเรื่องร้องเรียนใหม่เข้ามา!\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '⚠️  รายละเอียด: ' + ticket.description + '\n' +
    '⏱️  ความเร่งด่วน: ' + urgencyLabel + '\n' +
    '👤 ผู้แจ้ง: ' + ticket.citizenName + '\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '🔗 กรุณาตรวจสอบและมอบหมายงานในระบบ';

  const citizenMsg = '✅ ระบบได้รับเรื่องของคุณเรียบร้อยแล้ว\n' +
    'หมายเลขคำร้องของคุณคือ: ' + ticket.ticketId + '\n\n' +
    'เจ้าหน้าที่จะทำการตรวจสอบและดำเนินการโดยเร็วที่สุด';

  return pushAll(
    ticket.citizenLineId,
    [{ type: 'text', text: msg }],
    [{ type: 'text', text: citizenMsg }]
  );
}

function notifyAssigned(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';

  const adminMsg = '🔧 มอบหมายงานให้ช่างแล้ว\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้รับงาน: ' + techName + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '⏳ รอช่างเข้าดำเนินการ';

  const citizenMsg = '🔧 มีช่างรับงานของคุณแล้ว!\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้รับงาน: ' + techName + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '⏳ ช่างกำลังเดินทางไปยังสถานที่';

  return pushAll(
    ticket.citizenLineId,
    [{ type: 'text', text: adminMsg }],
    [{ type: 'text', text: citizenMsg }]
  );
}

function notifyInProgress(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';

  const adminMsg = '⚙️  เริ่มดำเนินการแล้ว\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้ดำเนินการ: ' + techName + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '🔨 กำลังเร่งดำเนินการแก้ไข';

  const citizenMsg = '⚙️  ช่างเริ่มดำเนินการแก้ไขแล้ว!\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้ดำเนินการ: ' + techName + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '🔨 กำลังแก้ไข กรุณารอสักครู่...';

  return pushAll(
    ticket.citizenLineId,
    [{ type: 'text', text: adminMsg }],
    [{ type: 'text', text: citizenMsg }]
  );
}

async function notifyCompleted(ticket) {
  const techName = ticket.assignedName || 'ช่างผู้รับงาน';
  const now = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const adminMsg = '✅ ดำเนินการซ่อมแซมเสร็จสิ้นแล้ว\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่างผู้ดำเนินการ: ' + techName + '\n' +
    '👤 ผู้แจ้ง: ' + ticket.citizenName + '\n' +
    '🕐 เสร็จสิ้นเมื่อ: ' + now + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '🙏 ขอบคุณที่ไว้วางใจในบริการของเรา\n' +
    'หากพบปัญหาใหม่สามารถแจ้งเรื่องเข้ามาได้ตลอดเวลา\n' +
    '📲 ระบบ ResolveNow พร้อมรับเรื่องร้องเรียนทุกเมื่อ';

  const citizenMsg = '🎉 เรื่องร้องเรียนของคุณได้รับการแก้ไขแล้ว!\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👷 ช่าง: ' + techName + '\n' +
    '🕐 เสร็จสิ้นเมื่อ: ' + now + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '🙏 ขอบคุณที่แจ้งเรื่องมายังระบบ ResolveNow\n' +
    'หากพบปัญหาอื่น สามารถแจ้งเรื่องได้เสมอ!';

  // ส่งข้อความสรุปทั้ง admin และ citizen
  await pushAll(
    ticket.citizenLineId,
    [{ type: 'text', text: adminMsg }],
    [{ type: 'text', text: citizenMsg }]
  );

  // ส่งรูปก่อน-หลัง รวมใน push เดียว (LINE รองรับสูงสุด 5 messages/push)
  const targets = [];
  if (ADMIN_ID) targets.push(ADMIN_ID);
  if (ticket.citizenLineId && ticket.citizenLineId !== ADMIN_ID)
    targets.push(ticket.citizenLineId);

  for (const uid of targets) {
    const imageMessages = [];

    if (ticket.beforeImage) {
      const beforeUrl = ticket.beforeImage.startsWith('http')
        ? ticket.beforeImage
        : BASE_URL + ticket.beforeImage;
      imageMessages.push({ type: 'image', originalContentUrl: beforeUrl, previewImageUrl: beforeUrl });
    }

    if (ticket.afterImage) {
      const afterUrl = ticket.afterImage.startsWith('http')
        ? ticket.afterImage
        : BASE_URL + ticket.afterImage;
      imageMessages.push({ type: 'image', originalContentUrl: afterUrl, previewImageUrl: afterUrl });
    }

    if (imageMessages.length > 0) {
      const label = imageMessages.length === 2
        ? '📷 รูปก่อน-หลังดำเนินการ:'
        : (ticket.beforeImage ? '📷 รูปก่อนดำเนินการ:' : '📷 รูปหลังดำเนินการ:');
      await pushTo(uid, [{ type: 'text', text: label }, ...imageMessages]);
    }
  }
}

function notifyRejected(ticket, reason) {
  const adminMsg = '❌ ปฏิเสธการรับงาน\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '👤 ผู้แจ้ง: ' + ticket.citizenName + '\n' +
    (reason ? '📝 เหตุผล: ' + reason + '\n' : '') +
    '━━━━━━━━━━━━━━━━\n' +
    '📌 กรุณาตรวจสอบและดำเนินการต่อไป';

  const citizenMsg = '❌ ขออภัย เรื่องร้องเรียนของคุณถูกปฏิเสธ\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    (reason ? '📝 เหตุผล: ' + reason + '\n' : '') +
    '━━━━━━━━━━━━━━━━\n' +
    '📞 หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่ @ResolveNow.com';

  return pushAll(
    ticket.citizenLineId,
    [{ type: 'text', text: adminMsg }],
    [{ type: 'text', text: citizenMsg }]
  );
}

module.exports = {
  notifyNewTicket,
  notifyAssigned,
  notifyInProgress,
  notifyCompleted,
  notifyRejected
};
