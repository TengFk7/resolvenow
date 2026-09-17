/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Category = require('../models/Category');
const { checkIsSlaBreached } = require('../utils/slaHelper');

// ─── Middleware: ป้องกันการเข้าถึง Dashboard ผู้บริหาร ──────────────
function requireCeoAccess(req, res, next) {
  // อนุญาตถ้า Login เป็น Admin อยู่แล้ว หรือ ปลดล็อค CEO Security Gate ผ่านแล้ว
  if (req.session?.role === 'admin' || req.session?.gateUnlocked?.ceo) {
    return next();
  }
  return res.status(403).json({
    error: 'กรุณาปลดล็อค Security Gate ก่อนเข้าถึงข้อมูลผู้บริหาร',
    gateRequired: true
  });
}

// นำ Middleware มาคุ้มครองทุก endpoint ภายใต้ /api/ceo/*
router.use(requireCeoAccess);

// ─── รายชื่อเขตและฟังก์ชันวิเคราะห์สกัดชื่อเขต/แขวง ──────────────────
const KNOWN_DISTRICTS = [
  'พระนคร', 'ดุสิต', 'หนองจอก', 'บางรัก', 'บางเขน', 'บางกะปิ', 'ปทุมวัน', 'ป้อมปราบศัตรูพ่าย',
  'พระโขนง', 'มีนบุรี', 'ลาดกระบัง', 'ยานนาวา', 'สัมพันธวงศ์', 'พญาไท', 'ธนบุรี', 'บางกอกใหญ่',
  'ห้วยขวาง', 'คลองสาน', 'ตลิ่งชัน', 'บางกอกน้อย', 'บางขุนเทียน', 'ภาษีเจริญ', 'หนองแขม', 'ราษฎร์บูรณะ',
  'บางพลัด', 'ดินแดง', 'บึงกุ่ม', 'สาทร', 'บางซื่อ', 'จตุจักร', 'บางคอแหลม', 'ประเวศ', 'คลองเตย',
  'สวนหลวง', 'จอมทอง', 'ดอนเมือง', 'ราชเทวี', 'ลาดพร้าว', 'วัฒนา', 'บางแค', 'หลักสี่', 'สายไหม',
  'คันนายาว', 'สะพานสูง', 'วังทองหลาง', 'คลองสามวา', 'บางนา', 'ทวีวัฒนา', 'ทุ่งครุ', 'บางบอน',
  'เมือง', 'เมืองนนทบุรี', 'ปากเกร็ด', 'บางบัวทอง', 'บางใหญ่', 'เมืองชลบุรี', 'บางละมุง', 'ศรีราชา',
  'เมืองเชียงใหม่', 'แม่ริม', 'หางดง', 'สันทราย', 'เมืองขอนแก่น', 'เมืองภูเก็ต', 'กะทู้', 'ถลาง'
];

function extractDistrict(ticket) {
  if (ticket.district && String(ticket.district).trim()) {
    return String(ticket.district).trim();
  }
  const loc = (ticket.location || '').trim();
  if (!loc) return 'พื้นที่ทั่วไป (ไม่ระบุเขต)';

  // 1. ตรวจคำว่า "เขต..." หรือ "อำเภอ..."
  const districtMatch = loc.match(/(?:เขต|อำเภอ|อ\.)\s*([ก-๙a-zA-Z0-9]+)/);
  if (districtMatch && districtMatch[1]) {
    return 'เขต' + districtMatch[1].replace(/^(เขต|อำเภอ|อ\.)/, '');
  }

  // 2. ตรวจคำว่า "แขวง..." หรือ "ตำบล..."
  const subdistrictMatch = loc.match(/(?:แขวง|ตำบล|ต\.)\s*([ก-๙a-zA-Z0-9]+)/);
  if (subdistrictMatch && subdistrictMatch[1]) {
    return 'แขวง' + subdistrictMatch[1].replace(/^(แขวง|ตำบล|ต\.)/, '');
  }

  // 3. ค้นหาชื่อเขตที่ตรงกับฐานข้อมูล KNOWN_DISTRICTS
  for (const dist of KNOWN_DISTRICTS) {
    if (loc.includes(dist)) {
      return 'เขต' + dist.replace(/^(เขต|อำเภอ)/, '');
    }
  }

  // 4. ตัดตามเครื่องหมายจุลภาค/ทับ
  const parts = loc.split(/[,/·-]/).map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length > 2 ? 1 : 0];
  }

  // 5. หากข้อความสั้น ใช้ข้อความเดิม
  if (loc.length <= 25) return loc;
  return 'โซนใจกลางเมือง (ส่วนกลาง)';
}

// GET /api/ceo/tickets - ดึง tickets ทั้งหมดแบบ read-only สำหรับ dashboard
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .select('ticketId category location district subdistrict urgency status slaBreached slaAssignDeadline slaCompleteDeadline slaPauseStatus totalRepairCost materials createdAt updatedAt')
      .lean()
      .sort({ createdAt: -1 });

    const formattedTickets = tickets.map(t => {
      return {
        ticketId: t.ticketId,
        category: t.category,
        location: t.location,
        district: extractDistrict(t),
        urgency: t.urgency,
        status: t.status,
        slaBreached: checkIsSlaBreached(t),
        totalRepairCost: t.totalRepairCost || 0,
        materialsCount: t.materials ? t.materials.length : 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      };
    });

    res.json(formattedTickets);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/ceo/cost-overview - สรุปงบประมาณและค่าใช้จ่ายซ่อมบำรุง
router.get('/cost-overview', async (req, res) => {
  try {
    const tickets = await Ticket.find().select('ticketId category status totalRepairCost materials createdAt updatedAt').lean();

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const startThisMonth = new Date(curYear, curMonth, 1);
    const startLastMonth = new Date(curYear, curMonth - 1, 1);
    const endLastMonth = new Date(curYear, curMonth, 0, 23, 59, 59, 999);

    let totalCost = 0;
    let thisMonthCost = 0;
    let lastMonthCost = 0;
    const costByCategory = {};
    const materialMap = {};

    tickets.forEach(t => {
      const cost = Number(t.totalRepairCost) || 0;
      totalCost += cost;

      const d = new Date(t.createdAt || t.updatedAt || now);
      if (d >= startThisMonth) {
        thisMonthCost += cost;
      } else if (d >= startLastMonth && d <= endLastMonth) {
        lastMonthCost += cost;
      }

      const cat = t.category || 'Other';
      costByCategory[cat] = (costByCategory[cat] || 0) + cost;

      if (Array.isArray(t.materials)) {
        t.materials.forEach(m => {
          const name = (m.name || '').trim();
          if (name) {
            if (!materialMap[name]) {
              materialMap[name] = { name, quantity: 0, totalCost: 0, unit: m.unit || 'ชิ้น' };
            }
            materialMap[name].quantity += Number(m.quantity) || 1;
            materialMap[name].totalCost += Number(m.totalPrice) || 0;
          }
        });
      }
    });

    // Top 5 materials
    const topMaterials = Object.values(materialMap)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);

    // Calculate delta percentage
    let deltaPct = 0;
    if (lastMonthCost > 0) {
      deltaPct = Math.round(((thisMonthCost - lastMonthCost) / lastMonthCost) * 100);
    }

    res.json({
      totalCost,
      thisMonthCost,
      lastMonthCost,
      deltaPct,
      costByCategory,
      topMaterials
    });
  } catch (e) {
    console.error('[CEO Cost Overview] Error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดงบประมาณ' });
  }
});

// ─── GET /api/ceo/district-analytics ──────────────────────────────
// สรุปสถิติเชิงพื้นที่แยกตามเขต/แขวง เปรียบเทียบกับงบประมาณซ่อมบำรุง
router.get('/district-analytics', async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .select('ticketId category location district subdistrict status totalRepairCost slaBreached createdAt updatedAt')
      .lean();

    const districtMap = {};

    tickets.forEach(t => {
      const dist = extractDistrict(t);
      if (!districtMap[dist]) {
        districtMap[dist] = {
          name: dist,
          ticketCount: 0,
          totalCost: 0,
          completedCount: 0,
          inProgressCount: 0,
          pendingCount: 0,
          breachedCount: 0,
          categoryMap: {}
        };
      }

      const d = districtMap[dist];
      d.ticketCount += 1;
      d.totalCost += Number(t.totalRepairCost) || 0;

      if (t.status === 'completed') {
        d.completedCount += 1;
      } else if (t.status === 'in_progress' || t.status === 'assigned') {
        d.inProgressCount += 1;
      } else if (t.status === 'pending' || t.status === 'reopened') {
        d.pendingCount += 1;
      }

      if (checkIsSlaBreached(t)) {
        d.breachedCount += 1;
      }

      const cat = t.category || 'ทั่วไป';
      d.categoryMap[cat] = (d.categoryMap[cat] || 0) + 1;
    });

    const districts = Object.values(districtMap).map(d => {
      let topCat = '—';
      let topCatCount = 0;
      for (const [cat, count] of Object.entries(d.categoryMap)) {
        if (count > topCatCount) {
          topCat = cat;
          topCatCount = count;
        }
      }
      const resolutionRate = d.ticketCount > 0 ? Math.round((d.completedCount / d.ticketCount) * 100) : 0;
      return {
        name: d.name,
        ticketCount: d.ticketCount,
        totalCost: Math.round(d.totalCost * 100) / 100,
        completedCount: d.completedCount,
        inProgressCount: d.inProgressCount,
        pendingCount: d.pendingCount,
        breachedCount: d.breachedCount,
        resolutionRate,
        topCategory: topCat,
        topCategoryCount: topCatCount
      };
    });

    // เรียงตามงบประมาณที่ใช้ไปมากที่สุด ถ้าเท่ากันเรียงตามจำนวนตั๋ว
    districts.sort((a, b) => b.totalCost - a.totalCost || b.ticketCount - a.ticketCount);

    const totalTicketsAll = tickets.length;
    const totalCostAll = districts.reduce((sum, d) => sum + d.totalCost, 0);

    const highestCostDistrict = districts.length ? districts[0].name : '—';
    const mostReported = [...districts].sort((a, b) => b.ticketCount - a.ticketCount);
    const mostReportedDistrict = mostReported.length ? mostReported[0].name : '—';

    res.json({
      districts,
      summary: {
        totalDistricts: districts.length,
        totalTickets: totalTicketsAll,
        totalBudget: Math.round(totalCostAll * 100) / 100,
        highestCostDistrict,
        mostReportedDistrict
      }
    });
  } catch (e) {
    console.error('[CEO District Analytics] Error:', e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการคำนวณสถิติเชิงพื้นที่' });
  }
});

// GET /api/ceo/technicians - ดึงข้อมูลช่างทั้งหมด
router.get('/technicians', async (req, res) => {
  try {
    const techs = await User.find({ role: 'technician' }).select('firstName lastName specialty email');
    const result = await Promise.all(techs.map(async (u) => {
      const active = await Ticket.countDocuments({
        assignedTo: u._id,
        status: { $nin: ['completed', 'rejected'] }
      });
      const total = await Ticket.countDocuments({ assignedTo: u._id });
      const capacity = active >= 5 ? 100 : active >= 3 ? 75 : active >= 1 ? 40 : 10;
      const statusLabel = active >= 5 ? 'FULL' : active >= 3 ? 'BUSY' : 'READY';
      return {
        id: u._id,
        name: u.firstName + ' ' + u.lastName,
        specialty: u.specialty,
        activeJobs: active,
        totalJobs: total,
        capacity,
        statusLabel
      };
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/ceo/categories - ดึงหมวดหมู่ (ไม่ต้องมี auth)
router.get('/categories', async (req, res) => {
  try {
    const cats = await Category.find().sort({ isDefault: -1, createdAt: 1 });
    res.json(cats.map(c => ({ name: c.name, label: c.label })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
