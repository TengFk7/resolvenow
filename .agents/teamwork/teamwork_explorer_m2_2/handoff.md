# Handoff Report: Milestone 2 Client Portals (5–7 + Supplemental) Specifications

**Agent**: `teamwork_explorer_m2_2`  
**Working Directory**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m2_2`  
**Target Milestone**: Milestone 2 (Client Portals Developer Attribution & UI)  
**Assigned Scope**: Portals 5–7 and supplemental pages:
1. `public/executive-dashboard.html` (CEO Dashboard)
2. `public/track.html` (Public Tracker)
3. `public/project-poster.html` (Project Poster)
4. `public/liff-rating.html` (LINE LIFF Rating)
5. `data_dictionary.html` (Data Dictionary, served via `/Datadic`)

**Target Watermark String**:
`Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer`

---

## 1. Observation

### 1.1 Target File Discovery & Paths
Through directory inspection and server route analysis:
- `public/executive-dashboard.html`: 2,723 lines. Served statically via `/ceo` (with gate unlock modal).
- `public/track.html`: 1,796 lines. Served statically via `/track`.
- `public/project-poster.html`: 1,191 lines. Served statically via `/project` (strict A5 landscape print container: 210mm × 148mm, with 16mm `.poster-footer`).
- `public/liff-rating.html`: 854 lines. Served statically via `/liff-rating`.
- `data_dictionary.html`: 1,946 lines. Located at the workspace root `c:\Users\TENG\OneDrive\Desktop\ResolveNow\data_dictionary.html` and served dynamically by `server.js:288` and `server.js:331` on the protected route `GET /Datadic`. (Note: The prompt references `public/data_dictionary.html` as shorthand; no file exists under `public/data_dictionary.html`, the canonical file is `data_dictionary.html` at the project root).

### 1.2 Existing Structure in Target Files

1. **`public/executive-dashboard.html`**:
   - `<head>` begins at line 4:
     ```html
     4: <head>
     5:   <meta charset="UTF-8" />
     6:   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     7:   <title>Executive Dashboard — ResolveNow</title>
     8:   <meta name="description" content="ResolveNow Executive Dashboard — ภาพรวมสำหรับผู้บริหาร">
     ```
   - Sidebar tools menu ends at lines 1517–1520:
     ```html
     1517:     </nav>
     1518: 
     1519: 
     1520:   </aside>
     ```
     CSS `.sidebar` (line 81) uses `display: flex; flex-direction: column; min-height: 100vh; position: fixed;`.
   - Main content footer is located at line 1832:
     ```html
     1832:       <footer style="text-align: center; padding: 28px 16px 8px; font-size: 12px; color: var(--text-muted); user-select: none;">Copyright © 2026 ResolveNow. All rights reserved.</footer>
     ```

2. **`public/track.html`**:
   - `<head>` begins at line 4:
     ```html
     4: <head>
     5:   <meta charset="UTF-8" />
     6:   <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
     7:   <title>ติดตามสถานะ — ResolveNow</title>
     8:   <meta name="description" content="ตรวจสอบสถานะเรื่องร้องเรียนของคุณ ด้วยรหัสอ้างอิง Ticket ID บนระบบ ResolveNow" />
     ```
   - Footer is located at line 1416:
     ```html
     1416:     <footer class="rn-footer-track">Copyright © 2026 ResolveNow. All rights reserved.</footer>
     ```
     Styled in lines 1193–1201 with dark space aesthetic (`color: rgba(255, 255, 255, .45)`).

3. **`public/project-poster.html`**:
   - `<head>` begins at line 4:
     ```html
     4: <head>
     5:   <meta charset="UTF-8" />
     6:   <meta name="viewport" content="width=device-width,initial-scale=1.0" />
     7:   <title>ResolveNow — AI-Powered Smart City Complaint Platform</title>
     8:   <meta name="description" content="โปสเตอร์นำเสนอโครงการ ResolveNow ระบบรับแจ้งเรื่องร้องเรียนเมืองอัจฉริยะ ขับเคลื่อนด้วย AI ขนาด A5 แนวนอน" />
     ```
   - Zone 5 footer meta is located at lines 1176–1179:
     ```html
     1176:       <div class="footer-right">
     1177:         <div class="footer-url">resolvenow-hlv5.onrender.com</div>
     1178:         <div class="footer-meta">© 2026 ResolveNow · Open Smart City Platform</div>
     1179:       </div>
     ```
     CSS `.poster-footer` (line 708) has fixed `height: 16mm; flex-shrink: 0; box-sizing: border-box; overflow: hidden;`.

4. **`public/liff-rating.html`**:
   - `<head>` begins at line 3:
     ```html
     3: <head>
     4:   <meta charset="UTF-8" />
     5:   <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
     6:   <title>ประเมินบริการ — ResolveNow</title>
     7:   <meta name="description" content="ประเมินความพึงพอใจสำหรับการแก้ไขเรื่องร้องเรียน" />
     ```
   - Footer is located at line 567:
     ```html
     567:     <footer class="rn-footer-liff">Copyright © 2026 ResolveNow. All rights reserved.</footer>
     ```

5. **`data_dictionary.html`**:
   - `<head>` begins at line 4:
     ```html
     4: <head>
     5:   <meta charset="UTF-8" />
     6:   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     7:   <title>Data Dictionary — ระบบ ResolvNow</title>
     ```
   - Footer is located at lines 1936–1941:
     ```html
     1936:     <div class="footer">
     1937:       <strong>ResolveNow Data Dictionary</strong> — ระบบรับแจ้งเรื่องร้องเรียน<br />
     1938:       MongoDB Atlas · Mongoose 9 · Node.js + Express 4 · Deploy on: Render.com<br />
     1939:       จัดทำ: 15/04/2569 | อัปเดต: 30/09/2569 | ครอบคลุม 7 collections, 85+ fields (Version: V19.2)<br />
     1940:       Copyright © 2026 ResolveNow. All rights reserved.
     1941:     </div>
     ```

### 1.3 Baseline Automated Test Verification
Ran `npm test` via PowerShell:
```
=== ResolveNow Automated System Verification ===
[Group 1: SLA Engine & Breach Detection] (9 tests passed)
[Group 2: Geo Calculations & Duplicate Detection] (3 tests passed)
[Group 3: Security & XSS Sanitization] (4 tests passed)
[Group 4: PDPA & Privacy Protection] (1 test passed)
[Group 5: Financial & Budget Aggregations] (2 tests passed)
[Group 6: Database Model Schemas & Indexes] (4 tests passed)
[Group 7: Cognitive Thai NLP Heuristics Engine & AI Fallback] (5 tests passed)
[Group 8: AI Auto-Categorization & Smart Fallback Dispatcher] (4 tests passed)
[Group 9: Anti-Spam, Prank Detection & Citizen Strike Engine] (12 tests passed)
[Group 10: LINE Bot Citizen Support AI & PDPA Guardrails] (8 tests passed)
Total: 52, Passed: 52, Failed: 0
✔ All verification tests passed successfully! System is in ideal operating health.
```
Zero existing tests inspect client-side markup or `.html` files directly.

---

## 2. Logic Chain

1. **Dual Attribution Requirement**:
   - *Requirement*: The system demands both human-readable developer credit and exact, machine-verifiable anti-tamper watermark strings.
   - *Design*: Every target portal will receive:
     1. Top HTML comment: `<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->`.
     2. Semantic `<head>` tags: `<meta name="author" ...>` and `<meta name="developer" ...>`.
     3. Machine-verifiable DOM attributes: `data-developer="..."` or `data-watermark="..."`.
     4. Visually styled credit inheriting portal-specific CSS tokens (`--text-muted`, `--gold`, etc.).
     5. Verbatim hidden text span `<span style="display:none">...</span>` ensuring exact matching by DOM scanners without disrupting layout.

2. **Layout & Print Constraints in `project-poster.html`**:
   - *Observation*: `project-poster.html` uses an A5 fixed container (210mm × 148mm) with `overflow: hidden;` and fixed 16mm footer height. Inserting a multi-line block element in Zone 5 would trigger overflow or push elements onto a second printed page.
   - *Solution*: Embed the attribution directly inside the existing `.footer-meta` element inline, accompanied by `data-developer` attribute and hidden exact span.

3. **Sidebar Pinning in `executive-dashboard.html`**:
   - *Observation*: Aside element `#sidebar` is flex column (`display: flex; flex-direction: column; min-height: 100vh; position: fixed;`).
   - *Solution*: Inserting a pill container with `margin-top: auto` right before `</aside>` pins the System Architecture & Developer attribution cleanly to the bottom of the CEO navigation bar without obscuring any navigation items.

4. **Dark/Light Contrast Compatibility**:
   - In `track.html` and `liff-rating.html`, theme tokens (`var(--text)`, `var(--muted)`, `rgba(255,255,255,...)`) are used to ensure the credit is crisp and readable against dark navy gradients without hardcoded clashing colors.

---

## 3. Caveats

1. **File Path for `data_dictionary.html`**:
   - The dispatch message specifies `public/data_dictionary.html`. However, the actual file is at the root: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\data_dictionary.html`. `server.js` serves this exact file directly via `res.sendFile(path.join(__dirname, 'data_dictionary.html'))`. The specification below targets this canonical root file.
2. **Worker Tooling Rules**:
   - The Worker must use `replace_file_content` with exact matching characters (including exact indentation and whitespace).
3. **No Dynamic Templating**:
   - ResolveNow uses vanilla HTML/JS without SSR templates; each portal requires its own contiguous replacement block.

---

## 4. Conclusion & Line-Level Replacement Specifications

The Worker (`teamwork_worker_m2_1` or equivalent) can execute these exact, drop-in replacement specifications.

### 4.1 Target File 1: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\executive-dashboard.html`

#### Operation 1.1: Top Comment & Semantic `<meta>` Tags
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\executive-dashboard.html`
- **StartLine**: 1
- **EndLine**: 9
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Executive Dashboard — ResolveNow</title>
  <meta name="description" content="ResolveNow Executive Dashboard — ภาพรวมสำหรับผู้บริหาร">
```
- **ReplacementContent**:
```html
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Executive Dashboard — ResolveNow</title>
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="description" content="ResolveNow Executive Dashboard — ภาพรวมสำหรับผู้บริหาร">
```

#### Operation 1.2: Sidebar System Architecture Badge
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\executive-dashboard.html`
- **StartLine**: 1517
- **EndLine**: 1520
- **TargetContent**:
```html
    </nav>


  </aside>
```
- **ReplacementContent**:
```html
    </nav>

    <!-- Developer Attribution & System Architecture Badge -->
    <div style="margin-top:auto; padding:14px; background:rgba(255,255,255,0.03); border-top:1px solid rgba(255,255,255,0.08); font-size:11px; color:var(--text-muted); line-height:1.4;" data-watermark="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
      <div style="font-weight:700; color:#fbbf24; margin-bottom:2px;">🏛️ System Architecture</div>
      <div style="font-size:10.5px; color:rgba(255,255,255,0.75);">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</div>
    </div>
  </aside>
```

#### Operation 1.3: Main Content Area Footer Credit
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\executive-dashboard.html`
- **StartLine**: 1832
- **EndLine**: 1832
- **TargetContent**:
```html
      <footer style="text-align: center; padding: 28px 16px 8px; font-size: 12px; color: var(--text-muted); user-select: none;">Copyright © 2026 ResolveNow. All rights reserved.</footer>
```
- **ReplacementContent**:
```html
      <footer style="text-align: center; padding: 28px 16px 8px; font-size: 12px; color: var(--text-muted); user-select: none;" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
        <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
        <div style="margin-top:6px;font-size:11.5px;color:var(--text-muted);letter-spacing:0.2px;">
          👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text-dark)">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:#f59e0b">rapbeerteng555teng55</span> (Full Stack Developer)
          <span style="display:none">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</span>
        </div>
      </footer>
```

---

### 4.2 Target File 2: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\track.html`

#### Operation 2.1: Top Comment & Semantic `<meta>` Tags
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\track.html`
- **StartLine**: 1
- **EndLine**: 9
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ติดตามสถานะ — ResolveNow</title>
  <meta name="description" content="ตรวจสอบสถานะเรื่องร้องเรียนของคุณ ด้วยรหัสอ้างอิง Ticket ID บนระบบ ResolveNow" />
```
- **ReplacementContent**:
```html
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ติดตามสถานะ — ResolveNow</title>
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="description" content="ตรวจสอบสถานะเรื่องร้องเรียนของคุณ ด้วยรหัสอ้างอิง Ticket ID บนระบบ ResolveNow" />
```

#### Operation 2.2: Track Portal Footer Credit
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\track.html`
- **StartLine**: 1416
- **EndLine**: 1416
- **TargetContent**:
```html
    <footer class="rn-footer-track">Copyright © 2026 ResolveNow. All rights reserved.</footer>
```
- **ReplacementContent**:
```html
    <footer class="rn-footer-track" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
      <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
      <div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,.55);letter-spacing:0.2px;">
        👨‍💻 พัฒนาโดย <span style="font-weight:600;color:#ffffff">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold2,#fbbf24)">rapbeerteng555teng55</span> (Full Stack Developer)
        <span style="display:none">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</span>
      </div>
    </footer>
```

---

### 4.3 Target File 3: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\project-poster.html`

#### Operation 3.1: Top Comment & Semantic `<meta>` Tags
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\project-poster.html`
- **StartLine**: 1
- **EndLine**: 9
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>ResolveNow — AI-Powered Smart City Complaint Platform</title>
  <meta name="description" content="โปสเตอร์นำเสนอโครงการ ResolveNow ระบบรับแจ้งเรื่องร้องเรียนเมืองอัจฉริยะ ขับเคลื่อนด้วย AI ขนาด A5 แนวนอน" />
```
- **ReplacementContent**:
```html
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>ResolveNow — AI-Powered Smart City Complaint Platform</title>
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="description" content="โปสเตอร์นำเสนอโครงการ ResolveNow ระบบรับแจ้งเรื่องร้องเรียนเมืองอัจฉริยะ ขับเคลื่อนด้วย AI ขนาด A5 แนวนอน" />
```

#### Operation 3.2: Zone 5 Poster Footer Meta
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\project-poster.html`
- **StartLine**: 1178
- **EndLine**: 1178
- **TargetContent**:
```html
        <div class="footer-meta">© 2026 ResolveNow · Open Smart City Platform</div>
```
- **ReplacementContent**:
```html
        <div class="footer-meta" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">© 2026 ResolveNow · Dev: Chatayodom Choikhuea (Full Stack Developer)<span style="display:none">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</span></div>
```

---

### 4.4 Target File 4: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\liff-rating.html`

#### Operation 4.1: Top Comment & Semantic `<meta>` Tags
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\liff-rating.html`
- **StartLine**: 1
- **EndLine**: 8
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ประเมินบริการ — ResolveNow</title>
  <meta name="description" content="ประเมินความพึงพอใจสำหรับการแก้ไขเรื่องร้องเรียน" />
```
- **ReplacementContent**:
```html
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>ประเมินบริการ — ResolveNow</title>
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="description" content="ประเมินความพึงพอใจสำหรับการแก้ไขเรื่องร้องเรียน" />
```

#### Operation 4.2: LIFF Rating Footer Credit
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\public\liff-rating.html`
- **StartLine**: 567
- **EndLine**: 567
- **TargetContent**:
```html
    <footer class="rn-footer-liff">Copyright © 2026 ResolveNow. All rights reserved.</footer>
```
- **ReplacementContent**:
```html
    <footer class="rn-footer-liff" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
      <div>Copyright © 2026 ResolveNow. All rights reserved.</div>
      <div style="margin-top:6px;font-size:11px;color:var(--muted);letter-spacing:0.2px;">
        👨‍💻 พัฒนาโดย <span style="font-weight:600;color:var(--text)">Chatayodom Choikhuea</span> · โทร 0970543528 · LINE: <span style="font-weight:600;color:var(--gold)">rapbeerteng555teng55</span> (Full Stack Developer)
        <span style="display:none">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</span>
      </div>
    </footer>
```

---

### 4.5 Target File 5: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\data_dictionary.html`

#### Operation 5.1: Top Comment & Semantic `<meta>` Tags
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\data_dictionary.html`
- **StartLine**: 1
- **EndLine**: 8
- **TargetContent**:
```html
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Dictionary — ระบบ ResolvNow</title>
```
- **ReplacementContent**:
```html
<!-- Developed by: Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer -->
<!DOCTYPE html>
<html lang="th">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Dictionary — ระบบ ResolvNow</title>
  <meta name="author" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
  <meta name="developer" content="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" />
```

#### Operation 5.2: Data Dictionary Footer Credit
- **TargetFile**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\data_dictionary.html`
- **StartLine**: 1936
- **EndLine**: 1941
- **TargetContent**:
```html
    <div class="footer">
      <strong>ResolveNow Data Dictionary</strong> — ระบบรับแจ้งเรื่องร้องเรียน<br />
      MongoDB Atlas · Mongoose 9 · Node.js + Express 4 · Deploy on: Render.com<br />
      จัดทำ: 15/04/2569 | อัปเดต: 30/09/2569 | ครอบคลุม 7 collections, 85+ fields (Version: V19.2)<br />
      Copyright © 2026 ResolveNow. All rights reserved.
    </div>
```
- **ReplacementContent**:
```html
    <div class="footer" data-developer="Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer">
      <strong>ResolveNow Data Dictionary</strong> — ระบบรับแจ้งเรื่องร้องเรียน<br />
      MongoDB Atlas · Mongoose 9 · Node.js + Express 4 · Deploy on: Render.com<br />
      จัดทำ: 15/04/2569 | อัปเดต: 30/09/2569 | ครอบคลุม 7 collections, 85+ fields (Version: V19.2)<br />
      Copyright © 2026 ResolveNow. All rights reserved.
      <div style="margin-top:10px;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.18);font-size:8.5pt;color:rgba(255,255,255,0.75);">
        👨‍💻 พัฒนาโดย <strong style="color:#90cdf4;">Chatayodom Choikhuea</strong> · โทร 0970543528 · LINE: <strong style="color:#f6e05e;">rapbeerteng555teng55</strong> (Full Stack Developer)
        <span style="display:none">Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer</span>
      </div>
    </div>
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Automated Verification Test Suite**:
   ```pwsh
   npm test
   ```
   *Expected outcome*: 52/52 tests pass without any regressions.

2. **Watermark String Verification across Portals 5–7 + Supplemental**:
   ```pwsh
   Select-String -Path "public\executive-dashboard.html", "public\track.html", "public\project-poster.html", "public\liff-rating.html", "data_dictionary.html" -Pattern "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
   ```
   *Expected outcome*: Matches found in all 5 target files across comments, meta tags, and footer attributes.

3. **Print Layout Verification for Project Poster**:
   Open `http://localhost:3001/project` in browser, press `Ctrl + P` (Print Preview) with A5 Landscape paper size.
   *Expected outcome*: Total page count must remain strictly 1 page with no content spilling onto page 2.

### 5.2 Invalidation Conditions
- Any replacement that fails with `replace_file_content` due to mismatching indentation or line numbers.
- Any change in `project-poster.html` that alters the 16mm height of `.poster-footer` and triggers a second print page.
- Any modification that causes tests in `npm test` to fail.
