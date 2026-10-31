/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const mongoose = require('mongoose');

const lineInquirySchema = new mongoose.Schema({
  lineUserId: {
    type: String,
    required: true,
    index: true
  },
  displayName: {
    type: String,
    default: 'ผู้ใช้งาน LINE'
  },
  pictureUrl: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'replied', 'resolved'],
    default: 'pending',
    index: true
  },
  isActiveSession: {
    type: Boolean,
    default: true,
    index: true
  },
  adminTakeoverUntil: {
    type: Date,
    default: null,
    index: true
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  messages: [{
    sender: {
      type: String,
      enum: ['citizen', 'admin'],
      required: true
    },
    senderName: {
      type: String,
      default: ''
    },
    text: {
      type: String,
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  replies: [{
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adminName: {
      type: String,
      default: 'เจ้าหน้าที่แอดมิน'
    },
    message: {
      type: String,
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

lineInquirySchema.index({ createdAt: -1 });
lineInquirySchema.index({ status: 1, createdAt: -1 });
lineInquirySchema.index({ lineUserId: 1, isActiveSession: 1, lastActivityAt: -1 });
lineInquirySchema.index({ lineUserId: 1, adminTakeoverUntil: -1 });

module.exports = mongoose.model('LineInquiry', lineInquirySchema);
