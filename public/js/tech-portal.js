/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

/* ─────────────────────────────────────────────
   public/js/tech-portal.js — Technician Portal Controller
   • Dedicated session management for /tech
   • Role-guarded login (Technician only)
   • Load & render technician jobs & help requests
   • Socket.IO real-time updates for field ops
   ───────────────────────────────────────────── */

var CU = null;
var _ticketsInterval = null;
var _helpInterval = null;
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

/* ── Quick Demo Fill for Technicians ─────────────────── */
function quickFillTech(email) {
  var em = ge('tEmail'), pw = ge('tPass');
  if (em) em.value = email;
  if (pw) pw.value = 'tech1234';
  hideE('techAuthErr');
}

/* ── Initialize Socket.IO for Technician ─────────────── */
function initTechSocket() {
  if (typeof io === 'undefined') return;
  if (socket) return;

  socket = io();

  socket.on('connect', function () {
    _socketConnected = true;
    startTechHeartbeat();
  });

  socket.on('disconnect', function () {
    _socketConnected = false;
    stopTechHeartbeat();
  });

  socket.on('pong_heartbeat', function () {
    if (_pongTimer) { clearTimeout(_pongTimer); _pongTimer = null; }
  });

  // Ticket events
  ['ticket_assigned', 'ticket_updated', 'ticket_status_changed'].forEach(function (evt) {
    socket.on(evt, function () {
      loadTickets();
    });
  });

  // Help Request events
  ['help_created', 'help_accepted', 'help_resolved', 'help_cancelled'].forEach(function (evt) {
    socket.on(evt, function () {
      loadHelpRequests();
    });
  });
}

function startTechHeartbeat() {
  stopTechHeartbeat();
  _heartbeatTimer = setInterval(function () {
    if (!_socketConnected || !socket) return;
    socket.emit('ping_heartbeat');
    _pongTimer = setTimeout(function () {
      _socketConnected = false;
      loadTickets();
    }, 5000);
  }, 15000);
}

function stopTechHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_pongTimer) { clearTimeout(_pongTimer); _pongTimer = null; }
}

/* ── Load Ticket Data (Technician) ───────────────────── */
async function loadTickets() {
  try {
    var res = await fetch('/api/tickets');
    if (!res.ok) return;
    var data = await res.json();
    if (typeof renderTech === 'function') {
      renderTech(data);
    }
  } catch (e) {
    console.error('[loadTickets]', e);
  }
}

/* ── Load Help Requests (Technician) ─────────────────── */
async function loadHelpRequests() {
  try {
    var res = await fetch('/api/help-requests');
    if (!res.ok) return;
    var data = await res.json();
    if (typeof renderHelpBanner === 'function') {
      renderHelpBanner(data);
    }
  } catch (e) {
    console.error('[loadHelpRequests]', e);
  }
}

/* ── Welcome Splash (Technician) ─────────────────────── */
function showTechSplash(onDone) {
  var overlay = document.createElement('div');
  overlay.id = 'techWelcomeSplash';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'background:linear-gradient(160deg,#07111f 0%,#0c1e3a 50%,#101627 100%)',
    'overflow:hidden'
  ].join(';');

  var orbHtml = [
    '<div style="position:absolute;width:480px;height:480px;top:-10%;left:-10%;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,.45) 0%,transparent 70%);filter:blur(70px)"></div>',
    '<div style="position:absolute;width:380px;height:380px;bottom:-5%;right:-5%;border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.35) 0%,transparent 70%);filter:blur(70px)"></div>'
  ].join('');

  var techName = CU ? (CU.firstName || '') : 'ช่าง';
  var deptLabel = (typeof DEPT !== 'undefined' && CU && CU.specialty) ? (DEPT[CU.specialty] || CU.specialty) : '';

  overlay.innerHTML = [
    orbHtml,
    '<div style="text-align:center;padding:0 32px;position:relative;z-index:2;animation:splashFadeUp .6s ease both">',
    '<div style="font-size:74px;filter:drop-shadow(0 0 28px rgba(59,130,246,.75));margin-bottom:12px">🔧</div>',
    '<div style="font-size:13px;letter-spacing:4px;text-transform:uppercase;color:rgba(96,165,250,.9);font-weight:700;margin-bottom:10px">TECHNICIAN FIELD OPS</div>',
    '<div style="font-size:30px;font-weight:800;color:#fff;font-family:Prompt,sans-serif">ยินดีต้อนรับ, ' + escapeHTML(techName) + '</div>',
    '<div style="font-size:14px;color:rgba(255,255,255,.6);margin-top:10px">' + (deptLabel ? 'ฝ่าย: ' + escapeHTML(deptLabel) + ' · ' : '') + 'พร้อมรับงานแล้ว — โหลดข้อมูลงาน...</div>',
    '<div style="width:130px;height:3px;border-radius:99px;background:linear-gradient(90deg,#3b82f6,#06b6d4);margin:18px auto 0;box-shadow:0 0 14px rgba(59,130,246,.8)"></div>',
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

/* ── Tech Security Gate (Passcode Protection) ────────── */
var TECH_GATE_PASSCODE = '@Teng11421142';

function toggleTechGatePassVisibility() {
  var inp = ge('techGatePasscode');
  var icon = ge('techGateEyeIcon');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.textContent = '🙈';
  } else {
    inp.type = 'password';
    if (icon) icon.textContent = '👁️';
  }
}

function showTechGate() {
  var gate = ge('techGateModal');
  var card = ge('techGateCard');
  var authPage = ge('techAuthPage');
  var appPage = ge('techApp');
  var inp = ge('techGatePasscode');
  var err = ge('techGateErr');
  var btn = ge('btnTechGateUnlock');

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

function hideTechGate() {
  var gate = ge('techGateModal');
  var authPage = ge('techAuthPage');
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
      var em = ge('tEmail');
      if (em) setTimeout(function () { em.focus(); }, 100);
    }
  }, 320);
}

function unlockTechGate() {
  var inp = ge('techGatePasscode');
  var err = ge('techGateErr');
  var card = ge('techGateCard');
  var btn = ge('btnTechGateUnlock');
  var val = inp ? inp.value.trim() : '';

  if (val !== TECH_GATE_PASSCODE) {
    if (err) {
      err.style.display = 'flex';
      var errTxt = ge('techGateErrText');
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
    hideTechGate();
  }, 250);
}

/* ── Enter Technician Application ────────────────────── */
function enterTechApp(showSplash) {
  var gate = ge('techGateModal');
  if (gate) gate.style.display = 'none';
  var authPage = ge('techAuthPage');
  var appPage = ge('techApp');
  if (authPage) authPage.style.display = 'none';
  if (appPage) appPage.style.display = 'flex';

  var initials = (CU.firstName ? CU.firstName[0] : 'T') + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
  var avEl = ge('tAv'); if (avEl) avEl.textContent = initials.toUpperCase();
  var nmEl = ge('tName'); if (nmEl) nmEl.textContent = (CU.firstName || '') + (CU.lastName ? ' ' + CU.lastName : '');
  var dpEl = ge('tDeptBadge');
  if (dpEl) {
    var icon = (typeof DEPT_ICON !== 'undefined' && DEPT_ICON[CU.specialty]) ? DEPT_ICON[CU.specialty] : '🔧';
    var label = (typeof DEPT !== 'undefined' && DEPT[CU.specialty]) ? DEPT[CU.specialty] : (CU.specialty || 'ทั่วไป');
    dpEl.textContent = icon + ' ' + label;
  }

  // Update universal drawer user profile
  var dAv = ge('drawerAv');
  if (dAv) {
    if (CU.avatar) {
      dAv.innerHTML = '<img src="' + CU.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:18px"/>';
    } else {
      dAv.innerHTML = '';
      dAv.textContent = initials.toUpperCase();
    }
  }
  var dNm = ge('drawerName');
  if (dNm) dNm.textContent = (CU.firstName || '') + (CU.lastName && CU.lastName !== '-' ? ' ' + CU.lastName : '');
  var dRole = ge('drawerRole');
  if (dRole) {
    var dIcon = (typeof DEPT_ICON !== 'undefined' && DEPT_ICON[CU.specialty]) ? DEPT_ICON[CU.specialty] : '🔧';
    var dLabel = (typeof DEPT !== 'undefined' && DEPT[CU.specialty]) ? DEPT[CU.specialty] : (CU.specialty || 'งานปฏิบัติการ');
    dRole.textContent = dIcon + ' ช่าง · ' + dLabel;
  }

  // Load categories to populate dropdowns
  if (typeof loadCategories === 'function') loadCategories();

  // Load jobs & help requests
  loadTickets();
  loadHelpRequests();

  // Socket
  initTechSocket();

  // Polling intervals
  if (_ticketsInterval) clearInterval(_ticketsInterval);
  _ticketsInterval = setInterval(function () {
    if (!_socketConnected) loadTickets();
  }, 30000);

  if (_helpInterval) clearInterval(_helpInterval);
  _helpInterval = setInterval(function () {
    if (!_socketConnected) loadHelpRequests();
  }, 30000);

  if (showSplash) {
    showTechSplash();
  }
}

/* ── Technician Login Action ─────────────────────────── */
async function doTechLogin() {
  hideE('techAuthErr');
  var email = ge('tEmail').value.trim();
  var pass = ge('tPass').value;
  var remember = ge('tRem') ? ge('tRem').checked : false;

  if (!email || !pass) {
    return showE('techAuthErr', 'กรุณากรอกอีเมลและรหัสผ่าน');
  }

  var btn = ge('btnTechSubmit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังเข้าสู่ระบบ...'; }

  try {
    var res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass, remember: remember, portal: 'tech' })
    });
    var data = await res.json();

    if (!res.ok) {
      if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
      return showE('techAuthErr', data.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    if (data.user.role !== 'technician') {
      if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
      return showE('techAuthErr', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    CU = data.user;
    window.CU = CU;
    sessionStorage.setItem('rn_tech_logged_in', '1');
    enterTechApp(true);

  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
    showE('techAuthErr', 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
  }
}

/* ── Technician Logout Action ────────────────────────── */
async function doTechLogout() {
  if (typeof closeDrawer === 'function') closeDrawer();
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) { }

  sessionStorage.removeItem('rn_tech_logged_in');
  CU = null;
  window.CU = null;

  if (_ticketsInterval) { clearInterval(_ticketsInterval); _ticketsInterval = null; }
  if (_helpInterval) { clearInterval(_helpInterval); _helpInterval = null; }
  stopTechHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  // Return to tech login - protected by security gate
  var appPage = ge('techApp');
  if (appPage) appPage.style.display = 'none';

  var btn = ge('btnTechSubmit'); if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  var pwInp = ge('tPass'); if (pwInp) pwInp.value = '';
  showToast('ออกจากระบบเรียบร้อยแล้ว', 'success');

  showTechGate();
}

/* ── Session Check on Load ───────────────────────────── */
(function checkTechSession() {
  fetch('/api/auth/me')
    .then(function (r) {
      if (r.ok) return r.json();
      throw new Error('No session');
    })
    .then(function (d) {
      if (d.loggedIn && d.role === 'technician') {
        CU = d;
        window.CU = CU;
        sessionStorage.setItem('rn_tech_logged_in', '1');
        var gate = ge('techGateModal');
        if (gate) gate.style.display = 'none';
        enterTechApp(false);
      } else {
        // Not logged in or not a tech -> show security gate!
        showTechGate();
      }
    })
    .catch(function () {
      showTechGate();
    });
})();
