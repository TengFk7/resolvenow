// ─── Constants (ยังคงใช้ต่อ) ─────────────────────────────────────
const STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'rejected'];

const DEPT_MAP = {
  Road:        { th: 'ถนน/ทางเท้า',         icon: '🛣️' },
  Water:       { th: 'ท่อแตก/น้ำไม่ไหล',    icon: '💧' },
  Electricity: { th: 'ไฟฟ้าสาธารณะดับ',     icon: '💡' },
  Garbage:     { th: 'ขยะตกค้าง',           icon: '🗑️' },
  Animal:      { th: 'สัตว์มีพิษ/จรจัด',    icon: '🐍' },
  Tree:        { th: 'กิ่งไม้วางทาง',        icon: '🌿' },
  Hazard:      { th: 'เพลิง/ภัยพิบัติ',     icon: '🚨' },
};

// ─── OTP Store (In-Memory ยังโอเค เพราะ OTP มีอายุแค่ 5 นาที) ──
// Map<token, { otp, userData, expiresAt, attempts }>
const otpStore = new Map();

module.exports = { STATUSES, DEPT_MAP, otpStore };
