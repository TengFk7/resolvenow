// ─── SLA Helper Utility ───────────────────────────────────────────
// Centralized SLA deadline calculations and breach evaluations

const SLA_RULES = {
  urgent:  { assignHours: 2,  completeHours: 8  },
  medium:  { assignHours: 8,  completeHours: 48 },
  normal:  { assignHours: 24, completeHours: 72 }
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
  if (ticket.status === 'completed' || ticket.status === 'rejected') {
    return !!ticket.slaBreached;
  }
  const now = new Date();
  if (ticket.status === 'pending' && ticket.slaAssignDeadline) {
    return now > new Date(ticket.slaAssignDeadline);
  }
  if ((ticket.status === 'assigned' || ticket.status === 'in_progress') && ticket.slaCompleteDeadline) {
    return now > new Date(ticket.slaCompleteDeadline);
  }
  return !!ticket.slaBreached;
}

module.exports = {
  SLA_RULES,
  calcSlaDeadlines,
  checkIsSlaBreached
};
