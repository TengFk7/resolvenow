const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName:   { type: String, required: true, trim: true },
  lastName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['citizen', 'technician', 'admin'], default: 'citizen' },
  specialty:   { type: String, default: null }, // เฉพาะ technician
  lineUserId:  { type: String, default: null },
  lineDisplayName: { type: String, default: null },
  avatar:      { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
