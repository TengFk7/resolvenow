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

/* ── Tab Switching — 3D Flip Animation ───────────────────── */
var _currentTab = 'login';
var _switching  = false;

function switchTab(t) {
  if (t === _currentTab || _switching) return;
  _switching = true;
  hideE('authErr');

  var fromEl = (t === 'reg') ? ge('fLogin') : ge('fReg');
  var toEl   = (t === 'reg') ? ge('fReg')   : ge('fLogin');
  var wrapper = ge('authFlipWrapper');

  ge('tabLogin').className = 'tab' + (t === 'login' ? ' on' : '');
  ge('tabReg').className   = 'tab' + (t === 'reg'   ? ' on' : '');

  var outClass = (t === 'reg') ? 'lift-out' : 'sink-out';
  var inClass  = (t === 'reg') ? 'lift-in'  : 'sink-in';

  // ① Measure BOTH heights before touching the DOM
  var fromH = fromEl.offsetHeight;

  // Temporarily render toEl off-screen to measure its height
  toEl.style.position   = 'absolute';
  toEl.style.visibility = 'hidden';
  toEl.style.display    = 'block';
  var toH = toEl.offsetHeight;
  toEl.style.display    = 'none';
  toEl.style.visibility = '';
  toEl.style.position   = '';

  // ② Lock wrapper at current height
  wrapper.style.height = fromH + 'px';

  // ③ Pull fromEl out of flow so wrapper height change never yanks it
  fromEl.style.position = 'absolute';
  fromEl.style.top      = '0';
  fromEl.style.left     = '0';
  fromEl.style.width    = '100%';

  // ④ Start exit animation
  fromEl.classList.remove('lift-out','lift-in','sink-out','sink-in');
  fromEl.classList.add(outClass);

  // ⑤ Smoothly resize wrapper to destination height (double rAF = after paint)
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      wrapper.style.height = toH + 'px';
    });
  });

  // ⑥ After exit finishes: swap panels and animate in
  setTimeout(function() {
    fromEl.style.display    = 'none';
    fromEl.style.position   = '';
    fromEl.style.top        = '';
    fromEl.style.left       = '';
    fromEl.style.width      = '';
    fromEl.classList.remove(outClass);

    toEl.style.display = 'block';
    toEl.classList.remove('lift-out','lift-in','sink-out','sink-in');
    toEl.classList.add(inClass);

    // ⑦ Release after enter animation completes
    setTimeout(function() {
      toEl.classList.remove(inClass);
      wrapper.style.height = '';
      _switching = false;
    }, 500);
  }, 330);

  _currentTab = t;
  ge('fOtp').style.display = 'none';
}



/* ── Back to Register Form ───────────────────────────────── */
function backToRegForm() {
  _stopOtpTimer();
  _otpToken = null;
  _otpLocked = false;
  ge('fOtp').style.display = 'none';
  ge('fReg').style.display = 'block';
  ge('fLogin').style.display = 'none';
  _currentTab = 'reg';
  _switching  = false;
  hideE('authErr');
}


/* ── Step 1: Validate + Send OTP ────────────────────────── */
async function doRegister() {
  hideE('authErr');
  var body = {
    firstName: ge('rFirst').value.trim(),
    lastName: ge('rLast').value.trim(),
    email: ge('rEmail').value.trim(),
    password: ge('rPass').value
  };
  if (!body.firstName || !body.lastName || !body.email || !body.password)
    return showE('authErr', 'กรุณากรอกข้อมูลให้ครบ');

  var btn = ge('btnSendOtp');
  btn.disabled = true;
  btn.textContent = 'กำลังส่ง OTP...';

  try {
    var res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) {
      btn.disabled = false;
      btn.innerHTML = '&#128231; ส่ง OTP ยืนยันอีเมล';
      return showE('authErr', data.error || 'เกิดข้อผิดพลาด');
    }
    _otpToken = data.token;
    _otpLocked = false;
    _showOtpStep(body.email);
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '&#128231; ส่ง OTP ยืนยันอีเมล';
    showE('authErr', 'ไม่สามารถเชื่อมต่อได้');
  }
}

/* ── Show OTP Step ───────────────────────────────────────── */
function _showOtpStep(email) {
  ge('fReg').style.display = 'none';
  ge('fOtp').style.display = 'block';
  ge('otpInfo').textContent = '📧 ส่ง OTP ไปที่ ' + email + ' แล้ว';
  ge('otpAttempts').textContent = '';
  ge('btnVerify').disabled = false;

  // Clear boxes
  for (var i = 0; i < 6; i++) {
    var box = ge('otp' + i);
    box.value = '';
    box.className = 'otp-box';
  }
  ge('otp0').focus();
  _setupOtpInputs();
  _startOtpTimer(300); // 5 นาที
}

/* ── OTP Input Auto-focus ────────────────────────────────── */
function _setupOtpInputs() {
  for (var i = 0; i < 6; i++) {
    (function (idx) {
      var box = ge('otp' + idx);
      box.oninput = function () {
        var val = box.value.replace(/\D/g, '');
        box.value = val.slice(-1);
        box.className = 'otp-box' + (box.value ? ' filled' : '');
        if (box.value && idx < 5) ge('otp' + (idx + 1)).focus();
        if (idx === 5 && box.value) doVerifyOtp();
      };
      box.onkeydown = function (e) {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          ge('otp' + (idx - 1)).focus();
        }
      };
    })(i);
  }
}

/* ── Get OTP value ───────────────────────────────────────── */
function _getOtpValue() {
  var code = '';
  for (var i = 0; i < 6; i++) code += (ge('otp' + i).value || '');
  return code;
}

/* ── Step 2: Verify OTP + Register ──────────────────────── */
async function doVerifyOtp() {
  if (_otpLocked) return;
  var otp = _getOtpValue();
  if (otp.length < 6) return showToast('กรุณากรอก OTP ให้ครบ 6 หลัก', true);

  ge('btnVerify').disabled = true;
  ge('btnVerify').textContent = 'กำลังตรวจสอบ...';

  try {
    var res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: _otpToken, otp: otp })
    });
    var data = await res.json();

    if (!res.ok) {
      ge('btnVerify').disabled = false;
      ge('btnVerify').innerHTML = '&#9989; ยืนยัน OTP';

      // Shake animation
      for (var i = 0; i < 6; i++) {
        var box = ge('otp' + i);
        box.className = 'otp-box error shake';
        (function (b) { setTimeout(function () { b.classList.remove('shake'); }, 450); })(box);
      }

      if (data.locked || data.expired) {
        _otpLocked = true;
        _stopOtpTimer();
        ge('otpAttempts').textContent = data.error;
        ge('btnVerify').disabled = true;
        ge('otpTimerWrap').style.display = 'none';
        ge('btnResend').style.display = 'inline-block';
      } else {
        ge('otpAttempts').textContent = data.error || 'OTP ไม่ถูกต้อง';
        // Clear boxes for re-entry
        for (var j = 0; j < 6; j++) {
          ge('otp' + j).value = '';
          ge('otp' + j).className = 'otp-box error';
        }
        ge('otp0').focus();
      }
      return;
    }

    // สำเร็จ
    _stopOtpTimer();
    CU = data.user;
    enterApp();
  } catch (e) {
    ge('btnVerify').disabled = false;
    ge('btnVerify').innerHTML = '&#9989; ยืนยัน OTP';
    showToast('ไม่สามารถเชื่อมต่อได้', true);
  }
}

/* ── Resend OTP ──────────────────────────────────────────── */
async function doResendOtp() {
  _otpLocked = false;
  ge('btnVerify').disabled = false;
  ge('btnVerify').innerHTML = '&#9989; ยืนยัน OTP';
  ge('btnResend').style.display = 'none';
  ge('otpTimerWrap').style.display = 'inline';
  ge('otpAttempts').textContent = '';

  var body = {
    firstName: ge('rFirst').value.trim(),
    lastName: ge('rLast').value.trim(),
    email: ge('rEmail').value.trim(),
    password: ge('rPass').value
  };

  try {
    var res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) return showToast(data.error || 'ส่ง OTP ไม่สำเร็จ', true);
    _otpToken = data.token;

    for (var i = 0; i < 6; i++) {
      ge('otp' + i).value = '';
      ge('otp' + i).className = 'otp-box';
    }
    ge('otp0').focus();
    _startOtpTimer(300);
    showToast('📧 ส่ง OTP ใหม่แล้ว!');
  } catch (e) {
    showToast('ไม่สามารถเชื่อมต่อได้', true);
  }
}

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
    enterApp();
  } catch (e) { showE('authErr', 'ไม่สามารถเชื่อมต่อ'); }
}

/* ── Logout ──────────────────────────────────────────────── */
async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  CU = null;
  _stopOtpTimer();

  // Determine visible app
  var adminEl  = ge('adminApp');
  var normalEl = ge('normalApp');
  var activeEl = (adminEl && adminEl.style.display !== 'none' && adminEl.offsetParent !== null) ? adminEl : normalEl;

  // 3D exit animation on active container
  if (activeEl) {
    activeEl.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1), opacity .45s ease';
    activeEl.style.transformOrigin = 'center center';
    activeEl.style.transform = 'scale(.88) rotateX(6deg) translateY(-30px)';
    activeEl.style.opacity = '0';
  }

  setTimeout(function() {
    // Reset transform so next login is clean
    if (activeEl) {
      activeEl.style.transition = '';
      activeEl.style.transform = '';
      activeEl.style.opacity = '';
    }
    if (adminEl)  adminEl.style.display  = 'none';
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
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          ap.style.transform = '';
          ap.style.opacity = '1';
          setTimeout(function(){ ap.style.transition = ''; }, 650);
        });
      });
    }
    // Reset flip state so switchTab always runs cleanly
    _currentTab = 'reg';
    _switching  = false;
    // Show fReg as hidden baseline so fLogin can animate in
    ge('fLogin').style.display = 'none';
    ge('fReg').style.display   = 'block';
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
