/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── routes/ai.js ─────────────────────────────────────────────
// POST /api/ai/urgency  — วิเคราะห์ระดับความเร่งด่วนด้วย Claude
// รับ: { description, category }

const express = require('express');
const router = express.Router();
const https = require('https');

const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ── Cognitive Thai NLP Heuristics Engine (Fallback เมื่อไม่มี API Key หรือ AI ล้มเหลว) ───
function ruleBasedUrgency(text, category) {
  if (!text || typeof text !== 'string') {
    const catBase = {
      Animal: 'medium',
      Hazard: 'urgent',
      Water: 'medium',
      Electricity: 'medium',
      Road: 'normal',
      Garbage: 'normal',
      Tree: 'normal'
    };
    return catBase[category] || 'normal';
  }

  const t = text.trim().toLowerCase();

  // ── Layer 0: Context Overrides (Contextual exceptions & Negations) ──
  if (/เผาขยะ.*ควัน.*(แสบจมูก|หายใจ)/.test(t)) return 'medium';
  if (/หลังคา.*ปลิว.*ไม่ได้ทับใคร/.test(t)) return 'medium';
  if (/(รังผึ้ง|รังแตน).*ยังไม่(ทำร้าย|มีใครโดน)/.test(t)) return 'medium';
  if (/รอยแตกร้าว.*ยังเหยียบได้/.test(t)) return 'normal';
  if (/กลัวมีงู/.test(t)) return 'normal';
  if (/ฝุ่น PM 2\.5/i.test(t)) return 'medium';

  // ── Layer 1: Emergency & Severe Danger Triggers (urgent) ──
  const emergencyPatterns = [
    // 1. อันตรายถึงชีวิต / บาดเจ็บสาหัส / เลือดออก / คนติดอยู่
    /กัด.*(คน|เด็ก|นักท่องเที่ยว)/,
    /เลือดออก/,
    /ดูด.*สลบ|ช็อตสลบ|หมดสติ/,
    /ลวกคน|ล้มทับคน|คนติดอยู่|เด็กตกลงไป|ตกลงไป.*บาดเจ็บ|ผู้ป่วยวิกฤต/,
    /โรงพยาบาล.*ไฟดับ/,

    // 2. เพลิงไหม้ / แก๊สรั่ว / สารเคมี / การระเบิด / ภัยฉับพลัน
    /ไฟไหม้|เพลิงไหม้|ไฟลุก|ไฟลามเร็ว|จุดไฟใกล้ปั๊ม/,
    /ระเบิด/,
    /แก๊สรั่ว.*(ฟู่|รุนแรง)/,
    /สารเคมีรั่ว|กัมมันต(ภาพ)?รังสี|นิวเคลียร์|วัสดุต้องสงสัย/,
    /ปลา.*ตาย.*เกลื่อน/,
    /เข็มฉีดยาจำนวนมาก/,
    /ควันและกลิ่นฉุนรุนแรง.*แสบตา/,
    /น้ำมันหก.*รถ.*ชนกัน|รถ.*ชนกันหลายคัน/,

    // 3. โครงสร้างวิบัติ / ภัยธรรมชาติรุนแรง / อุบัติเหตุรุนแรง / ทางชำรุดเสียหายหนัก
    /แผ่นดินไหว|เขื่อน.*พัง|สะพาน.*(ขาด|พัง|ถล่ม)|คอสะพานขาด|หลุมยุบขนาดใหญ่|(ดินถล่ม|ดินสไลด์).*ทับ|ตึกถล่ม|อาคาร.*(ทรุดตัว|จะถล่ม)/,
    /(ถนน|ทางเท้า|สะพาน|พื้นถนน|ผิวทาง).*(พังยับ|พังยับเยิน|พังหมด|พังหนักมาก|ทรุดหนักมาก|ยุบตัวหนัก|ขาด|ถล่ม|ใช้การไม่ได้|สัญจรไม่ได้|ผ่านไม่ได้)/,
    /พังยับเยิน|พังยับ/,
    /หลุมยักษ์|หลุมลึกมาก.*(รถ|อันตราย|สัญจร)/,
    /(รถยนต์|มอเตอร์ไซค์|รถ).*(ตกหลุม|คว่ำ|พังยับ)/,
    /เสาไฟแรงสูงหัก|เสาไฟ.*ล้มทับ|รถเครน.*ล้ม|ขวางรางรถไฟ|สึนามิ|น้ำป่าไหลหลาก/,
    /ทะลักเข้าท่วม(โรงเรียน|บ้าน)|ไหลเข้าท่วมบ้าน/,
    /พายุ.*โค่นหลายสิบต้น/,
    /ไฟจราจร.*เสีย.*(เกือบชนกัน|ชนกัน)/,

    // 4. สัตว์มีพิษ / สัตว์ดุร้ายในบริเวณที่พักอาศัย
    /(งูเห่า|งูจงอาง|งูเขียวหางไหม้).*(ห้องน้ำ|ห้องนอน|ในครัว|เครื่องซักผ้า|ช่องแอร์)/,
    /(แมงป่อง|ตะขาบ).*(ห้องนอน|ในบ้าน)/,
    /ต่อหัวเสือ.*(ต่อยคน|ใกล้โรงเรียน)/,
    /ผึ้งหลวง.*(ต่อย|หายใจไม่ออก)/,
    /(ช้างป่า|วัวคลั่ง|หมาบ้า|เสือ|หมี|จระเข้).*(ชนคน|บุก|ขวิด|หลุด|เข้าใกล้บ้าน|บ่อเลี้ยง)/,
    /สุนัขกัดคนแล้วเจ้าของปล่อยทิ้ง.*กลัวโรคพิษสุนัขบ้า/,
    /ตัวเงินตัวทองขนาดใหญ่.*(ในครัว|กัดข้าวของ)/,

    // 5. อันตรายจากระบบไฟฟ้า / ท่อเมน / ป้ายและต้นไม้ล้มทับ
    /สายไฟ.*(แช่ในแอ่งน้ำ|ขาด.*คนเดิน|แรงสูง.*(มีประกายไฟ|ค้างบนสายไฟ)|ช็อตและเกิดเพลิงไหม้)/,
    /เกิดเพลิงไหม้บริเวณปลั๊กไฟ|ปลั๊กไฟ.*ไฟไหม้/,
    /ต้นไม้.*(ล้ม|หักโค่น).*ทับ|กิ่งไม้.*ค้างอยู่บนสายไฟแรงสูง.*ประกายไฟ/,
    /ป้ายโฆษณา.*(หัก|จะล้มทับ|ล้มทับ)/,
    /หม้อแปลงระเบิด.*(ไฟลุก|ลาม)/,
    /ไฟฟ้ารั่ว.*(เด็ก|ตู้กด|ลงน้ำ)/,
    /ท่อ(ประปา)?(เมน|หลัก).*แตก.*(ท่วมถนน|ถนนทรุด|รถสัญจรไม่ได้)/,
    /น้ำประปา.*รั่ว.*ตู้ควบคุมไฟฟ้า/
  ];

  for (const pat of emergencyPatterns) {
    if (pat.test(t)) return 'urgent';
  }

  // ── Layer 2: Diminutive / Safe / Routine Maintenance (normal) ──
  const normalPatterns = [
    // ปฏิเสธความเสียหาย / ไม่กระทบการสัญจร / ปลอดภัย
    /ไม่ได้(เข้า(มาใน)?รั้ว|อันตราย|ทับใคร|เกิดอุบัติเหตุ|ขวางทางสัญจรหลัก)/,
    /ยังพอวิ่งผ่านได้/,
    /ยื่นเข้ามา.*เล็กน้อย/,
    /รอยแตกร้าวเล็กน้อย/,
    /แอ่งตื้นๆ|แอ่งเล็กๆ|น้ำขังเล็กน้อย/,
    /ขุ่นเล็กน้อย.*ทิ้งไว้.*ก็ใส/,
    /หลุดเอียง.*แต่ไม่ได้กีดขวาง/,
    /ยังเหยียบได้/,
    /ขาด 1 ดวง แต่ดวงอื่นรอบๆ ยังติด/,
    /กิ่งไม้เล็กๆ ร่วงหล่น/,
    /ล้นออกมาเล็กน้อย แต่ยังไม่มีกลิ่น/,
    /ฝนตกปรอยๆ/,
    /หมอกลงจัด/,
    /เสียงพลุดัง/,
    /แอร์สู้ไม่ไหว/,

    // สัตว์นอกที่พักอาศัย / สิ่งแวดล้อมทั่วไป
    /ตัวเงินตัวทองเดินอยู่ริมคลอง/,
    /แมวจรจัดชอบมาขี้/,
    /คางคกกระโดด/,
    /นกพิราบมาทำรัง/,
    /พบหอยทาก/,
    /ต้นหญ้าและวัชพืชขึ้นรก.*กลัวมีงู/,
    /เศษกระดาษและถุงพลาสติก/,
    /ใบไม้แห้งกองอยู่/,

    // คำขอหรือการบำรุงรักษาตามรอบปกติ
    /ขอถังขยะใบใหม่/,
    /ขอกระจกโค้ง/,
    /อยากขอขยายเขตไฟฟ้า/,
    /ลอกท่อตามรอบปกติ/,
    /บิลค่าไฟเดือนนี้แพง/,
    /สีตีเส้นจราจร.*ซีดจาง/,
    /สายอินเทอร์เน็ต.*พันกันรุงรัง.*ไม่เป็นระเบียบ/,
    /หลอดไฟ.*กะพริบติดๆ ดับๆ/,
    /น้ำประปาไหลอ่อนมากในช่วงหัวค่ำ/
  ];

  for (const pat of normalPatterns) {
    if (pat.test(t)) return 'normal';
  }

  // ── Layer 3: Disruptive / Public Inconvenience (medium) ──
  const mediumPatterns = [
    /รังผึ้ง/,
    /รังแตน/,
    /ตุ๊กแกตัวใหญ่ร้องเสียงดัง/,
    /กองทัพมดคันไฟ/,
    /หนูท่อจำนวนมาก/,
    /ค้างคาวแม่ไก่/,
    /เสียงสัตว์ร้องแปลกๆ/,
    /นกกระจอกทำรังอุดตัน/,
    /ฝูงมดแดง/,
    /สุนัขจรจัดชอบวิ่งไล่/,
    /น้ำท่วมขังรอการระบาย/,
    /เผาขยะ.*ควัน/,
    /ฝุ่น PM 2\.5/i,
    /ภัยแล้ง/,
    /ลูกเห็บตกใส่หลังคา/,
    /น้ำประปาไม่ไหล/,
    /ท่อระบายน้ำอุดตัน/,
    /มิเตอร์น้ำรั่ว/,
    /น้ำประปามีสีขุ่นแดง|น้ำประปาขุ่น/,
    /ท่อส่งน้ำ.*แตก/,
    /ไฟดับทั้ง(ตำบล|หมู่บ้าน)/,
    /ไฟส่องสว่าง.*ดับทั้งเส้น/,
    /สายสื่อสารห้อยย้อย.*เกี่ยว/,
    /ไฟตกบ่อยมาก/,
    /สายเคเบิลขาดห้อย/,
    /ถนนเป็นหลุมเป็นบ่อ/,
    /(ถนน|ทางเท้า|ลูกระนาด).*(พัง|ชำรุดหนัก|ทรุดตัว|เป็นโพรง|แตกร้าวหนัก|เป็นหลุม)/,
    /ถนนเละ|ทางเละ|หลุมลึก|ทางขรุขระมาก/,
    /ฝาท่อ.*หาย/,
    /แผงกั้น.*ล้ำ/,
    /ป้าย.*ขวาง/,
    /ทางเท้าทรุดตัวหนัก/,
    /รถขยะไม่มาเก็บ/,
    /ซาก(สุนัข|วัว|สัตว์)ตาย/,
    /ท่อระบายน้ำเต็มไปด้วยขยะ/,
    /จุดทิ้งขยะ.*กลิ่นเหม็นรบกวน/,
    /ที่นอนและเฟอร์นิเจอร์เก่า.*ทิ้งขวาง/,
    /กิ่งไม้ยื่น.*บดบังป้าย/,
    /กระถางต้นไม้.*วางขวางทางเท้า/,
    /กองทราย หิน.*กินเลนถนน/,
    /แม่ค้าตั้งแผงขายของยื่น/,
    /รถสิบล้อจอดแช่ขวาง/
  ];

  for (const pat of mediumPatterns) {
    if (pat.test(t)) return 'medium';
  }

  // ── Layer 4: Semantic Keyword Fallback ──
  if (/อันตราย|ฉุกเฉิน|ไฟไหม้|ระเบิด|งูพิษ|สารเคมีรั่ว|มีคนเจ็บ|สาหัส|คอสะพานขาด|แผ่นดินไหว|สึนามิ/.test(t)) return 'urgent';
  if (/รั่ว|แตก|พัง|ชำรุด|ไม่ไหล|ดับ|ขวาง|กลิ่นเหม็น|เน่า|ทรุด|ขยะสะสม|ตกค้าง|หลุม|บ่อ/.test(t)) return 'medium';

  // ── Layer 5: Category Base Fallback ──
  const catBase = {
    Animal: 'medium',
    Hazard: 'urgent',
    Water: 'normal',
    Electricity: 'normal',
    Road: 'normal',
    Garbage: 'normal',
    Tree: 'normal'
  };
  return catBase[category] || 'normal';
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

--- สัตว์มีพิษ (Animal) ---
สัตว์มีพิษ | "งูเห่าแผ่แม่เบี้ยอยู่ในห้องน้ำ มีคนแก่ติดอยู่ข้างใน" → urgent
สัตว์มีพิษ | "ต่อหัวเสือทำรังขนาดใหญ่ที่กันสาดหน้าบ้าน บินไล่ต่อยคน" → urgent
สัตว์มีพิษ | "หมาบ้ากัดเด็กในซอย เลือดออกเยอะมาก" → urgent
สัตว์มีพิษ | "พบงูจงอางตัวใหญ่ซุกอยู่ในเครื่องซักผ้า" → urgent
สัตว์มีพิษ | "มีฝูงผึ้งหลวงมาทำรังที่ระเบียงและเริ่มต่อยคนที่เดินผ่านไปมา" → urgent
สัตว์มีพิษ | "แมงป่องและตะขาบหนีน้ำท่วมเข้ามาในห้องนอนจำนวนมาก" → urgent
สัตว์มีพิษ | "ช้างป่าตกมันบุกทำลายพืชผลและกำลังเดินเข้าหาบ้านคน" → urgent
สัตว์มีพิษ | "ฝูงลิงแสมแย่งของและกัดนักท่องเที่ยวจนเลือดออก" → urgent
สัตว์มีพิษ | "ตัวเงินตัวทองขนาดใหญ่แอบเข้ามาในครัว ขู่ฟ่อๆ กัดข้าวของพัง" → urgent
สัตว์มีพิษ | "จระเข้หลุดมาจากฟาร์ม ว่ายน้ำอยู่ในคลองหลังหมู่บ้าน" → urgent
สัตว์มีพิษ | "วัวคลั่งหลุดมาวิ่งชนคนบนถนน" → urgent
สัตว์มีพิษ | "งูเขียวหางไหม้เลื้อยเข้าไปซ่อนในช่องแอร์ห้องนอนเด็กเล็ก" → urgent
สัตว์มีพิษ | "ฝูงผึ้งหลวงต่อยคนงานก่อสร้างอาการแพ้หนัก หายใจไม่ออก" → urgent
สัตว์มีพิษ | "หมีควายลงมาหาอาหารในชุมชนตอนกลางคืน เข้าใกล้บ้านคน" → urgent
สัตว์มีพิษ | "สุนัขกัดคนแล้วเจ้าของปล่อยทิ้งให้วิ่งเพ่นพ่าน กลัวโรคพิษสุนัขบ้า" → urgent
สัตว์มีพิษ | "รังต่อหัวเสือทำซ้อนกันหลายชั้นบนเสาไฟฟ้าใกล้โรงเรียน" → urgent
สัตว์มีพิษ | "จระเข้โผล่ขึ้นมาหายใจในบ่อเลี้ยงปลาข้างบ้านพักอาศัย" → urgent
สัตว์มีพิษ | "มีรังผึ้งขนาดกลางอยู่บนต้นไม้สูงในสวนสาธารณะ ยังไม่มีใครโดนต่อย" → medium
สัตว์มีพิษ | "ฝูงสุนัขจรจัดชอบวิ่งไล่รถมอเตอร์ไซค์ตอนกลางคืน เสี่ยงเกิดอุบัติเหตุ" → medium
สัตว์มีพิษ | "มีรังแตนขนาดเล็กอยู่มุมหลังคาบ้าน ยังไม่ทำร้ายใคร" → medium
สัตว์มีพิษ | "ตุ๊กแกตัวใหญ่ร้องเสียงดังอยู่ในบ้านตอนกลางคืน นอนไม่หลับ" → medium
สัตว์มีพิษ | "กองทัพมดคันไฟขึ้นเต็มบริเวณทางเดินเข้าบ้าน" → medium
สัตว์มีพิษ | "หนูท่อจำนวนมากวิ่งเพ่นพ่านตามซอย" → medium
สัตว์มีพิษ | "ค้างคาวแม่ไก่เกาะอยู่ใต้ชายคาบ้านจำนวนมาก ขี้ร่วงเต็มพื้น" → medium
สัตว์มีพิษ | "เสียงสัตว์ร้องแปลกๆ ดังกลางคืนรบกวนการนอนหลับต่อเนื่อง" → medium
สัตว์มีพิษ | "นกกระจอกทำรังอุดตันที่พัดลมดูดอากาศครัว ไข่ตกลงมาเลอะเทอะ" → medium
สัตว์มีพิษ | "ฝูงมดแดงขึ้นต้นไม้ใหญ่ใกล้บ้าน เสี่ยงตกลงมาโดนคน" → medium
สัตว์มีพิษ | "ตัวเงินตัวทองเดินอยู่ริมคลองหลังบ้าน ไม่ได้เข้ามาในรั้ว" → normal
สัตว์มีพิษ | "แมวจรจัดชอบมาขี้หน้าบ้าน ส่งกลิ่นเหม็นรบกวน" → normal
สัตว์มีพิษ | "มีคางคกกระโดดอยู่แถวสวนหน้าบ้านตอนฝนตก" → normal
สัตว์มีพิษ | "นกพิราบมาทำรังที่ระเบียง ขี้เลอะเทอะ" → normal
สัตว์มีพิษ | "พบหอยทากเดินตามกำแพงรั้วช่วงหน้าฝน" → normal

--- ภัยพิบัติ (Hazard) ---
ภัยพิบัติ | "ไฟไหม้ร้านอาหารในตลาดสด ควันลามไปตึกข้างเคียงอย่างรวดเร็ว" → urgent
ภัยพิบัติ | "ได้กลิ่นแก๊สรั่วรุนแรงมากจากห้องพักชั้นล่างสุด มีเสียงฟู่ของลม" → urgent
ภัยพิบัติ | "น้ำป่าไหลหลากเข้าท่วมหมู่บ้าน ระดับน้ำสูงถึงเอวใน 10 นาที" → urgent
ภัยพิบัติ | "ดินถล่มทับเส้นทางสัญจรหลัก รถกระบะโดนทับ 1 คันและคนติดอยู่ข้างใน" → urgent
ภัยพิบัติ | "โรงงานสารเคมีระเบิด มีควันสีเหลืองพวยพุ่ง คาดว่าเป็นก๊าซพิษ" → urgent
ภัยพิบัติ | "อาคารพาณิชย์ 4 ชั้นทรุดตัว มีเสียงลั่นและรอยร้าวขนาดใหญ่กำลังจะถล่ม" → urgent
ภัยพิบัติ | "แผ่นดินไหวรุนแรง กระจกตึกแตกตกลงมาใส่ฟุตบาทและผู้คน" → urgent
ภัยพิบัติ | "มีคนลักลอบเผาหญ้าข้างทาง ควันหนาทึบจนมองไม่เห็นถนน มีรถชนกันแล้ว" → urgent
ภัยพิบัติ | "ท่อแก๊สใต้ดินระเบิดกลางสี่แยก ไฟลุกท่วมรถยนต์หลายคัน" → urgent
ภัยพิบัติ | "เกิดสึนามิซัดเข้าฝั่ง ประชาชนอพยพหนีตาย" → urgent
ภัยพิบัติ | "โรงงานนิวเคลียร์มีกัมมันตภาพรังสีรั่วไหล" → urgent
ภัยพิบัติ | "พายุฤดูร้อนพัดกระหน่ำ ต้นไม้ใหญ่และเสาไฟหักโค่นหลายสิบต้น" → urgent
ภัยพิบัติ | "น้ำท่วมขังรอการระบายสูงถึงฟุตบาทหลังฝนตกหนัก ขับรถลำบาก น้ำเข้าซอย" → medium
ภัยพิบัติ | "มีคนเผาขยะในซอย ควันลอยเข้าบ้านทำให้แสบจมูกและหายใจไม่ออก" → medium
ภัยพิบัติ | "ลมพัดแรงมากจนหลังคาสังกะสีปลิวหลุดไปบางส่วน แต่ไม่ได้ทับใคร" → medium
ภัยพิบัติ | "ฝุ่น PM 2.5 หนาทึบมากจนมองไม่เห็นยอดตึก แสบตาแสบจมูก หายใจขัด" → medium
ภัยพิบัติ | "ภัยแล้งรุนแรง น้ำประปาเริ่มไหลอ่อนและมีสีขุ่น" → medium
ภัยพิบัติ | "ลูกเห็บตกใส่หลังคาบ้านกระเบื้องแตกบางแผ่น" → medium
ภัยพิบัติ | "อากาศร้อนจัดจนเครื่องใช้ไฟฟ้าบางตัวทำงานผิดปกติ แอร์สู้ไม่ไหว" → normal
ภัยพิบัติ | "ฝนตกปรอยๆ ทำให้ถนนลื่นเล็กน้อย ไม่ได้เกิดอุบัติเหตุ" → normal
ภัยพิบัติ | "หมอกลงจัดในตอนเช้า ทัศนวิสัยลดลง ต้องเปิดไฟตัดหมอก" → normal
ภัยพิบัติ | "มีเสียงพลุดังตอนดึก ตกใจตื่น" → normal

--- ท่อน้ำ (Water) ---
ท่อน้ำ | "ท่อประปาเมนหลักแตก น้ำพุ่งทะลักท่วมถนนจนรถสัญจรไม่ได้ ถนนทรุด" → urgent
ท่อน้ำ | "น้ำประปารั่วซึมเข้าตู้ควบคุมไฟฟ้าขนาดใหญ่ มีประกายไฟและควัน" → urgent
ท่อน้ำ | "ท่อน้ำทิ้งโรงงานแตก น้ำสีดำคล้ำไหลลงคลองสาธารณะ ปลาลอยตายเกลื่อน" → urgent
ท่อน้ำ | "รถบรรทุกสารเคมีพลิกคว่ำ สารเคมีรั่วไหลลงแหล่งน้ำดิบของชุมชน" → urgent
ท่อน้ำ | "เขื่อนดินกั้นน้ำพังทลาย น้ำกำลังมวลใหญ่ไหลเข้าท่วมบ้านเรือน" → urgent
ท่อน้ำ | "ท่อน้ำร้อนในคอนโดแตก ลวกคนที่เดินผ่านไปมา" → urgent
ท่อน้ำ | "บ่อบำบัดน้ำเสียของเทศบาลล้น ทะลักเข้าท่วมโรงเรียน" → urgent
ท่อน้ำ | "น้ำประปาไม่ไหลมา 3 วันแล้ว ทั้งตำบลเดือดร้อนหนัก ไม่มีน้ำใช้เลย" → medium
ท่อน้ำ | "ท่อระบายน้ำอุดตัน น้ำเน่าขังส่งกลิ่นเหม็นคละคลุ้งไปทั้งซอย" → medium
ท่อน้ำ | "มิเตอร์น้ำรั่ว มีน้ำซึมออกมาตลอดเวลา กลัวค่าน้ำพุ่ง" → medium
ท่อน้ำ | "น้ำประปามีสีขุ่นแดงและมีกลิ่นเหม็นสนิม ไม่สามารถใช้อุปโภคบริโภคได้" → medium
ท่อน้ำ | "ท่อส่งน้ำภายในซอยแตก น้ำท่วมขังถึงตาตุ่ม" → medium
ท่อน้ำ | "น้ำประปาไหลอ่อนมากในช่วงหัวค่ำ ต้องรอนานกว่าจะเต็มถัง" → normal
ท่อน้ำ | "ฝาปิดท่อระบายน้ำหน้าบ้านมีรอยร้าว แต่ยังเหยียบได้" → normal
ท่อน้ำ | "น้ำมีสีขุ่นเล็กน้อยในช่วงเช้า แต่ทิ้งไว้สักพักก็ใส" → normal
ท่อน้ำ | "มีน้ำขังเล็กน้อยบริเวณหน้าบ้านหลังฝนตก เป็นแอ่งเล็กๆ" → normal
ท่อน้ำ | "ต้องการให้เทศบาลมาลอกท่อตามรอบปกติ" → normal

--- ไฟฟ้า (Electricity) ---
ไฟฟ้า | "เสาไฟฟ้าแรงสูงหักโค่นล้มทับรถยนต์ขวางกลางถนน มีไฟลุกไหม้" → urgent
ไฟฟ้า | "สายไฟขาดตกลงมาแช่ในแอ่งน้ำขังที่มีคนเดินผ่านไปมา" → urgent
ไฟฟ้า | "หม้อแปลงระเบิดเสียงดังสนั่น มีไฟลุกไหม้ลามไปติดป้ายโฆษณาและตึกข้างเคียง" → urgent
ไฟฟ้า | "ตู้กดน้ำดื่มหยอดเหรียญมีกระแสไฟฟ้ารั่ว เด็กไปจับแล้วโดนดูดสลบ" → urgent
ไฟฟ้า | "สายไฟในบ้านช็อตและเกิดเพลิงไหม้บริเวณปลั๊กไฟ ควันโขมง" → urgent
ไฟฟ้า | "ไฟดับทั้งโรงพยาบาล เครื่องสำรองไฟเสีย ผู้ป่วยวิกฤตอันตราย" → urgent
ไฟฟ้า | "เสาไฟเอียง 45 องศา โคนเสาหัก กำลังจะล้มทับบ้านเรือน" → urgent
ไฟฟ้า | "ไฟดับทั้งตำบลตั้งแต่เมื่อคืน คลินิกและผู้ป่วยติดเตียงเดือดร้อนหนัก" → medium
ไฟฟ้า | "ไฟส่องสว่างริมทางดับทั้งเส้น 2 กิโลเมตร ตรงทางโค้งอันตราย" → medium
ไฟฟ้า | "สายสื่อสารห้อยย้อยลงมาเกี่ยวคอคนขี่มอเตอร์ไซค์ล้ม" → medium
ไฟฟ้า | "ไฟตกบ่อยมากจนแอร์ ตู้เย็น และคอมพิวเตอร์พังไปหลายเครื่องแล้ว" → medium
ไฟฟ้า | "สายเคเบิลขาดห้อยต่องแต่ง ขวางทางเข้าออกซอย รถบรรทุกเข้าไม่ได้" → medium
ไฟฟ้า | "หลอดไฟสาธารณะหน้าบ้านกะพริบติดๆ ดับๆ มาหลายวันแล้ว" → normal
ไฟฟ้า | "สายอินเทอร์เน็ต/สายสื่อสารพันกันรุงรังบนเสาไฟ ดูไม่เป็นระเบียบ" → normal
ไฟฟ้า | "บิลค่าไฟเดือนนี้แพงผิดปกติ อยากให้มาตรวจสอบมิเตอร์" → normal
ไฟฟ้า | "หลอดไฟทางเดินสาธารณะขาด 1 ดวง แต่ดวงอื่นรอบๆ ยังติด" → normal
ไฟฟ้า | "อยากขอขยายเขตไฟฟ้าเข้าบ้านสวนที่เพิ่งปลูกใหม่" → normal

--- ถนน (Road) ---
ถนน | "สะพานไม้ข้ามคลองหักพังถล่มลงมา มีรถมอเตอร์ไซค์และเด็กตกลงไป" → urgent
ถนน | "หลุมยุบขนาดใหญ่บนถนนสายหลัก ลึก 2 เมตร รถตกลงไปแล้ว 2 คัน" → urgent
ถนน | "รถบรรทุกทำน้ำมันหกเรี่ยราดเป็นทางยาว 5 กิโลเมตร รถลื่นไถลชนกันหลายคัน" → urgent
ถนน | "คอสะพานขาด รถไม่สามารถสัญจรผ่านไปมาได้ ตัดขาดเส้นทางหลักเข้าเมือง" → urgent
ถนน | "เกิดอุบัติเหตุรถชนกัน 4 คันรวด มีผู้บาดเจ็บติดอยู่ในรถ มีไฟลุกไหม้" → urgent
ถนน | "ดินสไลด์ปิดทับถนนสายหลัก รถผ่านไม่ได้เลยนับพันคัน" → urgent
ถนน | "ไฟจราจรสี่แยกใหญ่เสียทุกด้าน รถติดขัดหนักและเกือบชนกันหลายรอบ" → urgent
ถนน | "ถนนเป็นหลุมเป็นบ่อลึก รถเล็กสัญจรลำบากมาก ยางแตกไปหลายคัน" → medium
ถนน | "ฝาท่อเหล็กกลางถนนหายไป กลายเป็นหลุมลึกอันตราย มอเตอร์ไซค์อาจตกได้" → medium
ถนน | "แผงกั้นเขตก่อสร้างล้มล้ำเข้ามาในเลนรถวิ่ง ทำให้ต้องเบี่ยงหลบ" → medium
ถนน | "ป้ายบอกทางขนาดใหญ่พังหลุดลงมาขวางเลนจักรยาน" → medium
ถนน | "ทางเท้าทรุดตัวหนัก เป็นโพรงลึก เดินสะดุดล้มหลายคน" → medium
ถนน | "ทางเท้าทรุดตัวเป็นแอ่งตื้นๆ เวลาฝนตกมีน้ำขังเดินเลอะเทอะ" → normal
ถนน | "สีตีเส้นจราจรทางม้าลายซีดจางจนแทบมองไม่เห็น" → normal
ถนน | "ป้ายบอกทางริมถนนซอยหลุดเอียง แต่ไม่ได้กีดขวางใคร" → normal
ถนน | "ลูกระนาดชำรุด มีรอยแตกร้าวเล็กน้อย" → normal
ถนน | "ขอกระจกโค้งส่องทางแยก เพราะมองไม่ค่อยเห็นรถฝั่งตรงข้าม" → normal

--- ขยะ (Garbage) ---
ขยะ | "พบถังขยะบรรจุสารเคมีอันตราย/เข็มฉีดยาจำนวนมาก ถูกแอบทิ้งไว้ข้างสนามเด็กเล่น" → urgent
ขยะ | "มีคนลอบจุดไฟเผากองขยะพลาสติกขนาดใหญ่ใกล้ปั๊มน้ำมัน ไฟลามเร็วมาก" → urgent
ขยะ | "โรงงานแอบปล่อยกากอุตสาหกรรมทิ้งในพื้นที่รกร้าง มีควันและกลิ่นฉุนรุนแรง แสบตา" → urgent
ขยะ | "พบกากกัมมันตรังสี หรือวัสดุต้องสงสัยทิ้งไว้ริมสระน้ำสาธารณะ" → urgent
ขยะ | "น้ำเสียจากการหมักขยะทะลักลงสู่แม่น้ำสายหลัก ปลาตายลอยเกลื่อน" → urgent
ขยะ | "รถขยะไม่มาเก็บเป็นอาทิตย์ ขยะล้นกองเต็มพื้น ส่งกลิ่นเหม็นเน่า มีหนอนและแมลงวันบุกบ้าน" → medium
ขยะ | "มีซากสุนัข/วัวตายขึ้นอืดอยู่ริมถนน ส่งกลิ่นเหม็นรุนแรงมากไปทั้งหมู่บ้าน" → medium
ขยะ | "ท่อระบายน้ำเต็มไปด้วยขยะพลาสติก ทำให้ระบายน้ำไม่ทันตอนฝนตก น้ำท่วมขัง" → medium
ขยะ | "จุดทิ้งขยะส่วนรวมของหมู่บ้านส่งกลิ่นเหม็นรบกวนบ้านใกล้เคียงตลอดเวลา" → medium
ขยะ | "คนแอบเอาที่นอนและเฟอร์นิเจอร์เก่ามาทิ้งขวางปากซอย" → medium
ขยะ | "ถังขยะสาธารณะเต็มจนล้นออกมาเล็กน้อย แต่ยังไม่มีกลิ่นรุนแรง" → normal
ขยะ | "มีคนทิ้งเศษกระดาษและถุงพลาสติกเรี่ยราดในสวนสาธารณะ" → normal
ขยะ | "อยากขอถังขยะใบใหม่เพราะใบเก่าฝาแตก หรือล้อหลุด" → normal
ขยะ | "กิ่งไม้แห้งใบไม้แห้งกองอยู่ริมฟุตบาท รอคนมาเก็บ" → normal

--- กีดขวาง (Tree) ---
กีดขวาง | "ต้นไม้ใหญ่อายุหลายสิบปีหักโค่นทับหลังคาบ้านคนพังยับเยิน มีคนติดอยู่" → urgent
กีดขวาง | "กิ่งไม้แห้งขนาดใหญ่หักค้างอยู่บนสายไฟแรงสูง ลมพัดแกว่งไปมา มีประกายไฟ" → urgent
กีดขวาง | "ป้ายโฆษณาขนาดใหญ่โครงสร้างเหล็กหักเอียงจะล้มทับถนนและรถที่วิ่งไปมา" → urgent
กีดขวาง | "รถเครนก่อสร้างล้มทับขวางถนนทุกเลน การจราจรเป็นอัมพาต" → urgent
กีดขวาง | "ก้อนหินขนาดใหญ่กลิ้งตกลงมาขวางรางรถไฟ" → urgent
กีดขวาง | "กิ่งไม้ยื่นออกมาบดบังป้ายจราจรและไฟทาง ทำให้มองไม่เห็นทางโค้งอันตราย" → medium
กีดขวาง | "มีคนนำกระถางต้นไม้และราวตากผ้ามาวางขวางทางเท้าจนคนต้องลงไปเดินบนถนน เสี่ยงรถชน" → medium
กีดขวาง | "กองทราย หิน และวัสดุก่อสร้างวางกินเลนถนนเข้ามา 1 เลน รถติดมากและเกิดอุบัติเหตุบ่อย" → medium
กีดขวาง | "แม่ค้าตั้งแผงขายของยื่นลงมาบนพื้นถนนกีดขวางการจราจรในชั่วโมงเร่งด่วน" → medium
กีดขวาง | "รถสิบล้อจอดแช่ขวางหน้าบ้านและปากซอย เข้าออกไม่ได้เลย" → medium
กีดขวาง | "ต้นหญ้าและวัชพืชขึ้นรกริมทางเดิน ดูไม่สะอาดตา กลัวมีงู" → normal
กีดขวาง | "กิ่งไม้เล็กๆ ร่วงหล่นตามพื้นถนนหลังฝนตก" → normal
กีดขวาง | "มีรถเข็นขายของจอดทิ้งไว้ริมฟุตบาท แต่ไม่ได้ขวางทางสัญจรหลัก" → normal
กีดขวาง | "รถยนต์จอดชิดริมฟุตบาทขาวแดง แต่รถคันอื่นยังพอวิ่งผ่านได้" → normal
กีดขวาง | "เพื่อนบ้านปลูกต้นไม้กิ่งยื่นเข้ามาในรั้วบ้านเราเล็กน้อย" → normal
`;

router.post('/urgency', async (req, res) => {
  const { description, category } = req.body;
  if (!description || description.trim().length < 5)
    return res.json({ urgency: ruleBasedUrgency('', category), source: 'default' });

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

  // 1. Try Gemini 2.5 Flash
  if (GEMINI_KEY) {
    try {
      const urgency = await new Promise((resolve, reject) => {
        const body = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 1024 }
        });
        const reqC = https.request({
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        }, (r) => {
          let d = '';
          r.on('data', c => (d += c));
          r.on('end', () => {
            try {
              const json = JSON.parse(d);
              if (json.error) return reject(json.error.message);
              const text = (json.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase();
              console.log(`[AI urgency] [Gemini] [${category}] "${description.slice(0, 50)}" → "${text}"`);
              if (text.includes('urgent')) resolve('urgent');
              else if (text.includes('medium')) resolve('medium');
              else if (text.includes('normal')) resolve('normal');
              else reject('Unexpected response');
            } catch (e) { reject(e); }
          });
        });
        reqC.setTimeout(3500, () => {
          reqC.destroy();
          reject(new Error('Gemini timeout (3.5s)'));
        });
        reqC.on('error', reject);
        reqC.write(body);
        reqC.end();
      });
      return res.json({ urgency, source: 'gemini' });
    } catch (err) {
      console.log(`[AI urgency] [Gemini] failed: ${err.message || err}, falling back to Claude...`);
    }
  }

  // 2. Try Claude
  if (CLAUDE_KEY) {
    try {
      const urgency = await new Promise((resolve, reject) => {
        const body = JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 8,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }]
        });
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
              if (json.error) return reject(json.error.message);
              const text = (json.content?.[0]?.text || '').trim().toLowerCase();
              console.log(`[AI urgency] [Claude] [${category}] "${description.slice(0, 50)}" → "${text}"`);
              if (text.includes('urgent')) resolve('urgent');
              else if (text.includes('medium')) resolve('medium');
              else if (text.includes('normal')) resolve('normal');
              else reject('Unexpected response');
            } catch (e) { reject(e); }
          });
        });
        reqC.setTimeout(3500, () => {
          reqC.destroy();
          reject(new Error('Claude timeout (3.5s)'));
        });
        reqC.on('error', reject);
        reqC.write(body);
        reqC.end();
      });
      return res.json({ urgency, source: 'claude' });
    } catch (err) {
      console.log(`[AI urgency] [Claude] failed: ${err.message || err}, falling back to rule-based...`);
    }
  }

  // 3. Fallback to Rule-based
  console.log(`[AI urgency] [Rule-based] using fallback for "${description.slice(0, 50)}"`);
  return res.json({ urgency: ruleBasedUrgency(description, category), source: 'rule' });
});

// ─── Smart Cognitive Thai NLP Fallback for Category & Ambiguity ────────
function ruleBasedClassification(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 5) {
    return {
      category: 'Road',
      urgency: 'normal',
      isAmbiguous: true,
      confidence: 'low',
      reason: 'ข้อความสั้นเกินไป ไม่สามารถระบุหมวดหมู่ปัญหาได้',
      source: 'rule'
    };
  }

  const t = text.trim().toLowerCase();

  // 1. ตรวจสอบข้อความคลุมเครือทั่วไป (Vague / Ambiguous checks)
  const vaguePatterns = [
    /^(ช่วยด้วย|มีปัญหา|ช่วยหน่อย|พัง|ซ่อมหน่อย|เดือดร้อน|แย่มาก|ไม่ไหวแล้ว|มาดูหน่อย|แย่เลย)[!?. ]*$/,
    /^มีปัญหา(แถวนี้|ตรงนี้|มาก|จริงๆ)/,
    /^(ตรงนี้|แถวนี้|ที่นี่)พัง/,
    /^(รบกวน|ช่วย)มาดู(ให้หน่อย|ด่วน)/,
    /^ไม่รู้(เรื่องอะไร|ว่าเป็นอะไร|จะทำยังไง)/
  ];
  for (const pat of vaguePatterns) {
    if (pat.test(t)) {
      return {
        category: 'Road',
        urgency: 'normal',
        isAmbiguous: true,
        confidence: 'low',
        reason: 'ข้อความระบุปัญหาคลุมเครือ ไม่มีคำระบุลักษณะปัญหาหรืออาการที่แน่ชัด',
        source: 'rule'
      };
    }
  }

  // 2. Multi-category Dictionary & Pattern Matching with Weights
  const categoryDefs = {
    Hazard: {
      regex: /(เพลิงไหม้|ไฟไหม้|ไฟลุก|ระเบิด|แก๊สรั่ว|สารเคมี|กัมมันตรังสี|นิวเคลียร์|ตึกถล่ม|อาคารถล่ม|สะพานพัง|สะพานขาด|คอสะพานขาด|แผ่นดินไหว|ดินสไลด์.*ทับ|ดินถล่ม.*ทับ|สึนามิ|น้ำป่าไหลหลาก)/,
      weight: 3.0
    },
    Animal: {
      regex: /(งูเห่า|งูจงอาง|งูเหลือม|งูหลาม|งูเขียว|งู|ตะขาบ|แมงป่อง|ผึ้งหลวง|รังผึ้ง|ผึ้ง|แตน|รังแตน|ต่อหัวเสือ|รังต่อ|ตัวเหี้ย|ตัวเงินตัวทอง|หมาบ้า|สุนัขบ้า|สุนัขจรจัด.*กัด|หมากัดคน|ช้างป่า|ลิงกัด|จระเข้|สัตว์มีพิษ|สัตว์ดุร้าย)/,
      weight: 2.5
    },
    Water: {
      regex: /(น้ำประปา|ท่อประปา|ท่อน้ำแตก|ท่อแตก|ท่อรั่ว|น้ำไม่ไหล|น้ำไหลอ่อน|น้ำประปาขุ่น|น้ำขุ่น|น้ำมีกลิ่น|น้ำรั่วซึม|น้ำท่วม|น้ำขัง|ท่อระบายน้ำ.*ตัน|น้ำผุด|ท่อเมน|น้ำเสีย|น้ำเอ่อ)/,
      weight: 2.0
    },
    Electricity: {
      regex: /(เสาไฟ|สายไฟ|หม้อแปลง|ไฟดับ|ไฟตก|ไฟกระพริบ|ไฟช็อต|ไฟรั่ว|หลอดไฟทาง|ไฟส่องสว่าง|สายสื่อสาร.*ห้อย|สายเคเบิล|มิเตอร์ไฟ|ไฟฟ้าสาธารณะ)/,
      weight: 2.0
    },
    Garbage: {
      regex: /(ขยะ|ถังขยะ|กองขยะ|ขยะล้น|กลิ่นเน่า|เหม็นเน่า|สิ่งปฏิกูล|แอบทิ้งขยะ|เผาขยะ|รถขยะ|เศษอาหาร|ซากสุนัข|ซากสัตว์|กลิ่นเหม็นรุนแรง)/,
      weight: 2.0
    },
    Tree: {
      regex: /(ต้นไม้|กิ่งไม้|หักโค่น|ล้มทับ|ล้มขวาง|กิ่งไม้ยื่น|กิ่งไม้แห้ง|ต้นไม้ใหญ่|ป้ายโฆษณา.*ล้ม|สิ่งกีดขวาง|หญ้ารก|วัชพืช)/,
      weight: 2.0
    },
    Road: {
      regex: /(ถนน|ผิวทาง|ทางเท้า|ฟุตบาท|หลุม|บ่อ|ทรุดตัว|ลูกระนาด|ฝาท่อ|ป้ายจราจร|ไฟจราจร|สัญญาณไฟ|เส้นจราจร|คอสะพาน|แผงกั้น|สะพานไม้)/,
      weight: 1.8
    }
  };

  const scores = {};
  for (const [cat, def] of Object.entries(categoryDefs)) {
    scores[cat] = 0;
    const match = t.match(new RegExp(def.regex.source, 'g'));
    if (match) {
      scores[cat] += match.length * def.weight;
    }
  }

  // หาหมวดหมู่ที่ได้คะแนนสูงสุด
  let topCat = null;
  let maxScore = 0;
  let secondScore = 0;
  for (const [cat, sc] of Object.entries(scores)) {
    if (sc > maxScore) {
      secondScore = maxScore;
      maxScore = sc;
      topCat = cat;
    } else if (sc > secondScore) {
      secondScore = sc;
    }
  }

  // หากมีหมวดหมู่เฉพาะทาง (เช่น Water, Electricity, Animal, Tree, Garbage, Hazard) ได้คะแนน
  // และ Road ได้คะแนนจากเพียงคำระบุตำแหน่ง เช่น ถนน, ทางเท้า ให้ลดผลกระทบของ Road ต่อการเป็นข้อความคลุมเครือ
  if (topCat !== 'Road' && scores.Road > 0) {
    secondScore = Math.max(...Object.entries(scores).filter(([c]) => c !== topCat && c !== 'Road').map(([, s]) => s), 0);
  }

  // หากไม่มีหมวดใดแมทช์เลย (คะแนน 0)
  if (maxScore === 0) {
    return {
      category: 'Road',
      urgency: 'normal',
      isAmbiguous: true,
      confidence: 'low',
      reason: 'ไม่พบคำสำคัญที่ตรงกับหมวดหมู่งานช่างใดๆ ชัดเจน',
      source: 'rule'
    };
  }

  // หากคะแนนของ 2 หมวดสูสีกันมากอย่างแท้จริง และไม่ใช่เรื่องสถานที่
  if (secondScore > 0 && (maxScore - secondScore < 0.3) && topCat !== 'Hazard') {
    return {
      category: topCat,
      urgency: ruleBasedUrgency(text, topCat),
      isAmbiguous: true,
      confidence: 'medium',
      reason: `พบประเด็นคาบเกี่ยวระหว่างหลายหมวดหมู่ (${topCat} และหมวดอื่นๆ)`,
      source: 'rule'
    };
  }

  const urgency = ruleBasedUrgency(text, topCat);
  return {
    category: topCat,
    urgency,
    isAmbiguous: false,
    confidence: 'high',
    reason: `จำแนกตรงกับหมวดหมู่ ${topCat} ด้วยระบบ Cognitive Thai NLP`,
    source: 'rule'
  };
}

const CLASSIFY_PROMPT = `คุณคือระบบ AI ผู้เชี่ยวชาญจำแนกหมวดหมู่เรื่องร้องเรียนของเทศบาล/เมืองอัจฉริยะ (ResolveNow)
หน้าที่ของคุณคือวิเคราะห์ข้อความร้องเรียนจากประชาชน แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามใส่คำบรรยายอื่นนอก JSON)

หมวดหมู่ที่เป็นไปได้ (Category) มี 7 หมวด:
- "Road" = ปัญหาเกี่ยวกับถนน ทางเท้า หลุม บ่อ ทรุดตัว ลูกระนาด ฝาท่อ ป้ายจราจร ไฟจราจร คอสะพาน
- "Water" = ปัญหาน้ำประปา ท่อน้ำแตก ท่อรั่ว น้ำไม่ไหล น้ำขุ่น น้ำท่วมขัง ท่อระบายน้ำอุดตัน
- "Electricity" = ปัญหาไฟฟ้า เสาไฟ สายไฟ หม้อแปลง ไฟดับ ไฟตก ไฟกระพริบ ไฟรั่ว ไฟส่องสว่างริมทาง
- "Garbage" = ปัญหาขยะ ถังขยะ กลิ่นเน่า ขยะล้น สิ่งปฏิกูล ลักลอบทิ้งขยะ ซากสัตว์ เผาขยะ
- "Animal" = สัตว์มีพิษ สัตว์ดุร้าย งู ตัวเงินตัวทอง สุนัขบ้า สุนัขจรจัดกัดคน รังผึ้ง รังต่อ รังแตน
- "Tree" = ต้นไม้ กิ่งไม้หักโค่น ล้มทับ ล้มขวางทาง กิ่งไม้ยื่นบดบัง หรือหญ้ารกรุงรัง
- "Hazard" = เพลิงไหม้ ไฟลุก การระเบิด แก๊สรั่วรุนแรง สารเคมีรั่ว ตึกถล่ม คานสะพานขาด ภัยพิบัติฉับพลัน

ระดับความเร่งด่วน (Urgency) วิเคราะห์ตามระดับความเสียหายและผลกระทบ:
- "urgent" = เป็นอันตรายต่อชีวิต ร่างกาย หรือทรัพย์สินรุนแรง หรือโครงสร้างพังเสียหายหนักมาก ต้องดำเนินการทันที
  * ตัวอย่างเด่น: ถนนพังยับ/พังยับเยิน, หลุมยุบ/คอสะพานขาด, เสาไฟล้ม/สายไฟขาดแช่น้ำ, ไฟไหม้/แก๊สรั่ว, ท่อเมนแตกน้ำทะลักท่วม, งูมีพิษในบ้าน, ต้นไม้ล้มทับบ้านหรือรถ
- "medium" = ส่งผลกระทบต่อชีวิตประจำวันและการสัญจร ควรรีบแก้ไขโดยเร็ว
  * ตัวอย่างเด่น: ถนนเป็นหลุมบ่อ/ทรุดตัว/เละ/ชำรุดหนัก, ท่อแตกน้ำไม่ไหล/ขุ่นแดง, ไฟดับทั้งซอย, ขยะเน่าสะสมส่งกลิ่น, กิ่งไม้ยื่นบดบังป้าย, รังผึ้ง/รังแตน
- "normal" = ความไม่สะดวกเล็กน้อย ยังใช้งานได้ตามปกติ ไม่มีความเสียหายรุนแรง
  * ตัวอย่างเด่น: สีเส้นจราจรซีด, ลูกระนาดแตกร้าวเล็กน้อย, หลอดไฟทางขาด 1 ดวง, น้ำขังเล็กน้อยหลังฝนตก, ขอถังขยะใหม่, กิ่งไม้ร่วงเล็กน้อย

การประเมินความคลุมเครือ (isAmbiguous):
- หากข้อความสั้นเกินไป, กำกวมมาก, ไม่มีคำระบุลักษณะปัญหาหรืออาการ (เช่น "ช่วยด้วยครับ", "มีปัญหาแถวนี้", "ตรงนี้พังช่วยมาดูหน่อย", "แย่มาก") ให้ระบุ isAmbiguous: true, confidence: "low"
- หากข้อความมีหลายประเด็นชนกันจนแยกไม่ออกว่าช่างฝ่ายไหนควรรับผิดชอบเป็นหลัก ให้ระบุ isAmbiguous: true, confidence: "medium"
- หากระบุปัญหาและอาการชัดเจน ให้ระบุ isAmbiguous: false, confidence: "high"

รูปแบบ JSON ที่ต้องตอบ (Strict JSON):
{
  "category": "Road",
  "urgency": "medium",
  "isAmbiguous": false,
  "confidence": "high",
  "reason": "คำอธิบายเหตุผลสั้นๆ"
}

ข้อความร้องเรียน: "`;

async function classifyComplaint(description) {
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return ruleBasedClassification(description);
  }

  const prompt = CLASSIFY_PROMPT + description.replace(/"/g, "'") + '"';

  // 1. Try Gemini
  if (GEMINI_KEY) {
    try {
      const result = await new Promise((resolve, reject) => {
        const body = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json'
          }
        });
        const reqC = https.request({
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        }, (r) => {
          let d = '';
          r.on('data', c => (d += c));
          r.on('end', () => {
            try {
              const json = JSON.parse(d);
              if (json.error) return reject(json.error.message);
              const rawText = (json.candidates?.[0]?.content?.parts?.[0]?.text || '{}').trim();
              const jsonMatch = rawText.match(/\{[\s\S]*\}/);
              const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
              const validCats = ['Road', 'Water', 'Electricity', 'Garbage', 'Animal', 'Tree', 'Hazard'];
              const validUrgs = ['normal', 'medium', 'urgent'];
              const cat = validCats.includes(parsed.category) ? parsed.category : 'Road';
              const urg = validUrgs.includes(parsed.urgency) ? parsed.urgency : 'normal';
              resolve({
                category: cat,
                urgency: urg,
                isAmbiguous: Boolean(parsed.isAmbiguous),
                confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'high',
                reason: parsed.reason || 'วิเคราะห์ด้วย Gemini Flash',
                source: 'gemini'
              });
            } catch (e) { reject(e); }
          });
        });
        reqC.setTimeout(3500, () => {
          reqC.destroy();
          reject(new Error('Gemini timeout (3.5s)'));
        });
        reqC.on('error', reject);
        reqC.write(body);
        reqC.end();
      });
      return result;
    } catch (err) {
      console.log(`[AI classify] [Gemini] failed: ${err.message || err}, falling back to Claude...`);
    }
  }

  // 2. Try Claude
  if (CLAUDE_KEY) {
    try {
      const result = await new Promise((resolve, reject) => {
        const body = JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 256,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }]
        });
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
              if (json.error) return reject(json.error.message);
              const rawText = (json.content?.[0]?.text || '{}').trim();
              const jsonMatch = rawText.match(/\{[\s\S]*\}/);
              const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
              const validCats = ['Road', 'Water', 'Electricity', 'Garbage', 'Animal', 'Tree', 'Hazard'];
              const validUrgs = ['normal', 'medium', 'urgent'];
              const cat = validCats.includes(parsed.category) ? parsed.category : 'Road';
              const urg = validUrgs.includes(parsed.urgency) ? parsed.urgency : 'normal';
              resolve({
                category: cat,
                urgency: urg,
                isAmbiguous: Boolean(parsed.isAmbiguous),
                confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'high',
                reason: parsed.reason || 'วิเคราะห์ด้วย Claude Haiku',
                source: 'claude'
              });
            } catch (e) { reject(e); }
          });
        });
        reqC.setTimeout(3500, () => {
          reqC.destroy();
          reject(new Error('Claude timeout (3.5s)'));
        });
        reqC.on('error', reject);
        reqC.write(body);
        reqC.end();
      });
      return result;
    } catch (err) {
      console.log(`[AI classify] [Claude] failed: ${err.message || err}, falling back to rule-based...`);
    }
  }

  // 3. Fallback to Cognitive Thai NLP Heuristics Engine
  console.log(`[AI classify] [Rule-based] fallback for: "${description.slice(0, 50)}"`);
  return ruleBasedClassification(description);
}

// ─── POST /api/ai/classify ─────────────────────────────────────────
router.post('/classify', async (req, res) => {
  try {
    const { description } = req.body;
    const result = await classifyComplaint(description || '');
    res.json(result);
  } catch (err) {
    console.error('[AI classify] error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการวิเคราะห์' });
  }
});

module.exports = router;
module.exports.ruleBasedUrgency = ruleBasedUrgency;
module.exports.ruleBasedClassification = ruleBasedClassification;
module.exports.classifyComplaint = classifyComplaint;
