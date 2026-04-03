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
/*
 * ใช้ sessionStorage เป็นตัวแยก:
 *   มี flag  → refresh ภายใน tab เดิม → resume session ได้
 *   ไม่มี flag → เปิดลิงก์/แท็บใหม่ → logout แล้วแสดงหน้า login
 */
(function() {
  var ap = ge('authPage');
  if (ap) ap.style.display = 'flex';

  var params = new URLSearchParams(window.location.search);

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
    showE('authErr', msgs[lineErr] || 'LINE Login ผิดพลาด: ' + lineErr);
    window.history.replaceState({}, '', '/');
    return;
  }

  // ── ตรวจ LINE Link pending (callback จาก LINE OAuth ครั้งแรก) ──
  // ตรวจ URL param ก่อน sessionStorage เสมอ
  var lineLinkParam = params.get('line_link');
  if (lineLinkParam === 'pending') {
    sessionStorage.removeItem('rn_line_pending');
    sessionStorage.removeItem('rn_logged_in');
    window.history.replaceState({}, '', '/');
    // เปิด modal เชื่อมบัญชี LINE — ใช้ setTimeout เล็กน้อยเพื่อให้ DOM พร้อมก่อน
    setTimeout(function() {
      if (typeof openLineLinkModal === 'function') {
        openLineLinkModal().catch(function(err) {
          console.error('[LINE Link] openLineLinkModal error:', err);
        });
      } else {
        console.error('[LINE Link] openLineLinkModal ไม่พบฟังก์ชัน');
      }
    }, 80);
    return;
  }

  // ── ตรวจ server session เสมอ (ทั้งกรณี refresh และ tab ใหม่) ──
  // เหตุ: ถ้า logout ทันทีเมื่อไม่มี sessionStorage flag จะทำให้ session ที่ server
  //       สร้างหลัง LINE callback หรือ doLogin() ถูกลบก่อนที่จะใช้งาน (bug: bounce to login)
  sessionStorage.removeItem('rn_line_pending');
  fetch('/api/auth/me')
    .then(function(r) { if (r.ok) return r.json(); throw new Error('no session'); })
    .then(function(d) {
      CU = d;
      sessionStorage.setItem('rn_logged_in', '1');
      enterApp();
    })
    .catch(function() {
      // ไม่มี session จริง → logout ให้ clean แล้วรอหน้า login
      sessionStorage.removeItem('rn_logged_in');
      fetch('/api/auth/logout', { method: 'POST' }).catch(function() {});
    });
})();

