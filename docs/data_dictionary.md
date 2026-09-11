# Data Dictionary - ResolvNow

เอกสารนี้อธิบายรายละเอียดของแต่ละคอลเลกชัน (Collection/Table) ฟิลด์ (Field) และชนิดข้อมูล (Data Type) ที่ใช้ในฐานข้อมูล MongoDB ของระบบ ResolvNow

## 1. Collection: Users
จัดเก็บข้อมูลผู้ใช้งานระบบทุกบทบาท (ประชาชน, ช่าง, แอดมิน)

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสผู้ใช้งาน (Primary Key) |
| `firstName` | String | Yes | ชื่อจริง |
| `lastName` | String | Yes | นามสกุล |
| `email` | String | Yes | อีเมล (ต้องไม่ซ้ำกัน / Unique) |
| `password` | String | Yes | รหัสผ่านที่ถูกเข้ารหัสด้วย bcrypt |
| `role` | String | Yes | บทบาท: `citizen`, `technician`, `admin` |
| `specialty` | String | No | ความเชี่ยวชาญของช่าง อ้างอิงตาม `Category.name` |
| `lineUserId` | String | No | รหัสผู้ใช้ LINE (สำหรับ Push Notify & Login) |
| `lineDisplayName`| String | No | ชื่อผู้ใช้บน LINE |
| `avatar` | String | No | URL ของรูปโปรไฟล์ |
| `createdViaLine`| Boolean | No | `true` หากสมัคสมาชิกผ่าน LINE |
| `createdAt` | Date | Yes | วันเวลาที่สร้างบัญชี |
| `updatedAt` | Date | Yes | วันเวลาที่อัปเดตบัญชี |

## 2. Collection: Tickets
จัดเก็บข้อมูลการแจ้งเรื่องร้องเรียน

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสเอกสาร |
| `ticketId` | String | Yes | รหัสตั๋วที่อ่านง่าย เช่น `TKT-001` (Unique) |
| `citizenId` | ObjectId | Yes | อ้างอิงรหัสผู้แจ้ง (`User._id`) |
| `citizenName` | String | Yes | ชื่อผู้แจ้ง (Denormalized) |
| `citizenLineId`| String | No | LINE ID ผู้แจ้ง สำหรับแจ้งเตือนและ LIFF |
| `category` | String | Yes | หมวดหมู่ปัญหา อ้างอิงตาม `Category.name` |
| `description` | String | Yes | รายละเอียดปัญหาที่แจ้ง |
| `location` | String | Yes | ที่อยู่หรือสถานที่เกิดเหตุ |
| `lat` | Number | Yes | พิกัดละติจูด |
| `lng` | Number | Yes | พิกัดลองจิจูด |
| `urgency` | String | Yes | ความเร่งด่วน: `normal`, `medium`, `urgent` |
| `priorityScore`| Number | Yes | คะแนนความสำคัญ 0-100 (มีผลกับ SLA และ UI) |
| `status` | String | Yes | สถานะ: `pending`, `assigned`, `in_progress`, `completed`, `rejected` |
| `assignedTo` | ObjectId | No | อ้างอิงช่างที่รับผิดชอบ (`User._id`) |
| `assignedName` | String | No | ชื่อช่างที่รับผิดชอบ (Denormalized) |
| `rejectReason` | String | No | เหตุผลที่ปฏิเสธงาน (ถ้า `status=rejected`) |
| `citizenImage` | String | No | URL รูปภาพที่ประชาชนแนบมาตอนแจ้ง |
| `beforeImage` | String | No | URL รูปภาพก่อนการแก้ไข (ช่างอัปโหลด) |
| `afterImage` | String | No | URL รูปภาพหลังการแก้ไข (ช่างอัปโหลด) |
| `rating` | Number | No | คะแนนประเมิน 1-5 ดาว |
| `ratingReason` | String | No | ความคิดเห็นเพิ่มเติมในการประเมิน |
| `ratedAt` | Date | No | เวลาที่ให้คะแนน |
| `slaAssignDeadline`| Date | Yes | เส้นตายในการรับงาน (ขึ้นกับความเร่งด่วน) |
| `slaCompleteDeadline`| Date| No | เส้นตายในการแก้ไขงานเสร็จ |
| `slaBreached` | Boolean | Yes | `true` หากทำงานเกินเวลา SLA |
| `upvotes` | Array | No | รายการผู้กดโหวต `[{userId, createdAt}]` |
| `upvoteCount` | Number | Yes | จำนวนคนโหวต (Default: 0) |
| `followers` | Array | No | รายการผู้ติดตาม `[{userId, lineUserId}]` |
| `followerCount`| Number | Yes | จำนวนผู้ติดตาม (Default: 0) |
| `chatExpiresAt`| Date | No | เวลาที่ปิดการสนทนาของตั๋วนี้ |
| `createdAt` | Date | Yes | วันเวลาที่สร้างตั๋ว |
| `updatedAt` | Date | Yes | วันเวลาที่อัปเดตตั๋ว |

## 3. Collection: Categories
จัดเก็บข้อมูลหมวดหมู่ของปัญหา

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสหมวดหมู่ |
| `name` | String | Yes | ชื่อภาษาอังกฤษ/คีย์หลัก (e.g. `Road`) Unique |
| `label` | String | Yes | ชื่อแสดงผลภาษาไทย (e.g. `ถนน/ทางเท้า`) |
| `icon` | String | Yes | ไอคอน (Emoji) |
| `technicianIds`| Array | Yes | อาเรย์ของ `User._id` ของช่างในหมวดนี้ |
| `isDefault` | Boolean | Yes | `true` หากเป็นหมวดหมู่พื้นฐาน (ห้ามลบ) |
| `createdAt` | Date | Yes | วันเวลาที่สร้าง |
| `updatedAt` | Date | Yes | วันเวลาที่อัปเดต |

## 4. Collection: Comments
จัดเก็บข้อความสนทนา (Chat) ในแต่ละการแจ้งเรื่อง

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสข้อความ |
| `ticketId` | String | Yes | รหัสตั๋วที่สนทนา เช่น `TKT-001` (Indexed) |
| `userId` | ObjectId | Yes | รหัสผู้ส่ง (`User._id`) |
| `userName` | String | Yes | ชื่อผู้ส่ง |
| `userRole` | String | Yes | บทบาทของผู้ส่ง |
| `message` | String | Yes | เนื้อหาข้อความ (สูงสุด 500 ตัวอักษร) |
| `createdAt` | Date | Yes | วันเวลาที่ส่ง |
| `updatedAt` | Date | Yes | วันเวลาที่แก้ไข |

## 5. Collection: HelpRequests
จัดเก็บคำขอความช่วยเหลือข้ามหมวดหมู่ของช่าง

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสคำขอ |
| `helpId` | String | Yes | รหัสคำขอที่อ่านง่าย เช่น `HELP-001` (Unique) |
| `citizenId` | ObjectId | Yes | รหัสผู้แจ้งของตั๋วต้นทาง (`User._id`) |
| `citizenName` | String | Yes | ชื่อผู้แจ้งของตั๋วต้นทาง |
| `message` | String | Yes | ข้อความอธิบายเหตุผลที่ขอความช่วยเหลือ |
| `status` | String | Yes | สถานะ: `open`, `resolved`, `accepted`, `cancelled` |
| `ticketId` | String | Yes | รหัสตั๋วต้นทาง (`Ticket.ticketId`) |
| `ticketCategory`| String | Yes | หมวดหมู่ตั๋วต้นทาง |
| `ticketLocation`| String | Yes | สถานที่ของตั๋วต้นทาง |
| `ticketDesc` | String | Yes | รายละเอียดของตั๋วต้นทาง |
| `requesterId` | ObjectId | Yes | รหัสช่างผู้ร้องขอ (`User._id`) |
| `requesterName`| String | Yes | ชื่อช่างผู้ร้องขอ |
| `requesterDept`| String | Yes | หมวดหมู่ของช่างผู้ร้องขอ |
| `targetDept` | String | Yes | หมวดหมู่เป้าหมายที่ต้องการขอความช่วยเหลือ |
| `acceptedById` | ObjectId | No | รหัสช่างที่กดรับคำขอช่วยเหลือ |
| `acceptedByName`| String | No | ชื่อช่างที่กดรับคำขอช่วยเหลือ |
| `createdAt` | Date | Yes | วันเวลาที่สร้างคำขอ |
| `updatedAt` | Date | วันเวลาที่อัปเดตคำขอ |

## 6. Collection: DirectMessages
เก็บข้อความ Direct Message (DM) ระหว่างประชาชน (citizen) กับผู้ดูแลระบบ (admin) โดยตรง
แต่ละ document ผูกกับ `citizenId` ซึ่งระบุ conversation (1 citizen = 1 thread)
มี compound index บน `{citizenId, createdAt}` สำหรับ query เร็ว

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสเอกสาร (Primary Key) |
| `senderId` | ObjectId | Yes | อ้างอิง `User._id` ของผู้ส่งข้อความ (citizen หรือ admin) |
| `senderName` | String | Yes | ชื่อผู้ส่งข้อความ (Denormalized) |
| `senderRole` | String | Yes | บทบาทผู้ส่ง: `citizen`, `admin` |
| `citizenId` | ObjectId | Yes | อ้างอิง `User._id` ของประชาชนใน conversation นี้ (Indexed) |
| `message` | String | Yes | เนื้อหาข้อความ (สูงสุด 500 ตัวอักษร) |
| `isRead` | Boolean | No | `false` = ยังไม่ได้อ่าน (default); `true` = อ่านแล้ว |
| `createdAt` | Date | Yes | วันเวลาที่ส่งข้อความ |
| `updatedAt` | Date | Yes | วันเวลาที่อัปเดต |

## 7. Collection: Counters
ใช้สำหรับการรันหมายเลขอัตโนมัติ (Auto-increment)

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสตัวนับ |
| `name` | String | Yes | ชื่อของตัวนับ (e.g. `ticket`, `help`) Unique |
| `seq` | Number | Yes | ลำดับปัจจุบัน (เริ่มต้น 0) |
