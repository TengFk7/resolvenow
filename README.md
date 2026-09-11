# 🏙️ ResolveNow (ระบบรับแจ้งเรื่องร้องเรียนอัจฉริยะ)

> **ResolveNow** เป็นเว็บแอปพลิเคชันรูปแบบ Single-Page Application (SPA) สำหรับบริหารจัดการและรับแจ้งเรื่องร้องเรียนของเทศบาลและเมืองอัจฉริยะ (Smart City) เชื่อมต่อประชาชน ช่างผู้ปฏิบัติงาน และผู้ดูแลระบบแบบเรียลไทม์ พร้อมการแจ้งเตือนผ่าน LINE, ระบบวิเคราะห์ความเร่งด่วนด้วย AI, แผนที่ Heatmap และระบบ SLA อัตโนมัติ

---

## 🌟 ฟีเจอร์หลัก (Key Features)

### 🏠 ประชาชน (Citizen)
- **แจ้งเรื่องร้องเรียนง่ายดาย**: ระบุพิกัดอัตโนมัติด้วย GPS Reverse Geocoding (OpenStreetMap Nominatim) และแนบรูปภาพได้สูงสุด 5 ภาพ
- **ติดตามสถานะเรียลไทม์**: ตรวจสอบสถานะการดำเนินงานของเจ้าหน้าที่ได้ทันทีผ่านระบบ Socket.IO
- **ระบบมีส่วนร่วมของชุมชน (Community Upvote & Follow)**: สามารถกดโหวตเพื่อดันปัญหาที่สำคัญ และกดติดตามเพื่อรับแจ้งเตือนความคืบหน้าทาง LINE
- **สนทนาโดยตรงกับเจ้าหน้าที่ (Direct Message)**: แชทตรงกับ Admin เพื่อสอบถามข้อสงสัยได้ตลอดเวลา
- **ประเมินความพึงพอใจ**: ให้คะแนน 1-5 ดาว และแสดงความคิดเห็นผ่านหน้าเว็บหรือทาง LINE LIFF (In-App Browser)

### 👷 ช่าง/เจ้าหน้าที่ผู้ปฏิบัติงาน (Technician)
- **จัดการงานตามความเชี่ยวชาญ**: คัดกรองและรับงานซ่อมแซมตามหมวดหมู่ที่ได้รับมอบหมาย
- **บันทึกหลักฐานก่อน-หลังซ่อม**: อัปโหลดรูปภาพ Before & After เพื่อความโปร่งใสในการปิดงาน
- **ระบบขอความช่วยเหลือข้ามฝ่าย (Help Requests)**: ขอความช่วยเหลือจากช่างฝ่ายอื่นเมื่อพบปัญหาที่ต้องใช้ทักษะเฉพาะทาง

### 👨‍💼 ผู้ดูแลระบบ (Admin)
- **Dispatching & Workload Management**: มอบหมายงานให้ช่างที่เหมาะสม ตรวจสอบภาระงาน (Workload Capacity)
- **จัดการหมวดหมู่ปัญหา (Dynamic Categories)**: เพิ่ม แก้ไข หรือปิดหมวดหมู่ และผูกช่างเข้ากับหมวดหมู่ตามต้องการ
- **Direct Message Inbox**: ตอบกลับข้อความจากประชาชนแบบศูนย์รวม (Unified Inbox)
- **รายงานและสถิติเชิงลึก**: ดาวน์โหลดรายงานสรุปเป็นไฟล์ Excel (.xlsx) และ CSV

### 📊 ผู้บริหาร (CEO Read-Only Dashboard)
- แดชบอร์ดสรุปสถิติภาพรวม การกระจายตัวของปัญหา และการปฏิบัติตามมาตรฐาน SLA แบบเรียลไทม์ โดยไม่ต้องล็อกอินและไม่มีข้อมูลส่วนบุคคล (Privacy Masked)

---

## 🛠️ เทคโนโลยีที่ใช้งาน (Tech Stack)

- **Backend**: Node.js (v18+), Express.js 4
- **Database**: MongoDB Atlas, Mongoose 9 (Compound Indexes สำหรับ High-performance Query)
- **Session Management**: express-session, connect-mongo v6
- **Real-Time Communication**: Socket.IO v4
- **Storage**: Cloudinary (ปรับขนาดภาพและบีบอัดอัตโนมัติ), Fallback Local Storage
- **Notifications & Social**: LINE Messaging API (Flex Messages), LINE Login OAuth2, LINE LIFF 2.x
- **Email & OTP**: Nodemailer (Gmail SMTP), SendGrid API
- **AI Service**: Anthropic Claude & Google Gemini
- **Frontend**: Vanilla HTML5, Modern CSS3, JavaScript (SPA ไร้ Framework)
- **GIS & Mapping**: Leaflet.js, OpenStreetMap

---

## 🚀 การเริ่มต้นใช้งาน (Quick Start)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env` และกรอกการตั้งค่าต่าง ๆ:
```bash
cp .env.example .env
```
*(ดูรายละเอียดเพิ่มเติมได้ที่ [SYSTEM_CONTEXT.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/SYSTEM_CONTEXT.md))*

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

เมื่อรันระบบครั้งแรก ระบบจะทำการสร้างบัญชีสำหรับทดสอบให้อัตโนมัติ:

| บทบาท | อีเมล | รหัสผ่าน | ชื่อ | ฝ่าย / แผนก |
|---|---|---|---|---|
| **Admin** | `admin@resolvenow.th` | `admin1234` | Admin Dispatcher | ศูนย์สั่งการ |
| **Tech 1** | `tech1@resolvenow.th` | `tech1234` | วิชัย โยธา | ถนน/ทางเท้า (`Road`) |
| **Tech 2** | `tech2@resolvenow.th` | `tech1234` | มานะ ประปา | ท่อแตก/น้ำไม่ไหล (`Water`) |
| **Tech 3** | `tech3@resolvenow.th` | `tech1234` | สมชาย ไฟฟ้า | ไฟฟ้าสาธารณะดับ (`Electricity`) |
| **Tech 4** | `tech4@resolvenow.th` | `tech1234` | สุรัตน์ สุขา | ขยะตกค้าง (`Garbage`) |
| **Tech 5** | `tech5@resolvenow.th` | `tech1234` | บุญมี ปราบ | สัตว์มีพิษ/จรจัด (`Animal`) |
| **Tech 6** | `tech6@resolvenow.th` | `tech1234` | สมศรี ป่าไม้ | กิ่งไม้วางทาง (`Tree`) |
| **Tech 7** | `tech7@resolvenow.th` | `tech1234` | อนันต์ กู้ภัย | เพลิง/ภัยพิบัติ (`Hazard`) |
| **Citizen** | `tenginpb@gmail.com` | `123456` | Teng Teng | ประชาชนทดสอบ |

---

## 📚 เอกสารประกอบระบบ (Documentation)

- **สำหรับ AI Assistant**: อ่านคู่มือบริบทระบบฉบับสมบูรณ์ที่ [SYSTEM_CONTEXT.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/SYSTEM_CONTEXT.md)
- **แบบจำลองฐานข้อมูล (ER Diagram)**: [docs/er_diagram.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/er_diagram.md)
- **พจนานุกรมข้อมูล (Data Dictionary)**: [docs/data_dictionary.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/data_dictionary.md) หรือเปิดดูแบบเว็บที่ [data_dictionary.html](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/data_dictionary.html)
- **กระแสข้อมูลระบบ (DFD)**: [docs/dfd.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/dfd.md)
- **แผนภาพบริบท (Context Diagram)**: [docs/context_diagram.md](file:///c:/Users/TENG/OneDrive/Desktop/ResolvNow/docs/context_diagram.md)
