# Workspace Rules & Instructions

## Git Operations Policy (Strict Rule)
- **ห้าม push หรือ upload โค้ดขึ้น Git ด้วยตัวเองโดยเด็ดขาด** (Never perform `git push`, `git commit`, or auto-upload to remote repositories on your own).
- การทำงานกับ Git (เช่น `git commit`, `git push`) จะทำได้ก็ต่อเมื่อผู้ใช้มีคำสั่งสั่งการชัดเจนเท่านั้น
- รักษาสถานะ code ให้อยู่เฉพาะ local workspace เว้นแต่จะได้รับคำสั่งยืนยันจากผู้ใช้

---

# ResolveNow — AI Assistant Quick Architecture & Reference Guide

> เอกสารสรุปสาระสำคัญสำหรับ AI Assistant ในการทำความเข้าใจโครงสร้าง สถาปัตยกรรม และแนวทางการแก้ไขระบบ ResolveNow อย่างรวดเร็วและถูกต้อง แม่นยำ (อัปเดตล่าสุด: 2026-09-15 | Version: V17.5)

---

## 1. ข้อมูลสำคัญที่ AI ต้องจำเสมอ (Must-Know Facts)

1. **Default Port**: รันที่พอร์ต `3001` เสมอ (`http://localhost:3001`) จากคำสั่ง `npm run dev` (ห้ามเปลี่ยนพอร์ตเองเว้นแต่ได้รับคำสั่ง)
2. **Dedicated Portals (แยกพอร์ทัลตาม URL ชัดเจน)**:
   - `http://localhost:3001/` : **Citizen Portal** (ประชาชนแจ้งเรื่อง, ติดตาม, แผนที่ Heatmap, แชทตรง)
   - `http://localhost:3001/admin` : **Admin Portal** (ผู้ดูแลระบบ, คิวงาน, มอบหมาย, จัดการช่าง/หมวดหมู่, Inbox, รายงาน)
   - `http://localhost:3001/tech` หรือ `/technician` : **Technician Portal** (ช่างปฏิบัติงาน, รับงาน, อัปโหลด Before/After, บันทึกวัสดุ/ค่าใช้จ่าย)
   - `http://localhost:3001/ceo` : **CEO Dashboard** (ผู้บริหาร, ดูสถิติ SLA, กราฟงบประมาณ/ค่าใช้จ่าย, Masked PII)
   - `http://localhost:3001/track` : **Public Tracker** (หน้าติดตามสถานะสำหรับประชาชนทั่วไป ค้นหาด้วย Ticket ID)
   - `http://localhost:3001/Datadic` : **Data Dictionary** (เข้าดูได้เฉพาะ Admin เท่านั้น)
   - `http://localhost:3001/project` : **Project Poster** (โปสเตอร์สรุปโครงการ)
3. **Portal Security Gate Passcode**:
   - พอร์ทัล `/admin`, `/tech` และ `/ceo` มี Gate ป้องกันความปลอดภัย (สำหรับ `/admin` และ `/tech` ป้องกันก่อนหน้า Login, สำหรับ `/ceo` ป้องกันก่อนเข้า Executive Dashboard)
   - รหัสผ่านปลดล็อค Gate Passcode คือ: **`@Teng11421142`**
4. **Seeded Test Accounts**:
   - **Admin**: `admin@resolvenow.th` / `admin1234`
   - **Technicians (7 หมวด)**: `tech1@resolvenow.th` ถึง `tech7@resolvenow.th` / รหัสผ่าน: `tech1234`
   - **Citizen (Dev)**: `tenginpb@gmail.com` / `123456`

---

## 2. โครงสร้างและไฟล์สำคัญของระบบ (File Directory Map)

```
ResolveNow/
├── server.js                     ← Entry point หลัก (IPv4/DNS override, Session, Socket.IO, Route bindings)
├── AGENTS.md                     ← กฎระเบียบและคู่มือแนะนำการพัฒนาสำหรับ AI
├── SYSTEM_CONTEXT.md             ← สถาปัตยกรรมฉบับสมบูรณ์ (Deep-dive technical context)
├── README.md                     ← คู่มือผู้ใช้และการติดตั้งภาพรวม
│
├── config/
│   ├── db.js                     ← Mongoose connection (บังคับ IPv4 family:4)
│   ├── seed.js                   ← ตัวสร้าง Admin, ช่าง 7 คน, ประชาชน และ 7 หมวดเริ่มต้น
│   ├── slaJob.js                 ← Cron ทุก 5 นาทีตรวจ SLA Breach + Cron ล้างแชทหมดอายุ
│   ├── mailer.js                 ← Nodemailer (Gmail) + SendGrid Dual Provider
│   ├── lineNotify.js             ← ส่งข้อความ Flex Message แจ้งเตือนเข้า LINE
│   └── cloudinary.js             ← ระบบอัปโหลดรูปภาพ Cloudinary + Local Disk Fallback
│
├── models/
│   ├── Ticket.js                 ← Schema ตั๋วร้องเรียน (SLA, Materials, Timeline, Work Order, Upvotes, Merged)
│   ├── User.js                   ← Schema ผู้ใช้ (citizen, technician, admin, LINE profile)
│   ├── Category.js               ← Schema หมวดหมู่ปัญหา (name, label, icon, technicianIds, isDefault)
│   ├── Comment.js                ← Schema ข้อความคอมเมนต์ในตั๋ว (Ticket Discussion)
│   ├── DirectMessage.js          ← Schema แชทตรง Citizen ↔ Admin
│   ├── HelpRequest.js            ← Schema ขอความช่วยเหลือข้ามฝ่ายช่าง
│   └── Counter.js                ← Auto-increment สำหรับรันเลข TKT-xxxxx และ HELP-xxx
│
├── routes/
│   ├── tickets.js                ← CRUD ตั๋ว, สถานะ, ภาพ Before/After, SLA Pause, Merge, Reopen, Materials
│   ├── auth.js                   ← Login, Register, OTP, Password, LINE Auth
│   ├── technicians.js            ← รายชื่อช่างและ Capacity ภาระงาน
│   ├── categories.js             ← จัดการหมวดหมู่ (เพิ่ม/แก้/ลบ/ผูกช่าง)
│   ├── directMessages.js         ← แชทตรง Citizen ↔ Admin (Unified inbox)
│   ├── ceo.js                    ← API สถิติและงบประมาณสำหรับแดชบอร์ดผู้บริหาร
│   ├── track.js                  ← API ค้นหาตั๋วสาธารณะ (Masked PII)
│   ├── helpRequests.js           ← คำขอความช่วยเหลือข้ามฝ่าย
│   ├── ai.js                     ← ตรวจจับความเร่งด่วนและหมวดหมู่ด้วย AI
│   └── lineAuth.js               ← LINE OAuth2 callback flow
│
├── utils/
│   └── slaHelper.js              ← รวมศูนย์คำนวณวันหมดอายุ SLA และตรวจ Breach
│
└── public/
    ├── index.html                ← Citizen Portal SPA (หน้าแรก)
    ├── admin.html                ← Admin Portal (เฉพาะแอดมิน)
    ├── tech.html                 ← Technician Portal (เฉพาะช่าง)
    ├── executive-dashboard.html  ← CEO Dashboard (ผู้บริหาร)
    ├── track.html                ← หน้าค้นหาตั๋วสาธารณะ
    ├── project-poster.html       ← หน้าโปสเตอร์นำเสนอระบบ
    ├── css/
    │   ├── style.css             ← สไตล์ชีตหลัก (Design Tokens, Glassmorphism, Theme)
    │   └── animations.css        ← แอนิเมชัน 3D, Card Flip, Modal Transitions
    └── js/
        ├── app.js                ← Session state & Global initializations
        ├── ui.js                 ← Utility functions, escapeHTML, Toast, Dynamic Depts, Heatmap
        ├── auth.js               ← Login/Register/OTP flow
        ├── citizen.js            ← Logic ประชาชน (ส่งตั๋ว, GPS, ประเมินดาว)
        ├── technician.js         ← Logic ช่าง (จัดการงาน, อัปรูป Before/After, บันทึกวัสดุ)
        ├── admin.js              ← Logic แอดมิน (มอบหมายงาน, กราฟ, จัดการหมวด)
        ├── admin-portal.js       ← Session controller & Gate unlock ของ /admin
        ├── tech-portal.js        ← Session controller & Gate unlock ของ /tech
        └── directChat.js         ← Real-time Direct Chat Socket handler
```

---

## 3. กฎเกณฑ์และแนวทางการเขียนโค้ดสำหรับ AI (Development Best Practices)

### กฎด้านการคำนวณ SLA (SLA Engine Rule)
- **ห้าม** เขียนตรรกะคำนวณวันเวลา SLA หรือตรวจการผิดสัญญาขึ้นมาใหม่ใน Routes
- ให้เรียกใช้ฟังก์ชันจาก `utils/slaHelper.js` เสมอ:
  - `calcSlaDeadlines(urgency)`: คืนค่า `{ slaAssignDeadline, slaCompleteDeadline }`
  - `checkIsSlaBreached(ticket)`: ตรวจสอบสถานะการผิดสัญญาแบบแม่นยำ

### กฎด้านความปลอดภัย (Security Rules)
1. **XSS Protection**: ข้อมูลประเภท Text ที่รับจากผู้ใช้ (ชื่อ, รายละเอียด, คอมเมนต์, วัสดุ, เหตุผล) ต้องคลุมด้วย `xss()` ในฝั่ง Backend และใช้ฟังก์ชัน `escapeHTML()` ในฝั่ง Frontend เสมอ
2. **IDOR Protection**:
   - การดูคอมเมนต์ตั๋ว: ต้องเป็นเจ้าของตั๋ว, ช่างที่ได้รับมอบหมาย, หรือแอดมินเท่านั้น
   - การเปลี่ยนสถานะตั๋ว: ช่างทำได้เฉพาะตั๋วที่ได้รับมอบหมายเท่านั้น (`ticket.assignedTo == req.session.userId`)
3. **Admin Actions**: การลบตั๋วทั้งหมดต้องตรวจสอบ `ADMIN_DELETE_PASSWORD` จาก Environment เสมอ

### ฟีเจอร์ขั้นสูงที่ต้องทราบเมื่อแก้ไขตั๋ว (Advanced Ticket Features)
1. **Cost & Material Tracking (`materials`, `totalRepairCost`, `repairCostNotes`)**:
   - บันทึกรายการวัสดุ/อะไหล่ที่ใช้ซ่อม พร้อมราคาต่อหน่วยและคำนวณราคารวมอัตโนมัติ
   - ช่างเจ้าของงานหรือ Admin อัปเดตผ่าน `POST /api/tickets/:id/materials`
   - ฝ่ายบริหารดูสถิติค่าใช้จ่ายผ่าน `GET /api/ceo/cost-overview`
2. **Audit Timeline (`timeline`)**:
   - เมื่อมีการกระทำสำคัญต่อตั๋ว (เปลี่ยนสถานะ, มอบหมาย, พักเวลา SLA, ซ่อมเสร็จ, บันทึกวัสดุ) ให้เรียก `logTicketActivity(ticket, { action, actorRole, actorId, actorName, details, newValue })` เพื่อเก็บประวัติ
3. **SLA Pause / Hold (`slaPauseStatus`, `slaPauseReason`, `slaTotalPausedMs`)**:
   - ช่างสามารถขอพักเวลา SLA ได้เมื่อรออะไหล่หรือสภาพอากาศไม่เอื้ออำนวย
   - Admin เป็นผู้อนุมัติการพักเวลา และเมื่อสั่ง Resume เวลา Deadlines จะถูกเลื่อนชดเชยตามระยะเวลาที่พักจริง
4. **Duplicate Detection & Merge (`mergedInto`, `isMerged`)**:
   - ระบบตรวจจับตั๋วซ้ำซ้อนผ่านรัศมีพิกัดและหมวดหมู่เดียวกัน
   - Admin สามารถสั่งรวมตั๋ว (Merge) ได้ โดยโหวตและผู้ติดตามจะถูกถ่ายโอนไปยังตั๋วหลัก
5. **Digital Work Order & Signature (`workOrder`)**:
   - บันทึกชื่อผู้เซ็นรับงาน ลายเซ็นดิจิทัล (Data URL) และดูใบงานผ่าน `GET /api/tickets/:id/work-order`
6. **Real-time Synchronization**:
   - เมื่อทำการอัปเดตตั๋ว ให้ยิง Socket event `ticket_updated` เสมอ (`emitUpdate(req)`) เพื่อให้แดชบอร์ดทุกพอร์ทัลอัปเดตแบบเรียลไทม์
