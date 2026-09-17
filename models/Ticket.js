/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId:      { type: String, required: true, unique: true },  // TKT-001, TKT-002 ...
  citizenId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  citizenName:   { type: String, required: true },
  citizenLineId: { type: String, default: null },
  category:      { type: String, required: true },
  description:   { type: String, required: true },
  location:      { type: String, required: true },
  district:      { type: String, default: null, index: true },
  subdistrict:   { type: String, default: null },
  lat:           { type: Number, default: null },
  lng:           { type: Number, default: null },
  urgency:       { type: String, enum: ['normal', 'medium', 'urgent'], default: 'normal' },
  priorityScore: { type: Number, default: 30 },
  status:        { type: String, enum: ['pending', 'assigned', 'in_progress', 'completed', 'rejected', 'reopened', 'merged'], default: 'pending' },
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
  // ── SLA Pause / Hold ──
  slaPauseStatus:      { type: String, enum: ['none', 'requested', 'paused'], default: 'none' },
  slaPauseReason:      { type: String, default: null },
  slaPauseRequestedAt: { type: Date, default: null },
  slaPausedAt:         { type: Date, default: null },
  slaTotalPausedMs:    { type: Number, default: 0 },
  slaPauseHistory:     [{
    reason: String,
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedByName: String,
    requestedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByName: String,
    approvedAt: Date,
    resumedAt: Date,
    resumedByName: String,
    durationMs: Number
  }],
  // ── Duplicate Detection & Merge ──
  mergedInto:          { type: String, default: null },   // TKT-xxxxx of master ticket
  mergedTickets:       { type: [String], default: [] },   // List of ticketIds merged into this
  isMerged:            { type: Boolean, default: false },
  // ── Re-open / Dispute System ──
  reopenCount:         { type: Number, default: 0 },
  reopenedAt:          { type: Date, default: null },
  reopenReason:        { type: String, default: null },
  reopenImages:        { type: [String], default: [] },
  // ── Digital Work Order & Signature ──
  workOrder: {
    signedByName:  { type: String, default: null },
    signedAt:      { type: Date, default: null },
    signatureData: { type: String, default: null },
    notes:         { type: String, default: null }
  },
  // ── Upvote System ──
  upvotes:       [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, createdAt: { type: Date, default: Date.now } }],
  upvoteCount:   { type: Number, default: 0 },
  // ── Follow/Subscribe System ──
  followers:     [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, lineUserId: { type: String, default: null } }],
  followerCount: { type: Number, default: 0 },
  // ── Ticket Activity Audit Trail / Timeline ──
  timeline: [{
    action:    { type: String, required: true },
    actorRole: { type: String, enum: ['citizen', 'technician', 'admin', 'system'], default: 'system' },
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    details:   { type: String, default: null },
    oldValue:  { type: String, default: null },
    newValue:  { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
  }],
  // ── Cost & Material Tracking ──
  materials: [{
    name:       { type: String, required: true },
    quantity:   { type: Number, default: 1 },
    unit:       { type: String, default: 'ชิ้น' },
    unitPrice:  { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    addedBy:    { type: String, default: null },
    addedAt:    { type: Date, default: Date.now }
  }],
  totalRepairCost: { type: Number, default: 0 },
  repairCostNotes: { type: String, default: null },
  // ── Chat Expiry ──
  chatExpiresAt:   { type: Date, default: null },   // set when status → completed; null = no expiry
}, {
  timestamps: true,   // createdAt, updatedAt อัตโนมัติ
  toJSON: { virtuals: true },
});

// ─── Indexes สำหรับ Query ที่ใช้บ่อย ──────────────────────────────
ticketSchema.index({ citizenId: 1, createdAt: -1 });        // GET tickets ของ citizen
ticketSchema.index({ assignedTo: 1, status: 1 });           // GET tickets ของช่าง
ticketSchema.index({ category: 1, status: 1 });             // filter by category + status
ticketSchema.index({ status: 1, createdAt: -1 });           // admin list + ceo dashboard
ticketSchema.index({ slaBreached: 1, status: 1 });          // slaJob breach query
ticketSchema.index({ chatExpiresAt: 1 }, { sparse: true }); // chat cleanup job
ticketSchema.index({ lat: 1, lng: 1, category: 1 });        // duplicate detection query

module.exports = mongoose.model('Ticket', ticketSchema);
