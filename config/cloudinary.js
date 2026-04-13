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

// ─── Shared Image Cleanup Helpers ───────────────────────────────
// แปลง Cloudinary URL → public_id (เช่น "resolvenow/abc123")
function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    // ตัวอย่าง URL: https://res.cloudinary.com/<cloud>/image/upload/v1234567890/resolvenow/abc123.jpg
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/);
    return match ? match[1] : null;
  } catch { return null; }
}

// รับ array ของ Ticket documents → เก็บ public_ids ทั้งหมดแล้ว destroy พร้อมกัน
async function purgeTicketImages(tickets) {
  const publicIds = [];
  for (const t of tickets) {
    for (const field of ['citizenImage', 'beforeImage', 'afterImage']) {
      const pid = extractPublicId(t[field]);
      if (pid) publicIds.push(pid);
    }
  }
  if (publicIds.length === 0) return;
  // destroy ทีละอัน (แบบ parallel เพื่อความเร็ว)
  await Promise.allSettled(
    publicIds.map(pid =>
      cloudinary.uploader.destroy(pid).catch(err =>
        console.warn('[Cloudinary] ลบรูปไม่สำเร็จ:', pid, err?.message)
      )
    )
  );
  console.log(`[Cloudinary] ลบรูป ${publicIds.length} ไฟล์ออกจาก Cloud สำเร็จ`);
}

module.exports = { upload, cloudinary, isCloudinaryConfigured, extractPublicId, purgeTicketImages };

