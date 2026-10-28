# 🛠️ ResolveNow — Developer Guide & System Architecture
> **สำหรับทีมพัฒนา (Developers & Maintainers)** | อัปเดตล่าสุด: 2026-10 | ระบบรับแจ้งเรื่องร้องเรียนและบริหารงานซ่อมบำรุงเมืองอัจฉริยะ (Smart City Work Order Platform)

---

## 📌 สารบัญ (Table of Contents)
1. [ภาพรวมระบบและสถาปัตยกรรม (System Overview)](#1-ภาพรวมระบบและสถาปัตยกรรม-system-overview)
2. [พอร์ทัลการใช้งานและ URL (Dedicated Portals & Gate Security)](#2-พอร์ทัลการใช้งานและ-url-dedicated-portals--gate-security)
3. [เทคโนโลยีที่ใช้งาน (Tech Stack)](#3-เทคโนโลยีที่ใช้งาน-tech-stack)
4. [โครงสร้างโค้ดและโฟลเดอร์ (Project Structure & File Map)](#4-โครงสร้างโค้ดและโฟลเดอร์-project-structure--file-map)
5. [การติดตั้งและเริ่มต้นพัฒนา (Developer Setup & Quick Start)](#5-การติดตั้งและเริ่มต้นพัฒนา-developer-setup--quick-start)
6. [บัญชีทดสอบเริ่มต้น (Default Seeded Accounts)](#6-บัญชีทดสอบเริ่มต้น-default-seeded-accounts)
7. [กฎการพัฒนาและ Business Logic สำคัญ (Core Business Rules & Security Guidelines)](#7-กฎการพัฒนาและ-business-logic-สำคัญ-core-business-rules--security-guidelines)
8. [สรุป API Endpoints สำคัญ (Key REST APIs)](#8-สรุป-api-endpoints-สำคัญ-key-rest-apis)
9. [การทดสอบระบบ (Automated Test Suite)](#9-การทดสอบระบบ-automated-test-suite)

---

## 1. ภาพรวมระบบและสถาปัตยกรรม (System Overview)

**ResolveNow** คือแพลตฟอร์มบริหารจัดการเรื่องร้องเรียนและงานซ่อมบำรุงเมืองอัจฉริยะ (Smart City Issue & Maintenance Management Platform) ออกแบบด้วยสถาปัตยกรรม **Dedicated Multi-Portal Architecture** เพื่อเชื่อมต่อการทำงานของ 4 กลุ่มผู้ใช้งานหลัก:
1. **ประชาชน (Citizen)**: แจ้งเรื่อง 5 ขั้นตอน พร้อมพิกัด GPS แม่นยำ, แนบภาพสูงสุด 5 รูป, ติดตามสถานะเรียลไทม์, ตรวจสอบแผนที่ Heatmap, สนทนาสดกับแอดมิน, โหวต/ติดตามเรื่องผ่าน LINE และประเมินผลความพึงพอใจ
2. **ช่างและเจ้าหน้าที่ภาคสนาม (Technician)**: รับงานตามความเชี่ยวชาญเฉพาะทาง (7 หมวดงาน), นำทางไปยังจุดเกิดเหตุ, บันทึกภาพ Before/After, บันทึกวัสดุและค่าใช้จ่ายซ่อมบำรุง, ขอพักเวลา SLA เมื่อรออะไหล่, และออกใบสั่งงานพร้อมลายเซ็นดิจิทัล (Digital Work Order)
3. **ผู้ดูแลระบบ (Admin Dispatcher)**: ศูนย์สั่งการและกระจายงาน, ตรวจสอบ Workload Capacity ช่าง, มอบหมายงาน, รวมตั๋วซ้ำ (Merge Tickets), อนุมัติการพักเวลา SLA, บริหารจัดการ Spam Quarantine และทัณฑ์บนผู้ใช้ (Strike System)
4. **ผู้บริหารระดับสูง (CEO / Executive)**: สรุปสถิติ SLA Compliance, งบประมาณซ่อมบำรุงประจำเดือน, การวิเคราะห์เชิงพื้นที่ (District Analytics), สถิติวัสดุที่เบิกใช้สูงสุด พร้อมระบบปกปิดข้อมูลส่วนบุคคล (Masked PII) ตามหลัก PDPA

---

## 2. พอร์ทัลการใช้งานและ URL (Dedicated Portals & Gate Security)

ระบบแยก URL หน้าการใช้งานตามบทบาทอย่างชัดเจน โดยทุกพอร์ทัลรันบน Base URL: `http://localhost:3001` (Default Port)

| พอร์ทัล | URL | ไฟล์ Frontend | การรักษาความปลอดภัย | หน้าที่หลัก |
|---|---|---|---|---|
| **Citizen Portal** | `/` | `public/index.html` | Session / Anti-Spam Engine | แจ้งเรื่องร้องเรียน, Heatmap, แชทตรง, โหวต, ติดตามสถานะ |
| **My Tickets Portal** | `/my-tickets` | `public/my-tickets.html` | 6-Layer Security Isolation | หน้ารวมประวัติตั๋วทั้งหมดของฉัน, กรองสถานะ, แชทกับช่าง |
| **Admin Portal** | `/admin` | `public/admin.html` | **Gate Passcode** + Admin Role | จัดคิว มอบหมายงาน อนุมัติ SLA จัดการหมวดหมู่ Spam Quarantine |
| **Technician Portal** | `/tech` หรือ `/technician` | `public/tech.html` | **Gate Passcode** + Tech Role | รับงาน, อัปโหลด Before/After, บันทึกวัสดุ, พักเวลา, เซ็นใบงาน |
| **CEO Dashboard** | `/ceo` | `public/executive-dashboard.html` | **Gate Passcode** + CEO/Admin | สถิติ SLA, วิเคราะห์งบประมาณ, District Analytics, Masked PII |
| **Public Tracker** | `/track` | `public/track.html` | Public (Masked PII) | ค้นหาและติดตามสถานะงานด้วยรหัส Ticket ID สำหรับบุคคลทั่วไป |
| **Data Dictionary** | `/Datadic` | `data_dictionary.html` | Login สิทธิ์ Admin | พจนานุกรมข้อมูลฐานข้อมูล 7 Collections อย่างละเอียด |
| **Project Poster** | `/project` | `public/project-poster.html` | Public | โปสเตอร์ดิจิทัลนำเสนอโครงการและสถาปัตยกรรมระบบ |
| **Health Check** | `/health` หรือ `/api/health` | JSON Response | Public | ตรวจสอบ Uptime เซิร์ฟเวอร์ และสถานะการเชื่อมต่อ MongoDB |

> 🔒 **Security Gate Passcode**: 
> หน้า `/admin`, `/tech`, และ `/ceo` ถูกป้องกันด้วย Security Gate สองชั้น (Client UI + Server-side Verification `POST /api/auth/gate-verify`)
> รหัสผ่าน Gate Passcode กลางคือ: **`@Teng11421142`** (จำกัดความผิดพลาดสูงสุด 5 ครั้งต่อ 15 นาที เพื่อป้องกัน Brute-force)

---

## 3. เทคโนโลยีที่ใช้งาน (Tech Stack)

- **Backend Runtime**: Node.js (v18+) + Express.js 4
- **Database**: MongoDB Atlas + Mongoose 9 (พร้อม Compound Indexes ครอบคลุมทุก Query Pattern)
- **Session Store**: `express-session` + `connect-mongo` v6 (Shared session ร่วมกับ Socket.IO)
- **Real-Time Engine**: Socket.IO v4 (Two-way event sync, DM Rooms, Ticket Status Live Update)
- **Cloud Storage**: Cloudinary v2 (Auto-resize, Quality optimization) พร้อม Local Disk Fallback (`/public/uploads/`)
- **Email Service**: Triple-Provider Architecture (Gmail SSL 465/TLS 587, SendGrid API, Resend API)
- **LINE Integration**: LINE Messaging API (Flex Messages), LINE Login OAuth2, LINE LIFF 2.x
- **AI & NLP Intelligence**: 
  - External AI: Anthropic Claude API + Google Gemini API
  - Internal Fallback: **Cognitive Thai NLP Heuristics Engine (5-Layer Classification)** ทำงานได้ 100% แม้ไม่มี API Key
- **Frontend UI**: Vanilla HTML5, Modern CSS3 (Glassmorphism, 3D Transitions), Vanilla JavaScript ES6+ (ไร้ Framework ขนาดใหญ่ เพื่อความเร็วสูงสุด)
- **Maps & GIS**: Leaflet.js + OpenStreetMap Nominatim Reverse Geocoding
- **Quality Assurance**: Automated Verification Test Suite (`scripts/runTests.js` 43 Test Cases ใน 9 กลุ่มงาน)

---

## 4. โครงสร้างโค้ดและโฟลเดอร์ (Project Structure & File Map)

```
ResolveNow/
├── server.js                     ← Entry point หลัก (Express, Socket.IO, Session, Graceful Shutdown, Health Check)
├── package.json                  ← Dependencies และ Scripts (start, dev, test)
├── DEVELOPER_GUIDE.md            ← คู่มือการพัฒนาและสถาปัตยกรรมระบบสำหรับทีมนักพัฒนา
│
├── config/
│   ├── db.js                     ← Mongoose connection (IPv4 family:4 override ป้องกัน timeout)
│   ├── seed.js                   ← ตัวสร้าง Admin, ช่าง 7 คน, ประชาชน และหมวดหมู่งานเริ่มต้นอัตโนมัติ
│   ├── slaJob.js                 ← Cron Job ตรวจสอบ SLA Breach ทุก 5 นาที + ล้างห้องแชทที่ปิดงานแล้ว
│   ├── mailer.js                 ← Triple-Provider Mailer (Gmail, SendGrid, Resend พร้อม Auto-fallback)
│   ├── lineNotify.js             ← ฟังก์ชันส่ง Flex Message แจ้งเตือนเข้าห้องแชท LINE
│   └── cloudinary.js             ← ตั้งค่า Cloudinary Uploader + Local Disk Storage สำรอง
│
├── models/
│   ├── Ticket.js                 ← Schema ตั๋วร้องเรียน (SLA, Materials, Timeline, Work Order, Upvotes, District)
│   ├── User.js                   ← Schema ผู้ใช้ (Citizen, Technician, Admin, LINE Profile, Strike Status)
│   ├── Category.js               ← Schema หมวดหมู่งาน (Icon, TechnicianIds, SLA Deadlines, isDefault)
│   ├── Comment.js                ← Schema ความคิดเห็นในตั๋ว (Ticket Discussion)
│   ├── DirectMessage.js          ← Schema ข้อความแชทตรง 1-on-1 ประชาชน ↔ แอดมิน
│   ├── HelpRequest.js            ← Schema ขอความช่วยเหลือข้ามฝ่ายช่าง
│   └── Counter.js                ← Auto-increment สำหรับรันเลขรหัสตั๋ว TKT-xxxxx และ HELP-xxx
│
├── routes/
│   ├── tickets.js                ← CRUD ตั๋ว, สถานะ, Before/After, พัก SLA, รวมตั๋ว, วัสดุ, Digital Work Order
│   ├── auth.js                   ← Authentication, OTP, Password Reset, Gate Passcode Verify, Mail Test API
│   ├── technicians.js            ← รายชื่อช่างและคำนวณ Workload Capacity
│   ├── categories.js             ← จัดการหมวดหมู่งาน (เพิ่ม/แก้/ลบ/ผูกช่าง)
│   ├── directMessages.js         ← API แชทตรง ประชาชน ↔ แอดมิน
│   ├── ceo.js                    ← API สถิติ SLA, งบประมาณ, District Analytics สำหรับผู้บริหาร
│   ├── track.js                  ← API ค้นหาตั๋วสาธารณะ (Masked PII)
│   ├── helpRequests.js           ← คำขอความช่วยเหลือข้ามฝ่ายระหว่างช่าง
│   ├── ai.js                     ← Cognitive Thai NLP Heuristics Engine + Claude/Gemini AI
│   └── lineAuth.js               ← LINE OAuth2 Callback Flow
│
├── utils/
│   ├── slaHelper.js              ← ฟังก์ชันคำนวณ SLA และตรวจจับ SLA Breach (แหล่งความจริงเดียวของระบบ)
│   └── spamFilter.js             ← ตัวกรองสแปม, Shannon Entropy, ตรวจคำหยาบ, Geofencing, และ Strike Engine
│
├── scripts/
│   ├── runTests.js               ← Automated Test Suite (43 Unit & Integration Tests ใน 9 หมวดงาน)
│   └── seedMockTickets.js        ← สคริปต์สร้างตั๋วจำลองเพื่อใช้ทดสอบระบบ
│
└── public/
    ├── index.html                ← Citizen Portal SPA (แจ้งเรื่อง 5 ขั้นตอน, Heatmap, แชท)
    ├── my-tickets.html           ← My Tickets Dedicated Portal
    ├── admin.html                ← Admin Portal (Dispatching Hub, Spam Quarantine Drawer)
    ├── tech.html                 ← Technician Portal (หน้าปฏิบัติงานช่างภาคสนาม)
    ├── executive-dashboard.html  ← CEO Executive Dashboard
    ├── track.html                ← Public Tracker หน้าติดตามสถานะงาน
    ├── project-poster.html       ← หน้าโปสเตอร์นำเสนอระบบ
    ├── css/                      ← สไตล์ชีตหลัก (style.css, animations.css)
    └── js/                       ← Logic ควบคุมการทำงานแต่ละพอร์ทัล
        ├── app.js                ← Session State & Global Handlers
        ├── ui.js                 ← Shared UI Components (Toast, Modal, Dynamic Depts, Heatmap)
        ├── auth.js               ← Login, Register, OTP Modal
        ├── citizen.js            ← Logic ประชาชน (ส่งตั๋ว, GPS, Real-time Spam Warning)
        ├── my-tickets.js         ← Controller หน้า /my-tickets (ระบบคัดกรองตั๋วของฉัน)
        ├── technician.js         ← Logic ช่าง (รับงาน, อัปรูป, บันทึกวัสดุ, พัก SLA, เซ็นใบงาน)
        ├── admin.js              ← Logic แอดมิน (มอบหมายงาน, กราฟ, จัดการหมวด, Spam Quarantine)
        ├── admin-portal.js       ← Session controller & Gate unlock ของ /admin
        ├── tech-portal.js        ← Session controller & Gate unlock ของ /tech
        └── directChat.js         ← Socket.IO Real-time Chat Controller
```

---

## 5. การติดตั้งและเริ่มต้นพัฒนา (Developer Setup & Quick Start)

### ข้อกำหนดขั้นต่ำของเครื่อง (Prerequisites)
- Node.js version 18.x หรือใหม่กว่า
- npm version 9.x หรือใหม่กว่า
- MongoDB (ใช้ Cloud MongoDB Atlas หรือ Local MongoDB Community)

### ขั้นตอนที่ 1: ติดตั้ง Dependencies
```bash
npm install
```

### ขั้นตอนที่ 2: ตั้งค่า Environment Variables (.env)
คัดลอกไฟล์ `.env.example` เป็น `.env` และกำหนดค่าที่จำเป็น:
```bash
cp .env.example .env
```

**ตัวแปร Environment Variables สำคัญ**:
```env
PORT=3001
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/resolvenow?retryWrites=true&w=majority
SESSION_SECRET=your_super_secret_session_key_here
BASE_URL=http://localhost:3001

# Gate Security
GATE_PASSCODE=@Teng11421142

# Email Providers (เลือกระบุอย่างน้อยหนึ่งบริการ)
EMAIL_SERVICE=gmail
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASS=your_gmail_app_password
# SENDGRID_API_KEY=SG.xxxxxxxx
# RESEND_API_KEY=re_xxxxxxxx

# Cloudinary (อัปโหลดรูปภาพบน Cloud)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# LINE Integration (แจ้งเตือน Flex Message และ LINE Login)
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_LOGIN_CHANNEL_ID=your_line_login_channel_id
LINE_LOGIN_CHANNEL_SECRET=your_line_login_channel_secret
LINE_LOGIN_CALLBACK_URL=http://localhost:3001/api/auth/line/callback
```

### ขั้นตอนที่ 3: รันการทดสอบความถูกต้องของระบบ (Automated Tests)
```bash
npm test
```
*(ต้องผ่านครบ 43 การทดสอบ โดยไม่มีข้อผิดพลาด)*

### ขั้นตอนที่ 4: เริ่มรันเซิร์ฟเวอร์
```bash
# โหมดพัฒนา (รองรับ Hot Reload ด้วย nodemon)
npm run dev

# โหมด Production
npm start
```
เปิดเว็บเบราว์เซอร์ไปที่: **`http://localhost:3001`**

---

## 6. บัญชีทดสอบเริ่มต้น (Default Seeded Accounts)

เมื่อระบบเริ่มต้นครั้งแรก `config/seed.js` จะสร้างบัญชีทดสอบและหมวดหมู่อัตโนมัติ:

| บทบาท | อีเมล | รหัสผ่าน | ชื่อผู้ใช้ | สิทธิ์ / แผนกความเชี่ยวชาญ |
|---|---|---|---|---|
| **Admin** | `admin@resolvenow.th` | `admin1234` | ผู้ดูแลระบบส่วนกลาง | สิทธิ์ Dispatcher จัดการทุกพอร์ทัล |
| **Tech 1** | `tech1@resolvenow.th` | `tech1234` | วิชัย โยธา | ถนน/ทางเท้า (`Road`) |
| **Tech 2** | `tech2@resolvenow.th` | `tech1234` | มานะ ประปา | ท่อแตก/น้ำไม่ไหล (`Water`) |
| **Tech 3** | `tech3@resolvenow.th` | `tech1234` | สมชาย ไฟฟ้า | ไฟฟ้าสาธารณะดับ (`Electricity`) |
| **Tech 4** | `tech4@resolvenow.th` | `tech1234` | สุรัตน์ สุขา | ขยะตกค้าง (`Garbage`) |
| **Tech 5** | `tech5@resolvenow.th` | `tech1234` | บุญมี ปราบ | สัตว์มีพิษ/จรจัด (`Animal`) |
| **Tech 6** | `tech6@resolvenow.th` | `tech1234` | สมศรี ป่าไม้ | กิ่งไม้วางทาง (`Tree`) |
| **Tech 7** | `tech7@resolvenow.th` | `tech1234` | อนันต์ กู้ภัย | เพลิง/ภัยพิบัติ (`Hazard`) |
| **Citizen** | `tenginpb@gmail.com` | `123456` | ประชาชนทดสอบ | บัญชีประชาชนทั่วไป |

> 🔑 **Gate Passcode เข้าหน้า `/admin`, `/tech`, `/ceo`**: **`@Teng11421142`**

---

## 7. กฎการพัฒนาและ Business Logic สำคัญ (Core Business Rules & Security Guidelines)

### 1) การคำนวณเวลา SLA (SLA Engine Rule)
- **ห้าม** เขียนตรรกะคำนวณวันหมดอายุ SLA หรือตรวจ Breach ซ้ำซ้อนใน Routes
- ให้เรียกใช้ฟังก์ชันมาตรฐานจาก `utils/slaHelper.js` เสมอ:
  - `calcSlaDeadlines(urgency)`: คืนค่า `{ slaAssignDeadline, slaCompleteDeadline }`
  - `checkIsSlaBreached(ticket)`: ตรวจสอบการผิดสัญญาอย่างแม่นยำ (รองรับการพักเวลา `slaPauseStatus` และข้ามตั๋ว `spam_quarantine`)

### 2) การป้องกันความปลอดภัยข้อมูล (Security & IDOR Hardening)
- **XSS Sanitization**: ข้อมูลข้อความทุกชนิดที่รับจาก Client ต้องผ่าน `xss()` ในฝั่ง Backend และแสดงผลผ่าน `escapeHTML()` ในฝั่ง Frontend
- **IDOR Protection**:
  - การดูหรือเขียนคอมเมนต์ในตั๋ว: ต้องเป็นเจ้าของตั๋ว (`citizenId`), ช่างที่ได้รับมอบหมาย (`assignedTo`), หรือ Admin เท่านั้น
  - การเปลี่ยนสถานะตั๋ว / อัปโหลด Before-After: ช่างทำได้เฉพาะตั๋วที่ได้รับมอบหมายเท่านั้น
  - การเซ็นใบสั่งงานดิจิทัล (`workOrder`): ตรวจสอบสิทธิ์เฉพาะผู้เกี่ยวข้องเท่านั้น
- **ReDoS Defense**: ใน `utils/spamFilter.js` ให้ตัดความยาวข้อความ (`text.slice(0, 1000)`) ก่อนรัน Regex เสมอ
- **Digital Work Order Signature**: ลายเซ็นต้องอยู่ในรูปแบบ Base64 Data URL (`^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$`) และขนาดข้อมูลต้องไม่เกิน **500KB** เพื่อป้องกัน DB Bloating

### 3) ระบบคัดกรองสแปมและทัณฑ์บน (Anti-Spam & Strike Engine)
- ทำงาน 3 ระดับผ่าน `utils/spamFilter.js`:
  1. **Hard Block (HTTP 400)**: การเคาะแป้นพิมพ์มั่ว (Keyboard mashing / Shannon entropy สูง), คำหยาบคายรุนแรง บล็อกทันทีไม่บันทึกตั๋ว
  2. **Soft Quarantine (`spam_quarantine`)**: ข้อความล้อเล่น ตรวจพิกัดนอกประเทศไทย (Geofencing) หรือติด Blacklist ระบบจะรับเรื่องแต่แยกเข้าตู้กักกัน ไม่ส่งแจ้งเตือนช่าง และไม่นำไปคิด SLA
  3. **Strike System**: หากผู้ใช้ส่งเรื่องสแปมสะสมครบ 3 ครั้ง บัญชีจะถูกระงับ (Suspended) ชั่วคราว 24 ชั่วโมง

### 4) ระบบประเมินความเร่งด่วนด้วย AI & Thai NLP (Cognitive NLP Engine)
- `routes/ai.js` ใช้สถาปัตยกรรม **5-Layer Cognitive Thai NLP Heuristics Engine**:
  - **Layer 1: Life-threatening & Imminent Danger (`urgent`)** — สัตว์มีพิษในบ้าน, ไฟไหม้ลุกลาม, ก๊าซระเบิด, เสาไฟล้ม
  - **Layer 2: Living Space Proximity & Negation Filter (`normal`)** — สัตว์อยู่นอกรั้ว, น้ำขังเล็กน้อย, รอยแตกร้าวตื้นๆ
  - **Layer 3: Disruptive / Public Inconvenience (`medium`)** — ท่อแตกน้ำไม่ไหล, ไฟดับบริเวณกว้าง, ถนนเป็นหลุมบ่อ, ขยะตกค้าง
  - **Layer 4: Semantic Keyword Fallback**
  - **Layer 5: Category Base Fallback**

---

## 8. สรุป API Endpoints สำคัญ (Key REST APIs)

### 🔐 Authentication & Gate (`/api/auth`)
- `POST /api/auth/register` — ลงทะเบียนประชาชนใหม่
- `POST /api/auth/login` — เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
- `POST /api/auth/logout` — ออกจากระบบและล้างเซสชัน
- `GET /api/auth/me` — ข้อมูลผู้ใช้ปัจจุบันในเซสชัน
- `POST /api/auth/gate-verify` — ตรวจสอบรหัสผ่าน Gate Passcode (`@Teng11421142`)
- `GET /api/auth/gate-status` — ตรวจสอบสถานะการปลดล็อค Gate ของพอร์ทัล
- `POST /api/auth/gate-lock` — สั่งล็อค Gate ทันที

### 📋 Tickets Management (`/api/tickets`)
- `GET /api/tickets` — ดึงรายการตั๋ว (รองรับ Filter: status, urgency, category, search, page)
- `POST /api/tickets` — สร้างตั๋วใหม่ (แนบภาพสูงสุด 5 ภาพ พร้อมพิกัด GPS)
- `GET /api/tickets/:id` — ดูรายละเอียดตั๋วแบบเจาะลึก
- `PUT /api/tickets/:id/status` — อัปเดตสถานะงาน (เฉพาะช่างเจ้าของงานหรือ Admin)
- `POST /api/tickets/:id/before-after` — อัปโหลดภาพ Before & After
- `POST /api/tickets/:id/materials` — บันทึกรายการวัสดุและค่าใช้จ่ายซ่อมแซม
- `POST /api/tickets/:id/work-order` — บันทึกลายเซ็นและออกใบสั่งงานดิจิทัล
- `POST /api/tickets/:id/pause-sla` — ขอพักเวลา SLA ชั่วคราว
- `POST /api/tickets/:id/resume-sla` — อนุมัติกลับมานับเวลา SLA ต่อพร้อมชดเชยเวลา
- `POST /api/tickets/:id/merge` — รวมตั๋วซ้ำซ้อนเข้ากับตั๋วหลัก

### 💬 Direct Messages (`/api/direct-messages`)
- `GET /api/direct-messages` — ดึงประวัติแชทกับแอดมินส่วนกลาง
- `POST /api/direct-messages` — ส่งข้อความแชทตรงพร้อมแนบรูปภาพ

### 📊 CEO Analytics (`/api/ceo`)
- `GET /api/ceo/stats` — สรุปภาพรวม SLA Compliance และจำนวนตั๋ว
- `GET /api/ceo/cost-overview` — สรุปงบประมาณและค่าใช้จ่ายซ่อมแซมประจำเดือน
- `GET /api/ceo/district-analytics` — การวิเคราะห์เชิงพื้นที่และงบประมาณรายเขต/แขวง

---

## 9. การทดสอบระบบ (Automated Test Suite)

ระบบมีชุดทดสอบอัตโนมัติ 43 Test Cases ครอบคลุม 9 กลุ่มงานสำคัญ รันผ่านคำสั่ง:
```bash
npm test
```

**กลุ่มงานที่ได้รับการทดสอบ**:
1. **SLA Engine Tests**: การคำนวณ Deadline ตามระดับความเร่งด่วน และการตรวจจับ SLA Breach เมื่อมี/ไม่มีการพักเวลา
2. **Duplicate Ticket Detection Tests**: การตรวจจับตั๋วซ้ำด้วยรัศมีพิกัด Haversine (< 100 เมตร)
3. **Security & Input Sanitization Tests**: การตัด Script แท็ก XSS และการป้องกัน Injection
4. **PDPA Masking Tests**: การปกปิดชื่อ-นามสกุล เบอร์โทร และอีเมลของประชาชนใน CEO Dashboard
5. **CEO Financial Aggregation Tests**: การคำนวณงบประมาณและผลรวมค่าใช้จ่ายวัสดุซ่อมบำรุง
6. **Mongoose Compound Indexes Tests**: การตรวจสอบ Index สำคัญเพื่อประสิทธิภาพ Query
7. **Cognitive Thai NLP Tests**: ตรวจสอบความถูกต้องของการจัดระดับความเร่งด่วน 5 เลเยอร์
8. **AI Dispatcher Heuristics Tests**: การเลือกช่างที่เหมาะสมที่สุดตามภาระงาน (Workload Capacity)
9. **Anti-Spam & Strike Engine Tests**: การตรวจจับ Entropy, คำหยาบ, Geofencing และระบบระงับสิทธิ์

---
*จัดทำขึ้นเพื่อให้ทีมนักพัฒนาสามารถเข้าใจโครงสร้างและต่อยอดระบบ ResolveNow ได้อย่างรวดเร็ว ปลอดภัย และถูกต้องตามมาตรฐานวิศวกรรมซอฟต์แวร์*

