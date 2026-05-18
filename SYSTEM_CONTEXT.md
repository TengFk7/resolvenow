# ResolveNow — System Context for AI Assistants
> อัปเดต: 2026-05-15 | Version: V16.4 (CEO UI + Direct Messages)

## ภาพรวม
ระบบเว็บแอปพลิเคชัน SPA รับแจ้งเรื่องร้องเรียนของเทศบาล/สมาร์ทซิตี้
- 3 บทบาท: **citizen** (ประชาชน), **technician** (ช่าง), **admin** (ผู้ดูแล)
- 1 read-only dashboard: **CEO** (ดูภาพรวมโดยไม่ต้อง login)
- Deploy: https://resolvenow-hlv5.onrender.com
- GitHub: https://github.com/TengFk7/resolvenow

---

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ + Express 4 |
| Database | MongoDB Atlas (mongoose 9) |
| Session | express-session + connect-mongo v6 |
| Auth | bcryptjs + OTP Email |
| Email | Nodemailer (Gmail App Password) + SendGrid (@sendgrid/mail) |
| Image Upload | Cloudinary v2 (fallback: local /uploads/) |
| LINE Notify | LINE Messaging API (Push Message / Flex) |
| LINE Login | LINE Login OAuth2 |
| LINE LIFF | LIFF 2.x (liff-rating.html) |
| Real-time | Socket.io v4 |
| AI | Anthropic Claude (/api/ai) + Gemini (GEMINI_API_KEY) |
| Frontend | Vanilla HTML/CSS/JS (SPA, no framework) |
| Dev | nodemon |

---

## Project Structure
```
ResolveNow/
├── server.js              ← Entry point
├── package.json
├── .env / .env.example
├── validateFlex.js        ← validate LINE Flex Message JSON
├── INSTALL.txt            ← คู่มือติดตั้ง
├── SYSTEM_CONTEXT.md      ← ไฟล์นี้ (AI context)
├── config/
│   ├── db.js              ← mongoose.connect (IPv4 forced, Google DNS)
│   ├── seed.js            ← seedDB() — admin + tech1-7 + citizen + seedCategories()
│   ├── cloudinary.js      ← Custom CloudinaryEngine (multer StorageEngine)
│   ├── mailer.js          ← nodemailer Gmail OTP sender
│   ├── lineNotify.js      ← LINE Messaging API push (608 lines, Flex Messages)
│   └── slaJob.js          ← SLA breach checker (ทุก 5 นาที) + chat cleanup (ทุก 1 ชั่วโมง)
├── models/
│   ├── User.js
│   ├── Ticket.js
│   ├── HelpRequest.js
│   ├── Category.js
│   ├── Comment.js
│   ├── Counter.js
│   └── DirectMessage.js   ← [NEW] citizen↔admin direct chat
├── routes/
│   ├── auth.js            ← /api/auth
│   ├── tickets.js         ← /api/tickets
│   ├── technicians.js     ← /api/technicians
│   ├── helpRequests.js    ← /api/help-requests
│   ├── ai.js              ← /api/ai (Anthropic Claude)
│   ├── categories.js      ← /api/categories
│   ├── track.js           ← /api/track (public)
│   ├── lineAuth.js        ← /auth/line (LINE Login OAuth callback)
│   ├── ceo.js             ← /api/ceo (read-only dashboard, no auth)
│   └── directMessages.js  ← /api/direct-messages (citizen↔admin DM)
├── data/
│   └── store.js           ← otpStore (in-memory Map), STATUSES array
├── scripts/
│   └── seedMockTickets.js
└── public/
    ├── index.html         ← SPA (~88KB)
    ├── track.html         ← Public ticket tracker (45KB, standalone)
    ├── liff-rating.html   ← LINE LIFF rating page (29KB)
    ├── data_dictionary.html ← ข้อมูลพจนานุกรม
    ├── css/
    │   ├── style.css      ← Main stylesheet (~104KB)
    │   └── animations.css ← Animation classes
    ├── js/
    │   ├── ui.js          ← Shared helpers
    │   ├── app.js         ← Global state, enterApp(), session resume
    │   ├── auth.js        ← 3D flip auth, OTP flow, LINE login
    │   ├── admin.js       ← Admin dashboard, charts, queue, categories
    │   ├── citizen.js     ← Citizen dashboard, submitTicket, GPS
    │   ├── technician.js  ← Tech dashboard, before/after upload
    │   └── directChat.js  ← [NEW] citizen↔admin DM chat UI
    └── uploads/           ← Local image fallback
```

---

## Database Models

### User
```js
{ firstName, lastName, email (unique), password (bcrypt),
  role: 'citizen'|'technician'|'admin',
  specialty: 'Road'|'Water'|'Electricity'|'Garbage'|'Animal'|'Tree'|'Hazard'|<custom>,
  lineUserId, lineDisplayName, avatar,
  createdViaLine: Boolean,
  timestamps }
```

### Ticket
```js
{ ticketId: 'TKT-00001',
  citizenId, citizenName, citizenLineId,
  category, description, location (reverse-geocoded),
  lat, lng,
  urgency: 'normal'|'medium'|'urgent',
  priorityScore: 30|60|90 (+10 keywords),
  status: 'pending'|'assigned'|'in_progress'|'completed'|'rejected',
  assignedTo, assignedName, rejectReason,
  citizenImage, beforeImage, afterImage,
  rating: 1-5, ratingReason, ratedAt,
  slaAssignDeadline, slaCompleteDeadline, slaBreached,
  upvotes: [{userId}], upvoteCount,
  followers: [{userId, lineUserId}], followerCount,
  chatExpiresAt,
  timestamps }
```

### HelpRequest
```js
{ helpId: 'HELP-001', citizenId, citizenName, message,
  status: 'open'|'resolved'|'accepted'|'cancelled',
  ticketId, ticketCategory, ticketLocation, ticketDesc,
  requesterId, requesterName, requesterDept, targetDept,
  acceptedById, acceptedByName, timestamps }
```

### Category
```js
{ name (unique key), label (ชื่อไทย), icon (emoji),
  technicianIds: [ref User],
  isDefault: Boolean,
  timestamps }
```

### Comment
```js
{ ticketId: String, userId: ref User, userName, userRole,
  message (max 500 chars), timestamps }
```

### Counter
```js
{ name: 'ticket'|'help', seq: Number }
// Counter.nextSeq('ticket') → auto-increment number
```

### DirectMessage (NEW)
```js
{ senderId: ref User, senderName, senderRole: 'citizen'|'admin',
  citizenId: ref User,  // always the citizen in the conversation
  message (max 500 chars),
  isRead: Boolean,
  timestamps }
// Index: { citizenId: 1, createdAt: 1 }
```

---

## API Routes

### Auth `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /send-otp | - | ส่ง OTP ทางอีเมล |
| POST | /register | - | ยืนยัน OTP + สร้าง citizen |
| POST | /login | - | login → session |
| POST | /logout | - | destroy session |
| GET | /me | - | current user (loggedIn: bool) |
| POST | /change-password | auth | เปลี่ยน password |
| GET | /line-pending | - | LINE profile ที่ค้าง |
| POST | /link-line | - | เชื่อม LINE กับบัญชีเดิม |
| POST | /link-line-skip | - | สร้าง LINE-only citizen (atomic upsert) |
| POST | /register-line | - | Step1: OTP สร้างบัญชีผูก LINE |
| POST | /verify-line-otp | - | Step2: ยืนยัน OTP + ผูก LINE |
| POST | /admin-unlink-line | admin | ลบ user LINE-linked + cascade |
| GET | /admin-linked-lines | admin | list users ที่มี LINE |
| POST | /admin-unlink-all | admin | ลบ users LINE ทั้งหมด + cascade |

### Tickets `/api/tickets`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | / | auth | list tickets (citizen=ตัวเอง, tech=specialty+assigned, admin=all) |
| POST | / | auth | สร้าง ticket + image upload + SLA deadlines |
| PUT | /:id/status | auth | เปลี่ยน status (TRANSITIONS matrix) |
| PUT | /:id/assign | admin | มอบหมายช่าง |
| POST | /:id/upload/before | tech | รูปก่อนซ่อม (status=assigned) |
| POST | /:id/upload/after | tech | รูปหลังซ่อม (status=in_progress) |
| PUT | /:id/rating | citizen | รีวิว 1-5 (status=completed) |
| PUT | /:id/rating/liff | public | LIFF rating (citizenLineId แทน session) |
| GET | /public/:id/rating-status | public | ตรวจ rated แล้วหรือยัง |
| GET | /search | optional | ค้นหา (q, status, category) |
| GET | /public-map | public | heatmap data (30 วัน, GPS, truncate 2 decimal) |
| GET | /report | admin | JSON report (this_month\|last_month) |
| GET | /report/excel | admin | Download .xlsx |
| GET | /export | admin | Download .csv |
| POST | /:id/upvote | auth | toggle upvote |
| POST | /:id/follow | auth | toggle follow |
| GET | /:id/comments | auth | ดึง comments |
| POST | /:id/comments | auth | ส่ง comment + socket emit |
| DELETE | /:id | admin | ลบ ticket + Cloudinary purge |
| DELETE | / | admin | ลบทั้งหมด (ต้องใส่ ADMIN_DELETE_PASSWORD) |

### CEO `/api/ceo` (NEW — read-only, no auth required)
| Method | Path | Description |
|---|---|---|
| GET | /tickets | ดึง tickets ทั้งหมด (read-only, SLA eval, ไม่มี PII ละเอียด) |
| GET | /technicians | ดึงช่างทั้งหมด + workload/capacity |
| GET | /categories | ดึงหมวดหมู่ (name, label) |

### Direct Messages `/api/direct-messages` (NEW)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | / | citizen | ประวัติแชตของตัวเอง (limit 200) + mark admin msgs as read |
| GET | /unread-count | citizen | นับ admin msgs ที่ยังไม่อ่าน |
| GET | /all | admin | list การสนทนาทั้งหมด + unread count per citizen |
| GET | /admin-unread | admin | total unread count จาก citizens |
| GET | /:citizenId | admin | ประวัติแชตกับ citizen คนนั้น + mark as read |
| POST | / | auth | ส่งข้อความ (citizen→admin หรือ admin→citizen) + socket emit |

### Categories `/api/categories`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | / | public | ดึงหมวดหมู่ + technician names |
| POST | / | admin | สร้างหมวดหมู่ใหม่ |
| PUT | /:id | admin | แก้ไข label/icon |
| PUT | /:id/technicians | admin | ผูก/ลบช่าง (อัปเดต specialty User ด้วย) |
| DELETE | /:id | admin | ลบ (ป้องกันถ้ามี active ticket) |

### Other Routes
| Path | Description |
|---|---|
| POST /api/track | Public ticket lookup (ticketId → location/status/category only) |
| GET /api/technicians | list techs + activeJobs/capacity/statusLabel |
| GET /api/help-requests | list all help requests |
| POST /api/help-requests | tech ขอความช่วยเหลือ |
| PUT /api/help-requests/:id/accept | tech รับงาน |
| PUT /api/help-requests/:id/cancel | tech ยกเลิก |
| GET / | index.html (SPA) |
| GET /track | track.html (public standalone) |
| GET /liff-rating | inject LIFF_ID → serve liff-rating.html |
| GET /auth/line/callback | LINE Login OAuth callback |

---

## Frontend JS Modules

### Global State (app.js)
```js
var CU = null;               // Current User object
var currentPage = 'dashboard';
var upId = null;             // upload ticket ID
var upType = null;           // 'before'|'after'
var helpTicketId = null;
var _adminInterval = null;
var _ticketsInterval = null;
var _helpInterval = null;
var _socketConnected = false;
var _heartbeatTimer = null;
var _pongTimer = null;
```

### Page Flow
1. Splash (1.85s) → fade → card-enter (LINE callback → skip splash)
2. IIFE → `/api/auth/me` → if session → `enterApp()`
3. `enterApp()`: showWelcomeSplash(3.8s) → loadCategories() → role routing
   - admin → adminApp + loadAdmin() + setInterval(30s)
   - citizen/tech → normalApp + loadTickets() + setInterval(30s)
   - citizen → showDmCloudFab() (DM FAB button)
   - tech → loadHelpRequests() + setInterval(30s)

### Socket.io Events
- `ticket_updated` → loadTickets() + loadAdmin()
- `comment_added` → append to chat if open
- `dm_message` → DM real-time (citizen: append or badge; admin: bell badge or thread append)
- Heartbeat: `ping_heartbeat` ทุก 15 วิ → `pong_heartbeat`
- Socket rooms: `admin_dm`, `citizen_dm_<citizenId>`

### Shared Helpers (ui.js — key functions)
```js
ge(id)                    // getElementById shorthand
showToast(msg, type)      // 'success'|'error'|'warning'
showE(id, msg) / hideE(id)
stTH(status)              // 'pending' → 'รอดำเนินการ'
statusBadge(status)       // HTML span with dot emoji
pLabel(score)             // priority badge: 🔴≥70, 🟡≥40, 🟢<40
viewImg(src, title)       // open image modal #mImg
imgThumb(url, label)      // <img class="img-thumb">
animateNum(el, target)    // animated counter (20 steps)
startClock()              // live clock #topbarClock
escapeHTML(str)           // XSS prevention
DEPT / DEPT_ICON          // dynamic from /api/categories
loadCategories()          // fetch → update DEPT, DEPT_ICON, selects, catGrid
openDrawer() / closeDrawer()
cgDropToggle() / cgDropPick()
formatSlaCountdown(deadline) → { text, cls }
slaLabel(ticket)          // SLA badge HTML
toggleUpvote(btn) / toggleFollow(btn)
openTicketChat(ticketId) / closeTicketChat()
loadComments(ticketId) / sendComment()
loadHeatmap()             // Leaflet.js heatmap
```

### DirectChat (directChat.js — NEW)
```js
// Citizen side
showDmCloudFab() / hideDmCloudFab()
refreshDmUnreadBadge()    // poll /api/direct-messages/unread-count
openDirectChat() / closeDirectChat()
loadDirectMessages()
sendDirectMessage()

// Admin side
refreshAdminDmUnread()    // poll /api/direct-messages/admin-unread
openAdminDmInbox() / closeAdminDmInbox()
loadAdminDmInbox()        // list all citizen conversations
openAdminDmThread(citizenId, name, avatar, initials)
sendAdminDmReply()

// Socket handler
_handleIncomingDm(msg)    // routes to citizen or admin handler
```

---

## Environment Variables
```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/resolvenow

# Session
SESSION_SECRET=random-string

# Email (dual: nodemailer Gmail + SendGrid)
MAIL_USER=resolvnow@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx     # Gmail App Password
SENDGRID_API_KEY=SG.xxx           # SendGrid HTTP API

# LINE Messaging API
LINE_CHANNEL_TOKEN=lOIBePr...
LINE_ADMIN_USER_ID=U23f8ef...

# LINE Login OAuth2
LINE_LOGIN_CLIENT_ID=2009559224
LINE_LOGIN_CLIENT_SECRET=1700c11d...
LINE_LOGIN_CALLBACK_URL=https://resolvenow-hlv5.onrender.com/auth/line/callback

# LINE LIFF
LINE_LIFF_ID=xxxx-xxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=dfal0ismt
CLOUDINARY_API_KEY=532996767357286
CLOUDINARY_API_SECRET=1VR78AFU...

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=https://aistudio.google.com/  ← ยังไม่ตั้งค่า

# App
BASE_URL=https://resolvenow-hlv5.onrender.com
PORT=3000
```

---

## Seeded Accounts (auto-created on first boot)
| Role | Email | Password | Name |
|---|---|---|---|
| Admin | admin@resolvenow.th | admin1234 | Admin Dispatcher |
| Tech 1 (Road) | tech1@resolvenow.th | tech1234 | วิชัย โยธา |
| Tech 2 (Water) | tech2@resolvenow.th | tech1234 | มานะ ประปา |
| Tech 3 (Electricity) | tech3@resolvenow.th | tech1234 | สมชาย ไฟฟ้า |
| Tech 4 (Garbage) | tech4@resolvenow.th | tech1234 | สุรัตน์ สุขา |
| Tech 5 (Animal) | tech5@resolvenow.th | tech1234 | บุญมี ปราบ |
| Tech 6 (Tree) | tech6@resolvenow.th | tech1234 | สมศรี ป่าไม้ |
| Tech 7 (Hazard) | tech7@resolvenow.th | tech1234 | อนันต์ กู้ภัย |
| Citizen (dev) | tenginpb@gmail.com | 123456 | Teng Teng |

**Delete All Tickets password**: `admin1234`

---

## Default Categories (7 หมวด — โหลดจาก DB ผ่าน /api/categories)
| Key | ไทย | Icon |
|---|---|---|
| Road | ถนน/ทางเท้า | 🚧 |
| Water | ท่อแตก/น้ำไม่ไหล | 💧 |
| Electricity | ไฟฟ้าสาธารณะดับ | 💡 |
| Garbage | ขยะตกค้าง | 🗑️ |
| Animal | สัตว์มีพิษ/จรจัด | 🐾 |
| Tree | กิ่งไม้วางทาง | 🌳 |
| Hazard | เพลิง/ภัยพิบัติ | 🔥 |

---

## Priority Score Logic
```
urgency=urgent → 90 | medium → 60 | normal → 30
keywords (flood/fire/อันตราย/เร่งด่วน/น้ำท่วม/ฉุกเฉิน) → +10 (max 100)
upvotes ≥ 10 → override 100
upvotes ≥ 5 → +15 (capped 100)
Display: ≥70 🔴 | ≥40 🟡 | <40 🟢
```

---

## SLA Rules
| Urgency | Assign Deadline | Complete Deadline |
|---|---|---|
| urgent | 2 hours | 8 hours |
| medium | 8 hours | 48 hours |
| normal | 24 hours | 72 hours |

SLA computed at ticket creation. `slaJob.js` runs every 5 min → `slaBreached: true`.
Chat cleanup job runs every 1 hour → removes expired comments.

---

## Status Transition Matrix
| From | Tech Can → | Admin Can → |
|---|---|---|
| pending | assigned | assigned, rejected |
| assigned | in_progress, rejected | in_progress, completed, rejected, pending |
| in_progress | completed, rejected | completed, rejected, assigned |
| completed | — | in_progress (reopen) |
| rejected | — | pending (revert) |

Tech IDOR guard: tech ต้องเป็น `assignedTo` ของ ticket (atomic `findOneAndUpdate`)

---

## LINE Integration
### Push Notifications (Flex Messages)
- `notifyNewTicket(ticket)` → admin + citizen
- `notifyAssigned()` → **disabled** (empty function)
- `notifyInProgress(ticket)` → admin + citizen
- `notifyCompleted(ticket)` → admin (before/after images) + citizen (LIFF rating link)
- `notifyRejected(ticket, reason)` → admin + citizen
- `notifyFollowers(ticket, newStatus)` → all followers with lineUserId

### LINE Login Flow
- `/auth/line/callback` → session → redirect `/`
- Error params: `?line_error=cancelled|invalid_state|token_failed|profile_failed|server_error`
- Link pending: `?line_link=pending`
- Login success: `?line_login=success`

### LIFF Rating
- Route `/liff-rating` injects `window.__LIFF_ID__` → serve liff-rating.html
- ประชาชนให้ดาวผ่าน LINE โดยไม่ต้อง login

---

## Image Upload Flow
- Custom `CloudinaryEngine` (multer StorageEngine ใน config/cloudinary.js)
- Folder: `resolvenow/`, resize: max 1280px, quality: auto, max 10MB
- URL = `req.file.path` (secure_url), public_id = `req.file.filename`
- Fallback: local `/public/uploads/` max 5MB
- Allowed MIME: jpg, png, gif, webp
- `purgeTicketImages(tickets[])` → Cloudinary destroy with Promise.allSettled
- Rollback: DB save fail → cloudinary.uploader.destroy(public_id)

---

## Security
- `helmet` (CSP ปิด — inline scripts ยังใช้ใน index.html)
- `express-mongo-sanitize` (NoSQL injection)
- `xss` library sanitize ทุก user text ก่อน save
- Rate limits:
  - authLimiter: 30 req/15min
  - OTP: 5 ครั้ง/15min per IP+email
  - pollingLimiter: 1500 GET/5min
  - apiLimiter: 300 write/5min
- `escapeHTML()` ใน ui.js ใช้กับทุก HTML render
- Cascade delete: tickets, comments, upvotes, followers, Cloudinary images

---

## DNS Fix (Important)
`server.js` overrides DNS → Google (8.8.8.8, 8.8.4.4, 1.1.1.1) ก่อน require ใดๆ
mongoose.connect force IPv4 (`family: 4`) + monkey-patch `dns.lookup`

---

## Run Commands
```bash
npm run dev    # nodemon (development)
npm start      # node server.js (production)

# URLs
http://localhost:3000           ← SPA (login/app)
http://localhost:3000/track     ← public ticket tracker
http://localhost:3000/liff-rating ← LIFF rating
```

---

## Known Patterns & Critical Notes
1. **Admin Animation**: ห้ามใส่ CSS animation ที่ reset opacity บน elements ที่ re-render ทุก 30 วิ — ใช้ one-time `page-enter` class
2. **Admin Pages**: dashboard | queue | techs | categories (showPage() ใน ui.js)
3. **CEO Dashboard**: อยู่ที่ `/api/ceo/*` — read-only, ไม่ต้อง auth — ใช้สำหรับ public stats
4. **Direct Messages**: citizen↔admin เท่านั้น (tech ไม่มีสิทธิ์). Socket rooms: `admin_dm` / `citizen_dm_<id>`
5. **Dynamic Categories**: DEPT/DEPT_ICON โหลดจาก DB ทุกครั้ง enterApp() ถูกเรียก
6. **Upvote/Follow**: toggle pattern — atomic $addToSet/$pull ป้องกัน race
7. **Ticket Chat**: ใช้ Comment model (ไม่ใช่ DirectMessage). chatExpiresAt = 24h หลัง completed
8. **Socket Adaptive Polling**: `_socketConnected=true` → ข้าม poll interval
9. **Heartbeat**: ping ทุก 15 วิ → pong ภายใน 5 วิ (ไม่ได้รับ = reconnect + poll)
10. **ADMIN_DELETE_PASSWORD**: ตรวจฝั่ง server (env var fallback `admin1234`)
11. **Email Dual**: ระบบมีทั้ง nodemailer (Gmail) และ SendGrid แต่ละ route อาจใช้ต่างกัน ตรวจ mailer.js
12. **TicketId Format**: `TKT-00001` (5 หลัก, Counter auto-increment)
13. **HelpId Format**: `HELP-001` (Counter auto-increment)
