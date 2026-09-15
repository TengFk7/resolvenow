# 🏙️ ResolveNow (ระบบรับแจ้งเรื่องร้องเรียนและบริหารงานซ่อมบำรุงเมืองอัจฉริยะ)

> **ResolveNow** เป็นเว็บแอปพลิเคชันรูปแบบ Dedicated Multi-Portal Architecture สำหรับบริหารจัดการและติดตามเรื่องร้องเรียนของเทศบาลและเมืองอัจฉริยะ (Smart City) เชื่อมต่อประชาชน ช่างผู้ปฏิบัติงาน และผู้ดูแลระบบแบบเรียลไทม์ พร้อมการแจ้งเตือนผ่าน LINE, ระบบวิเคราะห์ความเร่งด่วนด้วย AI, แผนที่ Heatmap, ระบบบันทึกงบประมาณ/วัสดุ, ใบสั่งงานพร้อมลายเซ็นดิจิทัล และระบบ SLA อัตโนมัติ

---

## 🌐 พอร์ทัลการใช้งาน (Dedicated Portals)

ระบบแยกหน้าการใช้งานตาม URL อย่างชัดเจน พร้อมระบบรักษาความปลอดภัย **Security Gate Passcode**:

| พอร์ทัล | URL | หน้าเว็บ | รหัสผ่าน Gate Passcode | ผู้ใช้งาน |
|---|---|---|---|---|
| **Citizen Portal** | `/` | `public/index.html` | - | ประชาชนทั่วไป แจ้งเรื่อง ติดตาม แชท โหวต |
| **Admin Portal** | `/admin` | `public/admin.html` | `@Teng11421142` | ผู้ดูแลระบบ จัดการคิว มอบหมายงาน อนุมัติ SLA |
| **Technician Portal** | `/tech` หรือ `/technician` | `public/tech.html` | `@Teng11421142` | ช่างภาคสนาม รับงาน บันทึกรูป Before/After บันทึกวัสดุ |
| **CEO Dashboard** | `/ceo` | `public/executive-dashboard.html` | - (Read-only / Masked PII) | ผู้บริหารระดับสูง สถิติ SLA กราฟงบประมาณ |
| **Public Tracker** | `/track` | `public/track.html` | - (Public search) | ค้นหาและติดตามสถานะตั๋วด้วยรหัส Ticket ID |
| **Data Dictionary** | `/Datadic` | `data_dictionary.html` | Login ด้วยสิทธิ์ Admin | พจนานุกรมข้อมูลฐานข้อมูลฉบับสมบูรณ์ |
| **Project Poster** | `/project` | `public/project-poster.html` | - | โปสเตอร์สรุปฟีเจอร์และสถาปัตยกรรมโครงการ |

---

## 🌟 ฟีเจอร์เด่นของระบบ (Key Highlights)

### 🏠 1. ฝั่งประชาชน (Citizen Experience)
- **แจ้งเรื่อง 5 ขั้นตอน พร้อมพิกัด GPS แม่นยำ**: ระบุตำแหน่งอัตโนมัติด้วย Reverse Geocoding (OpenStreetMap Nominatim) แนบรูปภาพได้สูงสุด 5 รูป
- **ติดตามสถานะงานแบบเรียลไทม์**: อัปเดตการทำงานของเจ้าหน้าที่ทันทีผ่าน Socket.IO
- **ระบบมีส่วนร่วมของชุมชน (Community Upvote & Follow)**: โหวตดันเรื่องสำคัญ และติดตามความคืบหน้าผ่าน LINE Notify
- **แชทตรงกับเจ้าหน้าที่ (Direct Message)**: สนทนาแบบ 1-on-1 ระหว่างประชาชนกับแอดมินส่วนกลาง
- **ประเมินความพึงพอใจ & เปิดงานใหม่ (Re-open)**: ประเมิน 1-5 ดาวผ่านเว็บหรือ LINE LIFF และสามารถยื่นเรื่องเปิดงานใหม่กรณีปัญหายังไม่เรียบร้อย

### 👷 2. ฝั่งช่างและเจ้าหน้าที่ปฏิบัติการ (Technician Field Ops)
- **ระบบงานตามความเชี่ยวชาญ**: คัดกรองและรับงานซ่อมแซมตามหมวดหมู่ที่ได้รับมอบหมาย
- **บันทึกหลักฐานก่อน-หลังซ่อม**: อัปโหลดรูปภาพ Before & After ได้สูงสุด 5 ภาพ
- **ระบบบันทึกรายการวัสดุและค่าใช้จ่าย (Cost & Material Tracking)**: บันทึกรายการอะไหล่ที่ใช้ซ่อม พร้อมคำนวณงบประมาณรวมอัตโนมัติ
- **ระบบขอพักเวลา SLA (SLA Pause / Hold)**: ขอพักเวลาชั่วคราวกรณีรออะไหล่หรือสภาพอากาศไม่เอื้ออำนวย
- **ใบสั่งงานพร้อมลายเซ็นดิจิทัล (Digital Work Order)**: บันทึกลายเซ็นผู้ตรวจรับงานและออกใบงานดิจิทัลได้ทันที
- **ขอความช่วยเหลือข้ามฝ่าย (Help Requests)**: ประสานงานกับช่างฝ่ายอื่นเมื่อต้องใช้ทักษะเฉพาะทาง

### 👨‍💼 3. ฝั่งผู้ดูแลระบบ (Admin Dispatching Hub)
- **ศูนย์สั่งการและมอบหมายงาน**: มอบหมายตั๋วให้ช่างพร้อมวิเคราะห์ Workload Capacity
- **ระบบตรวจจับตั๋วซ้ำและรวมตั๋ว (Duplicate Detection & Merge)**: ตรวจสอบปัญหาซ้ำซ้อนในรัศมีใกล้เคียงและรวมข้อมูล
- **อนุมัติการพักเวลา SLA**: ควบคุมและบริหารจัดการเวลา SLA ขององค์กร
- **จัดการหมวดหมู่ปัญหาไดนามิก (Dynamic Categories)**: เพิ่ม แก้ไข ย้ายตั๋ว และผูกช่างเข้าสังกัด
- **กล่องข้อความรวม (Unified DM Inbox)**: ตอบกลับข้อความจากประชาชนทุกคนในที่เดียว
- **รายงานสรุปเชิงลึก**: ดาวน์โหลดรายงานเป็นไฟล์ Excel (.xlsx) และ CSV

### 📊 4. ฝั่งผู้บริหาร (CEO Executive Dashboard)
- แดชบอร์ดสรุปตัวชี้วัด SLA Compliance แบบเรียลไทม์
- รายงานสรุปงบประมาณและค่าใช้จ่ายซ่อมบำรุงประจำเดือน (Monthly Budget & Repair Expenses)
- กราฟสัดส่วนค่าใช้จ่ายแยกตามหมวดหมู่ และ 5 อันดับวัสดุที่มีการเบิกใช้สูงสุด
- ปลอดภัยด้วยการ Mask ข้อมูลส่วนบุคคล (Masked PII)

---

## 🛠️ เทคโนโลยีที่ใช้งาน (Tech Stack)

- **Backend**: Node.js (v18+), Express.js 4
- **Database**: MongoDB Atlas, Mongoose 9 (พร้อม Compound Indexes ครบทุก Use-case)
- **Session & Security**: express-session, connect-mongo v6, bcryptjs, xss, helmet, express-mongo-sanitize, rateLimiters
- **Real-Time Engine**: Socket.IO v4 (Two-way events, Heartbeat ping-pong, IDOR protection)
- **Cloud Storage**: Cloudinary v2 (Auto-resize, Quality optimization) + Local Disk Fallback
- **LINE Integration**: LINE Messaging API (Flex Messages), LINE Login OAuth2, LINE LIFF 2.x
- **Email & OTP**: Nodemailer (Gmail SMTP), SendGrid API
- **AI Analytics**: Anthropic Claude & Google Gemini
- **Frontend UI**: Vanilla HTML5, Modern CSS3 (Glassmorphism, 3D Transitions), JavaScript ES6+
- **GIS & Mapping**: Leaflet.js, OpenStreetMap Nominatim

---

## 🚀 การเริ่มต้นใช้งาน (Quick Start)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env` และกำหนดค่าที่จำเป็น:
```bash
cp .env.example .env
```

### 3. รันระบบ
```bash
# โหมด Development (รีโหลดอัตโนมัติด้วย nodemon)
npm run dev

# โหมด Production
npm start
```
ระบบจะเปิดให้บริการที่ `http://localhost:3001` โดยอัตโนมัติ

---

## 🔑 บัญชีทดสอบเริ่มต้น (Default Seeded Accounts)

ระบบสร้างบัญชีทดสอบให้อัตโนมัติเมื่อเริ่มระบบครั้งแรก:

| บทบาท | อีเมล | รหัสผ่าน | ชื่อผู้ใช้ | แผนก / ความเชี่ยวชาญ |
|---|---|---|---|---|
| **Admin** | `admin@resolvenow.th` | `admin1234` | Admin Dispatcher | ศูนย์สั่งการส่วนกลาง |
| **Tech 1** | `tech1@resolvenow.th` | `tech1234` | วิชัย โยธา | ถนน/ทางเท้า (`Road`) |
| **Tech 2** | `tech2@resolvenow.th` | `tech1234` | มานะ ประปา | ท่อแตก/น้ำไม่ไหล (`Water`) |
| **Tech 3** | `tech3@resolvenow.th` | `tech1234` | สมชาย ไฟฟ้า | ไฟฟ้าสาธารณะดับ (`Electricity`) |
| **Tech 4** | `tech4@resolvenow.th` | `tech1234` | สุรัตน์ สุขา | ขยะตกค้าง (`Garbage`) |
| **Tech 5** | `tech5@resolvenow.th` | `tech1234` | บุญมี ปราบ | สัตว์มีพิษ/จรจัด (`Animal`) |
| **Tech 6** | `tech6@resolvenow.th` | `tech1234` | สมศรี ป่าไม้ | กิ่งไม้วางทาง (`Tree`) |
| **Tech 7** | `tech7@resolvenow.th` | `tech1234` | อนันต์ กู้ภัย | เพลิง/ภัยพิบัติ (`Hazard`) |
| **Citizen** | `tenginpb@gmail.com` | `123456` | Teng Teng | ประชาชนทดสอบ |

> **หมายเหตุสำหรับ Portal `/admin` และ `/tech`**: ต้องกรอกรหัสผ่านปลดล็อค Gate Passcode **`@Teng11421142`** ก่อนเข้าสู่หน้าล็อกอิน

---

## 📚 เอกสารประกอบระบบ (Documentation)

- **สำหรับ AI Assistant (กฎระเบียบและคู่มือด่วน)**: [AGENTS.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/AGENTS.md)
- **สถาปัตยกรรมระบบฉบับสมบูรณ์ (Deep-Dive Context)**: [SYSTEM_CONTEXT.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/SYSTEM_CONTEXT.md)
- **พจนานุกรมข้อมูล (Data Dictionary)**: [docs/data_dictionary.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/data_dictionary.md) หรือเปิดดูบนเว็บที่ [data_dictionary.html](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/data_dictionary.html)
- **แบบจำลองฐานข้อมูล (ER Diagram)**: [docs/er_diagram.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/er_diagram.md)
- **กระแสข้อมูลระบบ (DFD)**: [docs/dfd.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/dfd.md)
- **แผนภาพบริบท (Context Diagram)**: [docs/context_diagram.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/context_diagram.md)
