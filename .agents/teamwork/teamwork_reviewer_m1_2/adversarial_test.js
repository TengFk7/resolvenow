const { spawnSync } = require('child_process');
const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

console.log('=== Starting Adversarial & Edge-Case Stress Test Suite ===\n');

// 1. Module Exports & Immutability Test
console.log('[Test 1: Module Exports Immutability]');
const guard = require('../../../utils/integrityGuard');
assert(Object.isFrozen(guard), 'Guard module exports must be frozen');
assert(Object.isFrozen(guard.INTEGRITY_SIGNATURES), 'Signatures must be frozen');
assert(Object.isFrozen(guard.DEVELOPER_METADATA), 'Developer metadata must be frozen');

try {
  guard.DEVELOPER_ATTRIBUTION = 'Hacked';
} catch (e) {
  // strict mode might throw or fail silently
}
assert.strictEqual(
  guard.DEVELOPER_ATTRIBUTION,
  'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer',
  'Canonical attribution must be immutable'
);
console.log('✔ Immutability verified');

// 2. Cryptographic Digest Integrity
console.log('\n[Test 2: Cryptographic Digest Integrity]');
const canonical = guard.DEVELOPER_ATTRIBUTION;
const rawSha256 = crypto.createHash('sha256').update(canonical.normalize('NFC'), 'utf8').digest('hex');
const rawSha512 = crypto.createHash('sha512').update(canonical.normalize('NFC'), 'utf8').digest('hex');
assert.strictEqual(rawSha256, guard.INTEGRITY_SIGNATURES.sha256, 'SHA-256 digest must match exactly');
assert.strictEqual(rawSha512, guard.INTEGRITY_SIGNATURES.sha512, 'SHA-512 digest must match exactly');
console.log('✔ Cryptographic digests verified');

// 3. Timing Safe Equal Edge Cases
console.log('\n[Test 3: Timing-Safe Comparison Robustness]');
assert.strictEqual(guard.safeTimingEqual(rawSha256, rawSha256), true, 'Identical hashes must return true');
assert.strictEqual(guard.safeTimingEqual(rawSha256, rawSha256.slice(0, 63) + '0'), false, '1-bit difference must return false');
assert.strictEqual(guard.safeTimingEqual(rawSha256, 'too_short'), false, 'Different lengths must return false without throwing');
assert.strictEqual(guard.safeTimingEqual(null, rawSha256), false, 'Null input must return false');
assert.strictEqual(guard.safeTimingEqual(undefined, rawSha256), false, 'Undefined input must return false');
assert.strictEqual(guard.safeTimingEqual({}, rawSha256), false, 'Object input must return false');
assert.strictEqual(guard.safeTimingEqual(12345, rawSha256), false, 'Number input must return false');
assert.strictEqual(guard.safeTimingEqual('', ''), true, 'Empty strings must return true');
console.log('✔ Timing-safe comparison robustness verified');

// 4. Unicode & NFC Normalization Resilience
console.log('\n[Test 4: Unicode & NFC Normalization Resilience]');
const nfcResult = guard.verifyIntegrity(canonical);
assert.strictEqual(nfcResult.valid, true, 'Canonical NFC must be valid');
assert.strictEqual(nfcResult.code, 'OK');

// NFD decomposition simulation
const nfdString = canonical.normalize('NFD');
const nfdResult = guard.verifyIntegrity(nfdString);
assert.strictEqual(nfdResult.valid, true, 'NFD string must be normalized to NFC and pass verification');
console.log('✔ Unicode & NFC normalization resilience verified');

// 5. Tamper Detection & Granular Error Codes
console.log('\n[Test 5: Tamper Detection & Granular Error Codes]');
// 5a. Missing/empty
const emptyRes = guard.verifyIntegrity('');
assert.strictEqual(emptyRes.valid, false);
assert.strictEqual(emptyRes.code, 'ERR_ATTRIBUTION_MISSING');

const nullRes = guard.verifyIntegrity(null);
assert.strictEqual(nullRes.valid, false);
assert.strictEqual(nullRes.code, 'ERR_ATTRIBUTION_MISSING');

// 5b. Length mismatch
const shortRes = guard.verifyIntegrity('Chatayodom Choikhuea');
assert.strictEqual(shortRes.valid, false);
assert.strictEqual(shortRes.code, 'ERR_ATTRIBUTION_LENGTH_MISMATCH');

// 5c. Same length and same bytes but tampered character
const sameLenTampered = canonical.replace('0970543528', '0980543528');
assert.strictEqual(sameLenTampered.length, canonical.length, 'Lengths must be identical');
assert.strictEqual(Buffer.byteLength(sameLenTampered, 'utf8'), Buffer.byteLength(canonical, 'utf8'), 'Byte lengths must be identical');
const hashMismatchRes = guard.verifyIntegrity(sameLenTampered);
assert.strictEqual(hashMismatchRes.valid, false);
assert.strictEqual(hashMismatchRes.code, 'ERR_ATTRIBUTION_HASH_MISMATCH');
console.log('✔ Granular error codes verified (MISSING, LENGTH_MISMATCH, HASH_MISMATCH)');

// 6. Non-Fatal Assertion in Test Mode
console.log('\n[Test 6: Non-Fatal assertIntegrity with exitOnError=false]');
assert.strictEqual(guard.assertIntegrity({ exitOnError: false }), true, 'Intact assert must return true');

let errorThrown = null;
try {
  guard.assertIntegrity({ exitOnError: false, candidateString: 'tampered text' });
} catch (err) {
  errorThrown = err;
}
assert(errorThrown instanceof guard.IntegrityTamperError, 'Should throw IntegrityTamperError');
assert.strictEqual(errorThrown.code, 'ERR_ATTRIBUTION_LENGTH_MISMATCH');
assert(errorThrown.message.includes('[ResolveNow Integrity Tampered]'));
console.log('✔ Non-fatal assertion with IntegrityTamperError verified');

// 7. Process Exit Native Closure & Monkey-Patch Resistance
console.log('\n[Test 7: Native process.exit Monkey-Patch Resistance in Subprocess]');
const childScript = `
const guard = require('./utils/integrityGuard');
let monkeyPatchedCalled = false;
process.exit = function(code) {
  monkeyPatchedCalled = true;
  console.log('MONKEY_PATCH_TRAP_CALLED');
};
// Trigger fatal assertion with tampered string
guard.assertIntegrity({ candidateString: 'tampered' });
console.log('UNREACHABLE_CODE_EXECUTED');
`;

const procResult = spawnSync(process.execPath, ['-e', childScript], {
  cwd: path.resolve(__dirname, '../../../'),
  encoding: 'utf8'
});

assert.strictEqual(procResult.status, 1, 'Child process must terminate with exit code 1');
assert(!procResult.stdout.includes('UNREACHABLE_CODE_EXECUTED'), 'Execution must halt immediately');
assert(!procResult.stdout.includes('MONKEY_PATCH_TRAP_CALLED'), 'Monkey patch must not intercept native exit');
assert(procResult.stderr.includes('CRITICAL TAMPER DETECTED'), 'Stderr must output Red ANSI tamper alert');
console.log('✔ Native exit monkey-patch resistance verified in isolated child process');

// 8. Express Middleware Behavior Under Compromised State
console.log('\n[Test 8: Express Middleware Halting Behavior]');
const middlewareChildScript = `
const guard = require('./utils/integrityGuard');
// System starts unverified (before assertIntegrity)
let statusSet = null;
let jsonSent = null;
let nextCalled = false;

const req = {};
const res = {
  status: (s) => { statusSet = s; return res; },
  json: (j) => { jsonSent = j; return res; }
};
const next = () => { nextCalled = true; };

guard.integrityMiddleware(req, res, next);
console.log('STATUS:' + statusSet + ',NEXT:' + nextCalled);
`;

const mwResult = spawnSync(process.execPath, ['-e', middlewareChildScript], {
  cwd: path.resolve(__dirname, '../../../'),
  encoding: 'utf8'
});

assert.strictEqual(mwResult.status, 1, 'Middleware on unverified system must terminate process with code 1');
assert(mwResult.stderr.includes('ERR_RUNTIME_TAMPER'), 'Middleware must output runtime tamper banner to stderr');
console.log('✔ Express middleware security halt verified in isolated child process');

// 9. Startup Banner Formatting & Content
console.log('\n[Test 9: Startup Banner Formatting & URLs]');
const banner = guard.formatStartupBanner(3001);
assert(banner.includes('ResolveNow — Smart City Complaint & Work Order Management Platform'), 'Banner must have title');
assert(banner.includes(guard.DEVELOPER_ATTRIBUTION), 'Banner must include canonical attribution');
assert(banner.includes('http://localhost:3001/'), 'Banner must include Citizen Portal');
assert(banner.includes('http://localhost:3001/my-tickets'), 'Banner must include My Tickets Portal');
assert(banner.includes('http://localhost:3001/admin'), 'Banner must include Admin Portal');
assert(banner.includes('http://localhost:3001/tech'), 'Banner must include Tech Portal');
assert(banner.includes('http://localhost:3001/ceo'), 'Banner must include CEO Portal');
assert(banner.includes('http://localhost:3001/track'), 'Banner must include Track Portal');
console.log('✔ Startup banner verified');

// 10. Health Check JSON Structure & Field Preservations
console.log('\n[Test 10: Health Check JSON Structure]');
const serverFile = require('fs').readFileSync(path.resolve(__dirname, '../../../server.js'), 'utf8');
assert(serverFile.includes("integrity: 'VERIFIED_GENUINE'"), 'Server must return integrity: VERIFIED_GENUINE');
assert(serverFile.includes('attribution: DEVELOPER_ATTRIBUTION'), 'Server must return attribution');
assert(serverFile.includes('developer: DEVELOPER_METADATA'), 'Server must return developer metadata');
assert(serverFile.includes("status: 'ok'"), 'Server must retain status: ok');
assert(serverFile.includes("uptime: Math.floor(process.uptime())"), 'Server must retain uptime');
assert(serverFile.includes("db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'"), 'Server must retain db status');
console.log('✔ Health check endpoint schema verified');

console.log('\n============================================================');
console.log('🎉 ALL 10 ADVERSARIAL & STRESS-TEST SCENARIOS PASSED 100%!');
console.log('============================================================');
