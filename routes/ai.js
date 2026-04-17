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
  Animal: {
    base: 'urgent',  // สัตว์มีพิษ = urgent โดย default
    urgentKw: ['งูพิษ', 'งู', 'แมงป่อง', 'ตะขาบ', 'แตน', 'ผึ้ง', 'ต่อ', 'ต่อรัง', 'สัตว์มีพิษ', 'กัดคน', 'ต่อยคน'],
    mediumKw: ['หมาจรจัด', 'แมวจรจัด', 'สุนัขจรจัด']
  },
  Hazard: {
    base: 'urgent',  // ภัยพิบัติ = urgent เสมอ
    urgentKw: ['ไฟไหม้', 'เพลิงไหม้', 'เพลิง', 'ระเบิด', 'น้ำท่วมหนัก', 'น้ำท่วมฉับพลัน', 'แก๊สรั่ว', 'แก็สรั่ว', 'ดินถล่ม', 'พายุ'],
    mediumKw: []
  },
  Water: {
    base: 'medium',  // ท่อน้ำ = medium โดย default
    urgentKw: ['น้ำพุ่ง', 'น้ำไหลท่วม', 'ท่อระเบิด', 'น้ำท่วมถนน'],
    mediumKw: ['ท่อแตก', 'ท่อรั่ว', 'น้ำไม่ไหล', 'น้ำไม่ออก', 'น้ำเน่า', 'น้ำเสีย', 'อุดตัน']
  },
  Electricity: {
    base: 'medium',
    urgentKw: ['ไฟช็อต', 'ไฟดูด', 'ไฟรั่ว', 'สายไฟขาด', 'เสาไฟล้ม', 'ไฟระเบิด'],
    mediumKw: ['ไฟดับ', 'ไฟไม่ติด', 'ไฟกะพริบ', 'ไฟสาธารณะ']
  },
  Road: {
    base: 'normal',
    urgentKw: ['รถพลิกคว่ำ', 'อุบัติเหตุ', 'ต้นไม้ล้มทับ', 'สะพานพัง', 'ถนนพังทลาย'],
    mediumKw: ['หลุมบ่อ', 'หลุม', 'ถนนทรุด', 'ถนนแตก', 'คอนกรีตแตก', 'ทางเท้าพัง']
  },
  Garbage: {
    base: 'normal',
    urgentKw: ['ขยะติดเชื้อ', 'ขยะสารพิษ', 'มีควันพิษ'],
    mediumKw: ['ขยะสะสม', 'ขยะตกค้าง', 'ส่งกลิ่น', 'กลิ่นเหม็น', 'ท่อระบายน้ำ', 'น้ำเน่าขัง']
  },
  Tree: {
    base: 'normal',
    urgentKw: ['ต้นไม้ล้ม', 'กิ่งไม้ทับ', 'ต้นโค่น', 'ทับสายไฟ', 'ทับรถ', 'ทับบ้าน'],
    mediumKw: ['กิ่งไม้', 'ต้นไม้', 'กีดขวาง', 'ปิดกั้น', 'ขวางทาง']
  }
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
  const urgentKw = ['ไฟไหม้', 'ระเบิด', 'น้ำท่วม', 'อุบัติเหตุ', 'บาดเจ็บ', 'เสียชีวิต', 'ฉุกเฉิน', 'อันตราย', 'งูพิษ', 'แก๊สรั่ว', 'ไฟฟ้าช็อต', 'ไฟฟ้ารั่ว', 'ไฟฟ้าดับ', 'อากาศร้อน', 'โรคระบาด', 'สารพิษ', 'มลพิษ', 'การคุกคามชีวิต', 'การบาดเจ็บรุนแรง'];
  const mediumKw = ['แตก', 'พัง', 'ชำรุด', 'รั่ว', 'ไม่ไหล', 'ดับ', 'หลุม', 'กลิ่นเหม็น', 'กีดขวาง', 'น้ำไม่ไหล', 'ท่อรั่ว', 'ไฟฟ้ากระชาก', 'ไฟฟ้ากระตุก', 'ไฟฟ้ากระพริบ', 'ถนนหลุม', 'ถนนพัง', 'ขยะตกค้าง', 'ขยะกลิ่น', 'กิ่งไม้กีดขวาง', 'ต้นไม้ล้ม', 'อุปกรณ์ชำรุด'];
  if (urgentKw.some(k => t.includes(k))) return 'urgent';
  if (mediumKw.some(k => t.includes(k))) return 'medium';
  return 'normal';
}

// ── บริบทแต่ละ category สำหรับ Gemini prompt ────────────────────
const CAT_CONTEXT = {
  Animal: 'ประเภท: สัตว์มีพิษ (งู แมงป่อง ตะขาบ แตน ผึ้ง สัตว์อันตรายต่างๆ)',
  Hazard: 'ประเภท: เหตุระเบิด/เพลิงไหม้/ภัยพิบัติ (อันตรายสูงมาก)',
  Water: 'ประเภท: ท่อน้ำแตก/น้ำไม่ไหล',
  Electricity: 'ประเภท: ปัญหาไฟฟ้า',
  Road: 'ประเภท: ถนน/ทางเท้าชำรุด',
  Garbage: 'ประเภท: ขยะตกค้าง',
  Tree: 'ประเภท: สิ่งกีดขวางทาง/ต้นไม้'
};

// ── Few-shot examples จำแนกตาม category ─────────────────────────
const FEW_SHOT = `
ตัวอย่าง (category | รายละเอียด → คำตอบ):

--- สัตว์มีพิษ (Urgent) ---
สัตว์มีพิษ | "งูพิษซ่อนตัวในห้องนอนของเด็ก 2 คน" → urgent
สัตว์มีพิษ | "แมงป่องหลายตัวกัดมือของผู้ใช้" → urgent
สัตว์มีพิษ | "ตะขาบใหญ่บาดเจ็บคนเดินทาง" → urgent
สัตว์มีพิษ | "ผึ้งทำรังบนหลังคา ทำให้คนออกรังบาดเจ็บ" → urgent
สัตว์มีพิษ | "สุนัขป่าโจมตีผู้โดยสารบนรถเมล์" → urgent

--- สัตว์มีพิษ (Medium) ---
สัตว์มีพิษ | "แมวจรจัดมีกลิ่นเหม็นแต่ไม่มีอาการบาดเจ็บ" → medium
สัตว์มีพิษ | "แมงป่องอยู่ในสวนแต่ไม่ได้กัดใคร" → medium
สัตว์มีพิษ | "ผึ้งทำรังในห้องครัว ทำให้มีรบกวนแต่ไม่มีบาดเจ็บ" → medium

--- สัตว์มีพิษ (Normal) ---
สัตว์มีพิษ | "แมวจรจัดร้องเสียงดังรบกวนการนอน" → normal
สัตว์มีพิษ | "มีแมงป่องอยู่ในถังน้ำแต่ไม่ได้กัด" → normal

--- ภัยพิบัติ (Urgent) ---
ภัยพิบัติ | "ไฟไหม้บ้านหลายชั้น ควันดำเต็มย่าน" → urgent
ภัยพิบัติ | "การระเบิดที่โรงงานทำให้ชั้นดินเสียหายรุนแรง" → urgent
ภัยพิบัติ | "น้ำท่วมสูง 2 เมตร ทำให้หลายครอบครัวต้องอพยพ" → urgent

--- ภัยพิบัติ (Medium) ---
ภัยพิบัติ | "ไฟฟ้าดับบางส่วนของอาคารสาธารณะ" → medium
ภัยพิบัติ | "แก๊สรั่วในอาคารสำนักงานแต่ยังไม่มีอาการบาดเจ็บ" → medium

--- ท่อน้ำ (Urgent) ---
ท่อน้ำ | "ท่อน้ำประปาแตกใหญ่ น้ำพุ่งทำถนนล้น" → urgent
ท่อน้ำ | "ท่อน้ำรั่วทำให้ไฟฟ้าลัดวงจรและไฟฟ้าช็อต" → urgent

--- ท่อน้ำ (Medium) ---
ท่อน้ำ | "น้ำประปาไม่ไหลเป็นเวลาหลายวัน ทำให้ไม่มีน้ำใช้" → medium
ท่อน้ำ | "ท่อรั่วเล็กๆ ทำให้มีน้ำซึมในบ้าน" → medium

--- ท่อน้ำ (Normal) ---
ท่อนน้ำ | "น้ำไหลอ่อนแต่ยังใช้ได้" → normal
ท่อนน้ำ | "ท่อมีคราบสนิมแต่ไม่มีการรั่ว" → normal

--- ไฟฟ้า (Urgent) ---
ไฟฟ้า | "สายไฟขาดทำให้คนทำงานได้รับไฟฟ้าช็อตรุนแรง" → urgent
ไฟฟ้า | "ไฟฟ้ารั่วทำให้ไฟฟ้าดับทั้งอาคาร" → urgent

--- ไฟฟ้า (Medium) ---
ไฟฟ้า | "ไฟฟ้าดับบางส่วนของหมู่บ้าน" → medium
ไฟฟ้า | "ไฟฟ้ากระพริบทำให้การทำงานของโรงงานหยุดชะงัก" → medium

--- ไฟฟ้า (Normal) ---
ไฟฟ้า | "ไฟส่องสว่างบางดวงดับในถนน" → normal
ไฟฟ้า | "ไฟฟ้ากระตุกแต่ยังใช้งานได้" → normal

--- ถนน (Urgent) ---
ถนน | "ต้นไม้ใหญ่ล้มทับถนนทำให้การจราจรหยุดชะงัก" → urgent
ถนน | "อุบัติเหตุรถบัสชนรถตู้หลายคัน" → urgent

--- ถนน (Medium) ---
ถนน | "หลุมบ่อขนาดใหญ่บนถนนทำให้รถเสียหาย" → medium
ถนน | "ถนนมีการแตกหลายจุดต้องซ่อมแซมเร็ว" → medium

--- ถนน (Normal) ---
ถนน | "ทางเท้าชำรุดเล็กน้อยยังเดินได้" → normal
ถนน | "ถนนมีรอยแตกเล็กน้อยไม่มีอันตราย" → normal

--- ขยะ (Urgent) ---
ขยะ | "ขยะติดเชื้อทิ้งกลางถนนทำให้คนเดินผ่านอันตราย" → urgent
ขยะ | "ขยะสารพิษรั่วไหลทำให้มลพิษรุนแรง" → urgent

--- ขยะ (Medium) ---
ขยะ | "ขยะตกค้างหลายวันส่งกลิ่นเหม็นรบกวนชุมชน" → medium
ขยะ | "ขยะอัดแน่นทำให้ถังขยะเต็มต้องจัดการ" → medium

--- ขยะ (Normal) ---
ขยะ | "ขยะยังไม่ได้เก็บ 1 วันไม่มีอาการรุนแรง" → normal
ขยะ | "ขยะทั่วไปไม่มีปัญหาใหญ่" → normal

--- กีดขวาง (Urgent) ---
กีดขวาง | "ต้นไม้โค่นทับสายไฟทำให้ไฟดับทั้งบล็อก" → urgent
กีดขวาง | "กิ่งไม้ใหญ่บังทางเดินทำให้คนล้ม" → urgent

--- กีดขวาง (Medium) ---
กีดขวาง | "กิ่งไม้หักกีดขวางทางเดินทำให้ต้องอุดกั้นชั่วคราว" → medium
กีดขวาง | "ป้ายโฆษณาตกลงบนถนนทำให้การจราจรชะงัก" → medium

--- กีดขวาง (Normal) ---
กีดขวาง | "มีป้ายโฆษณาเล็กๆ ทิ้งไว้บนทางเท้า" → normal
กีดขวาง | "กิ่งไม้เล็กกีดขวางทางเดินแต่ไม่มีอันตราย" → normal`;

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
