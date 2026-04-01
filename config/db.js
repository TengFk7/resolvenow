const mongoose = require('mongoose');
const dns = require('dns');

// ใช้ Google DNS แทน DNS ท้องถิ่นที่อาจบล็อก mongodb.net SRV records
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI ไม่ได้ตั้งค่าใน .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, {
      dbName: 'resolvenow',
      serverSelectionTimeoutMS: 15000,
      family: 4,  // บังคับ IPv4
    });
    console.log('✅ MongoDB connected:', mongoose.connection.host);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
