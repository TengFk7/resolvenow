/* ─────────────────────────────────────────────
   public/js/admin.js — Admin Dashboard Logic
   • Page navigation
   • Data loading (tickets + technicians)
   • Pie chart rendering
   • Queue rendering + auto-select tech
   • Full ticket list + status change
   • Technician status panel
   ───────────────────────────────────────────── */

/* ── Page Navigation ─────────────────────────────────── */
function showPage(page) {
  currentPage = page;
  var pages = ['pageDashboard', 'pageQueue', 'pageTechs'];
  pages.forEach(function (pid) {
    var el = ge(pid);
    var active = (pid === 'page' + page.charAt(0).toUpperCase() + page.slice(1));
    if (active) {
      el.style.display = 'block';
      // replay animation
      el.style.animation = 'none';
      el.offsetHeight; // force reflow
      el.style.animation = '';
    } else {
      el.style.display = 'none';
    }
  });
  var titles = { dashboard: 'Smart Dispatcher Dashboard', queue: 'รายการ Ticket ทั้งหมด', techs: 'สถานะทีมช่าง 7 แผนก' };
  ge('pageTitle').textContent = titles[page];
  document.querySelectorAll('.sb-item').forEach(function (el) { el.classList.remove('on'); });
  var idx = { dashboard: 0, queue: 1, techs: 2 }[page];
  document.querySelectorAll('.sb-item')[idx].classList.add('on');
}

/* ── Load All Admin Data ─────────────────────────────── */
async function loadAdmin() {
  try {
    var r1 = await fetch('/api/tickets');
    var r2 = await fetch('/api/technicians');
    var tks = await r1.json();
    var techs = await r2.json();

    // Stat cards
    var urg = tks.filter(function (t) { return t.priorityScore >= 70 && t.status !== 'completed' && t.status !== 'rejected'; }).length;
    var med = tks.filter(function (t) { return t.priorityScore >= 40 && t.priorityScore < 70 && t.status !== 'completed' && t.status !== 'rejected'; }).length;
    var nor = tks.filter(function (t) { return t.priorityScore < 40 && t.status !== 'completed' && t.status !== 'rejected'; }).length;
    var rdy = techs.filter(function (t) { return t.statusLabel === 'READY'; }).length;
    ge('sUrgent').textContent = urg;
    ge('sMed').textContent = med;
    ge('sNorm').textContent = nor;
    ge('sTR').textContent = rdy;
    ge('sTT').textContent = '/ ' + techs.length;
    ge('sTD').textContent = tks.length;

    // Pie chart
    var pend = tks.filter(function (t) { return t.status === 'pending'; }).length;
    var inpg = tks.filter(function (t) { return t.status === 'in_progress' || t.status === 'assigned'; }).length;
    var done = tks.filter(function (t) { return t.status === 'completed'; }).length;
    drawPie(pend, inpg, done);

    // Side panels
    renderTechStatus(techs);

    // Smart queue (pending only, sorted by priority)
    var pendTks = tks.filter(function (t) { return t.status === 'pending'; });
    pendTks.sort(function (a, b) { return b.priorityScore - a.priorityScore; });
    renderQueue(pendTks, techs);

    // Sub-pages
    if (currentPage === 'queue') renderAllQueue(tks);
    if (currentPage === 'techs') renderTechFull(techs);
  } catch (e) { console.error(e); }
}

/* ── Pie Chart ───────────────────────────────────────── */
function drawPie(p, i, d) {
  var canvas = ge('pieChart');
  var ctx = canvas.getContext('2d');
  var total = p + i + d || 1;
  var data = [
    { val: p, color: '#e53e3e', label: 'รอ (' + p + ')' },
    { val: i, color: '#ea580c', label: 'กำลังซ่อม (' + i + ')' },
    { val: d, color: '#1a56db', label: 'เสร็จ (' + d + ')' }
  ];
  ctx.clearRect(0, 0, 140, 140);
  var start = -Math.PI / 2, cx = 70, cy = 70, r = 60;
  for (var k = 0; k < data.length; k++) {
    var sl = (data[k].val / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + sl);
    ctx.closePath(); ctx.fillStyle = data[k].color; ctx.fill();
    start += sl;
  }
  ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  var lg = ge('pieLegend'); lg.innerHTML = '';
  for (var j = 0; j < data.length; j++)
    lg.innerHTML += '<div class="pie-item"><div class="pie-dot" style="background:' + data[j].color + '"></div><span>' + data[j].label + '</span></div>';
}

/* ── Tech Status Panel ───────────────────────────────── */
function renderTechStatus(techs) {
  var el = ge('techStatusList');
  if (!techs.length) { el.innerHTML = '<div class="empty">ไม่มีช่าง</div>'; return; }
  var h = '';
  for (var i = 0; i < techs.length; i++) {
    var t = techs[i];
    h += '<div class="tech-item"><div class="tech-row"><div><div class="tech-name">' + (DEPT_ICON[t.specialty] || '') + (DEPT[t.specialty] || t.specialty) + '</div><div class="tech-spec">' + t.name + '</div></div><span class="spill ' + t.statusLabel + '">' + t.statusLabel + '</span></div>';
    h += '<div class="prog-bar"><div class="prog-fill ' + t.statusLabel + '" style="width:' + t.capacity + '%"></div></div>';
    h += '<div class="prog-lbl">LOAD ' + t.capacity + '%</div></div>';
  }
  el.innerHTML = h;
}

/* ── Smart Queue (Pending tickets) ───────────────────── */
function renderQueue(tks, techs) {
  var el = ge('queueBody');
  if (!tks.length) { el.innerHTML = '<tr><td colspan="4" class="empty">ไม่มีงานรอ &#127881;</td></tr>'; return; }
  var h = '';
  for (var i = 0; i < tks.length; i++) {
    var t = tks[i];
    var pc = t.priorityScore >= 70 ? 'urgent' : t.priorityScore >= 40 ? 'medium' : 'normal';
    var pt = t.priorityScore >= 70 ? 'ด่วนมาก' : t.priorityScore >= 40 ? 'ด่วน' : 'ปกติ';
    var opts = '<option value="">-- เลือกช่าง --</option>';
    for (var j = 0; j < techs.length; j++) {
      var tc = techs[j];
      var match = tc.specialty === t.category;
      opts += '<option value="' + tc.id + '"' + (tc.statusLabel === 'FULL' ? ' disabled' : '') + '>' + (match ? '&#11088; ' : '') + (DEPT_ICON[tc.specialty] || '') + tc.name + ' - ' + tc.statusLabel + '</option>';
    }
    h += '<tr>';
    h += '<td><strong>#' + t.ticketId + '</strong><br/><span style="font-size:11px;color:var(--mu)">' + t.citizenName + '</span></td>';
    h += '<td><span class="pbadge ' + pc + '">' + pt + '</span><br/>' + pLabel(t.priorityScore) + '</td>';
    h += '<td><div style="font-weight:600">' + (DEPT_ICON[t.category] || '') + ' ' + (DEPT[t.category] || t.category) + ' - ' + t.location + '</div><div style="font-size:12px;color:#4a5568">' + t.description + '</div>' + (t.citizenImage ? '<img src="' + t.citizenImage + '" onclick="viewImg(this.src,\'รูป\')" style="width:60px;height:40px;object-fit:cover;border-radius:6px;margin-top:4px;cursor:pointer"/>' : '') + '</td>';
    h += '<td><div class="ai-lbl">&#129302; AI RECOMMEND</div><select class="tech-sel" id="tsel_' + t.ticketId + '">' + opts + '</select><div style="display:flex;gap:6px;margin-top:8px"><button class="btn-approve" data-id="' + t.ticketId + '" onclick="approveTicket(this)">APPROVE</button><button class="btn-rej" data-id="' + t.ticketId + '" onclick="rejectTicket(this)">REJECT</button></div></td>';
    h += '</tr>';
  }
  el.innerHTML = h;
  for (var k = 0; k < tks.length; k++) autoSelect(tks[k], techs);
}

/* ── Auto-Select Best Tech ───────────────────────────── */
function autoSelect(ticket, techs) {
  var sel = ge('tsel_' + ticket.ticketId);
  if (!sel) return;
  var spec = techs.filter(function (t) { return t.specialty === ticket.category && t.statusLabel !== 'FULL'; });
  var pool = spec.length ? spec : techs.filter(function (t) { return t.statusLabel !== 'FULL'; });
  if (!pool.length) return;
  pool.sort(function (a, b) { return a.activeJobs - b.activeJobs; });
  sel.value = pool[0].id;
}

/* ── Approve / Reject ────────────────────────────────── */
async function approveTicket(btn) {
  var id = btn.getAttribute('data-id');
  var sel = ge('tsel_' + id);
  if (!sel || !sel.value) return showToast('กรุณาเลือกช่างก่อน', true);
  var res = await fetch('/api/tickets/' + id + '/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ technicianId: sel.value }) });
  if (!res.ok) { var d = await res.json(); return showToast(d.error, true); }
  showToast('Approve แล้ว!');
  loadAdmin();
}

/* ── Global state for reject modal ──────────────────── */
var _rejectId = null;
var _rejectTicketId = null;

function rejectTicket(btn) {
  _rejectId = btn.getAttribute('data-id');
  _rejectTicketId = _rejectId;
  ge('mRejectTicketLabel').textContent = 'Ticket #' + _rejectId;
  ge('rejectReason').value = '';
  hideE('rejectErr');
  ge('mRejectStep1').style.display = 'block';
  ge('mRejectStep2').style.display = 'none';
  ge('mReject').classList.add('on');
}

function closeRejectModal() {
  ge('mReject').classList.remove('on');
  _rejectId = null;
}

function goRejectStep2() {
  ge('mRejectStep1').style.display = 'none';
  ge('mRejectStep2').style.display = 'block';
  ge('rejectReason').focus();
}

function goRejectStep1() {
  ge('mRejectStep2').style.display = 'none';
  ge('mRejectStep1').style.display = 'block';
}

async function submitReject() {
  var reason = ge('rejectReason').value.trim();
  if (!reason) return showE('rejectErr', 'กรุณาระบุเหตุผลก่อนส่ง');
  hideE('rejectErr');
  await fetch('/api/tickets/' + _rejectId + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'rejected', reason: reason })
  });
  closeRejectModal();
  showToast('ปฏิเสธแล้ว', true);
  loadAdmin();
}


/* ── All Tickets Table ───────────────────────────────── */
function renderAllQueue(tks) {
  var el = ge('allBody');
  if (!tks.length) { el.innerHTML = '<tr><td colspan="10" class="empty">ยังไม่มี Ticket</td></tr>'; return; }
  tks.sort(function (a, b) { return b.priorityScore - a.priorityScore; });
  var h = '';
  for (var i = 0; i < tks.length; i++) {
    var t = tks[i];
    h += '<tr><td><strong>' + t.ticketId + '</strong></td><td>' + t.citizenName + '</td><td>' + (DEPT_ICON[t.category] || '') + ' ' + (DEPT[t.category] || t.category) + '</td>';
    h += '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t.description + '</td>';
    h += '<td>' + pLabel(t.priorityScore) + '</td><td><span class="badge ' + t.status + '">' + stTH(t.status) + '</span></td>';
    h += '<td style="font-size:12px">' + (t.assignedName || '-') + '</td>';

    // ── รูปภาพ ──────────────────────────────────────────────
    var imgCell = '';
    if (t.status === 'completed' && (t.beforeImage || t.afterImage)) {
      imgCell += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px">';
      imgCell += '<div style="font-size:10px;font-weight:700;color:#065f46;margin-bottom:5px">✅ ก่อน / หลัง</div>';
      imgCell += '<div style="display:flex;gap:4px">';
      if (t.beforeImage) imgCell += '<div style="text-align:center"><img src="' + t.beforeImage + '" onclick="viewImg(this.src,\'ก่อน\')" style="width:54px;height:40px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid #bbf7d0"/><div style="font-size:9px;color:#065f46;margin-top:2px;font-weight:600">ก่อน</div></div>';
      if (t.afterImage) imgCell += '<div style="text-align:center"><img src="' + t.afterImage + '" onclick="viewImg(this.src,\'หลัง\')" style="width:54px;height:40px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid #bbf7d0"/><div style="font-size:9px;color:#065f46;margin-top:2px;font-weight:600">หลัง</div></div>';
      imgCell += '</div></div>';
    } else if (t.citizenImage) {
      imgCell += '<div style="text-align:center"><img src="' + t.citizenImage + '" onclick="viewImg(this.src,\'รูปผู้แจ้ง\')" style="width:54px;height:40px;object-fit:cover;border-radius:5px;cursor:pointer"/><div style="font-size:9px;color:var(--mu);margin-top:2px">ผู้แจ้ง</div></div>';
    } else {
      imgCell = '<span style="font-size:11px;color:var(--mu)">-</span>';
    }
    h += '<td>' + imgCell + '</td>';
    // ────────────────────────────────────────────────────────

    h += '<td><select data-id="' + t.ticketId + '" onchange="adminChSt(this)" style="font-size:12px;padding:4px 8px;border-radius:6px;border:1px solid var(--bd)">';
    ['pending', 'assigned', 'in_progress', 'completed', 'rejected'].forEach(function (s) {
      h += '<option value="' + s + '"' + (t.status === s ? ' selected' : '') + '>' + stTH(s) + '</option>';
    });
    h += '</select></td><td style="font-size:11px;color:var(--mu);white-space:nowrap">' + t.createdAt + '</td></tr>';
  }
  el.innerHTML = h;
}

function adminChSt(sel) {
  fetch('/api/tickets/' + sel.getAttribute('data-id') + '/status', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: sel.value })
  }).then(function () { showToast('อัปเดตแล้ว'); loadAdmin(); });
}

/* ── Technician Full Cards ───────────────────────────── */
function renderTechFull(techs) {
  var el = ge('techFullList');
  var h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">';
  for (var i = 0; i < techs.length; i++) {
    var t = techs[i];
    h += '<div style="border:1px solid var(--bd);border-radius:12px;padding:16px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px"><div><div style="font-size:20px">' + (DEPT_ICON[t.specialty] || '') + '</div><div style="font-size:14px;font-weight:700;margin-top:4px">' + (DEPT[t.specialty] || t.specialty) + '</div><div style="font-size:12px;color:var(--mu)">' + t.name + '</div></div><span class="spill ' + t.statusLabel + '">' + t.statusLabel + '</span></div>';
    h += '<div class="prog-bar" style="margin-bottom:6px"><div class="prog-fill ' + t.statusLabel + '" style="width:' + t.capacity + '%"></div></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--mu)"><span>ค้าง: ' + t.activeJobs + '</span><span>รวม: ' + t.totalJobs + '</span></div></div>';
  }
  h += '</div>';
  el.innerHTML = h;
}