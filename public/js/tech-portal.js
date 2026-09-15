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

/* ── Enter Technician Application ────────────────────── */
function enterTechApp(showSplash) {
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
    sessionStorage.setItem('rn_tech_logged_in', '1');
    enterTechApp(true);

  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
    showE('techAuthErr', 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
  }
}

/* ── Technician Logout Action ────────────────────────── */
async function doTechLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) { }

  sessionStorage.removeItem('rn_tech_logged_in');
  CU = null;

  if (_ticketsInterval) { clearInterval(_ticketsInterval); _ticketsInterval = null; }
  if (_helpInterval) { clearInterval(_helpInterval); _helpInterval = null; }
  stopTechHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  // Return to tech login
  var appPage = ge('techApp');
  var authPage = ge('techAuthPage');
  if (appPage) appPage.style.display = 'none';
  if (authPage) authPage.style.display = 'flex';

  var card = document.querySelector('.ac');
  var heroContent = document.querySelector('.auth-hero-content');
  if (heroContent) heroContent.classList.add('hero-enter');
  if (card) card.classList.add('card-enter');

  var btn = ge('btnTechSubmit'); if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  var pwInp = ge('tPass'); if (pwInp) pwInp.value = '';
  showToast('ออกจากระบบเรียบร้อยแล้ว', 'success');
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
        sessionStorage.setItem('rn_tech_logged_in', '1');
        enterTechApp(false);
      } else {
        var ap = ge('techAuthPage'); if (ap) ap.style.display = 'flex';
        var ta = ge('techApp'); if (ta) ta.style.display = 'none';
      }
    })
    .catch(function () {
      var ap = ge('techAuthPage'); if (ap) ap.style.display = 'flex';
      var ta = ge('techApp'); if (ta) ta.style.display = 'none';
    });
})();
