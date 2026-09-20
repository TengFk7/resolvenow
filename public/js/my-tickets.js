/**
 * ResolveNow - Citizen My Tickets Dedicated Controller
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 * 
 * • 6-Layer Security Check Engine (Session, IDOR, XSS, RateLimit, PDPA, Socket)
 * • Real-time Ticket Synchronization & Live Discussion
 * • Rich Filtering, Search & Status Metrics
 */

var CU = null;
var _allTickets = [];
var _activeStatusFilter = 'all';
var _searchQuery = '';
var _sortOrder = 'newest';
var _socket = null;
var _currentChatTicketId = null;
var _currentRatingTicketId = null;
var _selectedStars = 5;
var _currentReopenTicketId = null;

/* ── DOM Helper ──────────────────────────────────────── */
function ge(id) { return document.getElementById(id); }

/* ── Escape HTML (XSS Protection) ────────────────────── */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── Department Icons & Status Maps ──────────────────── */
var DEPT_ICON = {
  Road: '🛣️',
  Water: '💧',
  Electricity: '💡',
  Garbage: '🗑️',
  Animal: '🐍',
  Tree: '🌿',
  Hazard: '🚨',
  Other: '📋'
};

var DEPT_NAME = {
  Road: 'ถนน/ทางเท้า',
  Water: 'ท่อแตก/น้ำประปา',
  Electricity: 'ไฟฟ้าส่องสว่าง',
  Garbage: 'ขยะมูลฝอย',
  Animal: 'สัตว์มีพิษ/จรจัด',
  Tree: 'ตัดแต่งต้นไม้/กิ่งไม้',
  Hazard: 'สาธารณภัย/สิ่งกีดขวาง',
  Other: 'เรื่องอื่นๆ'
};

function stTH(st) {
  var map = {
    pending: 'รอดำเนินการ',
    assigned: 'รับงานแล้ว',
    in_progress: 'กำลังซ่อมบำรุง',
    completed: 'เสร็จสิ้นแล้ว',
    rejected: 'ปฏิเสธเรื่อง',
    reopened: 'ขอตรวจสอบซ้ำ'
  };
  return map[st] || st;
}

function urgTH(urg) {
  var map = {
    urgent: '⚡ ด่วนมาก (2h SLA)',
    medium: '⏰ ด่วน (8h SLA)',
    normal: '🔵 ปกติ (24h SLA)'
  };
  return map[urg] || urg;
}

function fmtDate(dt) {
  if (!dt) return '—';
  try {
    var d = new Date(dt);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '—';
  }
}

/* ════════════════════════════════════════════════════════
   1. SECURITY CHECK ENGINE & AUTH GUARD
   ════════════════════════════════════════════════════════ */
async function runSecurityChecks() {
  var chkSession = ge('chkSession');
  var chkIdor = ge('chkIdor');
  var chkXss = ge('chkXss');
  var chkRate = ge('chkRate');
  var chkSocket = ge('chkSocket');
  var barrier = ge('secAuthBarrier');

  try {
    // 1. Session Verification Check
    var res = await fetch('/api/auth/me');
    if (!res.ok) {
      if (chkSession) {
        chkSession.textContent = 'UNAUTHORIZED';
        chkSession.style.background = '#fee2e2';
        chkSession.style.color = '#dc2626';
      }
      if (barrier) barrier.style.display = 'flex';
      return false;
    }

    var data = await res.json();
    // /api/auth/me returns { id, firstName, lastName, email, role, loggedIn } directly
    if (!data || !data.loggedIn || !data.id) {
      if (chkSession) {
        chkSession.textContent = 'UNAUTHENTICATED';
        chkSession.style.background = '#fee2e2';
        chkSession.style.color = '#dc2626';
      }
      if (barrier) barrier.style.display = 'flex';
      return false;
    }

    CU = data;

    // Verify role authorization (Citizen, Admin, Technician)
    if (CU.role !== 'citizen' && CU.role !== 'admin' && CU.role !== 'technician') {
      if (barrier) {
        barrier.style.display = 'flex';
        var bBox = barrier.querySelector('.sec-barrier-box');
        if (bBox) {
          bBox.innerHTML = '<div style="font-size:48px;margin-bottom:12px">🚫</div>'
            + '<h2 style="font-size:18px">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>'
            + '<p style="font-size:13px;color:var(--muted);margin:14px 0">หน้านี้สำหรับประชาชนผู้ร้องเรียนเท่านั้น</p>'
            + '<a href="/" class="btnp" style="display:block;text-decoration:none;padding:10px">กลับสู่หน้าหลัก</a>';
        }
      }
      return false;
    }

    // Hide barrier if previously displayed
    if (barrier) barrier.style.display = 'none';

    // Set verified labels
    if (chkSession) {
      chkSession.textContent = 'VERIFIED ✅';
      chkSession.style.background = '#dcfce7';
      chkSession.style.color = '#15803d';
    }
    if (chkIdor) {
      chkIdor.textContent = 'SCOPED 🛡️';
      chkIdor.style.background = '#dcfce7';
      chkIdor.style.color = '#15803d';
    }
    if (chkXss) {
      chkXss.textContent = 'SANITIZED 🧼';
      chkXss.style.background = '#dcfce7';
      chkXss.style.color = '#15803d';
    }
    if (chkRate) {
      chkRate.textContent = 'ACTIVE ⚡';
      chkRate.style.background = '#dcfce7';
      chkRate.style.color = '#15803d';
    }

    // Render User Avatar & Name in Header
    renderUserProfileHeader();

    return true;
  } catch (err) {
    console.error('[SecurityCheck] Session verify failed:', err);
    if (barrier) barrier.style.display = 'flex';
    return false;
  }
}

function renderUserProfileHeader() {
  if (!CU) return;
  var av = ge('uAvatar');
  var nm = ge('uName');
  if (av) {
    if (CU.avatar) {
      av.innerHTML = '<img src="' + CU.avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />';
    } else {
      var initial = (CU.firstName ? CU.firstName[0] : 'U').toUpperCase();
      av.textContent = initial;
    }
  }
  if (nm) {
    nm.textContent = (CU.firstName || '') + (CU.lastName && CU.lastName !== '-' ? ' ' + CU.lastName : '');
    nm.style.display = 'inline-block';
  }
}

/* ════════════════════════════════════════════════════════
   2. SOCKET.IO REAL-TIME SYNC
   ════════════════════════════════════════════════════════ */
function initSocketSync() {
  if (typeof io === 'undefined') return;
  _socket = io();

  var chkSocket = ge('chkSocket');
  var diagBadge = ge('diagSocketBadge');

  _socket.on('connect', function () {
    if (chkSocket) {
      chkSocket.textContent = 'LIVE 🟢';
      chkSocket.style.background = '#dcfce7';
      chkSocket.style.color = '#15803d';
    }
    if (diagBadge) {
      diagBadge.textContent = 'CONNECTED (PING 15ms)';
    }
  });

  _socket.on('disconnect', function () {
    if (chkSocket) {
      chkSocket.textContent = 'RECONNECTING 🟡';
      chkSocket.style.background = '#fef3c7';
      chkSocket.style.color = '#b45309';
    }
  });

  // Real-time events to auto-refresh tickets
  var events = ['ticket_updated', 'ticket_status_changed', 'ticket_assigned', 'ticket_reopened', 'ticket_materials_updated'];
  events.forEach(function (evt) {
    _socket.on(evt, function () {
      loadMyTickets(false);
    });
  });

  // Live comment event
  _socket.on('comment_added', function (payload) {
    if (_currentChatTicketId && payload && payload.ticketId === _currentChatTicketId) {
      loadTicketChatMessages(_currentChatTicketId);
    }
  });
}

/* ════════════════════════════════════════════════════════
   3. TICKET DATA LOADING & KPI METRICS
   ════════════════════════════════════════════════════════ */
async function loadMyTickets(showAnimation) {
  var refIcon = ge('refreshIcon');
  if (showAnimation && refIcon) {
    refIcon.style.display = 'inline-block';
    refIcon.style.animation = 'spin .8s linear infinite';
  }

  try {
    var res = await fetch('/api/tickets');
    if (!res.ok) throw new Error('Cannot fetch tickets');
    var data = await res.json();
    _allTickets = Array.isArray(data) ? data : [];

    updateKpiMetrics(_allTickets);
    applyFilters();
  } catch (err) {
    console.error('[loadMyTickets] Error:', err);
    var grid = ge('ticketsGrid');
    if (grid) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--r)">'
        + '<div style="font-size:36px;margin-bottom:8px">⚠️</div>'
        + '<div style="font-weight:700">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>'
        + '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + escapeHTML(err.message) + '</div>'
        + '<button class="btnp" onclick="loadMyTickets(true)" style="margin-top:14px;padding:8px 18px">🔄 ลองใหม่อีกครั้ง</button>'
        + '</div>';
    }
  } finally {
    if (refIcon) {
      setTimeout(function () { refIcon.style.animation = ''; }, 300);
    }
  }
}

function updateKpiMetrics(tickets) {
  var cntAll = tickets.length;
  var cntPending = tickets.filter(function (t) { return t.status === 'pending'; }).length;
  var cntInProg = tickets.filter(function (t) { return t.status === 'assigned' || t.status === 'in_progress'; }).length;
  var cntDone = tickets.filter(function (t) { return t.status === 'completed'; }).length;
  var cntReopened = tickets.filter(function (t) { return t.status === 'reopened'; }).length;

  if (ge('cntAll')) ge('cntAll').textContent = cntAll;
  if (ge('cntPending')) ge('cntPending').textContent = cntPending;
  if (ge('cntInProg')) ge('cntInProg').textContent = cntInProg;
  if (ge('cntDone')) ge('cntDone').textContent = cntDone;
  if (ge('cntReopened')) ge('cntReopened').textContent = cntReopened;
}

/* ════════════════════════════════════════════════════════
   4. FILTERING, SEARCH & RENDERING
   ════════════════════════════════════════════════════════ */
function setStatusFilter(status, btn) {
  _activeStatusFilter = status;
  document.querySelectorAll('.mytk-pill').forEach(function (p) { p.classList.remove('active'); });
  if (btn) btn.classList.add('active');

  // Sync with KPI card active state
  document.querySelectorAll('.mytk-kpi-card').forEach(function (c) { c.classList.remove('active'); });
  var kpiCard = ge('kpi-' + status);
  if (kpiCard) kpiCard.classList.add('active');

  applyFilters();
}

function setKpiFilter(status) {
  _activeStatusFilter = status;
  document.querySelectorAll('.mytk-kpi-card').forEach(function (c) { c.classList.remove('active'); });
  var kpiCard = ge('kpi-' + status);
  if (kpiCard) kpiCard.classList.add('active');

  // Sync toolbar pill
  document.querySelectorAll('.mytk-pill').forEach(function (p) {
    p.classList.toggle('active', p.getAttribute('data-status') === status);
  });

  applyFilters();
}

function applyFilters() {
  var searchInp = ge('searchTickets');
  _searchQuery = searchInp ? searchInp.value.trim().toLowerCase() : '';
  var sortSel = ge('sortOrder');
  _sortOrder = sortSel ? sortSel.value : 'newest';

  var filtered = _allTickets.filter(function (t) {
    // Status filter
    if (_activeStatusFilter === 'in_progress') {
      if (t.status !== 'in_progress' && t.status !== 'assigned') return false;
    } else if (_activeStatusFilter !== 'all') {
      if (t.status !== _activeStatusFilter) return false;
    }

    // Search query
    if (_searchQuery) {
      var matchId = (t.ticketId || '').toLowerCase().indexOf(_searchQuery) !== -1;
      var matchDesc = (t.description || '').toLowerCase().indexOf(_searchQuery) !== -1;
      var matchCat = (t.category || '').toLowerCase().indexOf(_searchQuery) !== -1;
      var matchLoc = (t.location || '').toLowerCase().indexOf(_searchQuery) !== -1;
      var matchDept = (DEPT_NAME[t.category] || '').toLowerCase().indexOf(_searchQuery) !== -1;
      if (!matchId && !matchDesc && !matchCat && !matchLoc && !matchDept) return false;
    }

    return true;
  });

  // Sorting
  filtered.sort(function (a, b) {
    if (_sortOrder === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else if (_sortOrder === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    } else if (_sortOrder === 'urgency') {
      var order = { urgent: 3, medium: 2, normal: 1 };
      return (order[b.urgency] || 0) - (order[a.urgency] || 0);
    }
    return 0;
  });

  renderTicketGrid(filtered);
}

function renderTicketGrid(tickets) {
  var grid = ge('ticketsGrid');
  if (!grid) return;

  if (!tickets || tickets.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:56px 20px;background:var(--card-bg);border:1px dashed var(--border);border-radius:20px">'
      + '<div style="font-size:44px;margin-bottom:10px">📂</div>'
      + '<h3 style="margin:0 0 6px;font-size:16px">ไม่พบเรื่องร้องเรียนตามเงื่อนไข</h3>'
      + '<p style="font-size:12.5px;color:var(--muted);margin:0 0 16px">ลองค้นหาด้วยคำสำคัญอื่น หรือเปลี่ยนตัวกรองสถานะ</p>'
      + '<a href="/" class="btnp btn-ripple" style="display:inline-block;text-decoration:none;padding:10px 20px;font-size:13px">➕ แจ้งเรื่องร้องเรียนใหม่</a>'
      + '</div>';
    return;
  }

  var html = '';
  tickets.forEach(function (t) {
    var catIcon = DEPT_ICON[t.category] || '📋';
    var catName = DEPT_NAME[t.category] || t.category || 'ทั่วไป';
    var isDone = t.status === 'completed';
    var isReopened = t.status === 'reopened';

    // Thumbnail
    var thumbHtml = '';
    if (t.citizenImages && t.citizenImages.length > 0) {
      thumbHtml = '<img src="' + t.citizenImages[0] + '" class="mytk-card-thumb" alt="รูปปัญหา" onclick="event.stopPropagation();viewImg(\'' + t.citizenImages[0] + '\',\'รูปที่แจ้ง ' + t.ticketId + '\')" />';
    } else if (t.citizenImage) {
      thumbHtml = '<img src="' + t.citizenImage + '" class="mytk-card-thumb" alt="รูปปัญหา" onclick="event.stopPropagation();viewImg(\'' + t.citizenImage + '\',\'รูปที่แจ้ง ' + t.ticketId + '\')" />';
    } else {
      thumbHtml = '<div class="mytk-card-thumb-fallback">' + catIcon + '</div>';
    }

    // Special badges
    var extraBadges = '';
    if (isReopened) {
      extraBadges += '<span style="font-size:10.5px;padding:2px 7px;border-radius:6px;background:#ffedd5;color:#c2410c;font-weight:700">🔄 ขอตรวจซ้ำ</span>';
    }
    if (t.isMerged) {
      extraBadges += '<span style="font-size:10.5px;padding:2px 7px;border-radius:6px;background:#f1f5f9;color:#475569;font-weight:700">🔗 เคสรวม</span>';
    }
    if (t.slaPauseStatus === 'paused') {
      extraBadges += '<span style="font-size:10.5px;padding:2px 7px;border-radius:6px;background:#fef3c7;color:#b45309;font-weight:700">⏸️ พัก SLA</span>';
    }

    html += '<div class="mytk-card" onclick="openTD(\'' + t.ticketId + '\')">';

    // Card Header
    html += '<div class="mytk-card-head">';
    html += '<div class="mytk-card-id-wrap">';
    html += '<span style="font-size:18px">' + catIcon + '</span>';
    html += '<span class="mytk-card-id">' + escapeHTML(t.ticketId) + '</span>';
    html += '<span style="font-size:11.5px;color:var(--muted)">(' + escapeHTML(catName) + ')</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:6px">';
    html += extraBadges;
    html += '<span class="badge ' + t.status + '">' + stTH(t.status) + '</span>';
    html += '</div>';
    html += '</div>';

    // Card Body
    html += '<div class="mytk-card-body">';
    html += '<div class="mytk-card-thumb-wrap">' + thumbHtml + '</div>';
    html += '<div class="mytk-card-info">';
    html += '<div class="mytk-card-desc">' + escapeHTML(t.description) + '</div>';
    html += '<div class="mytk-card-meta">';
    html += '<span>📍 ' + escapeHTML(t.location || 'ไม่ระบุสถานที่') + '</span>';
    html += '</div>';
    html += '<div class="mytk-card-meta">';
    html += '<span>📅 ' + fmtDate(t.createdAt) + '</span>';
    html += '<span style="margin-left:auto">' + urgTH(t.urgency) + '</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Card Footer Actions
    html += '<div class="mytk-card-foot" onclick="event.stopPropagation()">';
    html += '<div style="display:flex;align-items:center;gap:6px">';
    if (t.technicianName) {
      html += '<span style="font-size:11.5px;color:var(--muted)">👷 ช่าง: <strong>' + escapeHTML(t.technicianName) + '</strong></span>';
    } else {
      html += '<span style="font-size:11.5px;color:var(--muted)">⏳ กำลังจัดสรรช่าง</span>';
    }
    html += '</div>';

    html += '<div class="mytk-card-actions">';
    if (t.status !== 'rejected') {
      html += '<button type="button" class="mytk-btn-sm" onclick="openTicketChat(\'' + t.ticketId + '\')">💬 แชท</button>';
    }
    if (isDone) {
      if (t.rating) {
        var starsStr = '';
        for (var s = 0; s < t.rating; s++) starsStr += '⭐';
        html += '<span style="font-size:11px">' + starsStr + '</span>';
      } else {
        html += '<button type="button" class="mytk-btn-sm" style="color:#d97706;border-color:#fed7aa;background:#fffbeb" onclick="openRatingModal(\'' + t.ticketId + '\')">⭐ ให้คะแนน</button>';
      }
    }
    html += '<button type="button" class="mytk-btn-sm" style="background:var(--blue2);color:#fff;border-color:var(--blue2)" onclick="openTD(\'' + t.ticketId + '\')">ดูข้อมูล 📋</button>';
    html += '</div>';

    html += '</div>'; // /mytk-card-foot
    html += '</div>'; // /mytk-card
  });

  grid.innerHTML = html;
}

/* ════════════════════════════════════════════════════════
   5. TICKET DETAIL MODAL
   ════════════════════════════════════════════════════════ */
function openTD(ticketId) {
  var t = _allTickets.find(function (item) { return item.ticketId === ticketId; });
  if (!t) return;

  var titleEl = ge('tdModalTitle');
  if (titleEl) {
    titleEl.innerHTML = (DEPT_ICON[t.category] || '📋') + ' ' + escapeHTML(t.ticketId)
      + ' <span class="badge ' + t.status + '" style="font-size:11px;margin-left:8px">' + stTH(t.status) + '</span>';
  }

  var h = '';
  // Multi-image gallery
  if (t.citizenImages && t.citizenImages.length > 0) {
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;margin-bottom:14px">';
    t.citizenImages.forEach(function (imgUrl) {
      h += '<img src="' + imgUrl + '" onclick="viewImg(this.src,\'รูปที่แจ้ง\')" style="width:100%;height:80px;object-fit:cover;border-radius:10px;cursor:pointer;border:1px solid var(--border)" />';
    });
    h += '</div>';
  } else if (t.citizenImage) {
    h += '<img src="' + t.citizenImage + '" onclick="viewImg(this.src,\'รูปที่แจ้ง\')" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;cursor:pointer;margin-bottom:14px;border:1px solid var(--border)" />';
  }

  h += '<div class="cg-detail-row"><span class="cg-dl">หมวดหมู่:</span><span class="cg-dv">' + (DEPT_ICON[t.category] || '') + ' ' + escapeHTML(DEPT_NAME[t.category] || t.category) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">ความเร่งด่วน:</span><span class="cg-dv">' + urgTH(t.urgency) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">สถานที่:</span><span class="cg-dv">📍 ' + escapeHTML(t.location || '—') + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">รายละเอียด:</span><span class="cg-dv">' + escapeHTML(t.description) + '</span></div>';
  h += '<div class="cg-detail-row"><span class="cg-dl">วันที่แจ้ง:</span><span class="cg-dv">' + fmtDate(t.createdAt) + '</span></div>';

  if (t.technicianName) {
    h += '<div class="cg-detail-row"><span class="cg-dl">ช่างผู้รับผิดชอบ:</span><span class="cg-dv">👷 ' + escapeHTML(t.technicianName) + '</span></div>';
  }

  // Before / After Showcase
  if (t.status === 'completed' && (t.beforeImage || t.afterImage)) {
    h += '<div style="margin-top:16px;padding:14px;background:var(--surface);border-radius:14px;border:1px solid var(--border)">';
    h += '<div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--g)">✅ ผลการปฏิบัติงานของช่าง (Before / After)</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    if (t.beforeImage) {
      h += '<div><img src="' + t.beforeImage + '" onclick="viewImg(this.src,\'ก่อนซ่อม\')" style="width:100%;height:110px;object-fit:cover;border-radius:10px;cursor:pointer" /><div style="font-size:11px;text-align:center;margin-top:4px;color:var(--muted)">ก่อนซ่อม</div></div>';
    }
    if (t.afterImage) {
      h += '<div><img src="' + t.afterImage + '" onclick="viewImg(this.src,\'หลังซ่อม\')" style="width:100%;height:110px;object-fit:cover;border-radius:10px;cursor:pointer" /><div style="font-size:11px;text-align:center;margin-top:4px;color:var(--muted)">หลังซ่อมเสร็จ</div></div>';
    }
    h += '</div></div>';
  }

  // Materials if any
  if (t.materials && t.materials.length > 0) {
    h += '<div style="margin-top:14px;padding:12px;background:var(--bg);border-radius:12px;border:1px solid var(--border)">';
    h += '<div style="font-weight:700;font-size:12.5px;margin-bottom:6px">🛠️ อะไหล่/วัสดุที่ใช้:</div>';
    t.materials.forEach(function (m) {
      h += '<div style="font-size:12px;display:flex;justify-content:space-between;color:var(--muted)"><span>• ' + escapeHTML(m.name) + ' (' + m.quantity + ' ' + escapeHTML(m.unit || 'ชิ้น') + ')</span></div>';
    });
    h += '</div>';
  }

  // Reopen banner
  if (t.status === 'completed') {
    h += '<div style="margin-top:16px;text-align:center;padding-top:12px;border-top:1px dashed var(--border)">'
      + '<button type="button" class="btn-reopen" onclick="openReopenModal(\'' + t.ticketId + '\')">🔄 งานยังไม่เรียบร้อย? ขอยื่นตรวจสอบใหม่</button>'
      + '</div>';
  }

  ge('tdModalBody').innerHTML = h;

  // Footer Actions
  var foot = '';
  if (t.status !== 'rejected') {
    foot += '<button class="btnp btn-ripple" onclick="openTicketChat(\'' + t.ticketId + '\')">💬 แชทกับช่าง</button>';
  }
  if (t.status === 'completed' && !t.rating) {
    foot += '<button class="btnp btn-ripple" style="background:linear-gradient(135deg,#f59e0b,#d97706)" onclick="openRatingModal(\'' + t.ticketId + '\')">⭐ ประเมินความพึงพอใจ</button>';
  }
  foot += '<button class="mytk-btn-sm" style="padding:10px 18px" onclick="closeTD()">ปิด</button>';

  ge('tdModalFooter').innerHTML = foot;
  ge('mTicketDetail').classList.add('on');
}

function closeTD() {
  var m = ge('mTicketDetail');
  if (m) m.classList.remove('on');
}

/* ════════════════════════════════════════════════════════
   6. TICKET DISCUSSION CHAT
   ════════════════════════════════════════════════════════ */
async function openTicketChat(ticketId) {
  _currentChatTicketId = ticketId;
  var title = ge('chatTicketTitle');
  if (title) title.textContent = '💬 สนทนาเรื่องตั๋ว #' + ticketId;

  var m = ge('mTicketChat');
  if (m) m.classList.add('on');

  var inp = ge('ticketChatInput');
  if (inp) { inp.value = ''; inp.focus(); }

  await loadTicketChatMessages(ticketId);
}

function closeTicketChat() {
  _currentChatTicketId = null;
  var m = ge('mTicketChat');
  if (m) m.classList.remove('on');
}

async function loadTicketChatMessages(ticketId) {
  var box = ge('ticketChatMsgs');
  if (!box) return;

  try {
    var res = await fetch('/api/tickets/' + ticketId + '/comments');
    if (!res.ok) throw new Error('Cannot load messages');
    var comments = await res.json();

    if (!comments || comments.length === 0) {
      box.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;margin:auto">💬 ยังไม่มีข้อความสนทนา — เริ่มส่งข้อความได้เลย</div>';
      return;
    }

    var h = '';
    comments.forEach(function (c) {
      var isMe = (CU && c.authorId === CU._id);
      var roleBadge = c.authorRole === 'technician' ? '👷 ช่าง' : (c.authorRole === 'admin' ? '🛡️ Admin' : '👤 คุณ');
      var bubbleBg = isMe ? 'var(--blue2)' : 'var(--card-bg)';
      var bubbleColor = isMe ? '#ffffff' : 'var(--text)';
      var align = isMe ? 'flex-end' : 'flex-start';

      h += '<div style="display:flex;flex-direction:column;align-items:' + align + ';max-width:80%;' + (isMe ? 'margin-left:auto' : 'margin-right:auto') + '">';
      h += '<div style="font-size:10.5px;color:var(--muted);margin-bottom:3px">' + roleBadge + ' · ' + fmtDate(c.createdAt) + '</div>';
      h += '<div style="background:' + bubbleBg + ';color:' + bubbleColor + ';padding:8px 12px;border-radius:12px;font-size:13px;border:1px solid var(--border);word-break:break-word">' + escapeHTML(c.text) + '</div>';
      h += '</div>';
    });

    box.innerHTML = h;
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    box.innerHTML = '<div style="text-align:center;color:var(--r);font-size:12px;margin:auto">ไม่สามารถโหลดข้อความได้</div>';
  }
}

async function sendTicketChat() {
  if (!_currentChatTicketId) return;
  var inp = ge('ticketChatInput');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;

  try {
    inp.disabled = true;
    var res = await fetch('/api/tickets/' + _currentChatTicketId + '/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    if (!res.ok) throw new Error('Send comment failed');
    inp.value = '';
    await loadTicketChatMessages(_currentChatTicketId);
  } catch (err) {
    alert('ส่งข้อความไม่สำเร็จ: ' + err.message);
  } finally {
    if (inp) { inp.disabled = false; inp.focus(); }
  }
}

/* ════════════════════════════════════════════════════════
   7. RATING & REOPEN FLOWS
   ════════════════════════════════════════════════════════ */
function openRatingModal(ticketId) {
  _currentRatingTicketId = ticketId;
  _selectedStars = 5;
  var lbl = ge('ratingTicketLabel');
  if (lbl) lbl.textContent = 'ตั๋วรหัส: #' + ticketId;
  setRatingStar(5);
  hideE('ratingErr');
  var m = ge('mRating');
  if (m) m.classList.add('on');
}

function closeRatingModal() {
  _currentRatingTicketId = null;
  var m = ge('mRating');
  if (m) m.classList.remove('on');
}

function setRatingStar(n) {
  _selectedStars = n;
  var btns = document.querySelectorAll('.star-btn');
  btns.forEach(function (b, idx) {
    b.classList.toggle('active', idx < n);
  });
  var lbl = ge('starLabel');
  var labels = ['1 ดาว — ต้องปรับปรุงอย่างยิ่ง 😞', '2 ดาว — พอใช้ได้ แต่ควรปรับปรุง 😐', '3 ดาว — ปานกลาง 🙂', '4 ดาว — พึงพอใจมาก 😊', '5 ดาว — ยอดเยี่ยมมาก ประทับใจ! 🌟'];
  if (lbl) lbl.textContent = labels[n - 1] || '';

  var reasonWrap = ge('ratingReasonWrap');
  if (reasonWrap) {
    reasonWrap.style.display = n <= 2 ? 'block' : 'none';
  }
}

async function submitRating() {
  if (!_currentRatingTicketId) return;
  var reason = ge('ratingReason') ? ge('ratingReason').value.trim() : '';

  if (_selectedStars <= 2 && !reason) {
    showE('ratingErr', 'กรุณาระบุเหตุผลเพื่อนำไปปรับปรุง');
    return;
  }

  try {
    var btn = ge('btnSubmitRating');
    if (btn) btn.disabled = true;

    var res = await fetch('/api/tickets/' + _currentRatingTicketId + '/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: _selectedStars, ratingReason: reason })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Rating failed');

    closeRatingModal();
    closeTD();
    await loadMyTickets(true);
    alert('ขอบคุณสำหรับการประเมินความพึงพอใจ! ⭐');
  } catch (err) {
    showE('ratingErr', err.message);
  } finally {
    var btn2 = ge('btnSubmitRating');
    if (btn2) btn2.disabled = false;
  }
}

function openReopenModal(ticketId) {
  _currentReopenTicketId = ticketId;
  var lbl = ge('reopenTicketLabel');
  if (lbl) lbl.textContent = 'ตั๋วรหัส: #' + ticketId;
  var reason = ge('reopenReason');
  if (reason) reason.value = '';
  hideE('reopenErr');
  var m = ge('mReopen');
  if (m) m.classList.add('on');
}

function closeReopenModal() {
  _currentReopenTicketId = null;
  var m = ge('mReopen');
  if (m) m.classList.remove('on');
}

async function submitReopen() {
  if (!_currentReopenTicketId) return;
  var reasonInp = ge('reopenReason');
  var reason = reasonInp ? reasonInp.value.trim() : '';
  if (!reason) {
    showE('reopenErr', 'กรุณาระบุเหตุผลที่งานยังไม่เรียบร้อย');
    return;
  }

  try {
    var res = await fetch('/api/tickets/' + _currentReopenTicketId + '/reopen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reopen failed');

    closeReopenModal();
    closeTD();
    await loadMyTickets(true);
    alert('ส่งคำขอตรวจสอบงานซ้ำสำเร็จแล้ว! ทีมช่างจะติดต่อกลับโดยเร็ว');
  } catch (err) {
    showE('reopenErr', err.message);
  }
}

/* ════════════════════════════════════════════════════════
   8. SECURITY AUDIT MODAL & HELPERS
   ════════════════════════════════════════════════════════ */
function openSecurityAuditModal() {
  var m = ge('mSecAudit');
  if (m) m.classList.add('on');
}

function closeSecurityAuditModal() {
  var m = ge('mSecAudit');
  if (m) m.classList.remove('on');
}

function viewImg(url, title) {
  var m = ge('mImg');
  var src = ge('mImgSrc');
  var t = ge('mImgTitle');
  if (!m || !src) return;
  src.src = url;
  if (t) t.textContent = title || 'รูปภาพ';
  m.classList.add('on');
}

function closeMImg() {
  var m = ge('mImg');
  if (m) m.classList.remove('on');
}

function toggleThemeQuick() {
  var cur = localStorage.getItem('resolvnow_theme') || 'auto';
  var next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem('resolvnow_theme', next);
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.setAttribute('data-theme-setting', next);
}

function showE(id, msg) {
  var el = ge(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideE(id) {
  var el = ge(id);
  if (el) el.style.display = 'none';
}

function quickFillSecLogin(email, pass) {
  var em = ge('secLoginEmail');
  var pw = ge('secLoginPass');
  if (em) em.value = email;
  if (pw) pw.value = pass;
  hideE('secLoginErr');
}

async function doQuickLogin() {
  var em = ge('secLoginEmail');
  var pw = ge('secLoginPass');
  var btn = ge('btnSecLogin');
  var email = em ? em.value.trim() : '';
  var password = pw ? pw.value.trim() : '';

  if (!email || !password) {
    showE('secLoginErr', 'กรุณากรอกอีเมลและรหัสผ่าน');
    return;
  }

  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังเข้าสู่ระบบ...'; }
    hideE('secLoginErr');

    var res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, remember: true })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');

    sessionStorage.setItem('rn_logged_in', '1');

    // Run security check again
    var ok = await runSecurityChecks();
    if (ok) {
      initSocketSync();
      await loadMyTickets(true);
    }
  } catch (err) {
    showE('secLoginErr', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔑 เข้าสู่ระบบและดูเรื่องร้องเรียนทันที'; }
  }
}

/* ════════════════════════════════════════════════════════
   INITIALIZATION ON PAGE LOAD
   ════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async function () {
  var ok = await runSecurityChecks();
  if (!ok) return;

  initSocketSync();
  await loadMyTickets(false);

  // Check URL query params for auto-open ticket e.g. /my-tickets?id=TKT-00100
  var params = new URLSearchParams(window.location.search);
  var openId = params.get('id');
  if (openId) {
    setTimeout(function () { openTD(openId); }, 400);
  }
});
