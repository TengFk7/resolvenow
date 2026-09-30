/**
 * ResolveNow - Complaint Management System
 * Anti-Spam, Prank & Gibberish Filtering Engine (Cognitive Heuristics & Geofencing)
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ── 1. Keyboard Smash & Gibberish Patterns ─────────────────────────
const KEYBOARD_SEQUENCES = [
  // English QWERTY rows & patterns
  'asdf', 'asdfgh', 'asdfghjkl', 'qwerty', 'zxcvbn', 'zxcvbnm', 'qazwsx',
  '12345', '123456', '12345678', '0987654', 'abcdef',
  // Thai Kedmanee rows & sequences
  'กฟหก', 'ฟหกด', 'ฟหกด่าสว', 'ผปแอิ', 'ๆไำพะ', 'ะพำไๆ', 'กด่าสว', 'ด่าสว'
];

// Common test/placeholder phrases
const TEST_PHRASES = [
  'test', 'testing', 'tester', 'test1234', 'test1', 'test2', 'test 123',
  'ทดสอบ', 'ทดสอบระบบ', 'ลองส่ง', 'ลองระบบ', 'ลองดู', 'ลองเล่น', 'ลองเทส',
  'เทสระบบ', 'ทดลองระบบ', 'เทสๆ', 'เทส', '1234', '12345', '123456',
  'aaa', 'bbb', 'ccc', 'sample', 'dummy', 'hello world', 'check system'
];

// Profanity / Abuse Blacklist (Non-civic harassment / vulgar abuse)
const PROFANITY_PATTERNS = [
  /ควย/i, /เย็ด/i, /เยด/i, /เหี้ย/i, /สัส/i, /ไอ้สัส/i, /มึง/i, /กูด่า/i,
  /พ่องตาย/i, /แม่มึง/i, /จวย/i, /หี/i, /แตด/i, /เงี่ยน/i, /เย็ดแม่/i,
  /ไอ้ควาย/i, /สถุล/i, /ไอ้สัตว์/i, /กวนตีน/i, /กวนส้นตีน/i, /เสือก/i,
  /\bfuck\b/i, /\bshit\b/i, /\basshole\b/i, /\bbitch\b/i, /\bdick\b/i
];

// Out-of-domain Jokes / Non-city personal issues
const OUT_OF_DOMAIN_PATTERNS = [
  // Romance / Relationship jokes
  /แฟนทิ้ง/, /อกหัก/, /โดนแฟนบอกเลิก/, /โดนบอกเลิก/, /แฟนไม่รัก/,
  /หาแฟน/, /อยากมีแฟน/, /หาคู่/, /หาคนคุย/, /เหงาจัง/, /เหงามาก/, /คิดถึงแฟนเก่า/,
  // Money borrowing / Gambling / Lottery jokes
  /ขอยืมเงิน/, /ยืมเงินหน่อย/, /กู้เงิน/, /ขอตังค์/, /ไม่มีตังค์กินข้าว/,
  /หวยงวดนี้ออกอะไร/, /ขอหวย/, /แทงหวย/, /บอกเลขเด็ด/, /เลขเด็ด/,
  // General pranks & games
  /เล่นเกมกัน/, /กวนประสาท/, /มาเล่นเฉยๆ/, /เบื่อจังไม่มีไรทำ/
];

/**
 * Calculates Shannon entropy of a string to detect randomness / repetitive characters.
 * @param {string} str
 * @returns {number}
 */
function calculateEntropy(str) {
  if (!str || typeof str !== 'string') return 0;
  const len = str.length;
  if (len === 0) return 0;

  const freqs = {};
  for (let i = 0; i < len; i++) {
    const ch = str[i];
    freqs[ch] = (freqs[ch] || 0) + 1;
  }

  let entropy = 0;
  for (const ch in freqs) {
    const p = freqs[ch] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Analyzes vowel to consonant distribution for Thai and English characters.
 * In Thai, normal words of length >= 6 almost always contain vowels.
 * @param {string} str
 * @returns {{ thaiConsonants: number, thaiVowels: number, uniqueRatio: number }}
 */
function analyzeLinguisticProperties(str) {
  if (!str || typeof str !== 'string') return { thaiConsonants: 0, thaiVowels: 0, uniqueRatio: 0 };
  const clean = str.replace(/\s+/g, '');
  if (!clean.length) return { thaiConsonants: 0, thaiVowels: 0, uniqueRatio: 0 };

  // Thai consonants: ก-ฮ (\u0E01 - \u0E2E)
  const thaiConsonants = (clean.match(/[\u0E01-\u0E2E]/g) || []).length;
  // Thai vowels: ะ-ู เ แ โ ใ ไ ั ็ (\u0E30-\u0E39, \u0E40-\u0E47)
  const thaiVowels = (clean.match(/[\u0E30-\u0E39\u0E40-\u0E47]/g) || []).length;

  const uniqueChars = new Set(clean).size;
  const uniqueRatio = uniqueChars / clean.length;

  return { thaiConsonants, thaiVowels, uniqueRatio };
}

/**
 * Validates GPS coordinates against Thailand geographic bounding box.
 * Thailand is approx: Lat 5.61°N - 20.47°N, Lng 97.34°E - 105.64°E
 * @param {number|string} lat
 * @param {number|string} lng
 * @returns {{ isValid: boolean, isOutOfBounds: boolean, reason: string|null }}
 */
function validateCoordinates(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') {
    return { isValid: true, isOutOfBounds: false, reason: null }; // Allowed if location string only
  }

  const nLat = parseFloat(lat);
  const nLng = parseFloat(lng);

  if (isNaN(nLat) || isNaN(nLng)) {
    return { isValid: false, isOutOfBounds: true, reason: 'พิกัดละติจูด/ลองจิจูดไม่ถูกต้อง' };
  }

  // Null Island check
  if (Math.abs(nLat) < 0.0001 && Math.abs(nLng) < 0.0001) {
    return { isValid: false, isOutOfBounds: true, reason: 'พิกัดตกที่ Null Island (0, 0)' };
  }

  // Thailand approximate geographic bounding box
  const minLat = 5.5;
  const maxLat = 20.6;
  const minLng = 97.2;
  const maxLng = 105.8;

  const isInsideThailand = (nLat >= minLat && nLat <= maxLat && nLng >= minLng && nLng <= maxLng);
  if (!isInsideThailand) {
    return {
      isValid: false,
      isOutOfBounds: true,
      reason: `พิกัด (${nLat.toFixed(4)}, ${nLng.toFixed(4)}) อยู่นอกเขตประเทศไทย`
    };
  }

  return { isValid: true, isOutOfBounds: false, reason: null };
}

/**
 * Comprehensive Cognitive Heuristic Spam Analysis.
 * Evaluates:
 * 1. Gibberish & Keyboard Smashing
 * 2. Test / Placeholder texts
 * 3. Profanity & Harassment Blacklist
 * 4. Out-of-domain Jokes / Non-civic topics
 * 5. Geo-fencing validation
 *
 * @param {string} text - Complaint description
 * @param {Object} [geo] - Optional { lat, lng }
 * @returns {Object} { isHardBlock, isSpam, spamType, spamFlag, aiCredibilityScore, reason }
 */
function analyzeComplaintSpam(text, geo = {}) {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();
  const noSpace = lower.replace(/\s+/g, '');

  // ── Default Valid Complaint Result ──
  const result = {
    isHardBlock: false,
    isSpam: false,
    spamType: 'none',
    spamFlag: 'valid',
    aiCredibilityScore: 95,
    reason: null
  };

  if (!raw || raw.length === 0) {
    return {
      isHardBlock: true,
      isSpam: true,
      spamType: 'gibberish',
      spamFlag: 'incomprehensible',
      aiCredibilityScore: 0,
      reason: 'กรุณากรอกรายละเอียดปัญหา'
    };
  }

  // ── 1. Check Explicit Test / Placeholder Phrases (Hard Block) ──
  for (const phrase of TEST_PHRASES) {
    if (lower === phrase || noSpace === phrase) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'test',
        spamFlag: 'junk',
        aiCredibilityScore: 5,
        reason: `ตรวจพบข้อความทดสอบระบบ ("${phrase}")`
      };
    }
  }

  // Test regex patterns like "test 1", "ลองส่งดูครับ", "ทดสอบ 123", "พิมพ์เรื่อยๆมั่วๆ", "พิมพ์เล่น", "ส่งเล่น"
  if (/^(test|เทส|ทดสอบ|ลองส่ง|ลองระบบ|ทดลอง|ส่งเล่น|พิมพ์เล่น|พิมพ์มั่ว|ลองดู|เทสๆ)(\b|[\s0-9a-zA-Z\.\-ก-๙]|$)/i.test(lower) ||
      /(พิมพ์มั่ว|พิมพ์เรื่อย|ส่งเล่น|ไม่มีไรทำ|บลาๆๆ)/i.test(lower)) {
    return {
      isHardBlock: true,
      isSpam: true,
      spamType: 'test',
      spamFlag: 'junk',
      aiCredibilityScore: 5,
      reason: 'ตรวจพบข้อความทดสอบหรือพิมพ์เล่น'
    };
  }

  // English 5+ consecutive consonants (e.g. jsdkfjweoifj, dfkjsdf, asdfgh)
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(noSpace)) {
    return {
      isHardBlock: true,
      isSpam: true,
      spamType: 'gibberish',
      spamFlag: 'incomprehensible',
      aiCredibilityScore: 10,
      reason: 'ตรวจพบการเคาะแป้นพิมพ์เล่นภาษาอังกฤษ (English Smash/Gibberish)'
    };
  }

  // English letters >= 5 with 0 vowels (e.g. dfghjk, zxcvb)
  if (noSpace.length >= 5 && /^[a-z]+$/i.test(noSpace) && !/[aeiouy]/i.test(noSpace)) {
    return {
      isHardBlock: true,
      isSpam: true,
      spamType: 'gibberish',
      spamFlag: 'incomprehensible',
      aiCredibilityScore: 10,
      reason: 'ตรวจพบการเคาะแป้นพิมพ์เล่นภาษาอังกฤษ (Vowelless English Gibberish)'
    };
  }

  // ── 2. Check Keyboard Smashing & Character Repetition (Hard Block) ──
  // Check obvious keyboard smash sequences (e.g. asdfgh, ฟหกด, qwerty)
  const OBVIOUS_SMASH = [
    'asdfgh', 'asdfghjkl', 'qwerty', 'zxcvbn', 'qazwsx',
    'ฟหกด', 'ฟหกด่าสว', 'ผปแอิ', 'ๆไำพะ', 'กด่าสว', 'ด่าสว'
  ];
  for (const seq of OBVIOUS_SMASH) {
    if (noSpace.includes(seq)) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 10,
        reason: 'ตรวจพบการเคาะแป้นพิมพ์เล่น (Keyboard Smash)'
      };
    }
  }

  // Check general keyboard sequences
  for (const seq of KEYBOARD_SEQUENCES) {
    if (noSpace.includes(seq) && (noSpace.length <= seq.length + 8 || noSpace.indexOf(seq) === 0)) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 10,
        reason: 'ตรวจพบการเคาะแป้นพิมพ์เล่น (Keyboard Smash)'
      };
    }
  }

  // Check keyboard row concentration (พิมพ์แถวเดียวกันเป็นพืด เช่น กดาสฟหกดาส, sdfkjhsdflkjh)
  if (noSpace.length >= 7) {
    const THAI_HOME = new Set('ฟหกด่าสวงฃ'.split(''));
    const EN_HOME = new Set("asdfghjkl;'".split(''));
    const EN_TOP = new Set('qwertyuiop'.split(''));
    const EN_BOTTOM = new Set('zxcvbnm'.split(''));

    let thHome = 0, enHome = 0, enTop = 0, enBot = 0;
    for (const c of noSpace) {
      if (THAI_HOME.has(c)) thHome++;
      if (EN_HOME.has(c)) enHome++;
      if (EN_TOP.has(c)) enTop++;
      if (EN_BOTTOM.has(c)) enBot++;
    }
    const len = noSpace.length;
    if (thHome / len >= 0.68) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 10,
        reason: 'ตรวจพบการเคาะแป้นพิมพ์แถวกลาง (Thai Home Row Smash)'
      };
    }
    if (enHome / len >= 0.70) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 10,
        reason: 'ตรวจพบการเคาะแป้นพิมพ์แถวกลาง (QWERTY Home Row Smash)'
      };
    }
    if (enTop / len >= 0.75) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 10,
        reason: 'ตรวจพบการเคาะแป้นพิมพ์แถวบน (QWERTY Top Row Smash)'
      };
    }
    if (enBot / len >= 0.75) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 10,
        reason: 'ตรวจพบการเคาะแป้นพิมพ์แถวล่าง (QWERTY Bottom Row Smash)'
      };
    }
  }

  // Same character repeated >= 5 times (e.g. "55555555", "กกกกกกกก", "asdfaaaaa")
  const repeatMatch = lower.match(/(.)\1{4,}/);
  if (repeatMatch) {
    const repeatedChar = repeatMatch[1];
    // If the repeated character makes up more than 50% of the entire text
    const repeatCount = (lower.match(new RegExp(repeatedChar.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'g')) || []).length;
    if (repeatCount / lower.length > 0.45) {
      const isLaughter = (repeatedChar === '5' || repeatedChar === 'ห');
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: isLaughter ? 'joke' : 'gibberish',
        spamFlag: isLaughter ? 'junk' : 'incomprehensible',
        aiCredibilityScore: 10,
        reason: isLaughter ? 'ตรวจพบข้อความหัวเราะ/เล่นตลก' : 'ตรวจพบตัวอักษรซ้ำซ้อนผิดปกติ'
      };
    }
  }

  // Check repeating chunks / loops (e.g. "อะไรไม่รู้อะไรไม่รู้อะไรไม่รู้", "มั่วๆมั่วๆมั่วๆ", "asdasdasd")
  if (noSpace.length >= 6) {
    const loopMatch = noSpace.match(/^(.{2,10})\1{2,}$/) || noSpace.match(/(.{3,8})\1{2,}/);
    if (loopMatch) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 15,
        reason: 'ตรวจพบข้อความพิมพ์วนซ้ำไปมา (Loop Pattern)'
      };
    }
  }

  // Entropy check on texts >= 6 chars: if entropy is extremely low (< 1.5)
  if (raw.length >= 6) {
    const entropy = calculateEntropy(raw);
    const { uniqueRatio } = analyzeLinguisticProperties(raw);
    if (entropy < 1.45 || uniqueRatio < 0.22) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'gibberish',
        spamFlag: 'incomprehensible',
        aiCredibilityScore: 10,
        reason: 'ข้อความมีความหลากหลายของตัวอักษรต่ำผิดปกติ (ไม่มีความหมาย)'
      };
    }
  }

  // Thai consonant/vowel proportion:
  // If Thai text is >= 6 characters long and has 0 vowels, it's almost certainly gibberish (e.g. "กฟหกดสวผป")
  const ling = analyzeLinguisticProperties(raw);
  if (ling.thaiConsonants >= 6 && ling.thaiVowels === 0) {
    return {
      isHardBlock: true,
      isSpam: true,
      spamType: 'gibberish',
      spamFlag: 'incomprehensible',
      aiCredibilityScore: 15,
      reason: 'ตรวจพบข้อความพยัญชนะล้วนไม่มีสระ (เคาะแป้นพิมพ์เล่น)'
    };
  }

  // ── 3. Check Profanity & Harassment (Hard Block) ──
  for (const prof of PROFANITY_PATTERNS) {
    if (prof.test(raw)) {
      return {
        isHardBlock: true,
        isSpam: true,
        spamType: 'profanity',
        spamFlag: 'junk',
        aiCredibilityScore: 5,
        reason: 'ตรวจพบถ้อยคำหยาบคายหรือไม่สุภาพ'
      };
    }
  }

  // ── 4. Check Out-of-Domain Jokes & Pranks (Soft Quarantine) ──
  for (const joke of OUT_OF_DOMAIN_PATTERNS) {
    if (joke.test(raw)) {
      return {
        isHardBlock: false, // Allow soft quarantine so admin can audit and strike
        isSpam: true,
        spamType: 'joke',
        spamFlag: 'irrelevant',
        aiCredibilityScore: 20,
        reason: 'ตรวจพบเนื้อหาเล่นตลก/เรื่องส่วนตัวที่ไม่เกี่ยวข้องกับงานบริการสาธารณะ'
      };
    }
  }

  // ── 5. Check Geofencing (Soft Quarantine) ──
  if (geo && (geo.lat != null || geo.lng != null)) {
    const geoCheck = validateCoordinates(geo.lat, geo.lng);
    if (geoCheck.isOutOfBounds) {
      return {
        isHardBlock: false,
        isSpam: true,
        spamType: 'out_of_bounds',
        spamFlag: 'irrelevant',
        aiCredibilityScore: 35,
        reason: geoCheck.reason || 'พิกัดอยู่นอกพื้นที่ให้บริการ'
      };
    }
  }

  // If text is extremely short (< 4 chars) and not a recognized abbreviation
  if (raw.length < 4 && !/^(ไฟ|น้ำ|งู|ขยะ)$/.test(raw)) {
    return {
      isHardBlock: false,
      isSpam: true,
      spamType: 'gibberish',
      spamFlag: 'incomprehensible',
      aiCredibilityScore: 30,
      reason: 'ข้อความสั้นเกินไป ไม่สามารถระบุความเสียหายได้'
    };
  }

  return result;
}

module.exports = {
  KEYBOARD_SEQUENCES,
  TEST_PHRASES,
  PROFANITY_PATTERNS,
  OUT_OF_DOMAIN_PATTERNS,
  calculateEntropy,
  analyzeLinguisticProperties,
  validateCoordinates,
  analyzeComplaintSpam
};
