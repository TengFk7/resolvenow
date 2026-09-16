/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

/* ─────────────────────────────────────────────
   public/js/admin-portal.js — Admin Portal Controller
   • Dedicated session management for /admin
   • Role-guarded login (Admin only)
   • Socket.IO integration (real-time admin DM + tickets)
   • Admin UI lifecycle & initialization
   ───────────────────────────────────────────── */

var CU = null;
var currentPage = 'dashboard';
var _adminInterval = null;
var _socketConnected = false;
var _heartbeatTimer = null;
var _pongTimer = null;
var socket = null;

/* ── DOM Helper ──────────────────────────────────────── */
function ge(id) { return document.getElementById(id); }

/* ── Password Visibility Toggle ──────────────────────── */
function togglePassVisibility(inputId, btn) {
  var inp = ge(inputId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = '🙈';
  } else {
    inp.type = 'password';
    btn.textContent = '👁️';
  }
}

/* ── Quick Demo Fill ─────────────────────────────────── */
function quickFillAdminDemo() {
  var em = ge('aEmail'), pw = ge('aPass');
  if (em) em.value = 'admin@resolvenow.th';
  if (pw) pw.value = 'admin1234';
  hideE('adminAuthErr');
}

/* ── Initialize Socket.IO for Admin ──────────────────── */
function initAdminSocket() {
  if (typeof io === 'undefined') return;
  if (socket) return; // already initialized

  socket = io();

  socket.on('connect', function () {
    _socketConnected = true;
    startAdminHeartbeat();
    if (CU && CU.role === 'admin') {
      socket.emit('dm_join', { role: 'admin', userId: CU.id || CU._id });
      if (typeof refreshAdminDmUnread === 'function') refreshAdminDmUnread();
    }
  });

  socket.on('disconnect', function () {
    _socketConnected = false;
    stopAdminHeartbeat();
  });

  socket.on('pong_heartbeat', function () {
    if (_pongTimer) { clearTimeout(_pongTimer); _pongTimer = null; }
  });

  // Ticket changes → reload admin dashboard
  ['ticket_created', 'ticket_updated', 'ticket_assigned', 'ticket_deleted', 'ticket_status_changed'].forEach(function (evt) {
    socket.on(evt, function () {
      if (typeof loadAdmin === 'function') loadAdmin();
    });
  });

  // Direct Message integration
  if (typeof initDirectChatSocket === 'function' && CU) {
    initDirectChatSocket(socket, CU);
  }
}

function startAdminHeartbeat() {
  stopAdminHeartbeat();
  _heartbeatTimer = setInterval(function () {
    if (!_socketConnected || !socket) return;
    socket.emit('ping_heartbeat');
    _pongTimer = setTimeout(function () {
      _socketConnected = false;
      if (typeof loadAdmin === 'function') loadAdmin();
    }, 5000);
  }, 15000);
}

function stopAdminHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_pongTimer) { clearTimeout(_pongTimer); _pongTimer = null; }
}

/* ── Welcome Splash (Admin) ──────────────────────────── */
function showAdminSplash(onDone) {
  var overlay = document.createElement('div');
  overlay.id = 'adminWelcomeSplash';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'background:linear-gradient(160deg,#07111f 0%,#0c1e3a 50%,#101627 100%)',
    'overflow:hidden'
  ].join(';');

  var orbHtml = [
    '<div style="position:absolute;width:500px;height:500px;top:-10%;left:-10%;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.45) 0%,transparent 70%);filter:blur(70px)"></div>',
    '<div style="position:absolute;width:400px;height:400px;bottom:-5%;right:-5%;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,.35) 0%,transparent 70%);filter:blur(70px)"></div>'
  ].join('');

  overlay.innerHTML = [
    orbHtml,
    '<div style="text-align:center;padding:0 32px;position:relative;z-index:2;animation:splashFadeUp .6s ease both">',
    '<div style="font-size:74px;filter:drop-shadow(0 0 28px rgba(245,200,66,.75));margin-bottom:12px">👑</div>',
    '<div style="font-size:13px;letter-spacing:4px;text-transform:uppercase;color:rgba(245,200,66,.9);font-weight:700;margin-bottom:10px">SYSTEM ADMINISTRATOR</div>',
    '<div style="font-size:32px;font-weight:800;color:#fff;font-family:Prompt,sans-serif">ยินดีต้อนรับ Admin</div>',
    '<div style="font-size:14px;color:rgba(255,255,255,.6);margin-top:10px">ระบบบริหารจัดการพร้อมให้บริการ — เข้าสู่ Dashboard</div>',
    '<div style="width:130px;height:3px;border-radius:99px;background:linear-gradient(90deg,#f59e0b,#fbbf24);margin:18px auto 0;box-shadow:0 0 14px rgba(245,158,11,.8)"></div>',
    '</div>'
  ].join('');

  document.body.appendChild(overlay);

  setTimeout(function () {
    overlay.style.transition = 'opacity .5s ease';
    overlay.style.opacity = '0';
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof onDone === 'function') onDone();
    }, 500);
  }, 2200);
}

/* ── Admin Security Gate (Passcode Protection) ───────── */
var ADMIN_GATE_PASSCODE = '@Teng11421142';

function toggleAdminGatePassVisibility() {
  var inp = ge('adminGatePasscode');
  var icon = ge('adminGateEyeIcon');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.textContent = '🙈';
  } else {
    inp.type = 'password';
    if (icon) icon.textContent = '👁️';
  }
}

function showAdminGate() {
  var gate = ge('adminGateModal');
  var card = ge('adminGateCard');
  var authPage = ge('adminAuthPage');
  var appPage = ge('adminApp');
  var inp = ge('adminGatePasscode');
  var err = ge('adminGateErr');
  var btn = ge('btnAdminGateUnlock');

  if (appPage) appPage.style.display = 'none';
  if (authPage) authPage.style.display = 'none';
  if (gate) {
    gate.classList.remove('gate-closing');
    gate.style.display = 'flex';
  }
  if (card) card.classList.remove('gate-shake');
  if (err) err.style.display = 'none';
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span>ปลดล็อคเข้าสู่ระบบ</span> <span>→</span>';
  }
  if (inp) {
    inp.value = '';
    setTimeout(function () { inp.focus(); }, 80);
  }
}

function hideAdminGate() {
  var gate = ge('adminGateModal');
  var authPage = ge('adminAuthPage');
  if (!gate) {
    if (authPage) authPage.style.display = 'flex';
    return;
  }
  gate.classList.add('gate-closing');
  setTimeout(function () {
    gate.style.display = 'none';
    gate.classList.remove('gate-closing');
    if (authPage) {
      authPage.style.display = 'flex';
      var card = authPage.querySelector('.ac');
      var hero = authPage.querySelector('.auth-hero-content');
      if (card) card.classList.add('card-enter');
      if (hero) hero.classList.add('hero-enter');
      var em = ge('aEmail');
      if (em) setTimeout(function () { em.focus(); }, 100);
    }
  }, 320);
}

function unlockAdminGate() {
  var inp = ge('adminGatePasscode');
  var err = ge('adminGateErr');
  var card = ge('adminGateCard');
  var btn = ge('btnAdminGateUnlock');
  var val = inp ? inp.value.trim() : '';

  if (val !== ADMIN_GATE_PASSCODE) {
    if (err) {
      err.style.display = 'flex';
      var errTxt = ge('adminGateErrText');
      if (errTxt) errTxt.textContent = 'รหัสผ่านไม่ถูกต้อง กรุณากรอกใหม่อีกครั้ง';
    }
    if (card) {
      card.classList.remove('gate-shake');
      void card.offsetWidth; // trigger reflow
      card.classList.add('gate-shake');
    }
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    return;
  }

  // Success!
  if (err) err.style.display = 'none';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>✓ ปลดล็อคสำเร็จ!</span>';
  }
  if (inp) inp.blur();

  setTimeout(function () {
    hideAdminGate();
  }, 250);
}

/* ── Enter Admin Application ─────────────────────────── */
function enterAdminApp(showSplash) {
  var gate = ge('adminGateModal');
  if (gate) gate.style.display = 'none';
  var authPage = ge('adminAuthPage');
  var appPage = ge('adminApp');
  if (authPage) authPage.style.display = 'none';
  if (appPage) appPage.style.display = 'flex';

  var adminInit = (CU.firstName ? CU.firstName[0] : 'A') + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
  var avEl = ge('adminAv'); if (avEl) avEl.textContent = adminInit.toUpperCase();
  var nmEl = ge('adminName'); if (nmEl) nmEl.textContent = (CU.firstName || 'Admin') + (CU.lastName ? ' ' + CU.lastName : '');
  var davEl = ge('drawerAv'); if (davEl) davEl.textContent = adminInit.toUpperCase();
  var dnmEl = ge('drawerName'); if (dnmEl) dnmEl.textContent = (CU.firstName || 'Admin') + (CU.lastName ? ' ' + CU.lastName : '');

  // Load category cache and start dashboard
  if (typeof loadCategories === 'function') loadCategories();
  if (typeof showPage === 'function') showPage('dashboard');
  if (typeof loadAdmin === 'function') loadAdmin();

  // Socket
  initAdminSocket();

  // Polling interval 30s
  if (_adminInterval) clearInterval(_adminInterval);
  _adminInterval = setInterval(function () {
    if (!_socketConnected && typeof loadAdmin === 'function') loadAdmin();
  }, 30000);

  // Poll DM unread
  if (typeof refreshAdminDmUnread === 'function') refreshAdminDmUnread();

  if (showSplash) {
    showAdminSplash();
  }
}

/* ── Admin Login Action ──────────────────────────────── */
async function doAdminLogin() {
  hideE('adminAuthErr');
  var email = ge('aEmail').value.trim();
  var pass = ge('aPass').value;
  var remember = ge('aRem') ? ge('aRem').checked : false;

  if (!email || !pass) {
    return showE('adminAuthErr', 'กรุณากรอกอีเมลและรหัสผ่าน');
  }

  var btn = ge('btnAdminSubmit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังเข้าสู่ระบบ...'; }

  try {
    var res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass, remember: remember, portal: 'admin' })
    });
    var data = await res.json();

    if (!res.ok) {
      if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
      return showE('adminAuthErr', data.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    if (data.user.role !== 'admin') {
      if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
      return showE('adminAuthErr', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    CU = data.user;
    sessionStorage.setItem('rn_admin_logged_in', '1');
    enterAdminApp(true);

  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
    showE('adminAuthErr', 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
  }
}

/* ── Admin Logout Action ─────────────────────────────── */
async function doAdminLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) { }

  sessionStorage.removeItem('rn_admin_logged_in');
  CU = null;

  if (_adminInterval) { clearInterval(_adminInterval); _adminInterval = null; }
  stopAdminHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (typeof closeDrawer === 'function') closeDrawer();

  // Return to admin login - protected by security gate
  var appPage = ge('adminApp');
  if (appPage) appPage.style.display = 'none';

  var btn = ge('btnAdminSubmit'); if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  var pwInp = ge('aPass'); if (pwInp) pwInp.value = '';
  showToast('ออกจากระบบเรียบร้อยแล้ว', 'success');

  showAdminGate();
}

/* ── Session Check on Load ───────────────────────────── */
(function checkAdminSession() {
  // Check if session exists on server
  fetch('/api/auth/me')
    .then(function (r) {
      if (r.ok) return r.json();
      throw new Error('No session');
    })
    .then(function (d) {
      if (d.loggedIn && d.role === 'admin') {
        CU = d;
        sessionStorage.setItem('rn_admin_logged_in', '1');
        var gate = ge('adminGateModal');
        if (gate) gate.style.display = 'none';
        enterAdminApp(false);
      } else {
        // Not logged in or not an admin -> show security gate!
        showAdminGate();
      }
    })
    .catch(function () {
      showAdminGate();
    });
})();
