// ─── config/lineNotify.js ─────────────────────────────────────
// ส่งการแจ้งเตือนผ่าน LINE Messaging API (Push Message)
// .env: LINE_CHANNEL_TOKEN, LINE_ADMIN_USER_ID, BASE_URL

const https = require('https');

const TOKEN = process.env.LINE_CHANNEL_TOKEN;
const ADMIN_ID = process.env.LINE_ADMIN_USER_ID;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

// ── Design Tokens (ตรงกับธีม Navy/Blue/Gold ของระบบ) ─────────
const T = {
  headerBg: '#07111f',          // navy deep
  headerBg2: '#0c1e3a',          // navy mid
  bodyBg: '#0a1628',          // navy base
  footerBg: '#0a1628',
  brand: '#fbbf24',          // gold2  — ชื่อ ResolveNow
  title: '#ffffff',
  label: '#6b8aad',          // steel-blue muted
  value: '#e2eeff',          // near-white blue-tint
  sep: '#1e3a6e',          // navy border
  // accent headers per event
  hNew: 'linear-gradient(135deg,#07111f,#0c2a52)',  // blue-navy
  hProg: '#0c1e3a',          // navy
  hDone: '#071e14',          // dark-green-navy
  hReject: '#1e0808',          // dark-red-navy
  hFollow: '#0c1628',
  hImage: '#071e14',
  // button colors
  btnBlue: '#2563eb',
  btnGold: '#f59e0b',
  btnGold5: '#fbbf24',
  btnRed: '#dc2626',
};

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

// ── Brand header row ─────────────────────────────────────────
// แสดงแถว "⚡ ResolveNow" สีทองบนสุดของทุก card
function brandRow() {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [{
      type: 'text',
      text: '\uD83C\uDFDB\uFE0F ResolveNow',
      size: 'sm',
      color: T.brand,
      weight: 'bold'
    }]
  };
}

// ── Flex Bubble Builder ──────────────────────────────────────
// headerBg: hex color, headerTitle: big title text
// rows: [{icon, label, value}], footerBtns: [{label, url, style, color}]
function makeBubble({ headerBg, headerTitle, headerTitleColor, rows, footerBtns }) {
  const bodyContents = rows.map((r, i) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: r.icon + ' ' + r.label, size: 'sm', color: T.label, flex: 3 },
      { type: 'text', text: r.value, size: 'sm', color: T.value, weight: 'bold', flex: 4, align: 'end', wrap: true }
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
        brandRow(),
        {
          type: 'text',
          text: headerTitle,
          size: 'xl',
          weight: 'bold',
          color: headerTitleColor || T.title,
          margin: 'sm',
          wrap: true
        }
      ],
      backgroundColor: headerBg || T.headerBg2,
      paddingAll: '20px'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        ...bodyContents,
        { type: 'separator', margin: 'lg', color: T.sep }
      ],
      backgroundColor: T.bodyBg,
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
        color: btn.color || T.btnBlue,
        height: 'sm'
      })),
      backgroundColor: T.footerBg,
      paddingAll: '16px',
      paddingTop: '12px'
    };
  }

  return bubble;
}

function flexMsg(altText, bubble) {
  return { type: 'flex', altText, contents: bubble };
}

// ── Image URL normalizer ─────────────────────────────────────
function normalizeUrl(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : BASE_URL + url;
}

// ── Build one image-box (for Flex contents) ──────────────────
// เพิ่ม action เพื่อให้กดรูปแล้วเปิดประโยครูปเต็มใน LINE browser
function imgBox(url, label, labelColor, flex) {
  const box = {
    type: 'box', layout: 'vertical', cornerRadius: '6px',
    action: { type: 'uri', label: 'ดูรูป', uri: url },
    contents: [
      { type: 'image', url, size: 'full', aspectRatio: '4:3', aspectMode: 'cover', gravity: 'center' },
      { type: 'text', text: label, size: 'xxs', color: labelColor || T.label, align: 'center', margin: 'xs' }
    ]
  };
  if (flex !== undefined) box.flex = flex;
  return box;
}

// ── makeImageCards — Admin: adaptive carousel by afterImages count ──
// Returns array of flex messages (1 bubble or carousel)
function makeImageCards(ticket, beforeUrl, afterUrls) {
  // afterUrls = array of after-repair image URLs
  const count = afterUrls.length;
  const headerBox = {
    type: 'box', layout: 'vertical',
    contents: [
      brandRow(),
      { type: 'text', text: '\uD83D\uDCF7 รูปก่อน-หลังดำเนินการ', size: 'lg', weight: 'bold', color: T.title, margin: 'sm' }
    ],
    backgroundColor: T.hImage, paddingAll: '16px'
  };
  const ticketRow = {
    type: 'box', layout: 'horizontal',
    contents: [
      { type: 'text', text: '\uD83D\uDCCB Ticket', size: 'sm', color: T.label, flex: 2 },
      { type: 'text', text: ticket.ticketId, size: 'sm', color: T.value, weight: 'bold', flex: 3, align: 'end' }
    ]
  };

  // Helper: build a single bubble body
  function makeBubbleBody(bodyContents) {
    return {
      type: 'bubble', size: 'mega',
      header: headerBox,
      body: { type: 'box', layout: 'vertical', contents: [ticketRow, ...bodyContents], backgroundColor: T.bodyBg, paddingAll: '16px' }
    };
  }

  let bubbles = [];

  if (count === 0) {
    // Only before image
    if (!beforeUrl) return [];
    bubbles.push(makeBubbleBody([{
      type: 'box', layout: 'vertical', margin: 'md', cornerRadius: '6px',
      action: { type: 'uri', label: 'ดูรูป', uri: beforeUrl },
      contents: [
        { type: 'image', url: beforeUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover', gravity: 'center' },
        { type: 'text', text: '\u23F0 ก่อนดำเนินการ', size: 'xs', color: T.label, align: 'center', margin: 'xs' }
      ]
    }]));
  } else if (count === 1) {
    // Before + 1 After — side by side
    const row = beforeUrl
      ? { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [imgBox(beforeUrl, '\u23F0 ก่อน', T.label, 1), imgBox(afterUrls[0], '\u2705 หลัง 1', '#34d399', 1)] }
      : { type: 'box', layout: 'vertical', margin: 'md', cornerRadius: '6px', action: { type: 'uri', label: 'ดูรูป', uri: afterUrls[0] }, contents: [{ type: 'image', url: afterUrls[0], size: 'full', aspectRatio: '20:13', aspectMode: 'cover', gravity: 'center' }, { type: 'text', text: '\u2705 หลังดำเนินการ', size: 'xs', color: '#34d399', align: 'center', margin: 'xs' }] };
    bubbles.push(makeBubbleBody([row]));
  } else if (count === 2) {
    // Before wide + 2 Afters side by side
    const rows = [];
    if (beforeUrl) rows.push({ type: 'box', layout: 'vertical', margin: 'md', cornerRadius: '6px', action: { type: 'uri', label: 'ดูรูป', uri: beforeUrl }, contents: [{ type: 'image', url: beforeUrl, size: 'full', aspectRatio: '20:9', aspectMode: 'cover', gravity: 'center' }, { type: 'text', text: '\u23F0 ก่อนดำเนินการ', size: 'xxs', color: T.label, align: 'center', margin: 'xs' }] });
    rows.push({ type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [imgBox(afterUrls[0], '\u2705 หลัง 1', '#34d399', 1), imgBox(afterUrls[1], '\u2705 หลัง 2', '#34d399', 1)] });
    bubbles.push(makeBubbleBody(rows));
  } else {
    // 3-5 afters: Bubble 1 = before + first 2 afters, then extra bubbles
    const rows1 = [];
    if (beforeUrl) rows1.push({ type: 'box', layout: 'vertical', margin: 'md', cornerRadius: '6px', action: { type: 'uri', label: 'ดูรูป', uri: beforeUrl }, contents: [{ type: 'image', url: beforeUrl, size: 'full', aspectRatio: '20:9', aspectMode: 'cover', gravity: 'center' }, { type: 'text', text: '\u23F0 ก่อนดำเนินการ', size: 'xxs', color: T.label, align: 'center', margin: 'xs' }] });
    rows1.push({ type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [imgBox(afterUrls[0], '\u2705 หลัง 1', '#34d399', 1), imgBox(afterUrls[1], '\u2705 หลัง 2', '#34d399', 1)] });
    bubbles.push(makeBubbleBody(rows1));
    // Extra afters in pairs
    for (let i = 2; i < count; i += 2) {
      const pair = [imgBox(afterUrls[i], '\u2705 หลัง ' + (i + 1), '#34d399', 1)];
      if (afterUrls[i + 1]) pair.push(imgBox(afterUrls[i + 1], '\u2705 หลัง ' + (i + 2), '#34d399', 1));
      bubbles.push(makeBubbleBody([{ type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: pair }]));
    }
  }

  if (bubbles.length === 0) return [];
  if (bubbles.length === 1) {
    return [{ type: 'flex', altText: '\uD83D\uDCF7 รูปก่อน-หลัง — ' + ticket.ticketId, contents: bubbles[0] }];
  }
  // Multiple bubbles → carousel
  return [{ type: 'flex', altText: '\uD83D\uDCF7 รูปก่อน-หลัง — ' + ticket.ticketId, contents: { type: 'carousel', contents: bubbles } }];
}

// ── notifyNewTicket ──────────────────────────────────────────
function notifyNewTicket(ticket) {
  const urgencyLabel =
    ticket.urgency === 'urgent' ? '\uD83D\uDD34 เร่งด่วน' :
      ticket.urgency === 'medium' ? '\uD83D\uDFE1 ปานกลาง' : '\uD83D\uDFE2 ปกติ';

  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const adminBubble = makeBubble({
    headerBg: T.headerBg2,
    headerTitle: '\uD83C\uDD95 มีเรื่องร้องเรียนใหม่!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\u26A0\uFE0F', label: 'รายละเอียด', value: (ticket.description || '-').slice(0, 60) + ((ticket.description || '').length > 60 ? '...' : '') },
      { icon: '\u23F1\uFE0F', label: 'ความเร่งด่วน', value: urgencyLabel },
      { icon: '\uD83D\uDC64', label: 'ผู้แจ้ง', value: ticket.citizenName || '-' }
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 เข้าระบบมอบหมายงาน', url: BASE_URL, style: 'primary', color: T.btnBlue }] : []
  });

  const citizenBubble = makeBubble({
    headerBg: T.headerBg2,
    headerTitle: '\u2705 รับเรื่องเรียบร้อยแล้ว!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket ID', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\u23F1\uFE0F', label: 'ความเร่งด่วน', value: urgencyLabel }
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ติดตามสถานะ', url: trackLink, style: 'primary', color: T.btnBlue }] : []
  });

  return pushAll(
    ticket.citizenLineId,
    [flexMsg('\uD83C\uDD95 มีเรื่องร้องเรียนใหม่ — ' + ticket.ticketId, adminBubble)],
    [flexMsg('\u2705 เราได้รับเรื่องของคุณแล้ว — ' + ticket.ticketId, citizenBubble)]
  );
}

// ── notifyAssigned ─── (ปิดการแจ้งเตือน — ไม่ส่งข้อความเมื่อมีช่างรับงาน) ──
async function notifyAssigned() { }

// ── notifyInProgress ─────────────────────────────────────────
function notifyInProgress(ticket) {
  const techName = ticket.assignedName || 'ยังไม่ได้ระบุ';

  const adminBubble = makeBubble({
    headerBg: T.hProg,
    headerTitle: '\u2699\uFE0F เริ่มดำเนินการแล้ว',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้ดำเนินการ', value: techName },
      { icon: '\uD83D\uDD28', label: 'สถานะ', value: 'กำลังดำเนินการแก้ไข' }
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 ดูในระบบ', url: BASE_URL, style: 'primary', color: T.btnBlue }] : []
  });

  const citizenBubble = makeBubble({
    headerBg: T.hProg,
    headerTitle: '\u2699\uFE0F ช่างเริ่มดำเนินการแล้ว!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้ดำเนินการ', value: techName },
      { icon: '\uD83D\uDD28', label: 'สถานะ', value: 'กำลังแก้ไข กรุณารอสักครู่...' }
    ],
    footerBtns: []
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

  // ── รูปภาพก่อน-หลัง ──────────────────────────────────────
  const beforeUrl = normalizeUrl(ticket.beforeImage);
  // รวบ afterImages[] (ใหม่) + afterImage (backward compat)
  const rawAfters = (ticket.afterImages && ticket.afterImages.length)
    ? ticket.afterImages
    : (ticket.afterImage ? [ticket.afterImage] : []);
  const afterUrls = rawAfters.map(normalizeUrl).filter(Boolean);

  // Admin bubble + adaptive image carousel
  const adminBubble = makeBubble({
    headerBg: T.hDone,
    headerTitle: '\u2705 ดำเนินการเสร็จสิ้นแล้ว!',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC77', label: 'ช่างผู้ดำเนินการ', value: techName },
      { icon: '\uD83D\uDC64', label: 'ผู้แจ้ง', value: ticket.citizenName || '-' },
      { icon: '\uD83D\uDD50', label: 'เสร็จเมื่อ', value: now },
      { icon: '\uD83D\uDCF7', label: 'รูปหลังซ่อม', value: afterUrls.length + ' รูป' }
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 ดูในระบบ', url: BASE_URL, style: 'primary', color: T.btnBlue }] : []
  });

  const imageCard = (beforeUrl || afterUrls.length > 0)
    ? makeImageCards(ticket, beforeUrl, afterUrls)
    : [];

  // ── LIFF URLs สำหรับปุ่มดาว ──────────────────────────────
  const LIFF_ID = process.env.LINE_LIFF_ID || '';
  const encodedTicketId = encodeURIComponent(ticket.ticketId);
  const encodedLineUserId = encodeURIComponent(ticket.citizenLineId || '');

  function makeLiffUrl(rating) {
    const base = LIFF_ID
      ? 'https://liff.line.me/' + LIFF_ID
      : BASE_URL + '/liff-rating';
    return base + '?ticketId=' + encodedTicketId +
      '&lineUserId=' + encodedLineUserId +
      (rating ? '&rating=' + rating : '');
  }

  // ── imageBodyRows — แทรกรูปใน citizen card (adaptive) ──────
  // Layout: 1 after = side-by-side with before | 2+ = before wide + pairs
  const imageBodyRows = [];
  if (beforeUrl || afterUrls.length > 0) {
    imageBodyRows.push({ type: 'separator', margin: 'lg', color: T.sep });
    if (afterUrls.length === 0 && beforeUrl) {
      // only before
      imageBodyRows.push({ type: 'box', layout: 'vertical', margin: 'md', cornerRadius: '6px', action: { type: 'uri', label: 'ดูรูป', uri: beforeUrl }, contents: [{ type: 'image', url: beforeUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover', gravity: 'center' }, { type: 'text', text: '\u23F0 ก่อนดำเนินการ', size: 'xs', color: T.label, align: 'center', margin: 'xs' }] });
    } else if (afterUrls.length === 1) {
      // 1 after: side-by-side
      if (beforeUrl) {
        imageBodyRows.push({ type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [imgBox(beforeUrl, '\u23F0 ก่อน', T.label, 1), imgBox(afterUrls[0], '\u2705 หลัง', '#34d399', 1)] });
      } else {
        imageBodyRows.push({ type: 'box', layout: 'vertical', margin: 'md', cornerRadius: '6px', action: { type: 'uri', label: 'ดูรูป', uri: afterUrls[0] }, contents: [{ type: 'image', url: afterUrls[0], size: 'full', aspectRatio: '20:13', aspectMode: 'cover', gravity: 'center' }, { type: 'text', text: '\u2705 หลังดำเนินการ', size: 'xs', color: '#34d399', align: 'center', margin: 'xs' }] });
      }
    } else {
      // 2+ afters: before wide, then pairs
      if (beforeUrl) imageBodyRows.push({ type: 'box', layout: 'vertical', margin: 'md', cornerRadius: '6px', action: { type: 'uri', label: 'ดูรูป', uri: beforeUrl }, contents: [{ type: 'image', url: beforeUrl, size: 'full', aspectRatio: '20:9', aspectMode: 'cover', gravity: 'center' }, { type: 'text', text: '\u23F0 ก่อนดำเนินการ', size: 'xxs', color: T.label, align: 'center', margin: 'xs' }] });
      for (let i = 0; i < afterUrls.length; i += 2) {
        const pair = [imgBox(afterUrls[i], '\u2705 หลัง ' + (i + 1), '#34d399', 1)];
        if (afterUrls[i + 1]) pair.push(imgBox(afterUrls[i + 1], '\u2705 หลัง ' + (i + 2), '#34d399', 1));
        imageBodyRows.push({ type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm', contents: pair });
      }
    }
  }


  const citizenMessages = [];

  if (LIFF_ID || BASE_URL) {
    citizenMessages.push({
      type: 'flex',
      altText: '\uD83C\uDF89 เรื่องร้องเรียน ' + ticket.ticketId + ' ได้รับการแก้ไขแล้ว! กดดาวเพื่อประเมินการบริการได้เลย',
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            brandRow(),
            { type: 'text', text: '\uD83C\uDF89 งานเสร็จสิ้นแล้ว!', size: 'xl', weight: 'bold', color: T.title, margin: 'sm' }
          ],
          backgroundColor: T.hDone,
          paddingAll: '20px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box', layout: 'horizontal', margin: 'md', contents: [
                { type: 'text', text: '\uD83D\uDCCB Ticket', size: 'sm', color: T.label, flex: 2 },
                { type: 'text', text: ticket.ticketId, size: 'sm', color: T.value, weight: 'bold', flex: 3, align: 'end' }
              ]
            },
            {
              type: 'box', layout: 'horizontal', margin: 'sm', contents: [
                { type: 'text', text: '\uD83D\uDCCD สถานที่', size: 'sm', color: T.label, flex: 2 },
                { type: 'text', text: ticket.location || '-', size: 'sm', color: T.value, flex: 3, align: 'end', wrap: true }
              ]
            },
            {
              type: 'box', layout: 'horizontal', margin: 'sm', contents: [
                { type: 'text', text: '\uD83D\uDC77 ช่าง', size: 'sm', color: T.label, flex: 2 },
                { type: 'text', text: techName, size: 'sm', color: T.value, flex: 3, align: 'end' }
              ]
            },
            {
              type: 'box', layout: 'horizontal', margin: 'sm', contents: [
                { type: 'text', text: '\uD83D\uDD50 เสร็จเมื่อ', size: 'sm', color: T.label, flex: 2 },
                { type: 'text', text: now, size: 'sm', color: T.value, flex: 3, align: 'end', wrap: true }
              ]
            },
            // ── รูปก่อน-หลัง (ถ้ามี) ──────────────────────────
            ...imageBodyRows,
            // ── ส่วนให้คะแนน ───────────────────────────────────
            { type: 'separator', margin: 'lg', color: T.sep },
            { type: 'text', text: '\u2B50 กดดาวเพื่อให้คะแนนการบริการ', size: 'md', weight: 'bold', color: T.value, margin: 'lg', align: 'center' },
            { type: 'text', text: 'กดที่ดาวที่ด้านล่างได้เลย — ยืนยันในหน้าถัดไป', size: 'xs', color: T.label, align: 'center', margin: 'xs' }
          ],
          backgroundColor: T.bodyBg,
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
                color: n === 5 ? T.btnGold5 : T.btnGold,
                height: 'sm',
                flex: 1
              }))
            }
          ],
          backgroundColor: T.footerBg,
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
        headerBg: T.hDone,
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

  const tasks = [];
  if (ADMIN_ID) {
    tasks.push(pushTo(ADMIN_ID, [flexMsg('\u2705 เสร็จสิ้น — ' + ticket.ticketId, adminBubble), ...imageCard]));
  }
  // Citizen: การ์ดเดียว — รูปและดาวอยู่รวมกันแล้ว
  if (ticket.citizenLineId && ticket.citizenLineId !== ADMIN_ID) {
    tasks.push(pushTo(ticket.citizenLineId, citizenMessages));
  }

  await Promise.all(tasks);
}

// ── notifyRejected ───────────────────────────────────────────
function notifyRejected(ticket, reason) {
  const trackLink = BASE_URL ? BASE_URL + '/track.html?id=' + ticket.ticketId : '';

  const adminBubble = makeBubble({
    headerBg: T.hReject,
    headerTitle: '\u274C ปฏิเสธการรับงาน',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDC64', label: 'ผู้แจ้ง', value: ticket.citizenName || '-' },
      ...(reason ? [{ icon: '\uD83D\uDCDD', label: 'เหตุผล', value: reason }] : [])
    ],
    footerBtns: BASE_URL ? [{ label: '\uD83D\uDD17 ตรวจสอบในระบบ', url: BASE_URL, style: 'primary', color: T.btnRed }] : []
  });

  const citizenBubble = makeBubble({
    headerBg: T.hReject,
    headerTitle: '\u274C ขออภัย เรื่องถูกปฏิเสธ',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      ...(reason ? [{ icon: '\uD83D\uDCDD', label: 'เหตุผล', value: reason }] : [])
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ดูรายละเอียด', url: trackLink, style: 'primary', color: T.btnRed }] : []
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
    headerBg: T.hFollow,
    headerTitle: '\uD83D\uDD14 Ticket ที่คุณติดตามมีการอัปเดต',
    rows: [
      { icon: '\uD83D\uDCCB', label: 'Ticket', value: ticket.ticketId },
      { icon: '\uD83D\uDCCD', label: 'สถานที่', value: ticket.location || '-' },
      { icon: '\uD83D\uDCCA', label: 'สถานะใหม่', value: statusLabel }
    ],
    footerBtns: trackLink ? [{ label: '\uD83D\uDD0D ติดตามสถานะ', url: trackLink, style: 'primary', color: T.btnBlue }] : []
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
