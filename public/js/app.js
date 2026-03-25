/* ─────────────────────────────────────────────
   public/js/app.js — Application Entry Point
   • Global state
   • enterApp() — routes user to correct view
   • loadTickets() — polls ticket data
   • Session resume on page load
   ───────────────────────────────────────────── */

/* ── Global State ────────────────────────────────────── */
var CU = null;   // Current user object
var upId = null;   // Upload: target ticket ID
var upType = null;   // Upload: 'before' | 'after'
var helpTicketId = null;  // Help modal: ticket ID
var currentPage = 'dashboard';

/* ── Enter Application ───────────────────────────────── */
function enterApp() {
  ge('authPage').style.display = 'none';

  if (CU.role === 'admin') {
    // ── Admin view ──
    ge('adminApp').classList.add('on');
    var adminInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
    ge('adminAv').textContent = adminInit.toUpperCase();
    ge('adminName').textContent = CU.firstName + (CU.lastName ? ' ' + CU.lastName : '');
    loadAdmin();
    setInterval(loadAdmin, 6000);
  } else {
    // ── Citizen / Technician view ──
    ge('normalApp').classList.add('on');
    var userInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
    ge('hAv').textContent = userInit.toUpperCase();
    ge('hName').textContent = CU.firstName + (CU.lastName ? ' ' + CU.lastName : '');
    var roleLabel = CU.role === 'technician' ? 'ช่าง ' + (DEPT[CU.specialty] || '') : 'ประชาชน';
    ge('hRole').textContent = roleLabel;
    ge('secCitizen').style.display = CU.role === 'citizen' ? 'block' : 'none';
    ge('secTech').style.display = CU.role === 'technician' ? 'block' : 'none';
    loadTickets();
    setInterval(loadTickets, 8000);
    if (CU.role === 'technician') {
      loadHelpRequests();
      setInterval(loadHelpRequests, 8000);
    }
  }
}

/* ── Load Ticket Data (citizen / tech) ───────────────── */
async function loadTickets() {
  try {
    var res = await fetch('/api/tickets');
    if (!res.ok) return;
    var data = await res.json();
    ge('stT').textContent = data.length;
    ge('stP').textContent = data.filter(function (t) { return t.status === 'pending'; }).length;
    ge('stI').textContent = data.filter(function (t) { return t.status === 'in_progress'; }).length;
    ge('stD').textContent = data.filter(function (t) { return t.status === 'completed'; }).length;
    if (CU.role === 'technician') renderTech(data);
    else renderCitizen(data);
  } catch (e) { console.error(e); }
}

/* ── Session Resume on Page Load ─────────────────────── */
(function () {
  fetch('/api/auth/me')
    .then(function (r) { if (r.ok) return r.json(); throw new Error('no session'); })
    .then(function (d) { CU = d; enterApp(); })
    .catch(function () { /* not logged in — show auth page */ });
})();
