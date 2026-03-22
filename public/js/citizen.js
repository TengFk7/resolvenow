/* ─────────────────────────────────────────────
   public/js/citizen.js — Citizen Features
   • Category / urgency selection
   • Submit new ticket
   • Render my tickets list
   ───────────────────────────────────────────── */

/* ── Category Selection ──────────────────────────────── */
function toggleCat(el) {
  document.querySelectorAll('#catGrid .catbox').forEach(function (b) { b.classList.remove('on'); });
  el.classList.add('on');
  hideE('catErr');
}

function toggleUrg(el) {
  document.querySelectorAll('.urgbox').forEach(function (b) { b.classList.remove('on'); });
  el.classList.add('on');
  hideE('urgErr');
}

function getSelectedCat() {
  var el = document.querySelector('#catGrid .catbox.on');
  return el ? el.getAttribute('data-val') : null;
}

function getSelectedUrg() {
  var el = document.querySelector('.urgbox.on');
  return el ? el.getAttribute('data-val') : null;
}

/* ── Submit Ticket ───────────────────────────────────── */
async function submitTicket() {
  var cat = getSelectedCat(), urg = getSelectedUrg();
  var loc = ge('tLoc').value.trim(), desc = ge('tDesc').value.trim();
  var ok = true;
  if (!cat) { ge('catErr').classList.add('on'); ok = false; } else hideE('catErr');
  if (!urg) { ge('urgErr').classList.add('on'); ok = false; } else hideE('urgErr');
  if (!loc || !desc) return showToast('กรุณากรอกสถานที่และรายละเอียด', true);
  if (!ok) return;
  try {
    var fd = new FormData();
    fd.append('category', cat);
    fd.append('urgency', urg);
    fd.append('location', loc);
    fd.append('description', desc);
    var f = ge('cImg').files[0];
    if (f) fd.append('image', f);
    var res = await fetch('/api/tickets', { method: 'POST', body: fd });
    var data = await res.json();
    if (!res.ok) return showToast(data.error || 'เกิดข้อผิดพลาด', true);
    showToast('&#9989; ส่งสำเร็จ! ' + data.ticketId);
    // Reset form
    ge('tLoc').value = '';
    ge('tDesc').value = '';
    ge('cImg').value = '';
    document.querySelectorAll('#catGrid .catbox').forEach(function (b) { b.classList.remove('on'); });
    document.querySelectorAll('.urgbox').forEach(function (b) { b.classList.remove('on'); });
    ge('cImgPrev').innerHTML = '<div style="font-size:26px;margin-bottom:4px">&#128247;</div><div>คลิกเพื่อแนบรูปภาพ</div><div style="font-size:11px;margin-top:3px;color:var(--mu)">PNG, JPG ไม่เกิน 5MB</div>';
    loadTickets();
  } catch (e) { showToast('เกิดข้อผิดพลาด', true); }
}

/* ── Image Preview (before upload) ──────────────────── */
function prevCitizenImg(e) {
  var f = e.target.files[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function (ev) {
    ge('cImgPrev').innerHTML = '<img src="' + ev.target.result + '" style="max-width:100%;max-height:140px;border-radius:8px;object-fit:cover"/><div style="font-size:12px;color:var(--mu);margin-top:6px">' + f.name + '</div>';
  };
  r.readAsDataURL(f);
}

/* ── Render My Tickets ───────────────────────────────── */
function renderCitizen(data) {
  var el = ge('citizenCards');
  if (!data.length) { el.innerHTML = '<div class="empty">ยังไม่มีเรื่องร้องเรียน</div>'; return; }
  var h = '';
  for (var i = 0; i < data.length; i++) {
    var t = data[i];
    var done = t.status === 'completed';
    h += '<div style="border:1.5px solid ' + (done ? 'var(--g)' : 'var(--bd)') + ';border-radius:12px;padding:14px;margin-bottom:10px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">';
    h += '<div><div style="font-size:11px;color:var(--mu);font-weight:600">' + t.ticketId + '</div>';
    h += '<div style="font-size:14px;font-weight:700">' + (DEPT_ICON[t.category] || '') + ' ' + (DEPT[t.category] || t.category) + ' - ' + t.location + '</div></div>';
    h += '<span class="badge ' + t.status + '">' + stTH(t.status) + '</span></div>';
    h += '<div style="font-size:13px;color:#4a5568;margin-bottom:4px">' + t.description + '</div>';
    h += '<div style="font-size:12px;color:var(--mu);margin-bottom:8px">' + t.createdAt + '</div>';
    if (t.citizenImage)
      h += '<img src="' + t.citizenImage + '" onclick="viewImg(this.src,\'รูป\')" style="width:100%;max-height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;cursor:pointer"/>';
    if (done && (t.beforeImage || t.afterImage)) {
      h += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px"><div style="font-size:12px;font-weight:700;color:#065f46;margin-bottom:8px">&#9989; ช่างดำเนินการเสร็จแล้ว</div><div style="display:flex;gap:8px">';
      if (t.beforeImage) h += '<div style="flex:1;text-align:center"><img src="' + t.beforeImage + '" onclick="viewImg(this.src,\'ก่อน\')" style="width:100%;height:80px;object-fit:cover;border-radius:8px;cursor:pointer"/><div style="font-size:11px;color:#065f46;margin-top:3px;font-weight:600">ก่อน</div></div>';
      if (t.afterImage) h += '<div style="flex:1;text-align:center"><img src="' + t.afterImage + '" onclick="viewImg(this.src,\'หลัง\')" style="width:100%;height:80px;object-fit:cover;border-radius:8px;cursor:pointer"/><div style="font-size:11px;color:#065f46;margin-top:3px;font-weight:600">หลัง</div></div>';
      h += '</div></div>';
    } else if (!done && t.status !== 'pending' && t.status !== 'rejected' && t.beforeImage) {
      h += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px"><div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:4px">&#128295; ช่างกำลังดำเนินการ</div><img src="' + t.beforeImage + '" onclick="viewImg(this.src,\'รูปปัญหา\')" style="width:100%;max-height:70px;object-fit:cover;border-radius:8px;cursor:pointer"/></div>';
    }
    h += '</div>';
  }
  el.innerHTML = h;
}
