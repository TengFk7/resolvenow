# Data Flow Diagram (DFD) - ResolvNow

เอกสารนี้แสดงแผนภาพกระแสข้อมูล (Data Flow Diagram) ของระบบ ResolvNow ตั้งแต่ระดับภาพรวม (Level 0) จนถึงระดับกระบวนการย่อย (Level 1) รองรับ 7 Data Stores

## DFD Level 0 (Context Diagram)
แผนภาพบริบท (Context Diagram) แสดงระบบในภาพรวมและการไหลของข้อมูลระหว่างระบบกับผู้ใช้งาน (External Entities)

```mermaid
graph TD
    %% Entities
    Citizen["ประชาชน (Citizen)"]
    Tech["ช่าง (Technician)"]
    Admin["ผู้ดูแลระบบ (Admin)"]
    CEO["ผู้บริหาร (CEO Dashboard)"]
    ExtServices["ระบบภายนอก\n(LINE/Email/Cloudinary/AI)"]

    %% Process
    System(("ResolveNow System\n(ระบบรับแจ้งเรื่องร้องเรียน)"))

    %% Data Flow Citizen
    Citizen -- ข้อมูลส่วนตัว / OTP / รหัสผ่าน --> System
    System -- สถานะการเข้าสู่ระบบ / ข้อมูลผู้ใช้ --> Citizen
    
    Citizen -- ข้อมูลการร้องเรียน / รูปภาพ / พิกัด --> System
    System -- รหัสติดตาม (Ticket ID) / สถานะงาน / Heatmap --> Citizen
    
    Citizen -- ข้อความคอมเมนต์ / Direct Message / โหวต / ติดตาม --> System
    System -- ข้อความสนทนา / แจ้งเตือนสถานะ --> Citizen

    %% Data Flow Technician
    Tech -- ข้อมูลเข้าสู่ระบบ --> System
    System -- งานที่ได้รับมอบหมาย (Assigned Tickets) --> Tech
    
    Tech -- รูปภาพก่อน-หลังซ่อม / สถานะงานใหม่ --> System
    Tech -- ร้องขอความช่วยเหลือ (Help Request) --> System
    System -- งานที่ขอความช่วยเหลือ --> Tech

    %% Data Flow Admin
    Admin -- ข้อมูลเข้าสู่ระบบ --> System
    System -- Dashboard / ข้อมูลสถิติ / แผนที่ / DM Inbox --> Admin
    
    Admin -- ข้อมูลหมวดหมู่ / จัดการผู้ใช้ / มอบหมายงาน / ตอบ DM --> System
    System -- รายงาน (Excel/CSV) --> Admin

    %% Data Flow CEO
    CEO -- ร้องขอข้อมูลสรุปภาพรวม (Read-only) --> System
    System -- ข้อมูลสถิติ / รายงาน SLA / Heatmap --> CEO

    %% Data Flow External
    System -- ส่งคำขอ OTP / API รูปภาพ / LINE Push / วิเคราะห์ AI --> ExtServices
    ExtServices -- ผลการทำงาน / ข้อมูลโปรไฟล์ / Image URL / Urgency Score --> System
```

## DFD Level 1
แผนภาพกระแสข้อมูลระดับที่ 1 แสดงกระบวนการหลักภายในระบบ ResolveNow และการเชื่อมต่อกับ 7 Data Stores

```mermaid
graph TD
    %% Entities
    Citizen["ประชาชน (Citizen)"]
    Tech["ช่าง (Technician)"]
    Admin["ผู้ดูแลระบบ (Admin)"]
    CEO["ผู้บริหาร (CEO)"]
    ExtServices["ระบบภายนอก\n(LINE/Email/Cloudinary/AI)"]

    %% Data Stores
    D1[(D1: Users)]
    D2[(D2: Tickets)]
    D3[(D3: Categories)]
    D4[(D4: Comments)]
    D5[(D5: Help Requests)]
    D6[(D6: Direct Messages)]
    D7[(D7: Counters)]

    %% Processes
    P1(("1.0\nจัดการผู้ใช้และยืนยันตัวตน\n(Authentication)"))
    P2(("2.0\nจัดการการร้องเรียนและ SLA\n(Ticket & SLA)"))
    P3(("3.0\nจัดการหมวดหมู่และช่าง\n(Category/Tech)"))
    P4(("4.0\nการสื่อสารและการแชท\n(Chat/DM/Vote)"))
    P5(("5.0\nระบบรายงาน สถิติ และแจ้งเตือน\n(Report/CEO/Notify)"))

    %% Flows - Authentication
    Citizen -- ข้อมูลสมัคร/Login --> P1
    Tech -- ข้อมูล Login --> P1
    Admin -- ข้อมูล Login --> P1
    P1 -- ส่งข้อมูล/OTP/LINE Token --> ExtServices
    ExtServices -- คืนค่า Auth Profile --> P1
    P1 -- บันทึก/ตรวจสอบ --> D1
    D1 -- คืนค่าสิทธิ์ --> P1
    P1 -- สถานะ Login / Session --> Citizen
    P1 -- สถานะ Login / Session --> Tech
    P1 -- สถานะ Login / Session --> Admin

    %% Flows - Ticket Management
    Citizen -- สร้างเรื่องร้องเรียน/รูป --> P2
    P2 -- ดึงรหัสตั๋วอัตโนมัติ --> D7
    D7 -- ลำดับถัดไป --> P2
    P2 -- วิเคราะห์ความเร่งด่วน --> ExtServices
    P2 -- อัปโหลดรูปภาพ --> ExtServices
    P2 -- บันทึก Ticket และ SLA Deadlines --> D2
    D2 -- ข้อมูลงาน --> P2
    P2 -- แจ้งสถานะ/รหัสติดตาม --> Citizen
    
    Tech -- เปลี่ยนสถานะ/อัปโหลดรูป Before-After --> P2
    Admin -- มอบหมายงานให้ช่าง --> P2
    P2 -- อัปเดตข้อมูล/ตรวจ SLA Breach --> D2
    P2 -- ร้องขอความช่วยเหลือข้ามฝ่าย --> D5
    D5 -- ข้อมูลคำขอ --> P2

    %% Flows - Categories
    Admin -- เพิ่ม/แก้ไข/ลบหมวดหมู่ --> P3
    Admin -- ผูกช่างกับหมวดหมู่ --> P3
    P3 -- บันทึกข้อมูลหมวดหมู่ --> D3
    P3 -- ถ่ายโอนตั๋วเมื่อลบหมวดหมู่ --> D2
    P3 -- อัปเดตทักษะช่าง --> D1
    D3 -- หมวดหมู่ไดนามิก --> P2
    
    %% Flows - Interaction
    Citizen -- คอมเมนต์ในตั๋ว/โหวต/Follow --> P4
    Tech -- คอมเมนต์ในตั๋ว --> P4
    P4 -- บันทึกคอมเมนต์ --> D4
    P4 -- อัปเดตโหวตและผู้ติดตาม --> D2
    D4 -- ประวัติคอมเมนต์ในตั๋ว --> P4
    P4 -- แสดงคอมเมนต์ตั๋ว --> Citizen

    Citizen -- แชทตรง Direct Message --> P4
    Admin -- ตอบกลับ Direct Message --> P4
    P4 -- บันทึก DM แยก Thread ตาม Citizen --> D6
    D6 -- ประวัติข้อความ DM --> P4
    P4 -- แสดงข้อความ DM เรียลไทม์ --> Citizen
    P4 -- แสดงข้อความ DM ใน Inbox --> Admin

    %% Flows - Reports & Notifications
    D2 -- ข้อมูลงาน/ประเมิน SLA เรียลไทม์ --> P5
    D1 -- ข้อมูลสถิติผู้ใช้ --> P5
    D3 -- สัดส่วนหมวดหมู่ --> P5
    P5 -- Dashboard/Report (Excel/CSV) --> Admin
    P5 -- สรุปภาพรวม/SLA Dashboard (Read-only) --> CEO
    P5 -- Heatmap/Public Tracker --> Citizen
    P5 -- แจ้งเตือนสถานะงาน (LINE Push) --> ExtServices
```
