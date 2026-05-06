const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, enum: ['citizen', 'admin'], required: true },
  citizenId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // always the citizen in the conversation
  message:    { type: String, required: true, maxlength: 500 },
  isRead:     { type: Boolean, default: false }, // read by the recipient
}, { timestamps: true });

// Index for fast lookup by citizen
directMessageSchema.index({ citizenId: 1, createdAt: 1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);
