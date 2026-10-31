/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

// ─── utils/lineAiContext.js ────────────────────────────────────
// จัดการหน่วยความจำบริบทการสนทนา (Multi-turn Conversation Memory) สำหรับ LINE Bot
// เก็บประวัติย้อนหลัง 3-5 เทิร์นต่อ LINE User ID พร้อมระบบ Auto-expiry (TTL: 15 นาที)

const MAX_TURNS = 5;               // สูงสุด 5 เทิร์น (10 ข้อความ: user 5, model 5)
const TTL_MS = 15 * 60 * 1000;      // 15 นาที
const MAX_SESSIONS = 5000;         // ป้องกัน Memory Leak

class LineAiContextManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * เพิ่มข้อความใหม่เข้าบริบท
   * @param {string} lineUserId 
   * @param {'user'|'model'} role 
   * @param {string} content 
   */
  addMessage(lineUserId, role, content) {
    if (!lineUserId || !content) return;
    const now = Date.now();

    let session = this.sessions.get(lineUserId);
    if (!session || (now - session.updatedAt > TTL_MS)) {
      session = {
        messages: [],
        createdAt: now,
        updatedAt: now
      };
    }

    session.messages.push({
      role: role === 'user' ? 'user' : 'model',
      parts: [{ text: String(content).trim() }]
    });

    // รักษาขนาดไม่ให้เกิน MAX_TURNS (user + model รวมกันไม่เกิน MAX_TURNS * 2)
    const maxEntries = MAX_TURNS * 2;
    if (session.messages.length > maxEntries) {
      session.messages = session.messages.slice(-maxEntries);
    }

    session.updatedAt = now;

    // LRU eviction หากเกิน MAX_SESSIONS
    if (this.sessions.size >= MAX_SESSIONS && !this.sessions.has(lineUserId)) {
      const oldestKey = this.sessions.keys().next().value;
      this.sessions.delete(oldestKey);
    }

    this.sessions.set(lineUserId, session);
  }

  /**
   * ดึงประวัติการสนทนาที่ยังไม่หมดอายุ
   * @param {string} lineUserId 
   * @returns {Array<Object>} ประวัติในรูปแบบที่ Gemini API รองรับ (contents array)
   */
  getHistory(lineUserId) {
    if (!lineUserId) return [];
    const session = this.sessions.get(lineUserId);
    if (!session) return [];

    if (Date.now() - session.updatedAt > TTL_MS) {
      this.sessions.delete(lineUserId);
      return [];
    }

    return session.messages.slice();
  }

  /**
   * ล้างประวัติการคุยของ user นั้นๆ
   * @param {string} lineUserId 
   */
  clearContext(lineUserId) {
    if (lineUserId) {
      this.sessions.delete(lineUserId);
    }
  }

  /**
   * ล้างเซสชันทั้งหมดที่หมดอายุ (สามารถเรียก periodic ทำความสะอาด)
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.updatedAt > TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }
}

const lineAiContext = new LineAiContextManager();

// ทำความสะอาดทุกๆ 10 นาที
setInterval(() => {
  lineAiContext.cleanupExpired();
}, 10 * 60 * 1000).unref();

module.exports = lineAiContext;

