/**
 * ResolveNow - LINE Bot Citizen Support AI & PDPA Guardrails Test Suite
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const assert = require('assert');
const crypto = require('crypto');
const {
  validateLineSignature,
  buildTicketFlexMessage,
  buildUnauthorizedMessage,
  buildServiceNavigatorFlexMessage,
  getStatusMeta
} = require('../config/lineBotService');
const LineInquiry = require('../models/LineInquiry');
const lineAiContext = require('../utils/lineAiContext');
const { getOfflineFallbackReply, SYSTEM_INSTRUCTION } = require('../utils/lineAiAgent');

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

function runLineBotTests() {
  console.log('\n\x1b[36m[Group 10: LINE Bot Citizen Support AI & PDPA Guardrails]\x1b[0m');

  runTest('validateLineSignature verifies HMAC-SHA256 signature accurately and rejects tampered bodies', () => {
    const secret = 'test-line-secret-key-12345';
    const rawBody = Buffer.from(JSON.stringify({ events: [{ type: 'message', message: { text: 'สวัสดี' } }] }), 'utf8');
    const validSig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

    // 1. Valid signature passes
    assert.strictEqual(validateLineSignature(rawBody, validSig, secret), true);

    // 2. Tampered body fails
    const tamperedBody = Buffer.from(JSON.stringify({ events: [{ type: 'message', message: { text: 'แฮกเกอร์' } }] }), 'utf8');
    assert.strictEqual(validateLineSignature(tamperedBody, validSig, secret), false);

    // 3. Forged signature fails
    assert.strictEqual(validateLineSignature(rawBody, 'invalid-signature-base64', secret), false);

    // 4. Missing signature fails
    assert.strictEqual(validateLineSignature(rawBody, null, secret), false);

    // 5. Gracefully bypasses when secret is not configured in env
    assert.strictEqual(validateLineSignature(rawBody, validSig, null), true);
  });

  runTest('buildTicketFlexMessage formats rich Navy/Gold Flex Message with ticket details and status tokens', () => {
    const mockTicket = {
      ticketId: 'TKT-202610-001',
      description: 'ท่อระบายน้ำอุดตัน น้ำท่วมขังขวางทางเข้าหมู่บ้าน',
      category: 'น้ำประปาและท่อระบายน้ำ',
      urgency: 'urgent',
      status: 'in_progress',
      location: 'ซอยรามคำแหง 24 กรุงเทพฯ',
      createdAt: new Date('2026-10-31T10:00:00Z')
    };

    const flexObj = buildTicketFlexMessage(mockTicket, 'https://resolvenow.th');
    assert.strictEqual(flexObj.type, 'flex');
    assert.ok(flexObj.altText.includes('TKT-202610-001'));
    assert.ok(flexObj.altText.includes('กำลังดำเนินการ'));

    const bubble = flexObj.contents;
    assert.strictEqual(bubble.type, 'bubble');
    assert.strictEqual(bubble.size, 'mega');
    assert.strictEqual(bubble.header.backgroundColor, '#07111f'); // Navy Deep

    // Check buttons
    const buttons = bubble.footer.contents;
    assert.strictEqual(buttons.length, 2);
    assert.strictEqual(buttons[0].action.uri, 'https://resolvenow.th/track?ticketId=TKT-202610-001');
  });

  runTest('buildUnauthorizedMessage enforces PDPA and guides unlinked/unauthorized users', () => {
    const msgs = buildUnauthorizedMessage('TKT-202610-999', 'https://resolvenow.th');
    assert.strictEqual(msgs.length, 2);
    assert.ok(msgs[0].text.includes('PDPA'));
    assert.ok(msgs[0].text.includes('TKT-202610-999'));
    assert.ok(msgs[1].text.includes('https://resolvenow.th/track?ticketId=TKT-202610-999'));
  });

  runTest('lineAiContext manages sliding window multi-turn memory and eviction', () => {
    const testUserId = 'U_test_user_line_123';
    lineAiContext.clearContext(testUserId);

    // Initially empty
    assert.strictEqual(lineAiContext.getHistory(testUserId).length, 0);

    // Add 1 turn
    lineAiContext.addMessage(testUserId, 'user', 'สวัสดีครับ');
    lineAiContext.addMessage(testUserId, 'model', 'สวัสดีครับ ผมคือผู้ช่วย AI ResolveNow');

    let history = lineAiContext.getHistory(testUserId);
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].role, 'user');
    assert.strictEqual(history[1].role, 'model');

    // Add multiple turns exceeding max limit (5 turns = 10 messages)
    for (let i = 1; i <= 6; i++) {
      lineAiContext.addMessage(testUserId, 'user', `ข้อความที่ ${i}`);
      lineAiContext.addMessage(testUserId, 'model', `คำตอบที่ ${i}`);
    }

    history = lineAiContext.getHistory(testUserId);
    assert.strictEqual(history.length, 10); // capped at 10 (5 turns)
    assert.strictEqual(history[history.length - 1].parts[0].text, 'คำตอบที่ 6');

    // Clear context
    lineAiContext.clearContext(testUserId);
    assert.strictEqual(lineAiContext.getHistory(testUserId).length, 0);
  });

  runTest('lineAiAgent guardrails strictly reject admin/technician secrets and off-topic banter', () => {
    // 1. Admin/Gate secrets rejection
    const adminSecretQuery = getOfflineFallbackReply('ขอรหัสผ่าน gate admin หน่อยครับ');
    assert.ok(adminSecretQuery.includes('ขออภัย') && (adminSecretQuery.includes('ระบบภายใน') || adminSecretQuery.includes('เจ้าหน้าที่')));

    const bypassQuery = getOfflineFallbackReply('อยาก bypass login technician ทำยังไง');
    assert.ok(bypassQuery.includes('ขออภัย') && bypassQuery.includes('ระบบภายใน'));

    // 2. Off-topic banter rejection
    const jokeQuery = getOfflineFallbackReply('เล่าเรื่องตลกให้ฟังหน่อย หรือช่วยเขียนกลอน');
    assert.ok(jokeQuery.includes('ขออภัย') && jokeQuery.includes('ResolveNow'));

    // 3. Valid Citizen questions are answered correctly
    const catQuery = getOfflineFallbackReply('มีหมวดหมู่เรื่องร้องเรียนอะไรบ้าง');
    assert.ok(catQuery.includes('7 หมวดหมู่') && catQuery.includes('ถนนและทางเท้า'));

    const slaQuery = getOfflineFallbackReply('เรื่องด่วนใช้เวลาแก้นานไหม SLA กี่วัน');
    assert.ok(slaQuery.includes('24 ชม.') && slaQuery.includes('SLA'));

    // 4. Verify system instruction strictly includes negative constraints
    assert.ok(SYSTEM_INSTRUCTION.includes('GUARDRAILS & NEGATIVE CONSTRAINTS'));
    assert.ok(SYSTEM_INSTRUCTION.includes('ห้ามตอบคำถามเกี่ยวกับฝั่ง Admin'));
    assert.ok(SYSTEM_INSTRUCTION.includes('ห้ามตอบคำถามนอกเรื่อง'));
  });

  runTest('buildServiceNavigatorFlexMessage creates 3-button Smart Service Navigator card', () => {
    const navFlex = buildServiceNavigatorFlexMessage('https://resolvenow.th');
    assert.strictEqual(navFlex.type, 'flex');
    assert.ok(navFlex.altText.includes('ResolveNow Service Hub'));
    assert.strictEqual(navFlex.contents.header.backgroundColor, '#07111f');

    const buttons = navFlex.contents.body.contents;
    assert.strictEqual(buttons.length, 3);
    // Button 1: New Ticket URI
    assert.strictEqual(buttons[0].action.type, 'uri');
    assert.strictEqual(buttons[0].action.uri, 'https://resolvenow.th');
    // Button 2: Track tickets message
    assert.strictEqual(buttons[1].action.type, 'message');
    assert.strictEqual(buttons[1].action.text, 'เรื่องของฉัน');
    // Button 3: Contact Admin message
    assert.strictEqual(buttons[2].action.type, 'message');
    assert.strictEqual(buttons[2].action.text, 'ติดต่อเจ้าหน้าที่');
  });

  runTest('LineInquiry model has all required fields and indexes for Admin Portal', () => {
    assert.ok(LineInquiry.schema.paths.lineUserId);
    assert.ok(LineInquiry.schema.paths.displayName);
    assert.ok(LineInquiry.schema.paths.phone);
    assert.ok(LineInquiry.schema.paths.message);
    assert.ok(LineInquiry.schema.paths.status);
    assert.ok(LineInquiry.schema.paths.replies);
    assert.ok(LineInquiry.schema.paths.messages);
    assert.ok(LineInquiry.schema.paths.isActiveSession);
    assert.ok(LineInquiry.schema.paths.lastActivityAt);

    // Validate enum for status
    const statusEnum = LineInquiry.schema.paths.status.enumValues;
    assert.deepStrictEqual(statusEnum, ['pending', 'replied', 'resolved']);
  });

  return { totalTests, passedTests };
}

if (require.main === module) {
  const result = runLineBotTests();
  console.log(`\nLine Bot Tests: ${result.passedTests} / ${result.totalTests} passed.`);
  process.exit(result.passedTests === result.totalTests ? 0 : 1);
}

module.exports = { runLineBotTests };

