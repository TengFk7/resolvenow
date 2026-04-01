const mongoose = require('mongoose');

// ── Auto-increment counter สำหรับ ticketId / helpId ──────────────
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq:  { type: Number, default: 0 },
});

counterSchema.statics.nextSeq = async function (name) {
  const counter = await this.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
