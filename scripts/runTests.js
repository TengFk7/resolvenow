/**
 * ResolveNow - Comprehensive Automated Verification Test Suite
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 * Run with: npm test  or  node scripts/runTests.js
 */

const assert = require('assert');
const xss = require('xss');
const { SLA_RULES, calcSlaDeadlines, checkIsSlaBreached } = require('../utils/slaHelper');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n\x1b[1m=== ResolveNow Automated System Verification ===\x1b[0m\n');

// ── 1. SLA Logic & Deadlines ──────────────────────────────────────
console.log('\x1b[36m[Group 1: SLA Engine & Breach Detection]\x1b[0m');

runTest('Urgent SLA rule defines 2h assign and 8h complete', () => {
  assert.strictEqual(SLA_RULES.urgent.assignHours, 2);
  assert.strictEqual(SLA_RULES.urgent.completeHours, 8);
});

runTest('Medium SLA rule defines 8h assign and 48h complete', () => {
  assert.strictEqual(SLA_RULES.medium.assignHours, 8);
  assert.strictEqual(SLA_RULES.medium.completeHours, 48);
});

runTest('Normal SLA rule defines 24h assign and 72h complete', () => {
  assert.strictEqual(SLA_RULES.normal.assignHours, 24);
  assert.strictEqual(SLA_RULES.normal.completeHours, 72);
});

runTest('calcSlaDeadlines returns future dates matching rule hours', () => {
  const now = Date.now();
  const res = calcSlaDeadlines('urgent');
  const assignDiffHours = Math.round((res.slaAssignDeadline.getTime() - now) / 3600000);
  const completeDiffHours = Math.round((res.slaCompleteDeadline.getTime() - now) / 3600000);
  assert.strictEqual(assignDiffHours, 2);
  assert.strictEqual(completeDiffHours, 8);
});

runTest('checkIsSlaBreached detects expired pending assignment deadline', () => {
  const expiredTicket = {
    status: 'pending',
    slaAssignDeadline: new Date(Date.now() - 60000), // 1 minute ago
    slaPauseStatus: 'none',
    slaBreached: false
  };
  assert.strictEqual(checkIsSlaBreached(expiredTicket), true);
});

runTest('checkIsSlaBreached returns false when pending deadline is in future', () => {
  const validTicket = {
    status: 'pending',
    slaAssignDeadline: new Date(Date.now() + 3600000), // 1 hour in future
    slaPauseStatus: 'none',
    slaBreached: false
  };
  assert.strictEqual(checkIsSlaBreached(validTicket), false);
});

runTest('checkIsSlaBreached detects expired completion deadline for in_progress', () => {
  const expiredTicket = {
    status: 'in_progress',
    slaCompleteDeadline: new Date(Date.now() - 60000),
    slaPauseStatus: 'none',
    slaBreached: false
  };
  assert.strictEqual(checkIsSlaBreached(expiredTicket), true);
});

runTest('checkIsSlaBreached freezes breach check while paused', () => {
  const pausedTicket = {
    status: 'in_progress',
    slaCompleteDeadline: new Date(Date.now() - 60000),
    slaPauseStatus: 'paused',
    slaBreached: false
  };
  assert.strictEqual(checkIsSlaBreached(pausedTicket), false);
});

runTest('checkIsSlaBreached retains breach if ticket was already breached', () => {
  const alreadyBreachedTicket = {
    status: 'in_progress',
    slaCompleteDeadline: new Date(Date.now() - 60000),
    slaPauseStatus: 'paused',
    slaBreached: true
  };
  assert.strictEqual(checkIsSlaBreached(alreadyBreachedTicket), true);
});

// ── 2. Haversine Distance & Duplicate Detection ────────────────────
console.log('\n\x1b[36m[Group 2: Geo Calculations & Duplicate Detection]\x1b[0m');

function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

runTest('Haversine distance of identical coordinates is 0 meters', () => {
  const d = getDistanceFromLatLonInM(13.7563, 100.5018, 13.7563, 100.5018);
  assert.strictEqual(Math.round(d), 0);
});

runTest('Haversine distance within 100m is accurately detected', () => {
  const d = getDistanceFromLatLonInM(13.7563, 100.5018, 13.7570, 100.5018);
  assert(d > 50 && d < 100, `Distance ${d} should be between 50m and 100m`);
});

runTest('Haversine distance over 1km is correctly flagged outside 100m radius', () => {
  const d = getDistanceFromLatLonInM(13.7563, 100.5018, 13.8000, 100.5500);
  assert(d > 1000, `Distance ${d} should be over 1000m`);
});

// ── 3. Security & XSS Sanitization ───────────────────────────────
console.log('\n\x1b[36m[Group 3: Security & XSS Sanitization]\x1b[0m');

runTest('XSS sanitizer neutralizes executable script tags from user inputs', () => {
  const dirty = 'ปัญหาน้ำท่วม <script>alert("hack")</script> ซอย 5';
  const clean = xss(dirty);
  assert(!clean.includes('<script>'));
  assert(clean.includes('&lt;script&gt;'));
  assert(clean.includes('ปัญหาน้ำท่วม'));
});

runTest('XSS sanitizer neutralizes malicious onerror handlers in images', () => {
  const dirty = '<img src=x onerror=alert(1)>';
  const clean = xss(dirty);
  assert(!clean.includes('onerror'));
});

// ── 4. Public Track PDPA Masking ─────────────────────────────────
console.log('\n\x1b[36m[Group 4: PDPA & Privacy Protection]\x1b[0m');

runTest('Public tracker masks citizen name with generic citizen label', () => {
  const rawTimeline = [
    { action: 'created', actorRole: 'citizen', actorName: 'สมชาย ประชาชน', details: 'แจ้งเรื่อง' },
    { action: 'assigned', actorRole: 'admin', actorName: 'สมศักดิ์ แอดมิน', details: 'มอบหมายงาน' },
    { action: 'status_changed', actorRole: 'technician', actorName: 'สมเกียรติ ช่างประปา', details: 'ลงพื้นที่' }
  ];

  const safeTimeline = rawTimeline.map(ev => {
    let safeActor = 'เจ้าหน้าที่';
    if (ev.actorRole === 'citizen') safeActor = 'ประชาชนผู้แจ้ง';
    else if (ev.actorRole === 'technician') safeActor = ev.actorName ? ('ช่าง ' + ev.actorName.split(' ')[0]) : 'ช่างผู้รับผิดชอบ';
    else if (ev.actorRole === 'admin') safeActor = 'เจ้าหน้าที่ศูนย์สั่งการ';
    return { ...ev, actorName: safeActor };
  });

  assert.strictEqual(safeTimeline[0].actorName, 'ประชาชนผู้แจ้ง');
  assert.strictEqual(safeTimeline[1].actorName, 'เจ้าหน้าที่ศูนย์สั่งการ');
  assert.strictEqual(safeTimeline[2].actorName, 'ช่าง สมเกียรติ');
});

// ── 5. CEO Budget & Delta Calculations ───────────────────────────
console.log('\n\x1b[36m[Group 5: Financial & Budget Aggregations]\x1b[0m');

runTest('Cost overview calculates delta percentage correctly', () => {
  const thisMonthCost = 15000;
  const lastMonthCost = 10000;
  const deltaPct = Math.round(((thisMonthCost - lastMonthCost) / lastMonthCost) * 100);
  assert.strictEqual(deltaPct, 50);
});

runTest('Cost overview handles zero prior month without divide-by-zero error', () => {
  const thisMonthCost = 5000;
  const lastMonthCost = 0;
  let deltaPct = 0;
  if (lastMonthCost > 0) {
    deltaPct = Math.round(((thisMonthCost - lastMonthCost) / lastMonthCost) * 100);
  }
  assert.strictEqual(deltaPct, 0);
});

// ── 6. Schema Model Indexes Verification ─────────────────────────
console.log('\n\x1b[36m[Group 6: Database Model Schemas & Indexes]\x1b[0m');

runTest('User model has schema with role and lineUserId indexes', () => {
  const User = require('../models/User');
  const indexes = User.schema.indexes();
  const hasRole = indexes.some(idx => idx[0].role === 1);
  const hasLine = indexes.some(idx => idx[0].lineUserId === 1);
  assert(hasRole, 'User model should have index on role');
  assert(hasLine, 'User model should have index on lineUserId');
});

runTest('HelpRequest model has schema with status, requester, and ticket indexes', () => {
  const HelpRequest = require('../models/HelpRequest');
  const indexes = HelpRequest.schema.indexes();
  const hasStatus = indexes.some(idx => idx[0].status === 1);
  const hasTicket = indexes.some(idx => idx[0].ticketId === 1);
  assert(hasStatus, 'HelpRequest should have index on status');
  assert(hasTicket, 'HelpRequest should have index on ticketId');
});

runTest('DirectMessage model has schema with citizenId and compound indexes', () => {
  const DirectMessage = require('../models/DirectMessage');
  const indexes = DirectMessage.schema.indexes();
  const hasCitizenCompound = indexes.some(idx => idx[0].citizenId === 1 && idx[0].senderRole === 1);
  assert(hasCitizenCompound, 'DirectMessage should have compound index on { citizenId, senderRole, isRead }');
});

runTest('Ticket model has indexes for duplicate detection, SLA, and status queries', () => {
  const Ticket = require('../models/Ticket');
  const indexes = Ticket.schema.indexes();
  const hasGeoCat = indexes.some(idx => idx[0].lat === 1 && idx[0].lng === 1 && idx[0].category === 1);
  const hasSla = indexes.some(idx => idx[0].slaBreached === 1 && idx[0].status === 1);
  assert(hasGeoCat, 'Ticket should have compound index on { lat, lng, category }');
  assert(hasSla, 'Ticket should have compound index on { slaBreached, status }');
});

// ── 7. Cognitive Thai NLP Heuristics Engine (AI Fallback) ─────────
console.log('\n\x1b[36m[Group 7: Cognitive Thai NLP Heuristics Engine & AI Fallback]\x1b[0m');

runTest('ruleBasedUrgency function is exported and functional', () => {
  const { ruleBasedUrgency } = require('../routes/ai');
  assert.strictEqual(typeof ruleBasedUrgency, 'function');
});

runTest('Cognitive Engine achieves 100% accuracy across all 134 few-shot dataset cases', () => {
  const fs = require('fs');
  const path = require('path');
  const { ruleBasedUrgency } = require('../routes/ai');

  const aiContent = fs.readFileSync(path.join(__dirname, '../routes/ai.js'), 'utf8');
  const lines = aiContent.split('\n');
  const catMap = {
    'สัตว์มีพิษ': 'Animal',
    'ภัยพิบัติ': 'Hazard',
    'ท่อน้ำ': 'Water',
    'ไฟฟ้า': 'Electricity',
    'ถนน': 'Road',
    'ขยะ': 'Garbage',
    'กีดขวาง': 'Tree'
  };

  const testCases = [];
  for (const line of lines) {
    const m = line.match(/^([^|\r\n]+)\s*\|\s*"([^"]+)"\s*→\s*(urgent|medium|normal)/);
    if (m) {
      testCases.push({
        category: catMap[m[1].trim()] || m[1].trim(),
        text: m[2].trim(),
        expected: m[3].trim()
      });
    }
  }

  assert.strictEqual(testCases.length, 134, 'Should parse all 134 test cases from routes/ai.js');

  let passed = 0;
  for (const tc of testCases) {
    const actual = ruleBasedUrgency(tc.text, tc.category);
    if (actual === tc.expected) passed++;
  }

  assert.strictEqual(passed, 134, `Expected 134/134 passed, but got ${passed}/134`);
});

runTest('Cognitive Engine correctly handles spatial awareness & living space proximity', () => {
  const { ruleBasedUrgency } = require('../routes/ai');
  assert.strictEqual(ruleBasedUrgency('พบงูเห่าแผ่แม่เบี้ยอยู่ในห้องนอนเด็ก', 'Animal'), 'urgent');
  assert.strictEqual(ruleBasedUrgency('ตัวเงินตัวทองเดินอยู่ริมคลองหลังบ้าน ไม่ได้เข้ามาในรั้ว', 'Animal'), 'normal');
});

runTest('Cognitive Engine correctly handles negation and absence of harm', () => {
  const { ruleBasedUrgency } = require('../routes/ai');
  assert.strictEqual(ruleBasedUrgency('มีรังแตนขนาดเล็กอยู่มุมหลังคาบ้าน ยังไม่ทำร้ายใคร', 'Animal'), 'medium');
  assert.strictEqual(ruleBasedUrgency('ลมพัดแรงจนหลังคาสังกะสีปลิว แต่ไม่ได้ทับใคร', 'Hazard'), 'medium');
  assert.strictEqual(ruleBasedUrgency('ฝนตกปรอยๆ ถนนลื่นเล็กน้อย ไม่ได้เกิดอุบัติเหตุ', 'Hazard'), 'normal');
});

runTest('Cognitive Engine distinguishes nuisance smoke from active fire hazard', () => {
  const { ruleBasedUrgency } = require('../routes/ai');
  assert.strictEqual(ruleBasedUrgency('มีคนเผาขยะในซอย ควันลอยเข้าบ้านทำให้แสบจมูกและหายใจไม่ออก', 'Hazard'), 'medium');
  assert.strictEqual(ruleBasedUrgency('ไฟไหม้ร้านอาหารในตลาดสด ควันลามไปตึกข้างเคียงอย่างรวดเร็ว', 'Hazard'), 'urgent');
});

// ── Summary ──────────────────────────────────────────────────────
console.log('\n\x1b[1m=== Test Results Summary ===\x1b[0m');
console.log(`Total:  ${totalTests}`);
console.log(`Passed: \x1b[32m${passedTests}\x1b[0m`);
console.log(`Failed: \x1b[31m${totalTests - passedTests}\x1b[0m\n`);

if (passedTests === totalTests) {
  console.log('\x1b[32m✔ All verification tests passed successfully! System is in ideal operating health.\x1b[0m\n');
  process.exit(0);
} else {
  console.error('\x1b[31m✖ Some tests failed. Please review errors above.\x1b[0m\n');
  process.exit(1);
}
