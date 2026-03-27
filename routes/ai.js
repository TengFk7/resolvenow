// ─── routes/ai.js ─────────────────────────────────────────────
// POST /api/ai/urgency  — วิเคราะห์ระดับความเร่งด่วนด้วย Claude
// รับ: { description, category }

const express = require('express');
const router = express.Router();
const https = require('https');

const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

// ── Rule-based fallback ──────────────────────────────────────────
// ใช้เมื่อ Gemini ไม่พร้อมหรือ network error
const RULES = {
  // ประเภท → urgency default / keyword overrides
  Animal:      { base: 'urgent',  // สัตว์มีพิษ = urgent โดย default
    urgentKw: ['งูพิษ', 'งู', 'แมงป่อง', 'ตะขาบ', 'แตน', 'ผึ้ง', 'ต่อ', 'ต่อรัง', 'สัตว์มีพิษ', 'กัดคน', 'ต่อยคน'],
    mediumKw: ['หมาจรจัด', 'แมวจรจัด', 'สุนัขจรจัด'] },
  Hazard:      { base: 'urgent',  // ภัยพิบัติ = urgent เสมอ
    urgentKw: ['ไฟไหม้', 'เพลิงไหม้', 'เพลิง', 'ระเบิด', 'น้ำท่วมหนัก', 'น้ำท่วมฉับพลัน', 'แก๊สรั่ว', 'แก็สรั่ว', 'ดินถล่ม', 'พายุ'],
    mediumKw: [] },
  Water:       { base: 'medium',  // ท่อน้ำ = medium โดย default
    urgentKw: ['น้ำพุ่ง', 'น้ำไหลท่วม', 'ท่อระเบิด', 'น้ำท่วมถนน'],
    mediumKw: ['ท่อแตก', 'ท่อรั่ว', 'น้ำไม่ไหล', 'น้ำไม่ออก', 'น้ำเน่า', 'น้ำเสีย', 'อุดตัน'] },
  Electricity: { base: 'medium',
    urgentKw: ['ไฟช็อต', 'ไฟดูด', 'ไฟรั่ว', 'สายไฟขาด', 'เสาไฟล้ม', 'ไฟระเบิด'],
    mediumKw: ['ไฟดับ', 'ไฟไม่ติด', 'ไฟกะพริบ', 'ไฟสาธารณะ'] },
  Road:        { base: 'normal',
    urgentKw: ['รถพลิกคว่ำ', 'อุบัติเหตุ', 'ต้นไม้ล้มทับ', 'สะพานพัง', 'ถนนพังทลาย'],
    mediumKw: ['หลุมบ่อ', 'หลุม', 'ถนนทรุด', 'ถนนแตก', 'คอนกรีตแตก', 'ทางเท้าพัง'] },
  Garbage:     { base: 'normal',
    urgentKw: ['ขยะติดเชื้อ', 'ขยะสารพิษ', 'มีควันพิษ'],
    mediumKw: ['ขยะสะสม', 'ขยะตกค้าง', 'ส่งกลิ่น', 'กลิ่นเหม็น', 'ท่อระบายน้ำ', 'น้ำเน่าขัง'] },
  Tree:        { base: 'normal',
    urgentKw: ['ต้นไม้ล้ม', 'กิ่งไม้ทับ', 'ต้นโค่น', 'ทับสายไฟ', 'ทับรถ', 'ทับบ้าน'],
    mediumKw: ['กิ่งไม้', 'ต้นไม้', 'กีดขวาง', 'ปิดกั้น', 'ขวางทาง'] }
};

function ruleBasedUrgency(text, category) {
  const t = text.toLowerCase();
  const rule = RULES[category];
  if (rule) {
    if (rule.urgentKw.some(k => t.includes(k))) return 'urgent';
    if (rule.mediumKw.some(k => t.includes(k))) return 'medium';
    return rule.base;
  }
  // ไม่มี category → general keywords
  const urgentKw = ['ไฟไหม้', 'ระเบิด', 'น้ำท่วม', 'อุบัติเหตุ', 'บาดเจ็บ', 'เสียชีวิต', 'ฉุกเฉิน', 'อันตราย', 'งูพิษ', 'แก๊สรั่ว'];
  const mediumKw = ['แตก', 'พัง', 'ชำรุด', 'รั่ว', 'ไม่ไหล', 'ดับ', 'หลุม', 'กลิ่นเหม็น', 'กีดขวาง'];
  if (urgentKw.some(k => t.includes(k))) return 'urgent';
  if (mediumKw.some(k => t.includes(k))) return 'medium';
  return 'normal';
}

// ── บริบทแต่ละ category สำหรับ Gemini prompt ────────────────────
const CAT_CONTEXT = {
  Animal:      'ประเภท: สัตว์มีพิษ (งู แมงป่อง ตะขาบ แตน ผึ้ง สัตว์อันตรายต่างๆ)',
  Hazard:      'ประเภท: เหตุระเบิด/เพลิงไหม้/ภัยพิบัติ (อันตรายสูงมาก)',
  Water:       'ประเภท: ท่อน้ำแตก/น้ำไม่ไหล',
  Electricity: 'ประเภท: ปัญหาไฟฟ้า',
  Road:        'ประเภท: ถนน/ทางเท้าชำรุด',
  Garbage:     'ประเภท: ขยะตกค้าง',
  Tree:        'ประเภท: สิ่งกีดขวางทาง/ต้นไม้'
};

// ── Few-shot examples จำแนกตาม category ─────────────────────────
const FEW_SHOT = `
ตัวอย่าง (category | รายละเอียด → คำตอบ):
สัตว์มีพิษ | "มีงูเข้าบ้าน ไม่รู้ว่าพิษไหม" → urgent
สัตว์มีพิษ | "มีงูพิษในห้องนอน กัดเด็กแล้ว" → urgent
สัตว์มีพิษ | "มีแมงป่องในบ้าน" → urgent
สัตว์มีพิษ | "มีผึ้งทำรังใกล้บ้าน" → urgent
สัตว์มีพิษ | "หมาจรจัดเยอะมาก กัดคน" → urgent
สัตว์มีพิษ | "แมวจรจัดร้องมากรบกวนการนอน" → normal
ภัยพิบัติ | "ไฟไหม้บ้านข้างๆ ควันดำเต็มหมู่บ้าน" → urgent
ภัยพิบัติ | "ได้กลิ่นแก๊สรั่วในบริเวณบ้าน" → urgent
ภัยพิบัติ | "น้ำท่วมสูงหลายเมตร รถจมหมด" → urgent
ท่อน้ำ | "ท่อน้ำประปาแตก น้ำพุ่งออกมาท่วมถนน" → urgent
ท่อน้ำ | "น้ำไม่ไหลมา 2 วันแล้ว ใช้น้ำไม่ได้เลย" → medium
ท่อน้ำ | "ท่อน้ำหน้าบ้านรั่ว น้ำซึมออกมานิดหน่อย" → medium
ท่อน้ำ | "น้ำประปาไหลอ่อนมาก" → normal
ไฟฟ้า | "สายไฟขาด กระแสไฟดูดคนงาน" → urgent
ไฟฟ้า | "ไฟดับทั้งหมู่บ้านไม่มีไฟใช้" → medium
ไฟฟ้า | "ไฟแสงสว่างดับ 1 ดวงริมทาง" → normal
ถนน | "ต้นไม้ล้มขวางถนนทั้งเส้น สัญจรไม่ได้" → urgent
ถนน | "หลุมบ่อขนาดใหญ่กลางถนน รถตกหลุมเสียหาย" → medium
ถนน | "ทางเท้าชำรุดเล็กน้อย เดินได้" → normal
ขยะ | "ขยะติดเชื้อทิ้งกลางถนน มีกลิ่นฉุน" → urgent
ขยะ | "ขยะตกค้างหลายวัน ส่งกลิ่นเหม็นรุนแรง" → medium
ขยะ | "ขยะยังไม่ได้เก็บ 1 วัน" → normal
กีดขวาง | "ต้นไม้โค่นทับสายไฟ ไฟดับทั้งบล็อก" → urgent
กีดขวาง | "กิ่งไม้หักกีดขวางทางเดิน" → medium
กีดขวาง | "มีป้ายโฆษณาทิ้งไว้ริมทาง" → normal`;

router.post('/urgency', async (req, res) => {
  const { description, category } = req.body;
  if (!description || description.trim().length < 5)
    return res.json({ urgency: ruleBasedUrgency('', category), source: 'default' });

  if (!CLAUDE_KEY) {
    return res.json({ urgency: ruleBasedUrgency(description, category), source: 'rule' });
  }

  const catCtx = CAT_CONTEXT[category] || 'ประเภท: ทั่วไป';
  const prompt = `คุณคือระบบจำแนกระดับความเร่งด่วนของคำร้องเรียนจากประชาชนในไทย ตอบด้วยคำเดียวเท่านั้น: urgent, medium, หรือ normal

หลักเกณฑ์:
- urgent = เป็นอันตรายต่อชีวิต ร่างกาย หรือทรัพย์สิน ต้องดำเนินการทันที
- medium = ส่งผลกระทบต่อการใช้ชีวิตประจำวัน ควรดำเนินการโดยเร็ว
- normal = ความไม่สะดวกเล็กน้อย สามารถรอได้
${FEW_SHOT}

${catCtx}
รายละเอียด: "${description.replace(/"/g, "'")}"
คำตอบ (urgent/medium/normal):`;

  const body = JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: 8,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }]
  });

  try {
    const result = await new Promise((resolve) => {
      const reqC = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01'
        }
      }, (r) => {
        let d = '';
        r.on('data', c => (d += c));
        r.on('end', () => {
          try {
            const json = JSON.parse(d);
            const text = (json.content?.[0]?.text || '').trim().toLowerCase();
            console.log(`[AI urgency] [${category}] "${description.slice(0, 50)}" → "${text}"`);
            if (text.includes('urgent')) resolve('urgent');
            else if (text.includes('medium')) resolve('medium');
            else if (text.includes('normal')) resolve('normal');
            else { console.log('[AI] unexpected response, using rule-based'); resolve(ruleBasedUrgency(description, category)); }
          } catch { resolve(ruleBasedUrgency(description, category)); }
        });
      });
      reqC.on('error', () => resolve(ruleBasedUrgency(description, category)));
      reqC.write(body);
      reqC.end();
    });
    res.json({ urgency: result, source: 'ai' });
  } catch {
    res.json({ urgency: ruleBasedUrgency(description, category), source: 'rule' });
  }
});

module.exports = router;
