/* ─────────────────────────────────────────────
   public/js/auth.js — Authentication Logic
   • Tab switching
   • Register / Login / Logout
   • Change Password
   ───────────────────────────────────────────── */

/* ── Tab Switching ───────────────────────────────────── */
function switchTab(t) {
  hideE('authErr');
  ge('fLogin').style.display = t === 'login' ? 'block' : 'none';
  ge('fReg').style.display = t === 'reg' ? 'block' : 'none';
  ge('tabLogin').className = 'tab' + (t === 'login' ? ' on' : '');
  ge('tabReg').className = 'tab' + (t === 'reg' ? ' on' : '');
}

/* ── Register ────────────────────────────────────────── */
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
  try {
    var res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var data = await res.json();
    if (!res.ok) return showE('authErr', data.error || 'เกิดข้อผิดพลาด');
    CU = data.user;
    enterApp();
  } catch (e) { showE('authErr', 'ไม่สามารถเชื่อมต่อ'); }
}

/* ── Login ───────────────────────────────────────────── */
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

/* ── Logout ──────────────────────────────────────────── */
async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  CU = null;
  ge('adminApp').classList.remove('on');
  ge('normalApp').classList.remove('on');
  ge('authPage').style.display = 'flex';
  switchTab('login');
}

/* ── Change Password ─────────────────────────────────── */
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
