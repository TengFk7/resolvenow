/* ─────────────────────────────────────────────
   public/js/admin.js — Admin Dashboard Logic
   • Page navigation
   • Data loading (tickets + technicians)
   • Pie chart rendering
   • Queue rendering + auto-select tech
   • Full ticket list + status change
   • Technician status panel
   ───────────────────────────────────────────── */

/* ── Page Navigation is handled by ui.js showPage() ──── */
/* showPage() is defined in ui.js and calls loadAdmin() when needed */

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
    animateNum(ge('sUrgent'), urg);
    animateNum(ge('sMed'), med);
    animateNum(ge('sNorm'), nor);
    animateNum(ge('sTR'), rdy);
    ge('sTT').textContent = '/ ' + techs.length;
    animateNum(ge('sTD'), tks.length);

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
    { val: p, color: '#f59e0b', label: 'รอ (' + p + ')' },
    { val: i, color: '#8b5cf6', label: 'กำลังซ่อม (' + i + ')' },
    { val: d, color: '#22c55e', label: 'เสร็จ (' + d + ')' }
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
  // center dot
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#e2e8f0'; ctx.fill();
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
    var csClass = t.statusLabel==='READY' ? 'cs-ready' : t.statusLabel==='BUSY' ? 'cs-busy' : 'cs-full';
    var initials = (t.name||'?').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('');
    h += '<div class="tech-item">';
    h += '<div class="tech-av">' + initials + '</div>';
    h += '<div class="tech-info">';
    h += '<div class="tech-name">' + (DEPT_ICON[t.specialty]||'') + ' ' + t.name + '</div>';
    h += '<div class="tech-dept">' + (DEPT[t.specialty]||t.specialty) + '</div>';
    h += '<div class="tech-bar-wrap"><div class="tech-bar" style="width:'+t.capacity+'%"></div></div>';
    h += '</div>';
    h += '<span class="cstatus ' + csClass + '">' + t.statusLabel + '</span>';
    h += '</div>';
  }
  el.innerHTML = h;
}

/* ── Smart Queue (Pending tickets) ───────────────────── */
function renderQueue(tks, techs) {
  var el = ge('queueBody');
  if (!tks.length) { el.innerHTML = '<tr><td colspan="4" class="empty">🎉 ไม่มีงานรอการอนุมัติ</td></tr>'; return; }
  var h = '';
  for (var i = 0; i < tks.length; i++) {
    var t = tks[i];
    var opts = '<option value="">— เลือกช่าง —</option>';
    for (var j = 0; j < techs.length; j++) {
      var tc = techs[j];
      var match = tc.specialty === t.category;
      opts += '<option value="'+tc.id+'"'+(tc.statusLabel==='FULL' ? ' disabled' : '')+'>'+(match ? '⭐ ' : '')+(DEPT_ICON[tc.specialty]||'')+' '+tc.name+' — '+tc.statusLabel+'</option>';
    }
    var gpsLink = (t.lat && t.lng) ? ' <a href="https://www.google.com/maps?q='+t.lat+','+t.lng+'" target="_blank" style="font-size:11px;color:var(--blue2);font-weight:600">🗺️ GPS</a>' : '';
    h += '<tr>';
    h += '<td><div style="font-weight:700;color:var(--navy);font-family:Inter,sans-serif">#'+t.ticketId+'</div><div style="font-size:11px;color:var(--muted)">'+t.citizenName+'</div></td>';
    h += '<td>'+pLabel(t.priorityScore)+'</td>';
    h += '<td><div style="font-weight:600;font-size:13px">'+( DEPT_ICON[t.category]||'')+' '+(DEPT[t.category]||t.category)+gpsLink+'</div><div style="font-size:12px;color:var(--muted);margin-top:2px">📍 '+t.location+'</div><div style="font-size:12px;color:var(--text);margin-top:2px">'+t.description+'</div>'+(t.citizenImage ? '<img src="'+t.citizenImage+'" onclick="viewImg(this.src,\'รูปผู้แจ้ง\')" class="img-thumb" style="margin-top:6px"/>' : '')+'</td>';
    h += '<td><div style="font-size:11px;font-weight:700;color:var(--blue2);margin-bottom:6px">🤖 AI RECOMMEND</div>';
    h += '<select id="tsel_'+t.ticketId+'" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:12px;font-family:Prompt,sans-serif;outline:none;background:#fff">'+opts+'</select>';
    h += '<div style="display:flex;gap:6px;margin-top:8px">';
    h += '<button class="abt abt-blue btn-ripple" data-id="'+t.ticketId+'" onclick="approveTicket(this)">✓ Approve</button>';
    h += '<button class="abt abt-red btn-ripple" data-id="'+t.ticketId+'" onclick="rejectTicket(this)">✕ Reject</button>';
    h += '</div></td>';
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
  if (!sel || !sel.value) return showToast('กรุณาเลือกช่างก่อน', 'warning');
  var res = await fetch('/api/tickets/' + id + '/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ technicianId: sel.value }) });
  if (!res.ok) { var d = await res.json(); return showToast(d.error, 'error'); }
  showToast('Approve แล้ว! 🎉', 'success');
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
  showToast('ปฏิเสธแล้ว', 'error');
  loadAdmin();
}


/* ── All Tickets Table ───────────────────────────────── */
function renderAllQueue(tks) {
  var el = ge('allBody');
  if (!tks.length) { el.innerHTML = '<tr><td colspan="10" class="empty">ยังไม่มี Ticket</td></tr>'; return; }
  tks.sort(function(a,b){ return b.priorityScore - a.priorityScore; });
  var h = '';
  for (var i = 0; i < tks.length; i++) {
    var t = tks[i];
    var gpsLink = (t.lat && t.lng) ? ' <a href="https://www.google.com/maps?q='+t.lat+','+t.lng+'" target="_blank" style="font-size:10px;color:var(--blue2);font-weight:600">🗺️</a>' : '';
    h += '<tr>';
    h += '<td style="font-family:Inter,sans-serif;font-weight:700;color:var(--navy)">'+t.ticketId+'</td>';
    h += '<td style="font-size:12px">'+t.citizenName+'</td>';
    h += '<td>'+(DEPT_ICON[t.category]||'')+' '+(DEPT[t.category]||t.category)+'</td>';
    h += '<td style="max-width:160px"><div style="font-size:12px;font-weight:600">📍 '+t.location+gpsLink+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+t.description+'</div></td>';
    h += '<td>'+pLabel(t.priorityScore)+'</td>';
    h += '<td>'+statusBadge(t.status)+'</td>';
    h += '<td style="font-size:12px">'+(t.assignedName||'<span style="color:var(--muted)">—</span>')+'</td>';
    // Images
    var imgCell = '';
    if (t.status==='completed' && (t.beforeImage||t.afterImage)) {
      imgCell = '<div style="display:flex;gap:4px">';
      if (t.beforeImage) imgCell += '<div style="text-align:center">'+imgThumb(t.beforeImage,'ก่อน')+'<div style="font-size:9px;color:var(--g);margin-top:2px;font-weight:700">ก่อน</div></div>';
      if (t.afterImage) imgCell += '<div style="text-align:center">'+imgThumb(t.afterImage,'หลัง')+'<div style="font-size:9px;color:var(--blue2);margin-top:2px;font-weight:700">หลัง</div></div>';
      imgCell += '</div>';
    } else {
      imgCell = imgThumb(t.citizenImage, 'รูปผู้แจ้ง');
    }
    h += '<td>'+imgCell+'</td>';
    h += '<td><select data-id="'+t.ticketId+'" onchange="adminChSt(this)" style="font-size:12px;padding:7px 10px;border:1.5px solid var(--border);border-radius:9px;font-family:Prompt,sans-serif;outline:none;background:#fff">';
    ['pending','assigned','in_progress','completed','rejected'].forEach(function(s){
      h += '<option value="'+s+'"'+(t.status===s ? ' selected' : '')+'>'+stTH(s)+'</option>';
    });
    h += '</select></td><td style="font-size:11px;color:var(--muted);white-space:nowrap">'+t.createdAt+'</td></tr>';
  }
  el.innerHTML = h;
}

function adminChSt(sel) {
  var id = sel.getAttribute('data-id');
  var status = sel.value;

  // If rejecting, open the reject modal so admin must provide a reason
  if (status === 'rejected') {
    _rejectId = id;
    ge('mRejectTicketLabel').textContent = 'Ticket #' + id;
    ge('rejectReason').value = '';
    hideE('rejectErr');
    ge('mRejectStep1').style.display = 'block';
    ge('mRejectStep2').style.display = 'none';
    ge('mReject').classList.add('on');
    // Reset select back to previous value (modal will handle the actual change)
    loadAdmin();
    return;
  }

  fetch('/api/tickets/' + id + '/status', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status })
  }).then(function () { showToast('อัปเดตแล้ว', 'success'); loadAdmin(); });
}

/* ── Technician Full Cards ───────────────────────────── */
function renderTechFull(techs) {
  var el = ge('techFullList');
  var h = '';
  for (var i = 0; i < techs.length; i++) {
    var t = techs[i];
    var csClass = t.statusLabel==='READY' ? 'cs-ready' : t.statusLabel==='BUSY' ? 'cs-busy' : 'cs-full';
    var initials = (t.name||'?').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('');
    h += '<div class="tech-card">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;gap:10px">';
    h += '<div class="tech-av" style="width:42px;height:42px;font-size:16px">'+initials+'</div>';
    h += '<div><div style="font-size:15px;font-weight:700;color:var(--navy)">'+(DEPT_ICON[t.specialty]||'')+' '+(DEPT[t.specialty]||t.specialty)+'</div><div style="font-size:12px;color:var(--muted)">'+t.name+'</div></div>';
    h += '</div>';
    h += '<span class="cstatus '+csClass+'">'+t.statusLabel+'</span>';
    h += '</div>';
    h += '<div class="tech-bar-wrap" style="margin-bottom:8px"><div class="tech-bar" style="width:'+t.capacity+'%"></div></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)"><span>งานค้าง: <strong style="color:var(--navy)">'+t.activeJobs+'</strong></span><span>รวมทั้งหมด: <strong style="color:var(--navy)">'+t.totalJobs+'</strong></span></div>';
    h += '</div>';
  }
  el.innerHTML = h;
}