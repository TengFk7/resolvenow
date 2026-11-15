# Server-Side Codebase Architecture & Integrity Audit Report

- **Agent**: teamwork_explorer_survey_1
- **Date**: 2026-11-06T08:10:00Z
- **Target System**: ResolveNow (Smart City Complaint & Work Order Platform)
- **Status**: Audit Completed — Baseline Established

---

## 1. Observation

### 1.1 Baseline Test Suite Execution (`scripts/runTests.js`)
Execution of the test suite via `node scripts/runTests.js` produced the following verbatim console output:
```
=== ResolveNow Automated System Verification ===

[Group 1: SLA Engine & Breach Detection]
  ✔ Urgent SLA rule defines 15m (0.25h) assign and 30m (0.5h) complete
  ✔ Medium SLA rule defines 6h assign and 12h complete
  ✔ Normal SLA rule defines 24h assign and 72h complete
  ✔ calcSlaDeadlines returns future dates matching rule hours
  ✔ checkIsSlaBreached detects expired pending assignment deadline
  ✔ checkIsSlaBreached returns false when pending deadline is in future
  ✔ checkIsSlaBreached detects expired completion deadline for in_progress
  ✔ checkIsSlaBreached freezes breach check while paused
  ✔ checkIsSlaBreached retains breach if ticket was already breached

[Group 2: Geo Calculations & Duplicate Detection]
  ✔ Haversine distance of identical coordinates is 0 meters
  ✔ Haversine distance within 100m is accurately detected
  ✔ Haversine distance over 1km is correctly flagged outside 100m radius

[Group 3: Security & XSS Sanitization]
  ✔ XSS sanitizer neutralizes executable script tags from user inputs
  ✔ XSS sanitizer neutralizes malicious onerror handlers in images
  ✔ Work order digital signature payload validator rejects invalid schemes, scripts, or oversized data
  ✔ Location and technician inputs are bounded and sanitized against XSS

[Group 4: PDPA & Privacy Protection]
  ✔ Public tracker masks citizen name with generic citizen label

[Group 5: Financial & Budget Aggregations]
  ✔ Cost overview calculates delta percentage correctly
  ✔ Cost overview handles zero prior month without divide-by-zero error

[Group 6: Database Model Schemas & Indexes]
  ✔ User model has schema with role and lineUserId indexes
  ✔ HelpRequest model has schema with status, requester, and ticket indexes
  ✔ DirectMessage model has schema with citizenId and compound indexes
  ✔ Ticket model has indexes for duplicate detection, SLA, and status queries

[Group 7: Cognitive Thai NLP Heuristics Engine & AI Fallback]
  ✔ ruleBasedUrgency function is exported and functional
  ✔ Cognitive Engine achieves 100% accuracy across all 134 few-shot dataset cases
  ✔ Cognitive Engine correctly handles spatial awareness & living space proximity
  ✔ Cognitive Engine correctly handles negation and absence of harm
  ✔ Cognitive Engine distinguishes nuisance smoke from active fire hazard

[Group 8: AI Auto-Categorization & Smart Fallback Dispatcher]
  ✔ ruleBasedClassification accurately classifies complaints across all 7 categories without manual selection
  ✔ ruleBasedClassification detects ambiguous and vague complaints for admin review queue
  ✔ Ticket model schema includes AI Dispatch and Ambiguity detection fields
  ✔ Cognitive Engine classifies severe damage like "ถนนหน้าบ้านพังยับ" as Road with high urgency (not normal)

[Group 9: Anti-Spam, Prank Detection & Citizen Strike Engine]
  ✔ analyzeComplaintSpam catches keyboard smashing sequences (English QWERTY and Thai Kedmanee)
  ✔ analyzeComplaintSpam catches continuous row smashing and loop patterns ("กดาสฟหกดาสฟหกดาส", "sdfkjhsdflkjh", "อะไรไม่รู้อะไรไม่รู้")
  ✔ analyzeComplaintSpam catches repetitive character smashing and laughter ("55555555", "กกกกกกกก")
  ✔ analyzeComplaintSpam catches test and placeholder phrases ("test", "1234", "ทดสอบระบบ", "ลองส่ง")
  ✔ analyzeComplaintSpam detects vulgar profanity and abusive words
  ✔ analyzeComplaintSpam detects out-of-domain jokes and classifies as Soft Quarantine
  ✔ validateCoordinates and analyzeComplaintSpam detect GPS out-of-bounds outside Thailand and Null Island
  ✔ Linguistic entropy and Thai consonant/vowel analysis detect vowelless Thai smashing
  ✔ Ticket and User model schemas include all required Anti-Spam & Strike fields and indexes
  ✔ checkIsSlaBreached excludes quarantined spam tickets from SLA breach calculations
  ✔ analyzeComplaintSpam and ruleBasedClassification block non-civic meaningless gibberish and playful input ("พิมพ์เรื่อยๆมั่วๆ", "jsdkfjweoifj", "ไม่มีไรทำส่งเล่น")
  ✔ Multimodal Vision helpers validate image payloads and detect pitch-black / blank junk images

[Group 10: LINE Bot Citizen Support AI & PDPA Guardrails]
[LINE Bot] Notice: LINE_CHANNEL_SECRET is not configured. Allowing webhook event for bot operation.
  ✔ validateLineSignature verifies HMAC-SHA256 signature accurately and rejects tampered bodies
  ✔ buildTicketFlexMessage formats rich Navy/Gold Flex Message with ticket details and status tokens
  ✔ buildUnauthorizedMessage enforces PDPA and guides unlinked/unauthorized users
  ✔ lineAiContext manages sliding window multi-turn memory and eviction
  ✔ lineAiAgent guardrails strictly reject admin/technician secrets and off-topic banter
  ✔ buildServiceNavigatorFlexMessage creates 3-button Smart Service Navigator card
  ✔ LineInquiry model has all required fields and indexes for Admin Portal
  ✔ Admin Takeover & 15-minute AI Mute lifecycle functions accurately

=== Test Results Summary ===
Total:  52
Passed: 52
Failed: 0

✔ All verification tests passed successfully! System is in ideal operating health.
```
- Total test count: 52 automated tests in 10 groups (44 baseline tests + 8 LINE Bot suite integration tests in `scripts/testLineBot.js`).
- Pass rate: 100% (52 passed, 0 failed).

### 1.2 Server Entry Point (`server.js`)
- **DNS & Networking Initialization (Lines 8–29)**:
  ```javascript
  const _dns = require('dns');
  const _net = require('net');
  _dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  if (typeof _net.setDefaultAutoSelectFamily === 'function') {
    _net.setDefaultAutoSelectFamily(false);
  }
  ```
  Forces IPv4 family 4 for outbound database connections (specifically targeting Render/cloud hosting constraints).
- **Environment & Sessions (Lines 31–82)**:
  `dotenv.config()` loads `.env`. Creates Express app, HTTP server, and Socket.IO server (`const io = new Server(server, { cors: { origin: '*' } });`).
  Session configuration uses `MongoStore.create({ mongoUrl: process.env.MONGODB_URI, dbName: 'resolvenow' })`, shared with Socket.IO via `io.engine.use(sessionMiddleware)`.
- **Async Boot Lifecycle (Lines 121–406)**:
  The bootstrap executes inside an anonymous async IIFE `(async () => { ... })()`:
  - Line 122: `await connectDB();`
  - Line 123: `await seedDB();`
  - Line 124: `startSlaJob();` (runs immediate check, then cron every 5 min; chat cleanup every 1 hour)
  - Lines 127–144: Security & parsing middleware (`helmet({ contentSecurityPolicy: false })`, `mongoSanitize()`, `express.json(...)`, `express.urlencoded(...)`, `express.static('public')`, `sessionMiddleware`)
  - Lines 146–179: Rate limiting (`authLimiter`, `pollingLimiter`, `apiLimiter`)
  - Lines 181–189: Health Check Endpoint:
    ```javascript
    app.get(['/health', '/api/health'], (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date(),
        uptime: Math.floor(process.uptime()),
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      });
    });
    ```
  - Lines 191–202: Route mounts:
    `/api/auth`, `/api/tickets`, `/api/technicians`, `/api/help-requests`, `/api/ai`, `/api/categories`, `/api/direct-messages`, `/api/ceo`, `/api/track`, `/auth/line`, `/api/line`, `/api/line-inquiries`.
  - Lines 205–365: Static page handlers: `/liff-rating`, `/Datadic`, `/track`, `/ceo`, `/admin`, `/tech` (`/technician`), `/project`, `/my-tickets` (`/tickets/my`), and fallback `*` to `public/index.html`.
  - Lines 368–373: Port binding and startup banner:
    ```javascript
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log('='.repeat(40));
      console.log(`  ResolveNow: http://localhost:${PORT}`);
      console.log('='.repeat(40));
    });
    ```
  - Lines 376–405: Process signals (`SIGINT`, `SIGTERM`, unhandled exceptions, unhandled rejections) with 10-second graceful timeout.

### 1.3 Critical Test Suite Observation in `scripts/runTests.js`
In Group 7, lines 276–300:
```javascript
const aiContent = fs.readFileSync(path.join(__dirname, '../routes/ai.js'), 'utf8');
const lines = aiContent.split('\n');
...
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
```
The test suite statically parses lines in `routes/ai.js` using regular expression matching `|`, `"..."`, and `→ (urgent|medium|normal)`. Any comment or text added to `routes/ai.js` matching this pattern will alter `testCases.length` and cause Test 25 (`Cognitive Engine achieves 100% accuracy across all 134 few-shot dataset cases`) to fail!

### 1.4 Cryptographic Verification of Developer Watermark
Watermark string:
`Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer`
- String byte length: 86 characters (UTF-8).
- Computed SHA-256 Digest:
  `72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51`

---

## 2. Logic Chain

1. **Premise 1 (Execution Flow)**:
   In `server.js`, code execution starts with IPv4 patches, followed by module loading, Express/Socket.IO setup, and the async IIFE `(async () => { ... })()`.
   *Inference*: The optimal place to verify system integrity is **before** connecting to the database (`await connectDB()`) or initializing Express routes. If tampering is detected, halting execution at this point prevents any unauthorized code, leaked sessions, or compromised database operations from executing.

2. **Premise 2 (Anti-Tamper Mechanics)**:
   The user requires:
   > "Implement an integrity verification mechanism that validates the presence and authenticity of the developer watermark/attribution upon system startup and execution. If the attribution or integrity signature is altered, modified, or removed, the system must detect the tampering and immediately refuse to start or halt execution with an explicit tamper-detection notice."
   *Inference*: An anti-tamper validator should verify:
   a. The canonical watermark string matches exactly.
   b. The SHA-256 cryptographic digest of the string matches `72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51`.
   c. If altered, removed, or empty, the validator prints an explicit, high-visibility security alert notice to stderr and terminates the process via `process.exit(1)`.
   d. The validator must be exportable as a modular utility (e.g. `utils/integrityValidator.js` or `config/integrityValidator.js`) so unit tests can invoke it with mock inputs and confirm tamper detection without killing the test runner.

3. **Premise 3 (Attribution Exposure Points)**:
   The user requires:
   > "Embed the developer attribution and watermark ("Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer") into the codebase across source files, runtime startup logs/metadata, and core system modules."
   *Inference*:
   - **`package.json`**: Add `author`: `"Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"`.
   - **`server.js` startup log**: Replace generic banner with rich startup banner presenting developer credentials, contact information, watermark text, and integrity status.
   - **Health check (`/health` & `/api/health`)**: Include developer attribution and verification status in the JSON response payload.
   - **Module headers**: Include standardized author docstrings in `server.js`, `config/db.js`, `config/seed.js`, `config/slaJob.js`, `routes/tickets.js`, `routes/auth.js`, `routes/ai.js`, `routes/ceo.js`, `utils/slaHelper.js`, `utils/spamFilter.js`.

4. **Premise 4 (Non-Disruption & Test Preservation)**:
   - All 52 existing tests in `scripts/runTests.js` must remain untouched in functionality.
   - Any new test for anti-tamper integrity must be appended as a dedicated Group (Group 11) or modular suite so that `npm test` runs 100% green.
   - Comments added to `routes/ai.js` must strictly avoid the regex pattern `/^([^|\r\n]+)\s*\|\s*"([^"]+)"\s*→\s*(urgent|medium|normal)/`.

---

## 3. Caveats

1. **Client-side Portals**: This survey focused on the server-side codebase (`server.js`, `routes/`, `config/`, `utils/`, `models/`, `package.json`, `scripts/runTests.js`). Client-side UI footers and meta tags in HTML files can also include watermark tags, but the primary anti-tamper enforcement happens server-side at boot.
2. **Cluster / Multi-worker Environments**: The server is designed for single-instance Node.js execution (Render / cloud container). An in-process `process.exit(1)` upon tamper detection is fully sufficient and halts the container immediately.
3. **External Dependencies**: The anti-tamper validator uses Node.js standard library `crypto` and `fs`, requiring no new external `npm` packages.

---

## 4. Conclusion & Recommended Implementation Blueprint

### Architecture of the Integrity Verification System:

1. **New Module: `utils/integrityValidator.js`**
   - Holds canonical constants:
     - `DEVELOPER_NAME`: `"Chatayodom Choikhuea"`
     - `DEVELOPER_PHONE`: `"0970543528"`
     - `DEVELOPER_LINE`: `"rapbeerteng555teng55"`
     - `DEVELOPER_ROLE`: `"Full Stack Developer"`
     - `DEVELOPER_WATERMARK`: `"Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"`
     - `CANONICAL_SHA256`: `"72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51"`
   - Functions:
     - `verifyWatermarkString(watermarkStr)`: Returns `{ valid: boolean, error?: string, hash?: string }`.
     - `verifySystemIntegrity(options = { exitOnError: true, logBanner: true })`:
       Validates canonical watermark, verifies presence in `package.json` and module files.
       If invalid: prints formatted `[SECURITY ALERT] SYSTEM INTEGRITY VIOLATION DETECTED!` banner and calls `process.exit(1)` if `exitOnError: true`.
     - `getAttributionMetadata()`: Returns structured developer attribution object for API/Health Check.

2. **Hook in `server.js`**:
   - At line 32 (immediately after `dotenv.config()`):
     ```javascript
     const { verifySystemIntegrity, getAttributionMetadata } = require('./utils/integrityValidator');
     // Validate developer attribution and anti-tamper signature before loading routes or database
     verifySystemIntegrity({ exitOnError: true });
     ```
   - In Health Check endpoint (`/health`, `/api/health`):
     Include `developer` and `attribution: getAttributionMetadata()` in the JSON response.
   - In `server.listen(PORT, ...)`:
     Print rich startup banner displaying developer credits, contact details, and integrity validation seal.

3. **Core Modules Attribution**:
   Insert the required attribution header across:
   - `package.json` (`author`)
   - `server.js`
   - `config/db.js`
   - `config/seed.js`
   - `config/slaJob.js`
   - `routes/auth.js`
   - `routes/tickets.js`
   - `routes/ai.js` (ensuring no match with line 290 regex)
   - `routes/ceo.js`
   - `routes/directMessages.js`
   - `utils/slaHelper.js`
   - `utils/spamFilter.js`

4. **Automated Verification Tests (`scripts/runTests.js`)**:
   Add **Group 11: Developer Attribution & Anti-Tamper Integrity Engine**:
   - Test 1: Verify intact canonical watermark matches expected SHA-256 hash.
   - Test 2: Verify `verifyWatermarkString` succeeds for intact watermark.
   - Test 3: Verify `verifyWatermarkString` detects and rejects altered developer name.
   - Test 4: Verify `verifyWatermarkString` detects and rejects altered phone number / line ID.
   - Test 5: Verify `verifyWatermarkString` rejects empty, truncated, or null watermark.
   - Test 6: Verify `verifySystemIntegrity({ exitOnError: false })` returns valid status for intact system.
   - Test 7: Verify tamper detection logs detailed security alert banner.

---

## 5. Verification Method

To verify the audit findings and validate the proposed design:

1. **Verify Baseline Test Execution**:
   ```powershell
   node scripts/runTests.js
   ```
   *Expected Result*: Total 52 tests, 52 passed, 0 failed.

2. **Verify SHA-256 Digest**:
   ```powershell
   node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer', 'utf8').digest('hex'));"
   ```
   *Expected Result*: `72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51`.

3. **Verify Line 290 Regex Sensitivity**:
   Inspect lines 276–308 of `scripts/runTests.js` to ensure any proposed comment in `routes/ai.js` does NOT contain `|`, `"..."`, and `→` with urgency labels.

4. **Verify Port & Network Settings**:
   Check `server.js` line 368 to confirm `PORT` defaults to 3001.
