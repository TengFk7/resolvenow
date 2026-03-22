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

/* ── Tab Switching ───────────────────────────────────────── */
function switchTab(t) {
  hideE('authErr');
  ge('fLogin').style.display = t === 'login' ? 'block' : 'none';
  ge('fReg').style.display = (t === 'reg') ? 'block' : 'none';
  ge('fOtp').style.display = 'none';
  ge('tabLogin').className = 'tab' + (t === 'login' ? ' on' : '');
  ge('tabReg').className = 'tab' + (t === 'reg' ? ' on' : '');
}

/* ── Back to Register Form ───────────────────────────────── */
function backToRegForm() {
  _stopOtpTimer();
  _otpToken = null;
  _otpLocked = false;
  ge('fOtp').style.display = 'none';
  ge('fReg').style.display = 'block';
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
  ge('adminApp').classList.remove('on');
  ge('normalApp').classList.remove('on');
  ge('authPage').style.display = 'flex';
  switchTab('login');
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
