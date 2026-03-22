/* ─────────────────────────────────────────────
   public/js/ui.js — Shared UI Helpers
   • DOM shortcuts
   • Toast / Error display
   • Status label helpers
   • Image modal
   • Change-password modal
   • Shared constants (DEPT, DEPT_ICON)
   ───────────────────────────────────────────── */

/* ── Display Constants ───────────────────────────────── */
var DEPT = {
  Road: 'ถนน/ทางเท้า', Water: 'ท่อแตก/น้ำ', Electricity: 'ไฟฟ้า',
  Garbage: 'ขยะ', Animal: 'สัตว์', Tree: 'กิ่งไม้', Hazard: 'ภัยพิบัติ'
};
var DEPT_ICON = {
  Road: '&#128763;', Water: '&#128167;', Electricity: '&#128161;',
  Garbage: '&#128465;', Animal: '&#128054;', Tree: '&#127807;', Hazard: '&#128680;'
};

/* ── DOM Helper ──────────────────────────────────────── */
function ge(id) { return document.getElementById(id); }

/* ── Toast Notification ──────────────────────────────── */
function showToast(msg, isErr) {
  var t = ge('toast');
  t.textContent = msg;
  t.className = 'toast on' + (isErr ? ' err' : '');
  setTimeout(function () { t.className = 'toast'; }, 3000);
}

/* ── Inline Error Box ────────────────────────────────── */
function showE(id, msg) { ge(id).textContent = msg; ge(id).classList.add('on'); }
function hideE(id) { ge(id).classList.remove('on'); }

/* ── Status Label (Thai) ─────────────────────────────── */
function stTH(s) {
  var m = {
    pending: 'รอดำเนินการ', assigned: 'รับงานแล้ว',
    in_progress: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', rejected: 'ปฏิเสธ'
  };
  return m[s] || s;
}

/* ── Priority Badge HTML ─────────────────────────────── */
function pLabel(s) {
  if (s >= 70) return '<span style="font-weight:700;font-size:11px;color:var(--r)">&#128308; ' + s + '</span>';
  if (s >= 40) return '<span style="font-weight:700;font-size:11px;color:var(--w)">&#128992; ' + s + '</span>';
  return '<span style="font-weight:700;font-size:11px;color:var(--g)">&#128994; ' + s + '</span>';
}

/* ── Image Preview Modal ─────────────────────────────── */
function viewImg(src, title) {
  ge('mImgSrc').src = src;
  ge('mImgTitle').textContent = title;
  ge('mImg').classList.add('on');
}
function closeMImg() { ge('mImg').classList.remove('on'); }

/* ── Change Password Modal ───────────────────────────── */
function openChPw() {
  hideE('chErr');
  ['curP', 'newP', 'conP'].forEach(function (i) { ge(i).value = ''; });
  ge('mChPw').classList.add('on');
}
function closeChPw() { ge('mChPw').classList.remove('on'); }
