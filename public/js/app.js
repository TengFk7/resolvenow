/* ─────────────────────────────────────────────
   public/js/app.js — Application Entry Point
   • Global state
   • enterApp() — routes user to correct view
   • loadTickets() — polls ticket data  
   • Session resume on page load
   ───────────────────────────────────────────── */

/* ── Global State ────────────────────────────────────── */
var CU = null;
var upId = null;
var upType = null;
var helpTicketId = null;
var currentPage = 'dashboard';

/* ── Interval tracking (BUG-001: prevent memory leak on re-login) */
var _adminInterval = null;
var _ticketsInterval = null;
var _helpInterval = null;

/* ── Socket-aware polling state (FIX-4.2) ──────────────── */
// ถ้า socket connected → ไม่ต้อง poll บ่อย (แค่ 30s heartbeat ป้องกัน socket หลุด)
// ถ้า socket ขาด → ยังคง poll 30s ต่อจนกว่า socket กลับมา
var _socketConnected = false;

/* ── Show Auth Page ──────────────────────────────────── */
function showAuth() {
  ge('authPage').style.display = 'flex';
  ge('adminApp').style.display = 'none';
  ge('normalApp').style.display = 'none';
  ge('mobNav').style.display = 'none';
}

/* ── Clear all polling intervals (call on logout) ────── */
function clearAppIntervals() {
  if (_adminInterval) { clearInterval(_adminInterval); _adminInterval = null; }
  if (_ticketsInterval) { clearInterval(_ticketsInterval); _ticketsInterval = null; }
  if (_helpInterval) { clearInterval(_helpInterval); _helpInterval = null; }
}

/* ── Welcome Splash (Admin, Tech & Citizen) ──────────── */
function showWelcomeSplash(role, firstName, onDone, avatarUrl) {
  var isAdmin = (role === 'admin');
  var isCitizen = (role === 'citizen');

  // ── Unified deep-navy background (ธีมเดียวกับ track.html) ──
  var bg = 'linear-gradient(160deg,#07111f 0%,#0c1e3a 50%,#101627 100%)';

  // ── Accent colour per role (ใช้ใน orbs / bar / badges) ──
  var accentColor = isAdmin ? '#f5c842' : isCitizen ? '#34d399' : '#60a5fa';
  var accent2     = isAdmin ? '#fbbf24' : isCitizen ? '#06b6d4' : '#818cf8';

  // ── Build overlay ──(opacity:1 ทันที — ไม่มี transition เพื่อป้องกัน flash 1 frame)──
  var overlay = document.createElement('div');
  overlay.id = 'welcomeSplash';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:0',
    'background:' + bg,
    'opacity:1', 'overflow:hidden'
  ].join(';');

  // ── Orb system (track.html style) ──────────────────────────
  // 3 floating orbs: gold + blue + teal (หรือ role-tinted)
  var orbData = [
    { cls:'orb-a', color: isAdmin
        ? 'radial-gradient(circle at 40% 40%,rgba(251,191,36,.55) 0%,rgba(245,158,11,.25) 40%,transparent 70%)'
        : isCitizen
          ? 'radial-gradient(circle at 40% 40%,rgba(52,211,153,.5) 0%,rgba(16,185,129,.22) 40%,transparent 70%)'
          : 'radial-gradient(circle at 40% 40%,rgba(251,191,36,.45) 0%,rgba(245,158,11,.2) 40%,transparent 70%)',
      size:'520px', top:'-12%', left:'-10%', dur:'20s', delay:'0s',
      tx1:'60px', ty1:'-40px', tx2:'110px', ty2:'30px', tx3:'40px', ty3:'-60px' },
    { cls:'orb-b', color: isAdmin
        ? 'radial-gradient(circle at 40% 40%,rgba(129,140,248,.38) 0%,rgba(99,102,241,.18) 40%,transparent 70%)'
        : isCitizen
          ? 'radial-gradient(circle at 40% 40%,rgba(6,182,212,.38) 0%,rgba(14,165,233,.18) 40%,transparent 70%)'
          : 'radial-gradient(circle at 40% 40%,rgba(96,165,250,.38) 0%,rgba(37,99,235,.18) 40%,transparent 70%)',
      size:'440px', top:'40%', left:'55%', dur:'26s', delay:'-8s',
      tx1:'-70px', ty1:'50px', tx2:'-120px', ty2:'-30px', tx3:'-50px', ty3:'70px' },
    { cls:'orb-c', color:'radial-gradient(circle at 40% 40%,rgba(45,212,191,.32) 0%,rgba(20,184,166,.14) 45%,transparent 70%)',
      size:'360px', top:'65%', left:'10%', dur:'18s', delay:'-4s',
      tx1:'50px', ty1:'-60px', tx2:'90px', ty2:'20px', tx3:'30px', ty3:'-80px' }
  ];
  var orbHtml = '';
  orbData.forEach(function(o) {
    orbHtml += '<div style="position:absolute;border-radius:50%;pointer-events:none;'
      + 'width:' + o.size + ';height:' + o.size + ';'
      + 'top:' + o.top + ';left:' + o.left + ';'
      + 'background:' + o.color + ';'
      + 'filter:blur(60px);opacity:0;'
      + 'animation:wOrbDrift ' + o.dur + ' ' + o.delay + ' ease-in-out infinite;'
      + '--tx1:' + o.tx1 + ';--ty1:' + o.ty1 + ';'
      + '--tx2:' + o.tx2 + ';--ty2:' + o.ty2 + ';'
      + '--tx3:' + o.tx3 + ';--ty3:' + o.ty3 + ';"></div>';
  });

  // ── Sparkle micro-dots ──
  var sparkleCount = isAdmin ? 18 : isCitizen ? 22 : 14;
  var sparkleHtml = '';
  for (var i = 0; i < sparkleCount; i++) {
    var sz = (Math.random() * 4 + 2).toFixed(1);
    var tp = (Math.random() * 100).toFixed(1);
    var lf = (Math.random() * 100).toFixed(1);
    var dl = (Math.random() * 2.8).toFixed(2);
    var dr = (Math.random() * 2 + 1.8).toFixed(2);
    var spCol = (i % 3 === 0) ? accentColor : (i % 3 === 1) ? accent2 : 'rgba(255,255,255,.6)';
    sparkleHtml += '<div style="position:absolute;top:' + tp + '%;left:' + lf + '%;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + spCol + ';opacity:0;animation:splashSparkle ' + dr + 's ease-in-out ' + dl + 's infinite;pointer-events:none"></div>';
  }

  // ── Content: Citizen gets avatar photo ──
  var iconHtml, titleHtml, subtitleHtml, badgeHtml;

  if (isCitizen) {
    var avatarInner = avatarUrl
      ? '<img src="' + escapeHTML(avatarUrl) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" onerror="this.style.display=\'none\'"/>'
      : '<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#34d399,#059669);display:flex;align-items:center;justify-content:center;font-size:36px;color:#fff;font-weight:800">' + escapeHTML((firstName || '?')[0].toUpperCase()) + '</div>';

    iconHtml =
      '<div style="position:relative;width:96px;height:96px;margin:0 auto;animation:splashIconPop .65s cubic-bezier(.34,1.56,.64,1) .05s both">'
      + '<div style="position:absolute;inset:-6px;border-radius:50%;background:conic-gradient(#34d399,#f5c842,#06b6d4,#34d399);animation:splashRingRotate 3s linear infinite;opacity:.85"></div>'
      + '<div style="position:absolute;inset:-2px;border-radius:50%;background:#0c1e3a"></div>'
      + '<div style="position:absolute;inset:0;border-radius:50%;overflow:hidden">' + avatarInner + '</div>'
      + '</div>';

    var displayName = escapeHTML(firstName);
    titleHtml =
      '<div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:rgba(52,211,153,.8);font-weight:600;margin-bottom:10px;animation:splashFadeUp .5s ease .35s both">WELCOME</div>'
      + '<div style="font-size:15px;font-weight:500;color:rgba(255,255,255,.6);animation:splashFadeUp .5s ease .48s both">ยินดีต้อนรับ คุณ</div>'
      + '<div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:.3px;margin-top:4px;animation:splashFadeUp .5s ease .58s both;font-family:Prompt,sans-serif">' + displayName + '</div>';

    subtitleHtml = '<div style="font-size:13px;color:rgba(255,255,255,.45);margin-top:10px;animation:splashFadeUp .5s ease .7s both">ResolveNow — พร้อมรับเรื่องร้องเรียนของคุณแล้ว</div>';
    var barHtml = '<div style="width:0;height:3px;border-radius:99px;background:linear-gradient(90deg,#34d399,#f5c842,#06b6d4);margin:18px auto 0;animation:splashBarGrow .7s cubic-bezier(.22,1,.36,1) .85s both;box-shadow:0 0 14px rgba(52,211,153,.6)"></div>';
    badgeHtml = '';

    overlay.innerHTML = [
      '<style>',
      '@keyframes splashSparkle{0%,100%{opacity:0;transform:scale(0) translateY(0)}50%{opacity:.85;transform:scale(1) translateY(-14px)}}',
      '@keyframes splashIconPop{0%{opacity:0;transform:scale(.25)}60%{transform:scale(1.12)}80%{transform:scale(.97)}100%{opacity:1;transform:scale(1)}}',
      '@keyframes splashFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes splashBarGrow{from{width:0}to{width:130px}}',
      '@keyframes splashRingRotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
      '@keyframes wOrbDrift{0%{opacity:0;transform:translate(0,0) scale(1)}8%{opacity:1}25%{opacity:.85;transform:translate(var(--tx1),var(--ty1)) scale(1.06)}50%{opacity:.7;transform:translate(var(--tx2),var(--ty2)) scale(.96)}75%{opacity:.85;transform:translate(var(--tx3),var(--ty3)) scale(1.04)}92%{opacity:1}100%{opacity:0;transform:translate(0,0) scale(1)}}',
      '</style>',
      orbHtml,
      sparkleHtml,
      '<div style="text-align:center;padding:0 36px;position:relative;z-index:2">',
      iconHtml,
      '<div style="margin-top:20px">' + titleHtml + '</div>',
      subtitleHtml,
      barHtml,
      badgeHtml,
      '</div>'
    ].join('');

  } else {
    // ── Admin / Tech ──
    iconHtml = isAdmin
      ? '<div style="font-size:72px;filter:drop-shadow(0 0 24px rgba(245,200,66,.7));animation:splashIconPop .6s cubic-bezier(.34,1.56,.64,1) .1s both">👑</div>'
      : '<div style="font-size:68px;filter:drop-shadow(0 0 20px rgba(96,165,250,.6));animation:splashIconPop .6s cubic-bezier(.34,1.56,.64,1) .1s both">🔧</div>';

    titleHtml = isAdmin
      ? '<div style="font-size:13px;letter-spacing:4px;text-transform:uppercase;color:rgba(245,200,66,.8);font-weight:600;margin-bottom:12px;animation:splashFadeUp .5s ease .3s both">SYSTEM ADMIN</div>'
      + '<div style="font-size:30px;font-weight:800;color:#fff;letter-spacing:.5px;animation:splashFadeUp .5s ease .45s both;font-family:Prompt,sans-serif">ยินดีต้อนรับ Admin</div>'
      : '<div style="font-size:12px;letter-spacing:3.5px;text-transform:uppercase;color:rgba(96,165,250,.85);font-weight:600;margin-bottom:12px;animation:splashFadeUp .5s ease .3s both">TECHNICIAN</div>'
      + '<div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:.5px;animation:splashFadeUp .5s ease .45s both;font-family:Prompt,sans-serif">ยินดีต้อนรับ, ' + escapeHTML(firstName) + '</div>';

    subtitleHtml = isAdmin
      ? '<div style="font-size:14px;color:rgba(255,255,255,.55);margin-top:10px;animation:splashFadeUp .5s ease .6s both">ระบบพร้อมให้บริการ — เข้าสู่ Dashboard</div>'
      : '<div style="font-size:13px;color:rgba(255,255,255,.5);margin-top:10px;animation:splashFadeUp .5s ease .6s both">พร้อมรับงานแล้ว — โหลดข้อมูลงาน...</div>';

    var barColor2 = isAdmin ? '#f5c842' : '#3b82f6';
    var barHtml2 = '<div style="width:0;height:3px;border-radius:99px;background:linear-gradient(90deg,' + barColor2 + ',' + accent2 + ');margin:18px auto 0;animation:splashBarGrow .65s cubic-bezier(.22,1,.36,1) .75s both;box-shadow:0 0 12px ' + barColor2 + '88"></div>';
    badgeHtml = '';

    overlay.innerHTML = [
      '<style>',
      '@keyframes splashSparkle{0%,100%{opacity:0;transform:scale(0) translateY(0)}50%{opacity:.85;transform:scale(1) translateY(-12px)}}',
      '@keyframes splashIconPop{0%{opacity:0;transform:scale(.3) rotate(-20deg)}60%{transform:scale(1.15) rotate(4deg)}80%{transform:scale(.96) rotate(-2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}',
      '@keyframes splashFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes splashBarGrow{from{width:0}to{width:120px}}',
      '@keyframes adminGlow{0%,100%{text-shadow:0 0 20px rgba(245,200,66,.3)}50%{text-shadow:0 0 40px rgba(245,200,66,.7),0 0 80px rgba(245,200,66,.2)}}',
      '@keyframes wOrbDrift{0%{opacity:0;transform:translate(0,0) scale(1)}8%{opacity:1}25%{opacity:.85;transform:translate(var(--tx1),var(--ty1)) scale(1.06)}50%{opacity:.7;transform:translate(var(--tx2),var(--ty2)) scale(.96)}75%{opacity:.85;transform:translate(var(--tx3),var(--ty3)) scale(1.04)}92%{opacity:1}100%{opacity:0;transform:translate(0,0) scale(1)}}',
      '</style>',
      orbHtml,
      sparkleHtml,
      '<div style="text-align:center;padding:0 32px;position:relative;z-index:2">',
      iconHtml,
      '<div style="margin-top:16px">' + titleHtml + '</div>',
      subtitleHtml,
      barHtml2,
      badgeHtml,
      '</div>'
    ].join('');
  }

  document.body.appendChild(overlay);

  // ── ลบ lineWaitOverlay เพียงหลังจาก overlay ใหม่ถูก append แล้ว (seamless switch, ไม่มีช่องว่าง) ──
  var lineWait = document.getElementById('lineWaitOverlay');
  if (lineWait && lineWait.parentNode) lineWait.parentNode.removeChild(lineWait);

  // Fade out + remove after 3.8s
  setTimeout(function () {
    overlay.style.transition = 'opacity .5s ease';
    overlay.style.opacity = '0';
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof onDone === 'function') onDone();
    }, 500);
  }, 3800);
}

/* ── Enter Application ───────────────────────────────── */
function enterApp() {
  ge('authPage').style.display = 'none';
  clearAppIntervals(); // BUG-001: clear any previous intervals before creating new ones

  // ── แสดง Welcome Splash ก่อนสุด (ปิดหน้าจอทันที ก่อนโหลดข้อมูล) ──
  if (CU.role === 'admin') {
    showWelcomeSplash('admin', CU.firstName, null);
  } else if (CU.role === 'technician') {
    showWelcomeSplash('technician', CU.firstName, null);
  } else if (CU.role === 'citizen') {
    var _dn = CU.lineDisplayName || CU.firstName || 'คุณ';
    showWelcomeSplash('citizen', _dn, null, CU.avatar || null);
  }

  // Load categories from DB to populate DEPT/DEPT_ICON dynamically
  loadCategories();

  if (CU.role === 'admin') {
    ge('adminApp').style.display = 'flex';
    ge('normalApp').style.display = 'none';
    var adminInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
    ge('adminAv').textContent = adminInit.toUpperCase();
    ge('adminName').textContent = CU.firstName + (CU.lastName ? ' ' + CU.lastName : '');
    showPage('dashboard');
    loadAdmin();
    _adminInterval = setInterval(function () {
      if (!_socketConnected) loadAdmin();
    }, 30000);

  } else {
    ge('normalApp').style.display = 'flex';
    ge('adminApp').style.display = 'none';

    var hAv = ge('hAv');
    if (CU.avatar) {
      hAv.outerHTML = '<img class="linepic" id="hAv" src="' + CU.avatar + '" alt="avatar" />';
    } else {
      var userInit = CU.firstName[0] + (CU.lastName && CU.lastName[0] ? CU.lastName[0] : '');
      ge('hAv').textContent = userInit.toUpperCase();
    }
    ge('hName').textContent = CU.firstName + (CU.lastName && CU.lastName !== '-' ? ' ' + CU.lastName : '');
    ge('secCitizen').style.display = CU.role === 'citizen' ? 'block' : 'none';
    ge('secTech').style.display = CU.role === 'technician' ? 'block' : 'none';
    loadTickets();
    _ticketsInterval = setInterval(function () {
      if (!_socketConnected) loadTickets();
    }, 30000);
    if (CU.role === 'technician') {
      loadHelpRequests();
      _helpInterval = setInterval(function () {
        if (!_socketConnected) loadHelpRequests();
      }, 30000);
    }
  }
}

/* ── Load Ticket Data (citizen/tech) ─────────────────── */
async function loadTickets() {
  try {
    var res = await fetch('/api/tickets');
    if (!res.ok) return;
    var data = await res.json();
    if (CU.role === 'technician') {
      renderTech(data);
      // FIX: ถ้า modal เปิดอยู่ → refresh ด้วย data ใหม่เพื่อให้ขั้นตอนก้าวหน้า
      if (typeof _tcOpen !== 'undefined' && _tcOpen && ge('mTicketDetail') && ge('mTicketDetail').classList.contains('on')) {
        tcToggle(_tcOpen);
      }
    } else {
      renderCitizen(data);
    }
  } catch (e) { console.error(e); }
}

/* ── Session Resume / Reset on Page Load ─────────────── */
(function () {
  var ap = ge('authPage');
  if (ap) ap.style.display = 'flex';

  var params = new URLSearchParams(window.location.search);
  console.log('[App] URL params:', window.location.search);
  console.log('[App] sessionStorage rn_logged_in:', sessionStorage.getItem('rn_logged_in'));

  // ── ตรวจ LINE login error params ก่อน ──
  var lineErr = params.get('line_error');
  if (lineErr) {
    var msgs = {
      cancelled: 'ยกเลิกการเข้าสู่ระบบด้วย LINE',
      invalid_state: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
      token_failed: 'ไม่สามารถยืนยัน LINE token ได้',
      profile_failed: 'ไม่สามารถดึงข้อมูล LINE profile ได้',
      server_error: 'เกิดข้อผิดพลาดบน server กรุณาลองใหม่'
    };
    console.warn('[App] LINE error param:', lineErr);
    showE('authErr', msgs[lineErr] || 'LINE Login ผิดพลาด: ' + lineErr);
    window.history.replaceState({}, '', '/');
    return;
  }

  // ── ตรวจ LINE Link pending (callback จาก LINE OAuth ครั้งแรก) ──
  var lineLinkParam = params.get('line_link');
  console.log('[App] line_link param:', lineLinkParam);
  if (lineLinkParam === 'pending') {
    console.log('[App] ✅ พบ line_link=pending → แสดง LINE Link Panel');
    sessionStorage.removeItem('rn_line_pending');
    sessionStorage.removeItem('rn_logged_in');
    window.history.replaceState({}, '', '/');

    // ── Force-kill splash ทันที ──
    var splashEl = document.getElementById('splash');
    if (splashEl && splashEl.parentNode) splashEl.parentNode.removeChild(splashEl);

    // ── ซ่อน app panels ทั้งหมดทันที ──
    var _aa = ge('adminApp'); if (_aa) _aa.style.display = 'none';
    var _na = ge('normalApp'); if (_na) _na.style.display = 'none';
    var _ap = ge('authPage');

    // ── STEP 1: Pre-fetch LINE profile BEFORE touching DOM ──
    // วิธีนี้ป้องกัน layout shift (ชื่อ "กำลังโหลด..." → ชื่อจริง) ระหว่าง animation
    var _lineProfileData = null;
    fetch('/api/auth/line-pending')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (profileData) {
        _lineProfileData = profileData;

        // ── STEP 2: ตั้งค่า DOM ทั้งหมดพร้อมกัน (sync, ก่อน paint) ──

        // ซ่อน tabs + panels อื่นทันที
        var tabsEl = document.querySelector('.tabs');
        if (tabsEl) tabsEl.style.display = 'none';
        ['fLogin', 'fReg', 'fSearch', 'fHeatmap'].forEach(function (id) {
          var el = ge(id); if (el) el.style.display = 'none';
        });
        var otpEl = ge('fOtp'); if (otpEl) otpEl.style.display = 'none';
        var fLLOtp = ge('fLineLinkOtp'); if (fLLOtp) fLLOtp.style.display = 'none';

        // ── Populate LINE profile ก่อนแสดง (ไม่มี layout shift) ──
        if (_lineProfileData) {
          var nameEl = ge('llLineName');
          if (nameEl) nameEl.textContent = _lineProfileData.lineDisplayName || 'LINE User';
          if (_lineProfileData.lineAvatar) {
            var av = ge('llLineAvatar');
            var avFb = ge('llLineAvatarFallback');
            if (av) { av.src = _lineProfileData.lineAvatar; av.style.display = 'block'; }
            if (avFb) avFb.style.display = 'none';
          }
        }

        // Reset form fields
        ['llFirst', 'llLast', 'llEmail', 'llPass', 'llPass2'].forEach(function (id) {
          var el = ge(id); if (el) el.value = '';
        });
        var btnLink = ge('btnLineLink');
        if (btnLink) { btnLink.disabled = false; btnLink.textContent = '✨ สร้างบัญชีและผูกกับ LINE'; }
        hideE('llErr');

        // เตรียม LINE Link panel (ซ่อนไว้ก่อน → จะ animate เข้ามา)
        var fLL = ge('fLineLink');
        if (fLL) {
          fLL.style.display = 'block';
          fLL.style.opacity = '0';
          fLL.style.transform = 'translateY(24px)';
          fLL.style.transition = 'none';
        }

        // authPage: invisible แต่แสดงอยู่ + ตรวจ .ac card เพื่อ reset state
        if (_ap) {
          _ap.style.display = 'flex';
          _ap.style.opacity = '0';
          _ap.style.transition = 'none';
        }
        // reset auth card ให้ไม่มี card-enter (เพื่อกัน stale animation)
        var acEl = document.querySelector('.ac');
        if (acEl) {
          acEl.classList.remove('card-enter');
          acEl.style.transform = 'translateX(0)';
          acEl.style.opacity = '1';
        }

        // ── STEP 3: Single rAF → paint ทุก DOM change ก่อน → แล้ว animate ──
        requestAnimationFrame(function () {
          // Fade in auth page (เร็วขึ้น: 0.35s)
          if (_ap) {
            _ap.style.transition = 'opacity .35s ease';
            _ap.style.opacity = '1';
          }
          // Slide up + fade in LINE Link panel พร้อมกัน (stagger 80ms)
          setTimeout(function () {
            if (fLL) {
              fLL.style.transition = 'opacity .38s ease, transform .38s cubic-bezier(.22,1,.36,1)';
              fLL.style.opacity = '1';
              fLL.style.transform = 'translateY(0)';
            }
            // Cleanup inline styles หลัง animation เสร็จ
            setTimeout(function () {
              if (_ap) _ap.style.transition = '';
              if (fLL) { fLL.style.transition = ''; fLL.style.transform = ''; }
            }, 420);
          }, 80);
        });
      });
    return;
  }

  // ── ตรวจ LINE login success (callback จาก LINE OAuth สำหรับ user ที่เคยผูกแล้ว) ──
  var lineLoginParam = params.get('line_login');
  if (lineLoginParam === 'success') {
    console.log('[App] ✅ LINE login success → ตรวจ session...');
    window.history.replaceState({}, '', '/');

    // Force-kill page-load splash
    var splashElLogin = document.getElementById('splash');
    if (splashElLogin && splashElLogin.parentNode) splashElLogin.parentNode.removeChild(splashElLogin);

    // ── แสดง overlay deep-navy คลุมหน้าจอทันที ── (ธีมเดียวกับ track.html)
    var lineWaitOverlay = document.createElement('div');
    lineWaitOverlay.id = 'lineWaitOverlay';
    lineWaitOverlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:linear-gradient(160deg,#07111f 0%,#0c1e3a 50%,#101627 100%);display:flex;align-items:center;justify-content:center;overflow:hidden';
    lineWaitOverlay.innerHTML = '<div style="text-align:center;font-family:Prompt,sans-serif;position:relative;z-index:2">'
      + '<svg xmlns="http://www.w3.org/2000/svg" width="58" height="58" viewBox="0 0 24 24" fill="#06c755" style="filter:drop-shadow(0 0 16px rgba(6,199,85,.6))">'
      + '<path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>'
      + '</svg>'
      + '<div style="color:rgba(255,255,255,.55);font-size:13px;margin-top:16px">กำลังเข้าสู่ระบบด้วย LINE...</div>'
      + '</div>'
      + '<div style="position:absolute;width:480px;height:480px;top:-15%;left:-15%;border-radius:50%;background:radial-gradient(circle at 40% 40%,rgba(251,191,36,.4) 0%,rgba(245,158,11,.18) 40%,transparent 70%);filter:blur(60px);animation:lwOrb1 18s ease-in-out infinite"></div>'
      + '<div style="position:absolute;width:380px;height:380px;top:45%;left:50%;border-radius:50%;background:radial-gradient(circle at 40% 40%,rgba(96,165,250,.35) 0%,rgba(37,99,235,.15) 40%,transparent 70%);filter:blur(60px);animation:lwOrb2 24s -6s ease-in-out infinite"></div>'
      + '<style>@keyframes lwOrb1{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,-40px)}}@keyframes lwOrb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-70px,50px)}}</style>';
    document.body.appendChild(lineWaitOverlay);

    // ซ่อน authPage ทันที (รอง overlay คลุมอยู่แล้ว)
    var _apLogin = ge('authPage');
    if (_apLogin) _apLogin.style.display = 'none';

    fetch('/api/auth/me')
      .then(function (r) {
        if (r.ok) return r.json();
        throw new Error('no session');
      })
      .then(function (d) {
        if (!d.loggedIn) throw new Error('no session');
        console.log('[App] LINE login session ดี → enterApp() role:', d.role);
        CU = d;
        sessionStorage.setItem('rn_logged_in', '1');
        enterApp(); // showWelcomeSplash จะลบ lineWaitOverlay และถือหน้าต่อ
      })
      .catch(function () {
        console.log('[App] LINE login แต่ไม่มี session → หน้า login');
        if (lineWaitOverlay.parentNode) lineWaitOverlay.parentNode.removeChild(lineWaitOverlay);
        if (_apLogin) _apLogin.style.display = 'flex';
        showE('authErr', 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่');
      });
    return;
  }



  // ── ตรวจ session: resume เฉพาะเมื่อ user เคย login ใน tab นี้ (refresh) ──
  // FIX-1.1: ถ้าเปิด tab ใหม่ → sessionStorage ว่าง → แค่แสดงหน้า login
  //           ห้าม POST /logout เพราะจะทำลาย session ของ tab อื่นที่ login อยู่!
  var wasLoggedIn = sessionStorage.getItem('rn_logged_in');
  sessionStorage.removeItem('rn_line_pending');

  if (!wasLoggedIn) {
    // Fresh/new tab visit → แค่แสดงหน้า login โดยไม่แตะ server session
    console.log('[App] Fresh/new-tab visit → แสดงหน้า login (ไม่ยิง logout)');
    return; // FIX-1.1: ลบ fetch logout ออก
  }

  // Tab refresh → try to resume session
  console.log('[App] Tab refresh → ตรวจ /api/auth/me...');
  fetch('/api/auth/me')
    .then(function (r) {
      console.log('[App] /api/auth/me status:', r.status);
      if (r.ok) return r.json();
      throw new Error('no session');
    })
    .then(function (d) {
      if (!d.loggedIn) throw new Error('no session');
      console.log('[App] session ดี → enterApp() role:', d.role);
      CU = d;
      sessionStorage.setItem('rn_logged_in', '1');
      enterApp();
    })
    .catch(function () {
      console.log('[App] ไม่มี session → หน้า login');
      sessionStorage.removeItem('rn_logged_in');
      fetch('/api/auth/logout', { method: 'POST' }).catch(function () { });
    });
})();

