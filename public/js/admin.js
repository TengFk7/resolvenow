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
let _lastAdminTickets = [];
let _lastAdminTechs = [];
var _queueFilter = 'all'; // 'all' | 'urgent' | 'medium' | 'normal' | 'sla'
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
    var done = tks.filter(function (t) { return t.status === 'completed'; }).length;
    animateNum(ge('sUrgent'), urg);
    animateNum(ge('sMed'), med);
    animateNum(ge('sNorm'), nor);
    animateNum(ge('sTR'), rdy);
    animateNum(ge('sDone'), done);
    ge('sTT').textContent = '/ ' + techs.length;
    animateNum(ge('sTD'), tks.length);

    // SLA breached count
    var slaCount = tks.filter(function(t) {
      if (t.status === 'completed' || t.status === 'rejected') return t.slaBreached;
      if (t.status === 'pending' && t.slaAssignDeadline) return new Date() > new Date(t.slaAssignDeadline);
      if ((t.status === 'assigned' || t.status === 'in_progress') && t.slaCompleteDeadline) return new Date() > new Date(t.slaCompleteDeadline);
      return false;
    }).length;
    animateNum(ge('sSLA'), slaCount);
    var slaCard = ge('slaStatCard');
    if (slaCard) {
      slaCard.classList.toggle('sla-ok', slaCount === 0);
    }

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
    if (currentPage === 'queue') renderAllQueue(tks, _queueFilter);
    if (currentPage === 'techs') renderTechFull(techs);
    if (currentPage === 'categories') renderCategories();

    _lastAdminTickets = tks;
    _lastAdminTechs = techs;
    if (typeof updateMapMarkers === 'function') updateMapMarkers();
  } catch (e) { console.error(e); }
}

/* ── Stat Card Filter → Queue Page ──────────────────── */
function filterAndGoQueue(filter) {
  _queueFilter = filter || 'all';
  showPage('queue');
}

/* ── Donut Chart (SVG) ───────────────────────────────── */
function drawPie(p, i, d) {
  var total = p + i + d || 1;

  // Update center number
  var centerEl = ge('ov-center-num');
  if (centerEl) animateNum(centerEl, p + i + d, true);

  // circumference of r=58 circle ≈ 364.4
  var C = 2 * Math.PI * 58;

  // Segment order: done (green) → inpg (purple) → pend (amber)
  // We draw from the bottom up so pend appears at top-left of circle
  var segs = [
    { id: 'ov-seg-done', val: d },
    { id: 'ov-seg-inpg', val: i },
    { id: 'ov-seg-pend', val: p }
  ];

  var offset = 0; // starts at 12-o-clock (rotate(-90) on SVG)
  for (var k = 0; k < segs.length; k++) {
    var el = ge(segs[k].id);
    if (!el) continue;
    var frac = segs[k].val / total;
    var dash = frac * C;
    var gap  = C - dash;
    // leave 2px gap between segments for separation
    var finalDash = Math.max(0, dash - 2);
    el.style.strokeDasharray  = finalDash + ' ' + (C - finalDash);
    el.style.strokeDashoffset = -offset;
    offset += dash;
  }

  // Legend
  var data = [
    { val: p, pct: Math.round(p / total * 100), color: 'linear-gradient(135deg,#f59e0b,#fbbf24)', label: 'รอดำเนินการ', icon: '⏳' },
    { val: i, pct: Math.round(i / total * 100), color: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', label: 'กำลังซ่อม',   icon: '🔧' },
    { val: d, pct: Math.round(d / total * 100), color: 'linear-gradient(135deg,#22c55e,#4ade80)', label: 'เสร็จสิ้น',   icon: '✅' }
  ];
  var lg = ge('pieLegend');
  if (!lg) return;
  lg.innerHTML = data.map(function(item) {
    return '<div class="ov-legend-item">' +
      '<div class="ov-legend-icon" style="background:' + item.color + '">' + item.icon + '</div>' +
      '<div class="ov-legend-body">' +
        '<div class="ov-legend-row">' +
          '<span class="ov-legend-label">' + item.label + '</span>' +
          '<span class="ov-legend-count">' + item.val + '</span>' +
        '</div>' +
        '<div class="ov-legend-bar-track"><div class="ov-legend-bar" style="width:' + item.pct + '%;background:' + item.color + '"></div></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ── Tech Status Panel ───────────────────────────────── */
function renderTechStatus(techs) {
  var el = ge('techStatusList');
  if (!techs.length) { el.innerHTML = '<div class="empty">ไม่มีช่าง</div>'; return; }
  var h = '';
  for (var i = 0; i < techs.length; i++) {
    var t = techs[i];
    var isReady = t.statusLabel === 'READY';
    var isBusy  = t.statusLabel === 'BUSY';
    var isFull  = t.statusLabel === 'FULL';
    var csClass = isReady ? 'cs-ready' : isBusy ? 'cs-busy' : 'cs-full';
    var avRing  = isReady ? 'av-ring-ready' : isBusy ? 'av-ring-busy' : 'av-ring-full';
    var barCls  = isReady ? 'tb-ready' : isBusy ? 'tb-busy' : 'tb-full';
    var cap     = parseInt(t.capacity || 0);
    var safeName = escapeHTML(t.name || '?');
    var initials = (t.name||'?').split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
    var statusIcon = isReady ? '🟢' : isBusy ? '🟡' : '🔴';
    var jobText = t.activeJobs > 0
      ? '<span class="ts-jobs">' + t.activeJobs + ' งาน</span>'
      : '<span class="ts-jobs ts-jobs-none">ว่าง</span>';

    h += '<div class="ts-card ' + (isReady ? 'ts-card-ready' : isBusy ? 'ts-card-busy' : 'ts-card-full') + '">';
    // Left: avatar with status ring
    h += '<div class="ts-av-wrap">';
    h += '<div class="ts-av ' + avRing + '">' + initials + '</div>';
    h += '<div class="ts-av-dot ' + csClass + '"></div>';
    h += '</div>';
    // Middle: name + dept + bar
    h += '<div class="ts-info">';
    h += '<div class="ts-name">' + (DEPT_ICON[t.specialty]||'') + ' ' + safeName + '</div>';
    h += '<div class="ts-dept">' + escapeHTML(DEPT[t.specialty]||t.specialty||'') + '</div>';
    h += '<div class="ts-bar-wrap">';
    h += '<div class="ts-bar ' + barCls + '" style="width:' + cap + '%"></div>';
    h += '</div>';
    h += '</div>';
    // Right: status badge + job count
    h += '<div class="ts-right">';
    h += '<span class="cstatus ' + csClass + '">' + statusIcon + ' ' + escapeHTML(t.statusLabel||'') + '</span>';
    h += jobText;
    h += '</div>';
    h += '</div>';
  }
  el.innerHTML = h;
}


/* ── Smart Queue (Pending tickets) ───────────────────── */
function renderQueue(tks, techs) {
  var el = ge('queueBody');
  var mobEl = ge('queueMobList');
  if (!tks.length) {
    el.innerHTML = '<tr><td colspan="9" class="empty">🎉 ไม่มีงานรอการอนุมัติ</td></tr>';
    if (mobEl) mobEl.innerHTML = '<div class="empty" style="text-align:center;padding:24px;color:var(--muted)">🎉 ไม่มีงานรอการอนุมัติ</div>';
    return;
  }
  var h = '';    // desktop table html
  var mh = '';   // mobile card html
  for (var i = 0; i < tks.length; i++) {
    var t = tks[i];
    var opts = '<option value="">— เลือกช่าง —</option>';
    var mobOpts = '<option value="">— เลือกช่าง —</option>';
    for (var j = 0; j < techs.length; j++) {
      var tc = techs[j];
      var match = tc.specialty === t.category;
      var optText = (match ? '⭐ ' : '') + (DEPT_ICON[tc.specialty]||'') + ' ' + tc.name + ' — ' + tc.statusLabel;
      var optAttrs = 'value="'+tc.id+'"' + (tc.statusLabel==='FULL' ? ' disabled' : '');
      opts += '<option '+optAttrs+'>'+optText+'</option>';
      mobOpts += '<option '+optAttrs+'>'+optText+'</option>';
    }
    var gpsLink = (t.lat && t.lng) ? ' <a href="https://www.google.com/maps?q='+t.lat+','+t.lng+'" target="_blank" style="font-size:10px;color:var(--blue2);font-weight:600">🗺️</a>' : '';
    var gpsUrl = (t.lat && t.lng) ? 'https://www.google.com/maps?q='+t.lat+','+t.lng : '';

    // ── Desktop table row ──
    h += '<tr>';
    h += '<td style="font-family:Inter,sans-serif;font-weight:700;color:var(--navy)">'+escapeHTML(t.ticketId)+'</td>';
    h += '<td style="font-size:12px">'+escapeHTML(t.citizenName)+'</td>';
    h += '<td>'+(DEPT_ICON[t.category]||'')+' '+escapeHTML(DEPT[t.category]||t.category)+'</td>';
    h += '<td style="max-width:160px"><div style="font-size:12px;font-weight:600">📍 '+escapeHTML(t.location||'')+gpsLink+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+escapeHTML(t.description||'')+'</div></td>';
    h += '<td>'+pLabel(t.priorityScore)+(t.upvoteCount > 0 ? '<div style="font-size:10px;margin-top:3px">👍 '+parseInt(t.upvoteCount||0)+'</div>' : '')+'</td>';
    h += '<td>' + (typeof slaLabel === 'function' ? slaLabel(t) : '') + '</td>';
    h += '<td>'+(t.citizenImage ? '<img src="'+escapeHTML(t.citizenImage)+'" onclick="viewImg(this.src,\'รูปผู้แจ้ง\')" class="img-thumb"/>' : '<span style="color:var(--muted);font-size:12px">—</span>')+'</td>';
    h += '<td style="min-width:160px"><div style="font-size:10px;font-weight:700;color:var(--blue2);margin-bottom:5px">🤖 AI RECOMMEND</div>';
    h += '<select id="tsel_'+t.ticketId+'" style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:9px;font-size:11px;font-family:Prompt,sans-serif;outline:none;background:#fff">'+opts+'</select></td>';
    h += '<td><div style="display:flex;gap:5px;flex-direction:column;align-items:center">';
    h += '<button class="abt abt-blue btn-ripple" data-id="'+t.ticketId+'" onclick="approveTicket(this)" style="padding:6px 12px;font-size:11px;white-space:nowrap">✓ Approve</button>';
    h += '<button class="abt abt-red btn-ripple" data-id="'+t.ticketId+'" onclick="rejectTicket(this)" style="padding:6px 12px;font-size:11px;white-space:nowrap">✕ Reject</button>';
    h += '</div></td>';
    h += '</tr>';

    // ── Mobile card ──
    var priorityHtml = pLabel(t.priorityScore);
    var slaHtml = (typeof slaLabel === 'function') ? slaLabel(t) : '';
    mh += '<div class="queue-mob-card">';
    // Header row: ID + priority + SLA badges
    mh += '<div class="queue-mob-card-header">';
    mh += '<div>';
    mh += '<div class="queue-mob-card-id">#'+escapeHTML(t.ticketId)+'</div>';
    mh += '<div class="queue-mob-card-citizen">👤 '+escapeHTML(t.citizenName)+'</div>';
    mh += '</div>';
    mh += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'+priorityHtml+slaHtml+'</div>';
    mh += '</div>';
    // Category + location + description
    mh += '<div class="queue-mob-card-body">';
    mh += '<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:4px">'+(DEPT_ICON[t.category]||'')+' '+escapeHTML(DEPT[t.category]||t.category)+'</div>';
    mh += '<div class="queue-mob-card-location">📍 '+escapeHTML(t.location||'')+(gpsUrl ? ' <a href="'+gpsUrl+'" target="_blank" style="font-size:11px;color:var(--blue2);font-weight:600">🗺️ GPS</a>' : '')+'</div>';
    mh += '<div class="queue-mob-card-desc">'+escapeHTML(t.description||'')+'</div>';
    mh += '</div>';
    // Image + meta
    if (t.citizenImage) {
      mh += '<div class="queue-mob-card-meta">';
      mh += '<img src="'+escapeHTML(t.citizenImage)+'" class="queue-mob-card-img" onclick="viewImg(this.src,\'รูปผู้แจ้ง\')" title="รูปผู้แจ้ง"/>';
      mh += '<span style="font-size:11px;color:var(--muted)">รูปประกอบ</span>';
      mh += '</div>';
    }
    if (t.upvoteCount > 0) {
      mh += '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">👍 '+parseInt(t.upvoteCount||0)+' upvote</div>';
    }
    // Assign dropdown
    mh += '<div class="queue-mob-assign-label">🤖 AI RECOMMEND — เลือกช่าง</div>';
    mh += '<select id="tsel_mob_'+t.ticketId+'" class="queue-mob-select" onchange="document.getElementById(\'tsel_'+t.ticketId+'\') && (document.getElementById(\'tsel_'+t.ticketId+'\').value=this.value)">'+mobOpts+'</select>';
    // Action buttons
    mh += '<div class="queue-mob-actions">';
    mh += '<button class="queue-mob-btn-approve btn-ripple" data-id="'+t.ticketId+'" onclick="approveMob(this)">✓ Approve</button>';
    mh += '<button class="queue-mob-btn-reject btn-ripple" data-id="'+t.ticketId+'" onclick="rejectTicket(this)">✕ Reject</button>';
    mh += '</div>';
    mh += '</div>';
  }
  el.innerHTML = h;
  if (mobEl) mobEl.innerHTML = mh;
  for (var k = 0; k < tks.length; k++) autoSelect(tks[k], techs);
}

/* ── Auto-Select Best Tech ───────────────────────────── */
function autoSelect(ticket, techs) {
  var sel = ge('tsel_' + ticket.ticketId);
  var mobSel = ge('tsel_mob_' + ticket.ticketId);
  var spec = techs.filter(function (t) { return t.specialty === ticket.category && t.statusLabel !== 'FULL'; });
  var pool = spec.length ? spec : techs.filter(function (t) { return t.statusLabel !== 'FULL'; });
  if (!pool.length) return;
  pool.sort(function (a, b) { return a.activeJobs - b.activeJobs; });
  var bestId = pool[0].id;
  if (sel) sel.value = bestId;
  if (mobSel) mobSel.value = bestId;
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

/* ── Approve from Mobile Card ────────────────────────── */
async function approveMob(btn) {
  var id = btn.getAttribute('data-id');
  // Read from mobile dropdown first, fallback to desktop
  var mobSel = ge('tsel_mob_' + id);
  var deskSel = ge('tsel_' + id);
  var techId = (mobSel && mobSel.value) ? mobSel.value : (deskSel ? deskSel.value : '');
  if (!techId) return showToast('กรุณาเลือกช่างก่อน', 'warning');
  var res = await fetch('/api/tickets/' + id + '/assign', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ technicianId: techId }) });
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

/* ── Leaflet Map View ────────────────────────────────── */
let _adminMap = null;
let _mapMarkers = [];
let _isMapMode = false;

window.toggleMap = function() {
  _isMapMode = !_isMapMode;
  if (_isMapMode) {
    ge('queueTableContainer').style.display = 'none';
    ge('queueMapContainer').style.display = 'block';
    ge('btnToggleMap').style.background = 'var(--navy)';
    ge('btnToggleMap').style.color = '#fff';
    ge('btnToggleMap').innerHTML = '📋 ตาราง';
    initMapIfNeeded();
  } else {
    ge('queueTableContainer').style.display = 'block';
    ge('queueMapContainer').style.display = 'none';
    ge('btnToggleMap').style.background = '#f1f5f9';
    ge('btnToggleMap').style.color = 'var(--navy)';
    ge('btnToggleMap').innerHTML = '🗺️ แผนที่';
  }
};

window.initMapIfNeeded = function() {
  if (!_adminMap) {
    _adminMap = L.map('queueMapContainer').setView([13.829, 100.551], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap, © CARTO'
    }).addTo(_adminMap);
  }
  setTimeout(function() { _adminMap.invalidateSize(); updateMapMarkers(); }, 100);
};

window.updateMapMarkers = function() {
  if (!_adminMap || !_lastAdminTickets) return;
  // Clear old markers
  _mapMarkers.forEach(function(m) { _adminMap.removeLayer(m); });
  _mapMarkers = [];

  var active = _lastAdminTickets.filter(t => t.status !== 'completed' && t.status !== 'rejected');
  
  // Custom icons mapping
  var icons = {
    Road: '🛣️', Water: '💧', Electricity: '💡', Garbage: '🗑️', Animal: '🐍', Tree: '🌿', Hazard: '🚨'
  };

  active.forEach(function(t) {
    if (t.lat && t.lng) {
      var marker = L.marker([t.lat, t.lng]).addTo(_adminMap);
      var iText = icons[t.category] || '📍';
      var dText = escapeHTML(t.description || 'ไม่มีรายละเอียด').substring(0, 50);
      var stText = escapeHTML(t.status);
      var popHtml = `<b>${t.ticketId}</b><br>${iText} ${escapeHTML(t.category)}<br>${dText}<br><b>สถานะ: ${stText}</b>`;
      marker.bindPopup(popHtml);
      _mapMarkers.push(marker);
    }
  });
};

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
function renderAllQueue(tks, filter) {
  var el = ge('allBody');
  var now = new Date();

  // ── Apply filter ──
  var filtered = tks;
  var filterLabel = null;
  if (filter === 'urgent') {
    filtered = tks.filter(function(t) { return t.priorityScore >= 70 && t.status !== 'completed' && t.status !== 'rejected'; });
    filterLabel = '🔴 งานด่วนมาก (คะแนน ≥ 70)';
  } else if (filter === 'medium') {
    filtered = tks.filter(function(t) { return t.priorityScore >= 40 && t.priorityScore < 70 && t.status !== 'completed' && t.status !== 'rejected'; });
    filterLabel = '🟡 งานด่วน (คะแนน 40–69)';
  } else if (filter === 'normal') {
    filtered = tks.filter(function(t) { return t.priorityScore < 40 && t.status !== 'completed' && t.status !== 'rejected'; });
    filterLabel = '🟢 งานปกติ (คะแนน < 40)';
  } else if (filter === 'sla') {
    filtered = tks.filter(function(t) {
      if (t.status === 'completed' || t.status === 'rejected') return t.slaBreached;
      if (t.status === 'pending' && t.slaAssignDeadline) return new Date() > new Date(t.slaAssignDeadline);
      if ((t.status === 'assigned' || t.status === 'in_progress') && t.slaCompleteDeadline) return new Date() > new Date(t.slaCompleteDeadline);
      return false;
    });
    filterLabel = '⏰ งานล่าช้า (SLA เกินกำหนด)';
  } else if (filter === 'completed') {
    filtered = tks.filter(function(t) { return t.status === 'completed'; });
    filterLabel = '✅ งานสำเร็จแล้ว';
  }

  // ── Filter chip above table ──
  var chipEl = ge('queueFilterChip');
  if (chipEl) {
    if (filterLabel) {
      var chipColor = filter === 'completed' ? '#f0fdf4' : '#fff0f0';
      var chipBorder = filter === 'completed' ? '#86efac' : '#fca5a5';
      var chipText = filter === 'completed' ? '#15803d' : '#b91c1c';
      chipEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;background:' + chipColor + ';border:1.5px solid ' + chipBorder + ';border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;color:' + chipText + '">' +
        filterLabel +
        '<button onclick="clearQueueFilter()" style="background:none;border:none;cursor:pointer;font-size:14px;line-height:1;color:' + chipText + ';padding:0;margin-left:2px" title="ล้างตัวกรอง">✕</button>' +
        '</span>';
      chipEl.style.display = 'block';
    } else {
      chipEl.innerHTML = '';
      chipEl.style.display = 'none';
    }
  }

  if (!filtered.length) {
    el.innerHTML = '<tr><td colspan="11" class="empty">' + (filterLabel ? (filter === 'completed' ? '🎉 ยังไม่มีงานที่สำเร็จ' : '✅ ไม่มีงานในหมวดนี้') : 'ยังไม่มี Ticket') + '</td></tr>';
    return;
  }
  // completed: เรียงตามเวลาอัปเดตล่าสุดก่อน; อื่นๆ เรียงตาม priority
  if (filter === 'completed') {
    filtered.sort(function(a, b) { return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt); });
  } else {
    filtered.sort(function(a,b){ return b.priorityScore - a.priorityScore; });
  }
  var h = '';
  for (var i = 0; i < filtered.length; i++) {
    var t = filtered[i];
    var gpsLink = (t.lat && t.lng) ? ' <a href="https://www.google.com/maps?q='+t.lat+','+t.lng+'" target="_blank" style="font-size:10px;color:var(--blue2);font-weight:600">🗺️</a>' : '';
    h += '<tr>';
    h += '<td style="font-family:Inter,sans-serif;font-weight:700;color:var(--navy)">'+t.ticketId+'</td>';
    h += '<td style="font-size:12px">'+escapeHTML(t.citizenName)+'</td>';
    h += '<td>'+(DEPT_ICON[t.category]||'')+' '+escapeHTML(DEPT[t.category]||t.category)+'</td>';
    h += '<td style="max-width:160px"><div style="font-size:12px;font-weight:600">📍 '+escapeHTML(t.location)+gpsLink+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+escapeHTML(t.description)+'</div></td>';
    h += '<td>'+pLabel(t.priorityScore)+'</td>';
    h += '<td>'+statusBadge(t.status)+'</td>';
    h += '<td style="font-size:12px">'+(t.assignedName ? escapeHTML(t.assignedName) : '<span style="color:var(--muted)">—</span>')+'</td>';
    h += '<td>' + (typeof slaLabel === 'function' ? slaLabel(t) : '') + '</td>';
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
    h += '</select></td><td style="font-size:11px;color:var(--muted);white-space:nowrap">'+fmtDate(t.createdAt)+'</td>';
    h += '<td><div style="display:flex;gap:6px;flex-direction:column;align-items:center;padding:2px 6px"><button class="btn-chat" onclick="openTicketChat(\''+t.ticketId+'\')">💬</button><button class="abt abt-red btn-ripple" data-id="'+t.ticketId+'" onclick="openDeleteModal(this)" title="ลบ Ticket" style="padding:6px 10px;font-size:12px">🗑️</button></div></td>';
    h += '</tr>';
  }
  el.innerHTML = h;
}

function clearQueueFilter() {
  _queueFilter = 'all';
  renderAllQueue(_lastAdminTickets, 'all');
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
  }).then(function(r) {
    return r.json().then(function(d) { return { ok: r.ok, data: d }; });
  }).then(function(result) {
    if (!result.ok) {
      // BUG-014: show error if transition is invalid, then reload to sync dropdown
      showToast(result.data.error || 'ไม่สามารถเปลี่ยนสถานะได้', 'error');
    } else {
      showToast('อัปเดตแล้ว', 'success');
    }
    loadAdmin(); // always reload to keep UI in sync
  });
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
    h += '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:10px"><span>งานค้าง: <strong style="color:var(--navy)">'+t.activeJobs+'</strong></span><span>รวมทั้งหมด: <strong style="color:var(--navy)">'+t.totalJobs+'</strong></span></div>';
    h += '<div style="display:flex;gap:6px">';
    h += '<button class="cat-btn cat-btn-edit btn-ripple" style="font-size:11px;padding:7px 0" onclick="openEditTechModal(\''+t.id+'\')">✏️ แก้ไข</button>';
    h += '<button class="cat-btn cat-btn-del btn-ripple" style="font-size:11px;padding:7px 0;max-width:42px" onclick="deleteTech(\''+t.id+'\',\''+escapeHTML(t.name)+'\')">🗑️</button>';
    h += '</div>';
    h += '</div>';
  }
  el.innerHTML = h;
}

/* ── Add Tech Modal ──────────────────────────────────── */
var _editTechId = null;

function _populateSpecialtySelect(selId) {
  var sel = ge(selId);
  if (!sel) return;
  var cats = _categoriesCache || [];
  sel.innerHTML = '<option value="">— ไม่ระบุ —</option>';
  for (var i = 0; i < cats.length; i++) {
    sel.innerHTML += '<option value="' + escapeHTML(cats[i].name) + '">' + cats[i].icon + ' ' + escapeHTML(cats[i].label) + '</option>';
  }
}

function openAddTechModal() {
  ge('addTechFname').value = '';
  ge('addTechLname').value = '';
  ge('addTechEmail').value = '';
  ge('addTechPwd').value = '';
  hideE('addTechErr');
  _populateSpecialtySelect('addTechSpecialty');
  ge('mAddTech').classList.add('on');
  setTimeout(function() { ge('addTechFname').focus(); }, 200);
}

function closeAddTechModal() {
  ge('mAddTech').classList.remove('on');
}

async function submitAddTech() {
  var fn = ge('addTechFname').value.trim();
  var ln = ge('addTechLname').value.trim();
  var em = ge('addTechEmail').value.trim();
  var pw = ge('addTechPwd').value;
  var sp = ge('addTechSpecialty').value;
  if (!fn) return showE('addTechErr', 'กรุณากรอกชื่อ');
  if (!em) return showE('addTechErr', 'กรุณากรอกอีเมล');
  if (!pw || pw.length < 6) return showE('addTechErr', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  hideE('addTechErr');

  try {
    var res = await fetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: fn, lastName: ln || '-', email: em, password: pw, specialty: sp })
    });
    var data = await res.json();
    if (!res.ok) return showE('addTechErr', data.error || 'เกิดข้อผิดพลาด');
    closeAddTechModal();
    showToast('เพิ่มช่าง "' + data.name + '" สำเร็จ 👷', 'success');
    loadAdmin();
  } catch (e) { showE('addTechErr', 'เกิดข้อผิดพลาด'); }
}

/* ── Edit Tech Modal ─────────────────────────────────── */
function openEditTechModal(techId) {
  _editTechId = techId;
  // Find tech from last admin data
  var techs = _lastAdminTechs || [];
  var tech = techs.find(function(t) { return t.id === techId; });
  if (!tech) return;

  ge('editTechFname').value = tech.firstName || '';
  ge('editTechLname').value = tech.lastName || '';
  ge('editTechEmail').textContent = tech.email || '';
  hideE('editTechErr');
  _populateSpecialtySelect('editTechSpecialty');
  ge('editTechSpecialty').value = tech.specialty || '';
  ge('mEditTech').classList.add('on');
  setTimeout(function() { ge('editTechFname').focus(); }, 200);
}

function closeEditTechModal() {
  ge('mEditTech').classList.remove('on');
  _editTechId = null;
}

async function submitEditTech() {
  if (!_editTechId) return;
  var fn = ge('editTechFname').value.trim();
  var ln = ge('editTechLname').value.trim();
  var sp = ge('editTechSpecialty').value;
  if (!fn) return showE('editTechErr', 'กรุณากรอกชื่อ');
  hideE('editTechErr');

  try {
    var res = await fetch('/api/technicians/' + _editTechId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: fn, lastName: ln || '-', specialty: sp })
    });
    var data = await res.json();
    if (!res.ok) return showE('editTechErr', data.error || 'เกิดข้อผิดพลาด');
    closeEditTechModal();
    showToast('อัปเดตข้อมูลช่างสำเร็จ ✏️', 'success');
    loadAdmin();
  } catch (e) { showE('editTechErr', 'เกิดข้อผิดพลาด'); }
}

/* ── Delete Tech ─────────────────────────────────────── */
async function deleteTech(techId, techName) {
  if (!confirm('ลบช่าง "' + techName + '" ? (ถ้ามีงานค้างจะลบไม่ได้)')) return;
  try {
    var res = await fetch('/api/technicians/' + techId, { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) { showToast(data.error || 'ลบไม่สำเร็จ', 'error'); return; }
    showToast('ลบช่างสำเร็จ 🗑️', 'success');
    loadAdmin();
  } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

/* ── Delete Ticket Modal ───────────────────────────────── */
var _deleteTicketId = null;

function openDeleteModal(btn) {
  _deleteTicketId = btn.getAttribute('data-id');
  ge('mDeleteTicketLabel').textContent = 'Ticket #' + _deleteTicketId;
  ge('mDelete').classList.add('on');
}

function closeDeleteModal() {
  ge('mDelete').classList.remove('on');
  _deleteTicketId = null;
}

async function confirmDeleteTicket() {
  if (!_deleteTicketId) return;
  var btn = ge('btnConfirmDelete');
  btn.disabled = true;
  btn.textContent = 'กำลังลบ...';
  try {
    var res = await fetch('/api/tickets/' + _deleteTicketId, { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) { showToast(data.error || 'ลบไม่สำเร็จ', 'error'); }
    else { showToast('ลบ Ticket #' + _deleteTicketId + ' เรียบร้อยแล้ว 🗑️', 'success'); }
  } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
  closeDeleteModal();
  btn.disabled = false;
  btn.textContent = '🗑️ ลบถาวร';
  loadAdmin();
}

/* ── Delete ALL Tickets ─────────────────────────────────── */
// PASSWORD-FIX: ลบ hardcode ออก — server-side เป็นคนตรวจ password แทน
var _pendingDeleteAllPw = '';

function openDeleteAllModal() {
  ge('deleteAllPwInput').value = '';
  hideE('deleteAllPwErr');
  ge('mDeleteAllPw').classList.add('on');
  setTimeout(function () { ge('deleteAllPwInput').focus(); }, 200);
}

function closeDeleteAllPw() {
  ge('mDeleteAllPw').classList.remove('on');
  ge('deleteAllPwInput').value = '';
  hideE('deleteAllPwErr');
  _pendingDeleteAllPw = '';
}

function submitDeleteAllPw() {
  var pw = ge('deleteAllPwInput').value;
  if (!pw) {
    showE('deleteAllPwErr', 'กรุณากรอกรหัสผ่าน');
    return;
  }
  // เก็บชั่วคราวเพื่อส่งไปกับ DELETE request — server เป็นคนตรวจ
  _pendingDeleteAllPw = pw;
  closeDeleteAllPw();
  ge('mDeleteAllConfirm').classList.add('on');
}

function closeDeleteAllConfirm() {
  ge('mDeleteAllConfirm').classList.remove('on');
}

async function confirmDeleteAll() {
  var btn = ge('btnConfirmDeleteAll');
  btn.disabled = true;
  btn.textContent = 'กำลังลบ...';
  try {
    var res = await fetch('/api/tickets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: _pendingDeleteAllPw })
    });
    var data = await res.json();
    if (!res.ok) {
      // server-side password check — แสดง error และเปิด modal ให้กรอกใหม่
      closeDeleteAllConfirm();
      setTimeout(function() {
        ge('deleteAllPwInput').value = '';
        hideE('deleteAllPwErr');
        showE('deleteAllPwErr', data.error || 'รหัสผ่านไม่ถูกต้อง');
        var inp = ge('deleteAllPwInput');
        inp.classList.remove('pw-shake');
        void inp.offsetWidth;
        inp.classList.add('pw-shake');
        setTimeout(function() { inp.classList.remove('pw-shake'); }, 450);
        ge('mDeleteAllPw').classList.add('on');
        inp.focus();
      }, 100);
    } else {
      showToast('ลบ Ticket ทั้งหมด ' + (data.deleted || '') + ' รายการ เรียบร้อยแล้ว 🗑️', 'success');
    }
  } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
  closeDeleteAllConfirm();
  _pendingDeleteAllPw = '';
  btn.disabled = false;
  btn.textContent = '🗑️ ลบทั้งหมด';
  loadAdmin();
}


/* ══════════════════════════════════════════════════════════
   CATEGORY MANAGEMENT
══════════════════════════════════════════════════════════ */

var EMOJI_PRESETS = [
  '🛣️','💧','💡','🗑️','🐍','🌿','🚨','🌊','🔥','🏗️',
  '🚗','🚰','🏠','🏥','🏫','🏢','🚧','⚡','🌳','🐕',
  '🐈','🐀','🦟','💨','🌧️','🌪️','☀️','🔔','📢','🔇',
  '🚽','🚿','🛠️','🔨','⛽','🅿️','♻️','🧹','🧪','🏭',
  '🎵','📡','🚦','🛤️','🏖️','🌉','⚠️','🔌','🚲','🛵',
  '🏕️','🗼','🏗️','🧱','🪵','🪨','🛶','⛲','🗺️','📌',
  '🔧','🔩','⚙️','🧰','🪛','🔬','🔭','💊','💉','🩺',
  '🐾','🦎','🐢','🦅','🐝','🦇','🐟','🪴','🌻','🍂'
];

var _editCatId = null;
var _deleteCatId = null;
var _techLinkCatId = null;
var _techLinkCatName = null;

/* ── Render Category Cards ──────────────────────────── */
async function renderCategories() {
  var el = ge('catMgmtGrid');
  if (!el) return;
  try {
    var res = await fetch('/api/categories');
    if (!res.ok) { el.innerHTML = '<div class="empty">โหลดไม่สำเร็จ</div>'; return; }
    var cats = await res.json();
    if (!cats.length) { el.innerHTML = '<div class="empty">ยังไม่มีหมวดหมู่</div>'; return; }

    var h = '';
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      var techNames = c.technicians.map(function(t) { return t.name; }).join(', ') || '<span style="color:var(--muted)">ยังไม่มีช่าง</span>';
      h += '<div class="cat-mgmt-card">';
      h += '<div class="cat-mgmt-header">';
      h += '<div class="cat-mgmt-icon">' + c.icon + '</div>';
      h += '<div class="cat-mgmt-info">';
      h += '<div class="cat-mgmt-name">' + escapeHTML(c.label) + '</div>';
      h += '<div class="cat-mgmt-key">' + escapeHTML(c.name) + (c.isDefault ? ' <span class="cat-default-badge">ค่าเริ่มต้น</span>' : '') + '</div>';
      h += '</div>';
      h += '</div>';
      h += '<div class="cat-mgmt-techs">';
      h += '<div class="cat-mgmt-tech-label">🔧 ช่างที่ผูก (' + c.techCount + ')</div>';
      h += '<div class="cat-mgmt-tech-names">' + techNames + '</div>';
      h += '</div>';
      h += '<div class="cat-mgmt-actions">';
      h += '<button class="cat-btn cat-btn-tech btn-ripple" onclick="openTechLinkModal(\'' + c._id + '\',\'' + escapeHTML(c.label) + '\')">🔧 จัดการช่าง</button>';
      h += '<button class="cat-btn cat-btn-edit btn-ripple" onclick="openEditCategoryModal(\'' + c._id + '\')">✏️ แก้ไข</button>';
      h += '<button class="cat-btn cat-btn-del btn-ripple" onclick="openDeleteCategoryModal(\'' + c._id + '\',\'' + escapeHTML(c.icon + ' ' + c.label) + '\')" ' + (c.isDefault ? 'title="หมวดค่าเริ่มต้น"' : '') + '>🗑️</button>';
      h += '</div>';
      h += '</div>';
    }
    el.innerHTML = h;
  } catch (e) { console.error(e); el.innerHTML = '<div class="empty">เกิดข้อผิดพลาด</div>'; }
}

/* ── Emoji Picker ───────────────────────────────────── */
function renderEmojiPicker(gridId, inputId) {
  var grid = ge(gridId);
  if (!grid) return;
  var h = '';
  for (var i = 0; i < EMOJI_PRESETS.length; i++) {
    var em = EMOJI_PRESETS[i];
    h += '<button type="button" class="emoji-pick-btn" data-emoji="' + em + '" onclick="selectEmoji(this,\'' + inputId + '\')">' + em + '</button>';
  }
  grid.innerHTML = h;
}

function selectEmoji(btn, inputId) {
  // Remove selection from siblings
  var parent = btn.parentElement;
  parent.querySelectorAll('.emoji-pick-btn').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
  ge(inputId).value = btn.dataset.emoji;
  // Preview
  var preview = inputId === 'addCatIcon' ? ge('selectedEmojiPreview') : null;
  if (preview) preview.innerHTML = 'เลือก: <strong style="font-size:20px">' + btn.dataset.emoji + '</strong>';
}

/* ── Add Category Modal ─────────────────────────────── */
function openAddCategoryModal() {
  ge('addCatName').value = '';
  ge('addCatLabel').value = '';
  ge('addCatIcon').value = '';
  hideE('addCatErr');
  ge('selectedEmojiPreview').innerHTML = '';
  renderEmojiPicker('emojiPickerGrid', 'addCatIcon');
  ge('mAddCategory').classList.add('on');
  setTimeout(function() { ge('addCatName').focus(); }, 200);
}

function closeAddCategoryModal() {
  ge('mAddCategory').classList.remove('on');
}

async function submitAddCategory() {
  var name = ge('addCatName').value.trim();
  var label = ge('addCatLabel').value.trim();
  var icon = ge('addCatIcon').value.trim();
  if (!name) return showE('addCatErr', 'กรุณากรอกชื่อ Key');
  if (!label) return showE('addCatErr', 'กรุณากรอกชื่อแสดงผล');
  if (!icon) return showE('addCatErr', 'กรุณาเลือก Emoji');
  hideE('addCatErr');

  try {
    var res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, label: label, icon: icon })
    });
    var data = await res.json();
    if (!res.ok) return showE('addCatErr', data.error || 'เกิดข้อผิดพลาด');
    closeAddCategoryModal();
    showToast('สร้างหมวดหมู่ "' + label + '" สำเร็จ 🎉', 'success');
    await loadCategories();
    renderCategories();
  } catch (e) { showE('addCatErr', 'เกิดข้อผิดพลาด'); }
}

/* ── Edit Category Modal ────────────────────────────── */
function openEditCategoryModal(catId) {
  _editCatId = catId;
  var cats = _categoriesCache || [];
  var cat = cats.find(function(c) { return c._id === catId; });
  if (!cat) return;

  ge('editCatCurrentIcon').textContent = cat.icon;
  ge('editCatCurrentName').textContent = cat.name;
  ge('editCatLabel').value = cat.label;
  ge('editCatIcon').value = cat.icon;
  hideE('editCatErr');
  renderEmojiPicker('editEmojiPickerGrid', 'editCatIcon');
  // Pre-select current emoji
  setTimeout(function() {
    var btns = ge('editEmojiPickerGrid').querySelectorAll('.emoji-pick-btn');
    btns.forEach(function(b) {
      if (b.dataset.emoji === cat.icon) b.classList.add('selected');
    });
  }, 50);
  ge('mEditCategory').classList.add('on');
}

function closeEditCategoryModal() {
  ge('mEditCategory').classList.remove('on');
  _editCatId = null;
}

async function submitEditCategory() {
  if (!_editCatId) return;
  var label = ge('editCatLabel').value.trim();
  var icon = ge('editCatIcon').value.trim();
  if (!label) return showE('editCatErr', 'กรุณากรอกชื่อแสดงผล');
  hideE('editCatErr');

  try {
    var res = await fetch('/api/categories/' + _editCatId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label, icon: icon })
    });
    var data = await res.json();
    if (!res.ok) return showE('editCatErr', data.error || 'เกิดข้อผิดพลาด');
    closeEditCategoryModal();
    showToast('แก้ไขหมวดหมู่สำเร็จ ✏️', 'success');
    await loadCategories();
    renderCategories();
  } catch (e) { showE('editCatErr', 'เกิดข้อผิดพลาด'); }
}

/* ── Delete Category Modal ──────────────────────────── */
function openDeleteCategoryModal(catId, catLabel) {
  _deleteCatId = catId;
  ge('mDeleteCatLabel').textContent = catLabel;
  hideE('deleteCatErr');
  ge('mDeleteCategory').classList.add('on');
}

function closeDeleteCategoryModal() {
  ge('mDeleteCategory').classList.remove('on');
  _deleteCatId = null;
}

async function confirmDeleteCategory() {
  if (!_deleteCatId) return;
  var btn = ge('btnConfirmDeleteCat');
  btn.disabled = true;
  btn.textContent = 'กำลังลบ...';
  try {
    var res = await fetch('/api/categories/' + _deleteCatId, { method: 'DELETE' });
    var data = await res.json();
    if (!res.ok) {
      showE('deleteCatErr', data.error || 'ลบไม่สำเร็จ');
      btn.disabled = false;
      btn.textContent = '🗑️ ลบถาวร';
      return;
    }
    closeDeleteCategoryModal();
    showToast('ลบหมวดหมู่สำเร็จ 🗑️', 'success');
    await loadCategories();
    renderCategories();
  } catch (e) { showE('deleteCatErr', 'เกิดข้อผิดพลาด'); }
  btn.disabled = false;
  btn.textContent = '🗑️ ลบถาวร';
}

/* ── Tech Link Modal ────────────────────────────────── */
async function openTechLinkModal(catId, catLabel) {
  _techLinkCatId = catId;
  _techLinkCatName = catLabel;
  ge('techLinkCatName').textContent = catLabel;
  ge('techLinkList').innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:var(--muted);font-size:13px">⏳ กำลังโหลด...</div>';
  ge('mTechLink').classList.add('on');

  try {
    // Fetch all technicians + current category data
    var res1 = await fetch('/api/technicians');
    var res2 = await fetch('/api/categories');
    if (!res1.ok || !res2.ok) return;
    var allTechs = await res1.json();
    var cats = await res2.json();
    var cat = cats.find(function(c) { return c._id === catId; });
    var linkedIds = cat ? cat.technicians.map(function(t) { return t._id; }) : [];

    var el = ge('techLinkList');
    if (!allTechs.length) { el.innerHTML = '<div class="empty" style="padding:20px;text-align:center">ไม่มีช่างในระบบ</div>'; return; }

    var h = '';
    for (var i = 0; i < allTechs.length; i++) {
      var t = allTechs[i];
      var isLinked = linkedIds.indexOf(t.id) >= 0;
      var specialtyTH = (DEPT[t.specialty] || t.specialty || 'ไม่ระบุแผนก');
      h += '<label class="tech-link-item' + (isLinked ? ' linked' : '') + '">';
      h += '<input type="checkbox" class="tech-link-cb" value="' + t.id + '"' + (isLinked ? ' checked' : '') + ' />';
      h += '<div class="tech-link-info">';
      h += '<div class="tech-link-name">' + (DEPT_ICON[t.specialty] || '👤') + ' ' + escapeHTML(t.name) + '</div>';
      h += '<div class="tech-link-dept">' + escapeHTML(specialtyTH) + ' — ' + t.statusLabel + '</div>';
      h += '</div>';
      h += '<span class="tech-link-status ' + (isLinked ? 'tls-on' : 'tls-off') + '">' + (isLinked ? '✅' : '—') + '</span>';
      h += '</label>';
    }
    el.innerHTML = h;

    // Toggle visual on change
    el.querySelectorAll('.tech-link-cb').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var item = this.closest('.tech-link-item');
        var status = item.querySelector('.tech-link-status');
        if (this.checked) {
          item.classList.add('linked');
          status.className = 'tech-link-status tls-on';
          status.textContent = '✅';
        } else {
          item.classList.remove('linked');
          status.className = 'tech-link-status tls-off';
          status.textContent = '—';
        }
      });
    });
  } catch (e) { console.error(e); }
}

function closeTechLinkModal() {
  ge('mTechLink').classList.remove('on');
  _techLinkCatId = null;
}

async function saveTechLinks() {
  if (!_techLinkCatId) return;
  var checkboxes = ge('techLinkList').querySelectorAll('.tech-link-cb:checked');
  var ids = [];
  checkboxes.forEach(function(cb) { ids.push(cb.value); });

  var btn = ge('btnSaveTechLinks');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';
  try {
    var res = await fetch('/api/categories/' + _techLinkCatId + '/technicians', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technicianIds: ids })
    });
    var data = await res.json();
    if (!res.ok) { showToast(data.error || 'เกิดข้อผิดพลาด', 'error'); }
    else {
      showToast('อัปเดตช่างสำเร็จ — ' + data.techCount + ' คน 🔧', 'success');
      closeTechLinkModal();
      await loadCategories();
      renderCategories();
    }
  } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
  btn.disabled = false;
  btn.textContent = '💾 บันทึก';
}


/* ══════════════════════════════════════════════════════════
   REPORT EXPORT SYSTEM
══════════════════════════════════════════════════════════ */

/* ── Helpers ─────────────────────────────────────────────── */
function _getSelectedRange() {
  var radios = document.querySelectorAll('input[name="reportRange"]');
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) return radios[i].value;
  }
  return 'this_month';
}

function _thMonthName(d) {
  return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

/* ── Open / Close Report Modal ─────────────────────────── */
function openReportModal() {
  // Populate month labels
  var now = new Date();
  var thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var el1 = ge('rngThisMonthLabel');
  var el2 = ge('rngLastMonthLabel');
  if (el1) el1.textContent = _thMonthName(thisMonth);
  if (el2) el2.textContent = _thMonthName(lastMonth);

  // Reset status
  var st = ge('reportStatus');
  if (st) st.textContent = '';

  // Radio highlight binding
  var opts = document.querySelectorAll('.report-range-opt');
  opts.forEach(function(opt) {
    opt.addEventListener('change', function() {
      opts.forEach(function(o) { o.classList.remove('on'); });
      this.classList.add('on');
    });
  });

  ge('mReport').classList.add('on');
}

function closeReportModal() {
  ge('mReport').classList.remove('on');
}

/* ── Download Excel ────────────────────────────────────── */
async function downloadExcel() {
  var range = _getSelectedRange();
  var btn = ge('btnReportExcel');
  var st = ge('reportStatus');
  btn.disabled = true;
  st.textContent = '⏳ กำลังสร้างไฟล์ Excel...';

  try {
    var res = await fetch('/api/tickets/report/excel?range=' + range);
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      showToast(err.error || 'ไม่สามารถดาวน์โหลดได้', 'error');
      st.textContent = '';
      btn.disabled = false;
      return;
    }
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ResolveNow_Report_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 200);
    st.textContent = '✅ ดาวน์โหลดสำเร็จ!';
    showToast('ดาวน์โหลด Excel สำเร็จ 📊', 'success');
  } catch (e) {
    console.error(e);
    showToast('เกิดข้อผิดพลาด', 'error');
    st.textContent = '';
  }
  btn.disabled = false;
}

/* ── Print PDF ─────────────────────────────────────────── */
async function printPDF() {
  var range = _getSelectedRange();
  var btn = ge('btnReportPdf');
  var st = ge('reportStatus');
  btn.disabled = true;
  st.textContent = '⏳ กำลังโหลดข้อมูลรายงาน...';

  try {
    var res = await fetch('/api/tickets/report?range=' + range);
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      showToast(err.error || 'ไม่สามารถโหลดได้', 'error');
      st.textContent = '';
      btn.disabled = false;
      return;
    }
    var data = await res.json();
    st.textContent = '🖨️ กำลังเปิดหน้าพิมพ์...';
    _openPdfWindow(data);
    st.textContent = '✅ เปิดหน้าพิมพ์แล้ว';
  } catch (e) {
    console.error(e);
    showToast('เกิดข้อผิดพลาด', 'error');
    st.textContent = '';
  }
  btn.disabled = false;
}

/* ── Build PDF Report Window ────────────────────────────── */
function _openPdfWindow(data) {
  var tickets = data.tickets || [];
  var rangeLabel = data.rangeLabel || 'ทั้งหมด';
  var now = new Date();

  // Status counts
  var stMap = { pending: 'รอดำเนินการ', assigned: 'รับงานแล้ว', in_progress: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', rejected: 'ปฏิเสธ' };
  var catMap = { Road: 'ถนน/ทางเท้า', Water: 'ท่อแตก/น้ำ', Electricity: 'ไฟฟ้า', Garbage: 'ขยะ', Animal: 'สัตว์', Tree: 'กิ่งไม้', Hazard: 'ภัยพิบัติ' };
  // Also use dynamic DEPT if available
  if (typeof DEPT !== 'undefined') { for (var k in DEPT) catMap[k] = DEPT[k]; }

  var counts = { pending: 0, assigned: 0, in_progress: 0, completed: 0, rejected: 0 };
  tickets.forEach(function(t) { if (counts[t.status] !== undefined) counts[t.status]++; });

  var completed = tickets.filter(function(t) { return t.status === 'completed'; });
  completed.sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });

  // Build HTML
  var html = '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"/>';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>';
  html += '<title>ResolveNow — รายงานสำหรับผู้บริหาร</title>';
  html += '<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">';
  html += '<style>';
  html += _getPdfStyles();
  html += '</style></head><body>';

  // ── Page 1: Header + Summary ──
  html += '<div class="rpt-page">';
  // Header
  html += '<div class="rpt-header">';
  html += '<div class="rpt-logo">Resolve<span>Now</span></div>';
  html += '<div class="rpt-title">รายงานสรุปเรื่องร้องเรียน</div>';
  html += '<div class="rpt-subtitle">ช่วงเวลา: ' + escapeHTML(rangeLabel) + ' • จัดทำเมื่อ ' + now.toLocaleDateString('th-TH', { dateStyle: 'long' }) + ' เวลา ' + now.toLocaleTimeString('th-TH', { timeStyle: 'short' }) + '</div>';
  html += '<div class="rpt-line"></div>';
  html += '</div>';

  // Summary cards
  html += '<div class="rpt-section-title">📊 สรุปภาพรวม</div>';
  html += '<div class="rpt-stats">';
  html += '<div class="rpt-stat"><div class="rpt-stat-num" style="color:#f59e0b">' + counts.pending + '</div><div class="rpt-stat-label">รอดำเนินการ</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-num" style="color:#8b5cf6">' + (counts.assigned + counts.in_progress) + '</div><div class="rpt-stat-label">กำลังดำเนินการ</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-num" style="color:#22c55e">' + counts.completed + '</div><div class="rpt-stat-label">เสร็จสิ้น</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-num" style="color:#ef4444">' + counts.rejected + '</div><div class="rpt-stat-label">ปฏิเสธ</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-num" style="color:#0f172a">' + tickets.length + '</div><div class="rpt-stat-label">รวมทั้งหมด</div></div>';
  html += '</div>';

  // Pie chart placeholder — will be drawn via canvas
  html += '<div style="text-align:center;margin:24px 0 16px"><canvas id="rptPie" width="200" height="200"></canvas></div>';
  html += '<div class="rpt-pie-legend">';
  html += '<div class="rpt-leg"><span class="rpt-dot" style="background:#f59e0b"></span> รอ (' + counts.pending + ')</div>';
  html += '<div class="rpt-leg"><span class="rpt-dot" style="background:#8b5cf6"></span> กำลังดำเนินการ (' + (counts.assigned + counts.in_progress) + ')</div>';
  html += '<div class="rpt-leg"><span class="rpt-dot" style="background:#22c55e"></span> เสร็จสิ้น (' + counts.completed + ')</div>';
  html += '<div class="rpt-leg"><span class="rpt-dot" style="background:#ef4444"></span> ปฏิเสธ (' + counts.rejected + ')</div>';
  html += '</div>';

  html += '</div>'; // end page 1

  // ── Page 2+: Case cards grouped by status ──
  if (tickets.length > 0) {
    var stColors = { pending: '#f59e0b', assigned: '#3b82f6', in_progress: '#8b5cf6', completed: '#22c55e', rejected: '#ef4444' };
    var stIcons  = { pending: '⏳', assigned: '📋', in_progress: '🔧', completed: '✅', rejected: '❌' };

    // Define status groups order
    var groups = [
      { key: 'pending',     label: 'รอดำเนินการ',      color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '⏳' },
      { key: 'in_progress', label: 'กำลังดำเนินการ',   color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', icon: '🔧' },
      { key: 'assigned',    label: 'รับงานแล้ว',        color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: '📋' },
      { key: 'completed',   label: 'เสร็จสิ้นแล้ว',    color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
      { key: 'rejected',    label: 'ปฏิเสธ',           color: '#ef4444', bg: '#fff1f2', border: '#fecaca', icon: '❌' }
    ];

    html += '<div class="rpt-page">';
    html += '<div class="rpt-section-title">📋 รายละเอียดเคสทั้งหมด (' + tickets.length + ' รายการ)</div>';

    // helper: build one card
    function buildCard(t) {
      var created = new Date(t.createdAt);
      var updated = new Date(t.updatedAt);
      var stColor = stColors[t.status] || '#94a3b8';
      var stIcon  = stIcons[t.status]  || '⚪';
      var stLabel = stMap[t.status]    || t.status;

      // Duration
      var duration = '—';
      if (t.status === 'completed') {
        var diffMins = Math.round((updated - created) / 60000);
        duration = diffMins < 60 ? diffMins + ' นาที' : (Math.floor(diffMins / 60) + ' ชม. ' + (diffMins % 60) + ' นาที');
      } else if (t.status !== 'rejected') {
        var elMins = Math.round((now - created) / 60000);
        var eh = Math.floor(elMins / 60);
        if (elMins < 60) duration = elMins + ' นาที (ดำเนินการอยู่)';
        else if (eh < 24) duration = eh + ' ชม. ' + (elMins % 60) + ' น. (ดำเนินการอยู่)';
        else duration = Math.floor(eh / 24) + ' วัน ' + (eh % 24) + ' ชม. (ดำเนินการอยู่)';
      }

      var stars = t.rating ? '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating) : '—';

      var imgHtml = '';
      if (t.afterImage || t.citizenImage) {
        imgHtml += '<div class="rpt-card-imgs">';
        if (t.citizenImage) imgHtml += '<div class="rpt-img-wrap"><img src="' + escapeHTML(t.citizenImage) + '" class="rpt-img-card" alt="รูปปัญหา"/><div class="rpt-img-label">📸 ก่อนซ่อม</div></div>';
        if (t.afterImage)   imgHtml += '<div class="rpt-img-wrap"><img src="' + escapeHTML(t.afterImage)   + '" class="rpt-img-card" alt="รูปผลงาน"/><div class="rpt-img-label">✅ หลังซ่อม</div></div>';
        imgHtml += '</div>';
      }

      var rejectHtml = (t.status === 'rejected' && t.rejectReason)
        ? '<div class="rpt-card-reject">⚠️ เหตุผลที่ปฏิเสธ: ' + escapeHTML(t.rejectReason) + '</div>'
        : '';

      var ratingHtml = t.rating
        ? '<div class="rpt-card-row"><span class="rpt-card-key">⭐ คะแนน</span><span class="rpt-card-val rpt-stars">' + stars + ' (' + t.rating + '/5)' + (t.ratingNote ? ' — ' + escapeHTML(t.ratingNote) : '') + '</span></div>'
        : '';

      var card = '<div class="rpt-card" style="border-left:4px solid ' + stColor + '">';
      card += '<div class="rpt-card-head" style="background:' + stColor + '15;border-bottom:1px solid ' + stColor + '30">';
      card += '<div class="rpt-card-id">' + escapeHTML(t.ticketId) + '</div>';
      card += '<div class="rpt-card-badge" style="background:' + stColor + '">' + stIcon + ' ' + stLabel + '</div>';
      card += '</div>';
      card += '<div class="rpt-card-body">';
      card += '<div class="rpt-card-info">';
      card += '<div class="rpt-card-row"><span class="rpt-card-key">📂 หมวดหมู่</span><span class="rpt-card-val">' + escapeHTML(catMap[t.category] || t.category) + '</span></div>';
      card += '<div class="rpt-card-row"><span class="rpt-card-key">📅 วันที่แจ้ง</span><span class="rpt-card-val">' + created.toLocaleDateString('th-TH', { dateStyle: 'long' }) + ' เวลา ' + created.toLocaleTimeString('th-TH', { timeStyle: 'short' }) + '</span></div>';
      card += '<div class="rpt-card-row"><span class="rpt-card-key">🔧 ช่างผู้รับผิดชอบ</span><span class="rpt-card-val">' + escapeHTML(t.assignedName || '(ยังไม่มอบหมาย)') + '</span></div>';
      card += '<div class="rpt-card-row"><span class="rpt-card-key">⏱️ ระยะเวลา</span><span class="rpt-card-val">' + duration + '</span></div>';
      if (t.description) card += '<div class="rpt-card-row rpt-card-desc"><span class="rpt-card-key">📝 รายละเอียด</span><span class="rpt-card-val">' + escapeHTML(t.description) + '</span></div>';
      card += ratingHtml;
      card += rejectHtml;
      card += '</div>';
      if (imgHtml) card += imgHtml;
      card += '</div>';
      card += '</div>';
      return card;
    }

    // Render each group
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      var grpTickets = tickets.filter(function(t) { return t.status === grp.key; });
      if (!grpTickets.length) continue;

      // Sort by date newest first within group
      grpTickets.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

      // Group section header — bold full-band style
      html += '<div class="rpt-group-header" style="background:linear-gradient(135deg,' + grp.color + 'dd,' + grp.color + 'aa);border-top:3px solid ' + grp.color + ';border-bottom:1px solid ' + grp.border + '">';
      html += '<span class="rpt-group-icon">' + grp.icon + '</span>';
      html += '<span class="rpt-group-label">' + grp.label + '</span>';
      html += '<span class="rpt-group-count">' + grpTickets.length + ' เคส</span>';
      html += '</div>';

      html += '<div class="rpt-cards">';
      for (var j = 0; j < grpTickets.length; j++) {
        html += buildCard(grpTickets[j]);
      }
      html += '</div>';
      html += '<div style="height:20px"></div>'; // spacer between groups
    }

    html += '</div>'; // end rpt-page
  }

  // Footer
  html += '<div class="rpt-footer">รายงานนี้จัดทำโดยระบบ ResolveNow — ข้อมูล ณ ' + now.toLocaleDateString('th-TH', { dateStyle: 'long' }) + '</div>';

  html += '<script>';
  // Draw pie chart after load
  html += '(function(){';
  html += 'var c=document.getElementById("rptPie");if(!c)return;';
  html += 'var ctx=c.getContext("2d");';
  html += 'var data=[{v:' + counts.pending + ',c:"#f59e0b"},{v:' + (counts.assigned + counts.in_progress) + ',c:"#8b5cf6"},{v:' + counts.completed + ',c:"#22c55e"},{v:' + counts.rejected + ',c:"#ef4444"}];';
  html += 'var total=0;data.forEach(function(d){total+=d.v;});if(!total)total=1;';
  html += 'var start=-Math.PI/2,cx=100,cy=100,r=85;';
  html += 'data.forEach(function(d){var sl=(d.v/total)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+sl);ctx.closePath();ctx.fillStyle=d.c;ctx.fill();start+=sl;});';
  html += 'ctx.beginPath();ctx.arc(cx,cy,45,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();';
  html += 'ctx.font="700 22px Inter,sans-serif";ctx.fillStyle="#0f172a";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("'+tickets.length+'",cx,cy-6);';
  html += 'ctx.font="500 11px Prompt,sans-serif";ctx.fillStyle="#94a3b8";ctx.fillText("รายการ",cx,cy+12);';
  html += '})();';
  // Auto-print
  html += 'window.onload=function(){setTimeout(function(){window.print();},600);};';
  html += '<\/script>';

  html += '</body></html>';

  var w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else { showToast('กรุณาอนุญาต Pop-up Window', 'warning'); }
}

/* ── PDF Styles ─────────────────────────────────────────── */
function _getPdfStyles() {
  return '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:"Prompt",sans-serif;color:#0f172a;background:#fff;padding:20px 28px;font-size:12px;line-height:1.6}' +
    '.rpt-page{margin-bottom:32px}' +
    '.rpt-header{text-align:center;margin-bottom:28px;padding-bottom:20px}' +
    '.rpt-logo{font-family:"Inter","Prompt",sans-serif;font-size:38px;font-weight:800;color:#0f172a;letter-spacing:-1px;margin-bottom:6px}' +
    '.rpt-logo span{background:linear-gradient(135deg,#f59e0b,#d97706);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}' +
    '.rpt-title{font-size:18px;font-weight:700;color:#1e3a5f;margin-bottom:6px}' +
    '.rpt-subtitle{font-size:12px;color:#64748b;margin-bottom:16px}' +
    '.rpt-line{height:3px;background:linear-gradient(90deg,#2563eb,#f59e0b,#22c55e);border-radius:4px}' +
    '.rpt-section-title{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:16px;padding:4px 12px;border-left:3px solid #2563eb}' +
    '.rpt-stats{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:24px}' +
    '.rpt-stat{text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 20px;min-width:100px}' +
    '.rpt-stat-num{font-size:28px;font-weight:800;font-family:"Inter",sans-serif;line-height:1}' +
    '.rpt-stat-label{font-size:11px;color:#64748b;margin-top:4px;font-weight:600}' +
    '.rpt-pie-legend{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}' +
    '.rpt-leg{display:flex;align-items:center;gap:6px;font-size:12px;color:#334155;font-weight:600}' +
    '.rpt-dot{width:10px;height:10px;border-radius:50%;display:inline-block}' +
    /* ── Case Cards ── */
    '.rpt-cards{display:flex;flex-direction:column;gap:14px}' +
    '.rpt-card{border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;page-break-inside:avoid;break-inside:avoid;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.06)}' +
    '.rpt-card-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px}' +
    '.rpt-card-id{font-family:"Inter",sans-serif;font-size:13px;font-weight:800;color:#0f172a;letter-spacing:.5px}' +
    '.rpt-card-badge{padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;color:#fff;letter-spacing:.3px}' +
    '.rpt-card-body{display:flex;gap:16px;padding:12px 14px 14px;align-items:flex-start}' +
    '.rpt-card-info{flex:1;min-width:0}' +
    '.rpt-card-row{display:flex;gap:8px;margin-bottom:6px;font-size:11px;line-height:1.5}' +
    '.rpt-card-key{color:#64748b;font-weight:600;flex-shrink:0;min-width:130px}' +
    '.rpt-card-val{color:#0f172a;font-weight:500;flex:1}' +
    '.rpt-card-desc .rpt-card-val{color:#334155;font-style:italic}' +
    '.rpt-stars{color:#f59e0b;font-weight:700;font-family:"Inter",sans-serif;letter-spacing:1px}' +
    '.rpt-card-reject{margin-top:8px;background:#fff1f1;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;font-size:11px;color:#b91c1c}' +
    '.rpt-card-imgs{display:flex;flex-direction:column;gap:8px;flex-shrink:0}' +
    '.rpt-img-wrap{text-align:center}' +
    '.rpt-img-card{width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;display:block}' +
    '.rpt-img-label{font-size:9px;color:#64748b;margin-top:3px;font-weight:600}' +
    /* ── Status Group Headers ── */
    '.rpt-group-header{display:flex;align-items:center;gap:12px;padding:13px 20px;border-radius:0;margin:20px -4px 12px;page-break-inside:avoid;break-inside:avoid;box-shadow:0 2px 8px rgba(0,0,0,.12)}' +
    '.rpt-group-icon{font-size:20px;flex-shrink:0}' +
    '.rpt-group-label{font-size:15px;font-weight:900;flex:1;letter-spacing:.4px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.2)}' +
    '.rpt-group-count{padding:4px 14px;border-radius:99px;color:#fff;font-size:12px;font-weight:800;flex-shrink:0;background:rgba(255,255,255,.25);border:1.5px solid rgba(255,255,255,.4)}' +
    '.rpt-footer{text-align:center;font-size:10px;color:#94a3b8;padding-top:20px;border-top:1px solid #e2e8f0;margin-top:32px}' +
    '@media print{' +
      'body{padding:10px 14px;font-size:11px}' +
      '.rpt-card{page-break-inside:avoid;break-inside:avoid;margin-bottom:10px}' +
      '.rpt-group-header{page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;margin:16px -2px 10px}' +
      '.rpt-stat{padding:10px 14px;min-width:80px}' +
      '.rpt-stat-num{font-size:22px}' +
      '.rpt-card-key{min-width:110px}' +
      '.rpt-img-card{width:75px;height:75px}' +
    '@page{size:A4;margin:12mm 10mm}' +
    '}';
}

