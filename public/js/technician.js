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

  // FIX-#5 Modal Event Loss Guard:
  // ถ้า modal รายละเอียดงานเปิดอยู่ → อัปเดตข้อมูลใน memory เท่านั้น
  // ไม่ re-render grid เพราะจะเขียน innerHTML ใหม่และล้าง onclick handlers ของปุ่มใน modal
  // เมื่อ user ปิด modal แล้ว → poll ครั้งถัดไปจะ render grid ใหม่เองโดยอัตโนมัติ
  var _modalIsOpen = ge('mTicketDetail') && ge('mTicketDetail').classList.contains('on');
  if (_modalIsOpen) return;

  /* ── apply current filter ── */
  var sel = ge('tcPriorityFilter');
  var filter = sel ? (sel.getAttribute('data-value') || 'all') : 'all';
  _tcRenderGrid(filter, true);
}

/* ── Priority filter handler ── */
function tcApplyFilter() {
  var sel = ge('tcPriorityFilter');
  var filter = sel ? (sel.getAttribute('data-value') || 'all') : 'all';
  if (_tcOpen) { _tcClose(_tcOpen); _tcOpen = null; }
  _tcRenderGrid(filter, false);
}

/* ── Card HTML builder ── */
function _tcCardHtml(t) {
  var bucket = _tcPrioBucket(t);
  var isDone = t.status === 'completed' || t.status === 'rejected';
  var isPending = t.status === 'pending';
  var prioBadgeCls = bucket === 'urgent' ? 'urgent' : (bucket === 'medium' ? 'medium' : 'normal');
  var prioBadgeTxt = bucket === 'urgent' ? '⚡ ด่วนมาก' : (bucket === 'medium' ? '⏰ ด่วน' : '🔵 ปกติ');
  if (isDone) { prioBadgeCls = t.status; prioBadgeTxt = t.status === 'completed' ? '✅ เสร็จ' : '❌ ปฏิเสธ'; }
  var thumbHtml = t.citizenImage
    ? '<img src="' + t.citizenImage + '" class="cg-thumb" />'
    : '<div class="cg-thumb cg-thumb-placeholder tc-placeholder-' + prioBadgeCls + '">' + (DEPT_ICON[t.category] || '🔧') + '</div>';

  /* ── Determine card class based on status + priority ── */
  var cardCls = 'cg-card';
  if (isDone) {
    cardCls += t.status === 'completed' ? ' cg-card--done' : ' cg-card--rejected';
  } else if (isPending && bucket === 'urgent') {
    cardCls += ' cg-card--urgent cg-card--urgent-pending'; // ด่วนมาก + ยังไม่รับ = รุนแรงมาก
  } else if (isPending) {
    cardCls += ' cg-card--pending'; // ยังไม่รับ (ปกติ/ด่วน) = เตือนเบาๆ
  } else if (t.status === 'assigned') {
    cardCls += ' cg-card--assigned'; // รับแล้วแต่ยังไม่เริ่มทำ = ขอบส้มหายใจ
  } else if (bucket === 'urgent') {
    cardCls += ' cg-card--urgent'; // รับแล้วแต่ด่วนมาก = แค่ขอบแดง
  }

  var h = '<div class="' + cardCls + '" id="tccard-' + t.ticketId + '" onclick="tcToggle(\'' + t.ticketId + '\')">';
  h += '<div class="cg-left">' + thumbHtml + '</div>';
  h += '<div class="cg-right">';
  h += '<div class="cg-row1">';
  h += '<span class="cg-tid">' + (DEPT_ICON[t.category] || '') + ' #' + escapeHTML(t.ticketId) + '</span>';
  h += '<span class="badge ' + prioBadgeCls + ' cg-badge">' + prioBadgeTxt + '</span>';
  h += '</div>';
  h += '<div class="cg-desc">' + escapeHTML(t.description) + '</div>';
  h += '<div class="cg-date">' + t.createdAt + '</div>';
  h += '</div></div>';
  return h;
}


/* ── Draw the tech grid ── */
function _tcRenderGrid(filter, animate) {
  var el = ge('techCards');
  if (!el) return;

  var isDoneStatus = function(t){ return t.status === 'completed' || t.status === 'rejected'; };

  var data;
  if (filter === 'all') {
    data = _tcAllTickets;
  } else if (filter === 'completed' || filter === 'rejected') {
    // Done filter: show only tickets with that exact status
    data = _tcAllTickets.filter(function(t){ return t.status === filter; });
  } else {
    // Priority filter (urgent/medium/normal): active tickets only
    data = _tcAllTickets.filter(function(t){
      return _tcPrioBucket(t) === filter && !isDoneStatus(t);
    });
  }

  if (!data.length) {
    var lm = { urgent:'ด่วนมาก', medium:'ด่วน', normal:'ปกติ', completed:'เสร็จสิ้น', rejected:'ปฏิเสธ' };
    var msg = filter === 'all' ? 'ไม่มีงานในแผนกของคุณ' : 'ไม่มีงานในสถานะ "' + (lm[filter] || filter) + '"';
    el.innerHTML = '<div class="empty">' + msg + '</div>';
    return;
  }

  /* ── Split into active / done, active always first ── */
  var active = data.filter(function(t){ return !isDoneStatus(t); });
  var done   = data.filter(function(t){ return isDoneStatus(t); });

  var h = '<div class="citizen-grid">';

  /* ── Render active cards ── */
  for (var i = 0; i < active.length; i++) {
    h += _tcCardHtml(active[i]);
  }

  /* ── Divider only in "all" mode when both groups exist ── */
  if (filter === 'all' && active.length && done.length) {
    h += '<div class="cg-section-divider"><span>✅ งานที่เสร็จแล้ว</span></div>';
  }

  /* ── Render done cards ── */
  for (var j = 0; j < done.length; j++) {
    h += _tcCardHtml(done[j]);
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

/* ── Open ticket detail modal (tech) ── */
function tcToggle(ticketId) {
  // Deselect previous
  if (_tcOpen && _tcOpen !== ticketId) {
    var prev = ge('tccard-' + _tcOpen);
    if (prev) prev.classList.remove('cg-card--active');
  }
  _tcOpen = ticketId;

  var t = (window._tcTickets || {})[ticketId];
  if (!t) return;

  var isDone = t.status === 'completed' || t.status === 'rejected';
  var bucket = _tcPrioBucket(t);
  var prioBadgeTxt = bucket === 'urgent' ? '⚡ ด่วนมาก' : (bucket === 'medium' ? '⏰ ด่วน' : '🔵 ปกติ');
  if (isDone) prioBadgeTxt = t.status === 'completed' ? '✅ เสร็จสิ้น' : '❌ ปฏิเสธ';

  var s1 = t.status === 'pending' ? 'active' : 'done';
  var s2 = t.status === 'pending' ? 'idle' : (t.status === 'assigned' ? 'active' : 'done');
  var s3 = t.status === 'in_progress' ? 'active' : (t.status === 'completed' ? 'done' : 'idle');

  // ── Modal title
  ge('tdModalTitle').innerHTML = (DEPT_ICON[t.category] || '🔧') + ' #' + escapeHTML(t.ticketId)
    + ' <span class="badge ' + (isDone ? t.status : (bucket === 'urgent' ? 'urgent' : 'normal')) + '" style="font-size:11px;margin-left:6px">' + prioBadgeTxt + '</span>';

  // ── Build body — same content as before, just without the wrapping div
  var h = '';
  h += '<div class="cg-detail-row"><span class="cg-dl">📝 รายละเอียด</span><span class="cg-dv">' + escapeHTML(t.description) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">📍 สถานที่</span><span class="cg-dv">' + escapeHTML(t.location) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">👤 ผู้แจ้ง</span><span class="cg-dv">' + escapeHTML(t.citizenName) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">🕐 วันที่</span><span class="cg-dv">' + escapeHTML(t.createdAt) + '</span></div>';

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
        + '<button class="btnaccept" data-id="' + t.ticketId + '" onclick="acceptJob(this)"><span class="btn-txt">🔧 รับเรื่องและลงพื้นที่</span></button></div>';
    h += '</div>';

    /* STEP 2 */
    h += '<div class="step"><div class="shead">'
      + '<div class="snum ' + s2 + '">' + (s2 === 'done' ? '✓' : '2') + '</div>'
      + '<div class="slbl">ยืนยันการเข้าตรวจสอบ</div>'
      + '<span class="sstat ' + s2 + '">' + (s2 === 'done' ? 'เสร็จ' : s2 === 'active' ? 'กำลังทำ' : 'รอ') + '</span></div>';
    if (s2 === 'active') {
      h += '<div class="sbody"><p>ถ่ายรูปสภาพก่อนซ่อม</p>';
      if (t.beforeImage)
        h += '<div class="islot has" style="display:block;margin-bottom:12px" data-id="' + t.ticketId + '" data-type="before" onclick="triggerUpload(this)">'
          + '<img src="' + t.beforeImage + '" style="width:100%;height:130px;object-fit:cover"/>'
          + '<div class="ilbl">✅ อัปโหลดแล้ว — คลิกเปลี่ยน</div></div>';
      else
        h += '<div class="islot" style="display:block;margin-bottom:12px;padding:20px" data-id="' + t.ticketId + '" data-type="before" onclick="triggerUpload(this)">'
          + '<div style="font-size:28px">📷</div><div style="font-size:13px;margin-top:4px">คลิกถ่ายรูปก่อนซ่อม</div></div>';
      h += '<div style="margin-bottom:12px">'
        + '<label style="font-size:12px;font-weight:700;color:var(--muted);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">บันทึกเพิ่มเติม</label>'
        + '<textarea class="tech-note" placeholder="บรรยายสภาพปัญหา..."></textarea></div>';
      h += '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px;margin-bottom:12px">'
        + '<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px">📌 ต้องการความช่วยเหลือจากช่างแผนกอื่น?</div>'
        + '<button class="btn-help" data-id="' + t.ticketId + '" onclick="openHelpModal(this.getAttribute(\'data-id\'))">📌 ขอความช่วยเหลือ</button></div>';
      h += '<div style="display:flex;gap:8px">'
        + '<button class="btnreject2" data-id="' + t.ticketId + '" onclick="rejectJob(this)">❌ ปฏิเสธ</button>'
        + '<button class="btnconfirm" data-id="' + t.ticketId + '" onclick="startWork(this)">✅ ยืนยันเริ่มซ่อม</button>'
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
      else h += '<div class="islot" data-id="' + t.ticketId + '" data-type="before" onclick="triggerUpload(this)"><div style="font-size:22px;padding:8px 0">📷</div><div class="ilbl">คลิกถ่ายก่อนซ่อม</div></div>';
      if (t.afterImage) h += '<div class="islot has" data-id="' + t.ticketId + '" data-type="after" onclick="triggerUpload(this)"><img src="' + t.afterImage + '"/><div class="ilbl">✅ คลิกเปลี่ยน</div></div>';
      else h += '<div class="islot" data-id="' + t.ticketId + '" data-type="after" onclick="triggerUpload(this)"><div style="font-size:22px;padding:8px 0">📷</div><div class="ilbl">คลิกถ่ายหลังซ่อม</div></div>';
      h += '</div>';
      h += '<div style="margin-bottom:12px">'
        + '<label style="font-size:12px;font-weight:700;color:var(--muted);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">บรรยายงานที่ทำ</label>'
        + '<textarea class="tech-note" placeholder="อธิบายงานที่แก้ไขแล้ว..."></textarea></div>';
      h += '<button class="btnclose"' + (t.afterImage ? '' : ' disabled') + ' data-id="' + t.ticketId + '" onclick="completeJob(this)">📨 ยืนยันปิดเรื่องร้องเรียน</button>';
      if (!t.afterImage) h += '<p style="font-size:12px;color:var(--muted);text-align:center;margin-top:6px">กรุณาอัปโหลดรูปหลังซ่อมก่อน</p>';
      h += '</div>';
    }
    h += '</div>';
  }

  ge('tdModalBody').innerHTML = h;
  ge('tdModalFooter').innerHTML = '<button class="btn-chat cg-chat-btn" onclick="openTicketChat(\'' + t.ticketId + '\')"><span>💬</span> แชทกับผู้แจ้ง</button>';

  // ── ใส่/ถอด class urgent บน modal card ──
  var modalCard = ge('mTicketDetail').querySelector('.td-modal-card');
  if (modalCard) {
    if (bucket === 'urgent' && !isDone) {
      modalCard.classList.add('td-modal--urgent');
    } else {
      modalCard.classList.remove('td-modal--urgent');
    }
  }

  ge('mTicketDetail').classList.add('on');

  // Auto-scroll modal body to the active step so the action button is visible
  setTimeout(function() {
    var body = ge('tdModalBody');
    var activeStep = body ? body.querySelector('.sbody') : null;
    if (activeStep) {
      activeStep.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 320);

  var card = ge('tccard-' + ticketId);
  if (card) card.classList.add('cg-card--active');
}

/* ── Job Actions ─────────────────────────────────────── */
function acceptJob(btn) { apiStatusAndRefreshModal(btn.getAttribute('data-id'), 'assigned', '✅ รับงานแล้ว'); }
function startWork(btn) { apiStatusAndRefreshModal(btn.getAttribute('data-id'), 'in_progress', '🔧 เริ่มดำเนินการ'); }

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

  // ── ยิง API และ animation พร้อมกัน (parallel) ──────────
  // tryFinish() จะเรียก loadTickets() เมื่อทั้งสองเสร็จ
  var _apiDone = false;
  var _animDone = false;

  function tryFinish() {
    if (_apiDone && _animDone) {
      // FIX: ปิด modal ก่อน loadTickets() เพื่อไม่ให้ guard ใน renderTech() บล็อก re-render
      var modal = ge('mTicketDetail');
      if (modal) modal.classList.remove('on');
      _tcOpen = null;
      loadTickets();
    }
  }

  // 1) บันทึกสถานะทันที (ระหว่าง animation กำลังเล่น)
  fetch('/api/tickets/' + id + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' })
  })
    .then(function() { _apiDone = true; tryFinish(); })
    .catch(function() { _apiDone = true; tryFinish(); }); // reload แม้ error

  // 2) เล่น animation — เมื่อ animation จบจึงเซ็ต animDone
  _showTechComplete(function() {
    _animDone = true;
    tryFinish();
  });
}



function _showTechComplete(onDone) {
  var ov = document.createElement('div');
  ov.id = 'techCompleteOverlay';
  ov.style.cssText = [
    'position:fixed;inset:0;z-index:9000',
    'display:flex;flex-direction:column;align-items:center;justify-content:center',
    'background:linear-gradient(160deg,#07111f 0%,#0c1e3a 50%,#101627 100%)',
    'padding:40px 24px;text-align:center;overflow:hidden;opacity:0;transition:opacity .3s ease'
  ].join(';');

  // ── Orb system — ธีมช่าง: gold primary, blue secondary, teal accent ──
  var tcOrbData = [
    { color:'radial-gradient(circle at 40% 40%,rgba(251,191,36,.55) 0%,rgba(245,158,11,.25) 40%,transparent 70%)',
      size:'520px', top:'-12%', left:'-10%', dur:'20s', delay:'0s',
      tx1:'60px', ty1:'-40px', tx2:'110px', ty2:'28px', tx3:'38px', ty3:'-58px' },
    { color:'radial-gradient(circle at 40% 40%,rgba(96,165,250,.38) 0%,rgba(37,99,235,.18) 40%,transparent 70%)',
      size:'440px', top:'40%', left:'55%', dur:'26s', delay:'-8s',
      tx1:'-68px', ty1:'48px', tx2:'-115px', ty2:'-30px', tx3:'-48px', ty3:'68px' },
    { color:'radial-gradient(circle at 40% 40%,rgba(45,212,191,.3) 0%,rgba(20,184,166,.13) 45%,transparent 70%)',
      size:'340px', top:'65%', left:'8%', dur:'18s', delay:'-4s',
      tx1:'46px', ty1:'-56px', tx2:'82px', ty2:'19px', tx3:'29px', ty3:'-76px' }
  ];
  var tcOrbHtml = '';
  tcOrbData.forEach(function(o) {
    tcOrbHtml += '<div style="position:absolute;border-radius:50%;pointer-events:none;'
      + 'width:' + o.size + ';height:' + o.size + ';'
      + 'top:' + o.top + ';left:' + o.left + ';'
      + 'background:' + o.color + ';'
      + 'filter:blur(60px);opacity:0;'
      + 'animation:tcOrbDrift ' + o.dur + ' ' + o.delay + ' ease-in-out infinite;'
      + '--tx1:' + o.tx1 + ';--ty1:' + o.ty1 + ';'
      + '--tx2:' + o.tx2 + ';--ty2:' + o.ty2 + ';'
      + '--tx3:' + o.tx3 + ';--ty3:' + o.ty3 + ';"></div>';
  });

  // ── Sparkle micro-dots (gold + blue + white) ──
  var tcSparkHtml = '';
  var tcSpCols = ['#fbbf24', '#60a5fa', 'rgba(255,255,255,.65)'];
  for (var i = 0; i < 20; i++) {
    var sz = (Math.random() * 4 + 2).toFixed(1);
    var tp = (Math.random() * 100).toFixed(1);
    var lf = (Math.random() * 100).toFixed(1);
    var dl = (Math.random() * 2.5).toFixed(2);
    var dr = (Math.random() * 2 + 1.8).toFixed(2);
    tcSparkHtml += '<div style="position:absolute;top:' + tp + '%;left:' + lf + '%;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + tcSpCols[i % 3] + ';opacity:0;animation:tcSpark ' + dr + 's ease-in-out ' + dl + 's infinite;pointer-events:none"></div>';
  }

  ov.innerHTML = [
    '<style>',
    '@keyframes tcOrbDrift{0%{opacity:0;transform:translate(0,0) scale(1)}8%{opacity:1}25%{opacity:.85;transform:translate(var(--tx1),var(--ty1)) scale(1.06)}50%{opacity:.7;transform:translate(var(--tx2),var(--ty2)) scale(.96)}75%{opacity:.85;transform:translate(var(--tx3),var(--ty3)) scale(1.04)}92%{opacity:1}100%{opacity:0;transform:translate(0,0) scale(1)}}',
    '@keyframes tcSpark{0%,100%{opacity:0;transform:scale(0) translateY(0)}50%{opacity:.85;transform:scale(1) translateY(-14px)}}',
    '@keyframes tcRingPop{0%{opacity:0;transform:scale(.25)}60%{transform:scale(1.1)}80%{transform:scale(.97)}100%{opacity:1;transform:scale(1)}}',
    '@keyframes tcPathDraw{from{stroke-dashoffset:54}to{stroke-dashoffset:0}}',
    '@keyframes tcTitleUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes tcRipple{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.2);opacity:0}}',
    '@keyframes tcBarGrow{from{width:0}to{width:130px}}',
    '@keyframes tcDotsBounce{0%,80%,100%{transform:scale(0);opacity:0}40%{transform:scale(1);opacity:1}}',
    '@keyframes tcChipIn{from{opacity:0;transform:translateY(10px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '</style>',
    tcOrbHtml,
    tcSparkHtml,
    // ── Content ──
    '<div style="position:relative;z-index:2;text-align:center">',
    // Ripple rings + checkmark ring (gold theme)
    '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px">',
    '    <div style="position:absolute;width:100px;height:100px;border-radius:50%;border:2px solid rgba(251,191,36,.5);animation:tcRipple 1.8s ease-out .1s infinite"></div>',
    '    <div style="position:absolute;width:100px;height:100px;border-radius:50%;border:2px solid rgba(251,191,36,.35);animation:tcRipple 1.8s ease-out .6s infinite"></div>',
    '    <div style="position:absolute;width:100px;height:100px;border-radius:50%;border:2px solid rgba(251,191,36,.2);animation:tcRipple 1.8s ease-out 1.1s infinite"></div>',
    '    <div style="width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,rgba(251,191,36,.18),rgba(96,165,250,.1));border:2.5px solid rgba(251,191,36,.65);display:flex;align-items:center;justify-content:center;animation:tcRingPop .65s cubic-bezier(.34,1.56,.64,1) .05s both;filter:drop-shadow(0 0 20px rgba(251,191,36,.55))">',
    '      <svg viewBox="0 0 52 52" fill="none" width="46" height="46">',
    '        <circle cx="26" cy="26" r="23" stroke="rgba(251,191,36,.2)" stroke-width="1.5"/>',
    '        <polyline points="13,27 22,37 39,16"',
    '          stroke="#fbbf24" stroke-width="4"',
    '          stroke-linecap="round" stroke-linejoin="round" fill="none"',
    '          style="stroke-dasharray:54;stroke-dashoffset:54;animation:tcPathDraw .55s cubic-bezier(.22,1,.36,1) .55s forwards"/>',
    '      </svg>',
    '    </div>',
    '  </div>',
    // Title
    '  <div style="font-size:26px;font-weight:800;color:#fff;font-family:Prompt,sans-serif;animation:tcTitleUp .5s ease .35s both">ปิดงานสำเร็จ! 🎉</div>',
    // Subtitle
    '  <div style="font-size:13px;color:rgba(255,255,255,.45);margin-top:12px;line-height:1.8;animation:tcTitleUp .5s ease .5s both">งานซ่อมแซมเสร็จเรียบร้อยแล้ว<br>ระบบจะแจ้งผู้ร้องเรียนทาง LINE อัตโนมัติ</div>',
    // Mission chip badge
    '  <div style="display:inline-flex;align-items:center;gap:8px;margin-top:14px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.4);border-radius:99px;padding:7px 20px;font-size:13px;font-weight:700;color:#fbbf24;letter-spacing:.8px;animation:tcChipIn .5s ease .65s both">',
    '    <span>✅</span><span>MISSION COMPLETE</span>',
    '  </div>',
    // Progress bar (gold → blue)
    '  <div style="width:0;height:3px;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#60a5fa,rgba(255,255,255,.2));margin:20px auto 0;animation:tcBarGrow .7s cubic-bezier(.22,1,.36,1) .8s both;box-shadow:0 0 14px rgba(251,191,36,.5)"></div>',
    // Dots
    '  <div style="display:flex;justify-content:center;gap:6px;margin-top:16px">',
    '    <span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;display:inline-block;animation:tcDotsBounce 1.4s ease-in-out .9s infinite"></span>',
    '    <span style="width:8px;height:8px;border-radius:50%;background:#60a5fa;display:inline-block;animation:tcDotsBounce 1.4s ease-in-out 1.0s infinite"></span>',
    '    <span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);display:inline-block;animation:tcDotsBounce 1.4s ease-in-out 1.1s infinite"></span>',
    '  </div>',
    '</div>'
  ].join('');

  document.body.appendChild(ov);

  // Fade in
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      ov.style.opacity = '1';
    });
  });

  /* exit after 3.2s */
  setTimeout(function () {
    ov.style.transition = 'opacity .45s ease';
    ov.style.opacity = '0';

    /* Fade techCards out simultaneously */
    var tc = ge('techCards');
    if (tc) {
      tc.style.transition = 'opacity 0.32s ease';
      tc.style.opacity = '0';
    }

    /* Flag next render to skip card bounce animation */
    _suppressCardAnim = true;
    _lastTechJSON = null;

    /* After overlay gone, fire update → renderTech will fade cards back in */
    setTimeout(function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (typeof onDone === 'function') onDone();
    }, 470);
  }, 3200);
}

/* ─ แก้ปัญหา modal ค้าง: อัปเดต modal ทันทีหลังเปลี่ยนสถานะ ─
   เรียกใช้จาก acceptJob / startWork ซึ่ง modal เปิดอยู่เสมอ    */
async function apiStatusAndRefreshModal(id, status, toastMsg) {
  try {
    var res = await fetch('/api/tickets/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    var updated = await res.json();
    if (!res.ok) {
      showToast(updated.error || 'เกิดข้อผิดพลาด', true);
      return;
    }
    if (toastMsg) showToast(toastMsg);

    // อัปเดต memory store ทันที แล้ว re-open modal ด้วยข้อมูลใหม่
    if (window._tcTickets && window._tcTickets[id]) {
      Object.assign(window._tcTickets[id], updated);
      // อัปเดต master list ด้วย
      for (var i = 0; i < _tcAllTickets.length; i++) {
        if (_tcAllTickets[i].ticketId === id) {
          Object.assign(_tcAllTickets[i], updated);
          break;
        }
      }
    }
    // force เปิด modal ใหม่เพื่อแสดง step ถัดไป
    tcToggle(id);
    // โหลดข้อมูลทั้งหมดในพื้นหลัง (guard ใน renderTech จะ skip re-render ขณะ modal เปิด)
    loadTickets();
  } catch (e) {
    console.error('[apiStatusAndRefreshModal]', e);
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', true);
  }
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
  // FIX: ใช้ closest() เพื่อรองรับกรณี user คลิก child element (emoji/text) แทน islot div
  var target = el.closest ? el.closest('[data-id][data-type]') : el;
  if (!target) target = el;

  upId   = target.getAttribute('data-id');
  upType = target.getAttribute('data-type');

  if (!upId || !upType) {
    console.error('[triggerUpload] ไม่พบ data-id/data-type:', el);
    showToast('เกิดข้อผิดพลาด: ไม่พบ ID ของงาน', true);
    return;
  }

  var inp = ge('techFile');
  if (!inp) { showToast('ไม่พบ file input', true); return; }
  inp.value = '';

  // snapshot upId/upType ป้องกัน closure เปลี่ยนระหว่าง async
  var _upId = upId;
  var _upType = upType;

  inp.onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var fd = new FormData();
    fd.append('image', f);
    fetch('/api/tickets/' + _upId + '/upload/' + _upType, { method: 'POST', body: fd })
      .then(function (r) {
        if (!r.ok) return r.json().then(function(d){ throw new Error(d.error || 'upload failed ' + r.status); });
        return r.json();
      })
      .then(function (d) {
        showToast('✅ อัปโหลดสำเร็จ');
        // อัปเดต memory store ทันที แล้ว re-render modal โดยไม่ต้องรอ poll
        if (window._tcTickets && window._tcTickets[_upId]) {
          if (_upType === 'before') window._tcTickets[_upId].beforeImage = d.url;
          if (_upType === 'after')  window._tcTickets[_upId].afterImage  = d.url;
          for (var i = 0; i < _tcAllTickets.length; i++) {
            if (_tcAllTickets[i].ticketId === _upId) {
              if (_upType === 'before') _tcAllTickets[i].beforeImage = d.url;
              if (_upType === 'after')  _tcAllTickets[i].afterImage  = d.url;
              break;
            }
          }
          tcToggle(_upId);
        }
        loadTickets();
      })
      .catch(function (err) { showToast(err.message || 'อัปโหลดไม่สำเร็จ', true); });
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