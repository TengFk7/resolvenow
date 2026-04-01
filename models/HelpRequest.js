const mongoose = require('mongoose');

const helpRequestSchema = new mongoose.Schema({
  helpId:      { type: String, required: true, unique: true },
  citizenId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  citizenName: { type: String, required: true },
  message:     { type: String, required: true },
  status:      { type: String, enum: ['open', 'resolved'], default: 'open' },
  reply:       { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('HelpRequest', helpRequestSchema);
