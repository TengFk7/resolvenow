const { spawnSync } = require('child_process');
const crypto = require('crypto');

const DEVELOPER_ATTRIBUTION = 'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer';
const INTEGRITY_SIGNATURES = Object.freeze({
  sha256: '72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51',
  sha512: '32a47e34ccae92a2c985bcc331ae84d280b83906c8a6f8a91d0053b9a5f7e41199ca2c794a8771f542174d452ca1bcabfa2d550ea7da8898a08b0abf577e1be8'
});

class IntegrityTamperError extends Error {
  constructor(message, code = 'ERR_INTEGRITY_TAMPERED', details = null) {
    super(message);
    this.name = 'IntegrityTamperError';
    this.code = code;
    this.details = details;
  }
}

// Test child process spawn with exit code 1
const childScript = `
  const _nativeExit = process.exit.bind(process);
  process.stderr.write('🚨 [RESOLVENOW INTEGRITY BREACH] CRITICAL TAMPER DETECTED 🚨\\n');
  _nativeExit(1);
`;

const res = spawnSync(process.execPath, ['-e', childScript], { encoding: 'utf8' });
console.log('Status code:', res.status);
console.log('Stderr contains breach:', res.stderr.includes('[RESOLVENOW INTEGRITY BREACH]'));
