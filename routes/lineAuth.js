// ─── routes/lineAuth.js ───────────────────────────────────────
// LINE Login OAuth 2.0 flow
// Env required: LINE_LOGIN_CLIENT_ID, LINE_LOGIN_CLIENT_SECRET,
//               LINE_LOGIN_CALLBACK_URL, BASE_URL

const express = require('express');
const https   = require('https');
const router  = express.Router();
const { users } = require('../data/store');

const CLIENT_ID     = process.env.LINE_LOGIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINE_LOGIN_CLIENT_SECRET;
const CALLBACK_URL  = process.env.LINE_LOGIN_CALLBACK_URL ||
                      (process.env.BASE_URL || 'http://localhost:3000') + '/auth/line/callback';

// ── helper: HTTPS POST with JSON body ────────────────────────
function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const req = https.request({
      hostname, path, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── helper: HTTPS GET with Authorization header ───────────────
function httpsGet(hostname, path, token) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers: { Authorization: 'Bearer ' + token } }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    }).on('error', reject);
  });
}

// ── GET /auth/line → redirect to LINE Login ───────────────────
router.get('/', (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).send('LINE_LOGIN_CLIENT_ID ไม่ได้ตั้งค่า');
  }
  const state = Math.random().toString(36).slice(2, 12);
  req.session.lineState = state;

  const url = 'https://access.line.me/oauth2/v2.1/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  CALLBACK_URL,
    state,
    scope:         'profile openid',
    bot_prompt:    'aggressive'   // ขอให้ user Add Friend bot ด้วย
  });
  res.redirect(url);
});

// ── GET /auth/line/callback → แลก code → บันทึก user ─────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[LINE Login] error:', error);
    return res.redirect('/?line_error=cancelled');
  }

  if (!code || state !== req.session.lineState) {
    return res.redirect('/?line_error=invalid_state');
  }
  delete req.session.lineState;

  try {
    // 1. แลก authorization code เป็น access token
    const tokenRes = await httpsPost('api.line.me', '/oauth2/v2.1/token', {
      grant_type:    'authorization_code',
      code,
      redirect_uri:  CALLBACK_URL,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    if (!tokenRes.access_token) {
      console.error('[LINE Login] token error:', tokenRes);
      return res.redirect('/?line_error=token_failed');
    }

    // 2. ดึงข้อมูล profile จาก LINE
    const profile = await httpsGet('api.line.me', '/v2/profile', tokenRes.access_token);
    const { userId: lineUserId, displayName, pictureUrl } = profile;

    if (!lineUserId) {
      return res.redirect('/?line_error=profile_failed');
    }

    // 3. หา user ที่มี lineUserId นี้แล้ว
    let user = users.find(u => u.lineUserId === lineUserId);

    if (!user) {
      // สร้าง user ใหม่ (role = citizen) จาก LINE profile
      const nameParts = displayName.split(' ');
      user = {
        id:          users.length + 1,
        firstName:   nameParts[0] || displayName,
        lastName:    nameParts.slice(1).join(' ') || '',
        email:       'line_' + lineUserId + '@line.me',  // placeholder email
        password:    null,   // ไม่มี password (login ผ่าน LINE อย่างเดียว)
        role:        'citizen',
        specialty:   null,
        lineUserId,
        linePicture: pictureUrl || null,
        createdAt:   new Date().toISOString()
      };
      users.push(user);
      console.log('[LINE Login] สร้าง citizen ใหม่:', user.firstName, user.lastName, lineUserId);
    } else {
      // อัปเดต pictureUrl
      user.linePicture = pictureUrl || user.linePicture;
    }

    // 4. เริ่ม session
    req.session.userId = user.id;
    req.session.role   = user.role;

    res.redirect('/');
  } catch (e) {
    console.error('[LINE Login] callback error:', e);
    res.redirect('/?line_error=server_error');
  }
});

module.exports = router;
