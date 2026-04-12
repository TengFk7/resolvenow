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

  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const msg = '🆕 มีเรื่องร้องเรียนใหม่เข้ามา!\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '⚠️  รายละเอียด: ' + ticket.description + '\n' +
    '⏱️  ความเร่งด่วน: ' + urgencyLabel + '\n' +
    '👤 ผู้แจ้ง: ' + ticket.citizenName + '\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '🔗 กรุณาตรวจสอบและมอบหมายงานในระบบ' +
    (BASE_URL ? '\n' + BASE_URL : '');

  const citizenMsg = '✅ ระบบได้รับเรื่องของคุณเรียบร้อยแล้ว\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    'เจ้าหน้าที่จะทำการตรวจสอบและดำเนินการโดยเร็วที่สุด\n' +
    (trackLink ? '\n🔍 ติดตามสถานะเรื่องร้องเรียนได้ที่:\n' + trackLink : '');

  return pushAll(
    ticket.citizenLineId,
    [{ type: 'text', text: msg }],
    [{ type: 'text', text: citizenMsg }]
  );
}

function notifyAssigned(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

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
    '⏳ ช่างกำลังเดินทางไปยังสถานที่' +
    (trackLink ? '\n\n🔍 ติดตามสถานะได้ที่:\n' + trackLink : '');

  return pushAll(
    ticket.citizenLineId,
    [{ type: 'text', text: adminMsg }],
    [{ type: 'text', text: citizenMsg }]
  );
}

function notifyInProgress(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

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
    '🔨 กำลังแก้ไข กรุณารอสักครู่...' +
    (trackLink ? '\n\n🔍 ติดตามสถานะได้ที่:\n' + trackLink : '');

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

  const LIFF_ID = process.env.LINE_LIFF_ID || '';
  const liffUrl = LIFF_ID
    ? `https://liff.line.me/${LIFF_ID}?ticketId=${ticket.ticketId}&lineUserId=${ticket.citizenLineId || ''}`
    : (BASE_URL ? `${BASE_URL}/liff-rating?ticketId=${ticket.ticketId}&lineUserId=${ticket.citizenLineId || ''}` : null);

  // ── Flex Message สำหรับ citizen ─────────────────────────────────
  const citizenMessages = [];

  if (liffUrl) {
    // Flex Message พร้อมปุ่มประเมิน
    citizenMessages.push({
      type: 'flex',
      altText: `🎉 เรื่องร้องเรียน ${ticket.ticketId} ได้รับการแก้ไขแล้ว! กรุณาประเมินบริการ`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '🏙️ ResolveNow',
                  size: 'sm',
                  color: '#a78bfa',
                  weight: 'bold'
                }
              ]
            },
            {
              type: 'text',
              text: '🎉 งานเสร็จสิ้นแล้ว!',
              size: 'xl',
              weight: 'bold',
              color: '#ffffff',
              margin: 'sm'
            }
          ],
          backgroundColor: '#1a1230',
          paddingAll: '20px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '📋 Ticket', size: 'sm', color: '#8880a8', flex: 2 },
                { type: 'text', text: ticket.ticketId, size: 'sm', color: '#f0eeff', weight: 'bold', flex: 3, align: 'end' }
              ],
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '📍 สถานที่', size: 'sm', color: '#8880a8', flex: 2 },
                { type: 'text', text: ticket.location || '-', size: 'sm', color: '#f0eeff', flex: 3, align: 'end', wrap: true }
              ],
              margin: 'sm'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '👷 ช่าง', size: 'sm', color: '#8880a8', flex: 2 },
                { type: 'text', text: techName, size: 'sm', color: '#f0eeff', flex: 3, align: 'end' }
              ],
              margin: 'sm'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '🕐 เสร็จเมื่อ', size: 'sm', color: '#8880a8', flex: 2 },
                { type: 'text', text: now, size: 'sm', color: '#f0eeff', flex: 3, align: 'end', wrap: true }
              ],
              margin: 'sm'
            },
            {
              type: 'separator',
              margin: 'lg',
              color: '#2d2050'
            },
            {
              type: 'text',
              text: 'คุณพอใจกับบริการของเราไหม?',
              size: 'md',
              weight: 'bold',
              color: '#f0eeff',
              margin: 'lg',
              align: 'center'
            },
            {
              type: 'text',
              text: '☆  ☆  ☆  ☆  ☆',
              size: 'xxl',
              color: '#f5c518',
              align: 'center',
              margin: 'sm'
            },
            {
              type: 'text',
              text: 'กดที่นี่เพื่อให้คะแนนดาว 1-5',
              size: 'xs',
              color: '#8880a8',
              align: 'center',
              margin: 'xs'
            }
          ],
          backgroundColor: '#0f0c1a',
          paddingAll: '20px'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '⭐ ประเมินบริการ',
                uri: liffUrl
              },
              style: 'primary',
              color: '#7c5ce8',
              height: 'sm'
            }
          ],
          backgroundColor: '#0f0c1a',
          paddingAll: '16px',
          paddingTop: '4px'
        },
      }
    });
  } else {
    // Fallback: text message ถ้าไม่มี LIFF ID
    const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';
    citizenMessages.push({
      type: 'text',
      text: '🎉 เรื่องร้องเรียนของคุณได้รับการแก้ไขแล้ว!\n' +
        '━━━━━━━━━━━━━━━━\n' +
        '📋 Ticket: ' + ticket.ticketId + '\n' +
        '📍 สถานที่: ' + ticket.location + '\n' +
        '👷 ช่าง: ' + techName + '\n' +
        '🕐 เสร็จสิ้นเมื่อ: ' + now + '\n' +
        '━━━━━━━━━━━━━━━━\n' +
        '🙏 ขอบคุณที่แจ้งเรื่องมายังระบบ ResolveNow\n' +
        'หากพบปัญหาอื่น สามารถแจ้งเรื่องได้เสมอ!' +
        (trackLink ? '\n\n🔍 ดูสรุปผลการดำเนินการได้ที่:\n' + trackLink : '')
    });
  }

  // ── เตรียมรูปภาพก่อน-หลัง ────────────────────────────────────────
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
    // ใส่ข้อความอธิบายรูปไว้บนสุดของกลุ่มรูป
    imageMessages.unshift({ type: 'text', text: label });
  }

  // ── ส่งข้อความทั้งหมดในคำสั่งเดียว (รักษาลำดับ: รูปก่อน → ประเมินบริการทีหลัง) ──
  const tasks = [];
  
  // สำหรับ Admin (ข้อความสรุป + รูป)
  if (ADMIN_ID) {
    const adminPayload = [{ type: 'text', text: adminMsg }, ...imageMessages];
    tasks.push(pushTo(ADMIN_ID, adminPayload));
  }
  
  // สำหรับ Citizen (รูป + การ์ดประเมินบริการ)
  if (ticket.citizenLineId && ticket.citizenLineId !== ADMIN_ID) {
    const citizenPayload = [...imageMessages, ...citizenMessages];
    tasks.push(pushTo(ticket.citizenLineId, citizenPayload));
  }

  await Promise.all(tasks);
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

  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const citizenMsg = '❌ ขออภัย เรื่องร้องเรียนของคุณถูกปฏิเสธ\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    (reason ? '📝 เหตุผล: ' + reason + '\n' : '') +
    '━━━━━━━━━━━━━━━━\n' +
    '📞 หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่ @ResolveNow.com' +
    (trackLink ? '\n\n🔍 ดูรายละเอียดเรื่องร้องเรียนได้ที่:\n' + trackLink : '');

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
  notifyRejected,
  notifyFollowers
};

// ── Notify all followers of a ticket on status change ──────────
async function notifyFollowers(ticket, newStatus) {
  if (!ticket.followers || !ticket.followers.length) return;
  const statusTH = {
    pending: 'รอดำเนินการ', assigned: 'มอบหมายช่างแล้ว',
    in_progress: 'กำลังดำเนินการซ่อม', completed: 'เสร็จสิ้นแล้ว',
    rejected: 'ถูกปฏิเสธ'
  };
  const statusLabel = statusTH[newStatus] || newStatus;
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const msg = '🔔 Ticket ที่คุณติดตามมีการอัปเดต!\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '📋 Ticket: ' + ticket.ticketId + '\n' +
    '📍 สถานที่: ' + ticket.location + '\n' +
    '📊 สถานะใหม่: ' + statusLabel + '\n' +
    '━━━━━━━━━━━━━━━━\n' +
    (trackLink ? '🔍 ติดตามสถานะได้ที่:\n' + trackLink : '📲 เข้าระบบ ResolveNow เพื่อดูรายละเอียดเพิ่มเติม');

  const tasks = [];
  for (const f of ticket.followers) {
    if (f.lineUserId) {
      tasks.push(pushTo(f.lineUserId, [{ type: 'text', text: msg }]));
    }
  }
  await Promise.all(tasks);
}
