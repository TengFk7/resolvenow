/* ─────────────────────────────────────────────
   public/js/technician.js — Technician Features
   • Render assigned tickets with 3-step workflow
   • Job actions: accept, start, reject, complete
   • Image upload (before/after)
   • Help requests: load, accept, create
   ───────────────────────────────────────────── */

/* ── Render Tech Tickets ─────────────────────────────── */
function renderTech(data) {
  var el = ge('techCards');
  var active = data.filter(function (t) { return t.status !== 'completed' && t.status !== 'rejected'; });
  ge('techSub').textContent = 'แผนก: ' + (DEPT_ICON[CU.specialty] || '') + ' ' + (DEPT[CU.specialty] || CU.specialty) + ' | งานทั้งหมด ' + data.length + ' | ค้างอยู่ ' + active.length;
  if (!data.length) { el.innerHTML = '<div class="empty">ไม่มีงานในแผนกของคุณ</div>'; return; }
  var sorted = active.concat(data.filter(function (t) { return t.status === 'completed' || t.status === 'rejected'; }));
  var h = '';
  for (var i = 0; i < sorted.length; i++) {
    var t = sorted[i];
    var urgent = t.priorityScore >= 70;
    var isDone = t.status === 'completed' || t.status === 'rejected';
    var s1 = t.status === 'pending' ? 'active' : 'done';
    var s2 = t.status === 'pending' ? 'idle' : (t.status === 'assigned' ? 'active' : 'done');
    var s3 = t.status === 'in_progress' ? 'active' : (t.status === 'completed' ? 'done' : 'idle');

    h += '<div class="tcard">';
    h += '<div class="tchead"><div><div class="tcid">TICKET #' + t.ticketId + '</div><div class="tctitle">' + (DEPT_ICON[t.category] || '') + ' ' + (DEPT[t.category] || t.category) + ' - ' + t.location + '</div></div>';
    h += '<span class="badge ' + (urgent ? 'urgent' : 'normal') + '">' + (urgent ? '&#9889; เร่งด่วน' : 'ปกติ') + ' ' + pLabel(t.priorityScore) + '</span></div>';
    h += '<div class="tcbody">';
    h += '<div class="mrow"><span class="mi">&#9888;&#65039;</span><span>' + t.description + '</span></div>';
    h += '<div class="mrow"><span class="mi">&#128205;</span><span>' + t.location + '</span></div>';
    h += '<div class="mrow"><span class="mi">&#128100;</span><span>' + t.citizenName + '</span></div>';
    h += '<div class="mrow" style="margin-bottom:12px"><span class="mi">&#128336;</span><span>' + t.createdAt + '</span></div>';
    if (t.citizenImage)
      h += '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:600;color:var(--mu);margin-bottom:4px">รูปจากผู้แจ้ง</div><img src="' + t.citizenImage + '" onclick="viewImg(this.src,\'รูปผู้แจ้ง\')" style="width:100%;max-height:140px;object-fit:cover;border-radius:10px;cursor:pointer"/></div>';

    if (isDone) {
      var dc = t.status === 'completed' ? '#065f46' : '#991b1b';
      var db = t.status === 'completed' ? '#f0fdf4' : '#fef2f2';
      var dd = t.status === 'completed' ? '#bbf7d0' : '#fecaca';
      h += '<div style="background:' + db + ';border:1px solid ' + dd + ';border-radius:10px;padding:12px;text-align:center;font-size:14px;font-weight:600;color:' + dc + '">' + (t.status === 'completed' ? '&#9989; เสร็จสิ้น' : '&#10060; ปฏิเสธ') + '</div>';
      if (t.beforeImage || t.afterImage) {
        h += '<div class="irow" style="margin-top:10px">';
        if (t.beforeImage) h += '<div class="islot has" onclick="viewImg(\'' + t.beforeImage + '\',\'ก่อน\')"><img src="' + t.beforeImage + '"/><div class="ilbl">ก่อน</div></div>';
        if (t.afterImage) h += '<div class="islot has" onclick="viewImg(\'' + t.afterImage + '\',\'หลัง\')"><img src="' + t.afterImage + '"/><div class="ilbl">หลัง</div></div>';
        h += '</div>';
      }
    } else {
      // STEP 1
      h += '<div class="step"><div class="shead"><div class="snum ' + s1 + '">' + (s1 === 'done' ? '&#10003;' : '1') + '</div><div class="slbl">ข้อมูลการร้องเรียน</div><span class="sstat ' + s1 + '">' + (s1 === 'done' ? 'เสร็จ' : 'รอ') + '</span></div>';
      if (t.status === 'pending')
        h += '<div class="sbody"><p style="font-size:13px;color:#4a5568;margin-bottom:12px">กดรับงานเพื่อเริ่มลงพื้นที่</p><button class="btnaccept" data-id="' + t.ticketId + '" onclick="acceptJob(this)">&#128295; รับเรื่องและลงพื้นที่</button></div>';
      h += '</div>';

      // STEP 2
      h += '<div class="step"><div class="shead"><div class="snum ' + s2 + '">' + (s2 === 'done' ? '&#10003;' : '2') + '</div><div class="slbl">ยืนยันการเข้าตรวจสอบ</div><span class="sstat ' + s2 + '">' + (s2 === 'done' ? 'เสร็จ' : s2 === 'active' ? 'กำลังทำ' : 'รอ') + '</span></div>';
      if (s2 === 'active') {
        h += '<div class="sbody"><p style="font-size:13px;color:var(--mu);margin-bottom:10px">ถ่ายรูปสภาพก่อนซ่อม</p>';
        if (t.beforeImage) h += '<div class="islot has" style="display:block;margin-bottom:12px" data-id="' + t.ticketId + '" data-type="before" onclick="triggerUpload(this)"><img src="' + t.beforeImage + '" style="width:100%;height:130px;object-fit:cover;border-radius:8px"/><div class="ilbl" style="color:var(--g)">&#9989; อัปโหลดแล้ว — คลิกเปลี่ยน</div></div>';
        else h += '<div class="islot" style="display:block;margin-bottom:12px;padding:20px" data-id="' + t.ticketId + '" data-type="before" onclick="triggerUpload(this)"><div style="font-size:28px">&#128247;</div><div style="font-size:13px;margin-top:4px">คลิกถ่ายรูปก่อนซ่อม</div></div>';
        h += '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#4a5568;display:block;margin-bottom:4px">บันทึกเพิ่มเติม (ไม่บังคับ)</label><textarea style="width:100%;border:1.5px solid var(--bd);border-radius:10px;padding:8px 12px;font-size:13px;outline:none;font-family:inherit;resize:none;height:70px;background:#fafafa" placeholder="บรรยายสภาพปัญหา..."></textarea></div>';
        h += '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px">&#128204; ต้องการความช่วยเหลือจากช่างแผนกอื่น?</div><button class="btn-help" data-id="' + t.ticketId + '" onclick="openHelpModal(this.getAttribute(\'data-id\'))">&#128204; ขอความช่วยเหลือ</button></div>';
        h += '<div style="display:flex;gap:8px"><button class="btnreject2" data-id="' + t.ticketId + '" onclick="rejectJob(this)">ปฏิเสธ</button><button class="btnconfirm" data-id="' + t.ticketId + '" onclick="startWork(this)">&#9989; ยืนยันเริ่มซ่อม</button></div></div>';
      }
      h += '</div>';

      // STEP 3
      h += '<div class="step"><div class="shead"><div class="snum ' + s3 + '">' + (s3 === 'done' ? '&#10003;' : '3') + '</div><div class="slbl">หลักฐานหลังการดำเนินการ</div><span class="sstat ' + s3 + '">' + (s3 === 'done' ? 'เสร็จ' : s3 === 'active' ? 'กำลังทำ' : 'รอ') + '</span></div>';
      if (s3 === 'active') {
        h += '<div class="sbody"><p style="font-size:13px;color:var(--mu);margin-bottom:10px">ถ่ายรูปหลังซ่อม</p><div class="irow">';
        if (t.beforeImage) h += '<div class="islot has" onclick="viewImg(\'' + t.beforeImage + '\',\'ก่อน\')"><img src="' + t.beforeImage + '"/><div class="ilbl">ก่อน</div></div>';
        else h += '<div class="islot" data-id="' + t.ticketId + '" data-type="before" onclick="triggerUpload(this)"><div style="padding:12px 0;font-size:20px">&#128247;</div><div class="ilbl">คลิกถ่ายก่อนซ่อม</div></div>';
        if (t.afterImage) h += '<div class="islot has" data-id="' + t.ticketId + '" data-type="after" onclick="triggerUpload(this)"><img src="' + t.afterImage + '"/><div class="ilbl" style="color:var(--g)">&#9989; คลิกเปลี่ยน</div></div>';
        else h += '<div class="islot" data-id="' + t.ticketId + '" data-type="after" onclick="triggerUpload(this)"><div style="padding:12px 0;font-size:20px">&#128247;</div><div class="ilbl">คลิกถ่ายหลังซ่อม</div></div>';
        h += '</div>';
        h += '<div style="margin-bottom:12px"><label style="font-size:13px;font-weight:500;color:#4a5568;display:block;margin-bottom:4px">บรรยายงานที่ทำ</label><textarea style="width:100%;border:1.5px solid var(--bd);border-radius:10px;padding:8px 12px;font-size:13px;outline:none;font-family:inherit;resize:none;height:70px;background:#fafafa" placeholder="อธิบายงานที่แก้ไขแล้ว..."></textarea></div>';
        h += '<button class="btnclose"' + (t.afterImage ? '' : ' disabled') + ' data-id="' + t.ticketId + '" onclick="completeJob(this)">&#128228; ยืนยันปิดเรื่องร้องเรียน</button>';
        if (!t.afterImage) h += '<p style="font-size:12px;color:var(--mu);text-align:center;margin-top:6px">กรุณาอัปโหลดรูปหลังซ่อมก่อน</p>';
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div></div>';
  }
  el.innerHTML = h;
}

/* ── Job Actions ─────────────────────────────────────── */
function acceptJob(btn) { apiStatus(btn.getAttribute('data-id'), 'assigned'); showToast('&#9989; รับงานแล้ว'); }
function startWork(btn) { apiStatus(btn.getAttribute('data-id'), 'in_progress'); showToast('&#128295; เริ่มดำเนินการ'); }
function rejectJob(btn) { apiStatus(btn.getAttribute('data-id'), 'rejected'); showToast('ปฏิเสธแล้ว', true); }
function completeJob(btn) { apiStatus(btn.getAttribute('data-id'), 'completed'); showToast('&#127881; ปิดงานสำเร็จ'); }

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
        showToast('&#9989; อัปโหลดสำเร็จ');
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
        h += '<div class="help-card">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">';
        h += '<div><div style="font-size:13px;font-weight:700">&#128204; ' + hp.requesterName + ' (' + (DEPT[hp.requesterDept] || hp.requesterDept) + ') ขอความช่วยเหลือ</div>';
        h += '<div style="font-size:12px;color:#4a5568;margin-top:2px">Ticket: ' + hp.ticketId + ' — ' + (DEPT_ICON[hp.ticketCategory] || '') + ' ' + (DEPT[hp.ticketCategory] || hp.ticketCategory) + ' ที่ ' + hp.ticketLocation + '</div>';
        if (hp.message) h += '<div style="font-size:12px;color:var(--mu);margin-top:2px">ข้อความ: ' + hp.message + '</div>';
        h += '</div></div>';
        h += '<button class="btn-help-accept" data-id="' + hp.id + '" onclick="acceptHelp(this)">&#9989; รับงานช่วยเหลือ</button>';
        h += '</div>';
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
  showToast('&#9989; รับงานช่วยเหลือแล้ว!');
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
  var res = await fetch('/api/help-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketId: helpTicketId, message: msg, targetDept: dept }) });
  var data = await res.json();
  if (!res.ok) return showToast(data.error || 'เกิดข้อผิดพลาด', true);
  ge('mHelp').classList.remove('on');
  showToast('&#128204; ส่งคำขอช่วยเหลือแล้ว!');
  loadHelpRequests();
}