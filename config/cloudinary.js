// ─── config/cloudinary.js ─────────────────────────────────────
// อัปโหลดรูปไปยัง Cloudinary (persistent cloud storage)
// ตั้งค่าใน .env:
//   CLOUDINARY_CLOUD_NAME = ชื่อ cloud จาก Cloudinary dashboard
//   CLOUDINARY_API_KEY    = API Key
//   CLOUDINARY_API_SECRET = API Secret

const cloudinary = require('cloudinary').v2;
const CloudinaryStorage = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'resolvenow',          // โฟลเดอร์ใน Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 1280, crop: 'limit', quality: 'auto' }]
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }  // 10 MB
});

// ฟังก์ชันตรวจสอบว่า Cloudinary ถูกตั้งค่าแล้ว
function isCloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET);
}

module.exports = { upload, cloudinary, isCloudinaryConfigured };
