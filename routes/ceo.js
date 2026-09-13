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

// GET /api/ceo/tickets - ดึง tickets ทั้งหมดแบบ read-only สำหรับ dashboard
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });

    const formattedTickets = tickets.map(t => {
      return {
        ticketId: t.ticketId,
        category: t.category,
        location: t.location,
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
