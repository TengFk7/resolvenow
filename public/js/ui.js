/* ─────────────────────────────────────────────
   public/js/ui.js — Shared UI Helpers (Premium)
   • DOM shortcuts
   • Toast / Error display
   • Page transitions
   • Ripple effect
   • Clock
   • Status / Priority helpers
   • Image modal / Change-password modal
   ───────────────────────────────────────────── */

/* ── Splash Screen ───────────────────────────────────── */
(function initSplash() {
  var splash = document.getElementById('splash');
  var card = document.querySelector('.ac');
  var heroContent = document.querySelector('.auth-hero-content');
  if (!splash) return;

  // Step 1 (1.7s): Start hero content scale-down FIRST — it's hidden under splash
  //   Hero text begins morphing from splash-center position DOWN to its natural size+position
  setTimeout(function() {
    if (heroContent) heroContent.classList.add('hero-enter');
  }, 1700);

  // Step 2 (1.85s): Fade splash out — reveal the hero text already mid-animation
  //   Login card slides in from right simultaneously
  setTimeout(function() {
    splash.classList.add('fade-out');
    if (card) {
      requestAnimationFrame(function() {
        card.classList.add('card-enter');
      });
    }
    // Remove splash from DOM after fade completes
    setTimeout(function() {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 950);
  }, 1850);
})();

var DEPT = {
  Road:'ถนน/ทางเท้า', Water:'ท่อแตก/น้ำ', Electricity:'ไฟฟ้า',
  Garbage:'ขยะ', Animal:'สัตว์', Tree:'กิ่งไม้', Hazard:'ภัยพิบัติ'
};
var DEPT_ICON = {
  Road:'🛣️', Water:'💧', Electricity:'💡',
  Garbage:'🗑️', Animal:'🐍', Tree:'🌿', Hazard:'🚨'
};

/* ── DOM Helper ──────────────────────────────────────── */
function ge(id) { return document.getElementById(id); }

/* ── Ripple Effect ───────────────────────────────────── */
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.btn-ripple');
  if (!btn) return;
  var r = document.createElement('span');
  var rect = btn.getBoundingClientRect();
  var size = Math.max(rect.width, rect.height);
  r.className = 'ripple-circle';
  r.style.cssText = 'width:'+size+'px;height:'+size+'px;left:'+(e.clientX-rect.left-size/2)+'px;top:'+(e.clientY-rect.top-size/2)+'px';
  btn.appendChild(r);
  setTimeout(function(){ r.remove(); }, 700);
});

/* ── Live Clock ──────────────────────────────────────── */
function startClock() {
  var el = ge('topbarClock');
  if (!el) return;
  function tick() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var s = String(now.getSeconds()).padStart(2,'0');
    el.textContent = h+':'+m+':'+s;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Page Transition (admin pages) ──────────────────── */
var _pages = ['pageDashboard','pageQueue','pageTechs'];
var _navIds = { dashboard:'nav-dashboard', queue:'nav-queue', techs:'nav-techs' };

function showPage(name) {
  _pages.forEach(function(pid) {
    var el = ge(pid);
    if (!el) return;
    if (pid === 'page' + name.charAt(0).toUpperCase() + name.slice(1)) {
      el.style.display = 'block';
      el.classList.remove('page-enter');
      void el.offsetWidth; // reflow
      el.classList.add('page-enter');
    } else {
      el.style.display = 'none';
    }
  });
  // Update sidebar active state
  Object.keys(_navIds).forEach(function(k) {
    var nav = ge(_navIds[k]);
    if (!nav) return;
    nav.classList.toggle('on', k === name);
  });
  // Update page title
  var titles = { dashboard:'Smart Dispatcher Dashboard', queue:'Ticket ทั้งหมด', techs:'สถานะทีมช่าง' };
  var pt = ge('pageTitle');
  if (pt && titles[name]) pt.textContent = titles[name];
  currentPage = name;
  // Reload data so sub-pages (queue, techs) render immediately
  if (typeof loadAdmin === 'function') loadAdmin();
}

/* ── Animate Counter ─────────────────────────────────── */
function animateNum(el, target) {
  if (!el) return;
  var start = parseInt(el.textContent) || 0;
  var diff = target - start;
  if (diff === 0) return;
  var steps = 20, step = 0;
  var iv = setInterval(function() {
    step++;
    el.textContent = Math.round(start + diff * (step/steps));
    if (step >= steps) { el.textContent = target; clearInterval(iv); }
  }, 18);
}

/* ── Toast Notification ──────────────────────────────── */
var _toastTimer;
function showToast(msg, type) {
  // type: 'success' | 'error' | 'warning' | default
  var t = ge('toast');
  var icons = { success:'✅', error:'❌', warning:'⚠️' };
  var icon = icons[type] || 'ℹ️';
  t.innerHTML = '<span style="font-size:16px">'+icon+'</span><span>'+msg+'</span>';
  t.className = 'toast show' + (type ? ' '+type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() {
    t.classList.add('hide');
    setTimeout(function(){ t.className='toast'; }, 350);
  }, 3200);
}

/* ── Inline Error Box ────────────────────────────────── */
function showE(id, msg) {
  var el = ge(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function hideE(id) {
  var el = ge(id);
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

/* ── Status Label (Thai) ─────────────────────────────── */
function stTH(s) {
  var m = {
    pending:'รอดำเนินการ', assigned:'รับงานแล้ว',
    in_progress:'กำลังดำเนินการ', completed:'เสร็จสิ้น', rejected:'ปฏิเสธ'
  };
  return m[s] || s;
}

/* ── Status Badge HTML ───────────────────────────────── */
function statusBadge(s) {
  var lbl = stTH(s);
  var dots = { pending:'🟡', assigned:'🔵', in_progress:'🟣', completed:'🟢', rejected:'🔴' };
  return '<span class="sbadge '+s+'">'+(dots[s]||'⚪')+' '+lbl+'</span>';
}

/* ── Priority Badge HTML ─────────────────────────────── */
function pLabel(score) {
  if (score >= 70) return '<span class="pbadge urgent">🔴 '+score+'</span>';
  if (score >= 40) return '<span class="pbadge medium">🟡 '+score+'</span>';
  return '<span class="pbadge normal">🟢 '+score+'</span>';
}

/* ── Image Preview Modal ─────────────────────────────── */
function viewImg(src, title) {
  ge('mImgSrc').src = src;
  ge('mImgTitle').textContent = title || '';
  ge('mImg').classList.add('on');
}
function closeMImg() { ge('mImg').classList.remove('on'); }

/* ── Change Password Modal ───────────────────────────── */
function openChPw() {
  hideE('chErr');
  ['curP','newP','conP'].forEach(function(i){ ge(i).value=''; });
  ge('mChPw').classList.add('on');
}
function closeChPw() { ge('mChPw').classList.remove('on'); }

/* ── Mobile Bottom Nav Active State ──────────────────── */
function mobNavSetActive(id) {
  document.querySelectorAll('.mob-nav-btn').forEach(function(b){ b.classList.remove('on'); });
  var el = ge(id);
  if (el) el.classList.add('on');
}

/* ── Caption shorthand ───────────────────────────────── */
function imgThumb(url, label) {
  if (!url) return '<span style="color:var(--muted);font-size:12px">—</span>';
  return '<img class="img-thumb" src="'+url+'" onclick="viewImg(\''+url+'\',\''+label+'\')" alt="'+label+'" />';
}
