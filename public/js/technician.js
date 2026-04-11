/* ─────────────────────────────────────────────
   public/js/technician.js — Technician Features
   • Welcome banner + stats bar on login
   • Render assigned tickets with 3-step workflow
   • Job actions: accept, start, reject, complete
   • Image upload (before/after)
   • Help requests: load, accept, create
   ───────────────────────────────────────────── */

/* ── Render Tech Tickets ─────────────────────────────── */
var _lastTechJSON = null;
var _suppressCardAnim = false;
var _tcAllTickets = [];   // master list for filter
var _tcOpen = null;       // currently expanded ticketId

/* priority bucket helper */
function _tcPrioBucket(t) {
  var u = t.urgency || '';
  if (t.priorityScore >= 70 || u === 'urgent')  return 'urgent';
  if (t.priorityScore >= 40 || u === 'medium')  return 'medium';
  return 'normal';
}

function renderTech(data) {
  /* ── Welcome banner (inject once) ── */
  if (!ge('techWelcome')) {
    var initials = (CU.firstName[0] || '') + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
    ge('secTech').insertAdjacentHTML('afterbegin',
      '<div class="tech-welcome" id="techWelcome">'
      + '<div class="tw-avatar">' + initials.toUpperCase() + '</div>'
      + '<div class="tw-info">'
      + '<div class="tw-greeting">ยินดีต้อนรับกลับมา 👋</div>'
      + '<div class="tw-name">' + CU.firstName + (CU.lastName ? ' ' + CU.lastName : '') + '</div>'
      + '<div class="tw-dept">' + (DEPT_ICON[CU.specialty] || '🔧') + ' ' + (DEPT[CU.specialty] || CU.specialty) + '</div>'
      + '</div></div>'
    );
  }

  /* ── diff-guard ── */
  var dataJSON = JSON.stringify(data);
  if (dataJSON === _lastTechJSON && ge('techCards').innerHTML) return;
  _lastTechJSON = dataJSON;

  /* ── store master list ── */
  _tcAllTickets = data;
  window._tcTickets = {};
  data.forEach(function(t){ window._tcTickets[t.ticketId] = t; });

  /* ── apply current filter ── */
  var sel = ge('tcPriorityFilter');
  var filter = sel ? sel.value : 'all';
  _tcRenderGrid(filter, true);
}

/* ── Priority filter handler ── */
function tcApplyFilter() {
  var sel = ge('tcPriorityFilter');
  var filter = sel ? sel.value : 'all';
  if (_tcOpen) { _tcClose(_tcOpen); _tcOpen = null; }
  _tcRenderGrid(filter, false);
}

/* ── Draw the tech grid ── */
function _tcRenderGrid(filter, animate) {
  var el = ge('techCards');
  if (!el) return;

  var data = filter === 'all'
    ? _tcAllTickets
    : _tcAllTickets.filter(function(t){ return _tcPrioBucket(t) === filter; });

  if (!data.length) {
    var lm = { urgent:'ด่วนมาก', medium:'ด่วน', normal:'ปกติ' };
    var msg = filter === 'all' ? 'ไม่มีงานในแผนกของคุณ' : 'ไม่มีงานระดับ "' + (lm[filter] || filter) + '"';
    el.innerHTML = '<div class="empty">' + msg + '</div>';
    return;
  }

  /* sort: active first, then done */
  var active = data.filter(function(t){ return t.status !== 'completed' && t.status !== 'rejected'; });
  var done   = data.filter(function(t){ return t.status === 'completed' || t.status === 'rejected'; });
  var sorted = active.concat(done);

  var h = '<div class="citizen-grid">';

  for (var i = 0; i < sorted.length; i++) {
    var t = sorted[i];
    var bucket = _tcPrioBucket(t);
    var isDone = t.status === 'completed' || t.status === 'rejected';

    /* priority badge label + class */
    var prioBadgeCls = bucket === 'urgent' ? 'urgent' : (bucket === 'medium' ? 'medium' : 'normal');
    var prioBadgeTxt = bucket === 'urgent' ? '⚡ ด่วนมาก' : (bucket === 'medium' ? '⏰ ด่วน' : '🔵 ปกติ');
    if (isDone) { prioBadgeCls = t.status; prioBadgeTxt = t.status === 'completed' ? '✅ เสร็จ' : '❌ ปฏิเสธ'; }

    /* thumbnail: citizenImage or icon placeholder */
    var thumbHtml = t.citizenImage
      ? '<img src="' + t.citizenImage + '" class="cg-thumb" />'
      : '<div class="cg-thumb cg-thumb-placeholder tc-placeholder-' + prioBadgeCls + '">' + (DEPT_ICON[t.category] || '🔧') + '</div>';

    var cardCls = 'cg-card' + (isDone ? (t.status === 'completed' ? ' cg-card--done' : ' cg-card--rejected') : (bucket === 'urgent' ? ' cg-card--urgent' : ''));

    h += '<div class="' + cardCls + '" id="tccard-' + t.ticketId + '" onclick="tcToggle(\'' + t.ticketId + '\')">';
    h += '<div class="cg-left">' + thumbHtml + '</div>';
    h += '<div class="cg-right">';
    h += '<div class="cg-row1">';
    h += '<span class="cg-tid">' + (DEPT_ICON[t.category] || '') + ' #' + escapeHTML(t.ticketId) + '</span>';
    h += '<span class="badge ' + prioBadgeCls + ' cg-badge">' + prioBadgeTxt + '</span>';
    h += '</div>';
    h += '<div class="cg-desc">' + escapeHTML(t.description) + '</div>';
    h += '<div class="cg-date">' + t.createdAt + '</div>';
    h += '</div></div>'; // /cg-right /cg-card

    /* hidden detail panel */
    h += '<div class="cg-detail" id="tcdetail-' + t.ticketId + '" style="display:none"></div>';
  }

  h += '</div>';

  /* ── write to DOM with animation handling ── */
  var savedScroll = window.scrollY;
  if (animate && _suppressCardAnim) {
    el.classList.add('tcard-instant');
    el.innerHTML = h;
    window.scrollTo(0, savedScroll);
    _suppressCardAnim = false;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      el.style.transition = 'opacity 0.45s cubic-bezier(.22,1,.36,1)';
      el.style.opacity = '1';
      setTimeout(function(){ el.style.transition = ''; el.style.opacity = ''; el.classList.remove('tcard-instant'); }, 480);
    }); });
  } else {
    el.innerHTML = h;
    window.scrollTo(0, savedScroll);
    if (el.style.opacity === '0') {
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        el.style.transition = 'opacity 0.42s cubic-bezier(.22,1,.36,1)';
        el.style.opacity = '1';
        setTimeout(function(){ el.style.transition = ''; el.style.opacity = ''; }, 450);
      }); });
    }
  }
}

/* ── Toggle expand/collapse tech ticket detail ── */
function tcToggle(ticketId) {
  if (_tcOpen === ticketId) { _tcClose(ticketId); _tcOpen = null; return; }
  if (_tcOpen) _tcClose(_tcOpen);
  _tcOpen = ticketId;

  var t = (window._tcTickets || {})[ticketId];
  if (!t) return;
  var panel = ge('tcdetail-' + ticketId);
  if (!panel) return;

  var isDone = t.status === 'completed' || t.status === 'rejected';
  var s1 = t.status === 'pending' ? 'active' : 'done';
  var s2 = t.status === 'pending' ? 'idle' : (t.status === 'assigned' ? 'active' : 'done');
  var s3 = t.status === 'in_progress' ? 'active' : (t.status === 'completed' ? 'done' : 'idle');

  var h = '<div class="cg-detail-inner tc-detail-inner">';

  /* citizen info rows */
  h += '<div class="cg-detail-row"><span class="cg-dl">📝 รายละเอียด</span><span class="cg-dv">' + escapeHTML(t.description) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">📍 สถานที่</span><span class="cg-dv">' + escapeHTML(t.location) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">👤 ผู้แจ้ง</span><span class="cg-dv">' + escapeHTML(t.citizenName) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">🕐 วันที่</span><span class="cg-dv">' + escapeHTML(t.createdAt) + '</span></div>';

  /* citizen image */
  if (t.citizenImage) {
    h += '<div><div class="citizen-img-label">รูปจากผู้แจ้ง</div><img class="citizen-img" src="' + t.citizenImage + '" onclick="viewImg(this.src,\'รูปผู้แจ้ง\')"/></div>';
  }

  if (isDone) {
    h += '<div class="status-done-box ' + t.status + '">' + (t.status === 'completed' ? '✅ งานเสร็จสิ้นแล้ว' : '❌ ปฏิเสธงานนี้แล้ว') + '</div>';
    if (t.beforeImage || t.afterImage) {
      h += '<div class="irow">';
      if (t.beforeImage) h += '<div class="islot has" onclick="viewImg(\'' + t.beforeImage + '\',\'ก่อน\')"><img src="' + t.beforeImage + '"/><div class="ilbl">ก่อนซ่อม</div></div>';
      if (t.afterImage)  h += '<div class="islot has" onclick="viewImg(\'' + t.afterImage  + '\',\'หลัง\')"><img src="' + t.afterImage  + '"/><div class="ilbl">หลังซ่อม</div></div>';
      h += '</div>';
    }
  } else {
    /* STEP 1 */
    h += '<div class="step"><div class="shead">'
      + '<div class="snum ' + s1 + '">' + (s1 === 'done' ? '✓' : '1') + '</div>'
      + '<div class="slbl">ข้อมูลการร้องเรียน</div>'
      + '<span class="sstat ' + s1 + '">' + (s1 === 'done' ? 'เสร็จ' : 'รอ') + '</span></div>';
    if (t.status === 'pending')
      h += '<div class="sbody"><p>กดรับงานเพื่อเริ่มลงพื้นที่</p>'
        + '<button class="btnaccept" data-id="' + t.ticketId + '" onclick="event.stopPropagation();acceptJob(this)">🔧 รับเรื่องและลงพื้นที่</button></div>';
    h += '</div>';

    /* STEP 2 */
    h += '<div class="step"><div class="shead">'
      + '<div class="snum ' + s2 + '">' + (s2 === 'done' ? '✓' : '2') + '</div>'
      + '<div class="slbl">ยืนยันการเข้าตรวจสอบ</div>'
      + '<span class="sstat ' + s2 + '">' + (s2 === 'done' ? 'เสร็จ' : s2 === 'active' ? 'กำลังทำ' : 'รอ') + '</span></div>';
    if (s2 === 'active') {
      h += '<div class="sbody"><p>ถ่ายรูปสภาพก่อนซ่อม</p>';
      if (t.beforeImage)
        h += '<div class="islot has" style="display:block;margin-bottom:12px" data-id="' + t.ticketId + '" data-type="before" onclick="event.stopPropagation();triggerUpload(this)">'
          + '<img src="' + t.beforeImage + '" style="width:100%;height:130px;object-fit:cover"/>'
          + '<div class="ilbl">✅ อัปโหลดแล้ว — คลิกเปลี่ยน</div></div>';
      else
        h += '<div class="islot" style="display:block;margin-bottom:12px;padding:20px" data-id="' + t.ticketId + '" data-type="before" onclick="event.stopPropagation();triggerUpload(this)">'
          + '<div style="font-size:28px">📷</div><div style="font-size:13px;margin-top:4px">คลิกถ่ายรูปก่อนซ่อม</div></div>';
      h += '<div style="margin-bottom:12px">'
        + '<label style="font-size:12px;font-weight:700;color:var(--muted);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">บันทึกเพิ่มเติม</label>'
        + '<textarea class="tech-note" placeholder="บรรยายสภาพปัญหา..."></textarea></div>';
      h += '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px;margin-bottom:12px">'
        + '<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px">📌 ต้องการความช่วยเหลือจากช่างแผนกอื่น?</div>'
        + '<button class="btn-help" data-id="' + t.ticketId + '" onclick="event.stopPropagation();openHelpModal(this.getAttribute(\'data-id\'))">📌 ขอความช่วยเหลือ</button></div>';
      h += '<div style="display:flex;gap:8px">'
        + '<button class="btnreject2" data-id="' + t.ticketId + '" onclick="event.stopPropagation();rejectJob(this)">❌ ปฏิเสธ</button>'
        + '<button class="btnconfirm" data-id="' + t.ticketId + '" onclick="event.stopPropagation();startWork(this)">✅ ยืนยันเริ่มซ่อม</button>'
        + '</div></div>';
    }
    h += '</div>';

    /* STEP 3 */
    h += '<div class="step"><div class="shead">'
      + '<div class="snum ' + s3 + '">' + (s3 === 'done' ? '✓' : '3') + '</div>'
      + '<div class="slbl">หลักฐานหลังการดำเนินการ</div>'
      + '<span class="sstat ' + s3 + '">' + (s3 === 'done' ? 'เสร็จ' : s3 === 'active' ? 'กำลังทำ' : 'รอ') + '</span></div>';
    if (s3 === 'active') {
      h += '<div class="sbody"><p>ถ่ายรูปหลังซ่อม เพื่อปิดงาน</p><div class="irow">';
      if (t.beforeImage) h += '<div class="islot has" onclick="viewImg(\'' + t.beforeImage + '\',\'ก่อน\')"><img src="' + t.beforeImage + '"/><div class="ilbl">ก่อนซ่อม</div></div>';
      else h += '<div class="islot" data-id="' + t.ticketId + '" data-type="before" onclick="event.stopPropagation();triggerUpload(this)"><div style="font-size:22px;padding:8px 0">📷</div><div class="ilbl">คลิกถ่ายก่อนซ่อม</div></div>';
      if (t.afterImage) h += '<div class="islot has" data-id="' + t.ticketId + '" data-type="after" onclick="event.stopPropagation();triggerUpload(this)"><img src="' + t.afterImage + '"/><div class="ilbl">✅ คลิกเปลี่ยน</div></div>';
      else h += '<div class="islot" data-id="' + t.ticketId + '" data-type="after" onclick="event.stopPropagation();triggerUpload(this)"><div style="font-size:22px;padding:8px 0">📷</div><div class="ilbl">คลิกถ่ายหลังซ่อม</div></div>';
      h += '</div>';
      h += '<div style="margin-bottom:12px">'
        + '<label style="font-size:12px;font-weight:700;color:var(--muted);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">บรรยายงานที่ทำ</label>'
        + '<textarea class="tech-note" placeholder="อธิบายงานที่แก้ไขแล้ว..."></textarea></div>';
      h += '<button class="btnclose"' + (t.afterImage ? '' : ' disabled') + ' data-id="' + t.ticketId + '" onclick="event.stopPropagation();completeJob(this)">📨 ยืนยันปิดเรื่องร้องเรียน</button>';
      if (!t.afterImage) h += '<p style="font-size:12px;color:var(--muted);text-align:center;margin-top:6px">กรุณาอัปโหลดรูปหลังซ่อมก่อน</p>';
      h += '</div>';
    }
    h += '</div>';
  }

  /* Chat button */
  h += '<button class="btn-chat cg-chat-btn" onclick="event.stopPropagation();openTicketChat(\'' + t.ticketId + '\')"><span>💬</span> แชทกับผู้แจ้ง</button>';

  h += '</div>'; // /cg-detail-inner

  panel.innerHTML = h;
  panel.style.display = 'block';
  var card = ge('tccard-' + ticketId);
  if (card) card.classList.add('cg-card--active');
  setTimeout(function(){ panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
}

function _tcClose(ticketId) {
  var panel = ge('tcdetail-' + ticketId);
  if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
  var card = ge('tccard-' + ticketId);
  if (card) card.classList.remove('cg-card--active');
}


/* ── Job Actions ─────────────────────────────────────── */
function acceptJob(btn) { apiStatus(btn.getAttribute('data-id'), 'assigned'); showToast('✅ รับงานแล้ว'); }
function startWork(btn) { apiStatus(btn.getAttribute('data-id'), 'in_progress'); showToast('🔧 เริ่มดำเนินการ'); }

// BUG-003: Tech reject now requires a reason via modal
var _techRejectId = null;
function rejectJob(btn) {
  _techRejectId = btn.getAttribute('data-id');
  ge('techRejectLabel').textContent = 'Ticket #' + _techRejectId + ' — กรุณาระบุเหตุผล';
  ge('techRejectReason').value = '';
  hideE('techRejectErr');
  ge('mTechReject').classList.add('on');
  setTimeout(function() { ge('techRejectReason').focus(); }, 200);
}
function closeTechRejectModal() {
  ge('mTechReject').classList.remove('on');
  _techRejectId = null;
}
async function confirmTechReject() {
  var reason = ge('techRejectReason').value.trim();
  if (!reason) { showE('techRejectErr', 'กรุณาระบุเหตุผลก่อนปฏิเสธ'); return; }
  hideE('techRejectErr');
  await fetch('/api/tickets/' + _techRejectId + '/status', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'rejected', reason: reason })
  });
  closeTechRejectModal();
  showToast('ปฏิเสธงานแล้ว', 'error');
  loadTickets();
}

function completeJob(btn) {
  if (btn.disabled || btn.hasAttribute('disabled')) return;
  var id = btn.getAttribute('data-id');
  _showTechComplete(function () {
    apiStatus(id, 'completed');
  });
}

function _showTechComplete(onDone) {
  var colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b', '#a78bfa', '#60a5fa', '#f472b6'];
  var pHtml = '';
  for (var i = 0; i < 8; i++) {
    var ang = (i / 8) * Math.PI * 2;
    var dist = 85 + (i % 3) * 28;
    var px = Math.round(Math.cos(ang) * dist);
    var py = Math.round(Math.sin(ang) * dist - 40);
    pHtml += '<div class="tc-p" style="background:' + colors[i]
      + ';--px:' + px + 'px;--py:' + py + 'px'
      + ';animation-delay:' + (1.05 + i * 0.06) + 's"></div>';
  }

  var ov = document.createElement('div');
  ov.className = 'tc-bg';
  ov.innerHTML =
    '<div class="tc-card" id="_tcCard">'
    + '<div class="tc-particles">' + pHtml + '</div>'
    + '<div class="tc-ring-wrap">'
    + '<div class="tc-ring"></div>'
    + '<div class="tc-ring"></div>'
    + '<div class="tc-ring"></div>'
    + '<div class="tc-badge">'
    + '<svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<polyline class="tc-check-path" points="13,27 22,37 39,16"'
    + ' stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    + '</svg>'
    + '</div>'
    + '</div>'
    + '<div class="tc-title">ปิดงานสำเร็จ! 🎉</div>'
    + '<div class="tc-sub">งานซ่อมแซมเสร็จเรียบร้อยแล้ว<br>ระบบจะแจ้งผู้ร้องเรียนทาง LINE อัตโนมัติ</div>'
    + '<div class="tc-chip">✅&nbsp;&nbsp;MISSION COMPLETE</div>'
    + '<div class="tc-dots"><span></span><span></span><span></span></div>'
    + '</div>';

  document.body.appendChild(ov);

  /* exit after 3.2s */
  setTimeout(function () {
    /* Step 1: Overlay + card exit animation */
    var card = document.getElementById('_tcCard');
    if (card) card.classList.add('tc-out');
    ov.classList.add('tc-out');

    /* Step 2: Fade techCards out simultaneously */
    var tc = ge('techCards');
    if (tc) {
      tc.style.transition = 'opacity 0.32s ease';
      tc.style.opacity = '0';
    }

    /* Step 3: Flag next render to skip card bounce animation */
    _suppressCardAnim = true;
    _lastTechJSON = null;

    /* Step 4: After overlay gone, fire update → renderTech will fade cards back in */
    setTimeout(function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (typeof onDone === 'function') onDone();
    }, 540);
  }, 3200);
}

async function apiStatus(id, status) {
  await fetch('/api/tickets/' + id + '/status', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status })
  });
  loadTickets();
}

/* ── Image Upload ────────────────────────────────────── */
function triggerUpload(el) {
  upId = el.getAttribute('data-id');
  upType = el.getAttribute('data-type');
  var inp = ge('techFile');
  inp.value = '';
  inp.onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var fd = new FormData();
    fd.append('image', f);
    fetch('/api/tickets/' + upId + '/upload/' + upType, { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) return showToast(d.error, true);
        showToast('✅ อัปโหลดสำเร็จ');
        loadTickets();
      })
      .catch(function () { showToast('อัปโหลดไม่สำเร็จ', true); });
  };
  inp.click();
}

/* ── Help Requests ───────────────────────────────────── */
async function loadHelpRequests() {
  try {
    var res = await fetch('/api/help-requests');
    if (!res.ok) return;
    var helps = await res.json();
    var open = helps.filter(function (h) { return h.status === 'open' && h.requesterId !== CU.id; });
    var banner = ge('helpBanner');
    if (open.length) {
      banner.style.display = 'block';
      ge('helpCount').textContent = open.length;
      var h = '';
      for (var i = 0; i < open.length; i++) {
        var hp = open[i];
        h += '<div class="help-card">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'
          + '<div>'
          + '<div style="font-size:13px;font-weight:700;margin-bottom:3px">📌 ' + hp.requesterName + ' (' + (DEPT[hp.requesterDept] || hp.requesterDept) + ') ขอความช่วยเหลือ</div>'
          + '<div style="font-size:12px;color:#4a5568">Ticket: ' + hp.ticketId + ' — ' + (DEPT_ICON[hp.ticketCategory] || '') + ' ' + (DEPT[hp.ticketCategory] || hp.ticketCategory) + ' ที่ ' + hp.ticketLocation + '</div>'
          + (hp.message ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">: ' + hp.message + '</div>' : '')
          + '</div>'
          + '<button class="btn-help-accept" data-id="' + hp.helpId + '" onclick="acceptHelp(this)">✅ รับงาน</button>'
          + '</div></div>';
      }
      ge('helpList').innerHTML = h;
    } else {
      banner.style.display = 'none';
    }
  } catch (e) { }
}

async function acceptHelp(btn) {
  var res = await fetch('/api/help-requests/' + btn.getAttribute('data-id') + '/accept', { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
  var data = await res.json();
  if (!res.ok) return showToast(data.error || 'เกิดข้อผิดพลาด', true);
  showToast('✅ รับงานช่วยเหลือแล้ว!');
  loadHelpRequests();
  loadTickets();
}

function openHelpModal(ticketId) {
  helpTicketId = ticketId;
  ge('helpTicketInfo').textContent = 'Ticket: ' + ticketId;
  ge('helpMsg').value = '';
  ge('helpTargetDept').value = '';
  ge('mHelp').classList.add('on');
}

async function submitHelpRequest() {
  if (!helpTicketId) return;
  var msg = ge('helpMsg').value.trim();
  var dept = ge('helpTargetDept').value;
  var res = await fetch('/api/help-requests', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId: helpTicketId, message: msg, targetDept: dept })
  });
  var data = await res.json();
  if (!res.ok) return showToast(data.error || 'เกิดข้อผิดพลาด', true);
  ge('mHelp').classList.remove('on');
  showToast('📌 ส่งคำขอช่วยเหลือแล้ว!');
  loadHelpRequests();
}