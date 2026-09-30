/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['citizen', 'technician', 'admin'], default: 'citizen' },
  specialty: { type: String, default: null }, // เฉพาะ technician
  lineUserId: { type: String, default: null },
  lineDisplayName: { type: String, default: null },
  avatar: { type: String, default: null },
  createdViaLine: { type: Boolean, default: false }, // true = สร้างบัญชีผ่าน register-line
  // ── Strike & Anti-Abuse System ──
  spamStrikes: { type: Number, default: 0 },
  isSuspended: { type: Boolean, default: false },
  suspendedUntil: { type: Date, default: null },
  strikeHistory: [{
    reason: { type: String, default: null },
    ticketId: { type: String, default: null },
    givenAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ lineUserId: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
