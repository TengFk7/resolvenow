require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');

// List of media files copied
const images = [
  '/uploads/media__1775202907488.jpg',
  '/uploads/media__1775202917006.jpg',
  '/uploads/media__1775202924367.jpg',
  '/uploads/media__1775202928155.jpg',
  '/uploads/media__1775202935141.jpg'
];

const categories = ['Road', 'Water', 'Electricity', 'Garbage', 'Animal', 'Tree', 'Hazard'];
const urgencies = ['normal', 'medium', 'urgent'];
const statuses = ['pending', 'assigned', 'in_progress', 'completed', 'rejected'];

// Random Thai Provinces
const locations = [
  'กรุงเทพมหานคร', 'เชียงใหม่', 'ภูเก็ต', 'ขอนแก่น', 'นนทบุรี', 
  'ชลบุรี', 'นครราชสีมา', 'สงขลา', 'สมุทรปราการ', 'อุดรธานี',
  'พิษณุโลก', 'อยุธยา', 'ราชบุรี', 'ภูเก็ต', 'สุราษฎร์ธานี'
];

// Rough Thailand bounding box
function getRandomLatLng() {
  const lat = 13 + Math.random() * 5; // 13 to 18
  const lng = 98 + Math.random() * 6; // 98 to 104
  return { lat, lng };
}

const descriptions = [
  'พบเห็นปัญหาในบริเวณนี้ กรุณาเข้ามาตรวจสอบด้วยครับ รู้สึกไม่ปลอดภัยเลย',
  'มีผู้ได้รับผลกระทบจากเหตุการณ์นี้จำนวนมาก อยากให้เร่งแก้ไขครับ',
  'ปัญหาเรื้อรังมาหลายวันแล้ว ยังไม่มีใครมาดูเลย รบกวนด้วยครับ',
  'เพิ่งเจอเมื่อกี้นี้เลยครับ อันตรายมาก ฝากช่างลงพื้นที่ด่วน',
  'รบกวนหน่วยงานที่เกี่ยวข้องช่วยแก้ไขปัญหาตรงจุดนี้ด้วย ขอบคุณครับ',
  'ช่วยมาดูหน่อยครับ เสียหายเป็นวงกว้างเลย',
  'อยากให้ช่วยซ่อมแซมครับ ตรงนี้คนสัญจรเยอะ อันตรายมากครับ',
  'เกิดเหตุอีกแล้วครับตรงนี้ แก้ไขด่วนเลย',
  'แจ้งปัญหาครับ รบกวนเจ้าหน้าที่มาดูให้หน่อย',
  'จุดนี้มีปัญหาครับ รบกวนจัดการให้ด้วยครับ ขอบคุณครับ'
];

async function seedTickets() {
  try {
    console.log('Connecting to DB...');
    await connectDB();

    const citizen = await User.findOne({ email: 'tenginpb@gmail.com' });
    if (!citizen) {
      console.error('❌ Citizen user not found!');
      process.exit(1);
    }

    console.log(`Creating 10 mock tickets for ${citizen.firstName}...`);
    
    let createdCount = 0;
    
    for (let i = 0; i < 10; i++) {
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const urgency = urgencies[Math.floor(Math.random() * urgencies.length)];
        const img = images[Math.floor(Math.random() * images.length)];
        const loc = locations[Math.floor(Math.random() * locations.length)];
        const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
        const pos = getRandomLatLng();
        
        let score = urgency === 'urgent' ? 90 : urgency === 'medium' ? 60 : 30;
        
        const seq = await Counter.nextSeq('ticket');
        const ticketId = 'TKT-' + String(seq).padStart(3, '0');

        const ticket = new Ticket({
            ticketId,
            citizenId: citizen._id,
            citizenName: citizen.firstName + ' ' + citizen.lastName,
            citizenLineId: citizen.lineUserId || null,
            category: cat,
            description: desc + ` (พื้นที่: ${loc})`,
            location: loc, // Province
            lat: pos.lat,
            lng: pos.lng,
            urgency: urgency,
            priorityScore: score,
            status: 'pending',
            citizenImage: img
        });

        await ticket.save();
        console.log(`✅ Created ${ticketId} in ${loc}`);
        createdCount++;
    }

    console.log(`\n🎉 Successfully created ${createdCount} tickets!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding tickets:', err);
    process.exit(1);
  }
}

seedTickets();
