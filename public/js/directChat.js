/* ─────────────────────────────────────────────────────────
   public/js/directChat.js
   Citizen Direct Chat with Admin + Admin DM Inbox
   ───────────────────────────────────────────────────────── */

/* ════════════════════════════════════════════════════════
   CITIZEN SIDE — Cloud FAB + Chat Modal
════════════════════════════════════════════════════════ */
var _dmChatOpen = false;
var _dmMsgIds = {};       // track rendered msg IDs to prevent duplicates
var _dmUnreadCount = 0;

/* ── Show Cloud FAB (called after citizen login) ─────── */
function showDmCloudFab() {
  var fab = ge('dmCloudFab');
  if (fab) fab.style.display = 'flex';
  refreshDmUnreadBadge();
}

function hideDmCloudFab() {
  var fab = ge('dmCloudFab');
  if (fab) fab.style.display = 'none';
}

/* ── Poll unread count for citizen ──────────────────── */
async function refreshDmUnreadBadge() {
  try {
    var res = await fetch('/api/direct-messages/unread-count');
    if (!res.ok) return;
    var data = await res.json();
    _dmUnreadCount = data.count || 0;
    _updateDmCloudBadge(_dmUnreadCount);
  } catch (e) { /* silently fail */ }
}

function _updateDmCloudBadge(count) {
  var badge = ge('dmCloudBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* ── Open Citizen Chat Modal ─────────────────────────── */
function openDirectChat() {
  var overlay = ge('mDirectChat');
  if (!overlay) return;
  overlay.classList.add('on');
  _dmChatOpen = true;
  // Reset unread badge since user is reading now
  _updateDmCloudBadge(0);
  loadDirectMessages();
  setTimeout(function () {
    var input = ge('dmInput');
    if (input) input.focus();
  }, 350);
}

/* ── Close Citizen Chat Modal ────────────────────────── */
function closeDirectChat() {
  var overlay = ge('mDirectChat');
  if (overlay) overlay.classList.remove('on');
  _dmChatOpen = false;
}

/* ── Load Direct Message History (Citizen) ───────────── */
async function loadDirectMessages() {
  var msgEl = ge('dmMessages');
  if (!msgEl) return;
  try {
    var res = await fetch('/api/direct-messages');
    if (!res.ok) return;
    var messages = await res.json();
    _dmMsgIds = {};
    if (!messages.length) {
      msgEl.innerHTML = '<div class="dm-empty">💬 ยังไม่มีข้อความ — เริ่มพิมพ์เพื่อติดต่อ Admin ได้เลย!</div>';
      return;
    }
    msgEl.innerHTML = '';
    messages.forEach(function (m) { _appendDmMessage(m, false); });
    msgEl.scrollTop = msgEl.scrollHeight;
  } catch (e) { console.error('[DM]', e); }
}

/* ── Append a single DM bubble ──────────────────────── */
function _appendDmMessage(m, animated) {
  if (_dmMsgIds[m._id]) return;
  _dmMsgIds[m._id] = true;

  var msgEl = ge('dmMessages');
  if (!msgEl) return;

  // Remove empty placeholder
  var empty = msgEl.querySelector('.dm-empty');
  if (empty) empty.remove();

  var isCitizen = m.senderRole === 'citizen';
  var div = document.createElement('div');
  div.className = 'dm-bubble ' + (isCitizen ? 'dm-bubble-citizen' : 'dm-bubble-admin');
  if (!animated) div.style.animation = 'none';

  var time = '';
  if (m.createdAt) {
    var d = new Date(m.createdAt);
    time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  div.innerHTML =
    (!isCitizen ? '<div class="dm-bubble-name">👨‍💼 ' + escapeHTML(m.senderName) + '</div>' : '') +
    '<div>' + escapeHTML(m.message) + '</div>' +
    '<div class="dm-bubble-time">' + time + '</div>';

  msgEl.appendChild(div);
  msgEl.scrollTop = msgEl.scrollHeight;
}

/* ── Send Direct Message (Citizen → Admin) ───────────── */
async function sendDirectMessage() {
  var input = ge('dmInput');
  var btn = ge('dmSendBtn');
  if (!input || !btn) return;
  var msg = input.value.trim();
  if (!msg) return;

  btn.disabled = true;
  input.value = '';

  try {
    var res = await fetch('/api/direct-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    var data = null;
    try { data = await res.json(); } catch (e) { }
    if (!res.ok) {
      showToast((data && data.error) || 'ส่งไม่สำเร็จ', 'error');
      input.value = msg; // restore
    } else if (data && data._id) {
      _appendDmMessage(data, true);
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาด', 'error');
    input.value = msg;
  }
  btn.disabled = false;
  input.focus();
}

/* ── Receive real-time DM from Admin (socket) ─────────── */
function _handleIncomingDm(m) {
  if (!window.CU) return;

  if (window.CU.role === 'citizen') {
    // Citizen received admin reply
    if (_dmChatOpen) {
      // Modal open → append directly
      _appendDmMessage(m, true);
    } else {
      // Modal closed → update badge
      _dmUnreadCount++;
      _updateDmCloudBadge(_dmUnreadCount);
    }
  } else if (window.CU.role === 'admin') {
    // Admin received citizen message
    _updateAdminDmBellBadge(true);
    // If admin inbox thread open for this citizen → append
    if (_dmAdminCurrentCitizenId && String(m.citizenId) === String(_dmAdminCurrentCitizenId)) {
      _appendAdminDmMessage(m, true);
    }
  }
}


/* ════════════════════════════════════════════════════════
   ADMIN SIDE — DM Inbox + Thread
════════════════════════════════════════════════════════ */
var _dmAdminCurrentCitizenId = null;
var _dmAdminMsgIds = {};
var _dmAdminUnread = 0;

/* ── Poll admin unread count ─────────────────────────── */
async function refreshAdminDmUnread() {
  try {
    var res = await fetch('/api/direct-messages/admin-unread');
    if (!res.ok) return;
    var data = await res.json();
    _dmAdminUnread = data.count || 0;
    _updateAdminDmBellBadge(false);
  } catch (e) { /* silently fail */ }
}

function _updateAdminDmBellBadge(forceShow) {
  var badge = ge('dmAdminBellBadge');
  if (!badge) return;
  if (forceShow || _dmAdminUnread > 0) {
    if (!forceShow) badge.textContent = _dmAdminUnread > 99 ? '99+' : _dmAdminUnread;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* ── Open Admin DM Inbox Modal ───────────────────────── */
function openAdminDmInbox() {
  var modal = ge('mAdminDmInbox');
  if (!modal) return;
  showDmInboxList(); // always start from list
  modal.classList.add('on');
  loadAdminDmInbox();
}

function closeAdminDmInbox() {
  var modal = ge('mAdminDmInbox');
  if (modal) modal.classList.remove('on');
  _dmAdminCurrentCitizenId = null;
  _dmAdminMsgIds = {};
}

/* ── Load Admin Inbox List ───────────────────────────── */
async function loadAdminDmInbox() {
  var listEl = ge('dmAdminInboxList');
  var subtitleEl = ge('dmInboxSubtitle');
  if (!listEl) return;

  try {
    var res = await fetch('/api/direct-messages/all');
    if (!res.ok) return;
    var items = await res.json();

    // Reset admin bell
    _dmAdminUnread = items.reduce(function (sum, i) { return sum + (i.unreadCount || 0); }, 0);
    _updateAdminDmBellBadge(false);

    if (subtitleEl) subtitleEl.textContent = items.length + ' การสนทนา';

    if (!items.length) {
      listEl.innerHTML = '<div class="dm-empty" style="padding:28px">📭 ยังไม่มีข้อความจากประชาชน</div>';
      return;
    }

    listEl.innerHTML = '';
    items.forEach(function (item) {
      var citizen = item.citizen || {};
      var name = [citizen.firstName, citizen.lastName].filter(Boolean).join(' ') || 'ไม่ทราบชื่อ';
      var initials = (citizen.firstName ? citizen.firstName[0] : '?').toUpperCase();
      var avatarHtml = citizen.avatar
        ? '<img src="' + escapeHTML(citizen.avatar) + '" alt="" />'
        : escapeHTML(initials);

      var timeStr = '';
      if (item.lastAt) {
        var d = new Date(item.lastAt);
        timeStr = d.toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
      }

      var div = document.createElement('div');
      div.className = 'dm-inbox-item';
      div.setAttribute('data-citizen-id', item.citizenId);
      div.setAttribute('data-citizen-name', name);
      div.setAttribute('data-citizen-avatar', citizen.avatar || '');
      div.setAttribute('data-citizen-initials', initials);
      div.innerHTML =
        '<div class="dm-inbox-avatar">' + avatarHtml + '</div>' +
        '<div class="dm-inbox-info">' +
          '<div class="dm-inbox-name">' + escapeHTML(name) + '</div>' +
          '<div class="dm-inbox-preview">' +
            (item.lastSenderRole === 'citizen' ? '' : '👨‍💼 คุณ: ') +
            escapeHTML(item.lastMessage || '') +
          '</div>' +
        '</div>' +
        '<div class="dm-inbox-meta">' +
          '<div class="dm-inbox-time">' + timeStr + '</div>' +
          (item.unreadCount > 0 ? '<div class="dm-inbox-unread">' + item.unreadCount + '</div>' : '') +
        '</div>';

      div.onclick = function () {
        var cid = this.getAttribute('data-citizen-id');
        var cname = this.getAttribute('data-citizen-name');
        var cavatar = this.getAttribute('data-citizen-avatar');
        var cinit = this.getAttribute('data-citizen-initials');
        openAdminDmThread(cid, cname, cavatar, cinit);
      };
      listEl.appendChild(div);
    });
  } catch (e) {
    console.error('[AdminDM]', e);
  }
}

/* ── Show inbox list view ────────────────────────────── */
function showDmInboxList() {
  var inboxView = ge('dmAdminInboxView');
  var threadView = ge('dmAdminThreadView');
  if (inboxView) inboxView.style.display = 'block';
  if (threadView) threadView.style.display = 'none';
  _dmAdminCurrentCitizenId = null;
  _dmAdminMsgIds = {};
}

/* ── Open thread with a specific citizen ─────────────── */
async function openAdminDmThread(citizenId, citizenName, avatarUrl, initials) {
  _dmAdminCurrentCitizenId = citizenId;
  _dmAdminMsgIds = {};

  // Switch view
  var inboxView = ge('dmAdminInboxView');
  var threadView = ge('dmAdminThreadView');
  if (inboxView) inboxView.style.display = 'none';
  if (threadView) threadView.style.display = 'flex';

  // Set header
  var nameEl = ge('dmThreadName');
  if (nameEl) nameEl.textContent = citizenName || 'ประชาชน';
  var avEl = ge('dmThreadAvatar');
  if (avEl) {
    avEl.innerHTML = avatarUrl
      ? '<img src="' + escapeHTML(avatarUrl) + '" alt="" />'
      : escapeHTML((initials || '?').toUpperCase());
  }

  // Load messages
  var msgEl = ge('dmAdminMessages');
  if (msgEl) msgEl.innerHTML = '<div class="dm-empty">⏳ กำลังโหลด...</div>';

  try {
    var res = await fetch('/api/direct-messages/' + encodeURIComponent(citizenId));
    if (!res.ok) return;
    var messages = await res.json();

    if (!msgEl) return;
    if (!messages.length) {
      msgEl.innerHTML = '<div class="dm-empty">💬 ยังไม่มีข้อความในการสนทนานี้</div>';
      return;
    }
    msgEl.innerHTML = '';
    messages.forEach(function (m) { _appendAdminDmMessage(m, false); });
    msgEl.scrollTop = msgEl.scrollHeight;

    // Refresh badge counts
    refreshAdminDmUnread();
    loadAdminDmInbox();
  } catch (e) {
    console.error('[AdminDM Thread]', e);
  }

  // Focus input
  setTimeout(function () {
    var input = ge('dmAdminInput');
    if (input) input.focus();
  }, 200);
}

/* ── Append message in admin thread view ─────────────── */
function _appendAdminDmMessage(m, animated) {
  if (_dmAdminMsgIds[m._id]) return;
  _dmAdminMsgIds[m._id] = true;

  var msgEl = ge('dmAdminMessages');
  if (!msgEl) return;
  var empty = msgEl.querySelector('.dm-empty');
  if (empty) empty.remove();

  var isCitizen = m.senderRole === 'citizen';
  var div = document.createElement('div');
  // In admin view: citizen messages on LEFT (admin-style bubble), admin replies on RIGHT (citizen-style)
  div.className = 'dm-bubble ' + (isCitizen ? 'dm-bubble-admin' : 'dm-bubble-citizen');
  if (!animated) div.style.animation = 'none';

  var time = '';
  if (m.createdAt) {
    var d = new Date(m.createdAt);
    time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  div.innerHTML =
    (isCitizen ? '<div class="dm-bubble-name">👤 ' + escapeHTML(m.senderName) + '</div>' : '') +
    '<div>' + escapeHTML(m.message) + '</div>' +
    '<div class="dm-bubble-time">' + time + '</div>';

  msgEl.appendChild(div);
  msgEl.scrollTop = msgEl.scrollHeight;
}

/* ── Admin: Send Reply ───────────────────────────────── */
async function sendAdminDmReply() {
  if (!_dmAdminCurrentCitizenId) return;
  var input = ge('dmAdminInput');
  var btn = ge('dmAdminSendBtn');
  if (!input || !btn) return;
  var msg = input.value.trim();
  if (!msg) return;

  btn.disabled = true;
  input.value = '';

  try {
    var res = await fetch('/api/direct-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, citizenId: _dmAdminCurrentCitizenId })
    });
    var data = null;
    try { data = await res.json(); } catch (e) { }
    if (!res.ok) {
      showToast((data && data.error) || 'ส่งไม่สำเร็จ', 'error');
      input.value = msg;
    } else if (data && data._id) {
      _appendAdminDmMessage(data, true);
    }
  } catch (e) {
    showToast('เกิดข้อผิดพลาด', 'error');
    input.value = msg;
  }
  btn.disabled = false;
  input.focus();
}
