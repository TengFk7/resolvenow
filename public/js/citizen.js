var _gpsAddress = '';
var _citizenImgDataUrl = ''; // stores preview DataURL for summary

/* ─────────────────────────────────────────────
   public/js/citizen.js — Citizen Features
   • Category / urgency selection
   • Submit new ticket
   • Render my tickets list
   ───────────────────────────────────────────── */

/* ══════════════════════════════════════════
   WIZARD — 5-Step form controller
══════════════════════════════════════════ */
var _curStep = 1;
var TOTAL_STEPS = 5;

// Transition map: step → { forward: [exitClass, enterClass], backward: [exitClass, enterClass] }
var WIZ_TRANS = {
  1: { fwd: ['exit-left', 'enter-right'],   bwd: ['exit-right', 'enter-left']  },
  2: { fwd: ['exit-top',  'enter-bottom'],  bwd: ['exit-bottom','enter-top']   },
  3: { fwd: ['exit-left', 'enter-right'],   bwd: ['exit-right', 'enter-left']  },
  4: { fwd: ['exit-left', 'enter-right'],   bwd: ['exit-right', 'enter-left']  },
  5: { fwd: ['exit-left', 'enter-right'],   bwd: ['exit-right', 'enter-left']  }
};

function wizGoTo(from, to) {
  var isForward = to > from;
  var fromEl = ge('wiz' + from);
  var toEl   = ge('wiz' + to);
  if (!fromEl || !toEl) return;

  var trans = WIZ_TRANS[from] || WIZ_TRANS[1];
  var exitCls  = isForward ? trans.fwd[0] : trans.bwd[0];
  var enterCls = isForward ? trans.fwd[1] : trans.bwd[1];

  // Exit current step
  fromEl.classList.add(exitCls);
  setTimeout(function() {
    fromEl.classList.remove('active', exitCls);
    // Enter new step
    toEl.classList.add('active', enterCls);
    setTimeout(function() {
      toEl.classList.remove(enterCls);
    }, 500);
  }, 340);

  _curStep = to;
  wizUpdateProgress(to);

  // If arriving at step 5 — render summary
  if (to === 5) wizBuildSummary();

  // Scroll to top of wizard
  var prog = ge('stepProgress');
  if (prog) prog.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function wizNext(step) {
  // Validation per step
  if (step === 1) {
    if (!getSelectedCat()) { ge('catErr').classList.add('on'); return; }
    hideE('catErr');
    // Update icon on step 1 based on selection
    var icon = { Road:'🛣️', Water:'💧', Electricity:'💡', Garbage:'🗑️', Animal:'🐍', Tree:'🌿', Hazard:'🚨' };
    var cat = getSelectedCat();
    var h2 = ge('wiz1').querySelector('h2');
    if (h2 && icon[cat]) h2.textContent = icon[cat] + ' ' + (DEPT[cat] || cat);
  }
  if (step === 2) {
    var desc = ge('tDesc').value.trim();
    if (!desc) { showToast('กรุณากรอกรายละเอียด', true); return; }
  }
  if (step === 3) {
    if (!ge('tLat').value || !ge('tLng').value) {
      showToast('กรุณาระบุตำแหน่ง GPS ก่อน', true); return;
    }
  }
  if (step === 4) {
    if (!ge('cImg').files[0]) { showToast('กรุณาแนบรูปภาพก่อน', true); return; }
  }
  if (step < TOTAL_STEPS) wizGoTo(step, step + 1);
}

function wizBack(step) {
  if (step > 1) wizGoTo(step, step - 1);
}

function wizUpdateProgress(step) {
  // Fill bar: 0% at step 1, 100% at step 5
  var pct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;
  var fill = ge('stepFill');
  if (fill) fill.style.width = pct + '%';

  // Dots
  document.querySelectorAll('.step-dot').forEach(function(d) {
    var s = parseInt(d.getAttribute('data-step'));
    d.classList.remove('on', 'done');
    if (s === step) d.classList.add('on');
    else if (s < step) d.classList.add('done');
  });
}

function wizBuildSummary() {
  var cat = getSelectedCat();
  var desc = ge('tDesc').value.trim();
  var hasGps = ge('tLat').value && ge('tLng').value;
  var file = ge('cImg').files[0];
  var urg = ge('tUrg').value || 'ไม่ระบุ';
  var urgTH = { urgent: '⚡ ด่วนมาก', medium: '⏰ ด่วน', normal: '🔵 ปกติ' }[urg] || urg;
  var catTH = DEPT[cat] || cat || '—';
  var icon  = { Road:'🛣️', Water:'💧', Electricity:'💡', Garbage:'🗑️', Animal:'🐍', Tree:'🌿', Hazard:'🚨' };

  var h = '';
  h += sumRow(icon[cat] || '📋', 'ประเภทปัญหา', catTH);
  h += sumRow('📝', 'รายละเอียด', desc || '—');
  h += sumRow('📍', 'สถานที่', hasGps ? '✅ ' + (_gpsAddress || 'บันทึกแล้ว') : '❌ ยังไม่ได้ระบุ');
  // Show image thumbnail instead of filename
  var imgHtml = _citizenImgDataUrl
    ? '<img src="' + _citizenImgDataUrl + '" style="width:100%;max-height:120px;object-fit:cover;border-radius:10px;margin-top:6px;border:1.5px solid var(--border)"/>'
    : '❌ ยังไม่ได้แนบ';
  h += sumRowRaw('📷', 'รูปภาพ', imgHtml);
  h += sumRow('🤖', 'ระดับความเร่งด่วน', urgTH);
  ge('wizSummary').innerHTML = h;
}

function sumRow(icon, label, val) {
  return '<div class="wiz-summary-item"><div class="wiz-summary-icon">' + icon + '</div><div><div class="wiz-summary-label">' + label + '</div><div class="wiz-summary-val">' + val + '</div></div></div>';
}
function sumRowRaw(icon, label, rawHtml) {
  return '<div class="wiz-summary-item"><div class="wiz-summary-icon">' + icon + '</div><div style="flex:1;min-width:0"><div class="wiz-summary-label">' + label + '</div>' + rawHtml + '</div></div>';
}


/* ── Category Selection ──────────────────────────────── */
function toggleCat(el) {
  document.querySelectorAll('#catGrid .catbox').forEach(function (b) { b.classList.remove('on'); });
  el.classList.add('on');
  hideE('catErr');
}
function getSelectedCat() {
  var el = document.querySelector('#catGrid .catbox.on');
  return el ? el.getAttribute('data-val') : null;
}

/* ── AI Urgency Suggestion ──────────────────────────── */
var _urgTimer = null;
function aiSuggestUrgency() {
  var desc = ge('tDesc').value.trim();
  if (desc.length < 5) {
    ge('tUrg').value = '';
    ge('urgAiIcon').textContent = '🤖';
    ge('urgAiLabel').textContent = 'รอวิเคราะห์...';
    ge('urgAiSub').textContent = 'พิมพ์รายละเอียดเพื่อให้ AI ประเมินระดับความเร่งด่วน';
    ge('urgAiBox').style.background = '#f8fafc';
    ge('urgAiBox').style.borderColor = '#cbd5e0';
    hideE('urgErr');
    return;
  }
  // debounce 900ms
  clearTimeout(_urgTimer);
  ge('urgAiIcon').textContent = '⏳';
  ge('urgAiLabel').textContent = 'AI กำลังวิเคราะห์...';
  ge('urgAiSub').textContent = 'สักครู่...';
  _urgTimer = setTimeout(async function () {
    try {
      var r = await fetch('/api/ai/urgency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, category: getSelectedCat() })
      });
      var d = await r.json();
      var urg = d.urgency || 'normal';
      ge('tUrg').value = urg;
      hideE('urgErr');
      var cfg = {
        urgent:  { icon: '⚡',   label: 'ด่วนมาก',  sub: 'AI ประเมินว่าเรื่องนี้เร่งด่วนมาก', bg: '#fff5f5', border: '#fc8181', labelColor: '#c53030' },
        medium:  { icon: '⏰️',  label: 'ด่วน',     sub: 'AI ประเมินว่าควรเร่งดำเนินการ',       bg: '#fffbeb', border: '#f6ad55', labelColor: '#c05621' },
        normal:  { icon: '🔵',   label: 'ปกติ',     sub: 'AI ประเมินว่าไม่เร่งด่วน',     bg: '#ebf8ff', border: '#90cdf4', labelColor: '#2b6cb0' }
      }[urg];
      ge('urgAiIcon').textContent = cfg.icon;
      ge('urgAiLabel').textContent = cfg.label;
      ge('urgAiLabel').style.color = cfg.labelColor;
      ge('urgAiSub').textContent = cfg.sub;
      ge('urgAiBox').style.background = cfg.bg;
      ge('urgAiBox').style.borderColor = cfg.border;
      ge('urgAiBox').style.borderStyle = 'solid';
    } catch (e) {
      ge('urgAiIcon').textContent = '⚠️';
      ge('urgAiLabel').textContent = 'ไม่สามารถวิเคราะห์ได้';
      ge('urgAiSub').textContent = 'กรุณาตรวจสอบการเชื่อมต่อ';
    }
  }, 900);
}


/* ── GPS Location Capture ───────────────────────────── */
function captureGPS() {
  if (!navigator.geolocation) {
    showToast('เบราว์เซอร์ของคุณไม่รองรับ GPS', true);
    return;
  }
  var btn = ge('btnGps');
  var icon = ge('gpsIcon');
  var text = ge('gpsBtnText');
  // Show loading state
  btn.disabled = true;
  icon.textContent = '⏳';
  text.textContent = 'กำลังระบุตำแหน่ง...';
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var lat = pos.coords.latitude.toFixed(6);
      var lng = pos.coords.longitude.toFixed(6);
      var acc = Math.round(pos.coords.accuracy);
      // Store in hidden fields
      ge('tLat').value = lat;
      ge('tLng').value = lng;
      // Reverse geocode: get human-readable address
      _gpsAddress = 'กำลังโหลดที่อยู่...';
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=th', { headers: { 'Accept': 'application/json' } })
        .then(function(r){ return r.json(); })
        .then(function(d){
          var a = d.address || {};
          var parts = [];
          if (a.road) parts.push(a.road);
          if (a.suburb || a.village || a.neighbourhood) parts.push(a.suburb || a.village || a.neighbourhood);
          if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county);
          if (a.state) parts.push(a.state);
          _gpsAddress = parts.join(', ') || d.display_name || (lat + ', ' + lng);
          // Update button text live
          var bt = ge('gpsBtnText');
          if (bt) bt.textContent = _gpsAddress;
        })
        .catch(function(){ _gpsAddress = lat + ', ' + lng; });
      // Build mini map (OpenStreetMap embed)
      var delta = 0.005;
      var bbox = (parseFloat(lng)-delta)+','+(parseFloat(lat)-delta)+','+(parseFloat(lng)+delta)+','+(parseFloat(lat)+delta);
      var mapUrl = 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + lat + '%2C' + lng;
      ge('gpsResult').innerHTML =
        '<div style="font-weight:700;margin-bottom:6px;font-size:12px">✅ ตำแหน่ง GPS ที่บันทึก</div>' +
        '<iframe src="' + mapUrl + '" style="width:100%;height:180px;border:none;border-radius:8px;display:block" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">' +
          '<span style="font-size:10px;color:#2d6a4f">±' + acc + 'm</span>' +
          '<a href="https://www.google.com/maps?q=' + lat + ',' + lng + '" target="_blank" style="font-size:11px;color:#2b6cb0;text-decoration:none;font-weight:600">🗺️ Google Maps</a>' +
        '</div>';
      ge('gpsResult').style.display = 'block';
      btn.style.background = '#f0fff4';
      btn.style.borderColor = '#9ae6b4';
      btn.style.color = '#276749';
      icon.textContent = '✅';
      text.textContent = 'ตำแหน่งถูกบันทึกแล้ว (แตะเพื่ออัปเดต)';
      btn.disabled = false;
    },
    function (err) {
      var msg = 'ไม่สามารถระบุตำแหน่งได้';
      if (err.code === 1) msg = 'กรุณาอนุญาตการเข้าถึง GPS ในเบราว์เซอร์';
      if (err.code === 2) msg = 'ไม่พบสัญญาณ GPS กรุณาลองใหม่';
      if (err.code === 3) msg = 'หมดเวลารอ GPS กรุณาลองใหม่';
      showToast(msg, true);
      icon.textContent = '📍';
      text.textContent = 'ระบุตำแหน่ง GPS จากอุปกรณ์ของฉัน';
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

/* ── Submit Ticket ───────────────────────────────────── */
async function submitTicket() {
  var cat = getSelectedCat();
  var urg = ge('tUrg').value;
  var desc = ge('tDesc').value.trim();
  var lat = ge('tLat').value;
  var lng = ge('tLng').value;
  var ok = true;
  if (!cat) { ge('catErr').classList.add('on'); ok = false; } else hideE('catErr');
  if (!urg) { urg = 'normal'; ge('tUrg').value = 'normal'; } else hideE('urgErr');
  if (!lat || !lng) { showToast('กรุณาระบุตำแหน่ง GPS ก่อนส่ง', true); ok = false; }
  if (!desc) { showToast('กรุณากรอกรายละเอียด', true); ok = false; }
  var f = ge('cImg').files[0];
  if (!f) { showToast('กรุณาแนบรูปภาพก่อนส่ง', true); ok = false; }
  if (!ok) return;
  try {
    var fd = new FormData();
    fd.append('category', cat);
    fd.append('urgency', urg);
    fd.append('location', lat + ',' + lng);  // GPS coordinates as location
    fd.append('description', desc);
    fd.append('lat', lat);
    fd.append('lng', lng);
    var f = ge('cImg').files[0];
    if (f) fd.append('image', f);
    var res = await fetch('/api/tickets', { method: 'POST', body: fd });
    var data = await res.json();
    if (!res.ok) return showToast(data.error || 'เกิดข้อผิดพลาด', true);

    // ── Success Animation ─────────────────────────────────
    _showSubmitSuccess(data.ticketId, function() {
      // Reset form fields
      ge('tDesc').value = '';
      ge('cImg').value = '';
      ge('tLat').value = '';
      ge('tLng').value = '';
      ge('tUrg').value = '';
      ge('descCount').textContent = '0';
      ge('gpsResult').style.display = 'none';
      _citizenImgDataUrl = '';
      ge('urgAiIcon').textContent = '🤖'; ge('urgAiLabel').textContent = 'รอวิเคราะห์...';
      ge('urgAiLabel').style.color = '#4a5568';
      ge('urgAiSub').textContent = 'พิมพ์รายละเอียดเพื่อให้ AI ประเมินระดับความเร่งด่วน';
      ge('urgAiBox').style.background = '#f8fafc'; ge('urgAiBox').style.borderColor = '#cbd5e0'; ge('urgAiBox').style.borderStyle = 'dashed';
      var gpsBtn = ge('btnGps'); var gpsIcon2 = ge('gpsIcon'); var gpsBtnText = ge('gpsBtnText');
      gpsBtn.style.background = ''; gpsBtn.style.borderColor = ''; gpsBtn.style.color = '';
      gpsIcon2.textContent = '📍'; gpsBtnText.textContent = 'ระบุตำแหน่ง GPS จากอุปกรณ์ของฉัน';
      document.querySelectorAll('#catGrid .catbox').forEach(function(b){ b.classList.remove('on'); });
      ge('cImgPrev').innerHTML = '<div style="font-size:48px;margin-bottom:8px">📷</div><div style="font-weight:700;font-size:15px">กดเพื่อแนบรูปภาพ</div><div style="font-size:12px;margin-top:6px;color:var(--muted)">PNG, JPG ไม่เกิน 5MB</div>';
      // Reset wizard to step 1
      _curStep = 1;
      document.querySelectorAll('.wiz-step').forEach(function(s){ s.classList.remove('active','enter-right','enter-left','enter-bottom','enter-top','exit-left','exit-right','exit-top'); });
      var wiz1 = ge('wiz1');
      if (wiz1) { wiz1.classList.add('active'); var h2 = wiz1.querySelector('h2'); if (h2) h2.textContent = 'ประเภทปัญหา'; }
      wizUpdateProgress(1);
      loadTickets();
    });

  } catch (e) { showToast('เกิดข้อผิดพลาด', true); }
}

/* ── Image Preview (before upload) ──────────────────── */
function prevCitizenImg(e) {
  var f = e.target.files[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function (ev) {
    _citizenImgDataUrl = ev.target.result;
    ge('cImgPrev').innerHTML = '<img src="' + ev.target.result + '" style="max-width:100%;max-height:140px;border-radius:10px;object-fit:cover"/>';
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
    // Rating section for completed tickets
    if (done) {
      if (t.rating) {
        var starsHtml = '<span style="color:#f59e0b;font-size:16px">';
        for (var s = 0; s < t.rating; s++) starsHtml += '⭐';
        for (var s2 = t.rating; s2 < 5; s2++) starsHtml += '☆';
        starsHtml += '</span>';
        h += '<div style="margin-top:8px;padding:8px 12px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:10px;font-size:12px;display:flex;align-items:center;gap:8px">';
        h += '<span style="font-weight:700;color:#92400e">คะแนน:</span>' + starsHtml;
        if (t.ratingReason) h += '<span style="color:#92400e;font-size:11px">— ' + t.ratingReason + '</span>';
        h += '</div>';
      } else {
        h += '<button onclick="openRatingModal(\'' + t.ticketId + '\',\'' + t.citizenName + '\')" style="margin-top:8px;width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,.3)">⭐ ประเมินความพึงพอใจ</button>';
      }
    }
  }
  el.innerHTML = h;
}

/* ── Submit Success Overlay Animation ───────────────── */
function _showSubmitSuccess(ticketId, onDone) {
  var ov = document.createElement('div');
  ov.id = 'submitSuccessOverlay';
  ov.style.cssText = [
    'position:fixed;inset:0;z-index:9000',
    'display:flex;flex-direction:column;align-items:center;justify-content:center',
    'background:linear-gradient(145deg,rgba(5,150,105,.97) 0%,rgba(16,185,129,.95) 50%,rgba(4,120,87,.98) 100%)',
    'padding:40px 24px;text-align:center'
  ].join(';');

  ov.innerHTML = [
    // Ring wrap with ripple rings
    '<div class="ss-ring-wrap">',
    '  <div class="ss-ripple"></div>',
    '  <div class="ss-ripple"></div>',
    '  <div class="ss-ripple"></div>',
    '  <div class="ss-ring">',
    '    <div class="ss-check">',
    '      <svg viewBox="0 0 52 52" fill="none">',
    '        <circle cx="26" cy="26" r="23" stroke="rgba(255,255,255,.25)" stroke-width="2"/>',
    '        <polyline class="ss-path" points="13,27 22,36 39,17"',
    '          stroke="white" stroke-width="3.5"',
    '          stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    '      </svg>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div class="ss-title">ส่งสำเร็จ! 🎉</div>',
    '<div class="ss-id">' + ticketId + '</div>',
    '<div class="ss-sub">เรื่องร้องเรียนของคุณถูกบันทึกแล้ว<br>ระบบกำลังเตรียมรับเรื่องใหม่...</div>',
    '<div class="ss-dots"><span></span><span></span><span></span></div>'
  ].join('');

  document.body.appendChild(ov);

  // Enter with class (GPU-smooth scale+fade)
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      ov.classList.add('ss-enter');
    });
  });

  // After 2.8s — exit smoothly then call onDone
  setTimeout(function() {
    ov.classList.remove('ss-enter');
    ov.classList.add('ss-exit');
    setTimeout(function() {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (typeof onDone === 'function') onDone();
    }, 400);
  }, 2800);
}

/* ══════════════════════════════════════════
   RATING MODAL
══════════════════════════════════════════ */
var _ratingTicketId = null;
var _ratingVal = 0;

function openRatingModal(ticketId, citizenName) {
  _ratingTicketId = ticketId;
  _ratingVal = 0;
  var lbl = ge('ratingTicketLabel');
  if (lbl) lbl.textContent = ticketId;
  hideE('ratingErr');
  ge('ratingReasonWrap').style.display = 'none';
  if (ge('ratingReason')) ge('ratingReason').value = '';
  if (ge('starLabel')) ge('starLabel').textContent = '';
  // reset stars
  document.querySelectorAll('.star-btn').forEach(function(b) {
    b.classList.remove('on');
    b.style.color = '';
    b.style.transform = '';
  });
  // reset submit button (อาจค้าง disabled จากครั้งก่อน)
  var btn = ge('btnSubmitRating');
  if (btn) { btn.disabled = false; btn.textContent = '⭐ ส่งคะแนน'; }
  ge('mRating').classList.add('on');
}

function closeRatingModal() {
  ge('mRating').classList.remove('on');
  _ratingTicketId = null;
  _ratingVal = 0;
}

function setRatingStar(val) {
  _ratingVal = val;
  var LABELS = { 1: '😤 ไม่พอใจมาก', 2: '😞 ไม่ค่อยพอใจ', 3: '😐 พอใจปานกลาง', 4: '😊 พอใจมาก', 5: '😄 พอใจมากที่สุด!' };
  var COLORS  = { 1: '#dc2626', 2: '#f97316', 3: '#ca8a04', 4: '#16a34a', 5: '#059669' };
  // Animate each star
  document.querySelectorAll('.star-btn').forEach(function(b) {
    var bv = parseInt(b.getAttribute('data-val'));
    b.classList.toggle('on', bv <= val);
    b.style.color = bv <= val ? '#f59e0b' : '#d1d5db';
    // micro-bounce
    if (bv <= val) {
      b.style.transform = 'scale(1.3)';
      setTimeout(function() { b.style.transform = ''; }, 180);
    }
  });
  var lbl = ge('starLabel');
  if (lbl) { lbl.textContent = LABELS[val] || ''; lbl.style.color = COLORS[val] || 'var(--muted)'; }

  // Show reason field if < 3 stars
  var wrap = ge('ratingReasonWrap');
  if (wrap) wrap.style.display = val < 3 ? 'block' : 'none';
  hideE('ratingErr');
}

async function submitRating() {
  if (!_ratingVal) return showE('ratingErr', 'กรุณาเลือกคะแนนก่อน');
  if (_ratingVal < 3) {
    var reason = ge('ratingReason') ? ge('ratingReason').value.trim() : '';
    if (!reason) return showE('ratingErr', 'กรุณาระบุเหตุผลที่ไม่พอใจ');
  }
  var btn = ge('btnSubmitRating');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  try {
    var reason2 = (ge('ratingReason') ? ge('ratingReason').value.trim() : '');
    var res = await fetch('/api/tickets/' + _ratingTicketId + '/rating', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: _ratingVal, reason: reason2 })
    });
    var data = await res.json();
    if (!res.ok) {
      if (btn) { btn.disabled = false; btn.textContent = '⭐ ส่งคะแนน'; }
      return showE('ratingErr', data.error || 'เกิดข้อผิดพลาด');
    }
    var finalStars = _ratingVal; // บันทึกก่อน closeRatingModal() จะ reset เป็น 0
    closeRatingModal();
    showToast('✅ ขอบคุณสำหรับการประเมิน! ' + '⭐'.repeat(finalStars));
    loadTickets();
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '⭐ ส่งคะแนน'; }
    showE('ratingErr', 'เกิดข้อผิดพลาด');
  }
}