/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── SLA Helper Utility ───────────────────────────────────────────
// Centralized SLA deadline calculations and breach evaluations

const SLA_RULES = {
  urgent:  { assignHours: 0.25, completeHours: 0.5 }, // ด่วนมาก: มอบหมาย 15 นาที, ปิดงาน 30 นาที (ไม่เกิน 15-30 นาที)
  medium:  { assignHours: 6,    completeHours: 12  }, // ด่วน: มอบหมาย 6 ชม., ปิดงาน 12 ชม. (ภายใน 6-12 ชั่วโมง)
  normal:  { assignHours: 24,   completeHours: 72  }  // ปกติ: มอบหมาย 24 ชม., ปิดงาน 72 ชม.
};

/**
 * Calculates assignment and completion deadlines based on ticket urgency.
 * @param {string} urgency - 'urgent' | 'medium' | 'normal'
 * @returns {{ slaAssignDeadline: Date, slaCompleteDeadline: Date }}
 */
function calcSlaDeadlines(urgency) {
  const rule = SLA_RULES[urgency] || SLA_RULES.normal;
  const now = new Date();
  return {
    slaAssignDeadline:   new Date(now.getTime() + rule.assignHours * 3600000),
    slaCompleteDeadline: new Date(now.getTime() + rule.completeHours * 3600000)
  };
}

/**
 * Evaluates whether a ticket has breached its SLA deadline.
 * @param {Object} ticket - Ticket document or object
 * @returns {boolean}
 */
function checkIsSlaBreached(ticket) {
  if (!ticket) return false;
  if (ticket.slaBreached) return true; // Once breached, remains breached
  if (ticket.status === 'completed' || ticket.status === 'rejected' || ticket.status === 'merged' || ticket.status === 'spam_quarantine') {
    return false;
  }
  if (ticket.slaPauseStatus === 'paused') {
    return false; // Time is frozen while paused
  }
  const now = new Date();
  if (ticket.status === 'pending' && ticket.slaAssignDeadline) {
    return now > new Date(ticket.slaAssignDeadline);
  }
  if ((ticket.status === 'assigned' || ticket.status === 'in_progress' || ticket.status === 'reopened') && ticket.slaCompleteDeadline) {
    return now > new Date(ticket.slaCompleteDeadline);
  }
  return false;
}

module.exports = {
  SLA_RULES,
  calcSlaDeadlines,
  checkIsSlaBreached
};
