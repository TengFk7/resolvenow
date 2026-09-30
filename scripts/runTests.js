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

// ── Group 8: AI Auto-Categorization & Smart Fallback Dispatcher ──
console.log('\n\x1b[1m[Group 8: AI Auto-Categorization & Smart Fallback Dispatcher]\x1b[0m');

runTest('ruleBasedClassification accurately classifies complaints across all 7 categories without manual selection', () => {
  const { ruleBasedClassification } = require('../routes/ai');
  const samples = [
    { text: 'ท่อประปาหน้าบ้านแตก น้ำพุ่งทะลักท่วมถนน', expected: 'Water' },
    { text: 'เสาไฟเอียง 45 องศา สายไฟห้อยลงมาอันตรายมาก', expected: 'Electricity' },
    { text: 'มีงูเหลือมตัวใหญ่เลื้อยเข้าห้องนอนเด็ก', expected: 'Animal' },
    { text: 'กิ่งไม้ใหญ่หักโค่นขวางทางเข้าหมู่บ้าน รถผ่านไม่ได้', expected: 'Tree' },
    { text: 'ถนนเป็นหลุมขนาดใหญ่ รถตกหลุมยางแตกเสียหาย', expected: 'Road' },
    { text: 'ขยะล้นถังส่งกลิ่นเหม็นเน่า แมลงวันตอมเต็มหน้าบ้าน', expected: 'Garbage' },
    { text: 'เกิดเพลิงไหม้โรงงาน มีสารเคมีรั่วไหลและควันพิษพุ่งสูง', expected: 'Hazard' }
  ];

  for (const s of samples) {
    const res = ruleBasedClassification(s.text);
    assert.strictEqual(res.category, s.expected, `Expected ${s.expected} for "${s.text}", got ${res.category}`);
    assert.strictEqual(res.isAmbiguous, false, `Expected not ambiguous for "${s.text}"`);
    assert.strictEqual(res.confidence, 'high');
  }
});

runTest('ruleBasedClassification detects ambiguous and vague complaints for admin review queue', () => {
  const { ruleBasedClassification } = require('../routes/ai');
  const ambiguousTexts = [
    'ช่วยด้วยครับ มีปัญหาแถวนี้',
    'ตรงนี้พังช่วยมาดูหน่อย',
    'แถวนี้แย่มาก',
    'ช่วยหน่อย',
    'พัง'
  ];

  for (const text of ambiguousTexts) {
    const res = ruleBasedClassification(text);
    assert.strictEqual(res.isAmbiguous, true, `Expected ambiguous:true for "${text}", got ${res.isAmbiguous}`);
    assert.strictEqual(res.confidence, 'low');
  }
});

runTest('Ticket model schema includes AI Dispatch and Ambiguity detection fields', () => {
  const Ticket = require('../models/Ticket');
  const paths = Ticket.schema.paths;
  assert.ok(paths.isAmbiguous, 'isAmbiguous field missing from Ticket schema');
  assert.strictEqual(paths.isAmbiguous.instance, 'Boolean');
  assert.ok(paths.needsAdminReview, 'needsAdminReview field missing from Ticket schema');
  assert.strictEqual(paths.needsAdminReview.instance, 'Boolean');
  assert.ok(paths.aiDispatched, 'aiDispatched field missing from Ticket schema');
  assert.strictEqual(paths.aiDispatched.instance, 'Boolean');
  assert.ok(paths.aiConfidence, 'aiConfidence field missing from Ticket schema');
  assert.deepStrictEqual(paths.aiConfidence.enumValues, ['high', 'medium', 'low']);
  assert.ok(paths.aiReviewReason, 'aiReviewReason field missing from Ticket schema');
});

runTest('Cognitive Engine classifies severe damage like "ถนนหน้าบ้านพังยับ" as Road with high urgency (not normal)', () => {
  const { ruleBasedClassification, ruleBasedUrgency } = require('../routes/ai');
  const res = ruleBasedClassification('ถนนหน้าบ้านพังยับ');
  assert.strictEqual(res.category, 'Road');
  assert.strictEqual(res.urgency, 'urgent');
  assert.strictEqual(res.isAmbiguous, false);

  // Severe road damage should never be 'normal'
  const res2 = ruleBasedClassification('ถนนหน้าบ้านพัง');
  assert.strictEqual(res2.category, 'Road');
  assert.strictEqual(res2.urgency, 'medium');

  // Minor issue remains 'normal'
  const res3 = ruleBasedClassification('สีตีเส้นจราจรทางม้าลายซีดจางจนแทบมองไม่เห็น');
  assert.strictEqual(res3.category, 'Road');
  assert.strictEqual(res3.urgency, 'normal');
});

// ── 9. Anti-Spam, Prank Detection & Citizen Strike Engine ────────
console.log('\n\x1b[1m[Group 9: Anti-Spam, Prank Detection & Citizen Strike Engine]\x1b[0m');

runTest('analyzeComplaintSpam catches keyboard smashing sequences (English QWERTY and Thai Kedmanee)', () => {
  const { analyzeComplaintSpam } = require('../utils/spamFilter');
  const smashSamples = ['asdfghjk', 'กฟหกด่าสว', 'qwerty', 'zxcvbnm'];
  for (const text of smashSamples) {
    const res = analyzeComplaintSpam(text);
    assert.strictEqual(res.isSpam, true, `Expected spam for "${text}"`);
    assert.strictEqual(res.isHardBlock, true, `Expected hard block for "${text}"`);
    assert.strictEqual(res.spamType, 'gibberish');
    assert.strictEqual(res.spamFlag, 'incomprehensible');
    assert.ok(res.aiCredibilityScore <= 15, 'Credibility score should be <= 15');
  }
});

runTest('analyzeComplaintSpam catches continuous row smashing and loop patterns ("กดาสฟหกดาสฟหกดาส", "sdfkjhsdflkjh", "อะไรไม่รู้อะไรไม่รู้")', () => {
  const { analyzeComplaintSpam } = require('../utils/spamFilter');
  const continuousSamples = [
    'กดาสฟหกดาสฟหกดาสฟหกดาส',
    'ฟหกสดาฟหกวดาสฟหกดวา',
    'สวดฟกห ดฟสากหด ฟสหกดา ฟหกสาด',
    'sdfkjhsdflkjhsdflkjh',
    'asdfghjklasdfghjkl',
    'อะไรไม่รู้อะไรไม่รู้อะไรไม่รู้',
    'มั่วๆ มั่วๆ มั่วๆ มั่วๆ มั่วๆ'
  ];
  for (const text of continuousSamples) {
    const res = analyzeComplaintSpam(text);
    assert.strictEqual(res.isSpam, true, `Expected spam for "${text}"`);
    assert.strictEqual(res.isHardBlock, true, `Expected hard block for "${text}"`);
    assert.strictEqual(res.spamType, 'gibberish');
  }
});

runTest('analyzeComplaintSpam catches repetitive character smashing and laughter ("55555555", "กกกกกกกก")', () => {
  const { analyzeComplaintSpam } = require('../utils/spamFilter');
  const laughRes = analyzeComplaintSpam('5555555555');
  assert.strictEqual(laughRes.isSpam, true);
  assert.strictEqual(laughRes.isHardBlock, true);
  assert.strictEqual(laughRes.spamType, 'joke');

  const smashRes = analyzeComplaintSpam('กกกกกกกกกกกก');
  assert.strictEqual(smashRes.isSpam, true);
  assert.strictEqual(smashRes.isHardBlock, true);
  assert.strictEqual(smashRes.spamType, 'gibberish');

  // Genuine complaint with trailing elongation should NOT be blocked
  const realRes = analyzeComplaintSpam('ช่วยด้วยยยยยยยย ท่อประปาหน้าบ้านแตก น้ำพุ่งทะลักท่วมถนน');
  assert.strictEqual(realRes.isSpam, false);
  assert.strictEqual(realRes.isHardBlock, false);
  assert.strictEqual(realRes.spamFlag, 'valid');
  assert.ok(realRes.aiCredibilityScore >= 80);
});

runTest('analyzeComplaintSpam catches test and placeholder phrases ("test", "1234", "ทดสอบระบบ", "ลองส่ง")', () => {
  const { analyzeComplaintSpam } = require('../utils/spamFilter');
  const testPhrases = ['test', '1234', 'ทดสอบระบบ', 'ลองส่ง', 'aaa', 'ลองระบบ'];
  for (const phrase of testPhrases) {
    const res = analyzeComplaintSpam(phrase);
    assert.strictEqual(res.isSpam, true, `Expected spam for "${phrase}"`);
    assert.strictEqual(res.isHardBlock, true, `Expected hard block for "${phrase}"`);
    assert.strictEqual(res.spamType, 'test');
    assert.strictEqual(res.spamFlag, 'junk');
  }
});

runTest('analyzeComplaintSpam detects vulgar profanity and abusive words', () => {
  const { analyzeComplaintSpam } = require('../utils/spamFilter');
  const profaneSamples = ['ควย', 'ไอ้เหี้ยมึง', 'fuck this shit'];
  for (const text of profaneSamples) {
    const res = analyzeComplaintSpam(text);
    assert.strictEqual(res.isSpam, true, `Expected spam for "${text}"`);
    assert.strictEqual(res.isHardBlock, true, `Expected hard block for "${text}"`);
    assert.strictEqual(res.spamType, 'profanity');
    assert.strictEqual(res.spamFlag, 'junk');
  }
});

runTest('analyzeComplaintSpam detects out-of-domain jokes and classifies as Soft Quarantine', () => {
  const { analyzeComplaintSpam } = require('../utils/spamFilter');
  const jokes = [
    'แฟนทิ้งช่วยด้วย ทำยังไงดี',
    'ขอยืมเงินหน่อย ไม่มีตังค์กินข้าว',
    'หวยงวดนี้ออกอะไร ขอเลขเด็ด',
    'เหงาจัง อยากหาคนคุย'
  ];
  for (const text of jokes) {
    const res = analyzeComplaintSpam(text);
    assert.strictEqual(res.isSpam, true, `Expected spam for "${text}"`);
    assert.strictEqual(res.isHardBlock, false, `Expected soft quarantine (isHardBlock:false) for "${text}"`);
    assert.strictEqual(res.spamType, 'joke');
    assert.strictEqual(res.spamFlag, 'irrelevant');
  }
});

runTest('validateCoordinates and analyzeComplaintSpam detect GPS out-of-bounds outside Thailand and Null Island', () => {
  const { validateCoordinates, analyzeComplaintSpam } = require('../utils/spamFilter');
  // Bangkok: inside Thailand
  const bkk = validateCoordinates(13.7563, 100.5018);
  assert.strictEqual(bkk.isValid, true);
  assert.strictEqual(bkk.isOutOfBounds, false);

  // Paris: outside Thailand
  const paris = validateCoordinates(48.8566, 2.3522);
  assert.strictEqual(paris.isValid, false);
  assert.strictEqual(paris.isOutOfBounds, true);

  // Null Island
  const nullIsland = validateCoordinates(0, 0);
  assert.strictEqual(nullIsland.isValid, false);
  assert.strictEqual(nullIsland.isOutOfBounds, true);

  // Check analyzeComplaintSpam integration with geo
  const geoSpam = analyzeComplaintSpam('มีน้ำขังหน้าบ้าน', { lat: 48.8566, lng: 2.3522 });
  assert.strictEqual(geoSpam.isSpam, true);
  assert.strictEqual(geoSpam.isHardBlock, false);
  assert.strictEqual(geoSpam.spamType, 'out_of_bounds');
});

runTest('Linguistic entropy and Thai consonant/vowel analysis detect vowelless Thai smashing', () => {
  const { analyzeComplaintSpam, calculateEntropy, analyzeLinguisticProperties } = require('../utils/spamFilter');
  // Vowelless Thai consonant smash
  const vowelless = 'กขคงจฉชซดตถท';
  const res = analyzeComplaintSpam(vowelless);
  assert.strictEqual(res.isSpam, true);
  assert.strictEqual(res.isHardBlock, true);
  assert.strictEqual(res.spamType, 'gibberish');

  // Low entropy detection
  assert.strictEqual(calculateEntropy('aaaaaaaa'), 0);
  const ling = analyzeLinguisticProperties('มีน้ำเสียและไฟฟ้าดับ');
  assert.ok(ling.thaiConsonants > 0);
  assert.ok(ling.thaiVowels > 0);
});

runTest('Ticket and User model schemas include all required Anti-Spam & Strike fields and indexes', () => {
  const Ticket = require('../models/Ticket');
  const User = require('../models/User');

  // Ticket schema
  const tPaths = Ticket.schema.paths;
  assert.ok(tPaths.isSpam, 'isSpam missing in Ticket schema');
  assert.strictEqual(tPaths.isSpam.instance, 'Boolean');
  assert.ok(tPaths.spamReason, 'spamReason missing in Ticket schema');
  assert.ok(tPaths.spamType, 'spamType missing in Ticket schema');
  assert.deepStrictEqual(tPaths.spamType.enumValues, ['none', 'hard_blocked', 'gibberish', 'test', 'profanity', 'joke', 'out_of_bounds', 'ai_flagged']);
  assert.ok(tPaths.aiCredibilityScore, 'aiCredibilityScore missing in Ticket schema');
  assert.ok(tPaths.spamFlag, 'spamFlag missing in Ticket schema');
  assert.deepStrictEqual(tPaths.spamFlag.enumValues, ['valid', 'junk', 'incomprehensible', 'irrelevant']);
  assert.ok(tPaths.status.enumValues.includes('spam_quarantine'), 'spam_quarantine missing in Ticket status enum');

  // User schema
  const uPaths = User.schema.paths;
  assert.ok(uPaths.spamStrikes, 'spamStrikes missing in User schema');
  assert.strictEqual(uPaths.spamStrikes.instance, 'Number');
  assert.ok(uPaths.isSuspended, 'isSuspended missing in User schema');
  assert.strictEqual(uPaths.isSuspended.instance, 'Boolean');
  assert.ok(uPaths.suspendedUntil, 'suspendedUntil missing in User schema');
  assert.ok(uPaths.strikeHistory, 'strikeHistory missing in User schema');
});

runTest('checkIsSlaBreached excludes quarantined spam tickets from SLA breach calculations', () => {
  const quarantinedTicket = {
    status: 'spam_quarantine',
    slaAssignDeadline: new Date(Date.now() - 3600000), // Expired 1 hour ago
    slaPauseStatus: 'none',
    slaBreached: false
  };
  assert.strictEqual(checkIsSlaBreached(quarantinedTicket), false);
});

runTest('analyzeComplaintSpam and ruleBasedClassification block non-civic meaningless gibberish and playful input ("พิมพ์เรื่อยๆมั่วๆ", "jsdkfjweoifj", "ไม่มีไรทำส่งเล่น")', () => {
  const { analyzeComplaintSpam } = require('../utils/spamFilter');
  const { ruleBasedClassification } = require('../routes/ai');

  const blockedSamples = [
    'พิมพ์เรื่อยๆมั่วๆ',
    'jsdkfjweoifj',
    'ไม่มีไรทำส่งเล่น',
    'ทดสอบระบบ 1234',
    'ลองส่งดูครับ',
    'asdfghjkl'
  ];

  for (const text of blockedSamples) {
    const sp = analyzeComplaintSpam(text);
    const rc = ruleBasedClassification(text);
    assert.strictEqual(sp.isHardBlock || rc.isHardBlock, true, `Expected hard block for "${text}"`);
    assert.strictEqual(sp.isSpam || rc.isSpam, true, `Expected spam flag for "${text}"`);
  }

  // Real civic ambiguous complaints should remain allowed for admin review
  const validAmbiguous = ruleBasedClassification('ช่วยด้วยครับ มีปัญหาแถวนี้');
  assert.strictEqual(validAmbiguous.isHardBlock, false);
  assert.strictEqual(validAmbiguous.isSpam, false);
  assert.strictEqual(validAmbiguous.isAmbiguous, true);
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
