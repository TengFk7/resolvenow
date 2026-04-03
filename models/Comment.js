const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  ticketId:  { type: String, required: true, index: true }, // TKT-xxx
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:  { type: String, required: true },
  userRole:  { type: String, enum: ['citizen', 'technician', 'admin'], required: true },
  message:   { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
