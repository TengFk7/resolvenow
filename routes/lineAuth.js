// ─── routes/lineAuth.js ───────────────────────────────────────
// LINE Login OAuth 2.0 flow
const express = require('express');
const https = require('https');
const router = express.Router();
const User = require('../models/User');

const CLIENT_ID = process.env.LINE_LOGIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINE_LOGIN_CLIENT_SECRET;
const CALLBACK_URL = process.env.LINE_LOGIN_CALLBACK_URL ||
  (process.env.BASE_URL || 'http://localhost:3000') + '/auth/line/callback';

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
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, path, token) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers: { Authorization: 'Bearer ' + token } }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    }).on('error', reject);
  });
}

// GET /auth/line → redirect to LINE Login
router.get('/', (req, res) => {
  if (!CLIENT_ID) return res.status(500).send('LINE_LOGIN_CLIENT_ID ไม่ได้ตั้งค่า');
  const state = Math.random().toString(36).slice(2, 12);
  req.session.lineState = state;
  const url = 'https://access.line.me/oauth2/v2.1/authorize?' + new URLSearchParams({
    response_type: 'code', client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL, state, scope: 'profile openid', bot_prompt: 'aggressive'
  });
  req.session.save((err) => {
    if (err) console.error('[LINE Login] session save error on auth init:', err);
    res.redirect(url);
  });
});

// GET /auth/line/callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/?line_error=cancelled');
  if (!code || state !== req.session.lineState) return res.redirect('/?line_error=invalid_state');
  delete req.session.lineState;

  try {
    const tokenRes = await httpsPost('api.line.me', '/oauth2/v2.1/token', {
      grant_type: 'authorization_code', code,
      redirect_uri: CALLBACK_URL, client_id: CLIENT_ID, client_secret: CLIENT_SECRET
    });
    if (!tokenRes.access_token) return res.redirect('/?line_error=token_failed');

    const profile = await httpsGet('api.line.me', '/v2/profile', tokenRes.access_token);
    const { userId: lineUserId, displayName, pictureUrl } = profile;
    if (!lineUserId) return res.redirect('/?line_error=profile_failed');

    // หา user ที่มี lineUserId นี้
    let user = await User.findOne({ lineUserId });
    if (!user) {
      // LINE user ใหม่ — เก็บ pending ไว้ใน session แล้วให้ frontend แสดง modal เชื่อมบัญชี
      req.session.lineLinkPending = {
        lineUserId,
        lineDisplayName: displayName,
        lineAvatar: pictureUrl || null
      };
      console.log('[LINE Login] LINE user ใหม่ → pending link:', displayName, lineUserId);
      return req.session.save((err) => {
        if (err) console.error('[LINE Login] session save error on pending:', err);
        res.redirect('/?line_link=pending');
      });
    }

    // เจอ user แล้ว → อัปเดต avatar + เข้าระบบทันที
    user.avatar = pictureUrl || user.avatar;
    user.lineDisplayName = displayName;
    await user.save();

    req.session.userId = user._id.toString();
    req.session.role = user.role;
    req.session.save((err) => {
      if (err) console.error('[LINE Login] session save error on login:', err);
      res.redirect('/?line_login=success');
    });
  } catch (e) {
    console.error('[LINE Login] callback error:', e.message || e);
    console.error('[LINE Login] stack:', e.stack || '(no stack)');
    res.redirect('/?line_error=server_error');
  }
});

module.exports = router;
