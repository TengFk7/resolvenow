# ResolvNow Context Diagram (ภาพรวมระบบ)
> อัปเดตล่าสุด: 2026-09-18 | Version: V18.0

แผนภาพ Context Diagram นี้แสดงการโต้ตอบระหว่าง **ระบบ ResolveNow (V18.0)** กับ **ผู้ใช้งานทุกบทบาท (External Entities)** และ **ระบบภายนอกอื่นๆ**

```mermaid
flowchart LR
    %% External Entities (Users)
    Citizen["👨‍👩‍👧‍👦 ประชาชน (Citizen)"]
    PublicUser["🔍 ประชาชนทั่วไป (Public Tracker)"]
    Technician["👷 ช่างปฏิบัติงาน (Technician)"]
    Admin["👨‍💻 ผู้ดูแลระบบ (Admin Dispatcher)"]
    CEO["👔 ผู้บริหาร (CEO Dashboard)"]
    
    %% The System
    System(("🖥️ ระบบรับแจ้งเรื่องร้องเรียน<br>และงานซ่อมบำรุงเมือง<br>ResolveNow (V18.0)"))

    %% Subgraph for External Services
    subgraph ExternalServices [ระบบภายนอกและโครงสร้างพื้นฐาน]
        direction TB
        LineNotify["📲 LINE Messaging API (Flex)"]
        LineLogin["🔐 LINE Login OAuth2"]
        LineLIFF["📱 LINE LIFF 2.x"]
        Cloudinary["☁️ Cloudinary Storage"]
        Email["📧 Triple-Provider Mailer<br>(Gmail / SendGrid / Resend)"]
        MongoDB["🗄️ MongoDB Atlas (7 Collections)"]
        AIService["🤖 Cognitive Thai NLP & AI<br>(5-Layer Engine / Claude / Gemini)"]
    end

    %% Interactions: Citizen
    Citizen -- "แจ้งเรื่อง 5 ขั้นตอน / พิกัด GPS / แชทตั๋ว / Direct Message / โหวต / Re-open" --> System
    Citizen -- "เปิดหน้าต่างเว็บแยก /my-tickets ผ่าน Drawer (ตรวจสอบความปลอดภัย 6 ชั้น)" --> System
    System -- "สถานะงานเรียลไทม์ / Heatmap / ข้อความตอบกลับ / รายการตั๋วส่วนตัว (IDOR Scoped)" --> Citizen
    Citizen -. "ให้คะแนนความพึงพอใจ" .-> LineLIFF
    LineLIFF -. "ส่งคะแนนประเมิน" .-> System
    Citizen -. "ล็อกอิน SSO" .-> LineLogin

    %% Interactions: Public User
    PublicUser -- "ค้นหาด้วย Ticket ID" --> System
    System -- "แสดงสถานะงาน (Masked PII)" --> PublicUser
    
    %% Interactions: Technician
    Technician -- "อัปโหลด Before-After / บันทึกวัสดุ / ขอพักเวลา SLA / เซ็นใบงาน" --> System
    System -- "คิวงานตามความเชี่ยวชาญ / ผลอนุมัติ SLA / แผนที่นำทาง" --> Technician
    
    %% Interactions: Admin
    Admin -- "มอบหมายงาน / รวมตั๋วซ้ำ / อนุมัติพัก SLA / จัดการหมวด / ทดสอบอีเมล" --> System
    System -- "รายงานสถิติ (Excel/CSV) / DM Inbox / รายงานการส่งเมล" --> Admin

    %% Interactions: CEO
    CEO -- "เข้าดูสถิติภาพรวม / โหมดนำเสนอ" --> System
    System -- "SLA Compliance / งบประมาณรายเดือน / District Analytics (Masked PII)" --> CEO

    %% Interactions: External Services
    System -- "บันทึกและสืบค้นข้อมูล (CRUD, Compound Indexes)" --> MongoDB
    MongoDB -- "ผลลัพธ์ข้อมูล" --> System

    System -- "ส่งรหัส OTP / เมลทดสอบระบบ" --> Email
    Email -- "จัดส่งอีเมลยืนยันตัวตน" --> Citizen
    Email -- "รายงาน Latency และ Provider" --> System

    System -- "อัปโหลดภาพตั๋ว / Before / After" --> Cloudinary
    Cloudinary -- "Secure Image URL" --> System

    System -- "ส่งข้อความเพื่อจำแนกความเร่งด่วน" --> AIService
    AIService -- "Urgency Level (urgent/medium/normal)" --> System

    System -- "ส่งการแจ้งเตือนงานและการติดตาม (Push)" --> LineNotify
    LineNotify -- "Flex Messages" --> Citizen
    LineNotify -- "Flex Messages" --> Technician
    LineNotify -- "Flex Messages" --> Admin
    
    System -- "ยืนยัน OAuth2 Callback & State" --> LineLogin
    LineLogin -- "User Profile Data" --> System

    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px;
    classDef system fill:#e1f5fe,stroke:#0277bd,stroke-width:2px,font-weight:bold;
    class System system;
```

---

## คำอธิบายสัญลักษณ์และปฏิสัมพันธ์

1. **ระบบหลัก (วงกลมตรงกลาง):** `ResolveNow (V18.0)` ทำหน้าที่เป็นศูนย์กลางการประมวลผล (Node.js/Express + Socket.IO + SLA Engine + Cognitive Thai NLP + Health Checks)
2. **ผู้ใช้งานระบบ (ฝั่งซ้าย):**
   - **ประชาชน (Citizen):** แจ้งเรื่องร้องเรียน 5 ขั้นตอนพร้อมพิกัด GPS, แนบรูปได้สูงสุด 5 รูป, สนทนาในตั๋ว, แชทตรงกับ Admin (DM), กดโหวต/ติดตามปัญหา, และยื่นเรื่องขอเปิดงานใหม่ (Re-open)
   - **ประชาชนทั่วไป (Public User):** ติดตามสถานะความคืบหน้าของตั๋วผ่านหน้าระบบค้นหาสาธารณะ (`/track`) โดยมีการปกปิดข้อมูลส่วนบุคคลตามหลัก PDPA
   - **ช่างปฏิบัติงาน (Technician):** ดำเนินการงานตามความเชี่ยวชาญ, อัปโหลดรูปภาพ Before & After, บันทึกรายการอะไหล่และค่าใช้จ่าย, ขอพักเวลา SLA ชั่วคราวเมื่อรออะไหล่, ขอความช่วยเหลือข้ามฝ่าย, และบันทึกลายเซ็นดิจิทัลในใบสั่งงาน
   - **ผู้ดูแลระบบ (Admin Dispatcher):** ควบคุมคิวงาน, มอบหมายงานตาม Workload Capacity, ตรวจจับและรวมตั๋วที่ซ้ำซ้อนในรัศมีใกล้เคียง, อนุมัติการพักเวลา SLA, จัดการหมวดหมู่ไดนามิก, ตอบข้อความ DM รวมศูนย์ และใช้เครื่องมือทดสอบการส่งอีเมล
   - **ผู้บริหารระดับสูง (CEO):** ดูสรุปตัวชี้วัด SLA Compliance, สรุปงบประมาณค่าซ่อมบำรุงประจำเดือน, และการวิเคราะห์เชิงพื้นที่และงบประมาณแยกตามเขต (District Analytics) ในโหมด Read-only
3. **ระบบภายนอกที่นำมาเชื่อมต่อ (ฝั่งขวา):**
   - **MongoDB Atlas:** ฐานข้อมูล NoSQL หลัก จัดเก็บ 7 Collections พร้อม Compound Indexes
   - **Cloudinary:** บริการจัดเก็บและปรับแต่งภาพถ่ายอัตโนมัติ (พร้อมระบบ Local Disk Fallback)
   - **Triple-Provider Mailer:** ระบบส่งอีเมลสำรอง 3 ชั้น (Gmail SMTP SSL/TLS, SendGrid API, Resend API)
   - **LINE Login / LIFF / Messaging API:** บริการ LINE สำหรับ Single Sign-On, Flex Messages แจ้งเตือนสถานะ และ LINE LIFF สำหรับการประเมินผล
   - **Cognitive Thai NLP & AI Service:** ระบบจำแนกความเร่งด่วน 5 ชั้น (Cognitive Heuristics 134 Cases) เสริมด้วย Anthropic Claude และ Google Gemini
