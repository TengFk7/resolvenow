/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const mongoose = require('mongoose');
const dns = require('dns');

// ใช้ Google DNS แทน DNS ท้องถิ่นที่อาจบล็อก mongodb.net SRV records
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function connectDB(retries = 3, delayMs = 3000) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI ไม่ได้ตั้งค่าใน .env');
    process.exit(1);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, {
        dbName: 'resolvenow',
        serverSelectionTimeoutMS: 25000,
        family: 4,  // บังคับ IPv4
      });
      console.log('✅ MongoDB connected:', mongoose.connection.host);
      return;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) {
        console.log(`⏳ Retrying MongoDB connection in ${delayMs / 1000}s...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error('❌ All MongoDB connection attempts exhausted.');
        process.exit(1);
      }
    }
  }
}

module.exports = connectDB;
