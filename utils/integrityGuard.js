/**
 * ResolveNow - Developer Attribution & Anti-Tamper Integrity Guard
 * Canonical Attribution: "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const crypto = require('crypto');

// ── 1. Native Exit Pointer & Runtime Integrity State ────────────────
// Capture native process.exit at module load to resist runtime monkey-patching
const _nativeExit = (typeof process !== 'undefined' && typeof process.exit === 'function')
  ? process.exit.bind(process)
  : () => { throw new Error('process.exit unavailable'); };

// In-memory verification sentinel (O(1) memory lookup for high-concurrency middleware)
let _isVerified = false;

// ── 2. Canonical Attribution & Verified Dual Signatures ─────────────
const DEVELOPER_ATTRIBUTION = 'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer';

const DEVELOPER_METADATA = Object.freeze({
  name: 'Chatayodom Choikhuea',
  phone: '0970543528',
  lineId: 'rapbeerteng555teng55',
  role: 'เป็น Full Stack Developer'
});

const INTEGRITY_SIGNATURES = Object.freeze({
  sha256: '72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51',
  sha512: '32a47e34ccae92a2c985bcc331ae84d280b83906c8a6f8a91d0053b9a5f7e41199ca2c794a8771f542174d452ca1bcabfa2d550ea7da8898a08b0abf577e1be8'
});

// ── 3. Custom Error Class for Non-Fatal Testing ─────────────────────
class IntegrityTamperError extends Error {
  constructor(message, code = 'ERR_INTEGRITY_TAMPERED', details = null) {
    super(message);
    this.name = 'IntegrityTamperError';
    this.code = code;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IntegrityTamperError);
    }
  }
}

// ── 4. Cryptographic Utility Functions ──────────────────────────────

/**
 * Computes hexadecimal hash digest of text normalized with Unicode NFC.
 * @param {string} text - Input text
 * @param {'sha256'|'sha512'} [algo='sha256'] - Hash algorithm
 * @returns {string} Hex-encoded digest
 */
function computeHash(text, algo = 'sha256') {
  if (typeof text !== 'string') return '';
  return crypto.createHash(algo).update(text.normalize('NFC'), 'utf8').digest('hex');
}

/**
 * Timing-safe comparison of two hex digest strings.
 * Prevents timing attacks and handles length inequality gracefully.
 * @param {string} actualHex
 * @param {string} expectedHex
 * @returns {boolean}
 */
function safeTimingEqual(actualHex, expectedHex) {
  if (typeof actualHex !== 'string' || typeof expectedHex !== 'string') return false;
  const bufActual = Buffer.from(actualHex, 'utf8');
  const bufExpected = Buffer.from(expectedHex, 'utf8');
  if (bufActual.length !== bufExpected.length) return false;
  return crypto.timingSafeEqual(bufActual, bufExpected);
}

// ── 5. Core Pure Verification Function ──────────────────────────────

/**
 * Pure verification function. Never exits the process.
 * Safe for unit testing and non-fatal inspections.
 * 
 * @param {string} [candidateString] - String to test (defaults to canonical attribution if omitted)
 * @returns {{ valid: boolean, error?: string, code: string, sha256: string, sha512?: string, attribution?: string }}
 */
function verifyIntegrity(candidateString) {
  // If no arguments provided (or undefined), verify internal canonical attribution
  const target = (arguments.length === 0 || candidateString === undefined)
    ? DEVELOPER_ATTRIBUTION
    : candidateString;

  // 1. Missing or non-string check
  if (typeof target !== 'string' || target.trim().length === 0) {
    return {
      valid: false,
      code: 'ERR_ATTRIBUTION_MISSING',
      error: 'Developer attribution string is missing or empty',
      sha256: ''
    };
  }

  // 2. Unicode normalization (NFC)
  const normalized = target.normalize('NFC');
  const computedSha256 = computeHash(normalized, 'sha256');
  const computedSha512 = computeHash(normalized, 'sha512');
  const byteLength = Buffer.byteLength(normalized, 'utf8');

  // 3. Length and byte verification (Exact canonical is 86 UTF-16 code units and 94 UTF-8 bytes)
  if (normalized.length !== 86 || byteLength !== 94) {
    return {
      valid: false,
      code: 'ERR_ATTRIBUTION_LENGTH_MISMATCH',
      error: `Attribution length mismatch (expected 86 chars / 94 bytes, got ${normalized.length} chars / ${byteLength} bytes)`,
      sha256: computedSha256,
      sha512: computedSha512,
      attribution: target
    };
  }

  // 4. Primary Cryptographic SHA-256 Digest Validation
  const isSha256Match = safeTimingEqual(computedSha256, INTEGRITY_SIGNATURES.sha256);
  if (!isSha256Match) {
    return {
      valid: false,
      code: 'ERR_ATTRIBUTION_HASH_MISMATCH',
      error: 'Cryptographic SHA-256 hash mismatch for developer attribution',
      sha256: computedSha256,
      sha512: computedSha512,
      attribution: target
    };
  }

  // 5. Secondary Cryptographic SHA-512 Digest Validation (Dual-hash defense)
  const isSha512Match = safeTimingEqual(computedSha512, INTEGRITY_SIGNATURES.sha512);
  if (!isSha512Match) {
    return {
      valid: false,
      code: 'ERR_ATTRIBUTION_SECONDARY_HASH_MISMATCH',
      error: 'Cryptographic SHA-512 secondary hash mismatch for developer attribution',
      sha256: computedSha256,
      sha512: computedSha512,
      attribution: target
    };
  }

  return {
    valid: true,
    code: 'OK',
    sha256: computedSha256,
    sha512: computedSha512,
    attribution: target
  };
}

// ── 6. Banner Formatters ────────────────────────────────────────────

/**
 * Formats prominent Red ANSI Tamper Alert Banner for stderr.
 * @param {Object} details - Failure details from verifyIntegrity
 * @returns {string}
 */
function formatTamperBanner(details = {}) {
  const line = '='.repeat(80);
  return [
    '\x1b[31;1m' + line,
    '🚨 [RESOLVENOW INTEGRITY BREACH] CRITICAL TAMPER DETECTED 🚨',
    line + '\x1b[0m',
    '\x1b[33mCRITICAL ERROR: Developer attribution or integrity signature has been altered,',
    '                modified, or removed!\x1b[0m',
    '',
    '\x1b[37mTamper Details:\x1b[0m',
    `  - Error Code     : \x1b[31;1m${details.code || 'ERR_INTEGRITY_TAMPERED'}\x1b[0m`,
    `  - Failure Reason : ${details.error || 'Attribution hash mismatch or canonical metadata tampered'}`,
    `  - Expected Credit: \x1b[32m${DEVELOPER_ATTRIBUTION}\x1b[0m`,
    `  - Expected SHA256: ${INTEGRITY_SIGNATURES.sha256}`,
    `  - Actual SHA256  : ${details.sha256 || 'N/A'}`,
    '  - Security Action: \x1b[31;1mSystem startup halted immediately. Execution terminated.\x1b[0m',
    '',
    'ResolveNow refuses to boot or serve requests in a compromised or tampered state.',
    'Please restore the authentic developer attribution and integrity signature.',
    '\x1b[31;1m' + line + '\x1b[0m'
  ].join('\n');
}

/**
 * Formats formatted ASCII banner printing developer attribution and watermark status.
 * @param {number|string} [port=3001]
 * @returns {string}
 */
function formatStartupBanner(port = 3001) {
  const line = '='.repeat(80);
  const title = 'ResolveNow';
  const centeredTitle = ' '.repeat(Math.floor((line.length - title.length) / 2)) + title;
  return [
    '\x1b[36m' + line + '\x1b[0m',
    `  \x1b[1m${centeredTitle.slice(2)}\x1b[0m`,
    `  \x1b[32m✔ Developer :\x1b[0m ${DEVELOPER_METADATA.name} ${DEVELOPER_METADATA.phone} id line ${DEVELOPER_METADATA.lineId}  Full Stack Developer Kub.`,
    `  \x1b[32m✔ Integrity :\x1b[0m [SECURE - SHA256 VERIFIED: ${INTEGRITY_SIGNATURES.sha256.slice(0, 16)}...]`,
    '\x1b[36m' + line + '\x1b[0m'
  ].join('\n');
}

/**
 * Prints formatted startup banner to stdout.
 * @param {number|string} [port=3001]
 */
function printStartupBanner(port = 3001) {
  console.log(formatStartupBanner(port));
}

// ── 7. System Gate & Assertion Routine ──────────────────────────────

/**
 * Asserts system integrity.
 * If intact: updates in-memory sentinel and returns true.
 * If tampered:
 *   - When options.exitOnError === false: throws IntegrityTamperError (for tests).
 *   - Default: logs Red ANSI tamper banner to stderr and invokes native process.exit(1).
 * 
 * @param {Object} [options]
 * @param {boolean} [options.exitOnError=true]
 * @param {string} [options.candidateString]
 * @param {string} [options.stringOverride]
 * @returns {boolean}
 */
function assertIntegrity(options = {}) {
  const opts = (typeof options === 'object' && options !== null) ? options : {};
  const exitOnError = opts.exitOnError !== false;
  const target = (opts.stringOverride !== undefined)
    ? opts.stringOverride
    : (opts.candidateString !== undefined ? opts.candidateString : undefined);

  const result = (target !== undefined) ? verifyIntegrity(target) : verifyIntegrity();

  if (!result.valid) {
    _isVerified = false;
    const banner = formatTamperBanner(result);
    process.stderr.write(banner + '\n');

    if (exitOnError === false) {
      throw new IntegrityTamperError(
        `[ResolveNow Integrity Tampered] ${result.error}`,
        result.code,
        result
      );
    }

    try {
      _nativeExit(1);
    } catch (_err) {
      process.kill(process.pid, 'SIGKILL');
    }
    return false;
  }

  _isVerified = true;
  return true;
}

/**
 * Returns true if the system's in-memory sentinel and live canonical signature are intact.
 * @returns {boolean}
 */
function isSystemIntact() {
  return _isVerified && verifyIntegrity().valid;
}

// ── 8. Route Middleware for Express ─────────────────────────────────

/**
 * Express middleware performing O(1) in-memory integrity check for /api/* routes.
 * Blocks requests and terminates server immediately if tampered.
 */
function integrityMiddleware(req, res, next) {
  if (!isSystemIntact()) {
    const banner = formatTamperBanner({
      code: 'ERR_RUNTIME_TAMPER',
      error: 'System integrity compromised at runtime. Unverified state on API request.'
    });
    process.stderr.write(banner + '\n');
    res.status(500).json({
      error: 'CRITICAL_SECURITY_HALT: System integrity compromised. Service halted.',
      code: 'ERR_INTEGRITY_TAMPERED'
    });
    try {
      _nativeExit(1);
    } catch (_err) {
      process.kill(process.pid, 'SIGKILL');
    }
    return;
  }
  next();
}

// ── 9. Module Exports (Deep Sealed) ─────────────────────────────────
module.exports = Object.freeze({
  DEVELOPER_ATTRIBUTION,
  DEVELOPER_METADATA,
  INTEGRITY_SIGNATURES,
  IntegrityTamperError,
  computeHash,
  safeTimingEqual,
  verifyIntegrity,
  assertIntegrity,
  isSystemIntact,
  integrityMiddleware,
  formatStartupBanner,
  formatTamperBanner,
  printStartupBanner
});
