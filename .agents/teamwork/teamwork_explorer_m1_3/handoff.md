# Server Module Headers & Attribution Specification Report (Milestone 1)

- **Agent**: `teamwork_explorer_m1_3`
- **Date**: 2026-11-06T08:21:00Z
- **Target Area**: Server Core Module Headers & Docstrings
- **Milestone**: Milestone 1 (Feature 3: Core Modules Attribution Docstrings)
- **Status**: Complete & Ready for Implementation

---

## 1. Observation

### 1.1 Automated Test Suite & Group 7 Regex Parser
In `scripts/runTests.js`, lines 270–309 execute Group 7 verification:
```javascript
runTest('Cognitive Engine achieves 100% accuracy across all 134 few-shot dataset cases', () => {
  const fs = require('fs');
  const path = require('path');
  const { ruleBasedUrgency } = require('../routes/ai');

  const aiContent = fs.readFileSync(path.join(__dirname, '../routes/ai.js'), 'utf8');
  const lines = aiContent.split('\n');
  const catMap = {
    'สัตว์มีพิษ': 'Animal',
    'ภัยพิบัติ': 'Hazard',
    'ท่อน้ำ': 'Water',
    'ไฟฟ้า': 'Electricity',
    'ถนน': 'Road',
    'ขยะ': 'Garbage',
    'กีดขวาง': 'Tree'
  };

  const testCases = [];
  for (const line of lines) {
    const m = line.match(/^([^|\r\n]+)\s*\|\s*"([^"]+)"\s*→\s*(urgent|medium|normal)/);
    if (m) {
      testCases.push({
        category: catMap[m[1].trim()] || m[1].trim(),
        text: m[2].trim(),
        expected: m[3].trim()
      });
    }
  }

  assert.strictEqual(testCases.length, 134, 'Should parse all 134 test cases from routes/ai.js');
...
```
- Line 290 regex: `/^([^|\r\n]+)\s*\|\s*"([^"]+)"\s*→\s*(urgent|medium|normal)/`
- The parser statically splits `routes/ai.js` into lines and matches any line containing:
  1. Leading non-pipe characters `^([^|\r\n]+)`
  2. Vertical pipe `|`
  3. Quoted text `"([^"]+)"`
  4. Right arrow symbol `→`
  5. Urgency keyword `urgent|medium|normal`
- If ANY line in `routes/ai.js` matches this pattern, `testCases.length` increments above 134, failing line 300 `assert.strictEqual(testCases.length, 134)`.

### 1.2 Regex Sensitivity Testing on Standardized Header
We executed node test evaluation matching the exact standardized header format against the Group 7 regex:
```javascript
const h = [
  '/**',
  ' * ResolveNow System Module',
  ' * Developer Attribution & Watermark:',
  ' * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"',
  ' * Integrity Protected by ResolveNow Anti-Tamper Core',
  ' */'
];
const re = /^([^|\r\n]+)\s*\|\s*"([^"]+)"\s*→\s*(urgent|medium|normal)/;
```
Result: `Matches: 0`.
- Line 4 contains quotes `"..."`, but strictly contains NO pipe `|`, NO arrow `→`, and NO urgency keyword.
- Consequently, it does NOT trigger the parser.

### 1.3 Audit of Existing Module Headers Across 10 Target Files
Inspection of lines 1–10 across the 10 target files reveals two existing patterns:

1. **Standard 4-line Header** (used in 9 files: `server.js`, `config/db.js`, `config/seed.js`, `config/slaJob.js`, `routes/tickets.js`, `routes/auth.js`, `routes/ceo.js`, `utils/slaHelper.js`, `routes/ai.js`):
   ```javascript
   /**
    * ResolveNow - Complaint Management System
    * Copyright (c) 2026 ResolveNow. All rights reserved.
    */
   ```
2. **5-line Header** (used in `utils/spamFilter.js`):
   ```javascript
   /**
    * ResolveNow - Complaint Management System
    * Anti-Spam, Prank & Gibberish Filtering Engine (Cognitive Heuristics & Geofencing)
    * Copyright (c) 2026 ResolveNow. All rights reserved.
    */
   ```

### 1.4 File Line Endings
- `server.js`: CRLF
- `config/db.js`, `config/seed.js`, `config/slaJob.js`, `routes/tickets.js`, `routes/auth.js`, `routes/ceo.js`, `utils/slaHelper.js`, `utils/spamFilter.js`, `routes/ai.js`: LF

---

## 2. Logic Chain

1. **Attribution Requirement Fulfillment**:
   The prompt and `PROJECT.md` require embedding the developer watermark:
   `"Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"`
   into the core module headers using the standardized format:
   ```javascript
   /**
    * ResolveNow System Module
    * Developer Attribution & Watermark:
    * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
    * Integrity Protected by ResolveNow Anti-Tamper Core
    */
   ```

2. **Uniformity & Anti-Tamper Verifiability**:
   Replacing the obsolete `Copyright (c) 2026 ResolveNow` headers with the exact 6-line standardized header across all target files provides 100% uniformity. An integrity scanner can verify this exact block verbatim or verify the presence of the developer attribution string across all core modules.

3. **Zero Impact on Group 7 Test**:
   Because the header lines contain neither `|` nor `→` nor urgency tokens, the parser in `scripts/runTests.js` ignores the header completely, maintaining `testCases.length === 134` and 100% test pass rate.

4. **Preservation of Section Comments and Code**:
   In each target file, the replacement is isolated strictly to lines 1–4 (or lines 1–5 in `utils/spamFilter.js`). All subsequent section dividers, DNS/network patches, require statements, and exported functions remain untouched.

---

## 3. Caveats

1. **Line Shift in `server.js`**:
   Replacing lines 1–4 with the 6-line header increases the line count of `server.js` by 2 lines. Other tasks targeting `server.js` (e.g. health endpoints or listen hook) should take this +2 line offset into account if relying on hardcoded line indices, or use unique string matching.
2. **Secondary Server Modules**:
   An audit identified 14 additional server modules in `config/`, `routes/`, and `utils/` that currently hold the legacy `Copyright (c) 2026 ResolveNow` header. While not part of the 10 core targets, specifications for these 14 secondary files are provided in Section 4.2 should complete repository coverage be desired.
3. **Encoding & Quotes**:
   Ensure file replacements preserve UTF-8 encoding so the Thai string `"เป็น Full Stack Developer"` remains exact with no byte corruption.

---

## 4. Conclusion & Worker Implementation Blueprint

### 4.1 The 10 Core Target Files (Exact Specifications for Worker)

#### 1. `server.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\server.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of server.js."

---

#### 2. `config/db.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\config\db.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of config/db.js."

---

#### 3. `config/seed.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\config\seed.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of config/seed.js."

---

#### 4. `config/slaJob.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\config\slaJob.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of config/slaJob.js."

---

#### 5. `routes/tickets.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\routes\tickets.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of routes/tickets.js."

---

#### 6. `routes/auth.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\routes\auth.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of routes/auth.js."

---

#### 7. `routes/ceo.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\routes\ceo.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of routes/ceo.js."

---

#### 8. `utils/slaHelper.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\utils\slaHelper.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of utils/slaHelper.js."

---

#### 9. `utils/spamFilter.js`
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\utils\spamFilter.js`
- **StartLine**: 1
- **EndLine**: 5
- **TargetContent**:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Anti-Spam, Prank & Gibberish Filtering Engine (Cognitive Heuristics & Geofencing)
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```
- **ReplacementContent**:
```javascript
/**
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright and filter header with standardized developer attribution header."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of utils/spamFilter.js."

---

#### 10. `routes/ai.js` (CRITICAL REGEX COMPLIANCE)
- **File**: `c:\Users\TENG\OneDrive\Desktop\ResolveNow\routes\ai.js`
- **StartLine**: 1
- **EndLine**: 4
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
 * ResolveNow System Module
 * Developer Attribution & Watermark:
 * "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
 * Integrity Protected by ResolveNow Anti-Tamper Core
 */
```
- **Instruction**: "Replace legacy copyright header with standardized developer attribution header, strictly adhering to regex safety."
- **Description**: "Embed developer attribution and anti-tamper watermark header at top of routes/ai.js without pipe, arrow, or urgency tokens."

---

### 4.2 Secondary Server Modules (Optional Full Coverage)
If full repository header coverage is desired during Milestone 1 or Milestone 3, the following 14 files have identical `StartLine: 1`, `EndLine: 4`, and `TargetContent`:
```javascript
/**
 * ResolveNow - Complaint Management System
 * Copyright (c) 2026 ResolveNow. All rights reserved.
 */
```
Target files:
1. `config/cloudinary.js`
2. `config/lineBotService.js`
3. `config/lineNotify.js`
4. `config/mailer.js`
5. `routes/categories.js`
6. `routes/directMessages.js`
7. `routes/helpRequests.js`
8. `routes/lineAuth.js`
9. `routes/lineBot.js`
10. `routes/lineInquiries.js`
11. `routes/technicians.js`
12. `routes/track.js`
13. `utils/lineAiAgent.js`
14. `utils/lineAiContext.js`

---

## 5. Verification Method

To independently verify after the Worker applies the changes:

1. **Verify Watermark Presence Across Core Modules**:
   ```powershell
   Get-ChildItem -Path server.js, config\db.js, config\seed.js, config\slaJob.js, routes\tickets.js, routes\auth.js, routes\ceo.js, utils\slaHelper.js, utils\spamFilter.js, routes\ai.js | Select-String -SimpleMatch "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer" | Measure-Object
   ```
   *Expected Result*: Count is 10 (all 10 core files contain the exact attribution).

2. **Verify Group 7 Test Case Parser Count (134 cases)**:
   ```powershell
   node -e "const fs = require('fs'); const lines = fs.readFileSync('routes/ai.js', 'utf8').split('\n'); const re = new RegExp('^([^|\\r\\n]+)\\s*\\|\\s*\x22([^\x22]+)\x22\\s*→\\s*(urgent|medium|normal)'); const tc = lines.filter(l => re.test(l)); console.log('Parsed test cases:', tc.length); require('assert').strictEqual(tc.length, 134);"
   ```
   *Expected Result*: `Parsed test cases: 134`.

3. **Execute Full Automated Verification Test Suite**:
   ```powershell
   npm test
   ```
   *Expected Result*: All 52 automated tests pass with 0 failures (`Total: 52, Passed: 52, Failed: 0`).
