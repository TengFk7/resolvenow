const bcrypt = require('bcryptjs');

// ─── In-Memory Data ────────────────────────────────────────────
const users = [];
const tickets = [];
const helpRequests = [];
let ticketCounter = 1;
let helpCounter = 1;

// ─── Constants ─────────────────────────────────────────────────
const STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'rejected'];

const DEPT_MAP = {
  Road: { th: 'ถนน/ทางเท้า', icon: '🛣️' },
  Water: { th: 'ท่อแตก/น้ำไม่ไหล', icon: '💧' },
  Electricity: { th: 'ไฟฟ้าสาธารณะดับ', icon: '💡' },
  Garbage: { th: 'ขยะตกค้าง', icon: '🗑️' },
  Animal: { th: 'สัตว์มีพิษ/จรจัด', icon: '🐍' },
  Tree: { th: 'กิ่งไม้วางทาง', icon: '🌿' },
  Hazard: { th: 'เพลิง/ภัยพิบัติ', icon: '🚨' },
};

// ─── ID Generators ─────────────────────────────────────────────
function nextTicketId() {
  return 'TKT-' + String(ticketCounter++).padStart(3, '0');
}

function nextHelpId() {
  return 'HELP-' + String(helpCounter++).padStart(3, '0');
}

// ─── Seed Data ─────────────────────────────────────────────────
(async () => {
  users.push({
    id: 1, firstName: 'Admin', lastName: 'Dispatcher',
    email: 'admin@resolvenow.th',
    password: await bcrypt.hash('admin1234', 10),
    role: 'admin', specialty: null,
    createdAt: new Date().toISOString()
  });

  const depts = Object.keys(DEPT_MAP);
  const techNames = [
    { f: 'วิชัย', l: 'โยธา' },
    { f: 'มานะ', l: 'ประปา' },
    { f: 'สมชาย', l: 'ไฟฟ้า' },
    { f: 'สุรัตน์', l: 'สุขา' },
    { f: 'บุญมี', l: 'ปราบ' },
    { f: 'สมศรี', l: 'ป่าไม้' },
    { f: 'อนันต์', l: 'กู้ภัย' },
  ];

  for (let i = 0; i < depts.length; i++) {
    users.push({
      id: i + 2,
      firstName: techNames[i].f,
      lastName: techNames[i].l,
      email: 'tech' + (i + 1) + '@resolvenow.th',
      password: await bcrypt.hash('tech1234', 10),
      role: 'technician',
      specialty: depts[i],
      createdAt: new Date().toISOString()
    });
  }

  // ── Pre-seeded citizen account ──
  users.push({
    id: depts.length + 2,
    firstName: 'Teng',
    lastName: 'Teng(-Admin-)',
    email: 'tenginpb@gmail.com',
    password: await bcrypt.hash('123456', 10),
    role: 'citizen',
    specialty: null,
    createdAt: new Date().toISOString()
  });

  console.log('✅ Seed สำเร็จ');
  console.log('   Admin:   admin@resolvenow.th / admin1234');
  console.log('   Tech:    tech1@resolvenow.th ~ tech7@resolvenow.th / tech1234');
  console.log('   Citizen: tenginpb@gmail.com / 123456');
})();

// ─── OTP Store ─────────────────────────────────────────────────
// Map<token, { otp, userData, expiresAt, attempts }>
const otpStore = new Map();

module.exports = { users, tickets, helpRequests, otpStore, STATUSES, DEPT_MAP, nextTicketId, nextHelpId };
