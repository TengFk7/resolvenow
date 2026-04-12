// ─── config/lineNotify.js ─────────────────────────────────────
// ส่งการแจ้งเตือนผ่าน LINE Messaging API (Push Message)
// .env: LINE_CHANNEL_TOKEN, LINE_ADMIN_USER_ID, BASE_URL

const https = require('https');

const TOKEN   = process.env.LINE_CHANNEL_TOKEN;
const ADMIN_ID = process.env.LINE_ADMIN_USER_ID;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

// ── push ไปหา userId เดียว ──────────────────────────────────
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

async function pushAll(citizenLineId, adminMessages, citizenMessages) {
  const tasks = [];
  if (ADMIN_ID) tasks.push(pushTo(ADMIN_ID, adminMessages));
  if (citizenLineId && citizenLineId !== ADMIN_ID)
    tasks.push(pushTo(citizenLineId, citizenMessages || adminMessages));
  await Promise.all(tasks);
}

// ── Flex Bubble Builder ──────────────────────────────────────
// headerBg: hex color, headerLabel: small brand label text
// headerTitle: big title text, headerColor: title color
// rows: [{icon, label, value}], footerBtns: [{label, url, style, color}]
function makeBubble({ headerBg, headerLabel, headerTitle, headerTitleColor, rows, footerBtns }) {
  const bodyContents = rows.map((r, i) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: r.icon + ' ' + r.label, size: 'sm', color: '#8880a8', flex: 3 },
      { type: 'text', text: r.value, size: 'sm', color: '#f0eeff', weight: 'bold', flex: 4, align: 'end', wrap: true }
    ],
    margin: i === 0 ? 'md' : 'sm'
  }));

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [{
            type: 'text',
            text: '\uD83C\uDFD9\uFE0F ResolveNow',
            size: 'sm',
            color: '#a78bfa',
            weight: 'bold'
          }]
        },
        {
          type: 'text',
          text: headerTitle,
          size: 'xl',
          weight: 'bold',
          color: headerTitleColor || '#ffffff',
          margin: 'sm',
          wrap: true
        }
      ],
      backgroundColor: headerBg || '#1a1230',
      paddingAll: '20px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        ...bodyContents,
        { type: 'separator', margin: 'lg', color: '#2d2050' }
      ],
      backgroundColor: '#0f0c1a',
      paddingAll: '20px'
    }
  };

  if (footerBtns && footerBtns.length > 0) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: footerBtns.map(btn => ({
        type: 'button',
        action: { type: 'uri', label: btn.label, uri: btn.url },
        style: btn.style || 'primary',
        color: btn.color || '#7c5ce8',
        height: 'sm'
      })),
      backgroundColor: '#0f0c1a',
      paddingAll: '16px',
      paddingTop: '12px'
    };
  }

  return bubble;
}

function flexMsg(altText, bubble) {
  return { type: 'flex', altText, contents: bubble };
}

// ── notifyNewTicket ──────────────────────────────────────────
function notifyNewTicket(ticket) {
  const urgencyLabel =
    ticket.urgency === 'urgent' ? '\uD83D\uDD34 เร่งด่วน' :
    ticket.urgency === 'medium' ? '\uD83D\uDFE1 ปานกลาง' : '\uD83D\uDFE2 ปกติ';

  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  // Admin Flex
  const adminBubble = makeBubble({
    headerBg: '#0d2240',
    headerTitle: '\uD83C\uDD95 มีเรื่องร้องเรียนใหม่!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\u26A0\uFE0F', label: 'รายละเอียด', value: (ticket.description || '-').slice(0, 60) + ((ticket.description || '').length > 60 ? '...' : '') },
      { icon: '\u23F1\uFE0F', label: 'ความเร่งด่วน', value: urgencyLabel },
      { icon: '\uD83D\uDC64', label: 'ผู้แจ้ง', value: ticket.citizenName || '-' }
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 เข้าระบบมอบหมายงาน', url: BASE_URL, style: 'primary', color: '#2563eb' }] : []
  });

  // Citizen Flex
  const citizenBubble = makeBubble({
    headerBg: '#0d2240',
    headerTitle: '\u2705 รับเรื่องเรียบร้อยแล้ว!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket ID', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\u23F1\uFE0F', label: 'ความเร่งด่วน', value: urgencyLabel }
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ติดตามสถานะ', url: trackLink, style: 'primary', color: '#2563eb' }] : []
  });

  return pushAll(
    ticket.citizenLineId,
    [flexMsg('\uD83C\uDD95 มีเรื่องร้องเรียนใหม่ — ' + ticket.ticketId, adminBubble)],
    [flexMsg('\u2705 เราได้รับเรื่องของคุณแล้ว — ' + ticket.ticketId, citizenBubble)]
  );
}

// ── notifyAssigned ───────────────────────────────────────────
function notifyAssigned(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const adminBubble = makeBubble({
    headerBg: '#0f2a4a',
    headerTitle: '\uD83D\uDD27 มอบหมายงานให้ช่างแล้ว',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้รับงาน', value: techName }
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 ดูในระบบ', url: BASE_URL, style: 'primary', color: '#2563eb' }] : []
  });

  const citizenBubble = makeBubble({
    headerBg: '#0f2a4a',
    headerTitle: '\uD83D\uDD27 มีช่างรับงานของคุณแล้ว!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้รับงาน', value: techName },
      { icon: '\u23F3', label: 'สถานะ', value: 'กำลังเดินทางไปสถานที่' }
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ติดตามสถานะ', url: trackLink, style: 'primary', color: '#2563eb' }] : []
  });

  return pushAll(
    ticket.citizenLineId,
    [flexMsg('\uD83D\uDD27 มอบหมายงาน — ' + ticket.ticketId, adminBubble)],
    [flexMsg('\uD83D\uDD27 มีช่างรับงานแล้ว — ' + ticket.ticketId, citizenBubble)]
  );
}

// ── notifyInProgress ─────────────────────────────────────────
function notifyInProgress(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const adminBubble = makeBubble({
    headerBg: '#1a1050',
    headerTitle: '\u2699\uFE0F เริ่มดำเนินการแล้ว',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้ดำเนินการ', value: techName },
      { icon: '\uD83D\uDD28', label: 'สถานะ', value: 'กำลังดำเนินการแก้ไข' }
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 ดูในระบบ', url: BASE_URL, style: 'primary', color: '#7c3aed' }] : []
  });

  const citizenBubble = makeBubble({
    headerBg: '#1a1050',
    headerTitle: '\u2699\uFE0F ช่างเริ่มดำเนินการแล้ว!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้ดำเนินการ', value: techName },
      { icon: '\uD83D\uDD28', label: 'สถานะ', value: 'กำลังแก้ไข กรุณารอสักครู่...' }
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ติดตามสถานะ', url: trackLink, style: 'primary', color: '#7c3aed' }] : []
  });

  return pushAll(
    ticket.citizenLineId,
    [flexMsg('\u2699\uFE0F เริ่มดำเนินการ — ' + ticket.ticketId, adminBubble)],
    [flexMsg('\u2699\uFE0F ช่างเริ่มดำเนินการแล้ว — ' + ticket.ticketId, citizenBubble)]
  );
}

// ── notifyCompleted ──────────────────────────────────────────
async function notifyCompleted(ticket) {
  const techName = ticket.assignedName || 'ช่างผู้รับงาน';
  const now = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const adminBubble = makeBubble({
    headerBg: '#0a2a18',
    headerTitle: '\u2705 ดำเนินการเสร็จสิ้นแล้ว!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้ดำเนินการ', value: techName },
      { icon: '\uD83D\uDC64', label: 'ผู้แจ้ง', value: ticket.citizenName || '-' },
      { icon: '\uD83D\uDD50', label: 'เสร็จเมื่อ', value: now }
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 ดูในระบบ', url: BASE_URL, style: 'primary', color: '#16a34a' }] : []
  });

  // ── LIFF URLs สำหรับปุ่มดาว ──────────────────────────────
  const LIFF_ID = process.env.LINE_LIFF_ID || '';
  const encodedTicketId   = encodeURIComponent(ticket.ticketId);
  const encodedLineUserId = encodeURIComponent(ticket.citizenLineId || '');

  function makeLiffUrl(rating) {
    const base = LIFF_ID
      ? 'https://liff.line.me/' + LIFF_ID
      : BASE_URL + '/liff-rating';
    return base + '?ticketId=' + encodedTicketId +
      '&lineUserId=' + encodedLineUserId +
      (rating ? '&rating=' + rating : '');
  }

  const citizenMessages = [];

  if (LIFF_ID || BASE_URL) {
    citizenMessages.push({
      type: 'flex',
      altText: '\uD83C\uDF89 เรื่องร้องเรียน ' + ticket.ticketId + ' ได้รับการแก้ไขแล้ว! กดดาวเพื่อประเมินบริการได้เลย',
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
              contents: [{ type: 'text', text: '\uD83C\uDFD9\uFE0F ResolveNow', size: 'sm', color: '#a78bfa', weight: 'bold' }]
            },
            { type: 'text', text: '\uD83C\uDF89 งานเสร็จสิ้นแล้ว!', size: 'xl', weight: 'bold', color: '#ffffff', margin: 'sm' }
          ],
          backgroundColor: '#0a2a18',
          paddingAll: '20px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'box', layout: 'horizontal', margin: 'md', contents: [
              { type: 'text', text: '\uD83D\uDCCB Ticket', size: 'sm', color: '#8880a8', flex: 2 },
              { type: 'text', text: ticket.ticketId, size: 'sm', color: '#f0eeff', weight: 'bold', flex: 3, align: 'end' }
            ]},
            { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
              { type: 'text', text: '\uD83D\uDCCD สถานที่', size: 'sm', color: '#8880a8', flex: 2 },
              { type: 'text', text: ticket.location || '-', size: 'sm', color: '#f0eeff', flex: 3, align: 'end', wrap: true }
            ]},
            { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
              { type: 'text', text: '\uD83D\uDC77 ช่าง', size: 'sm', color: '#8880a8', flex: 2 },
              { type: 'text', text: techName, size: 'sm', color: '#f0eeff', flex: 3, align: 'end' }
            ]},
            { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
              { type: 'text', text: '\uD83D\uDD50 เสร็จเมื่อ', size: 'sm', color: '#8880a8', flex: 2 },
              { type: 'text', text: now, size: 'sm', color: '#f0eeff', flex: 3, align: 'end', wrap: true }
            ]},
            { type: 'separator', margin: 'lg', color: '#2d2050' },
            { type: 'text', text: '\u2B50 กดดาวเพื่อให้คะแนนบริการ', size: 'md', weight: 'bold', color: '#f0eeff', margin: 'lg', align: 'center' },
            { type: 'text', text: 'กดที่ดาวด้านล่างได้เลย — ยืนยันในหน้าถัดไป', size: 'xs', color: '#8880a8', align: 'center', margin: 'xs' }
          ],
          backgroundColor: '#0f0c1a',
          paddingAll: '20px'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              contents: [1, 2, 3].map(n => ({
                type: 'button',
                action: { type: 'uri', label: '\u2605'.repeat(n), uri: makeLiffUrl(n) },
                style: 'secondary',
                height: 'sm',
                flex: 1
              }))
            },
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              contents: [4, 5].map(n => ({
                type: 'button',
                action: { type: 'uri', label: '\u2605'.repeat(n), uri: makeLiffUrl(n) },
                style: 'primary',
                color: n === 5 ? '#f5c518' : '#d4a017',
                height: 'sm',
                flex: 1
              }))
            }
          ],
          backgroundColor: '#0f0c1a',
          paddingAll: '16px',
          paddingTop: '4px'
        }
      }
    });
  } else {
    citizenMessages.push({
      type: 'flex',
      altText: '\uD83C\uDF89 เรื่องร้องเรียน ' + ticket.ticketId + ' ได้รับการแก้ไขแล้ว!',
      contents: makeBubble({
        headerBg: '#0a2a18',
        headerTitle: '\uD83C\uDF89 งานเสร็จสิ้นแล้ว!',
        rows: [
          { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
          { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
          { icon: '\uD83D\uDC77', label: 'ช่าง', value: techName },
          { icon: '\uD83D\uDD50', label: 'เสร็จเมื่อ', value: now }
        ],
        footerBtns: []
      })
    });
  }

  // ── รูปภาพก่อน-หลัง ─────────────────────────────────────
  const imageMessages = [];
  if (ticket.beforeImage) {
    const url = ticket.beforeImage.startsWith('http') ? ticket.beforeImage : BASE_URL + ticket.beforeImage;
    imageMessages.push({ type: 'image', originalContentUrl: url, previewImageUrl: url });
  }
  if (ticket.afterImage) {
    const url = ticket.afterImage.startsWith('http') ? ticket.afterImage : BASE_URL + ticket.afterImage;
    imageMessages.push({ type: 'image', originalContentUrl: url, previewImageUrl: url });
  }
  if (imageMessages.length > 0) {
    const label = imageMessages.length === 2 ? '\uD83D\uDCF7 รูปก่อน-หลังดำเนินการ:' :
      (ticket.beforeImage ? '\uD83D\uDCF7 รูปก่อนดำเนินการ:' : '\uD83D\uDCF7 รูปหลังดำเนินการ:');
    imageMessages.unshift({ type: 'text', text: label });
  }

  const tasks = [];
  if (ADMIN_ID) {
    tasks.push(pushTo(ADMIN_ID, [flexMsg('\u2705 เสร็จสิ้น — ' + ticket.ticketId, adminBubble), ...imageMessages]));
  }
  if (ticket.citizenLineId && ticket.citizenLineId !== ADMIN_ID) {
    tasks.push(pushTo(ticket.citizenLineId, [...imageMessages, ...citizenMessages]));
  }
  await Promise.all(tasks);
}

// ── notifyRejected ───────────────────────────────────────────
function notifyRejected(ticket, reason) {
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const adminBubble = makeBubble({
    headerBg: '#3a0a0a',
    headerTitle: '\u274C ปฏิเสธการรับงาน',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC64', label: 'ผู้แจ้ง', value: ticket.citizenName || '-' },
      ...(reason ? [{ icon: '\uD83D\uDCDD', label: 'เหตุผล', value: reason }] : [])
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 ตรวจสอบในระบบ', url: BASE_URL, style: 'primary', color: '#dc2626' }] : []
  });

  const citizenBubble = makeBubble({
    headerBg: '#3a0a0a',
    headerTitle: '\u274C ขออภัย เรื่องถูกปฏิเสธ',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      ...(reason ? [{ icon: '\uD83D\uDCDD', label: 'เหตุผล', value: reason }] : [])
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ดูรายละเอียด', url: trackLink, style: 'primary', color: '#dc2626' }] : []
  });

  return pushAll(
    ticket.citizenLineId,
    [flexMsg('\u274C ปฏิเสธงาน — ' + ticket.ticketId, adminBubble)],
    [flexMsg('\u274C เรื่องร้องเรียนถูกปฏิเสธ — ' + ticket.ticketId, citizenBubble)]
  );
}

// ── notifyFollowers ──────────────────────────────────────────
async function notifyFollowers(ticket, newStatus) {
  if (!ticket.followers || !ticket.followers.length) return;
  const statusTH = {
    pending: '\uD83D\uDD34 รอดำเนินการ',
    assigned: '\uD83D\uDD27 มอบหมายช่างแล้ว',
    in_progress: '\u2699\uFE0F กำลังดำเนินการ',
    completed: '\u2705 เสร็จสิ้นแล้ว',
    rejected: '\u274C ถูกปฏิเสธ'
  };
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';
  const statusLabel = statusTH[newStatus] || newStatus;

  const bubble = makeBubble({
    headerBg: '#1a1230',
    headerTitle: '\uD83D\uDD14 Ticket ที่คุณติดตามมีการอัปเดต',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDCCA', label: 'สถานะใหม่', value: statusLabel }
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ติดตามสถานะ', url: trackLink, style: 'primary', color: '#7c5ce8' }] : []
  });

  const tasks = [];
  for (const f of ticket.followers) {
    if (f.lineUserId) {
      tasks.push(pushTo(f.lineUserId, [flexMsg('\uD83D\uDD14 อัปเดตสถานะ — ' + ticket.ticketId, bubble)]));
    }
  }
  await Promise.all(tasks);
}

module.exports = {
  notifyNewTicket,
  notifyAssigned,
  notifyInProgress,
  notifyCompleted,
  notifyRejected,
  notifyFollowers
};
