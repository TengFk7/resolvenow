/* ─────────────────────────────────────────────
   public/js/app.js — Application Entry Point
   • Global state
   • enterApp() — routes user to correct view
   • loadTickets() — polls ticket data  
   • Session resume on page load
   ───────────────────────────────────────────── */

/* ── Global State ────────────────────────────────────── */
var CU = null;
var upId = null;
var upType = null;
var helpTicketId = null;
var currentPage = 'dashboard';

/* ── Interval tracking (BUG-001: prevent memory leak on re-login) */
var _adminInterval = null;
var _ticketsInterval = null;
var _helpInterval = null;

/* ── Show Auth Page ──────────────────────────────────── */
function showAuth() {
  ge('authPage').style.display = 'flex';
  ge('adminApp').style.display = 'none';
  ge('normalApp').style.display = 'none';
  ge('mobNav').style.display = 'none';
}

/* ── Clear all polling intervals (call on logout) ────── */
function clearAppIntervals() {
  if (_adminInterval)   { clearInterval(_adminInterval);   _adminInterval = null; }
  if (_ticketsInterval) { clearInterval(_ticketsInterval); _ticketsInterval = null; }
  if (_helpInterval)    { clearInterval(_helpInterval);    _helpInterval = null; }
}

/* ── Enter Application ───────────────────────────────── */
function enterApp() {
  ge('authPage').style.display = 'none';
  clearAppIntervals(); // BUG-001: clear any previous intervals before creating new ones

  if (CU.role === 'admin') {

    ge('adminApp').style.display = 'flex';
    ge('normalApp').style.display = 'none';
    var adminInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
    ge('adminAv').textContent = adminInit.toUpperCase();
    ge('adminName').textContent = CU.firstName + (CU.lastName ? ' ' + CU.lastName : '');
    showPage('dashboard');
    loadAdmin();
    _adminInterval = setInterval(loadAdmin, 6000);
  } else {
    ge('normalApp').style.display = 'flex';
    ge('adminApp').style.display = 'none';

    // BUG-002: Avatar uses 'avatar' field (not 'linePicture') from /api/auth/me
    var hAv = ge('hAv');
    if (CU.avatar) {
      hAv.outerHTML = '<img class="linepic" id="hAv" src="'+CU.avatar+'" alt="avatar" />';
    } else {
      var userInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
      ge('hAv').textContent = userInit.toUpperCase();
    }
    ge('hName').textContent = CU.firstName + (CU.lastName && CU.lastName !== '-' ? ' ' + CU.lastName : '');
    ge('secCitizen').style.display = CU.role === 'citizen' ? 'block' : 'none';
    ge('secTech').style.display   = CU.role === 'technician' ? 'block' : 'none';
    loadTickets();
    _ticketsInterval = setInterval(loadTickets, 8000);
    if (CU.role === 'technician') {
      loadHelpRequests();
      _helpInterval = setInterval(loadHelpRequests, 8000);
    }
  }
}

/* ── Load Ticket Data (citizen/tech) ─────────────────── */
async function loadTickets() {
  try {
    var res = await fetch('/api/tickets');
    if (!res.ok) return;
    var data = await res.json();
    animateNum(ge('stT'), data.length);
    animateNum(ge('stP'), data.filter(function(t){ return t.status==='pending'; }).length);
    animateNum(ge('stI'), data.filter(function(t){ return t.status==='in_progress'; }).length);
    animateNum(ge('stD'), data.filter(function(t){ return t.status==='completed'; }).length);
    if (CU.role === 'technician') renderTech(data);
    else renderCitizen(data);
  } catch(e){ console.error(e); }
}

/* ── Session Resume / Reset on Page Load ─────────────── */
(function() {
  var ap = ge('authPage');
  if (ap) ap.style.display = 'flex';

  var params = new URLSearchParams(window.location.search);
  console.log('[App] URL params:', window.location.search);
  console.log('[App] sessionStorage rn_logged_in:', sessionStorage.getItem('rn_logged_in'));

  // ── ตรวจ LINE login error params ก่อน ──
  var lineErr = params.get('line_error');
  if (lineErr) {
    var msgs = {
      cancelled: 'ยกเลิกการเข้าสู่ระบบด้วย LINE',
      invalid_state: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
      token_failed: 'ไม่สามารถยืนยัน LINE token ได้',
      profile_failed: 'ไม่สามารถดึงข้อมูล LINE profile ได้',
      server_error: 'เกิดข้อผิดพลาดบน server กรุณาลองใหม่'
    };
    console.warn('[App] LINE error param:', lineErr);
    showE('authErr', msgs[lineErr] || 'LINE Login ผิดพลาด: ' + lineErr);
    window.history.replaceState({}, '', '/');
    return;
  }

  // ── ตรวจ LINE Link pending (callback จาก LINE OAuth ครั้งแรก) ──
  var lineLinkParam = params.get('line_link');
  console.log('[App] line_link param:', lineLinkParam);
  if (lineLinkParam === 'pending') {
    console.log('[App] ✅ พบ line_link=pending → แสดง LINE Link Panel');
    sessionStorage.removeItem('rn_line_pending');
    sessionStorage.removeItem('rn_logged_in');
    window.history.replaceState({}, '', '/');

    // ซ่อน app — แสดงเฉพาะ auth page
    var _aa = ge('adminApp'); if (_aa) _aa.style.display = 'none';
    var _na = ge('normalApp'); if (_na) _na.style.display = 'none';
    var _ap = ge('authPage'); if (_ap) _ap.style.display = 'flex';

    // Force-dismiss splash ทันที
    var splashEl = document.getElementById('splash');
    if (splashEl) { splashEl.style.transition = 'opacity 0.3s'; splashEl.style.opacity = '0'; setTimeout(function(){ if (splashEl.parentNode) splashEl.parentNode.removeChild(splashEl); }, 320); }

    setTimeout(function() {
      // ซ่อน tabs + panels อื่น แสดง fLineLink panel
      var tabsEl = document.querySelector('.tabs');
      if (tabsEl) tabsEl.style.display = 'none';
      ['fLogin','fReg','fSearch'].forEach(function(id){ var el=ge(id); if(el) el.style.display='none'; });
      var otpEl = ge('fOtp'); if (otpEl) otpEl.style.display = 'none';
      var fLL = ge('fLineLink');
      if (fLL) { fLL.style.display = 'block'; }
      if (typeof openLineLinkModal === 'function') {
        openLineLinkModal().catch(function(err) { console.error('[LINE Link] error:', err); });
      }
    }, 350);
    return;
  }

  // ── ตรวจ LINE login success (callback จาก LINE OAuth สำหรับ user ที่เคยผูกแล้ว) ──
  var lineLoginParam = params.get('line_login');
  if (lineLoginParam === 'success') {
    console.log('[App] ✅ LINE login success → ตรวจ session...');
    window.history.replaceState({}, '', '/');

    fetch('/api/auth/me')
      .then(function(r) {
        if (r.ok) return r.json();
        throw new Error('no session');
      })
      .then(function(d) {
        if (!d.loggedIn) throw new Error('no session');
        console.log('[App] LINE login session ดี → enterApp() role:', d.role);
        CU = d;
        sessionStorage.setItem('rn_logged_in', '1');
        enterApp();
      })
      .catch(function() {
        console.log('[App] LINE login แต่ไม่มี session → หน้า login');
        showE('authErr', 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่');
      });
    return;
  }


  // ── ตรวจ session: resume เฉพาะเมื่อ user เคย login ใน tab นี้ (refresh) ──
  // ถ้าเปิด URL ใหม่ใน tab ใหม่ → จะไม่มี sessionStorage flag → ไปหน้า login ตลอด
  var wasLoggedIn = sessionStorage.getItem('rn_logged_in');
  sessionStorage.removeItem('rn_line_pending');

  if (!wasLoggedIn) {
    // Fresh visit (new tab / paste URL) → clear server session, show login
    console.log('[App] Fresh visit → logout server session → หน้า login');
    fetch('/api/auth/logout', { method: 'POST' }).catch(function() {});
    return;
  }

  // Tab refresh → try to resume session
  console.log('[App] Tab refresh → ตรวจ /api/auth/me...');
  fetch('/api/auth/me')
    .then(function(r) {
      console.log('[App] /api/auth/me status:', r.status);
      if (r.ok) return r.json();
      throw new Error('no session');
    })
    .then(function(d) {
      if (!d.loggedIn) throw new Error('no session');
      console.log('[App] session ดี → enterApp() role:', d.role);
      CU = d;
      sessionStorage.setItem('rn_logged_in', '1');
      enterApp();
    })
    .catch(function() {
      console.log('[App] ไม่มี session → หน้า login');
      sessionStorage.removeItem('rn_logged_in');
      fetch('/api/auth/logout', { method: 'POST' }).catch(function() {});
    });
})();

