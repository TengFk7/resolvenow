// ─── SLA Breach Background Job ───────────────────────────────────
// ตรวจ SLA breach ทุก 5 นาที และ bulk-update DB
// แยกออกจาก GET /api/tickets เพื่อไม่ให้ write operation ปนกับ read path
// ─────────────────────────────────────────────────────────────────

const Ticket  = require('../models/Ticket');
const Comment = require('../models/Comment');

// ── SLA Breach Check ─────────────────────────────────────────────
async function runSlaCheck() {
  const now = new Date();
  const result = await Ticket.updateMany(
    {
      slaBreached: { $ne: true },  // ยังไม่ถูก mark
      $or: [
        // pending นานเกิน assignDeadline
        { status: 'pending', slaAssignDeadline: { $lt: now } },
        // assigned/in_progress นานเกิน completeDeadline
        { status: { $in: ['assigned', 'in_progress'] }, slaCompleteDeadline: { $lt: now } }
      ]
    },
    { $set: { slaBreached: true } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[SLA Job] Marked ${result.modifiedCount} ticket(s) as SLA breached`);
  }
}

// ── Chat Cleanup Job ─────────────────────────────────────────────
// ลบ comments ของ ticket ที่เสร็จงานแล้วเกิน 24 ชั่วโมง
async function runChatCleanup() {
  const now = new Date();

  // หา ticket ที่ chatExpiresAt ผ่านมาแล้ว
  const expiredTickets = await Ticket.find({
    chatExpiresAt: { $ne: null, $lt: now }
  }).select('ticketId chatExpiresAt').lean();

  if (!expiredTickets.length) return;

  const expiredIds = expiredTickets.map(t => t.ticketId);

  // ลบ comments ใน batch
  const result = await Comment.deleteMany({ ticketId: { $in: expiredIds } });

  // Reset chatExpiresAt เป็น null เพื่อป้องกัน query ซ้ำรอบหน้า
  await Ticket.updateMany(
    { ticketId: { $in: expiredIds } },
    { $set: { chatExpiresAt: null } }
  );

  if (result.deletedCount > 0) {
    console.log(`[Chat Cleanup] Deleted ${result.deletedCount} comment(s) from ${expiredIds.length} expired ticket(s): ${expiredIds.join(', ')}`);
  }
}

// ── Start All Jobs ───────────────────────────────────────────────
function startSlaJob() {
  // SLA check: รันทันทีหลัง boot แล้วทุก 5 นาที
  runSlaCheck().catch(e => console.error('[SLA Job] initial run error:', e));
  setInterval(() => {
    runSlaCheck().catch(e => console.error('[SLA Job] periodic run error:', e));
  }, 5 * 60 * 1000);
  // Chat cleanup: รันทันทีหลัง boot แล้วทุก 1 ชั่วโมง
  runChatCleanup().catch(e => console.error('[Chat Cleanup] initial run error:', e));
  setInterval(() => {
    runChatCleanup().catch(e => console.error('[Chat Cleanup] periodic run error:', e));
  }, 60 * 60 * 1000);
}

module.exports = { startSlaJob };
