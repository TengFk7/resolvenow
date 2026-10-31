/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── config/lineBotService.js ──────────────────────────────────
// จัดการการติดต่อ LINE Messaging API สำหรับ Webhook Reply และ Flex Message

const https = require('https');
const crypto = require('crypto');

const TOKEN = process.env.LINE_CHANNEL_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

// ── Design Tokens (Theme Navy/Blue/Gold) ────────────────────────
const T = {
  headerBg: '#07111f',
  headerBg2: '#0c1e3a',
  bodyBg: '#0a1628',
  footerBg: '#0a1628',
  brand: '#fbbf24',          // gold
  title: '#ffffff',
  label: '#6b8aad',          // steel-blue muted
  value: '#e2eeff',          // near-white blue-tint
  sep: '#1e3a6e',            // navy border
  btnBlue: '#2563eb',
  btnGold: '#f59e0b',
  btnGreen: '#10b981',
  btnRed: '#ef4444',
  textMuted: '#94a3b8'
};

/**
 * ตรวจสอบความถูกต้องของ Signature จาก LINE (HMAC-SHA256)
 * @param {Buffer|string} rawBody 
 * @param {string} signature 
 * @param {string} [secret] 
 * @returns {boolean}
 */
function validateLineSignature(rawBody, signature, secret = CHANNEL_SECRET) {
  if (!signature) return false;
  if (!secret) {
    // หากยังไม่ได้กำหนด CHANNEL_SECRET ให้ยอมรับ Request พร้อมแจ้งเตือนใน Log เพื่อให้บอททำงานได้
    console.warn('[LINE Bot] Notice: LINE_CHANNEL_SECRET is not configured. Allowing webhook event for bot operation.');
    return true;
  }

  try {
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');
    const hash = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('base64');
    const sigBuffer = Buffer.from(signature, 'utf8');
    const hashBuffer = Buffer.from(hash, 'utf8');
    if (sigBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, hashBuffer);
  } catch (err) {
    console.error('[LINE Bot] Signature verification error:', err.message);
    return false;
  }
}

/**
 * ส่งข้อความตอบกลับด้วย Reply Token (LINE Messaging API)
 * @param {string} replyToken 
 * @param {Array<Object>|Object|string} messages 
 * @returns {Promise<{success: boolean, statusCode: number, error?: string}>}
 */
async function replyLineMessage(replyToken, messages) {
  if (!TOKEN || !replyToken) {
    console.warn('[LINE Bot] Cannot reply: TOKEN or replyToken is missing.');
    return { success: false, statusCode: 0, error: 'TOKEN or replyToken missing' };
  }

  let formattedMessages = [];
  if (typeof messages === 'string') {
    formattedMessages = [{ type: 'text', text: messages }];
  } else if (Array.isArray(messages)) {
    formattedMessages = messages.map(m => (typeof m === 'string' ? { type: 'text', text: m } : m));
  } else if (typeof messages === 'object') {
    formattedMessages = [messages];
  }

  // LINE จำกัดสูงสุด 5 messages ต่อ reply token
  formattedMessages = formattedMessages.slice(0, 5);

  const body = JSON.stringify({
    replyToken,
    messages: formattedMessages
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    }, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('[LINE Bot] Reply sent successfully (200 OK)');
          resolve({ success: true, statusCode: 200 });
        } else {
          console.error('[LINE Bot] Reply failed status:', res.statusCode, data);
          resolve({ success: false, statusCode: res.statusCode, error: data });
        }
      });
    });

    req.on('error', (e) => {
      console.error('[LINE Bot] Reply network error:', e.message);
      resolve({ success: false, statusCode: 0, error: e.message });
    });

    req.write(body);
    req.end();
  });
}

/**
 * แปลงสถานะตั๋วเป็นข้อความและสีภาษาไทย
 */
function getStatusMeta(status) {
  switch (status) {
    case 'in_progress':
      return { text: 'กำลังดำเนินการ', color: '#f59e0b', icon: '⚙️' };
    case 'completed':
      return { text: 'แก้ไขเสร็จสิ้น', color: '#10b981', icon: '✅' };
    case 'transferred':
      return { text: 'ส่งต่อหน่วยงานภายนอก', color: '#a855f7', icon: '↗️' };
    case 'rejected':
      return { text: 'ปฏิเสธเรื่องร้องเรียน', color: '#ef4444', icon: '❌' };
    case 'pending':
    default:
      return { text: 'รอเจ้าหน้าที่รับเรื่อง', color: '#3b82f6', icon: '⏳' };
  }
}

/**
 * สร้าง Flex Message แสดงผลตั๋วร้องเรียน (Navy / Gold Theme)
 * @param {Object} ticket 
 * @param {string} [baseUrl] 
 * @returns {Object} LINE Flex Message Object
 */
function buildTicketFlexMessage(ticket, baseUrl = BASE_URL) {
  const meta = getStatusMeta(ticket.status);
  const dateStr = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';

  const trackUrl = `${baseUrl}/track?ticketId=${encodeURIComponent(ticket.ticketId)}`;
  const myTicketsUrl = `${baseUrl}/my-tickets`;

  const urgencyLabel = {
    urgent: '🔴 เร่งด่วนมาก (Urgent)',
    medium: '🟡 ปานกลาง (Medium)',
    normal: '🟢 ทั่วไป (Normal)'
  }[ticket.urgency] || '🟢 ทั่วไป';

  return {
    type: 'flex',
    altText: `สถานะเรื่องร้องเรียน ${ticket.ticketId}: ${meta.text}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.headerBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🏛️ ResolveNow',
                size: 'xs',
                color: T.brand,
                weight: 'bold'
              },
              {
                type: 'text',
                text: ticket.ticketId,
                size: 'xs',
                color: T.textMuted,
                align: 'end',
                weight: 'bold'
              }
            ]
          },
          {
            type: 'text',
            text: `${meta.icon} ${meta.text}`,
            weight: 'bold',
            size: 'lg',
            color: meta.color,
            margin: 'sm'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.bodyBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: ticket.description ? (ticket.description.length > 90 ? ticket.description.substring(0, 90) + '...' : ticket.description) : 'ไม่มีรายละเอียด',
            weight: 'bold',
            size: 'sm',
            color: T.title,
            wrap: true,
            margin: 'xs'
          },
          {
            type: 'separator',
            margin: 'md',
            color: T.sep
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'หมวดหมู่:', size: 'xs', color: T.label, flex: 3 },
                  { type: 'text', text: ticket.category || 'ทั่วไป', size: 'xs', color: T.value, flex: 5, align: 'end', weight: 'bold' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ความเร่งด่วน:', size: 'xs', color: T.label, flex: 3 },
                  { type: 'text', text: urgencyLabel, size: 'xs', color: T.value, flex: 5, align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'วันที่แจ้ง:', size: 'xs', color: T.label, flex: 3 },
                  { type: 'text', text: dateStr, size: 'xs', color: T.value, flex: 5, align: 'end' }
                ]
              },
              ticket.location ? {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'สถานที่:', size: 'xs', color: T.label, flex: 3 },
                  { type: 'text', text: ticket.location.length > 30 ? ticket.location.substring(0, 30) + '...' : ticket.location, size: 'xs', color: T.value, flex: 5, align: 'end', wrap: true }
                ]
              } : null
            ].filter(Boolean)
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.footerBg,
        paddingAll: '14px',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: T.btnBlue,
            height: 'sm',
            action: {
              type: 'uri',
              label: '🔎 ดูรายละเอียดและสถานะสด',
              uri: trackUrl
            }
          },
          {
            type: 'button',
            style: 'link',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📂 ดูเรื่องร้องเรียนทั้งหมดของฉัน',
              uri: myTicketsUrl
            }
          }
        ]
      }
    }
  };
}

/**
 * ข้อความแจ้งเตือนกรณีผู้ใช้ไม่มีสิทธิ์ดูตั๋ว (ไม่ใช่เจ้าของ หรือยังไม่ผูกบัญชี LINE) ตามกฎหมาย PDPA
 */
function buildUnauthorizedMessage(ticketId, baseUrl = BASE_URL) {
  return [
    {
      type: 'text',
      text: `🔒 ขออภัยครับ ไม่สามารถแสดงข้อมูลเรื่อง ${ticketId} ได้\n\nเนื่องจากบัญชี LINE นี้ไม่ใช่ผู้แจ้งเรื่องดังกล่าว เพื่อความปลอดภัยและความเป็นส่วนตัวของข้อมูลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)`
    },
    {
      type: 'text',
      text: `💡 หากคุณแจ้งเรื่องนี้ผ่านเว็บไซต์ไว้ กรุณาเข้าสู่ระบบผ่านเว็บไซต์เพื่อตรวจสอบ หรือเข้าสู่ระบบด้วย LINE เพื่อเชื่อมโยงบัญชีครับ:\n👉 ${baseUrl}/track?ticketId=${encodeURIComponent(ticketId)}`
    }
  ];
}

/**
 * ข้อความแจ้งเตือนเมื่อไม่พบเรื่องร้องเรียนที่ผูกกับบัญชี LINE นี้
 */
function buildNoTicketsMessage(baseUrl = BASE_URL) {
  return [
    {
      type: 'text',
      text: '📋 ไม่พบเรื่องร้องเรียนที่ผูกกับบัญชี LINE ของคุณในขณะนี้ครับ\n\nหากคุณต้องการแจ้งเรื่องใหม่ หรือเข้าดูเรื่องที่แจ้งผ่านเว็บไซต์ สามารถคลิกที่ลิงก์ด้านล่างได้เลยครับ:'
    },
    {
      type: 'text',
      text: `✨ แจ้งเรื่องร้องเรียนใหม่: ${baseUrl}\n🔍 ค้นหาด้วยรหัสตั๋ว: ${baseUrl}/track`
    }
  ];
}

/**
 * ดึงข้อมูลโปรไฟล์ผู้ใช้งาน LINE จาก LINE Messaging API
 * @param {string} lineUserId 
 * @returns {Promise<{displayName: string, pictureUrl: string|null}|null>}
 */
async function getLineUserProfile(lineUserId) {
  if (!TOKEN || !lineUserId) return null;

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.line.me',
      path: `/v2/bot/profile/${encodeURIComponent(lineUserId)}`,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + TOKEN
      }
    }, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve({
              displayName: parsed.displayName || 'ผู้ใช้งาน LINE',
              pictureUrl: parsed.pictureUrl || null
            });
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * สร้าง Flex Message: Smart Service Navigator (การ์ดนำทางบริการประชาชน)
 * @param {string} [baseUrl] 
 * @returns {Object} LINE Flex Message Object
 */
function buildServiceNavigatorFlexMessage(baseUrl = BASE_URL) {
  return {
    type: 'flex',
    altText: '🏛️ ResolveNow Service Hub — เมนูบริการประชาชนอัจฉริยะ',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.headerBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🏛️ ResolveNow Service Hub',
            size: 'xs',
            color: T.brand,
            weight: 'bold'
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่ระบบบริการประชาชน',
            weight: 'bold',
            size: 'md',
            color: T.title,
            margin: 'sm'
          },
          {
            type: 'text',
            text: 'เลือกบริการที่ต้องการ หรือพิมพ์สอบถามกับ AI ได้ตลอด 24 ชม.',
            size: 'xs',
            color: T.textMuted,
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.bodyBg,
        paddingAll: '16px',
        spacing: 'md',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: T.btnBlue,
            height: 'sm',
            action: {
              type: 'uri',
              label: '📝 1. แจ้งเรื่องร้องเรียนใหม่',
              uri: baseUrl
            }
          },
          {
            type: 'button',
            style: 'primary',
            color: T.btnGold,
            height: 'sm',
            action: {
              type: 'message',
              label: '🔍 2. เช็คสถานะเรื่องของฉัน',
              text: 'เรื่องของฉัน'
            }
          },
          {
            type: 'button',
            style: 'primary',
            color: T.btnGreen,
            height: 'sm',
            action: {
              type: 'message',
              label: '💬 3. ติดต่อเจ้าหน้าที่ / ส่งเรื่อง',
              text: 'ติดต่อเจ้าหน้าที่'
            }
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.footerBg,
        paddingAll: '12px',
        contents: [
          {
            type: 'text',
            text: '💡 ทิป: สามารถพิมพ์สอบถามปัญหา หรือพิมพ์เลขตั๋ว TKT-xxxxx ได้ทันทีครับ',
            size: 'xxs',
            color: T.textMuted,
            wrap: true,
            align: 'center'
          }
        ]
      }
    }
  };
}

/**
 * ส่ง Push Message ตอบกลับจากแอดมินไปยังแชต LINE ของประชาชน
 * @param {string} lineUserId 
 * @param {string} adminName 
 * @param {string} replyText 
 * @param {string} [baseUrl] 
 * @returns {Promise<{success: boolean, statusCode: number, error?: string}>}
 */
async function pushAdminReplyToCitizen(lineUserId, adminName, replyText, baseUrl = BASE_URL) {
  if (!TOKEN || !lineUserId || !replyText) {
    return { success: false, statusCode: 0, error: 'Missing parameters' };
  }

  const dateStr = new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const flexMessage = {
    type: 'flex',
    altText: `💬 ข้อความตอบกลับจากเจ้าหน้าที่: ${adminName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.headerBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🏛️ ResolveNow Admin',
                size: 'xs',
                color: T.brand,
                weight: 'bold'
              },
              {
                type: 'text',
                text: dateStr,
                size: 'xs',
                color: T.textMuted,
                align: 'end'
              }
            ]
          },
          {
            type: 'text',
            text: `💬 ตอบกลับจาก ${adminName || 'เจ้าหน้าที่แอดมิน'}`,
            weight: 'bold',
            size: 'md',
            color: T.title,
            margin: 'sm'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.bodyBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: replyText,
            color: T.value,
            size: 'sm',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.footerBg,
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            style: 'link',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🌐 เปิดเว็บไซต์ ResolveNow',
              uri: baseUrl
            }
          }
        ]
      }
    }
  };

  const body = JSON.stringify({
    to: lineUserId,
    messages: [flexMessage]
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    }, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('[LINE Bot] Push admin reply succeeded to', lineUserId);
          resolve({ success: true, statusCode: 200 });
        } else {
          console.error('[LINE Bot] Push admin reply failed:', res.statusCode, data);
          resolve({ success: false, statusCode: res.statusCode, error: data });
        }
      });
    });

    req.on('error', (e) => {
      console.error('[LINE Bot] Push admin reply error:', e.message);
      resolve({ success: false, statusCode: 0, error: e.message });
    });

    req.write(body, 'utf8');
    req.end();
  });
}

/**
 * ส่งการแจ้งเตือนเมื่อเจ้าหน้าที่แอดมินกด "จบการสนทนา"
 * @param {string} lineUserId 
 * @param {string} adminName 
 * @param {string} [baseUrl] 
 * @returns {Promise<{success: boolean, statusCode: number, error?: string}>}
 */
async function pushAdminEndChatNotification(lineUserId, adminName, baseUrl = BASE_URL) {
  if (!TOKEN || !lineUserId) return { success: false, statusCode: 0, error: 'Missing parameters' };

  const flexMessage = {
    type: 'flex',
    altText: '✅ การสนทนากับเจ้าหน้าที่เสร็จสิ้นแล้ว',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.headerBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🏛️ ResolveNow Service',
                size: 'xs',
                color: T.brand,
                weight: 'bold'
              }
            ]
          },
          {
            type: 'text',
            text: '✅ สิ้นสุดการสนทนากับเจ้าหน้าที่',
            weight: 'bold',
            size: 'md',
            color: T.btnGreen,
            margin: 'sm'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.bodyBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: `เจ้าหน้าที่ (${adminName || 'Admin'}) ได้ปิดและสรุปการสนทนาเรียบร้อยแล้วครับ ขอบคุณที่ติดต่อ ResolveNow`,
            color: T.value,
            size: 'sm',
            wrap: true
          },
          {
            type: 'separator',
            margin: 'md',
            color: T.sep
          },
          {
            type: 'text',
            text: '🤖 ขณะนี้ระบบได้สลับกลับสู่โหมด AI อัจฉริยะแล้ว คุณสามารถพิมพ์สอบถามการใช้งานระบบ หรือส่งเรื่องร้องเรียนใหม่ได้ตลอด 24 ชม. ครับ',
            color: T.textMuted,
            size: 'xs',
            wrap: true,
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: T.footerBg,
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: T.btnBlue,
            height: 'sm',
            action: {
              type: 'uri',
              label: '🌐 เปิดเว็บไซต์ ResolveNow',
              uri: baseUrl
            }
          }
        ]
      }
    }
  };

  const body = JSON.stringify({
    to: lineUserId,
    messages: [flexMessage]
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    }, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, statusCode: 200 });
        } else {
          resolve({ success: false, statusCode: res.statusCode, error: data });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, statusCode: 0, error: e.message }));
    req.write(body, 'utf8');
    req.end();
  });
}

module.exports = {
  validateLineSignature,
  replyLineMessage,
  buildTicketFlexMessage,
  buildUnauthorizedMessage,
  buildNoTicketsMessage,
  buildServiceNavigatorFlexMessage,
  pushAdminReplyToCitizen,
  pushAdminEndChatNotification,
  getLineUserProfile,
  getStatusMeta
};

