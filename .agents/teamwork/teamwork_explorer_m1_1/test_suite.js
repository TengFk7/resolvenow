const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const guard = require('./proposed_integrityGuard');

console.log('\n=== Testing proposed_integrityGuard.js ===\n');

// 1. Constants and Metadata Verification
assert.strictEqual(
  guard.DEVELOPER_ATTRIBUTION,
  'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'
);
assert.strictEqual(guard.DEVELOPER_METADATA.name, 'Chatayodom Choikhuea');
assert.strictEqual(guard.DEVELOPER_METADATA.phone, '0970543528');
assert.strictEqual(guard.DEVELOPER_METADATA.lineId, 'rapbeerteng555teng55');
assert.strictEqual(guard.DEVELOPER_METADATA.role, 'เป็น Full Stack Developer');
assert.strictEqual(
  guard.INTEGRITY_SIGNATURES.sha256,
  '72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51'
);
assert.strictEqual(
  guard.INTEGRITY_SIGNATURES.sha512,
  '32a47e34ccae92a2c985bcc331ae84d280b83906c8a6f8a91d0053b9a5f7e41199ca2c794a8771f542174d452ca1bcabfa2d550ea7da8898a08b0abf577e1be8'
);
console.log('✔ Constants & Metadata verified');

// 2. Object.freeze Immutability
assert(Object.isFrozen(guard));
assert(Object.isFrozen(guard.DEVELOPER_METADATA));
assert(Object.isFrozen(guard.INTEGRITY_SIGNATURES));
try {
  guard.DEVELOPER_ATTRIBUTION = 'TAMPER';
} catch (e) {}
assert.strictEqual(
  guard.DEVELOPER_ATTRIBUTION,
  'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'
);
console.log('✔ Immutability & Object.freeze verified');

// 3. Pure verifyIntegrity() with Default Canonical Watermark
const validDefault = guard.verifyIntegrity();
assert.strictEqual(validDefault.valid, true);
assert.strictEqual(validDefault.code, 'OK');
assert.strictEqual(validDefault.sha256, guard.INTEGRITY_SIGNATURES.sha256);
console.log('✔ verifyIntegrity() default canonical check passed');

// 4. verifyIntegrity() with Explicit Canonical Watermark
const validExplicit = guard.verifyIntegrity(guard.DEVELOPER_ATTRIBUTION);
assert.strictEqual(validExplicit.valid, true);
assert.strictEqual(validExplicit.code, 'OK');
console.log('✔ verifyIntegrity(canonical) passed');

// 5. Tampered Candidate Strings
const tampered1 = guard.verifyIntegrity('Wrong name 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer');
assert.strictEqual(tampered1.valid, false);
console.log('✔ verifyIntegrity() detected name tamper');

const tamperedPhone = guard.verifyIntegrity(guard.DEVELOPER_ATTRIBUTION.replace('0970543528', '0970543529'));
assert.strictEqual(tamperedPhone.valid, false);
assert.strictEqual(tamperedPhone.code, 'ERR_ATTRIBUTION_HASH_MISMATCH');
console.log('✔ verifyIntegrity() detected phone tamper with exact byte-length');

const tamperedEmpty = guard.verifyIntegrity('');
assert.strictEqual(tamperedEmpty.valid, false);
assert.strictEqual(tamperedEmpty.code, 'ERR_ATTRIBUTION_MISSING');
console.log('✔ verifyIntegrity() detected empty string');

const tamperedNull = guard.verifyIntegrity(null);
assert.strictEqual(tamperedNull.valid, false);
assert.strictEqual(tamperedNull.code, 'ERR_ATTRIBUTION_MISSING');
console.log('✔ verifyIntegrity() detected null candidate');

// 6. assertIntegrity({ exitOnError: false }) Positive & Negative
assert.strictEqual(guard.assertIntegrity({ exitOnError: false }), true);
assert.strictEqual(guard.isSystemIntact(), true);
console.log('✔ assertIntegrity({ exitOnError: false }) passed on intact');

assert.throws(
  () => {
    guard.assertIntegrity({ exitOnError: false, stringOverride: 'HACKED' });
  },
  (err) => {
    return err instanceof guard.IntegrityTamperError &&
           err.code === 'ERR_ATTRIBUTION_LENGTH_MISMATCH' &&
           err.message.includes('[ResolveNow Integrity Tampered]');
  }
);
console.log('✔ assertIntegrity() threw IntegrityTamperError on tamper when exitOnError=false');

// 7. Child process verification of process.exit(1) and Red ANSI Tamper Alert Banner
const childTamper = spawnSync(process.execPath, [
  '-e',
  `const guard = require(${JSON.stringify(path.resolve(__dirname, 'proposed_integrityGuard.js'))}); guard.assertIntegrity({ stringOverride: 'tampered' });`
], { encoding: 'utf8' });

assert.strictEqual(childTamper.status, 1, 'Child process must exit with code 1');
assert(childTamper.stderr.includes('RESOLVENOW INTEGRITY BREACH'), 'Stderr must contain breach headline');
assert(childTamper.stderr.includes('CRITICAL TAMPER DETECTED'), 'Stderr must contain critical tamper notice');
assert(childTamper.stderr.includes('Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'), 'Stderr must print expected developer attribution');
console.log('✔ Child process tamper halt (exit code 1 + red ANSI banner) verified');

// 8. Child process verification of intact boot
const childIntact = spawnSync(process.execPath, [
  '-e',
  `const guard = require(${JSON.stringify(path.resolve(__dirname, 'proposed_integrityGuard.js'))}); guard.assertIntegrity(); process.exit(0);`
], { encoding: 'utf8' });

assert.strictEqual(childIntact.status, 0, 'Intact boot must exit with code 0');
console.log('✔ Child process intact boot verified');

// 9. Startup banner check
const bannerText = guard.formatStartupBanner(3001);
assert(bannerText.includes('Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'));
assert(bannerText.includes('72d9c9f2ac8a64f7'));
assert(bannerText.includes('http://localhost:3001/'));
console.log('✔ Startup banner format verified');

// 10. Express Middleware Mock Test - Intact
let middlewareCalledNext = false;
guard.assertIntegrity({ exitOnError: false }); // Ensure intact state
guard.integrityMiddleware({}, {}, () => { middlewareCalledNext = true; });
assert.strictEqual(middlewareCalledNext, true);
console.log('✔ integrityMiddleware passed next() on intact state');

// 11. Express Middleware Child Process Test - Tampered / Unverified Halt
const childMiddlewareHalt = spawnSync(process.execPath, [
  '-e',
  `
  const guard = require(${JSON.stringify(path.resolve(__dirname, 'proposed_integrityGuard.js'))});
  // Do not call assertIntegrity(), _isVerified is false
  const req = {};
  const res = {
    status(s) { this.statusCode = s; return this; },
    json(data) { this.data = data; return this; }
  };
  guard.integrityMiddleware(req, res, () => {
    process.stdout.write('FAIL_NEXT_CALLED');
  });
  `
], { encoding: 'utf8' });

assert.strictEqual(childMiddlewareHalt.status, 1, 'Middleware halt must exit with code 1');
assert(childMiddlewareHalt.stderr.includes('RESOLVENOW INTEGRITY BREACH'), 'Middleware stderr must contain breach banner');
console.log('✔ integrityMiddleware child process halt (exit code 1 + red banner) on unverified state verified');

console.log('\n🎉 ALL 11 TEST GROUPS IN TEST_SUITE PASSED WITH 100% SUCCESS!\n');
