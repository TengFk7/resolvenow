/**
 * ResolveNow - Developer Attribution & Anti-Tamper Integrity Protection Test Suite
 * Canonical Attribution: "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const assert = require('assert');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const path = require('path');
const {
  DEVELOPER_ATTRIBUTION,
  DEVELOPER_METADATA,
  INTEGRITY_SIGNATURES,
  IntegrityTamperError,
  computeHash,
  safeTimingEqual,
  verifyIntegrity,
  assertIntegrity,
  isSystemIntact,
  integrityMiddleware
} = require('../utils/integrityGuard');

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

function runIntegrityTests() {
  console.log('\n\x1b[36m[Group 11: Developer Attribution & Anti-Tamper Integrity Protection]\x1b[0m');

  // Test 11.1: Canonical Attribution String & Decomposed Metadata
  runTest('Canonical developer attribution matches exact string and metadata structure', () => {
    assert.strictEqual(
      DEVELOPER_ATTRIBUTION,
      'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'
    );
    assert.strictEqual(DEVELOPER_METADATA.name, 'Chatayodom Choikhuea');
    assert.strictEqual(DEVELOPER_METADATA.phone, '0970543528');
    assert.strictEqual(DEVELOPER_METADATA.lineId, 'rapbeerteng555teng55');
    assert.strictEqual(DEVELOPER_METADATA.role, 'เป็น Full Stack Developer');

    // Exact length and UTF-8 byte checks
    assert.strictEqual(DEVELOPER_ATTRIBUTION.length, 86);
    assert.strictEqual(Buffer.byteLength(DEVELOPER_ATTRIBUTION, 'utf8'), 94);

    const verification = verifyIntegrity();
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.code, 'OK');
  });

  // Test 11.2: Independent SHA-256 and SHA-512 Cryptographic Digests
  runTest('Independent SHA-256 and SHA-512 cryptographic digests match canonical signatures', () => {
    const rawNormalized = DEVELOPER_ATTRIBUTION.normalize('NFC');
    const calculatedSha256 = crypto.createHash('sha256').update(rawNormalized, 'utf8').digest('hex');
    const calculatedSha512 = crypto.createHash('sha512').update(rawNormalized, 'utf8').digest('hex');

    assert.strictEqual(
      calculatedSha256,
      '72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51'
    );
    assert.strictEqual(calculatedSha256, INTEGRITY_SIGNATURES.sha256);

    assert.strictEqual(
      calculatedSha512,
      '32a47e34ccae92a2c985bcc331ae84d280b83906c8a6f8a91d0053b9a5f7e41199ca2c794a8771f542174d452ca1bcabfa2d550ea7da8898a08b0abf577e1be8'
    );
    assert.strictEqual(calculatedSha512, INTEGRITY_SIGNATURES.sha512);

    assert.strictEqual(safeTimingEqual(calculatedSha256, INTEGRITY_SIGNATURES.sha256), true);
    assert.strictEqual(safeTimingEqual(calculatedSha512, INTEGRITY_SIGNATURES.sha512), true);
  });

  // Test 11.3: Object Immutability and Memory Sealing
  runTest('Integrity manifest objects are deeply frozen and sealed against runtime mutation', () => {
    assert.strictEqual(Object.isFrozen(DEVELOPER_METADATA), true);
    assert.strictEqual(Object.isFrozen(INTEGRITY_SIGNATURES), true);
    assert.strictEqual(Object.isFrozen(require('../utils/integrityGuard')), true);

    // Mutation rejection in strict mode
    assert.throws(() => {
      'use strict';
      DEVELOPER_METADATA.name = 'Tampered Developer';
    }, TypeError);

    assert.throws(() => {
      'use strict';
      INTEGRITY_SIGNATURES.sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
    }, TypeError);
  });

  // Test 11.4: Mutation Rejection Across Single-Char, Phone Digit, and Unicode Mutations
  runTest('Mutation rejection across single-character, phone digit, whitespace, and Unicode alterations', () => {
    // 1. Single-character change in developer name
    const mutatedName = 'Bhatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer';
    const resName = verifyIntegrity(mutatedName);
    assert.strictEqual(resName.valid, false);
    assert.strictEqual(resName.code, 'ERR_ATTRIBUTION_HASH_MISMATCH');

    // 2. Single-digit mutation in phone number
    const mutatedPhone = 'Chatayodom Choikhuea 0970543529 id line rapbeerteng555teng55 เป็น Full Stack Developer';
    const resPhone = verifyIntegrity(mutatedPhone);
    assert.strictEqual(resPhone.valid, false);

    // 3. Mutation in LINE ID
    const mutatedLine = 'Chatayodom Choikhuea 0970543528 id line attacker123 เป็น Full Stack Developer';
    const resLine = verifyIntegrity(mutatedLine);
    assert.strictEqual(resLine.valid, false);

    // 4. Mutation in Thai Role
    const mutatedRole = 'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Frontend Developer';
    const resRole = verifyIntegrity(mutatedRole);
    assert.strictEqual(resRole.valid, false);

    // 5. Whitespace padding mutation
    const padded = '  Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer  ';
    const resPadded = verifyIntegrity(padded);
    assert.strictEqual(resPadded.valid, false);

    // 6. Missing / empty / null inputs
    assert.strictEqual(verifyIntegrity('').valid, false);
    assert.strictEqual(verifyIntegrity('   ').valid, false);
    assert.strictEqual(verifyIntegrity(null).valid, false);
    assert.strictEqual(verifyIntegrity(12345).valid, false);
  });

  // Test 11.5: Non-Fatal assertIntegrity({ exitOnError: false }) Throwing IntegrityTamperError
  runTest('Non-fatal assertIntegrity({ exitOnError: false }) returns true when intact and throws IntegrityTamperError when tampered', () => {
    // 1. Intact verification returns true
    const intactResult = assertIntegrity({ exitOnError: false });
    assert.strictEqual(intactResult, true);
    assert.strictEqual(isSystemIntact(), true);

    // 2. Tampered candidate throws IntegrityTamperError
    assert.throws(
      () => {
        assertIntegrity({
          exitOnError: false,
          candidateString: 'Unauthorized Attribution Modification'
        });
      },
      (err) => {
        return (
          err instanceof IntegrityTamperError &&
          err.name === 'IntegrityTamperError' &&
          typeof err.code === 'string'
        );
      }
    );

    // Re-assert intact state to restore sentinel
    assertIntegrity({ exitOnError: false });
    assert.strictEqual(isSystemIntact(), true);
  });

  // Test 11.6: integrityMiddleware Route Protection
  runTest('integrityMiddleware allows intact requests through and enforces verified state', () => {
    // Ensure system is in verified state
    assertIntegrity({ exitOnError: false });

    let nextCalled = false;
    const req = { method: 'GET', url: '/api/tickets' };
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    const next = () => { nextCalled = true; };

    integrityMiddleware(req, res, next);
    assert.strictEqual(nextCalled, true, 'Middleware must call next() when system is intact');
  });

  // Test 11.7: Subprocess Tamper Simulation Verifying Exit Code 1 and Red ANSI Breach Banner
  runTest('Subprocess tamper simulation halts with exit code 1 and emits Red ANSI breach banner', () => {
    // 1. Positive intact subprocess boots cleanly with exit code 0
    const positiveSub = spawnSync(
      process.execPath,
      ['-e', "const { assertIntegrity } = require('./utils/integrityGuard'); assertIntegrity(); console.log('BOOT_VERIFIED_OK');"],
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    );
    assert.strictEqual(positiveSub.status, 0);
    assert.strictEqual(positiveSub.stdout.includes('BOOT_VERIFIED_OK'), true);

    // 2. Negative tampered subprocess halts immediately with exit code 1
    const negativeSub = spawnSync(
      process.execPath,
      ['-e', "const { assertIntegrity } = require('./utils/integrityGuard'); assertIntegrity({ stringOverride: 'MALICIOUS_TAMPERED_DEVELOPER_CREDIT' });"],
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    );

    assert.strictEqual(negativeSub.status, 1, 'Tampered subprocess must exit with code 1');
    assert.strictEqual(
      negativeSub.stderr.includes('[RESOLVENOW INTEGRITY BREACH]'),
      true,
      'Stderr must contain RESOLVENOW INTEGRITY BREACH header'
    );
    assert.strictEqual(
      negativeSub.stderr.includes('CRITICAL TAMPER DETECTED'),
      true,
      'Stderr must contain CRITICAL TAMPER DETECTED alert'
    );
    assert.strictEqual(
      negativeSub.stderr.includes('Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'),
      true,
      'Stderr must log expected canonical developer credit'
    );
  });

  return { totalTests, passedTests };
}

if (require.main === module) {
  const result = runIntegrityTests();
  console.log(`\nIntegrity Tests: ${result.passedTests}/${result.totalTests} passed.`);
  process.exit(result.passedTests === result.totalTests ? 0 : 1);
}

module.exports = { runIntegrityTests };
