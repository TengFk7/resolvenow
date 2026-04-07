const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');

const DEPT_MAP = {
  Road: { th: 'ถนน/ทางเท้า', icon: '🛣️' },
  Water: { th: 'ท่อแตก/น้ำไม่ไหล', icon: '💧' },
  Electricity: { th: 'ไฟฟ้าสาธารณะดับ', icon: '💡' },
  Garbage: { th: 'ขยะตกค้าง', icon: '🗑️' },
  Animal: { th: 'สัตว์มีพิษ/จรจัด', icon: '🐍' },
  Tree: { th: 'กิ่งไม้วางทาง', icon: '🌿' },
  Hazard: { th: 'เพลิง/ภัยพิบัติ', icon: '🚨' },
};

const techNames = [
  { f: 'วิชัย', l: 'โยธา', specialty: 'Road' },
  { f: 'มานะ', l: 'ประปา', specialty: 'Water' },
  { f: 'สมชาย', l: 'ไฟฟ้า', specialty: 'Electricity' },
  { f: 'สุรัตน์', l: 'สุขา', specialty: 'Garbage' },
  { f: 'บุญมี', l: 'ปราบ', specialty: 'Animal' },
  { f: 'สมศรี', l: 'ป่าไม้', specialty: 'Tree' },
  { f: 'อนันต์', l: 'กู้ภัย', specialty: 'Hazard' },
];

async function seedDB() {
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    // ── Seed categories ถ้ายังไม่มี (รองรับ DB เดิมที่มี user แล้ว) ──
    await seedCategories();
    console.log('✅ Seed ข้ามแล้ว (มีข้อมูลใน DB)');
    return;
  }

  console.log('🌱 กำลัง Seed ข้อมูลเริ่มต้น...');

  // Admin
  await new User({
    firstName: 'Admin', lastName: 'Dispatcher',
    email: 'admin@resolvenow.th',
    password: await bcrypt.hash('admin1234', 10),
    role: 'admin',
  }).save();

  // Technicians
  for (const t of techNames) {
    await new User({
      firstName: t.f, lastName: t.l,
      email: `tech${techNames.indexOf(t) + 1}@resolvenow.th`,
      password: await bcrypt.hash('tech1234', 10),
      role: 'technician',
      specialty: t.specialty,
    }).save();
  }

  // Pre-seeded citizen
  await new User({
    firstName: 'Teng', lastName: 'Teng(-Admin-)',
    email: 'tenginpb@gmail.com',
    password: await bcrypt.hash('123456', 10),
    role: 'citizen',
  }).save();

  // ── Seed default categories ──
  await seedCategories();

  console.log('✅ Seed สำเร็จ');
  console.log('   Admin:   admin@resolvenow.th / admin1234');
  console.log('   Tech:    tech1@resolvenow.th ~ tech7@resolvenow.th / tech1234');
  console.log('   Citizen: tenginpb@gmail.com / 123456');
}

// ── Seed Default Categories + Link Technicians ──────────────────
async function seedCategories() {
  const catCount = await Category.countDocuments();
  if (catCount > 0) return; // มีแล้ว ข้าม

  console.log('📂 กำลัง Seed หมวดหมู่เริ่มต้น...');
  for (const [name, info] of Object.entries(DEPT_MAP)) {
    // หาช่างที่ specialty ตรง
    const matchingTechs = await User.find({ role: 'technician', specialty: name }).select('_id');
    await new Category({
      name,
      label: info.th,
      icon: info.icon,
      technicianIds: matchingTechs.map(t => t._id),
      isDefault: true,
    }).save();
  }
  console.log('✅ Seed หมวดหมู่ 7 รายการสำเร็จ');
}

module.exports = { seedDB, DEPT_MAP };
