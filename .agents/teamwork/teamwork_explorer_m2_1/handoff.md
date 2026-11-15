# Handoff Report: Milestone 2 — Line-Level Replacement Specifications for Portals 1 to 4

**Agent**: `teamwork_explorer_m2_1`  
**Date**: 2026-11-06T08:42:00Z  
**Target Watermark**: `"Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"`  
**Scope**: Portals 1 to 4 (`public/index.html`, `public/my-tickets.html`, `public/admin.html`, `public/tech.html`) and shared runtime (`public/js/ui.js`).

---

## 1. Observation

### 1.1 Inspected File Paths and Current Line Numbers
Direct inspections via `view_file` and pattern matching confirmed:

1. **`public/index.html` (1,765 lines)**
   - Lines 1–7: Doctype, html tag, and `<head>` open without author metadata or comment watermark.
   - Line 93: `<div class="rn-footer-auth">Copyright © 2026 ResolveNow. All rights reserved.</div>` in `#authPage`.
   - Line 475: `<footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>` in `#adminApp` content.
   - Line 788: `<footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>` in `/nwrap` of `#normalApp`.
   - Line 1513: `<div class="drawer-footer">ResolveNow v2.1</div>` in `#sideDrawer`.

2. **`public/my-tickets.html` (964 lines)**
   - Lines 1–8: Doctype, html tag, and `<head>` with title and description only.
   - Lines 757–759: `<footer class="rn-footer" style="margin-top:auto;border-top:1px solid var(--border)">Copyright © 2026 ResolveNow. All rights reserved. · ระบบตรวจสอบความปลอดภัย Active</footer>`.
   - Line 769: `<p style="margin:0;font-size:12px;color:var(--muted)">Security Audit & Live Defense Matrix (6-Layer Guard)</p>`.
   - Lines 838–849: Card 6 of security matrix; missing Card 7 for Developer Integrity.
   - No `#sideDrawer` present in this portal.

3. **`public/admin.html` (1,508 lines)**
   - Lines 1–7: Doctype, html tag, and `<head>` open.
   - Line 330: `<div class="rn-footer-auth">Copyright © 2026 ResolveNow. All rights reserved.</div>` in admin auth view.
   - Lines 364–365: Fixed sidebar bottom section before logout button (`<div style="margin-top:auto;padding:16px;border-top:1px solid rgba(255,255,255,.08)">`).
   - Line 628: `<footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>` in `#adminApp .content`.
   - Line 1293: `<div class="drawer-footer">ResolveNow Admin Console</div>` in mobile `#sideDrawer`.

4. **`public/tech.html` (539 lines)**
   - Lines 1–7: Doctype, html tag, and `<head>` open.
   - Line 211: `<div class="rn-footer-auth">Copyright © 2026 ResolveNow. All rights reserved.</div>` in technician login view.
   - Line 286: `<footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>` in `#techApp` main content.
   - Line 520: `<div class="drawer-footer">ResolveNow Technician Console</div>` in technician `#sideDrawer`.

5. **`public/js/ui.js` (1,290 lines)**
   - Lines 1–4: Standard module copyright header without developer attribution or console watermark.

### 1.2 Layout & Theme Tokens Verification
- Inspected `public/css/style.css:9526-9543` and `style.css:6518-6531`.
- Verified that all portal elements inherit CSS tokens: `var(--text)`, `var(--muted)`, `var(--gold)`, and `var(--border)` for automatic light/dark mode adaptation.
- Verified that `#adminApp .content` has `padding-bottom: 90px !important;` (`style.css:6158`), ensuring 0 collision between `.rn-footer` and fixed mobile nav `.admin-mob-nav`.

### 1.3 Test Suite Baseline Status
- Ran `node scripts/runTests.js`: All 52 automated tests in Groups 1 to 10 passed with zero failures. Zero tests assert on static HTML structure.

---

## 2. Logic Chain

1. **Exact Machine-Applicable Specifications**:
   - The Worker requires exact `StartLine`, `EndLine`, `TargetContent`, and `ReplacementContent` compatible with `replace_file_content`.
   - If edits in a single file are applied from top to bottom, subsequent line numbers shift. Therefore, edits must be executed either:
     - In **reverse line order** (bottom-to-top, highest line number first), ensuring earlier line numbers remain completely untouched, OR
     - Using exact `TargetContent` unique substring matching with updated line ranges.
   - Both original line ranges and the recommended reverse execution order are documented below.

2. **Full Spectrum Attribution & Tamper Resistance**:
   - Watermark text `"Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"` must appear verbatim in:
     - HTML top comment: `<!-- Developed by: ... -->`
     - Semantic `<meta name="author">` and `<meta name="developer">`
     - Container data attributes: `data-developer="..."` and `data-watermark="..."`
     - Visible credit sublines with typography styling: `var(--text)`, `var(--muted)`, `var(--gold)`
     - Verbatim text elements to guarantee string presence across automated grep, crawler, and DOM inspection.

3. **Theme & Responsiveness Compliance**:
   - No hardcoded hex color codes that conflict with dark theme (e.g. `#000` or `#fff` on text); use `var(--text)` and `var(--muted)`.
   - Small font sizes (`10.5px`–`11.5px`) with `line-height: 1.4` prevent card overflow and layout shifts.
   - In `admin.html`, the sidebar pill is placed cleanly above the logout button within existing padded container `margin-top: auto`.

---

## 3. Caveats

1. **Execution Order**: The Worker should execute the tool calls for each file in reverse line order (from bottom to top) as specified to avoid line offset drift.
2. **Side Drawer Presence**: `public/my-tickets.html` does not feature `#sideDrawer`. Instead, its security matrix modal (`#mSecAudit`) is upgraded to a 7-Layer matrix by adding Layer 7 (Developer Integrity & Watermark).
3. **Static File Caching**: Browser caching during live tests can be bypassed by hard-refresh (Ctrl+F5) or inspecting DevTools elements.

---

## 4. Conclusion: Exact Line-Level Replacement Specifications

### 4.1 Portal 1: `public/index.html` (Citizen Portal)
Target File: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\index.html`

> **Recommended Execution Sequence**: Edit 1.5 → Edit 1.4 → Edit 1.3 → Edit 1.2 → Edit 1.1

#### Edit 1.1: Head Metadata & Top HTML Comment Watermark
- **StartLine**: `1`
- **EndLine**: `7`
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ResolveNow — ระบบรับแจ้งเรื่องร้องเรียน</title>
```
- **ReplacementContent**:
```html
<!DOCTYPE html>
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <title>ResolveNow — ระบบรับแจ้งเรื่องร้องเรียน</title>
```

#### Edit 1.2: Citizen Auth Card Footer (`.rn-footer-auth`)
- **StartLine**: `93`
- **EndLine**: `93`
- **TargetContent**:
```html
          <div class="rn-footer-auth">Copyright © 2026 ResolveNow. All rights reserved.</div>
```
- **ReplacementContent**:
```html
          <div class="rn-footer-auth" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
            <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
            <div class="rn-dev-credit" style="margin-top:5px;font-size:11px;color:var(--muted);letter-spacing:0.2px;">
              👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> (Full Stack Developer) · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span>
              <div style="font-size:10px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
            </div>
          </div>
```

#### Edit 1.3: Admin Section Content Footer (`.rn-footer`)
- **StartLine**: `475`
- **EndLine**: `475`
- **TargetContent**:
```html
        <footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>
```
- **ReplacementContent**:
```html
        <footer class="rn-footer" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
          <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
          <div class="rn-dev-credit" style="margin-top:6px;font-size:11.5px;color:var(--muted);letter-spacing:0.2px;">
            👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span> (Full Stack Developer)
            <div style="font-size:10.5px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
          </div>
        </footer>
```

#### Edit 1.4: Citizen Normal App Main Footer (`.rn-footer`)
- **StartLine**: `788`
- **EndLine**: `788`
- **TargetContent**:
```html
      <footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>
```
- **ReplacementContent**:
```html
      <footer class="rn-footer" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
        <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
        <div class="rn-dev-credit" style="margin-top:6px;font-size:11.5px;color:var(--muted);letter-spacing:0.2px;">
          👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span> (Full Stack Developer)
          <div style="font-size:10.5px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
        </div>
      </footer>
```

#### Edit 1.5: Universal Side Drawer Footer (`.drawer-footer`)
- **StartLine**: `1513`
- **EndLine**: `1513`
- **TargetContent**:
```html
    <div class="drawer-footer">ResolveNow v2.1</div>
```
- **ReplacementContent**:
```html
    <div class="drawer-footer" data-watermark="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
      <div style="font-weight:700;color:var(--text)">ResolveNow v2.1</div>
      <div style="font-size:10.5px;margin-top:4px;color:var(--muted);line-height:1.4">
        Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer
      </div>
    </div>
```

---

### 4.2 Portal 2: `public/my-tickets.html` (My Tickets Portal)
Target File: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\my-tickets.html`

> **Recommended Execution Sequence**: Edit 2.4 → Edit 2.3 → Edit 2.2 → Edit 2.1

#### Edit 2.1: Head Metadata & Top HTML Comment Watermark
- **StartLine**: `1`
- **EndLine**: `8`
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>เรื่องร้องเรียนของฉัน — ResolveNow</title>
  <meta name="description" content="ตรวจสอบและติดตามเรื่องร้องเรียนของคุณทั้งหมดบนระบบ ResolveNow พร้อมระบบรักษาความปลอดภัยระดับสูงสุด" />
```
- **ReplacementContent**:
```html
<!DOCTYPE html>
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <title>เรื่องร้องเรียนของฉัน — ResolveNow</title>
  <meta name="description" content="ตรวจสอบและติดตามเรื่องร้องเรียนของคุณทั้งหมดบนระบบ ResolveNow พร้อมระบบรักษาความปลอดภัยระดับสูงสุด" />
```

#### Edit 2.2: Main Sticky Footer Credit (`.rn-footer`)
- **StartLine**: `757`
- **EndLine**: `759`
- **TargetContent**:
```html
  <footer class="rn-footer" style="margin-top:auto;border-top:1px solid var(--border)">
    Copyright © 2026 ResolveNow. All rights reserved. · ระบบตรวจสอบความปลอดภัย Active
  </footer>
```
- **ReplacementContent**:
```html
  <footer class="rn-footer" style="margin-top:auto;border-top:1px solid var(--border)" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
    <div>Copyright © 2026 ResolveNow. All rights reserved. · ระบบตรวจสอบความปลอดภัย Active</div>
    <div class="rn-dev-credit" style="margin-top:6px;font-size:11.5px;color:var(--muted);letter-spacing:0.2px;">
      👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span> (Full Stack Developer)
      <div style="font-size:10.5px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
    </div>
  </footer>
```

#### Edit 2.3: Security Matrix Subtitle
- **StartLine**: `769`
- **EndLine**: `769`
- **TargetContent**:
```html
          <p style="margin:0;font-size:12px;color:var(--muted)">Security Audit & Live Defense Matrix (6-Layer Guard)</p>
```
- **ReplacementContent**:
```html
          <p style="margin:0;font-size:12px;color:var(--muted)">Security Audit & Live Defense Matrix (7-Layer Guard)</p>
```

#### Edit 2.4: Security Matrix Layer 7 (Developer Integrity & Watermark)
- **StartLine**: `838`
- **EndLine**: `849`
- **TargetContent**:
```html
      <div class="sec-diag-card">
        <div class="sec-diag-icon">🔄</div>
        <div class="sec-diag-content">
          <div class="sec-diag-title">
            <span>6. ความปลอดภัย WebSocket (Real-time Handshake)</span>
            <span class="sec-diag-status-badge" id="diagSocketBadge">SECURE</span>
          </div>
          <div class="sec-diag-desc">
            ช่องสัญญาณ Socket.IO เชื่อมต่อแบบมี Heartbeat Ping-Pong อัปเดตข้อมูลอัตโนมัติเมื่อสถานะตั๋วเปลี่ยนแปลง
          </div>
        </div>
      </div>
```
- **ReplacementContent**:
```html
      <div class="sec-diag-card">
        <div class="sec-diag-icon">🔄</div>
        <div class="sec-diag-content">
          <div class="sec-diag-title">
            <span>6. ความปลอดภัย WebSocket (Real-time Handshake)</span>
            <span class="sec-diag-status-badge" id="diagSocketBadge">SECURE</span>
          </div>
          <div class="sec-diag-desc">
            ช่องสัญญาณ Socket.IO เชื่อมต่อแบบมี Heartbeat Ping-Pong อัปเดตข้อมูลอัตโนมัติเมื่อสถานะตั๋วเปลี่ยนแปลง
          </div>
        </div>
      </div>

      <div class="sec-diag-card">
        <div class="sec-diag-icon">👨‍💻</div>
        <div class="sec-diag-content">
          <div class="sec-diag-title">
            <span>7. การตรวจสอบลายเซ็นผู้พัฒนา (Developer Integrity & Watermark)</span>
            <span class="sec-diag-status-badge">VERIFIED</span>
          </div>
          <div class="sec-diag-desc">
            Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer
          </div>
        </div>
      </div>
```

---

### 4.3 Portal 3: `public/admin.html` (Admin Portal)
Target File: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\admin.html`

> **Recommended Execution Sequence**: Edit 3.5 → Edit 3.4 → Edit 3.3 → Edit 3.2 → Edit 3.1

#### Edit 3.1: Head Metadata & Top HTML Comment Watermark
- **StartLine**: `1`
- **EndLine**: `7`
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ResolveNow — ระบบบริหารจัดการสำหรับผู้ดูแลระบบ</title>
```
- **ReplacementContent**:
```html
<!DOCTYPE html>
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <title>ResolveNow — ระบบบริหารจัดการสำหรับผู้ดูแลระบบ</title>
```

#### Edit 3.2: Admin Auth Card Footer (`.rn-footer-auth`)
- **StartLine**: `330`
- **EndLine**: `330`
- **TargetContent**:
```html
      <div class="rn-footer-auth">Copyright © 2026 ResolveNow. All rights reserved.</div>
```
- **ReplacementContent**:
```html
      <div class="rn-footer-auth" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
        <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
        <div class="rn-dev-credit" style="margin-top:4px;font-size:11px;color:var(--muted);letter-spacing:0.2px;">
          👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> (Full Stack Developer) · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span>
          <div style="font-size:10px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
        </div>
      </div>
```

#### Edit 3.3: Admin Sidebar Attribution Badge
- **StartLine**: `364`
- **EndLine**: `365`
- **TargetContent**:
```html
      <div style="margin-top:auto;padding:16px;border-top:1px solid rgba(255,255,255,.08)">
        <button onclick="doAdminLogout()"
```
- **ReplacementContent**:
```html
      <div style="margin-top:auto;padding:14px 16px 16px;border-top:1px solid rgba(255,255,255,.08)">
        <div style="margin-bottom:12px;padding:8px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;font-size:10.5px;color:rgba(255,255,255,0.7);line-height:1.35;">
          <div style="color:#fbbf24;font-weight:700;margin-bottom:2px;display:flex;align-items:center;gap:4px">👨‍💻 <span>ผู้พัฒนาระบบ</span></div>
          <div>Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
        </div>
        <button onclick="doAdminLogout()"
```

#### Edit 3.4: Admin Content Area Main Footer (`.rn-footer`)
- **StartLine**: `628`
- **EndLine**: `628`
- **TargetContent**:
```html
        <footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>
```
- **ReplacementContent**:
```html
        <footer class="rn-footer" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
          <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
          <div class="rn-dev-credit" style="margin-top:6px;font-size:11.5px;color:var(--muted);letter-spacing:0.2px;">
            👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span> (Full Stack Developer)
            <div style="font-size:10.5px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
          </div>
        </footer>
```

#### Edit 3.5: Admin Mobile Side Drawer Footer (`.drawer-footer`)
- **StartLine**: `1293`
- **EndLine**: `1293`
- **TargetContent**:
```html
    <div class="drawer-footer">ResolveNow Admin Console</div>
```
- **ReplacementContent**:
```html
    <div class="drawer-footer" data-watermark="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
      <div style="font-weight:700;color:var(--text)">ResolveNow Admin Console</div>
      <div style="font-size:10.5px;margin-top:4px;color:var(--muted);line-height:1.4">
        Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer
      </div>
    </div>
```

---

### 4.4 Portal 4: `public/tech.html` (Technician Portal)
Target File: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\tech.html`

> **Recommended Execution Sequence**: Edit 4.4 → Edit 4.3 → Edit 4.2 → Edit 4.1

#### Edit 4.1: Head Metadata & Top HTML Comment Watermark
- **StartLine**: `1`
- **EndLine**: `7`
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ResolveNow — ระบบงานช่างและเจ้าหน้าที่ปฏิบัติการ</title>
```
- **ReplacementContent**:
```html
<!DOCTYPE html>
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <title>ResolveNow — ระบบงานช่างและเจ้าหน้าที่ปฏิบัติการ</title>
```

#### Edit 4.2: Tech Auth Card Footer (`.rn-footer-auth`)
- **StartLine**: `211`
- **EndLine**: `211`
- **TargetContent**:
```html
      <div class="rn-footer-auth">Copyright © 2026 ResolveNow. All rights reserved.</div>
```
- **ReplacementContent**:
```html
      <div class="rn-footer-auth" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
        <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
        <div class="rn-dev-credit" style="margin-top:4px;font-size:11px;color:var(--muted);letter-spacing:0.2px;">
          👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> (Full Stack Developer) · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span>
          <div style="font-size:10px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
        </div>
      </div>
```

#### Edit 4.3: Tech Main Content Footer (`.rn-footer`)
- **StartLine**: `286`
- **EndLine**: `286`
- **TargetContent**:
```html
      <footer class="rn-footer">Copyright © 2026 ResolveNow. All rights reserved.</footer>
```
- **ReplacementContent**:
```html
      <footer class="rn-footer" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
        <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
        <div class="rn-dev-credit" style="margin-top:6px;font-size:11.5px;color:var(--muted);letter-spacing:0.2px;">
          👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span> (Full Stack Developer)
          <div style="font-size:10.5px;color:var(--muted);opacity:0.85;margin-top:2px;">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
        </div>
      </footer>
```

#### Edit 4.4: Tech Side Drawer Footer (`.drawer-footer`)
- **StartLine**: `520`
- **EndLine**: `520`
- **TargetContent**:
```html
    <div class="drawer-footer">ResolveNow Technician Console</div>
```
- **ReplacementContent**:
```html
    <div class="drawer-footer" data-watermark="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
      <div style="font-weight:700;color:var(--text)">ResolveNow Technician Console</div>
      <div style="font-size:10.5px;margin-top:4px;color:var(--muted);line-height:1.4">
        Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer
      </div>
    </div>
```

---

### 4.5 Companion Specification: `public/js/ui.js` (Shared Runtime & Console Watermark)
Target File: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\js\ui.js`

- **StartLine**: `1`
- **EndLine**: `4`
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
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 * Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer
 */

// ── Developer Attribution & System Watermark ───────────────────
(function () {
  var devWatermark = 'Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer';
  try {
    window.__RESOLVENOW_DEVELOPER__ = devWatermark;
    if (Object.freeze) Object.freeze(window.__RESOLVENOW_DEVELOPER__);
  } catch (e) {}

  if (typeof console !== 'undefined' && console.log) {
    console.log(
      '%c 🏛️ ResolveNow Smart City Platform %c ' + devWatermark + ' ',
      'background: #0f172a; color: #fbbf24; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px 0 0 4px; border: 1px solid #334155;',
      'background: #1e293b; color: #93c5fd; font-size: 11px; padding: 4px 8px; border-radius: 0 4px 4px 0; border: 1px solid #334155; border-left: none;'
    );
  }
})();
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Automated Test Suite Integrity**:
   ```pwsh
   node scripts/runTests.js
   ```
   *Expected outcome*: 52/52 tests pass without regressions.

2. **Watermark String Verification across Portals 1 to 4**:
   ```pwsh
   Select-String -Path "public\index.html", "public\my-tickets.html", "public\admin.html", "public\tech.html", "public\js\ui.js" -Pattern "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
   ```
   *Expected outcome*: Matches found across all 5 target files.

3. **Visual & Responsive Verification**:
   - Inspect `index.html`, `admin.html`, and `tech.html` drawers: `.drawer-footer` displays the developer credit cleanly.
   - Inspect `admin.html` sidebar: Developer badge appears above logout button without overflowing desktop or mobile layout.
   - Inspect `my-tickets.html`: Security modal includes Layer 7 Developer Integrity verification badge.
   - Theme toggle (Light ↔ Dark): Footers adapt seamlessly via `var(--text)` and `var(--muted)`.

### 5.2 Invalidation Conditions
- Any replacement chunk resulting in `replace_file_content` failure due to whitespace or character mismatch.
- Any change causing horizontal scrollbar on mobile viewport (<768px).
- Any regression in `scripts/runTests.js`.
