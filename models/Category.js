const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true, trim: true }, // key เช่น 'Road', 'Water', 'Custom1'
  label:     { type: String, required: true, trim: true },              // ชื่อแสดงผลไทย เช่น 'ถนน/ทางเท้า'
  icon:      { type: String, required: true, default: '📌' },           // emoji
  technicianIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // ช่างที่ผูก
  isDefault: { type: Boolean, default: false },                         // true = 7 หมวดเดิม
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
