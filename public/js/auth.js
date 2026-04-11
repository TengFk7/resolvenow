/* ─────────────────────────────────────────────
   public/js/auth.js — Authentication Logic
   • Tab switching
   • Register → Send OTP → Verify OTP
   • Login / Logout / Change Password
   ───────────────────────────────────────────── */

/* ── Internal OTP State ──────────────────────────────────── */
var _otpToken = null;      // token จากเซิร์ฟเวอร์
var _otpTimerInterval = null;
var _otpLocked = false;    // ล็อคหลังผิด 3 ครั้ง

/* ── Tab Switching — 3D Flip Animation ───────────── */
var _currentTab = 'login';
var _switching = false;

// panel id map
var _panelId = { login: 'fLogin', heatmap: 'fHeatmap' };
var _tabId = { login: 'tabLogin', heatmap: 'tabHeatmap' };

function switchTab(t) {
  if (t === _currentTab || _switching) return;
  _switching = true;
  hideE('authErr');

  var fromEl = ge(_panelId[_currentTab]);
  var toEl = ge(_panelId[t]);
  var wrapper = ge('authFlipWrapper');

  // Update tab active state
  Object.keys(_tabId).forEach(function (k) {
    var tabEl = ge(_tabId[k]);
    if (tabEl) tabEl.className = 'tab' + (k === t ? ' on' : '');
  });

  // Ensure all other panels are completely hidden to prevent leaks (BUG-015)
  Object.keys(_panelId).forEach(function (k) {
    if (k !== _currentTab && k !== t) {
      var el = ge(_panelId[k]);
      if (el) {
        el.style.display = 'none';
        el.classList.remove('lift-out', 'lift-in', 'sink-out', 'sink-in');
      }
    }
  });

  var outClass, inClass;
  // Determine direction based on tab order: login < heatmap
  var tabOrder = { login: 0, heatmap: 1 };
  if (tabOrder[t] > tabOrder[_currentTab]) {
    outClass = 'lift-out'; inClass = 'lift-in';
  } else {
    outClass = 'sink-out'; inClass = 'sink-in';
  }

  // ① Measure BOTH heights before touching the DOM
  var fromH = fromEl.offsetHeight;

  // Temporarily render toEl off-screen to measure its height
  toEl.style.position = 'absolute';
  toEl.style.visibility = 'hidden';
  toEl.style.display = 'block';
  var toH = toEl.offsetHeight;
  toEl.style.display = 'none';
  toEl.style.visibility = '';
  toEl.style.position = '';

  // ② Lock wrapper at current height
  wrapper.style.height = fromH + 'px';

  // ③ Pull fromEl out of flow so wrapper height change never yanks it
  fromEl.style.position = 'absolute';
  fromEl.style.top = '0';
  fromEl.style.left = '0';
  fromEl.style.width = '100%';

  // ④ Start exit animation
  fromEl.classList.remove('lift-out', 'lift-in', 'sink-out', 'sink-in');
  fromEl.classList.add(outClass);

  // ⑤ Smoothly resize wrapper to destination height
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      wrapper.style.height = toH + 'px';
    });
  });

  // ⑥ After exit finishes: swap panels
  setTimeout(function () {
    fromEl.style.display = 'none';
    fromEl.style.position = '';
    fromEl.style.top = '';
    fromEl.style.left = '';
    fromEl.style.width = '';
    fromEl.classList.remove(outClass);

    toEl.style.display = 'block';
    toEl.classList.remove('lift-out', 'lift-in', 'sink-out', 'sink-in');
    toEl.classList.add(inClass);

    // ⑦ Release after enter animation completes
    setTimeout(function () {
      toEl.classList.remove(inClass);
      wrapper.style.height = '';
      _switching = false;
      // auto-focus search input
      if (t === 'search') {
        var sq = ge('srchQ');
        if (sq) sq.focus();
      }
      if (t === 'heatmap') {
        loadHeatmap();
      }
    }, 500);
  }, 330);

  _currentTab = t;
}



/* ── LINE OTP Input Auto-focus ──────────────────────────── */
(function() {
  // Setup LINE OTP boxes on page load
  setTimeout(function() {
    for (var i = 0; i < 6; i++) {
      (function (idx) {
        var box = ge('llOtp' + idx);
        if (!box) return;
        box.oninput = function () {
          var val = box.value.replace(/\D/g, '');
          box.value = val.slice(-1);
          box.className = 'otp-box' + (box.value ? ' filled' : '');
          if (box.value && idx < 5) ge('llOtp' + (idx + 1)).focus();
          if (idx === 5 && box.value) doLineLinkVerifyOtp();
        };
        box.onkeydown = function (e) {
          if (e.key === 'Backspace' && !box.value && idx > 0) {
            ge('llOtp' + (idx - 1)).focus();
          }
        };
      })(i);
    }
  }, 500);
})();

/* ── OTP Countdown Timer ─────────────────────────────────── */
function _startOtpTimer(seconds) {
  _stopOtpTimer();
  ge('otpTimerWrap').style.display = 'inline';
  ge('btnResend').style.display = 'none';

  var remaining = seconds;
  _updateTimerDisplay(remaining);

  _otpTimerInterval = setInterval(function () {
    remaining -= 1;
    _updateTimerDisplay(remaining);
    if (remaining <= 0) {
      _stopOtpTimer();
      ge('otpTimerWrap').style.display = 'none';
      ge('btnResend').style.display = 'inline-block';
      ge('otpAttempts').textContent = 'OTP หมดอายุแล้ว กรุณาส่งใหม่';
      _otpLocked = true;
      ge('btnVerify').disabled = true;
    }
  }, 1000);
}

function _stopOtpTimer() {
  if (_otpTimerInterval) { clearInterval(_otpTimerInterval); _otpTimerInterval = null; }
}

function _updateTimerDisplay(sec) {
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  ge('otpTimer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
}

/* ── Login ───────────────────────────────────────────────── */
async function doLogin() {
  hideE('authErr');
  var email = ge('lEmail').value.trim(), pass = ge('lPass').value;
  if (!email || !pass) return showE('authErr', 'กรุณากรอกข้อมูลให้ครบ');
  try {
    var res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: pass, remember: ge('rem').checked }) });
    var data = await res.json();
    if (!res.ok) return showE('authErr', data.error || 'เกิดข้อผิดพลาด');
    CU = data.user;
    sessionStorage.setItem('rn_logged_in', '1'); // mark: ยังอยู่ใน session
    enterApp();
  } catch (e) { showE('authErr', 'ไม่สามารถเชื่อมต่อ'); }
}

/* ── Logout ──────────────────────────────────────────────── */
async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  sessionStorage.removeItem('rn_logged_in'); // ล้าง flag → เปิดใหม่จะไปหน้า login
  CU = null;
  _stopOtpTimer();

  // BUG-001: clear all polling intervals so they don't accumulate on re-login
  if (typeof clearAppIntervals === 'function') clearAppIntervals();

  // Close any open slide drawer globally
  if (typeof closeDrawer === 'function') closeDrawer();

  // Determine visible app
  var adminEl = ge('adminApp');
  var normalEl = ge('normalApp');
  var activeEl = (adminEl && adminEl.style.display !== 'none' && adminEl.offsetParent !== null) ? adminEl : normalEl;

  // 3D exit animation on active container
  if (activeEl) {
    activeEl.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1), opacity .45s ease';
    activeEl.style.transformOrigin = 'center center';
    activeEl.style.transform = 'scale(.88) rotateX(6deg) translateY(-30px)';
    activeEl.style.opacity = '0';
  }

  setTimeout(function () {
    // Reset transform so next login is clean
    if (activeEl) {
      activeEl.style.transition = '';
      activeEl.style.transform = '';
      activeEl.style.opacity = '';
    }
    if (adminEl) adminEl.style.display = 'none';
    if (normalEl) normalEl.style.display = 'none';

    // Restore body scroll for auth page
    document.body.style.overflow = '';

    // Show auth page with 3D enter animation
    var ap = ge('authPage');
    if (ap) {
      ap.style.display = 'flex';
      ap.style.transform = 'scale(1.06) rotateX(-4deg)';
      ap.style.opacity = '0';
      ap.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1), opacity .5s ease';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          ap.style.transform = '';
          ap.style.opacity = '1';
          setTimeout(function () { ap.style.transition = ''; }, 650);
        });
      });
    }
    // Reset flip state so switchTab always runs cleanly
    _currentTab = 'login';
    _switching = false;

    // Clear dynamic DOM arrays to prevent state leakage between accounts
    if (ge('citizenCards')) ge('citizenCards').innerHTML = '';
    if (ge('techCards')) ge('techCards').innerHTML = '';
    if (ge('queueBody')) ge('queueBody').innerHTML = '<tr><td colspan="4" class="empty">กำลังโหลด...</td></tr>';
    if (ge('allBody')) ge('allBody').innerHTML = '<tr><td colspan="11" class="empty">กำลังโหลด...</td></tr>';

    // Hide all panels, show only fLogin as baseline
    ge('fLogin').style.display = 'block';
    switchTab('login');
  }, 500);
}


/* ── Change Password ─────────────────────────────────────── */
async function doChPw() {
  hideE('chErr');
  var cur = ge('curP').value, nw = ge('newP').value, con = ge('conP').value;
  if (!cur || !nw || !con) return showE('chErr', 'กรุณากรอกข้อมูลให้ครบ');
  if (nw !== con) return showE('chErr', 'รหัสผ่านใหม่ไม่ตรงกัน');
  try {
    var res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: cur, newPassword: nw }) });
    var data = await res.json();
    if (!res.ok) return showE('chErr', data.error || 'เกิดข้อผิดพลาด');
    closeChPw();
    showToast('เปลี่ยนรหัสผ่านสำเร็จ');
  } catch (e) { showE('chErr', 'เกิดข้อผิดพลาด'); }
}


/* ══════════════════════════════════════════════════════════
   LINE Account Linking Modal
══════════════════════════════════════════════════════════ */

/* ── เปิด modal เชื่อมบัญชี LINE ─────────────────────── */
async function openLineLinkModal() {
  // panel #fLineLink ถูกแสดงโดย app.js — ฟังก์ชันนี้แค่ reset form + โหลด LINE profile
  ['llFirst','llLast','llEmail','llPass','llPass2'].forEach(function(id){
    var el = ge(id); if (el) el.value = '';
  });
  hideE('llErr');
  var btnLink = ge('btnLineLink');
  if (btnLink) { btnLink.disabled = false; btnLink.textContent = '✨ สร้างบัญชีและผูกกับ LINE'; }

  // โหลด LINE profile
  try {
    var r = await fetch('/api/auth/line-pending');
    if (r.ok) {
      var data = await r.json();
      var nameEl = ge('llLineName');
      if (nameEl) nameEl.textContent = data.lineDisplayName || 'LINE User';
      if (data.lineAvatar) {
        var av   = ge('llLineAvatar');
        var avFb = ge('llLineAvatarFallback');
        if (av)   { av.src = data.lineAvatar; av.style.display = 'block'; }
        if (avFb) avFb.style.display = 'none';
      }
    } else {
      var nameEl2 = ge('llLineName');
      if (nameEl2) nameEl2.textContent = 'LINE User';
    }
  } catch (e) {
    var nameEl3 = ge('llLineName');
    if (nameEl3) nameEl3.textContent = 'LINE User';
    console.warn('[LINE Link] โหลด profile ไม่สำเร็จ:', e);
  }
}


/* ── สมัครสมาชิกใหม่ + ผูก LINE (Step 1: ส่ง OTP) ─── */
var _llOtpToken = null;
var _llOtpTimer = null;
var _llFormData = null; // เก็บข้อมูลไว้สำหรับ resend

async function doLineLinkRegister() {
  hideE('llErr');
  var firstName = (ge('llFirst') ? ge('llFirst').value.trim() : '');
  var lastName  = (ge('llLast')  ? ge('llLast').value.trim()  : '');
  var email     = (ge('llEmail') ? ge('llEmail').value.trim() : '');
  var pass      = (ge('llPass')  ? ge('llPass').value         : '');
  var pass2     = (ge('llPass2') ? ge('llPass2').value        : '');

  if (!firstName) return showE('llErr', 'กรุณากรอกชื่อ');
  if (!email)     return showE('llErr', 'กรุณากรอก Email');
  if (!pass)      return showE('llErr', 'กรุณากรอกรหัสผ่าน');
  if (pass.length < 6) return showE('llErr', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  if (pass !== pass2) return showE('llErr', 'รหัสผ่านไม่ตรงกัน กรุณากรอกใหม่');

  var btn = ge('btnLineLink');
  if (btn) { btn.disabled = true; btn.textContent = '📧 กำลังส่ง OTP...'; }

  _llFormData = { firstName: firstName, lastName: lastName, email: email, password: pass };

  try {
    var r = await fetch('/api/auth/register-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_llFormData)
    });
    var data = await r.json();
    if (!r.ok) {
      if (btn) { btn.disabled = false; btn.textContent = '✨ สร้างบัญชีและผูกกับ LINE'; }
      // ถ้า login เลย (LINE user มีบัญชีแล้ว)
      if (data.user) {
        var fLL = ge('fLineLink'); if (fLL) fLL.style.display = 'none';
        CU = data.user;
        sessionStorage.setItem('rn_logged_in', '1');
        showToast('✨ เข้าสู่ระบบสำเร็จ!');
        enterApp();
        return;
      }
      return showE('llErr', data.error || 'เกิดข้อผิดพลาด');
    }

    // ถ้า response มี user = login เลย (LINE user ซ้ำ)
    if (data.user) {
      var fLL2 = ge('fLineLink'); if (fLL2) fLL2.style.display = 'none';
      CU = data.user;
      sessionStorage.setItem('rn_logged_in', '1');
      showToast('✨ เข้าสู่ระบบสำเร็จ!');
      enterApp();
      return;
    }

    // OTP ส่งแล้ว → แสดง OTP panel
    _llOtpToken = data.token;
    ge('fLineLink').style.display = 'none';
    ge('fLineLinkOtp').style.display = 'block';
    ge('llOtpEmail').textContent = email;
    hideE('llOtpErr');
    // Clear OTP boxes
    for (var i = 0; i < 6; i++) { var b = ge('llOtp' + i); if (b) b.value = ''; }
    setTimeout(function() { var b0 = ge('llOtp0'); if (b0) b0.focus(); }, 300);
    startLLOtpTimer();
    showToast('📧 ส่ง OTP ไปที่ ' + email);
  } catch (e) {
    console.error('doLineLinkRegister error:', e);
    if (btn) { btn.disabled = false; btn.textContent = '✨ สร้างบัญชีและผูกกับ LINE'; }
    showE('llErr', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

/* ── LINE OTP: ยืนยัน OTP (Step 2) ──────────────────── */
async function doLineLinkVerifyOtp() {
  hideE('llOtpErr');
  var otp = '';
  for (var i = 0; i < 6; i++) { var b = ge('llOtp' + i); otp += (b ? b.value : ''); }
  if (otp.length < 6) return showE('llOtpErr', 'กรุณากรอก OTP 6 หลัก');

  var btn = ge('btnLineLinkVerify');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังตรวจสอบ...'; }

  try {
    var r = await fetch('/api/auth/verify-line-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: _llOtpToken, otp: otp })
    });
    var data = await r.json();
    if (!r.ok) {
      if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยัน OTP'; }
      return showE('llOtpErr', data.error || 'เกิดข้อผิดพลาด');
    }
    // สำเร็จ!
    if (_llOtpTimer) clearInterval(_llOtpTimer);
    ge('fLineLinkOtp').style.display = 'none';
    CU = data.user;
    sessionStorage.setItem('rn_logged_in', '1');
    showToast('✨ สร้างบัญชีและผูก LINE สำเร็จ!');
    enterApp();
  } catch (e) {
    console.error('doLineLinkVerifyOtp error:', e);
    if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยัน OTP'; }
    showE('llOtpErr', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

/* ── LINE OTP: ส่ง OTP ใหม่ ──────────────────────────── */
async function doLineLinkResendOtp() {
  if (!_llFormData) return;
  var btn = ge('btnLLResend');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...'; }

  try {
    var r = await fetch('/api/auth/register-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_llFormData)
    });
    var data = await r.json();
    if (!r.ok) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 ส่ง OTP ใหม่'; }
      return showE('llOtpErr', data.error || 'ส่ง OTP ไม่สำเร็จ');
    }
    _llOtpToken = data.token;
    for (var i = 0; i < 6; i++) { var b = ge('llOtp' + i); if (b) b.value = ''; }
    hideE('llOtpErr');
    startLLOtpTimer();
    showToast('📧 ส่ง OTP ใหม่แล้ว!');
    setTimeout(function() { var b0 = ge('llOtp0'); if (b0) b0.focus(); }, 200);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 ส่ง OTP ใหม่'; }
    showE('llOtpErr', 'ส่ง OTP ไม่สำเร็จ');
  }
}

/* ── LINE OTP: Timer 5 นาที ──────────────────────────── */
function startLLOtpTimer() {
  if (_llOtpTimer) clearInterval(_llOtpTimer);
  var secs = 300; // 5 minutes
  ge('llOtpTimerWrap').style.display = 'inline';
  ge('btnLLResend').style.display = 'none';
  _llOtpTimer = setInterval(function() {
    secs--;
    var m = Math.floor(secs / 60), s = secs % 60;
    ge('llOtpTimer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
    if (secs <= 0) {
      clearInterval(_llOtpTimer);
      ge('llOtpTimerWrap').style.display = 'none';
      var btn = ge('btnLLResend');
      if (btn) { btn.style.display = 'inline-block'; btn.disabled = false; btn.textContent = '🔄 ส่ง OTP ใหม่'; }
    }
  }, 1000);
}

/* ── LINE OTP: กลับไปแก้ไขข้อมูล ─────────────────────── */
function backToLineLinkForm() {
  if (_llOtpTimer) clearInterval(_llOtpTimer);
  ge('fLineLinkOtp').style.display = 'none';
  ge('fLineLink').style.display = 'block';
  var btn = ge('btnLineLink');
  if (btn) { btn.disabled = false; btn.textContent = '✨ สร้างบัญชีและผูกกับ LINE'; }
}

/* ── ยืนยันเชื่อม LINE กับ email account (สำรอง) ────── */
async function doLineLink() {
  hideE('llErr');
  var email = ge('llEmail') ? ge('llEmail').value.trim() : '';
  var pass = ge('llPass') ? ge('llPass').value : '';
  if (!email || !pass) return showE('llErr', 'กรุณากรอกข้อมูลให้ครบ');

  var btn = ge('btnLineLink');
  btn.disabled = true;
  btn.textContent = 'กำลังเชื่อม...';

  try {
    var res = await fetch('/api/auth/link-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    });
    var data = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = '🔗 เชื่อมบัญชีนี้กับ LINE';
      return showE('llErr', data.error || 'เกิดข้อผิดพลาด');
    }
    // สำเร็จ
    var fLL = ge('fLineLink');
    if (fLL) fLL.style.display = 'none';
    CU = data.user;
    sessionStorage.setItem('rn_logged_in', '1');
    showToast('🔗 เชื่อมบัญชี LINE สำเร็จ!');
    enterApp();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '🔗 เชื่อมบัญชีนี้กับ LINE';
    showE('llErr', 'ไม่สามารถเชื่อมต่อได้');
  }
}

/* ── ข้าม — สร้าง LINE-only account แทน ─────────────── */
async function doLineLinkSkip() {
  var btn = ge('btnLineLink');
  btn.disabled = true;

  try {
    // เรียก endpoint ที่จะสร้าง LINE-only account จาก pending session
    var res = await fetch('/api/auth/link-line-skip', { method: 'POST' });
    var data = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      return showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
    }
    var fLL = ge('fLineLink');
    if (fLL) fLL.style.display = 'none';
    CU = data.user;
    sessionStorage.setItem('rn_logged_in', '1');
    showToast('เข้าสู่ระบบด้วย LINE สำเร็จ');
    enterApp();
  } catch (e) {
    btn.disabled = false;
    showToast('ไม่สามารถเชื่อมต่อได้', 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   Admin Unlink LINE Modal
══════════════════════════════════════════════════════════ */

async function openUnlinkLineModal() {
  hideE('ulErr');
  var btnAll = ge('btnUnlinkAll');
  if (btnAll) { btnAll.disabled = false; btnAll.textContent = '🗑️ ล้างทั้งหมด'; }
  ge('mUnlinkLine').classList.add('on');

  // โหลดรายการ LINE-linked users
  ge('ulList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">⏳ กำลังโหลด...</div>';
  try {
    var r = await fetch('/api/auth/admin-linked-lines');
    var data = await r.json();
    if (!r.ok) { ge('ulList').innerHTML = '<div style="padding:16px;text-align:center;color:var(--r);font-size:13px">⚠️ ' + (data.error || 'โหลดไม่สำเร็จ') + '</div>'; return; }
    _renderUnlinkList(data);
  } catch (e) {
    ge('ulList').innerHTML = '<div style="padding:16px;text-align:center;color:var(--r);font-size:13px">⚠️ ไม่สามารถเชื่อมต่อได้</div>';
  }
}

function _renderUnlinkList(users) {
  if (!users.length) {
    ge('ulList').innerHTML = '<div class="ul-empty" style="padding:24px;text-align:center;color:var(--muted);font-size:13px">✅ ไม่มีบัญชีที่เชื่อม LINE อยู่</div>';
    var btnAll = ge('btnUnlinkAll');
    if (btnAll) btnAll.disabled = true;
    return;
  }
  var h = '';
  users.forEach(function (u, i) {
    var roleTag = u.role === 'admin' ? '🛡️' : u.role === 'technician' ? '🔧' : '👤';
    var avHtml = u.avatar
      ? '<img src="' + escapeHTML(u.avatar) + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(6,199,85,.3)" />'
      : '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#06c755,#00a84c);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">👤</div>';
    // animation-delay สำหรับ stagger
    var delay = (i * 55) + 'ms';
    h += '<div class="ul-row" data-email="' + escapeHTML(u.email) + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);animation-delay:' + delay + '">';
    h += avHtml;
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:13px;font-weight:700;color:var(--navy)">' + roleTag + ' ' + escapeHTML(u.name) + '</div>';
    h += '<div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHTML(u.email) + '</div>';
    if (u.lineDisplayName) h += '<div style="font-size:11px;color:#06c755;font-weight:600">LINE: ' + escapeHTML(u.lineDisplayName) + '</div>';
    h += '</div>';
    h += '<button class="ul-unlink-btn" onclick="doAdminUnlinkLine(\'' + escapeHTML(u.email) + '\')" style="flex-shrink:0;padding:6px 14px;border:1.5px solid #fca5a5;border-radius:8px;background:#fff;color:#dc2626;font-size:12px;font-weight:700;cursor:pointer">ล้าง</button>';
    h += '</div>';
  });
  ge('ulList').innerHTML = h;
}

function closeUnlinkLineModal() {
  ge('mUnlinkLine').classList.remove('on');
}

async function doAdminUnlinkLine(email) {
  hideE('ulErr');
  if (!email) return showE('ulErr', 'กรุณาระบุ Email');

  // ── Animate แถวออกก่อน ──
  var row = ge('ulList').querySelector('[data-email="' + email + '"]');
  if (row) {
    row.classList.add('removing');
    await new Promise(function(resolve) { setTimeout(resolve, 370); });
  }

  try {
    var res = await fetch('/api/auth/admin-unlink-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    var data = await res.json();
    if (!res.ok) {
      if (row) row.classList.remove('removing');
      return showE('ulErr', data.error || 'เกิดข้อผิดพลาด');
    }
    showToast('✅ ' + data.message);
    // รีโหลดรายการ
    var r2 = await fetch('/api/auth/admin-linked-lines');
    var data2 = await r2.json();
    _renderUnlinkList(data2);
  } catch (e) {
    if (row) row.classList.remove('removing');
    showE('ulErr', 'ไม่สามารถเชื่อมต่อได้');
  }
}

async function doAdminUnlinkAll() {
  var btn = ge('btnUnlinkAll');
  btn.disabled = true;
  btn.textContent = 'กำลังล้าง...';
  hideE('ulErr');

  // ── Animate ทุกแถวออก cascade ──
  var rows = ge('ulList').querySelectorAll('.ul-row');
  rows.forEach(function(row, i) {
    setTimeout(function() {
      row.classList.add('cascade-out');
    }, i * 60);
  });
  var totalDelay = (rows.length * 60) + 320;

  await new Promise(function(resolve) { setTimeout(resolve, totalDelay); });

  try {
    var res = await fetch('/api/auth/admin-unlink-all', { method: 'POST' });
    var data = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = '🗑️ ล้างทั้งหมด';
      return showE('ulErr', data.error || 'เกิดข้อผิดพลาด');
    }
    showToast('✅ ' + data.message);
    _renderUnlinkList([]); // แสดง empty state พร้อม animation
    btn.disabled = true;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '🗑️ ล้างทั้งหมด';
    showE('ulErr', 'ไม่สามารถเชื่อมต่อได้');
  }
}



