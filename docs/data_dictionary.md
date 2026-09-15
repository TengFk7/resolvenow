# Data Dictionary - ResolvNow
> อัปเดตล่าสุด: 2026-09-15 | Version: V17.5

เอกสารนี้อธิบายรายละเอียดของแต่ละคอลเลกชัน (Collection), ฟิลด์ (Field) และชนิดข้อมูล (Data Type) ที่ใช้ในฐานข้อมูล MongoDB ของระบบ ResolvNow ครอบคลุมทั้ง 7 Collections

---

## 1. Collection: Users
จัดเก็บข้อมูลผู้ใช้งานระบบทุกบทบาท (ประชาชน, ช่าง, แอดมิน)

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสผู้ใช้งาน (Primary Key) |
| `firstName` | String | Yes | ชื่อจริงของผู้ใช้ |
| `lastName` | String | Yes | นามสกุลของผู้ใช้ |
| `email` | String | Yes | อีเมลสำหรับยืนยันตัวตนและแจ้งเตือน (Unique) |
| `password` | String | Yes | รหัสผ่านที่เข้ารหัสด้วย bcrypt (10 rounds) |
| `role` | String | Yes | บทบาท: `citizen`, `technician`, `admin` |
| `specialty` | String | No | หมวดหมู่ความเชี่ยวชาญของช่าง (อ้างอิง `Category.name`) |
| `lineUserId` | String | No | รหัสผู้ใช้ LINE UID สำหรับ Push Notification และ SSO |
| `lineDisplayName`| String | No | ชื่อโปรไฟล์ที่แสดงบน LINE |
| `avatar` | String | No | URL ของรูปภาพโปรไฟล์ |
| `createdViaLine`| Boolean | No | `true` หากสมัครบัญชีใหม่ผ่าน LINE Login |
| `createdAt` | Date | Yes | วันเวลาที่สร้างบัญชี |
| `updatedAt` | Date | Yes | วันเวลาที่แก้ไขข้อมูลล่าสุด |

---

## 2. Collection: Tickets
จัดเก็บข้อมูลเรื่องร้องเรียน งานซ่อมบำรุง การคำนวณ SLA งบประมาณ และประวัติกิจกรรม

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสเอกสาร (Primary Key) |
| `ticketId` | String | Yes | รหัสตั๋วที่อ่านเข้าใจง่าย เช่น `TKT-00001` (Unique) |
| `citizenId` | ObjectId | Yes | รหัสผู้แจ้ง อ้างอิงไปยัง `User._id` |
| `citizenName` | String | Yes | ชื่อผู้แจ้ง (Denormalized) |
| `citizenLineId`| String | No | LINE UID ของผู้แจ้งสำหรับ Push แจ้งเตือน |
| `category` | String | Yes | หมวดหมู่ปัญหา อ้างอิงตาม `Category.name` |
| `description` | String | Yes | รายละเอียดของปัญหา (XSS Sanitized) |
| `location` | String | Yes | ที่อยู่หรือสถานที่เกิดเหตุจากการแปลงพิกัด |
| `lat` | Number | No | พิกัดละติจูด |
| `lng` | Number | No | พิกัดลองจิจูด |
| `urgency` | String | Yes | ระดับความเร่งด่วน: `normal`, `medium`, `urgent` |
| `priorityScore`| Number | Yes | คะแนนความสำคัญ 0-100 (คำนวณร่วมกับ SLA) |
| `status` | String | Yes | สถานะงาน: `pending`, `assigned`, `in_progress`, `completed`, `rejected`, `reopened`, `merged` |
| `assignedTo` | ObjectId | No | ช่างที่ได้รับมอบหมาย อ้างอิง `User._id` |
| `assignedName` | String | No | ชื่อช่างผู้รับผิดชอบ (Denormalized) |
| `rejectReason` | String | No | เหตุผลในการปฏิเสธงาน |
| `citizenImage` | String | No | URL รูปภาพแรกที่ประชาชนแนบ |
| `citizenImages`| Array[String] | No | รายการ URL รูปภาพทั้งหมดที่ประชาชนแนบ (สูงสุด 5 รูป) |
| `beforeImage` | String | No | URL ภาพถ่ายก่อนเริ่มซ่อมบำรุง (ช่างอัปโหลด) |
| `afterImage` | String | No | URL ภาพถ่ายแรกหลังซ่อมเสร็จ |
| `afterImages` | Array[String] | No | รายการ URL ภาพถ่ายหลังซ่อมเสร็จทั้งหมด (สูงสุด 5 รูป) |
| `rating` | Number | No | คะแนนความพึงพอใจ 1-5 ดาว |
| `ratingReason` | String | No | ความคิดเห็นเพิ่มเติมในการประเมิน |
| `ratedAt` | String | No | วันเวลาที่ทำการประเมิน |
| `slaAssignDeadline` | Date | No | กำหนดเส้นตายการมอบหมาย/รับงาน |
| `slaCompleteDeadline` | Date | No | กำหนดเส้นตายการทำงานเสร็จสิ้น |
| `slaBreached` | Boolean | Yes | `true` หากการทำงานเกินกำหนดเวลา SLA |
| `slaPauseStatus` | String | Yes | สถานะการพักเวลา SLA: `none`, `requested`, `paused` |
| `slaPauseReason` | String | No | เหตุผลในการขอพักเวลา SLA |
| `slaPauseRequestedAt` | Date | No | วันเวลาที่ส่งคำขอพักเวลา SLA |
| `slaPausedAt` | Date | No | วันเวลาที่แอดมินอนุมัติให้พักเวลา |
| `slaTotalPausedMs` | Number | Yes | ผลรวมระยะเวลาที่ถูกพักทั้งหมด (หน่วยมิลลิวินาที) |
| `slaPauseHistory` | Array[Object] | No | ประวัติการขอพักเวลาและอนุมัติทั้งหมด |
| `mergedInto` | String | No | รหัสตั๋วหลักกรณีถูกรวมตั๋วซ้ำซ้อน (เช่น `TKT-00001`) |
| `mergedTickets` | Array[String] | No | รายชื่อรหัสตั๋วที่ถูกรวมเข้ามาในตั๋วนี้ |
| `isMerged` | Boolean | Yes | `true` หากเป็นตั๋วรองที่ถูกรวมแล้ว |
| `reopenCount` | Number | Yes | จำนวนครั้งที่ถูกยื่นเรื่องเปิดงานใหม่ |
| `reopenedAt` | Date | No | วันเวลาที่ยื่นเรื่องเปิดงานใหม่ล่าสุด |
| `reopenReason` | String | No | เหตุผลที่ประชาชนขอเปิดงานใหม่ |
| `reopenImages` | Array[String] | No | ภาพถ่ายประกอบการขอเปิดงานใหม่ |
| `workOrder` | Object | No | เอกสารใบสั่งงานและลายเซ็น: `{ signedByName, signedAt, signatureData, notes }` |
| `timeline` | Array[Object] | No | บันทึกประวัติกิจกรรม: `{ action, actorRole, actorId, actorName, details, oldValue, newValue, timestamp }` |
| `materials` | Array[Object] | No | รายการวัสดุ/อุปกรณ์: `{ name, quantity, unit, unitPrice, totalPrice, addedBy, addedAt }` |
| `totalRepairCost` | Number | Yes | ค่าใช้จ่ายและงบประมาณรวมในการซ่อม (Default: 0) |
| `repairCostNotes` | String | No | หมายเหตุประกอบการเบิกจ่ายค่าซ่อม |
| `upvotes` | Array[Object] | No | รายการผู้กดโหวต `{ userId, createdAt }` |
| `upvoteCount` | Number | Yes | จำนวนผู้กดโหวต (Default: 0) |
| `followers` | Array[Object] | No | รายการผู้ติดตาม `{ userId, lineUserId }` |
| `followerCount` | Number | Yes | จำนวนผู้ติดตาม (Default: 0) |
| `chatExpiresAt` | Date | No | วันเวลาปิดห้องสนทนาของตั๋ว (24 ชม. หลังตั๋ว completed) |
| `createdAt` | Date | Yes | วันเวลาที่สร้างตั๋ว |
| `updatedAt` | Date | Yes | วันเวลาที่อัปเดตตั๋ว |

---

## 3. Collection: Categories
จัดเก็บหมวดหมู่ปัญหาและช่างที่สังกัดในแต่ละหมวดหมู่

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสหมวดหมู่ (Primary Key) |
| `name` | String | Yes | คีย์หลักภาษาอังกฤษ (e.g. `Road`, `Water`) Unique |
| `label` | String | Yes | ป้ายกำกับภาษาไทย (e.g. `ถนน/ทางเท้า`) |
| `icon` | String | Yes | ไอคอนประจำหมวด (Emoji) |
| `technicianIds`| Array[ObjectId] | Yes | รายชื่อ `User._id` ของช่างที่สังกัดในหมวดหมู่นี้ |
| `isDefault` | Boolean | Yes | `true` หากเป็น 7 หมวดหมู่มาตรฐานของระบบ (ห้ามลบ) |
| `createdAt` | Date | Yes | วันเวลาที่สร้าง |
| `updatedAt` | Date | Yes | วันเวลาที่แก้ไข |

---

## 4. Collection: Comments
จัดเก็บข้อความสนทนาในตั๋วแต่ละใบ (Ticket Comments) มีอายุสิ้นสุด 24 ชม. หลังตั๋ว completed

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสข้อความ (Primary Key) |
| `ticketId` | String | Yes | รหัสตั๋วที่สนทนา เช่น `TKT-00001` (Indexed) |
| `userId` | ObjectId | Yes | รหัสผู้ส่ง อ้างอิง `User._id` |
| `userName` | String | Yes | ชื่อผู้ส่งข้อความ |
| `userRole` | String | Yes | บทบาทของผู้ส่ง (`citizen`, `technician`, `admin`) |
| `message` | String | Yes | เนื้อหาข้อความ (สูงสุด 500 ตัวอักษร, XSS Sanitized) |
| `createdAt` | Date | Yes | วันเวลาที่ส่งข้อความ |
| `updatedAt` | Date | Yes | วันเวลาที่แก้ไขข้อความ |

---

## 5. Collection: DirectMessages
จัดเก็บข้อความสนทนาตรงระหว่าง ประชาชน และ ผู้ดูแลระบบ (1 Citizen = 1 Thread)

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสข้อความ (Primary Key) |
| `senderId` | ObjectId | Yes | รหัสผู้ส่ง อ้างอิง `User._id` |
| `senderName` | String | Yes | ชื่อผู้ส่งข้อความ |
| `senderRole` | String | Yes | บทบาทผู้ส่ง: `citizen` หรือ `admin` |
| `citizenId` | ObjectId | Yes | รหัสประชาชนเจ้าของ Thread สนทนา (Indexed) |
| `message` | String | Yes | ข้อความสนทนา (สูงสุด 500 ตัวอักษร, XSS Sanitized) |
| `isRead` | Boolean | Yes | สถานะการเปิดอ่านข้อความ (Default: false) |
| `createdAt` | Date | Yes | วันเวลาที่ส่ง |
| `updatedAt` | Date | Yes | วันเวลาที่อัปเดต |

---

## 6. Collection: HelpRequests
จัดเก็บคำขอความช่วยเหลือข้ามฝ่ายช่าง (Cross-department Help Requests)

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสคำขอ (Primary Key) |
| `helpId` | String | Yes | รหัสคำขอที่อ่านเข้าใจง่าย เช่น `HELP-001` (Unique) |
| `citizenId` | ObjectId | No | รหัสประชาชนเจ้าของตั๋ว |
| `citizenName` | String | No | ชื่อประชาชนเจ้าของตั๋ว |
| `message` | String | Yes | รายละเอียดปัญหาที่ต้องการความช่วยเหลือ |
| `status` | String | Yes | สถานะ: `open`, `resolved`, `accepted`, `cancelled` |
| `ticketId` | String | Yes | รหัสตั๋วต้นทางที่ต้องการความช่วยเหลือ |
| `ticketCategory`| String | No | หมวดหมู่ของตั๋วต้นทาง |
| `ticketLocation`| String | No | พิกัด/สถานที่เกิดเหตุของตั๋ว |
| `ticketDesc` | String | No | รายละเอียดของตั๋วต้นทาง |
| `requesterId` | ObjectId | Yes | รหัสช่างผู้ส่งคำขอ อ้างอิง `User._id` |
| `requesterName`| String | Yes | ชื่อช่างผู้ส่งคำขอ |
| `requesterDept`| String | Yes | แผนกของช่างผู้ส่งคำขอ |
| `targetDept` | String | Yes | แผนกปลายทางที่ขอความช่วยเหลือ |
| `acceptedById` | ObjectId | No | รหัสช่างผู้กดรับความช่วยเหลือ |
| `acceptedByName`| String | No | ชื่อช่างผู้กดรับความช่วยเหลือ |
| `createdAt` | Date | Yes | วันเวลาที่ส่งคำขอ |
| `updatedAt` | Date | Yes | วันเวลาที่อัปเดต |

---

## 7. Collection: Counters
จัดเก็บตัวนับลำดับตัวเลขถัดไป (Atomic Auto-increment) สำหรับรหัส `ticket` และ `help`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Yes | รหัสเอกสาร (Primary Key) |
| `name` | String | Yes | ชื่อตัวนับ: `ticket` หรือ `help` (Unique) |
| `seq` | Number | Yes | ตัวเลขลำดับปัจจุบัน (เรียกใช้ผ่าน `Counter.nextSeq()`) |
