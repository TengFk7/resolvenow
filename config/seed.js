const bcrypt = require('bcryptjs');
const User = require('../models/User');

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

  console.log('✅ Seed สำเร็จ');
  console.log('   Admin:   admin@resolvenow.th / admin1234');
  console.log('   Tech:    tech1@resolvenow.th ~ tech7@resolvenow.th / tech1234');
  console.log('   Citizen: tenginpb@gmail.com / 123456');
}

module.exports = { seedDB, DEPT_MAP };
