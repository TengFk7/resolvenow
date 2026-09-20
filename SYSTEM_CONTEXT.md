# ResolveNow — System Context for AI Assistants
> อัปเดตล่าสุด: 2026-09-20 | Version: V18.2 (Triple-Provider Mailer, Server-side Gate API, Cognitive Thai NLP Heuristics, District Analytics, Dedicated My-Tickets Portal, Chronological Admin Queue & Real-time Today Metrics, Automated Verification Test Suite)

## ภาพรวมระบบ (System Overview)
**ResolveNow** คือระบบบริหารจัดการและติดตามเรื่องร้องเรียนอัจฉริยะ (Smart City Complaint & Work Order Management Platform) ที่ออกแบบขึ้นเพื่อยกระดับการให้บริการขององค์กรปกครองส่วนท้องถิ่นและเทศบาลยุคใหม่ เชื่อมโยง 4 บทบาทหลักอย่างไร้รอยต่อผ่านสถาปัตยกรรม **Dedicated Multi-Portal Architecture**:

1. **Citizen Portal (`/`)** — ประชาชน: แจ้งเรื่องร้องเรียน 5 ขั้นตอน ระบุพิกัด GPS แม่นยำ (Reverse Geocoding), ติดตามสถานะเรียลไทม์, ตรวจสอบแผนที่ความหนาแน่นปัญหา (Heatmap), โหวต/ติดตามปัญหาทาง LINE, ยื่นเรื่องขอเปิดงานใหม่ (Re-open), และสนทนาแบบเรียลไทม์กับเจ้าหน้าที่
2. **My Tickets Dedicated Portal (`/my-tickets`, `/tickets/my`)** — หน้าต่างเว็บแยกเรื่องร้องเรียนของฉัน: ตรวจสอบความปลอดภัย 6 ชั้น (Session, Role, IDOR Isolation, XSS Neutralizer, Rate Limiter, Socket Handshake), แสดงรายการตั๋วทั้งหมดของผู้ใช้แบบเรียลไทม์, ตัวกรองสถานะ, ค้นหา, แชทกับช่าง และประเมินดาว
3. **Admin Management Portal (`/admin`)** — ผู้ดูแลระบบ: ศูนย์บัญชาการและกระจายงาน (Dispatching Hub), บริหารจัดการคิวงาน, มอบหมายงานให้ช่างตามความเชี่ยวชาญและภาระงาน (Workload Capacity), อนุมัติการขอพักเวลา SLA, ตรวจจับและรวมตั๋วซ้ำซ้อน (Merge Tickets), กล่องข้อความกลาง (Unified DM Inbox), จัดการหมวดหมู่ไดนามิก, เครื่องมือทดสอบและวินิจฉัยระบบอีเมล (Admin Mail Diagnostics), และดาวน์โหลดรายงาน (.xlsx, .csv)
4. **Technician Field Ops Portal (`/tech`, `/technician`)** — ช่างและเจ้าหน้าที่ภาคสนาม: หน้าปฏิบัติงานเฉพาะช่างแต่ละคน, การรับงาน, นำทางไปยังพิกัด, บันทึกภาพถ่ายก่อนและหลังการซ่อม (Before/After Photos สูงสุด 5 ภาพ), บันทึกรายการวัสดุและค่าใช้จ่ายซ่อมบำรุง (Material & Cost Tracking), ขอความช่วยเหลือข้ามแผนก (Cross-dept Help Request), ขอพักเวลา SLA เมื่อรออะไหล่ และส่งมอบงานพร้อมลายเซ็นดิจิทัล (Digital Work Order)
5. **CEO Executive Dashboard (`/ceo`)** — ผู้บริหารระดับสูง: แดชบอร์ดสรุปสถิติผลการดำเนินงานแบบเรียลไทม์, ดัชนีชี้วัด SLA Compliance, สรุปงบประมาณและค่าใช้จ่ายในการซ่อมบำรุงประจำเดือน (Monthly Budget & Repair Cost Breakdown), การวิเคราะห์เชิงพื้นที่และงบประมาณแยกตามเขต/แขวง (District Analytics), สินค้า/วัสดุที่มีการเบิกใช้สูงสุด 5 อันดับแรก พร้อมโหมดนำเสนอ (Presentation Mode) โดยมีการปกปิดข้อมูลส่วนบุคคล (Masked PII) เพื่อความปลอดภัยตามหลัก PDPA
6. **Public Complaint Tracker (`/track`)** — ระบบค้นหาและติดตามสถานะสำหรับประชาชนทั่วไป: ค้นหาด้วยรหัส Ticket ID เพื่อดูขั้นตอนการดำเนินงานโดยไม่ต้องล็อกอิน (Masked PII)
7. **Data Dictionary (`/Datadic`)** — พจนานุกรมข้อมูลระบบ: เอกสารจำลองฐานข้อมูลที่ต้องยืนยันตัวตนด้วยบัญชี Admin
8. **Project Poster (`/project`)** — หน้าโปสเตอร์ดิจิทัลนำเสนอโครงการระดับผู้บริหาร
9. **Health Check API (`/health`, `/api/health`)** — ตรวจสอบ Uptime และความพร้อมของฐานข้อมูล MongoDB

- **Production URL**: https://resolvenow-hlv5.onrender.com
- **GitHub Repository**: https://github.com/TengFk7/resolvenow

---

## สถาปัตยกรรมความปลอดภัยของพอร์ทัล (Portal Security Gate Architecture)

เพื่อป้องกันการเข้าถึงหน้าจัดการของผู้ดูแลระบบ ช่างภาคสนาม และผู้บริหารโดยไม่ได้รับอนุญาต ระบบใช้สถาปัตยกรรม **Dual-Layer Security Gate**:

- **Gate Passcode กลาง**: **`@Teng11421142`** (รองรับ Fallback Passcode ประจำสิทธิ์ เช่น `admin1234` สำหรับแอดมิน หรือ `tech1234` สำหรับช่าง)
- **Server-Side Verification APIs (`routes/auth.js`)**:
  - `POST /api/auth/gate-verify`: ยืนยัน Passcode ที่ส่งมาจาก Client มีระบบป้องกัน Brute-force จำกัดความผิดพลาดสูงสุด 5 ครั้งต่อ 15 นาที เมื่อผ่านจะบันทึกสิทธิ์ลงใน Session (`req.session.gateUnlocked[portal] = true`)
  - `GET /api/auth/gate-status`: ตรวจสอบสถานะการปลดล็อคของ Portal ในเซสชันปัจจุบัน
  - `POST /api/auth/gate-lock`: สั่งล็อคหน้าต่างความปลอดภัยใน Session ทันทีเมื่อผู้ใช้ออกจากหน้าจอ
- **Client-Side UX & Animations**:
  - การ์ดใส่ Passcode แบบ Glassmorphism 3D พร้อมแอนิเมชันสั่นเตือน (`gate-shake`) เมื่อรหัสผิด
  - Loading Overlay นุ่มนวลเพื่อปกปิด Dashboard ไม่ให้กระตุกก่อนเรนเดอร์เสร็จ

---

## Tech Stack

| เลเยอร์ | เทคโนโลยี | รายละเอียด |
|---|---|---|
| **Runtime & Backend** | Node.js (v18+) + Express 4 | RESTful APIs, Dedicated Portals, Rate Limiters, Graceful Shutdown |
| **Database** | MongoDB Atlas + Mongoose 9 | Cloud NoSQL, Compound Indexes, Cascade Deletions, Lean Projections |
| **Session Store** | express-session + connect-mongo v6 | เซสชันเก็บใน MongoDB (`ttl: 7 days`, `touchAfter: 24h`, shared with Socket.IO) |
| **Authentication** | bcryptjs (10 rounds) + OTP Email + LINE Login | เข้าสู่ระบบด้วยรหัสผ่าน, OTP ยืนยันอีเมล 6 หลัก (5 นาที), LINE OAuth2 |
| **Email Service** | Triple-Provider Resilient Architecture | 1. Nodemailer (Gmail SSL 465/TLS 587) 2. SendGrid API 3. Resend API พร้อมเครื่องมือทดสอบเมล |
| **Cloud Storage** | Cloudinary (v2) + Custom Multer Engine | อัปโหลดรูปภาพ ปรับขนาดอัตโนมัติ (max 1280px, auto quality), Local Fallback: `/public/uploads/` |
| **LINE Integration** | LINE Messaging API + LINE Login + LINE LIFF | Push Notifications (Flex Messages), LINE Login OAuth2, LIFF 2.x สำหรับรีวิว |
| **Real-time Engine** | Socket.IO v4 | Two-way events, DM Rooms, Ticket Status synchronization, Comments, Heartbeat ping-pong |
| **AI & NLP Intelligence** | Anthropic Claude + Google Gemini + Cognitive Thai NLP | Cognitive Thai NLP Heuristics Engine (5-Layer Classification) แม่นยำ 100% บน 134 Few-shot test cases |
| **Frontend** | Vanilla HTML5 / Modern CSS3 / JavaScript (ES6+) | ไร้ Framework หนัก, Glassmorphism, 3D CSS Transitions, Mobile-First Design Tokens |
| **Mapping & GIS** | Leaflet.js + OpenStreetMap | Reverse Geocoding (Nominatim), พิกัด GPS, Heatmap แสดงความหนาแน่นของปัญหา |
| **SLA & Cost Engine** | `utils/slaHelper.js` + Background Cron | คำนวณ Deadline อัตโนมัติตาม Urgency, ตรวจสอบ SLA Breach ทุก 5 นาที, คำนวณงบประมาณและวัสดุ |
| **Quality Assurance** | Automated Verification Test Suite (`npm test`) | 26 Automated Test Cases ตรวจสอบ SLA, Geo, XSS, PDPA, CEO Financials, Indexes, และ NLP |

---

## โครงสร้างไฟล์โปรเจกต์ (Project Structure)

```
ResolveNow/
├── server.js                     ← Entry point หลัก (DNS IPv4 fix, Session, Socket.io, Health Check, Graceful Shutdown)
├── package.json                  ← รายการ Dependencies และ Scripts (start, dev, test)
├── AGENTS.md                     ← กฎและคำแนะนำสำหรับ AI Assistant
├── SYSTEM_CONTEXT.md             ← เอกสารสถาปัตยกรรมระบบฉบับสมบูรณ์ (เอกสารนี้)
├── README.md                     ← คู่มือภาพรวมโปรเจกต์
├── data_dictionary.html          ← หน้า HTML พจนานุกรมข้อมูล (Admin Auth Guard)
├── validateFlex.js               ← เครื่องมือตรวจสอบ LINE Flex Message Schema
├── INSTALL.txt                   ← คู่มือการติดตั้ง
│
├── config/
│   ├── db.js                     ← Mongoose connection (บังคับ IPv4 family:4, Google DNS resolver)
│   ├── seed.js                   ← ตัวสร้างข้อมูลเริ่มต้น (Admin, ช่าง 7 หมวด, ประชาชน, 7 หมวดมาตรฐาน)
│   ├── slaJob.js                 ← Cron Job: ตรวจสอบ SLA Breach ทุก 5 นาที และล้าง Chat หมดอายุ
│   ├── mailer.js                 ← Triple-Provider Mailer (Gmail SMTP SSL 465/TLS 587, SendGrid, Resend)
│   ├── lineNotify.js             ← แจ้งเตือนผ่าน LINE Messaging API ด้วย Flex Messages
│   └── cloudinary.js             ← การจัดการรูปภาพ Cloudinary + Local Disk fallback
│
├── models/
│   ├── Ticket.js                 ← Schema ตั๋วร้องเรียน (SLA, Materials, Timeline, Work Order, Upvotes, Merged, District)
│   ├── User.js                   ← Schema ผู้ใช้ (citizen, technician, admin, LINE profile) + Indexes
│   ├── Category.js               ← Schema หมวดหมู่ (ชื่อ, ป้ายกำกับภาษาไทย, ไอคอน, ช่างในสังกัด)
│   ├── Comment.js                ← Schema ข้อความสนทนาในตั๋วแต่ละใบ (Ticket Comments)
│   ├── DirectMessage.js          ← Schema ข้อความแชทตรง Citizen ↔ Admin + Compound Indexes
│   ├── HelpRequest.js            ← Schema ขอความช่วยเหลือข้ามฝ่ายช่าง + Indexes
│   └── Counter.js                ← ตัวนับ Auto-increment sequence ('ticket', 'help')
│
├── routes/
│   ├── tickets.js                ← CRUD ตั๋ว, สถานะ, ภาพ Before/After, SLA Pause, Merge, Reopen, Materials, Work Order
│   ├── auth.js                   ← Login, Register, OTP, LINE Auth, Server-side Gate APIs, Admin Test Email APIs
│   ├── technicians.js            ← รายชื่อช่าง, ความเชี่ยวชาญ, ภาระงานปัจจุบัน (Capacity)
│   ├── categories.js             ← CRUD หมวดหมู่, ผูกช่าง, ถ่ายโอนตั๋วเมื่อลบ
│   ├── directMessages.js         ← แชทตรง Citizen ↔ Admin (Unified Inbox)
│   ├── ceo.js                    ← API สถิติ, งบประมาณ, และการวิเคราะห์เชิงพื้นที่ (District Analytics)
│   ├── track.js                  ← API ค้นหาตั๋วสาธารณะ (Masked PII)
│   ├── helpRequests.js           ← ส่ง/รับ/ยกเลิกคำขอความช่วยเหลือระหว่างช่าง
│   ├── ai.js                     ← Cognitive Thai NLP Heuristics Engine + Claude/Gemini Fallback
│   └── lineAuth.js               ← LINE OAuth2 callback flow
│
├── utils/
│   └── slaHelper.js              ← ศูนย์กลางกฎ SLA คำนวณ Deadlines และตรวจ Breach (รองรับ Pause Status)
│
├── scripts/
│   ├── runTests.js               ← Automated Test Runner (26 Unit & Integration Tests)
│   └── seedMockTickets.js        ← สคริปต์สร้างตั๋วจำลองเพื่อการทดสอบ
│
├── docs/                         ← เอกสารเชิงวิศวกรรมซอฟต์แวร์ และ สถาปัตยกรรม
│   ├── context_diagram.md        ← System Context Diagram (Mermaid)
│   ├── data_dictionary.md        ← พจนานุกรมข้อมูล (Markdown 7 Collections)
│   ├── dfd.md                    ← Data Flow Diagram Level 0 & Level 1 (Mermaid)
│   ├── er_diagram.md             ← Entity-Relationship Diagram (Mermaid)
│   └── system_architecture.mmd   ← System Architecture & 6-Layer Security Specification (.mmd)
│
└── public/
    ├── index.html                ← Citizen Portal Single-Page Application (~88KB)
    ├── my-tickets.html           ← Dedicated My Tickets Portal (หน้าต่างเว็บแยกเรื่องร้องเรียนของฉัน)
    ├── admin.html                ← Dedicated Admin Management Portal (พร้อมเครื่องมือ Test Email)
    ├── tech.html                 ← Dedicated Technician Operations Portal (พร้อมเซ็นใบงาน & พักเวลา SLA)
    ├── executive-dashboard.html  ← CEO Executive Dashboard (สถิติ, งบประมาณ, District Analytics, Presentation Mode)
    ├── track.html                ← Public Ticket Tracker
    ├── project-poster.html       ← โปสเตอร์นำเสนอระบบ
    ├── liff-rating.html          ← หน้าประเมินผลผ่าน LINE In-App Browser (LIFF 2.x)
    ├── css/
    │   ├── style.css             ← สไตล์ชีตหลัก ดีไซน์ Glassmorphism, Theme tokens
    │   └── animations.css        ← คลาสแอนิเมชัน 3D, Card Flip, Modal transitions, Gate Shake
    ├── js/
    │   ├── app.js                ← Global State, Session bootstrap, Socket connection
    │   ├── ui.js                 ← UI Helpers, Toast, escapeHTML, Dynamic categories, Leaflet Heatmap
    │   ├── auth.js               ← Citizen Login, Register, OTP, LINE link flow
    │   ├── citizen.js            ← Logic ประชาชน, แบบฟอร์ม 5 ขั้นตอน, GPS, ให้คะแนน, Re-open
    │   ├── my-tickets.js         ← Controller หน้า /my-tickets (ระบบตรวจสอบความปลอดภัย 6 ชั้น)
    │   ├── technician.js         ← Logic ช่าง, ภาพ Before/After, บันทึกวัสดุและค่าใช้จ่าย, เซ็นใบงาน
    │   ├── admin.js              ← Logic แอดมิน, กราฟ Donut, คิวมอบหมายงาน, จัดการหมวด, ทดสอบอีเมล
    │   ├── admin-portal.js       ← Controller หน้า /admin, Server-side Gate verification, Welcome Splash
    │   ├── tech-portal.js        ← Controller หน้า /tech, Server-side Gate verification, Welcome Splash
    │   └── directChat.js         ← Direct Message Socket.IO client
    └── uploads/                  ← โฟลเดอร์สำรองสำหรับรูปภาพในเครื่อง (Local Fallback)
```

---

## สกีมาฐานข้อมูล (Database Schemas & Models)

### 1. User (`models/User.js`)
```javascript
{
  firstName:       { type: String, required: true },
  lastName:        { type: String, required: true },
  email:           { type: String, required: true, unique: true, lowercase: true },
  password:        { type: String, required: true }, // bcrypt hash (10 rounds)
  role:            { type: String, enum: ['citizen', 'technician', 'admin'], default: 'citizen' },
  specialty:       { type: String, default: null },   // สำหรับช่าง (ตรงกับ Category.name เช่น Road, Water)
  lineUserId:      { type: String, default: null },   // Unique LINE User ID
  lineDisplayName: { type: String, default: null },   // ชื่อที่แสดงบน LINE
  avatar:          { type: String, default: null },   // URL รูปโปรไฟล์
  createdViaLine:  { type: Boolean, default: false }, // สร้างบัญชีผ่าน flow LINE Register หรือไม่
  createdAt, updatedAt
}
// Indexes:
// - { role: 1 }
// - { lineUserId: 1 } (sparse)
```

### 2. Ticket (`models/Ticket.js`) — ฉบับสมบูรณ์ V18.0
```javascript
{
  ticketId:            { type: String, required: true, unique: true }, // e.g. "TKT-00001"
  citizenId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
  citizenName:         { type: String, required: true },
  citizenLineId:       { type: String, default: null },
  category:            { type: String, required: true }, // e.g. "Road", "Water"
  description:         { type: String, required: true }, // XSS sanitized
  location:            { type: String, required: true }, // ข้อความสถานที่
  district:            { type: String, default: null, index: true }, // เขต/อำเภอ (สกัดอัตโนมัติ)
  subdistrict:         { type: String, default: null },             // แขวง/ตำบล
  lat:                 { type: Number, default: null },
  lng:                 { type: Number, default: null },
  urgency:             { type: String, enum: ['normal', 'medium', 'urgent'], default: 'normal' },
  priorityScore:       { type: Number, default: 30 },
  status:              { 
    type: String, 
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'rejected', 'reopened', 'merged'], 
    default: 'pending' 
  },
  assignedTo:          { type: Schema.Types.ObjectId, ref: 'User', default: null },
  assignedName:        { type: String, default: null },
  rejectReason:        { type: String, default: null },
  
  // รูปภาพ
  citizenImage:        { type: String, default: null }, // รูปภาพแรก
  citizenImages:       { type: [String], default: [] },  // รูปภาพที่ประชาชนแนบ (สูงสุด 5 รูป)
  beforeImage:         { type: String, default: null }, // รูปก่อนซ่อม (ช่างอัปโหลด)
  afterImage:          { type: String, default: null },  // รูปแรกหลังซ่อม (backward compat)
  afterImages:         { type: [String], default: [] },  // รูปภาพหลังซ่อมทั้งหมด (สูงสุด 5 รูป)

  // ประเมินผลความพึงพอใจ
  rating:              { type: Number, min: 1, max: 5, default: null },
  ratingReason:        { type: String, default: null },
  ratedAt:             { type: String, default: null },

  // SLA Management
  slaAssignDeadline:   { type: Date, default: null },
  slaCompleteDeadline: { type: Date, default: null },
  slaBreached:         { type: Boolean, default: false },

  // SLA Pause / Hold System (การขอพักเวลา)
  slaPauseStatus:      { type: String, enum: ['none', 'requested', 'paused'], default: 'none' },
  slaPauseReason:      { type: String, default: null },
  slaPauseRequestedAt: { type: Date, default: null },
  slaPausedAt:         { type: Date, default: null },
  slaTotalPausedMs:    { type: Number, default: 0 },
  slaPauseHistory:     [{
    reason: String,
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedByName: String,
    requestedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedByName: String,
    approvedAt: Date,
    resumedAt: Date,
    resumedByName: String,
    durationMs: Number
  }],

  // Duplicate Detection & Merge (ตรวจจับและรวมตั๋วซ้ำ)
  mergedInto:          { type: String, default: null }, // รหัสตั๋วหลักที่รวมเข้า เช่น "TKT-00001"
  mergedTickets:       { type: [String], default: [] },  // รายการตั๋วที่ถูกรวมเข้ามา
  isMerged:            { type: Boolean, default: false },

  // Re-open / Dispute System (การร้องเรียนซ้ำ/เปิดงานใหม่)
  reopenCount:         { type: Number, default: 0 },
  reopenedAt:          { type: Date, default: null },
  reopenReason:        { type: String, default: null },
  reopenImages:        { type: [String], default: [] },

  // Digital Work Order & Signature (ใบสั่งงานและลายเซ็นดิจิทัล)
  workOrder: {
    signedByName:  { type: String, default: null },
    signedAt:      { type: Date, default: null },
    signatureData: { type: String, default: null }, // Base64 Data URL
    notes:         { type: String, default: null }
  },

  // Audit Timeline (ประวัติกิจกรรมของตั๋ว)
  timeline: [{
    action:    { type: String, required: true },
    actorRole: { type: String, enum: ['citizen', 'technician', 'admin', 'system'], default: 'system' },
    actorId:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    details:   { type: String, default: null },
    oldValue:  { type: String, default: null },
    newValue:  { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
  }],

  // Cost & Material Tracking (งบประมาณและรายการวัสดุอุปกรณ์)
  materials: [{
    name:       { type: String, required: true },
    quantity:   { type: Number, default: 1 },
    unit:       { type: String, default: 'ชิ้น' },
    unitPrice:  { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    addedBy:    { type: String, default: null },
    addedAt:    { type: Date, default: Date.now }
  }],
  totalRepairCost: { type: Number, default: 0 },
  repairCostNotes: { type: String, default: null },

  // Community Engagement
  upvotes:             [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, createdAt: Date }],
  upvoteCount:         { type: Number, default: 0 },
  followers:           [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, lineUserId: String }],
  followerCount:       { type: Number, default: 0 },

  // Chat Expiration
  chatExpiresAt:       { type: Date, default: null } // 24 ชม. หลังงานเสร็จ
}
```

**Indexes ของ Ticket Collection**:
- `{ citizenId: 1, createdAt: -1 }` (ค้นหาตั๋วของประชาชน)
- `{ assignedTo: 1, status: 1 }` (ค้นหาตั๋วของช่าง)
- `{ category: 1, status: 1 }` (กรองตั๋วตามหมวดหมู่และสถานะ)
- `{ status: 1, createdAt: -1 }` (คิวงาน Admin และ CEO Dashboard)
- `{ slaBreached: 1, status: 1 }` (คิวงานตรวจสอบ SLA Breach)
- `{ chatExpiresAt: 1 }` (sparse index ล้างแชทหมดอายุ)
- `{ lat: 1, lng: 1, category: 1 }` (ค้นหาตั๋วซ้ำซ้อนบริเวณใกล้เคียง)
- `{ district: 1 }` (การค้นหาและสรุปสถิติเชิงพื้นที่)

### 3. DirectMessage (`models/DirectMessage.js`)
```javascript
// Indexes:
// - { citizenId: 1, createdAt: 1 }
// - { citizenId: 1, senderRole: 1, isRead: 1 }
// - { senderRole: 1, isRead: 1 }
```

### 4. HelpRequest (`models/HelpRequest.js`)
```javascript
// Indexes:
// - { status: 1 }
// - { requesterId: 1 }
// - { acceptedById: 1 }
// - { ticketId: 1 }
```

---

## สรุปฟังก์ชันการทำงานใหม่ (New Features in V18.0)

### 1. สถาปัตยกรรมส่งอีเมล 3 ชั้น (Triple-Provider Resilient Mailer)
- **Layer 1: Gmail SMTP (Nodemailer)**: รองรับ Port 465 (SSL) และ Auto-failover สู่ Port 587 (TLS)
- **Layer 2: SendGrid HTTP API**: ทำงานเป็น Secondary Fallback ทันทีหาก Gmail ไม่ตอบสนอง
- **Layer 3: Resend HTTP API**: ทำงานเป็น Tertiary Fallback หากผู้ให้บริการอื่นมีปัญหา
- **Admin Mail Diagnostics Tools**:
  - `POST /api/auth/test-email`: ทดสอบการส่งเมลพร้อมวัดเวลา Latency (ms) และระบุ Provider ที่จัดส่งสำเร็จ
  - `GET /api/auth/mail-status`: ตรวจสอบสถานะการเชื่อมต่อและ Credentials ของผู้ให้บริการทั้ง 3 ราย

### 2. ระบบวิเคราะห์ความเร่งด่วนภาษาไทย (Cognitive Thai NLP Heuristics Engine)
- สถาปัตยกรรม 5-Layer NLP ใน `routes/ai.js` สำหรับตรวจจับระดับความเร่งด่วนอย่างชาญฉลาดโดยไม่ต้องรอ API ภายนอก:
  1. *Layer 1 (urgent)*: ภาวะคุกคามชีวิตและภัยเฉียบพลัน (งูเห่าในบ้าน, ไฟไหม้ลุกลาม, เสาไฟล้มขวางทาง)
  2. *Layer 2 (normal)*: การกรองตามบริบทพื้นที่และการปฏิเสธ/ความรุนแรงต่ำ (งู/ตัวเงินตัวทองอยู่นอกรั้ว, น้ำขังเล็กน้อย, รอยร้าวตื้นๆ, การบำรุงรักษาตามรอบ)
  3. *Layer 3 (medium)*: ความเดือดร้อนต่อชุมชนและสาธารณูปโภค (ท่อแตกน้ำไม่ไหล, ไฟฟ้าดับทั้งตำบล, ขยะส่งกลิ่นเหม็น)
  4. *Layer 4*: Semantic Keyword Matching
  5. *Layer 5*: Category Base Fallback
- ผ่านการทดสอบครอบคลุม 100% จาก 134 Few-shot test cases ในชุดทดสอบอัตโนมัติ

### 3. การวิเคราะห์เชิงพื้นที่และงบประมาณ (District & Geospatial Analytics)
- ฟังก์ชัน `extractDistrict(ticket)` สกัดชื่อเขตและแขวงจากข้อความสถานที่ และจัดเก็บบันทึกลงในฟิลด์ `district` และ `subdistrict`
- `GET /api/ceo/district-analytics`: คำนวณสรุปสถิติเรื่องร้องเรียน สัดส่วนปัญหา อัตราการแก้ไขสำเร็จ และงบประมาณซ่อมบำรุงแยกตามเขต

### 4. สถาปัตยกรรม Server-Side Security Gate API
- ปกป้องหน้าจัดการด้วยการตรวจสอบ Passcode บนเซิร์ฟเวอร์ (`POST /api/auth/gate-verify`)
- จัดเก็บสถานะการปลดล็อคไว้ใน MongoDB Session (`req.session.gateUnlocked`) พร้อม Rate-limit ป้องกัน Brute-force

### 5. ชุดทดสอบระบบอัตโนมัติ (Automated Verification Test Suite)
- รันด้วยคำสั่ง `npm test` หรือ `node scripts/runTests.js`
- ครอบคลุมการทดสอบ 26 รายการใน 7 กลุ่มงาน:
  1. SLA Engine & Breach Detection (7 tests)
  2. Geo Calculations & Duplicate Detection (3 tests)
  3. Security & XSS Sanitization (2 tests)
  4. PDPA & Privacy Protection (1 test)
  5. Financial & Budget Aggregations (2 tests)
  6. Database Model Schemas & Indexes (4 tests)
  7. Cognitive Thai NLP Heuristics Engine (7 tests / 134 cases)

### 6. การบริหารความพร้อมใช้งานในระดับ Production (Production Hardening)
- `GET /health` และ `GET /api/health`: ตรวจสอบสถานะการทำงาน Uptime และการเชื่อมต่อฐานข้อมูล
- Graceful Shutdown ปิด HTTP Server และคืน Connection ของ MongoDB อย่างหมดจดเมื่อได้รับสัญญาณ SIGINT/SIGTERM

---

## รายละเอียด REST API Endpoints ทั้งหมด

### 1. การยืนยันตัวตนและการจัดการบัญชี (`/api/auth`)
| Method | เส้นทาง (Path) | สิทธิ์เข้าถึง | คำอธิบาย |
|---|---|---|---|
| `POST` | `/send-otp` | สาธารณะ | สร้างและส่ง OTP 6 หลักทางอีเมล (จำกัด Rate Limit ป้องกันการสแปม) |
| `POST` | `/register` | สาธารณะ | ตรวจสอบ OTP และลงทะเบียนบัญชีประชาชน |
| `POST` | `/login` | สาธารณะ | ตรวจสอบอีเมลและรหัสผ่าน bcrypt สร้าง Express Session |
| `POST` | `/logout` | Authenticated | ทำลาย Session ใน MongoDB |
| `GET` | `/me` | สาธารณะ | ตรวจสอบสถานะ Session ปัจจุบัน |
| `POST` | `/change-password` | Authenticated | เปลี่ยนรหัสผ่านใหม่ |
| `POST` | `/gate-verify` | สาธารณะ | ตรวจสอบ Gate Passcode บันทึกสิทธิ์ลงใน Session (จำกัด 5 ครั้ง/15 นาที) |
| `GET` | `/gate-status` | สาธารณะ | ตรวจสอบสถานะการปลดล็อค Gate ของ Portal ในเซสชัน |
| `POST` | `/gate-lock` | สาธารณะ | สั่งล็อค Gate ในเซสชันปัจจุบัน |
| `POST` | `/test-email` | Admin | เครื่องมือทดสอบการส่งอีเมลและวัด Latency |
| `GET` | `/mail-status` | Admin | ตรวจสอบสถานะ Credentials ของผู้ให้บริการอีเมลทั้ง 3 ราย |
| `GET` | `/line-pending` | สาธารณะ | ข้อมูล LINE Profile ชั่วคราวที่รอการผูกบัญชี |
| `POST` | `/link-line` | สาธารณะ | เชื่อมต่อบัญชีเดิมเข้ากับ LINE Profile |
| `POST` | `/link-line-skip` | สาธารณะ | สมัครบัญชีใหม่ด้วย LINE ทันที |
| `POST` | `/register-line` | สาธารณะ | ส่ง OTP ทางอีเมลเพื่อเปิดบัญชีพร้อมผูก LINE |
| `POST` | `/verify-line-otp` | สาธารณะ | ยืนยัน OTP และผูกบัญชี LINE สำเร็จ |
| `GET` | `/admin-linked-lines` | Admin | รายชื่อผู้ใช้ทั้งหมดที่ผูก LINE |
| `POST` | `/admin-unlink-line` | Admin | ยกเลิกการผูก LINE และลบบัญชีแบบ Cascade |
| `POST` | `/admin-unlink-all` | Admin | ยกเลิกการผูก LINE ของผู้ใช้ทั้งหมด |

### 2. จัดการเรื่องร้องเรียนและงานซ่อมบำรุง (`/api/tickets`)
| Method | เส้นทาง (Path) | สิทธิ์เข้าถึง | คำอธิบาย |
|---|---|---|---|
| `GET` | `/` | Authenticated | ดึงตั๋ว: citizen (เฉพาะของตน), tech (ตามสังกัดหรือที่รับงาน), admin (ทั้งหมด) |
| `POST` | `/` | Authenticated | สร้างตั๋วใหม่ + แนบรูปได้สูงสุด 5 รูป + วิเคราะห์ SLA + แจ้งเตือน LINE |
| `PUT` | `/:id/status` | Authenticated | เปลี่ยนสถานะตาม State Transition Matrix (พร้อมตรวจ SLA Breach อัตโนมัติ) |
| `PUT` | `/:id/assign` | Admin | มอบหมายตั๋วให้ช่าง (`assignedTo`) พร้อมอัปเดตสถานะเป็น `assigned` |
| `POST` | `/:id/upload/before` | Technician | อัปโหลดภาพถ่ายก่อนเริ่มปฏิบัติงาน |
| `POST` | `/:id/upload/after` | Technician | อัปโหลดภาพถ่ายหลังปฏิบัติงานเสร็จสิ้น (สูงสุด 5 รูป) |
| `POST` | `/:id/materials` | Tech / Admin | บันทึกรายการวัสดุและค่าใช้จ่ายในการซ่อมบำรุง |
| `POST` | `/:id/sla/request-pause`| Tech / Admin | ส่งคำขอพักเวลา SLA ชั่วคราว |
| `POST` | `/:id/sla/approve-pause`| Admin | อนุมัติการพักเวลา SLA |
| `POST` | `/:id/sla/resume` | Tech / Admin | ยกเลิกการพักเวลาและคำนวณวันสิ้นสุด SLA ชดเชยใหม่ |
| `GET` | `/detect-duplicates` | สาธารณะ / Auth | ตรวจสอบตั๋วที่อาจซ้ำซ้อนกันในพื้นที่ (< 100 เมตร) |
| `POST` | `/:id/merge` | Admin | รวมตั๋วที่ซ้ำซ้อนเข้ากับตั๋วหลัก ถ่ายโอนคะแนนโหวตและผู้ติดตาม |
| `POST` | `/:id/reopen` | Citizen / Admin | ส่งคำขอเปิดงานใหม่กรณีปัญหาเดิมยังไม่เสร็จสิ้น |
| `POST` | `/:id/work-order/sign` | Tech / Admin | บันทึกลายเซ็นดิจิทัลผู้ตรวจรับงาน |
| `GET` | `/:id/work-order` | สาธารณะ / Auth | แสดงหน้าเอกสารใบสั่งงานราชการดิจิทัล |
| `PUT` | `/:id/rating` | Citizen | ประเมินความพึงพอใจ 1-5 ดาว |
| `PUT` | `/:id/rating/liff` | สาธารณะ (LIFF) | รับคะแนนประเมินผ่าน LINE LIFF |
| `GET` | `/public/:id/rating-status` | สาธารณะ | ตรวจสอบสถานะการประเมินตั๋ว |
| `GET` | `/search` | สาธารณะ / Auth | ค้นหาตั๋วตามคำค้นหาและหมวดหมู่ (Mask PII หากไม่ล็อกอิน) |
| `GET` | `/public-map` | สาธารณะ | ข้อมูลพิกัดสำหรับแผนที่ Heatmap (ย้อนหลัง 30 วัน) |
| `GET` | `/report` | Admin | ข้อมูลสถิติเชิงลึกสำหรับรายงานประจำเดือน |
| `GET` | `/report/excel` | Admin | ส่งออกข้อมูลตั๋วเป็นไฟล์ Excel (.xlsx) |
| `GET` | `/export` | Admin | ส่งออกข้อมูลตั๋วเป็นไฟล์ CSV (.csv) |
| `POST` | `/:id/upvote` | Authenticated | โหวต / ยกเลิกโหวตเพื่อเพิ่ม Priority Score |
| `POST` | `/:id/follow` | Authenticated | ติดตามตั๋วเพื่อรับแจ้งเตือนผ่าน LINE |
| `GET` | `/:id/comments` | Authenticated | ดึงข้อความสนทนาในตั๋ว (มี IDOR Protection) |
| `POST` | `/:id/comments` | Authenticated | ส่งข้อความสนทนาในตั๋ว + ยิง Socket.IO |
| `DELETE` | `/:id` | Admin | ลบตั๋ว 1 ใบ + ลบรูปภาพออกจาก Cloudinary แบบ Cascade |
| `DELETE` | `/` | Admin | ลบตั๋วทั้งหมด (ต้องใช้รหัส `ADMIN_DELETE_PASSWORD` จาก env) |

### 3. ผู้บริหาร / CEO Dashboard (`/api/ceo`)
| Method | เส้นทาง (Path) | สิทธิ์เข้าถึง | คำอธิบาย |
|---|---|---|---|
| `GET` | `/tickets` | สาธารณะ (Read-only)| ดึงตั๋วทั้งหมดเพื่อสรุปสถิติ (Masked PII, Lean Projection) |
| `GET` | `/cost-overview` | สาธารณะ (Read-only)| สรุปงบประมาณ ค่าใช้จ่ายรายเดือน สัดส่วนหมวดหมู่ และ Top 5 วัสดุ |
| `GET` | `/district-analytics` | สาธารณะ (Read-only)| สรุปสถิติเชิงพื้นที่แยกตามเขต/แขวง พร้อมงบประมาณซ่อมบำรุง |
| `GET` | `/technicians` | สาธารณะ (Read-only)| รายชื่อช่างและภาระงานปัจจุบันเพื่อวิเคราะห์ Capacity |
| `GET` | `/categories` | สาธารณะ (Read-only)| รายการหมวดหมู่ทั้งหมดสำหรับสรุปสัดส่วนปัญหา |

### 4. ข้อความตรง / Direct Messages (`/api/direct-messages`)
| Method | เส้นทาง (Path) | สิทธิ์เข้าถึง | คำอธิบาย |
|---|---|---|---|
| `GET` | `/` | Citizen | ประวัติข้อความแชทตรงของประชาชน |
| `GET` | `/unread-count` | Citizen | จำนวนข้อความที่ยังไม่อ่านของประชาชน |
| `GET` | `/all` | Admin | รายการ Thread แชทของประชาชนทุกคน |
| `GET` | `/admin-unread` | Admin | ยอดรวมข้อความที่ยังไม่อ่านของ Admin |
| `GET` | `/:citizenId` | Admin | ดึงประวัติแชทของประชาชนคนดังกล่าว |
| `POST` | `/` | Authenticated | ส่งข้อความ DM + Push แจ้งเตือน Socket.IO |

### 5. ระบบความพร้อมใช้งาน / Health Check
| Method | เส้นทาง (Path) | สิทธิ์เข้าถึง | คำอธิบาย |
|---|---|---|---|
| `GET` | `/health`, `/api/health` | สาธารณะ | ตรวจสอบสถานะการทำงาน Uptime และการเชื่อมต่อฐานข้อมูล MongoDB |

---

## กฎและระบบคำนวณ SLA (SLA Engine — `utils/slaHelper.js`)

```javascript
const SLA_RULES = {
  urgent:  { assignHours: 2,  completeHours: 8  },
  medium:  { assignHours: 8,  completeHours: 48 },
  normal:  { assignHours: 24, completeHours: 72 }
};
```
1. **`calcSlaDeadlines(urgency)`**: คำนวณวันสิ้นสุดรับงานและปิดงาน
2. **`checkIsSlaBreached(ticket)`**: ตรวจสอบว่าตั๋วผิดสัญญา SLA หรือไม่ โดยพิจารณาร่วมกับเวลาที่ถูก Pause (`slaTotalPausedMs`)
3. **Background SLA Job (`config/slaJob.js`)**: ตรวจสอบทุก 5 นาที และอัปเดตสถานะ `slaBreached = true` แบบ Batch อัตโนมัติ

---

## ตัวแปรสภาพแวดล้อมที่สำคัญ (Environment Variables)

```env
# Server Configuration
PORT=3001
BASE_URL=https://resolvenow-hlv5.onrender.com
NODE_ENV=development

# Database & Sessions
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/resolvenow
SESSION_SECRET=your-strong-random-session-secret

# Security Passwords
ADMIN_DELETE_PASSWORD=your-secure-admin-delete-password

# Email Delivery Providers (OTP & Notifications)
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-gmail-app-password
SENDGRID_API_KEY=SG.your-sendgrid-api-key
RESEND_API_KEY=re_your-resend-api-key

# LINE Integration
LINE_CHANNEL_TOKEN=your-line-channel-access-token
LINE_ADMIN_USER_ID=your-line-admin-user-id
LINE_LOGIN_CLIENT_ID=your-line-login-channel-id
LINE_LOGIN_CLIENT_SECRET=your-line-login-channel-secret
LINE_LOGIN_CALLBACK_URL=https://resolvenow-hlv5.onrender.com/auth/line/callback
LINE_LIFF_ID=your-liff-id

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# AI Models
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=your-gemini-api-key
```

---

## บัญชีทดสอบเริ่มต้น (Default Seeded Accounts)

| บทบาท (Role) | อีเมล (Email) | รหัสผ่าน (Password) | สังกัด / ความเชี่ยวชาญ |
|---|---|---|---|
| **Admin** | `admin@resolvenow.th` | `admin1234` | ศูนย์สั่งการและบริหารจัดการระบบส่วนกลาง |
| **Technician 1** | `tech1@resolvenow.th` | `tech1234` | ถนน/ทางเท้า (`Road`) |
| **Technician 2** | `tech2@resolvenow.th` | `tech1234` | ท่อแตก/น้ำไม่ไหล (`Water`) |
| **Technician 3** | `tech3@resolvenow.th` | `tech1234` | ไฟฟ้าสาธารณะดับ (`Electricity`) |
| **Technician 4** | `tech4@resolvenow.th` | `tech1234` | ขยะตกค้าง (`Garbage`) |
| **Technician 5** | `tech5@resolvenow.th` | `tech1234` | สัตว์มีพิษ/จรจัด (`Animal`) |
| **Technician 6** | `tech6@resolvenow.th` | `tech1234` | กิ่งไม้วางทาง (`Tree`) |
| **Technician 7** | `tech7@resolvenow.th` | `tech1234` | เพลิง/ภัยพิบัติ (`Hazard`) |
| **Citizen (Dev)** | `tenginpb@gmail.com` | `123456` | ประชาชนทดสอบ |

---

## ข้อพึงระวังและข้อควรจำสำหรับ AI (Critical Notes for AI Assistants)

1. **ห้าม Commit หรือ Push ขึ้น Git ด้วยตัวเองโดยเด็ดขาด & กฎการอัปเดตเอกสาร .md (Documentation Auto-Sync Rule)**:
   - ปฏิบัติตามนโยบายใน `AGENTS.md` อย่างเคร่งครัด
   - ทุกครั้งที่ตรวจเช็คสถานะ Git (`git status`) หรือประวัติ Git ระหว่างการทำงาน หากพบว่าเพิ่งมีงานถูก push ขึ้น Git ให้ทำการอัปเดตไฟล์เอกสาร `.md` ที่เกี่ยวข้อง (เช่น `AGENTS.md`, `SYSTEM_CONTEXT.md`, `README.md`, โฟลเดอร์ `docs/`) ให้มีข้อมูลโครงสร้างและสถาปัตยกรรมตรงกับงานล่าสุดเสมอ
   - **ห้าม** push หรือ commit ไฟล์ `.md` เหล่านี้ขึ้น Git ด้วยตัวเองโดยเด็ดขาด ให้คงสภาพไว้เฉพาะใน Local Workspace เท่านั้น
2. **การทำงานกับ Portals แยก URL**: เมื่อมีคำสั่งปรับแต่งหน้า Admin, Tech, CEO หรือ My Tickets ให้ตรวจสอบว่ากำลังแก้ที่ไฟล์ Dedicated HTML/JS ที่ถูกต้อง (`admin.html` / `admin-portal.js`, `tech.html` / `tech-portal.js`, `executive-dashboard.html`, `my-tickets.html` / `my-tickets.js`) หรือแก้ไขใน Single Page ส่วนกลาง (`index.html`)
3. **Portal Gate Passcode**: รหัสผ่านปลดล็อคเข้าหน้า Login / Dashboard ของ `/admin`, `/tech` และ `/ceo` คือ `@Teng11421142`
4. **SLA Calculation**: ห้ามคำนวณวันหมดอายุ SLA เองใน Route ให้เรียกใช้ `utils/slaHelper.js` เสมอ
5. **Timeline Logging**: เมื่อมีการกระทำสำคัญต่อตั๋ว ให้เพิ่มบันทึกลงใน `ticket.timeline` ผ่านฟังก์ชัน `logTicketActivity()` เสมอเพื่อรักษา Audit Trail
6. **XSS & Data Sanitization**: ฟิลด์ข้อความทั้งหมดต้องผ่าน `xss()` ใน Backend และ `escapeHTML()` ใน Frontend
7. **Real-time Sync**: ยิง Socket.IO event `ticket_updated` ทุกครั้งที่มีการเปลี่ยนแปลงข้อมูลในตั๋ว เพื่อให้ทุกหน้าจอซิงค์ข้อมูลตรงกันทันที
8. **Automated Verification**: รัน `npm test` เพื่อตรวจสอบความสมบูรณ์ของระบบหลังการแก้ไขโค้ดทุกครั้ง
