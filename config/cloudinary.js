// ─── config/cloudinary.js ─────────────────────────────────────
// อัปโหลดรูปไปยัง Cloudinary (persistent cloud storage)
// ตั้งค่าใน .env:
//   CLOUDINARY_CLOUD_NAME = ชื่อ cloud จาก Cloudinary dashboard
//   CLOUDINARY_API_KEY    = API Key
//   CLOUDINARY_API_SECRET = API Secret
//
// ใช้ custom multer StorageEngine โดยตรง (รองรับ cloudinary v2 ทุก version)
// ไม่ใช้ multer-storage-cloudinary ซึ่งเข้ากันไม่ได้กับ cloudinary v2

const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Custom multer StorageEngine ────────────────────────────────
class CloudinaryEngine {
  _handleFile(req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'resolvenow',
        transformation: [{ width: 1280, crop: 'limit', quality: 'auto' }],
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          path: result.secure_url,   // req.file.path  = Cloudinary URL
          filename: result.public_id,
          size: result.bytes,
        });
      }
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    if (file.filename) {
      cloudinary.uploader.destroy(file.filename, cb);
    } else {
      cb(null);
    }
  }
}

const storage = new CloudinaryEngine();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('ไฟล์ต้องเป็นรูปภาพเท่านั้น (jpg/png/gif/webp)'));
  },
});

// ฟังก์ชันตรวจสอบว่า Cloudinary ถูกตั้งค่าแล้ว
function isCloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET);
}

module.exports = { upload, cloudinary, isCloudinaryConfigured };

