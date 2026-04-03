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
    console.log('[App] ✅ พบ line_link=pending → กำลังเปิด modal...');
    sessionStorage.removeItem('rn_line_pending');
    sessionStorage.removeItem('rn_logged_in');
    window.history.replaceState({}, '', '/');
    // Force-dismiss splash ทันที (ไม่ต้องรอ 2.8s animation) และเปิด modal
    var splashEl = document.getElementById('splash');
    if (splashEl) { splashEl.style.transition = 'opacity 0.3s'; splashEl.style.opacity = '0'; setTimeout(function(){ if (splashEl.parentNode) splashEl.parentNode.removeChild(splashEl); }, 320); }
    // เปิด modal หลัง splash fade ออก (350ms)
    setTimeout(function() {
      console.log('[App] ⏰ timeout fired, openLineLinkModal type:', typeof openLineLinkModal);
      if (typeof openLineLinkModal === 'function') {
        openLineLinkModal().catch(function(err) {
          console.error('[LINE Link] openLineLinkModal error:', err);
        });
      } else {
        console.error('[LINE Link] openLineLinkModal ไม่พบฟังก์ชัน — ลอง #mLineLink ตรงๆ');
        // Fallback: เปิด modal ตรงๆ
        var m = document.getElementById('mLineLink');
        if (m) { m.classList.add('on'); console.log('[App] Fallback: modal on'); }
        else { console.error('[App] #mLineLink ไม่พบใน DOM!'); }
      }
    }, 350); // 350ms: หลัง splash fade ออก (0.3s transition)
    return;
  }

  // ── ตรวจ server session เสมอ (ทั้งกรณี refresh และ tab ใหม่) ──
  console.log('[App] ตรวจ /api/auth/me...');
  sessionStorage.removeItem('rn_line_pending');
  fetch('/api/auth/me')
    .then(function(r) {
      console.log('[App] /api/auth/me status:', r.status);
      if (r.ok) return r.json();
      throw new Error('no session');
    })
    .then(function(d) {
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

