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
    if (!_citizenImgDataUrl) { showToast('กรุณาแนบรูปภาพก่อน', true); return; }
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

  var h = '';
  h += sumRow(DEPT_ICON[cat] || '📋', 'ประเภทปัญหา', catTH);
  h += sumRow('📝', 'รายละเอียด', escapeHTML(desc) || '—');
  h += sumRow('📍', 'สถานที่', hasGps ? '✅ ' + escapeHTML(_gpsAddress || 'บันทึกแล้ว') : '❌ ยังไม่ได้ระบุ');
  // Show image thumbnail instead of filename
  var imgHtml = _citizenImgDataUrl
    ? '<img src="' + _citizenImgDataUrl + '" style="width:100%;max-height:120px;object-fit:cover;border-radius:10px;margin-top:6px;border:1.5px solid var(--border)"/>'
    : '❌ ยังไม่ได้แนบ';
  h += sumRowRaw('📷', 'รูปภาพ', imgHtml);
  h += sumRow('🤖', 'ระดับความเร่งด่วน', urgTH);
  ge('wizSummary').innerHTML = h;
}

/* ── Dynamic Category Grid (from API) ───────────────── */
function renderDynamicCatGrid(cats) {
  var grid = ge('catGrid');
  if (!grid) return;
  var h = '';
  for (var i = 0; i < cats.length; i++) {
    var c = cats[i];
    var isLast = (i === cats.length - 1 && cats.length % 2 === 1);
    h += '<div class="catbox" data-val="' + escapeHTML(c.name) + '" onclick="toggleCat(this)"' + (isLast ? ' style="grid-column:1/-1"' : '') + '>';
    h += '<span class="caticon">' + c.icon + '</span>' + escapeHTML(c.label);
    h += '</div>';
  }
  grid.innerHTML = h;
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
  if (!f && !_citizenImgDataUrl) { showToast('กรุณาแนบรูปภาพก่อนส่ง', true); ok = false; }
  if (!ok) return;

  // ── Disable submit button to prevent double-submit ────
  var submitBtn = document.querySelector('.wiz-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ กำลังส่ง...'; }

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
    if (!res.ok) {
      // Re-enable button on API error
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📨 ส่งเรื่องร้องเรียน'; }
      return showToast(data.error || 'เกิดข้อผิดพลาด', true);
    }

    // ── Success Animation ─────────────────────────────────
    _showSubmitSuccess(data.ticketId, function() {
      // Reset form fields
      ge('tDesc').value = '';
      ge('cImg').value = '';
      var _camInp = ge('cImgCamera'); if (_camInp) _camInp.value = '';
      var _galInp = ge('cImgGallery'); if (_galInp) _galInp.value = '';
      ge('tLat').value = '';
      ge('tLng').value = '';
      ge('tUrg').value = '';
      _gpsAddress = ''; // BUG-007: reset GPS address to prevent stale data on next submission
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
      // Reset image picker UI
      var pw = ge('cImgPreviewWrap'); var pb = ge('cImgPickerBtns');
      if (pw) pw.style.display = 'none';
      if (pb) pb.style.display = 'grid';
      var pi = ge('cImgPreviewImg'); if (pi) pi.src = '';
      // Reset wizard to step 1
      _curStep = 1;
      document.querySelectorAll('.wiz-step').forEach(function(s){ s.classList.remove('active','enter-right','enter-left','enter-bottom','enter-top','exit-left','exit-right','exit-top'); });
      var wiz1 = ge('wiz1');
      if (wiz1) { wiz1.classList.add('active'); var h2 = wiz1.querySelector('h2'); if (h2) h2.textContent = 'ประเภทปัญหา'; }
      wizUpdateProgress(1);
      // Re-enable submit button for next submission
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📨 ส่งเรื่องร้องเรียน'; }
      // ── Scroll กลับขึ้นไปที่ยอด wizard ────────────────
      var prog = ge('stepProgress');
      if (prog) prog.scrollIntoView({ behavior: 'smooth', block: 'start' });
      loadTickets();
    });

  } catch (e) {
    // Re-enable button on network error
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📨 ส่งเรื่องร้องเรียน'; }
    showToast('เกิดข้อผิดพลาด', true);
  }
}

/* ── Image Preview (before upload) ──────────────────── */
function prevCitizenImg(e) {
  var f = e.target.files[0];
  if (!f) return;

  // Sync to the main #cImg input so FormData works as before
  try {
    var dt = new DataTransfer();
    dt.items.add(f);
    ge('cImg').files = dt.files;
  } catch (ex) { /* Safari fallback — FormData will use _citizenImgDataUrl */ }

  var r = new FileReader();
  r.onload = function (ev) {
    _citizenImgDataUrl = ev.target.result;
    // Show preview image, hide picker buttons
    var pi = ge('cImgPreviewImg');
    var pw = ge('cImgPreviewWrap');
    var pb = ge('cImgPickerBtns');
    if (pi) pi.src = ev.target.result;
    if (pw) pw.style.display = 'block';
    if (pb) pb.style.display = 'none';
  };
  r.readAsDataURL(f);
}

/* ── Clear selected image ───────────────────────────── */
function clearCitizenImg() {
  ge('cImg').value = '';
  ge('cImgGallery').value = '';
  _citizenImgDataUrl = '';
  var pi = ge('cImgPreviewImg');
  var pw = ge('cImgPreviewWrap');
  var pb = ge('cImgPickerBtns');
  if (pi) pi.src = '';
  if (pw) pw.style.display = 'none';
  if (pb) pb.style.display = 'grid';
}

/* ══════════════════════════════════════════
   IN-APP CAMERA (getUserMedia — Android/iOS/Desktop)
══════════════════════════════════════════ */
var _camStream = null;
var _camFacing = 'environment'; // 'environment' = rear, 'user' = front

async function openCameraCapture() {
  var modal = ge('mCamera');
  var video = ge('camVideo');
  var errBox = ge('camError');
  if (!modal || !video) return;

  // Reset error
  errBox.style.display = 'none';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Stop any existing stream
  _stopCamStream();

  try {
    // FIX-4.1: ใช้ aspectRatio แทน fixed 1920x1080
    // เหตุผล: fixed landscape resolution บนมือถือ portrait ทำให้ sensor
    //         ส่ง resolution ที่ผิด → canvas ยืดภาพเมื่อวาด videoWidth/Height
    // aspectRatio 4:3 เข้ากันได้กับ sensor ทั้ง landscape และ portrait
    _camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _camFacing, aspectRatio: { ideal: 4/3 } },
      audio: false
    });
    video.srcObject = _camStream;
  } catch (err) {
    var msg = 'ไม่สามารถเปิดกล้องได้';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = 'ปกุดอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ท่านก่อน';
    } else if (err.name === 'NotFoundError') {
      msg = 'ไม่พบกล้องในอุปกรณ์';
    } else if (err.name === 'NotReadableError') {
      msg = 'กล้องถูกแอปอื่นใช้งานอยู่ กรุณาปิดแอปอื่นแล้วลองใหม่';
    }
    errBox.innerHTML = '⚠️ ' + msg + '<br><small style="opacity:.7">' + err.name + '</small><br><br>' +
      '<button onclick="closeCameraCapture()" style="background:#fff;color:#000;border:none;border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer;font-weight:700">ปิด</button>';
    errBox.style.display = 'block';
  }
}

function closeCameraCapture() {
  _stopCamStream();
  var modal = ge('mCamera');
  var video = ge('camVideo');
  if (modal) modal.style.display = 'none';
  if (video) video.srcObject = null;
  document.body.style.overflow = '';
}

function _stopCamStream() {
  if (_camStream) {
    _camStream.getTracks().forEach(function(t) { t.stop(); });
    _camStream = null;
  }
}

async function switchCamera() {
  _camFacing = _camFacing === 'environment' ? 'user' : 'environment';
  _stopCamStream();
  var video = ge('camVideo');
  var errBox = ge('camError');
  try {
    // FIX-4.1: ใช้ aspectRatio เหมือน openCameraCapture (ป้องกัน portrait stretch)
    _camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _camFacing, aspectRatio: { ideal: 4/3 } },
      audio: false
    });
    video.srcObject = _camStream;
    errBox.style.display = 'none';
  } catch (err) {
    // Switch back if failed
    _camFacing = _camFacing === 'environment' ? 'user' : 'environment';
    showToast('ไม่สามารถสลับกล้องได้', true);
  }
}

function takeCameraPhoto() {
  var video = ge('camVideo');
  var canvas = ge('camCanvas');
  if (!video || !canvas || !_camStream) return;

  // Draw current video frame to canvas
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  var ctx = canvas.getContext('2d');
  // Mirror front camera
  if (_camFacing === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Flash effect
  var flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9999;opacity:.8;pointer-events:none;transition:opacity .3s';
  document.body.appendChild(flash);
  setTimeout(function() { flash.style.opacity = '0'; setTimeout(function() { flash.remove(); }, 300); }, 50);

  // Convert canvas to Blob then to File
  canvas.toBlob(function(blob) {
    var file = new File([blob], 'camera_' + Date.now() + '.jpg', { type: 'image/jpeg' });

    // Sync to main cImg input
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      ge('cImg').files = dt.files;
    } catch(ex) { /* fallback */ }

    // Show preview
    var url = URL.createObjectURL(blob);
    _citizenImgDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    var pi = ge('cImgPreviewImg');
    var pw = ge('cImgPreviewWrap');
    var pb = ge('cImgPickerBtns');
    if (pi) pi.src = url;
    if (pw) pw.style.display = 'block';
    if (pb) pb.style.display = 'none';

    // Close camera
    closeCameraCapture();
    showToast('ถ่ายรูปสำเร็จ! ✅');
  }, 'image/jpeg', 0.85);
}

/* ── Render My Tickets ───────────────────────────────── */
var _cgAllTickets = []; // master list for filter

function renderCitizen(data) {
  _cgAllTickets = data;

  // Store ticket lookup for expand panel
  window._cgTickets = {};
  data.forEach(function(t){ window._cgTickets[t.ticketId] = t; });

  // Keep current filter selection if any
  var sel = ge('cgStatusFilter');
  var filter = sel ? sel.value : 'all';
  _cgRenderGrid(filter);
}

/* ── Filter handler ── */
function cgApplyFilter() {
  var sel = ge('cgStatusFilter');
  var filter = sel ? sel.value : 'all';
  // Close any open panel first
  if (_cgOpen) { _cgClose(_cgOpen); _cgOpen = null; }
  _cgRenderGrid(filter);
}

/* ── Draw the grid with optional status filter ── */
function _cgRenderGrid(filter) {
  var el = ge('citizenCards');
  if (!el) return;

  var data = filter === 'all'
    ? _cgAllTickets
    : _cgAllTickets.filter(function(t){ return t.status === filter; });

  if (!data.length) {
    var labelMap = { pending:'รอดำเนินการ', assigned:'รับงานแล้ว', in_progress:'กำลังดำเนินการ', completed:'เสร็จสิ้น', rejected:'ปฏิเสธ' };
    var msg = filter === 'all' ? 'ยังไม่มีเรื่องร้องเรียน' : 'ไม่มีเรื่องร้องเรียนในสถานะ "' + (labelMap[filter] || filter) + '"';
    el.innerHTML = '<div class="empty">' + msg + '</div>';
    return;
  }

  var h = '<div class="citizen-grid">';
  for (var i = 0; i < data.length; i++) {
    var t = data[i];
    var done = t.status === 'completed';

    // Thumbnail
    var thumbHtml = t.citizenImage
      ? '<img src="' + t.citizenImage + '" class="cg-thumb" />'
      : '<div class="cg-thumb cg-thumb-placeholder">' + (DEPT_ICON[t.category] || '📋') + '</div>';

    h += '<div class="cg-card' + (done ? ' cg-card--done' : '') + '" id="cgcard-' + t.ticketId + '" onclick="cgToggle(\'' + t.ticketId + '\')">';
    h += '<div class="cg-left">' + thumbHtml + '</div>';
    h += '<div class="cg-right">';
    h += '<div class="cg-row1">';
    h += '<span class="cg-tid">' + (DEPT_ICON[t.category] || '') + ' ' + escapeHTML(t.ticketId) + '</span>';
    h += '<span class="badge ' + t.status + ' cg-badge">' + stTH(t.status) + '</span>';
    h += '</div>';
    h += '<div class="cg-desc">' + escapeHTML(t.description) + '</div>';
    h += '<div class="cg-date">' + t.createdAt + '</div>';
    h += '</div></div>'; // /cg-right /cg-card

    // Collapsed detail panel — hidden until card is tapped
    h += '<div class="cg-detail" id="cgdetail-' + t.ticketId + '" style="display:none"></div>';
  }
  h += '</div>';
  el.innerHTML = h;
}

/* ── Toggle expand/collapse a ticket detail ── */
var _cgOpen = null;
function cgToggle(ticketId) {
  // If clicking the same card — close it
  if (_cgOpen === ticketId) {
    _cgClose(ticketId);
    _cgOpen = null;
    return;
  }
  // Close previous
  if (_cgOpen) _cgClose(_cgOpen);
  _cgOpen = ticketId;
  _cgOpen = ticketId;
  var t = (window._cgTickets || {})[ticketId];
  if (!t) return;
  var panel = ge('cgdetail-' + ticketId);
  if (!panel) return;

  var done = t.status === 'completed';
  var h = '<div class="cg-detail-inner">';

  // Citizen image (clickable full view)
  if (t.citizenImage) {
    h += '<img src="' + t.citizenImage + '" onclick="viewImg(this.src,\'รูปที่แจ้ง\')" class="cg-detail-img" />';
  }

  // Description + location
  h += '<div class="cg-detail-row"><span class="cg-dl">📝 รายละเอียด</span><span class="cg-dv">' + escapeHTML(t.description) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">📅 วันที่</span><span class="cg-dv">' + t.createdAt + '</span></div>';

  // Tech work images
  if (done && (t.beforeImage || t.afterImage)) {
    h += '<div class="cg-techwork"><div class="cg-techwork-title">&#9989; ช่างดำเนินการเสร็จแล้ว</div><div class="cg-techwork-imgs">';
    if (t.beforeImage) h += '<div class="cg-techwork-img"><img src="' + t.beforeImage + '" onclick="viewImg(this.src,\'ก่อน\')" /><span>ก่อน</span></div>';
    if (t.afterImage)  h += '<div class="cg-techwork-img"><img src="' + t.afterImage  + '" onclick="viewImg(this.src,\'หลัง\')" /><span>หลัง</span></div>';
    h += '</div></div>';
  } else if (!done && t.status !== 'pending' && t.status !== 'rejected' && t.beforeImage) {
    h += '<div class="cg-inprog"><div class="cg-inprog-title">&#128295; ช่างกำลังดำเนินการ</div>';
    h += '<img src="' + t.beforeImage + '" onclick="viewImg(this.src,\'รูปปัญหา\')" class="cg-inprog-img"/></div>';
  }

  // Chat button
  if (t.status !== 'rejected') {
    h += '<button class="btn-chat cg-chat-btn" onclick="event.stopPropagation();openTicketChat(\'' + t.ticketId + '\')"><span>💬</span> แชทกับช่าง</button>';
  }

  // Rating
  if (done) {
    if (t.rating) {
      var starsHtml = '';
      for (var s = 0; s < t.rating; s++) starsHtml += '⭐';
      for (var s2 = t.rating; s2 < 5; s2++) starsHtml += '<span style="color:#d1d5db">☆</span>';
      h += '<div class="cg-rating-done"><span class="cg-rating-label">คะแนน:</span><span class="cg-stars">' + starsHtml + '</span>';
      if (t.ratingReason) h += '<span class="cg-rating-reason">— ' + escapeHTML(t.ratingReason) + '</span>';
      h += '</div>';
    } else {
      h += '<button onclick="event.stopPropagation();openRatingModal(\'' + t.ticketId + '\',\'' + escapeHTML(t.citizenName) + '\')" class="cg-rating-btn">⭐ ประเมินความพึงพอใจ</button>';
    }
  }

  h += '</div>'; // /cg-detail-inner

  panel.innerHTML = h;
  panel.style.display = 'block';
  // Highlight active card
  var card = ge('cgcard-' + ticketId);
  if (card) card.classList.add('cg-card--active');
  // Smooth scroll to panel
  setTimeout(function(){ panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
}

function _cgClose(ticketId) {
  var panel = ge('cgdetail-' + ticketId);
  if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
  var card = ge('cgcard-' + ticketId);
  if (card) card.classList.remove('cg-card--active');
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