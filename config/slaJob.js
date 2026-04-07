// ─── SLA Breach Background Job ───────────────────────────────────
// ตรวจ SLA breach ทุก 5 นาที และ bulk-update DB
// แยกออกจาก GET /api/tickets เพื่อไม่ให้ write operation ปนกับ read path
// ─────────────────────────────────────────────────────────────────

const Ticket = require('../models/Ticket');

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

function startSlaJob() {
  // รันทันทีหลัง boot
  runSlaCheck().catch(e => console.error('[SLA Job] initial run error:', e));
  // หลังจากนั้น ทุก 5 นาที
  setInterval(() => {
    runSlaCheck().catch(e => console.error('[SLA Job] periodic run error:', e));
  }, 5 * 60 * 1000);
  console.log('[SLA Job] Started — checking SLA breach every 5 minutes');
}

module.exports = { startSlaJob };
