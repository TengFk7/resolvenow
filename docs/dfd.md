# Data Flow Diagram (DFD) - ResolvNow
> อัปเดตล่าสุด: 2026-09-18 | Version: V18.0

เอกสารนี้แสดงแผนภาพกระแสข้อมูล (Data Flow Diagram) ของระบบ ResolveNow (V18.0) ตั้งแต่ระดับภาพรวม (Level 0) จนถึงระดับกระบวนการย่อย (Level 1) รองรับ 7 Data Stores, ระบบรักษาความปลอดภัย Security Gate, การวิเคราะห์เชิงพื้นที่ (District Analytics), ระบบงบประมาณ/วัสดุ, และการส่งอีเมลแบบ Triple-Provider

---

## DFD Level 0 (Context Level DFD)
แผนภาพบริบทแสดงภาพรวมการไหลของข้อมูลระหว่างระบบ ResolveNow กับผู้ใช้งานและบริการภายนอก

```mermaid
graph TD
    %% Entities
    Citizen["ประชาชน (Citizen)"]
    PublicUser["ประชาชนทั่วไป (Public Tracker)"]
    Tech["ช่างปฏิบัติงาน (Technician)"]
    Admin["ผู้ดูแลระบบ (Admin)"]
    CEO["ผู้บริหาร (CEO Dashboard)"]
    ExtServices["บริการภายนอก\n(LINE / Triple Mailer / Cloudinary / AI)"]

    %% Process
    System(("ResolveNow (V18.0)\nระบบรับแจ้งเรื่องร้องเรียน\nและบริหารงานซ่อมบำรุง"))

    %% Data Flow Citizen
    Citizen -- ข้อมูลส่วนตัว / OTP / รหัสผ่าน / Security Gate --> System
    System -- สถานะเซสชัน / ข้อมูลผู้ใช้ --> Citizen
    
    Citizen -- ข้อมูลแจ้งเรื่อง / รูปภาพ / GPS / ยื่น Re-open --> System
    System -- รหัสติดตาม (Ticket ID) / สถานะงาน / Heatmap --> Citizen
    
    Citizen -- ข้อความแชทตั๋ว / Direct Message / โหวต / ติดตาม --> System
    System -- ข้อความสนทนา / แจ้งเตือนสถานะเรียลไทม์ --> Citizen

    %% Data Flow Public User
    PublicUser -- รหัส Ticket ID ที่ต้องการค้นหา --> System
    System -- ข้อมูลขั้นตอนการดำเนินงาน (Masked PII) --> PublicUser

    %% Data Flow Technician
    Tech -- ข้อมูลเข้าสู่ระบบ / Security Gate Passcode --> System
    System -- คิวงานที่ได้รับมอบหมายตามสังกัด --> Tech
    
    Tech -- รูปภาพ Before-After / สถานะงาน / บันทึกวัสดุ / เซ็นใบงาน --> System
    Tech -- ขอพักเวลา SLA / ขอความช่วยเหลือข้ามฝ่าย --> System
    System -- ผลการอนุมัติ SLA / งานที่ได้รับความช่วยเหลือ --> Tech

    %% Data Flow Admin
    Admin -- ข้อมูลเข้าสู่ระบบ / Gate Passcode --> System
    System -- Dashboard / คิวงาน / DM Inbox / แผนที่ความร้อน --> Admin
    
    Admin -- มอบหมายงาน / จัดการหมวด / รวมตั๋วซ้ำ / อนุมัติ SLA / ทดสอบเมล --> System
    System -- รายงานประจำเดือน (Excel/CSV) / ผลทดสอบอีเมล --> Admin

    %% Data Flow CEO
    CEO -- Gate Passcode / คำขอข้อมูลสถิติภาพรวม (Read-only) --> System
    System -- สถิติ SLA / งบประมาณรายเดือน / District Analytics (Masked PII) --> CEO

    %% Data Flow External Services
    System -- ส่ง OTP / ทดสอบเมล / อัปโหลดรูป / แจ้งเตือน LINE / วิเคราะห์ AI --> ExtServices
    ExtServices -- ผลการทำงาน / Callback Token / Image URL / Urgency Level --> System
```

---

## DFD Level 1
แผนภาพกระแสข้อมูลระดับที่ 1 แสดงกระบวนการหลัก 5 ด้านภายในระบบ ResolveNow และการเชื่อมโยงกับ 7 Data Stores

```mermaid
graph TD
    %% Entities
    Citizen["ประชาชน (Citizen)"]
    PublicUser["ประชาชนทั่วไป (Public Tracker)"]
    Tech["ช่าง (Technician)"]
    Admin["ผู้ดูแลระบบ (Admin)"]
    CEO["ผู้บริหาร (CEO)"]
    ExtServices["บริการภายนอก\n(LINE/Mailer/Cloudinary/AI)"]

    %% Data Stores
    D1[(D1: Users)]
    D2[(D2: Tickets)]
    D3[(D3: Categories)]
    D4[(D4: Comments)]
    D5[(D5: Help Requests)]
    D6[(D6: Direct Messages)]
    D7[(D7: Counters)]

    %% Processes
    P1(("1.0\nยืนยันตัวตนและ Security Gate\n(Auth & Security Gate)"))
    P2(("2.0\nจัดการตั๋ว SLA และงานภาคสนาม\n(Tickets, SLA & Field Ops)"))
    P3(("3.0\nจัดการหมวดหมู่และภาระงานช่าง\n(Category & Capacity)"))
    P4(("4.0\nการสื่อสารและการมีส่วนร่วม\n(Chat, DM & Community)"))
    P5(("5.0\nรายงาน สถิติเชิงพื้นที่ และแจ้งเตือน\n(Analytics, Reports & Push)"))

    %% Flows - Process 1.0 (Auth & Gate)
    Citizen -- สมัคร / Login / LINE SSO --> P1
    Tech -- Login / Gate Passcode --> P1
    Admin -- Login / Gate Passcode / Test Email --> P1
    CEO -- Gate Passcode --> P1
    P1 -- ส่ง OTP / LINE OAuth / ทดสอบส่งเมล --> ExtServices
    ExtServices -- ผลลัพธ์ยืนยัน / Profile Data --> P1
    P1 -- บันทึก / ตรวจสอบสิทธิ์ผู้ใช้ --> D1
    D1 -- ข้อมูลสิทธิ์และบทบาท --> P1
    P1 -- Session State / Gate Unlocked --> Citizen
    P1 -- Session State / Gate Unlocked --> Tech
    P1 -- Session State / Gate Unlocked --> Admin
    P1 -- Gate Unlocked --> CEO

    %% Flows - Process 2.0 (Tickets & SLA Ops)
    Citizen -- สร้างเรื่องร้องเรียน / แนบรูป / ยื่น Re-open --> P2
    P2 -- ขอรหัสลำดับถัดไป (Atomic) --> D7
    D7 -- คืนค่าเลขรันตั๋ว TKT-xxxxx --> P2
    P2 -- สกัดพิกัดและคำนวณ Urgency (Cognitive Thai NLP/AI) --> ExtServices
    P2 -- อัปโหลดรูปภาพ --> ExtServices
    P2 -- บันทึก Ticket, Deadlines, District, Timeline --> D2
    D2 -- ข้อมูลงาน --> P2
    P2 -- สถานะงาน / รหัส Ticket ID --> Citizen
    PublicUser -- ค้นหาด้วย Ticket ID --> P2
    P2 -- ข้อมูลสถานะงาน (Masked PII) --> PublicUser

    Tech -- อัปรูป Before-After / อัปเดตสถานะ / บันทึกวัสดุ / เซ็นใบงาน --> P2
    Tech -- ส่งคำขอพักเวลา SLA / ขอความช่วยเหลือข้ามแผนก --> P2
    P2 -- บันทึกคำขอความช่วยเหลือ --> D5
    D5 -- รายการคำขอที่ช่างอื่นส่งมา --> P2
    Admin -- มอบหมายงาน / รวมตั๋วซ้ำ / อนุมัติพักเวลา SLA --> P2
    P2 -- บันทึกการเปลี่ยนแปลงและ Audit Timeline --> D2

    %% Flows - Process 3.0 (Category & Capacity)
    Admin -- เพิ่ม/แก้ไข/ลบหมวดหมู่ / ผูกช่าง --> P3
    P3 -- บันทึกข้อมูลหมวดหมู่ --> D3
    P3 -- ถ่ายโอนตั๋วเมื่อลบหมวดหมู่ --> D2
    P3 -- อัปเดตสังกัดและความเชี่ยวชาญช่าง --> D1
    D3 -- หมวดหมู่ไดนามิกและรายชื่อช่าง --> P2

    %% Flows - Process 4.0 (Chat, DM & Community)
    Citizen -- คอมเมนต์ในตั๋ว / โหวต / ติดตาม --> P4
    Tech -- คอมเมนต์ในตั๋ว --> P4
    P4 -- บันทึกข้อความคอมเมนต์ --> D4
    P4 -- อัปเดตจำนวนโหวตและรายชื่อผู้ติดตาม --> D2
    D4 -- ประวัติข้อความในตั๋ว --> P4
    P4 -- แสดงข้อความสนทนาในตั๋ว (Socket.IO) --> Citizen
    P4 -- แสดงข้อความสนทนาในตั๋ว (Socket.IO) --> Tech

    Citizen -- แชทตรง 1-on-1 (Direct Message) --> P4
    Admin -- ตอบกลับ Direct Message --> P4
    P4 -- บันทึกข้อความ DM แยก Thread ตาม Citizen --> D6
    D6 -- ประวัติข้อความ DM --> P4
    P4 -- แสดงข้อความ DM เรียลไทม์ --> Citizen
    P4 -- รวมข้อความใน Unified Admin DM Inbox --> Admin

    %% Flows - Process 5.0 (Analytics, Reports & Push)
    D2 -- ข้อมูลตั๋ว, SLA, งบประมาณ, District --> P5
    D1 -- สถิติผู้ใช้และช่าง --> P5
    D3 -- สัดส่วนหมวดหมู่ปัญหา --> P5
    P5 -- รายงานสรุปประจำเดือน (Excel/CSV) --> Admin
    P5 -- SLA Compliance, กราฟงบประมาณ, District Analytics --> CEO
    P5 -- Heatmap แสดงความหนาแน่นของปัญหา --> Citizen
    P5 -- ส่ง Flex Messages แจ้งเตือนสถานะตั๋ว (LINE Push) --> ExtServices
```
