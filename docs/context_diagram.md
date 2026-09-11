# ResolvNow Context Diagram (ภาพรวมระบบ)

แผนภาพ Context Diagram นี้แสดงการโต้ตอบระหว่าง **ระบบ ResolveNow** กับ **ผู้ใช้งาน (External Entities)** และ **ระบบภายนอกอื่นๆ**

```mermaid
flowchart LR
    %% External Entities
    Citizen["👨‍👩‍👧‍👦 ประชาชน (Citizen)"]
    Technician["👷 ช่าง (Technician)"]
    Admin["👨‍💻 ผู้ดูแลระบบ (Admin)"]
    CEO["👔 ผู้บริหาร (CEO Dashboard)"]
    
    %% The System
    System(("🖥️ ระบบรับแจ้งเรื่องร้องเรียน<br>ResolveNow"))

    %% Subgraph for External Services
    subgraph ExternalServices [ระบบภายนอก]
        direction TB
        LineNotify["📲 LINE Notify"]
        LineLogin["🔐 LINE Login"]
        LineLIFF["📱 LINE LIFF"]
        Cloudinary["☁️ Cloudinary"]
        Email["📧 Email Service"]
        MongoDB["🗄️ MongoDB Atlas"]
        AIService["🤖 AI Service (Claude/Gemini)"]
    end

    %% Interactions: Citizen
    Citizen -- "แจ้งเรื่อง / ติดตาม / แชทตั๋ว / Direct Message" --> System
    System -- "แสดงสถานะ / Heatmap / ข้อความตอบกลับ" --> Citizen
    Citizen -. "ให้คะแนน" .-> LineLIFF
    LineLIFF -. "ส่งคะแนน" .-> System
    Citizen -. "ล็อกอินด้วย LINE" .-> LineLogin
    
    %% Interactions: Technician
    Technician -- "อัปโหลดรูป / เปลี่ยนสถานะ / ขอความช่วยเหลือ" --> System
    System -- "แจ้งงานที่รับผิดชอบ / คำขอช่วยเหลือ" --> Technician
    
    %% Interactions: Admin
    Admin -- "จัดการหมวดหมู่ / มอบหมายงาน / ตอบ DM" --> System
    System -- "แสดงรายงาน / Dashboard / DM Inbox" --> Admin

    %% Interactions: CEO
    CEO -- "เข้าดูสถิติภาพรวม (Read-only)" --> System
    System -- "สรุปภาพรวม / SLA Metrics / Heatmap" --> CEO

    %% Interactions: External Services
    System -- "บันทึก/ดึงข้อมูล (7 Collections)" --> MongoDB
    MongoDB -- "ข้อมูลที่จัดเก็บ" --> System

    System -- "ส่ง OTP" --> Email
    Email -- "ส่งเมล์" --> Citizen

    System -- "อัปโหลดรูป" --> Cloudinary
    Cloudinary -- "URL" --> System

    System -- "วิเคราะห์ความเร่งด่วน" --> AIService
    AIService -- "Urgency & Category" --> System

    System -- "ส่งแจ้งเตือน (Push)" --> LineNotify
    LineNotify -- "LINE Message" --> Citizen
    LineNotify -- "LINE Message" --> Technician
    LineNotify -- "LINE Message" --> Admin
    
    System -- "Verify Callback" --> LineLogin
    LineLogin -- "User Profile Data" --> System

    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px;
    classDef system fill:#e1f5fe,stroke:#0277bd,stroke-width:2px,font-weight:bold;
    class System system;
```

## คำอธิบายสัญลักษณ์และปฏิสัมพันธ์
1. **ระบบหลัก (วงกลมตรงกลาง):** `ResolvNow` เป็นศูนย์กลางการประมวลผลข้อมูล (Node.js/Express + Socket.IO + SLA Engine)
2. **ผู้ใช้งานระบบ (ฝั่งซ้าย):**
   - **ประชาชน (Citizen):** ผู้แจ้งเรื่อง, ติดตามสถานะ, สนทนาในตั๋ว, แชทตรงกับ Admin (DM) และให้คะแนนประเมิน
   - **ช่าง (Technician):** ผู้รับผิดชอบงานซ่อมบำรุงในหมวดหมู่ที่ตนเองดูแล, ร้องขอความช่วยเหลือข้ามฝ่าย
   - **ผู้ดูแลระบบ (Admin):** ผู้ควบคุมระบบ, มอบหมายงาน, จัดการหมวดหมู่, ตอบแชท DM และดูสถิติเชิงลึก
   - **ผู้บริหาร (CEO):** ผู้เข้าดูข้อมูลสรุปภาพรวม สถิติ SLA และความพึงพอใจแบบ Read-only โดยไม่ต้องล็อกอิน
3. **ระบบภายนอกที่นำมาเชื่อมต่อ (ฝั่งขวา):**
   - **MongoDB Atlas:** ฐานข้อมูลหลักของระบบ (รองรับ 7 Collections)
   - **Cloudinary:** บริการฝากไฟล์รูปภาพทั้งหมด ปรับขนาดและบีบอัดอัตโนมัติ
   - **Email Service (Nodemailer / SendGrid):** สำหรับส่งรหัส OTP ทางอีเมล
   - **LINE Login / LIFF / Notify:** บริการของ LINE สำหรับ Social Login, ระบบประเมินความพึงพอใจ และการแจ้งเตือนแบบ Push Notifications
   - **AI Service (Anthropic Claude / Google Gemini):** ประเมินระดับความเร่งด่วนและจำแนกปัญหาอัตโนมัติ
