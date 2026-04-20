const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId:      { type: String, required: true, unique: true },  // TKT-001, TKT-002 ...
  citizenId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  citizenName:   { type: String, required: true },
  citizenLineId: { type: String, default: null },
  category:      { type: String, required: true },
  description:   { type: String, required: true },
  location:      { type: String, required: true },
  lat:           { type: Number, default: null },
  lng:           { type: Number, default: null },
  urgency:       { type: String, enum: ['normal', 'medium', 'urgent'], default: 'normal' },
  priorityScore: { type: Number, default: 30 },
  status:        { type: String, enum: ['pending', 'assigned', 'in_progress', 'completed', 'rejected'], default: 'pending' },
  assignedTo:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedName:  { type: String, default: null },
  rejectReason:  { type: String, default: null },
  // รูปภาพ (URL จาก Cloudinary หรือ local)
  citizenImage:  { type: String, default: null },
  citizenImages: { type: [String], default: [] },
  beforeImage:   { type: String, default: null },
  afterImage:    { type: String, default: null },   // backward compat (รูปแรก)
  afterImages:   { type: [String], default: [] },   // รูปหลังซ่อม สูงสุด 5 รูป
  // ประเมินความพึงพอใจ
  rating:        { type: Number, min: 1, max: 5, default: null },
  ratingReason:  { type: String, default: null },
  ratedAt:       { type: String, default: null },
  // ── SLA System ──
  slaAssignDeadline:   { type: Date, default: null },
  slaCompleteDeadline: { type: Date, default: null },
  slaBreached:         { type: Boolean, default: false },
  // ── Upvote System ──
  upvotes:       [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, createdAt: { type: Date, default: Date.now } }],
  upvoteCount:   { type: Number, default: 0 },
  // ── Follow/Subscribe System ──
  followers:     [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, lineUserId: { type: String, default: null } }],
  followerCount: { type: Number, default: 0 },
  // ── Chat Expiry ──
  chatExpiresAt:   { type: Date, default: null },   // set when status → completed; null = no expiry
}, {
  timestamps: true,   // createdAt, updatedAt อัตโนมัติ
  toJSON: { virtuals: true },
});

module.exports = mongoose.model('Ticket', ticketSchema);
