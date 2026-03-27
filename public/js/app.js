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

/* ── Show Auth Page ──────────────────────────────────── */
function showAuth() {
  ge('authPage').style.display = 'flex';
  ge('adminApp').style.display = 'none';
  ge('normalApp').style.display = 'none';
  ge('mobNav').style.display = 'none';
}

/* ── Enter Application ───────────────────────────────── */
function enterApp() {
  ge('authPage').style.display = 'none';

  if (CU.role === 'admin') {
    ge('adminApp').style.display = 'flex';
    ge('normalApp').style.display = 'none';
    ge('mobNav').style.display = 'block';
    var adminInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
    ge('adminAv').textContent = adminInit.toUpperCase();
    ge('adminName').textContent = CU.firstName + (CU.lastName ? ' ' + CU.lastName : '');
    startClock();
    showPage('dashboard');
    loadAdmin();
    setInterval(loadAdmin, 6000);
  } else {
    ge('normalApp').style.display = 'flex';
    ge('adminApp').style.display = 'none';
    ge('mobNav').style.display = 'none';
    // Avatar: prefer LINE picture
    var hAv = ge('hAv');
    if (CU.linePicture) {
      hAv.outerHTML = '<img class="linepic" id="hAv" src="'+CU.linePicture+'" alt="avatar" />';
    } else {
      var userInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
      ge('hAv').textContent = userInit.toUpperCase();
    }
    ge('hName').textContent = CU.firstName + (CU.lastName ? ' ' + CU.lastName : '');
    var roleLabel = CU.role === 'technician' ? 'ช่าง ' + (DEPT[CU.specialty] || '') : 'ประชาชน';
    ge('hRole').textContent = roleLabel;
    ge('secCitizen').style.display = CU.role === 'citizen' ? 'block' : 'none';
    ge('secTech').style.display   = CU.role === 'technician' ? 'block' : 'none';
    loadTickets();
    setInterval(loadTickets, 8000);
    if (CU.role === 'technician') {
      loadHelpRequests();
      setInterval(loadHelpRequests, 8000);
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

/* ── Session Resume on Page Load ─────────────────────── */
(function() {
  // Show auth immediately while checking session
  ge('authPage').style.display = 'flex';
  fetch('/api/auth/me')
    .then(function(r){ if (r.ok) return r.json(); throw new Error('no session'); })
    .then(function(d){ CU = d; enterApp(); })
    .catch(function(){
      // Check for LINE login error params
      var params = new URLSearchParams(window.location.search);
      var lineErr = params.get('line_error');
      if (lineErr) {
        var msgs = {
          cancelled: 'ยกเลิกการเข้าสู่ระบบด้วย LINE',
          invalid_state: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
          token_failed: 'ไม่สามารถยืนยัน LINE token ได้',
          profile_failed: 'ไม่สามารถดึงข้อมูล LINE profile ได้',
          server_error: 'เกิดข้อผิดพลาดบน server กรุณาลองใหม่'
        };
        showE('authErr', msgs[lineErr] || 'LINE Login ผิดพลาด: '+lineErr);
        window.history.replaceState({}, '', '/');
      }
    });
})();
