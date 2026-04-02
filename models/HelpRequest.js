const mongoose = require('mongoose');

const helpRequestSchema = new mongoose.Schema({
  helpId:          { type: String, required: true, unique: true },
  // ผู้สร้างคำขอ (citizen ที่เกี่ยวข้อง หรือ technician เจ้าของ)
  citizenId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  citizenName:     { type: String, required: true },
  message:         { type: String, default: '' },
  // BUG-008: fields ที่ route ใช้งานแต่ขาดจาก schema
  ticketId:        { type: String, default: null },
  ticketCategory:  { type: String, default: null },
  ticketLocation:  { type: String, default: null },
  ticketDesc:      { type: String, default: null },
  requesterId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requesterName:   { type: String, default: null },
  requesterDept:   { type: String, default: null },
  targetDept:      { type: String, default: null },
  acceptedById:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acceptedByName:  { type: String, default: null },
  // status ครบทุกค่าที่ route ใช้งาน
  status:          { type: String, enum: ['open', 'accepted', 'cancelled', 'resolved'], default: 'open' },
  reply:           { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('HelpRequest', helpRequestSchema);
