/* ─────────────────────────────────────────────
   public/js/ui.js — Shared UI Helpers (Premium)
   • DOM shortcuts
   • Toast / Error display
   • Page transitions
   • Ripple effect
   • Clock
   • Status / Priority helpers
   • Image modal / Change-password modal
   ───────────────────────────────────────────── */

/* ── Utilities ───────────────────────────────────────── */
// FIX-2.1: escapeHTML นิยามครั้งเดียวที่นี่ (ลบ duplicate ที่บรรทัด 144 ออกแล้ว)

/* ── Date Formatter ──────────────────────────────────── */
// แปลง ISO string → dd/MM/yyyy HH:mm (เวลาท้องถิ่น)
function fmtDate(d) {
  if (!d) return '—';
  var dt = new Date(d);
  if (isNaN(dt)) return d;
  var day = String(dt.getDate()).padStart(2, '0');
  var month = String(dt.getMonth() + 1).padStart(2, '0');
  var year = dt.getFullYear();
  var hh = String(dt.getHours()).padStart(2, '0');
  var mm = String(dt.getMinutes()).padStart(2, '0');
  return day + '/' + month + '/' + year + ' ' + hh + ':' + mm;
}
/* ── Splash Screen ───────────────────────────────────── */
(function initSplash() {
  var splash = document.getElementById('splash');
  var card = document.querySelector('.ac');
  var heroContent = document.querySelector('.auth-hero-content');
  if (!splash) return;

  // ── GUARD: LINE OAuth return → ยกเลิก animation ทั้งหมดทันที ──
  var _sp = new URLSearchParams(location.search);
  if (_sp.get('line_link') || _sp.get('line_login') || _sp.get('line_error')) {
    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    return;
  }

  // Step 1 (1.7s): Start hero content scale-down FIRST — hidden under splash
  setTimeout(function () {
    if (heroContent) heroContent.classList.add('hero-enter');
  }, 1700);

  // Step 2 (1.85s): Fade splash out, slide card in from right
  setTimeout(function () {
    splash.classList.add('fade-out');
    if (card) {
      requestAnimationFrame(function () { card.classList.add('card-enter'); });
    }
    setTimeout(function () {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 950);
  }, 1850);
})();

/* ── Auth Hero Mouse Parallax ────────────────────────── */
(function initParallax() {
  var hero = document.querySelector('.auth-hero');
  var content = document.querySelector('.auth-hero-content');
  if (!hero || !content) return;
  var entered = false;
  // Only enable after hero-enter animation completes
  document.addEventListener('mouseenter', function check() {
    if (content.classList.contains('hero-enter')) {
      entered = true;
      document.removeEventListener('mouseenter', check);
    }
  }, true);
  setTimeout(function () { entered = true; }, 2800);

  hero.addEventListener('mousemove', function (e) {
    if (!entered) return;
    var rect = hero.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = (e.clientX - cx) / rect.width;   // -0.5 to 0.5
    var dy = (e.clientY - cy) / rect.height;
    var rotX = -dy * 10;   // tilt up/down max 10deg
    var rotY = dx * 10;   // tilt left/right max 10deg
    content.classList.add('tilting');
    content.style.transform = 'scale(1) translateX(0) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg)';
  });

  hero.addEventListener('mouseleave', function () {
    if (!entered) return;
    content.classList.remove('tilting');
    content.style.transform = 'scale(1) translateX(0) rotateX(0deg) rotateY(0deg)';
    // Re-add smooth transition for reset
    content.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)';
    setTimeout(function () { content.style.transition = ''; }, 700);
  });
})();

var DEPT = {
  Road: 'ถนน/ทางเท้า', Water: 'ท่อแตก/น้ำ', Electricity: 'ไฟฟ้า',
  Garbage: 'ขยะ', Animal: 'สัตว์', Tree: 'กิ่งไม้', Hazard: 'ภัยพิบัติ'
};
var DEPT_ICON = {
  Road: '🛣️', Water: '💧', Electricity: '💡',
  Garbage: '🗑️', Animal: '🐍', Tree: '🌿', Hazard: '🚨'
};
var _categoriesCache = null;

async function loadCategories() {
  try {
    var res = await fetch('/api/categories');
    if (!res.ok) return;
    var cats = await res.json();
    _categoriesCache = cats;
    // Update DEPT and DEPT_ICON dynamically
    DEPT = {};
    DEPT_ICON = {};
    cats.forEach(function (c) {
      DEPT[c.name] = c.label;
      DEPT_ICON[c.name] = c.icon;
    });
    // Update dynamic dropdowns
    _updateDynamicSelects(cats);
    // Update citizen catGrid if visible
    if (typeof renderDynamicCatGrid === 'function') renderDynamicCatGrid(cats);
  } catch (e) { console.error('[loadCategories]', e); }
}

function _updateDynamicSelects(cats) {
  // Search category filter
  var srchCat = ge('srchCat');
  if (srchCat) {
    var val = srchCat.value;
    srchCat.innerHTML = '<option value="all">ทุกประเภท</option>';
    cats.forEach(function (c) {
      srchCat.innerHTML += '<option value="' + escapeHTML(c.name) + '">' + c.icon + ' ' + escapeHTML(c.label) + '</option>';
    });
    srchCat.value = val;
  }
  // Help request target dept
  var helpDept = ge('helpTargetDept');
  if (helpDept) {
    var hval = helpDept.value;
    helpDept.innerHTML = '<option value="">— ทุกแผนก —</option>';
    cats.forEach(function (c) {
      helpDept.innerHTML += '<option value="' + escapeHTML(c.name) + '">' + c.icon + ' ' + escapeHTML(c.label) + '</option>';
    });
    helpDept.value = hval;
  }
}

/* ── DOM Helper ──────────────────────────────────────── */
function ge(id) { return document.getElementById(id); }

/* ── HTML Escape (FIX-2.1: prevent XSS — single definition) */
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ══════════════════════════════════════════
   CUSTOM ANIMATED DROPDOWN
══════════════════════════════════════════ */
var _cgDropOpen = null;

function cgDropToggle(id) {
  var el = ge(id);
  if (!el) return;
  // Close previous if different
  if (_cgDropOpen && _cgDropOpen !== id) {
    var prev = ge(_cgDropOpen);
    if (prev) prev.classList.remove('open');
  }
  var isOpen = el.classList.toggle('open');
  _cgDropOpen = isOpen ? id : null;
  // Micro-bounce on trigger button
  var btn = el.querySelector('.cg-select-trigger');
  if (btn) {
    btn.style.transform = 'scale(.95)';
    setTimeout(function () { btn.style.transform = ''; }, 120);
  }
}

function cgDropPick(id, value, label, callback) {
  var el = ge(id);
  if (!el) return;
  // Update displayed label
  var labelEl = el.querySelector('.cg-select-label');
  if (labelEl) {
    labelEl.style.transform = 'translateY(-4px)';
    labelEl.style.opacity = '0';
    setTimeout(function () {
      labelEl.textContent = label;
      labelEl.style.transition = 'transform .18s ease, opacity .18s ease';
      labelEl.style.transform = 'translateY(0)';
      labelEl.style.opacity = '1';
      setTimeout(function () { labelEl.style.transition = ''; }, 200);
    }, 100);
  }
  // Update selected opt highlight
  el.querySelectorAll('.cg-select-opt').forEach(function (o) {
    o.classList.toggle('selected', o.getAttribute('data-value') === value);
  });
  el.setAttribute('data-value', value);
  // Close with slight delay for visual feedback
  setTimeout(function () {
    el.classList.remove('open');
    _cgDropOpen = null;
  }, 80);
  // Fire filter callback
  if (typeof callback === 'function') setTimeout(callback, 130);
}

// Auto-close on outside click
document.addEventListener('click', function (e) {
  if (_cgDropOpen) {
    var el = ge(_cgDropOpen);
    if (el && !el.contains(e.target)) {
      el.classList.remove('open');
      _cgDropOpen = null;
    }
  }
});

/* ── Ticket Detail Modal close ── */
function closeTD() {
  ge('mTicketDetail').classList.remove('on');
  // Remove active highlight from whichever card was open
  if (typeof _cgOpen !== 'undefined' && _cgOpen) {
    var c1 = ge('cgcard-' + _cgOpen); if (c1) c1.classList.remove('cg-card--active');
    _cgOpen = null;
  }
  if (typeof _tcOpen !== 'undefined' && _tcOpen) {
    var c2 = ge('tccard-' + _tcOpen); if (c2) c2.classList.remove('cg-card--active');
    _tcOpen = null;
  }
}

// ESC closes ticket detail modal
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var td = ge('mTicketDetail');
    if (td && td.classList.contains('on')) closeTD();
  }
});

/* ── Ripple Effect ───────────────────────────────────── */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.btn-ripple');
  if (!btn) return;
  var r = document.createElement('span');
  var rect = btn.getBoundingClientRect();
  var size = Math.max(rect.width, rect.height);
  r.className = 'ripple-circle';
  r.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - rect.left - size / 2) + 'px;top:' + (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(r);
  setTimeout(function () { r.remove(); }, 700);
});

/* ── Live Clock ──────────────────────────────────────── */
function startClock() {
  var el = ge('topbarClock');
  if (!el) return;
  function tick() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    el.textContent = h + ':' + m + ':' + s;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Page Transition (admin pages) ──────────────────── */
var _pages = ['pageDashboard', 'pageQueue', 'pageTechs', 'pageCategories'];
var _navIds = { dashboard: 'nav-dashboard', queue: 'nav-queue', techs: 'nav-techs', categories: 'nav-categories' };

function showPage(name) {
  _pages.forEach(function (pid) {
    var el = ge(pid);
    if (!el) return;
    if (pid === 'page' + name.charAt(0).toUpperCase() + name.slice(1)) {
      el.style.display = 'block';
      el.classList.remove('page-enter');
      void el.offsetWidth; // reflow
      el.classList.add('page-enter');
    } else {
      el.style.display = 'none';
    }
  });
  // Update sidebar active state
  Object.keys(_navIds).forEach(function (k) {
    var nav = ge(_navIds[k]);
    if (!nav) return;
    nav.classList.toggle('on', k === name);
  });
  // Update admin mobile bottom nav active state
  var mobMap = { dashboard: 'amob-dashboard', queue: 'amob-queue', techs: 'amob-techs', categories: 'amob-categories' };
  Object.keys(mobMap).forEach(function (k) {
    var btn = ge(mobMap[k]);
    if (!btn) return;
    btn.classList.toggle('on', k === name);
  });
  // Update page title
  var titles = { dashboard: 'Smart Dispatcher Dashboard', queue: 'Ticket ทั้งหมด', techs: 'สถานะทีมช่าง', categories: 'จัดการหมวดหมู่เรื่องร้องเรียน' };
  var pt = ge('pageTitle');
  if (pt && titles[name]) pt.textContent = titles[name];
  currentPage = name;
  // Reload data so sub-pages (queue, techs) render immediately
  if (typeof loadAdmin === 'function') loadAdmin();
}

/* ── Animate Counter ─────────────────────────────────── */
function animateNum(el, target) {
  if (!el) return;
  var start = parseInt(el.textContent) || 0;
  var diff = target - start;
  if (diff === 0) return;
  var steps = 20, step = 0;
  var iv = setInterval(function () {
    step++;
    el.textContent = Math.round(start + diff * (step / steps));
    if (step >= steps) { el.textContent = target; clearInterval(iv); }
  }, 18);
}

/* ── Toast Notification ──────────────────────────────── */
var _toastTimer;
function showToast(msg, type) {
  // type: 'success' | 'error' | 'warning' | default
  // FIX-2.1a: escape msg ก่อนใส่ innerHTML (ป้องกัน XSS จาก error messages)
  var t = ge('toast');
  var icons = { success: '✅', error: '❌', warning: '⚠️' };
  var icon = icons[type] || 'ℹ️';
  t.innerHTML = '<span style="font-size:16px">' + icon + '</span><span>' + escapeHTML(String(msg)) + '</span>';
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () {
    t.classList.add('hide');
    setTimeout(function () { t.className = 'toast'; }, 350);
  }, 3200);
}

/* ── Inline Error Box ────────────────────────────────── */
function showE(id, msg) {
  var el = ge(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function hideE(id) {
  var el = ge(id);
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

/* ── Status Label (Thai) ─────────────────────────────── */
function stTH(s) {
  var m = {
    pending: 'รอดำเนินการ', assigned: 'รับงานแล้ว',
    in_progress: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', rejected: 'ปฏิเสธ'
  };
  return m[s] || s;
}

/* ── Status Badge HTML ───────────────────────────────── */
function statusBadge(s) {
  var lbl = stTH(s);
  var dots = { pending: '🟡', assigned: '🔵', in_progress: '🟣', completed: '🟢', rejected: '🔴' };
  return '<span class="sbadge ' + s + '">' + (dots[s] || '⚪') + ' ' + lbl + '</span>';
}

/* ── Priority Badge HTML ─────────────────────────────── */
function pLabel(score) {
  if (score >= 70) return '<span class="pbadge urgent">🔴 ' + score + '</span>';
  if (score >= 40) return '<span class="pbadge medium">🟡 ' + score + '</span>';
  return '<span class="pbadge normal">🟢 ' + score + '</span>';
}

/* ── Image Preview Modal ─────────────────────────────── */
function viewImg(src, title) {
  ge('mImgSrc').src = src;
  ge('mImgTitle').textContent = title || '';
  ge('mImg').classList.add('on');
}
function closeMImg() { ge('mImg').classList.remove('on'); }

/* ── Change Password Modal ───────────────────────────── */
function openChPw() {
  hideE('chErr');
  ['curP', 'newP', 'conP'].forEach(function (i) { ge(i).value = ''; });
  ge('mChPw').classList.add('on');
}
function closeChPw() { ge('mChPw').classList.remove('on'); }

/* ── Mobile Bottom Nav Active State ──────────────────── */
function mobNavSetActive(id) {
  document.querySelectorAll('.mob-nav-btn').forEach(function (b) { b.classList.remove('on'); });
  var el = ge(id);
  if (el) el.classList.add('on');
}

/* ── Caption shorthand ───────────────────────────────── */
function imgThumb(url, label) {
  if (!url) return '<span style="color:var(--muted);font-size:12px">—</span>';
  return '<img class="img-thumb" src="' + url + '" onclick="viewImg(\'' + url + '\',\'' + label + '\')" alt="' + label + '" />';
}

/* ══════════════════════════════════════════
   UNIVERSAL SLIDE DRAWER
══════════════════════════════════════════ */
function openDrawer() {
  if (typeof CU === 'undefined' || !CU) return;

  // ── Avatar ──
  var avEl = ge('drawerAv');
  if (avEl) {
    // BUG-002: use 'avatar' field (from /api/auth/me), not 'linePicture'
    if (CU.avatar) {
      avEl.innerHTML = '<img src="' + CU.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:18px"/>';
    } else {
      var init = (CU.firstName ? CU.firstName[0] : '?') +
        (CU.lastName && CU.lastName !== '-' && CU.lastName[0] ? CU.lastName[0] : '');
      avEl.innerHTML = '';
      avEl.textContent = init.toUpperCase();
    }
  }

  // ── Name ──
  var nmEl = ge('drawerName');
  if (nmEl) {
    var lastName = (CU.lastName && CU.lastName !== '-') ? ' ' + CU.lastName : '';
    nmEl.textContent = (CU.firstName || '') + lastName;
  }

  // ── Role ──
  var roleEl = ge('drawerRole');
  if (roleEl) {
    var DEPT_LABEL = typeof DEPT !== 'undefined' ? DEPT : {};
    if (CU.role === 'admin') roleEl.textContent = 'ผู้ดูแลระบบ';
    else if (CU.role === 'technician') roleEl.textContent = 'ช่าง · ' + (DEPT_LABEL[CU.specialty] || '');
    else roleEl.textContent = 'ประชาชน';
  }

  // ── Hide change password for LINE-only accounts ──
  var cpBtn = ge('drawerChPw');
  if (cpBtn) {
    var isLineOnly = (CU.email || '').indexOf('line_') === 0;
    cpBtn.style.display = isLineOnly ? 'none' : 'flex';
  }

  // ── แสดงปุ่ม unlink LINE เฉพาะ admin ──
  var unlinkBtn = ge('drawerUnlinkLine');
  if (unlinkBtn) unlinkBtn.style.display = CU.role === 'admin' ? 'flex' : 'none';

  // ── Open ──
  ge('sideDrawer').classList.add('open');
  ge('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // ── Animate hamburger buttons → X ──
  document.querySelectorAll('.hbg-btn').forEach(function (b) { b.classList.add('active'); });
}

function closeDrawer() {
  var drawer = ge('sideDrawer');
  var overlay = ge('drawerOverlay');
  if (!drawer) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';

  // ── Restore hamburger buttons ──
  document.querySelectorAll('.hbg-btn').forEach(function (b) { b.classList.remove('active'); });
}


// ESC key closes drawer
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeDrawer();
  if (e.key === 'Escape') closeTicketChat();
});

// ─── Socket.io Auto-refresh (FIX-4.2) ───────────────────────
// socket.on('ticket_updated') จัดการ real-time update แทน setInterval
// _socketConnected flag บอก app.js ว่าไม่ต้อง poll (ประหยัด bandwidth)
if (typeof io !== 'undefined') {
  var socket = io();

  // Track connection state สำหรับ adaptive polling ใน app.js
  socket.on('connect', function () {
    _socketConnected = true;
    console.log('[Socket] Connected — switching to event-driven mode');
    // FIX-#3: เริ่ม heartbeat ทันที เมื่อ connect สำเร็จ
    if (typeof startHeartbeat === 'function') startHeartbeat(socket);
  });
  socket.on('disconnect', function () {
    _socketConnected = false;
    console.log('[Socket] Disconnected — 30s polling fallback active');
    // FIX-#3: หยุด heartbeat เมื่อ disconnect (รู้ว่าหลุดแล้ว — ไม่ต้องตรวจซ้ำ)
    if (typeof stopHeartbeat === 'function') stopHeartbeat();
  });
  socket.on('connect_error', function () {
    _socketConnected = false;
    if (typeof stopHeartbeat === 'function') stopHeartbeat();
  });

  // FIX-#3: รับ pong กลับมา → cancel stale timeout
  socket.on('pong_heartbeat', function () {
    if (typeof _pongTimer !== 'undefined' && _pongTimer) {
      clearTimeout(_pongTimer);
      _pongTimer = null;
    }
  });

  socket.on('ticket_updated', function () {
    if (typeof loadTickets === 'function' && window.CU) {
      loadTickets();
    }
    // Admin: socket จะ trigger loadAdmin() ด้วย
    if (typeof loadAdmin === 'function' && window.CU && window.CU.role === 'admin') {
      loadAdmin();
    }
  });
  // Live chat: auto-append new comments
  socket.on('comment_added', function (data) {
    if (_chatTicketId && data.ticketId === _chatTicketId) {
      _appendComment(data.comment, true);
    }
  });
}


/* ══════════════════════════════════════════════════════════
   UPVOTE SYSTEM
══════════════════════════════════════════════════════════ */
async function toggleUpvote(btn) {
  var id = btn.getAttribute('data-id');
  if (!id) return;
  try {
    var res = await fetch('/api/tickets/' + id + '/upvote', { method: 'POST' });
    if (res.status === 401) return showToast('กรุณา Login เพื่อโหวต', 'warning');
    if (res.status === 400) { var d = await res.json(); return showToast(d.error, 'warning'); }
    var data = await res.json();
    // Update button state with animation
    var countEl = btn.querySelector('.upvote-count');
    var iconEl = btn.querySelector('.upvote-icon');
    if (countEl) {
      countEl.textContent = data.upvoteCount;
      countEl.style.transform = 'scale(1.4)';
      setTimeout(function () { countEl.style.transform = ''; }, 250);
    }
    if (data.hasUpvoted) {
      btn.classList.add('voted');
      if (iconEl) { iconEl.style.transform = 'scale(1.5) rotate(-10deg)'; setTimeout(function () { iconEl.style.transform = ''; }, 300); }
      showToast('👍 โหวตแล้ว!');
    } else {
      btn.classList.remove('voted');
      showToast('ยกเลิกโหวตแล้ว');
    }
  } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

/* ══════════════════════════════════════════════════════════
   FOLLOW / SUBSCRIBE SYSTEM
══════════════════════════════════════════════════════════ */
async function toggleFollow(btn) {
  var id = btn.getAttribute('data-id');
  if (!id) return;
  try {
    var res = await fetch('/api/tickets/' + id + '/follow', { method: 'POST' });
    if (res.status === 401) return showToast('กรุณา Login เพื่อติดตาม', 'warning');
    var data = await res.json();
    var countEl = btn.querySelector('.follow-count');
    var iconEl = btn.querySelector('.follow-icon');
    var labelEl = btn.querySelectorAll('span')[2];
    if (countEl) {
      countEl.textContent = data.followerCount;
      countEl.style.transform = 'scale(1.3)';
      setTimeout(function () { countEl.style.transform = ''; }, 250);
    }
    if (data.isFollowing) {
      btn.classList.add('following');
      if (iconEl) iconEl.textContent = '🔔';
      if (labelEl) labelEl.textContent = 'กำลังติดตาม';
      showToast('🔔 ติดตามแล้ว! จะแจ้งเตือนทาง LINE');
    } else {
      btn.classList.remove('following');
      if (iconEl) iconEl.textContent = '🔕';
      if (labelEl) labelEl.textContent = 'ติดตาม';
      showToast('ยกเลิกการติดตามแล้ว');
    }
  } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

/* ══════════════════════════════════════════════════════════
   TICKET CHAT / COMMENTS
══════════════════════════════════════════════════════════ */
var _chatTicketId = null;
var _chatCommentIds = {}; // track loaded comment IDs to prevent duplicates

function openTicketChat(ticketId) {
  _chatTicketId = ticketId;
  _chatCommentIds = {};
  ge('chatTicketLabel').textContent = ticketId;
  ge('chatMessages').innerHTML = '<div class="chat-empty">⏳ กำลังโหลด...</div>';
  ge('chatInput').value = '';
  ge('mTicketChat').classList.add('on');
  loadComments(ticketId);
  setTimeout(function () { ge('chatInput').focus(); }, 300);
}

function closeTicketChat() {
  ge('mTicketChat').classList.remove('on');
  _chatTicketId = null;
  _chatCommentIds = {};
}

async function loadComments(ticketId) {
  try {
    var res = await fetch('/api/tickets/' + ticketId + '/comments');
    if (!res.ok) return;
    var comments = await res.json();
    var el = ge('chatMessages');
    if (!comments.length) {
      el.innerHTML = '<div class="chat-empty">💬 ยังไม่มีข้อความ — เริ่มสนทนาเลย!</div>';
      return;
    }
    el.innerHTML = '';
    comments.forEach(function (c) { _appendComment(c, false); });
    // Scroll to bottom
    el.scrollTop = el.scrollHeight;
  } catch (e) { console.error(e); }
}

function _appendComment(c, animated) {
  if (_chatCommentIds[c._id]) return; // prevent duplicates
  _chatCommentIds[c._id] = true;

  var el = ge('chatMessages');
  // Remove "empty" placeholder
  var emptyEl = el.querySelector('.chat-empty');
  if (emptyEl) emptyEl.remove();

  var isMe = window.CU && c.userId === window.CU.id;
  var bubbleCls = 'chat-bubble ';
  if (c.userRole === 'admin') bubbleCls += 'chat-bubble-admin';
  else if (isMe) bubbleCls += 'chat-bubble-right';
  else bubbleCls += 'chat-bubble-left';

  var time = '';
  if (c.createdAt) {
    var d = new Date(c.createdAt);
    time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  var roleTH = { citizen: '👤 ผู้แจ้ง', technician: '🔧 ช่าง', admin: '👨‍💼 แอดมิน' };
  var div = document.createElement('div');
  div.className = bubbleCls;
  if (!animated) div.style.animation = 'none';

  div.innerHTML = (!isMe ? '<div class="chat-bubble-name">' + (roleTH[c.userRole] || '') + ' ' + escapeHTML(c.userName) + '</div>' : '') +
    '<div>' + escapeHTML(c.message) + '</div>' +
    '<div class="chat-bubble-meta">' + time + '</div>';

  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

async function sendComment() {
  if (!_chatTicketId) return;
  var input = ge('chatInput');
  var msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  var btn = ge('chatSendBtn');
  btn.disabled = true;
  try {
    var res = await fetch('/api/tickets/' + _chatTicketId + '/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    var data = null;
    try { data = await res.json(); } catch (e) { }
    if (!res.ok) {
      showToast((data && data.error) || 'ส่งไม่สำเร็จ', 'error');
    } else if (data && data._id && !_chatCommentIds[data._id]) {
      _appendComment(data, true);
    }
  } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
  btn.disabled = false;
  input.focus();
}


/* ══════════════════════════════════════════════════════════
   PUBLIC HEATMAP
══════════════════════════════════════════════════════════ */
var _publicMap = null;
var _publicMarkers = [];

async function loadHeatmap() {
  try {
    var container = ge('publicMapContainer');
    if (!container) return;

    // Initialize map once
    if (!_publicMap) {
      _publicMap = L.map('publicMapContainer').setView([13.829, 100.551], 11);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap, © CARTO'
      }).addTo(_publicMap);
    }
    setTimeout(function () { _publicMap.invalidateSize(); }, 200);

    // Fetch data
    var res = await fetch('/api/tickets/public-map');
    if (!res.ok) return;
    var tickets = await res.json();

    // Clear old markers
    _publicMarkers.forEach(function (m) { _publicMap.removeLayer(m); });
    _publicMarkers = [];

    var ICONS_MAP = { Road: '🛣️', Water: '💧', Electricity: '💡', Garbage: '🗑️', Animal: '🐍', Tree: '🌿', Hazard: '🚨' };
    var statCount = { pending: 0, in_progress: 0, completed: 0 };

    tickets.forEach(function (t, i) {
      if (!t.lat || !t.lng) return;

      var colorClass = 'hm-marker-red';
      if (t.status === 'in_progress' || t.status === 'assigned') colorClass = 'hm-marker-yellow';
      if (t.status === 'completed') colorClass = 'hm-marker-green';

      var icon = L.divIcon({
        className: '',
        html: '<div class="hm-marker ' + colorClass + '" style="animation-delay:' + (i * 0.06) + 's"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      var marker = L.marker([t.lat, t.lng], { icon: icon }).addTo(_publicMap);
      var iText = ICONS_MAP[t.category] || '📍';
      var stTH = { pending: '⏳ รอ', assigned: '🔧 รับงาน', in_progress: '🔨 กำลังซ่อม', completed: '✅ เสร็จ', rejected: '❌ ปฏิเสธ' };
      // FIX-2.1b: escape ticketId และ status ก่อนใส่ใน HTML
      marker.bindPopup(
        '<div style="font-size:13px;min-width:150px">' +
        '<b>' + escapeHTML(t.ticketId) + '</b><br>' +
        iText + ' ' + escapeHTML(t.category) + '<br>' +
        '<span style="font-size:12px">' + escapeHTML(t.description || '') + '</span><br>' +
        '<b>' + escapeHTML(stTH[t.status] || t.status) + '</b>' +
        (t.upvoteCount ? '<br>👍 ' + parseInt(t.upvoteCount || 0) + ' โหวต' : '') +
        '</div>'
      );
      _publicMarkers.push(marker);

      // Count stats
      if (t.status === 'pending' || t.status === 'assigned') statCount.pending++;
      else if (t.status === 'in_progress') statCount.in_progress++;
      else if (t.status === 'completed') statCount.completed++;
    });

    // Stats
    var statsEl = ge('heatmapStats');
    if (statsEl) {
      statsEl.innerHTML = '📊 รอ: <b>' + statCount.pending + '</b> | กำลังซ่อม: <b>' + statCount.in_progress + '</b> | แก้แล้ว: <b>' + statCount.completed + '</b> | รวม: <b>' + tickets.length + '</b> จุด';
    }

    // Fit bounds if we have markers
    if (_publicMarkers.length > 0) {
      var group = L.featureGroup(_publicMarkers);
      _publicMap.fitBounds(group.getBounds().pad(0.1));
    }

  } catch (e) { console.error('[Heatmap]', e); }
}


/* ══════════════════════════════════════════════════════════
   SLA HELPER
══════════════════════════════════════════════════════════ */
function formatSlaCountdown(deadline) {
  if (!deadline) return { text: '—', cls: '' };
  var now = new Date();
  var dl = new Date(deadline);
  var diff = dl - now;
  if (diff <= 0) return { text: '🔴 OVERDUE', cls: 'sla-badge-overdue' };
  var hours = Math.floor(diff / 3600000);
  var mins = Math.floor((diff % 3600000) / 60000);
  if (hours < 2) return { text: '⚡ ' + hours + 'h ' + mins + 'm', cls: 'sla-badge-warn' };
  return { text: '✅ ' + hours + 'h ' + mins + 'm', cls: 'sla-badge-ok' };
}

function slaLabel(t) {
  if (t.status === 'completed' || t.status === 'rejected') {
    return t.slaBreached ? '<span class="sla-badge sla-badge-overdue">❌ SLA BREACHED</span>' : '<span class="sla-badge sla-badge-ok">✅ ตรงเวลา</span>';
  }
  if (t.status === 'pending') {
    var s = formatSlaCountdown(t.slaAssignDeadline);
    return '<span class="sla-badge ' + s.cls + '"><span class="sla-countdown">' + s.text + '</span></span>';
  }
  var s2 = formatSlaCountdown(t.slaCompleteDeadline);
  return '<span class="sla-badge ' + s2.cls + '"><span class="sla-countdown">' + s2.text + '</span></span>';
}
