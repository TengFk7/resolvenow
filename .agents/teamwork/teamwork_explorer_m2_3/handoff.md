# Handoff Report: Client Scripts Specification for Milestone 2 (`public/js/`)

**Agent**: `teamwork_explorer_m2_3`  
**Working Directory**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m2_3`  
**Date**: 2026-11-06T08:42:00Z  
**Canonical Watermark**: `"Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"`  
**Scope**: Client-side scripts in `public/js/`, DevTools console watermark banner, and runtime object `window.__RESOLVENOW_DEVELOPER__`.

---

## 1. Observation

### 1.1 Script Inclusions Across Client HTML Portals
Investigation of all HTML portals in `public/*.html` identified script loading patterns:
- `public/index.html` (Citizen Portal):
  - Line 1442: `<script src="/js/ui.js"></script>`
  - Line 1448: `<script src="/js/app.js"></script>`
- `public/admin.html` (Admin Portal):
  - Line 1303: `<script src="/js/ui.js"></script>`
- `public/tech.html` (Technician Portal):
  - Line 407: `<script src="/js/ui.js"></script>`
- `public/my-tickets.html` (My Tickets Dedicated Portal):
  - Line 958: `<script src="/js/ui.js"></script>`
- `public/executive-dashboard.html` (CEO Dashboard) & `public/track.html` (Public Tracker):
  - Self-contained inline scripts; handled in parallel by `teamwork_explorer_m2_2`.

`public/js/ui.js` is the shared, foundational client library loaded **first** across all four primary authenticated and public citizen/staff portals (`/`, `/admin`, `/tech`, `/my-tickets`). Conversely, `public/js/app.js` is only loaded by `index.html`.

### 1.2 Inspection of `public/js/ui.js` (Lines 1–25)
```javascript
1: /**
2:  * ResolveNow - Complaint Management System
3:  * Copyright (c) 2026 ResolveNow. All rights reserved.
4:  */
5: 
6: /* ─────────────────────────────────────────────
7:    public/js/ui.js — Shared UI Helpers (Premium)
8:    • DOM shortcuts
9:    • Toast / Error display
10:    • Page transitions
11:    • Ripple effect
12:    • Clock
13:    • Status / Priority helpers
14:    • Image modal / Change-password modal
15:    ───────────────────────────────────────────── */
16: 
17: /* ── Utilities ───────────────────────────────────────── */
18: // FIX-2.1: escapeHTML นิยามครั้งเดียวที่นี่ (ลบ duplicate ที่บรรทัด 144 ออกแล้ว)
19: 
20: /* ── Date Formatter ──────────────────────────────────── */
```

### 1.3 Inspection of `public/js/app.js` (Lines 1–15)
```javascript
1: /**
2:  * ResolveNow - Complaint Management System
3:  * Copyright (c) 2026 ResolveNow. All rights reserved.
4:  */
5: 
6: /* ─────────────────────────────────────────────
7:    public/js/app.js — Application Entry Point
8:    • Global state
9:    • enterApp() — routes user to correct view
10:    • loadTickets() — polls ticket data  
11:    • Session resume on page load
12:    ───────────────────────────────────────────── */
13: 
14: /* ── Global State ────────────────────────────────────── */
```

### 1.4 Codebase Header Convention Across `public/js/*.js`
All 10 client scripts (`admin-portal.js`, `admin.js`, `app.js`, `auth.js`, `citizen.js`, `directChat.js`, `my-tickets.js`, `tech-portal.js`, `technician.js`, `ui.js`) begin with a uniform 4-line copyright header:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```
Currently, zero developer attribution, watermark status, or runtime objects exist in any client script.

### 1.5 Baseline Automated Verification Status
- Executed `npm test` (`node scripts/runTests.js`):
  - Total: 52 tests across Groups 1–10.
  - Passed: 52, Failed: 0.
  - Zero tests import or assert on files within `public/js/`.

---

## 2. Logic Chain

1. **Strategic Script Placement in `public/js/ui.js`**:
   - *Observation*: `ui.js` is imported by `index.html`, `admin.html`, `tech.html`, and `my-tickets.html`, and is evaluated before role-specific controllers (`citizen.js`, `admin.js`, `technician.js`, `app.js`).
   - *Inference*: Integrating the runtime developer attribution registration and DevTools console watermark banner inside `ui.js` guarantees that:
     1. The attribution executes across all 4 major portals without requiring script duplication.
     2. `window.__RESOLVENOW_DEVELOPER__` is already defined and frozen before any portal logic evaluates.

2. **Environment & Non-Browser Safety Guard (`typeof window !== 'undefined'`)**:
   - *Observation*: Tooling, test runners, headless parsers, or server-side scripts may import or parse client files.
   - *Inference*: Wrapping initialization in an IIFE guarded by `if (typeof window === 'undefined') return;` completely prevents runtime `ReferenceError` or `TypeError` in Node.js, worker threads, or test environments.

3. **Runtime Immutability & Anti-Tamper Hardening**:
   - *Observation*: The prompt requires an immutable runtime object:
     `Object.freeze({ name: "Chatayodom Choikhuea", phone: "0970543528", lineId: "rapbeerteng555teng55", role: "Full Stack Developer", watermark: "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" })`.
   - *Inference*: To achieve maximum tamper resistance:
     1. Apply `Object.freeze(devMetadata)`.
     2. Define a non-enumerable, non-writable `toString` method returning the exact watermark string so string coercion (`"" + window.__RESOLVENOW_DEVELOPER__`) yields the exact canonical watermark.
     3. Register onto `window` via `Object.defineProperty(window, '__RESOLVENOW_DEVELOPER__', { value: devMetadata, writable: false, configurable: false, enumerable: true })`. This prevents subsequent scripts or DevTools console commands from reassigning or deleting the property.
     4. Wrap property definitions in `try...catch` blocks to guarantee zero thrown exceptions even in restricted browser sandbox contexts.

4. **DevTools Console Watermark Banner Design**:
   - *Observation*: The prompt requires a styled DevTools console watermark banner using `console.log("%c...", "color: #e5a93b; font-weight: bold;...")` displaying name, contact info, Line ID, title, and watermark status.
   - *Inference*:
     1. Use ResolveNow's theme palette: Gold (`#e5a93b`, `#fbbf24`), Slate Navy (`#0f172a`, `#1e293b`), Emerald (`#10b981`, `#34d399`), and Blue (`#38bdf8`).
     2. Guard with `window.__RESOLVENOW_BANNER_PRINTED__` to ensure the banner prints exactly once even if scripts or pages trigger re-evaluations.
     3. Emit separate styled `console.log` lines to ensure cross-browser fidelity across Chromium (Chrome/Edge/Brave), Firefox (which resets `%c` styles on `\n`), and Safari.

5. **Complementary Docstring Updates Across `public/js/`**:
   - *Observation*: Milestone 1 standardized author docstrings across server modules (`server.js`, `utils/integrityGuard.js`, `routes/*`, `models/*`).
   - *Inference*: Updating the top docstring in `public/js/ui.js`, `public/js/app.js`, and sibling client scripts establishes uniform developer credit throughout both backend and frontend layers.

---

## 3. Caveats

1. **Client-Side DevTools Manipulation**:
   - Any client-side JavaScript property can theoretically be overridden if an attacker uses browser developer tools with breakpoints prior to script execution. Absolute startup refusal upon tampering is enforced server-side (Milestone 3); client-side scripts serve as active attribution, audit markers, and user-facing integrity signals.
2. **Pages Not Loading `ui.js`**:
   - `public/executive-dashboard.html` and `public/track.html` are standalone pages that do not load `ui.js`. `teamwork_explorer_m2_2` is formulating their layout specifications. A standalone portable snippet is included below for direct reuse in those pages.
3. **No Build Step**:
   - The project uses vanilla JS served statically by Express (`server.js:140`). Modifications must be applied directly to the source files without Babel/Webpack compilation steps.

---

## 4. Conclusion & Precise Replacement Specifications

### Specification 1: `public/js/ui.js` (Primary Integration)
- **Target File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\js\ui.js`
- **StartLine**: 1
- **EndLine**: 16
- **TargetContent**:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

/* ─────────────────────────────────────────────
   public/js/ui.js — Shared UI Helpers (Premium)
   • DOM shortcuts
   • Toast / Error display
   • Page transitions
   • Ripple effect
   • Clock
   • Status / Priority helpers
   • Image modal / Change-password modal
   ───────────────────────────────────────────── */
```
- **ReplacementContent**:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */

/* ─────────────────────────────────────────────
   public/js/ui.js — Shared UI Helpers (Premium)
   • DOM shortcuts
   • Toast / Error display
   • Page transitions
   • Ripple effect
   • Clock
   • Status / Priority helpers
   • Image modal / Change-password modal
   • Developer attribution & console watermark
   ───────────────────────────────────────────── */

/* ── Developer Attribution & System Watermark ─────────────────── */
(function initResolveNowDeveloperAttribution() {
  'use strict';
  if (typeof window === 'undefined') return;

  // 1. Immutable Developer Runtime Object
  if (!window.__RESOLVENOW_DEVELOPER__) {
    var devMetadata = {
      name: 'Chatayodom Choikhuea',
      phone: '0970543528',
      lineId: 'rapbeerteng555teng55',
      role: 'Full Stack Developer',
      watermark: 'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'
    };

    try {
      Object.defineProperty(devMetadata, 'toString', {
        value: function () { return this.watermark; },
        enumerable: false,
        writable: false,
        configurable: false
      });
    } catch (_e) {}

    try {
      Object.freeze(devMetadata);
    } catch (_e) {}

    try {
      Object.defineProperty(window, '__RESOLVENOW_DEVELOPER__', {
        value: devMetadata,
        writable: false,
        configurable: false,
        enumerable: true
      });
    } catch (_e) {
      window.__RESOLVENOW_DEVELOPER__ = devMetadata;
    }
  }

  // 2. DevTools Console Watermark Banner (printed once on initial load)
  if (typeof console !== 'undefined' && typeof console.log === 'function' && !window.__RESOLVENOW_BANNER_PRINTED__) {
    window.__RESOLVENOW_BANNER_PRINTED__ = true;

    var headerStyle = 'background: #0f172a; color: #e5a93b; font-weight: bold; font-size: 12px; padding: 5px 10px; border-radius: 4px 0 0 4px; border: 1px solid #334155;';
    var badgeStyle = 'background: #064e3b; color: #34d399; font-weight: bold; font-size: 11px; padding: 5px 10px; border-radius: 0 4px 4px 0; border: 1px solid #334155; border-left: none;';
    var labelStyle = 'color: #e5a93b; font-weight: bold; font-size: 11px; line-height: 1.6;';
    var valStyle = 'color: #f1f5f9; font-size: 11px; line-height: 1.6;';
    var highlightStyle = 'color: #38bdf8; font-weight: bold; font-size: 11px; line-height: 1.6;';
    var watermarkLabelStyle = 'color: #10b981; font-weight: bold; font-size: 11px; line-height: 1.6;';
    var watermarkValStyle = 'color: #cbd5e1; font-size: 10.5px; font-style: italic; line-height: 1.6;';

    console.log(
      '%c🏛️ ResolveNow Smart City Platform%c✔ INTEGRITY VERIFIED',
      headerStyle,
      badgeStyle
    );
    console.log('%c👨‍💻 Full Stack Developer : %cChatayodom Choikhuea', labelStyle, highlightStyle);
    console.log('%c📞 Contact / Phone     : %c0970543528', labelStyle, valStyle);
    console.log('%c💬 LINE ID             : %crapbeerteng555teng55', labelStyle, highlightStyle);
    console.log('%c🛡️ Watermark Status    : %cChatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer', watermarkLabelStyle, watermarkValStyle);
  }
})();
```

---

### Specification 2: `public/js/app.js` (App Entry Docstring)
- **Target File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\js\app.js`
- **StartLine**: 1
- **EndLine**: 5
- **TargetContent**:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```
- **ReplacementContent**:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```

---

### Specification 3: Optional Docstring Sweep for Sibling Client Scripts
To maintain 100% uniformity across all scripts in `public/js/`:
For each of:
- `public/js/admin-portal.js` (lines 1–4)
- `public/js/admin.js` (lines 1–4)
- `public/js/auth.js` (lines 1–4)
- `public/js/citizen.js` (lines 1–4)
- `public/js/directChat.js` (lines 1–4)
- `public/js/tech-portal.js` (lines 1–4)
- `public/js/technician.js` (lines 1–4)

Replace:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```
With:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```

And for `public/js/my-tickets.js` (lines 1–5):
Replace:
```javascript
/**
 * ResolveNow - Citizen My Tickets Dedicated Controller
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```
With:
```javascript
/**
 * ResolveNow - Citizen My Tickets Dedicated Controller
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```

---

### Specification 4: Standalone Portable Snippet for Portals Not Loading `ui.js`
For `public/executive-dashboard.html` and `public/track.html` (handled by `teamwork_explorer_m2_2`), the exact portable `<script>` block below can be dropped before `</body>`:

```html
<script>
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window.__RESOLVENOW_DEVELOPER__) {
    var devMetadata = {
      name: 'Chatayodom Choikhuea',
      phone: '0970543528',
      lineId: 'rapbeerteng555teng55',
      role: 'Full Stack Developer',
      watermark: 'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer'
    };
    try {
      Object.defineProperty(devMetadata, 'toString', { value: function () { return this.watermark; }, enumerable: false, writable: false, configurable: false });
      Object.freeze(devMetadata);
      Object.defineProperty(window, '__RESOLVENOW_DEVELOPER__', { value: devMetadata, writable: false, configurable: false, enumerable: true });
    } catch (_e) { window.__RESOLVENOW_DEVELOPER__ = devMetadata; }
  }
  if (typeof console !== 'undefined' && typeof console.log === 'function' && !window.__RESOLVENOW_BANNER_PRINTED__) {
    window.__RESOLVENOW_BANNER_PRINTED__ = true;
    console.log('%c🏛️ ResolveNow Smart City Platform%c✔ INTEGRITY VERIFIED', 'background: #0f172a; color: #e5a93b; font-weight: bold; font-size: 12px; padding: 5px 10px; border-radius: 4px 0 0 4px; border: 1px solid #334155;', 'background: #064e3b; color: #34d399; font-weight: bold; font-size: 11px; padding: 5px 10px; border-radius: 0 4px 4px 0; border: 1px solid #334155; border-left: none;');
    console.log('%c👨‍💻 Full Stack Developer : %cChatayodom Choikhuea', 'color: #e5a93b; font-weight: bold; font-size: 11px; line-height: 1.6;', 'color: #38bdf8; font-weight: bold; font-size: 11px; line-height: 1.6;');
    console.log('%c📞 Contact / Phone     : %c0970543528', 'color: #e5a93b; font-weight: bold; font-size: 11px; line-height: 1.6;', 'color: #f1f5f9; font-size: 11px; line-height: 1.6;');
    console.log('%c💬 LINE ID             : %crapbeerteng555teng55', 'color: #e5a93b; font-weight: bold; font-size: 11px; line-height: 1.6;', 'color: #38bdf8; font-size: 11px; line-height: 1.6;');
    console.log('%c🛡️ Watermark Status    : %cChatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer', 'color: #10b981; font-weight: bold; font-size: 11px; line-height: 1.6;', 'color: #cbd5e1; font-size: 10.5px; font-style: italic; line-height: 1.6;');
  }
})();
</script>
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Automated Baseline Verification**:
   ```pwsh
   npm test
   ```
   *Expected Outcome*: 52/52 tests pass without regressions.
2. **Node Non-Browser Safety Check**:
   ```pwsh
   node -e "require('./public/js/ui.js')"
   ```
   *Expected Outcome*: Exits cleanly with code 0; zero exceptions thrown.
3. **Runtime Object Immutability & Structure Verification**:
   ```pwsh
   node -e "global.window = {}; require('./public/js/ui.js'); const dev = window.__RESOLVENOW_DEVELOPER__; console.assert(dev.name === 'Chatayodom Choikhuea', 'name mismatch'); console.assert(dev.phone === '0970543528', 'phone mismatch'); console.assert(dev.lineId === 'rapbeerteng555teng55', 'lineId mismatch'); console.assert(dev.role === 'Full Stack Developer', 'role mismatch'); console.assert(dev.watermark === 'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer', 'watermark mismatch'); console.assert(Object.isFrozen(dev), 'object not frozen'); console.log('✔ All client runtime checks passed');"
   ```
   *Expected Outcome*: Outputs `✔ All client runtime checks passed`.
4. **Browser DevTools Console Inspection**:
   - Start application: `npm run dev` (or `node server.js`).
   - Open `http://localhost:3001/` in browser.
   - Open DevTools (F12) → Console tab.
   - Verify styled colored banner appears with developer name, phone, Line ID, title, and verified watermark.
   - Type `window.__RESOLVENOW_DEVELOPER__` and verify returned object matches specification.

### 5.2 Invalidation Conditions
- Any runtime error or warning logged to the browser console upon page load.
- Any exception when `public/js/ui.js` is loaded or evaluated in a non-browser environment where `window` is undefined.
- Any property in `window.__RESOLVENOW_DEVELOPER__` that can be modified or overwritten.
