# Project: ResolveNow Developer Attribution & Anti-Tamper Integrity Protection

## Architecture
ResolveNow is a Smart City Complaint and Work Order Management platform built with Node.js, Express, Socket.IO, MongoDB/Mongoose, and vanilla HTML5/CSS3/JS glassmorphic client portals.
The Developer Attribution & Anti-Tamper Integrity Protection architecture provides multi-layered cryptographic defense-in-depth:
1. **Core Manifest & Engine (`utils/integrityGuard.js`)**:
   - Contains immutable canonical developer attribution text: `"Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"`.
   - Dual cryptographic hashes: SHA-256 (`72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51`) and SHA-512.
   - Core verification routines: `verifyIntegrity(customString)`, `assertIntegrity(options)`, `integrityMiddleware(req, res, next)`.
   - Hardened exit handlers utilizing closed-over native exit references.
2. **Multi-Layer Server Enforcement**:
   - Layer 1: Synchronous pre-flight boot assertion at `server.js:1`.
   - Layer 2: Secondary interlock inside `config/db.js` (`connectDB()`) preventing database connection if bypassed.
   - Layer 3: Route middleware on `/api/*` verifying in-memory sealed verification state.
   - Layer 4: Server listen hook logging verified startup banner and metadata.
3. **Client-Side Attribution**:
   - Semantic meta tags, HTML comments, glassmorphic footers, drawer footers, console watermarks, and runtime objects across all 7 portals.
4. **Verification & Tamper Test Engine**:
   - Integration into `scripts/runTests.js` (Group 11: 7 tests) verifying canonical hashes, tamper detection, and subprocess spawn proving startup refusal with exit code 1 upon tampering.
   - Preserves all 52 existing baseline tests (100% pass).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Watermark Manifest & Hashing | Canonical string, dual SHA-256/512 digests, timingSafeEqual in `utils/integrityGuard.js` | M1 | R2, R3 |
| 2 | Server Startup Banner & Health Check | Rich startup banner in `server.js`, `/health` & `/api/health` metadata, `package.json` author | M1 | R2 |
| 3 | Core Modules Attribution Docstrings | Standardized author docstrings across server modules (safeguarding `routes/ai.js` regex parser) | M1 | R2 |
| 4 | Client Portals Attribution & UI | HTML meta tags, comment headers, footers, side drawer, console watermark & runtime object | M2 | R2 |
| 5 | Multi-Layer Anti-Tamper Interlocks | Pre-flight boot check, DB interlock in `config/db.js`, route middleware, red ANSI tamper notice | M3 | R3 |
| 6 | Automated Tamper Test Suite | Unit tests and child process spawn test in `scripts/runTests.js` proving tamper detection | M3 | R3 |
| 7 | Full System Integration & Port 3001 | 100% pass across all tests, zero regression, port 3001 boot verification | M3 | R1, R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Core Integrity Guard & Server Attribution | Implement `utils/integrityGuard.js`, `package.json` author, server startup banner, health check metadata, and core module headers | none | DONE |
| 2 | Client Portals Developer Attribution & UI | Embed watermark across all 7 portals (`index.html`, `admin.html`, `tech.html`, `executive-dashboard.html`, `my-tickets.html`, `track.html`, `project-poster.html`) and `public/js/ui.js` | M1 | DONE |
| 3 | Anti-Tamper Interlocks, Automated Tests & System Gate | Hook pre-flight, DB interlock, route middleware, implement `scripts/testIntegrity.js`, integrate Group 11 into `scripts/runTests.js`, run full test suite, verify port 3001 startup | M1, M2 | DONE |

## Interface Contracts
### `utils/integrityGuard.js` API
- `DEVELOPER_ATTRIBUTION`: `string` (Frozen canonical string)
- `DEVELOPER_METADATA`: `{ name: string, phone: string, lineId: string, role: string }`
- `INTEGRITY_SIGNATURES`: `{ sha256: string, sha512: string }`
- `verifyIntegrity(candidateString?: string)`: `{ valid: boolean, error?: string, sha256: string }`
- `assertIntegrity(options?: { exitOnError?: boolean })`: `boolean` (throws `IntegrityTamperError` if `exitOnError: false`; prints banner and calls `process.exit(1)` if `exitOnError: true`)
- `integrityMiddleware(req, res, next)`: Express middleware
- `printStartupBanner(port: number | string)`: Logs verified developer attribution and system URLs

## Code Layout
- `utils/integrityGuard.js` — Core integrity manifest and cryptographic verification engine
- `server.js` — Pre-flight integrity assertion, startup banner, health check metadata, route middleware
- `config/db.js` — Secondary database connection integrity interlock
- `package.json` — Author attribution metadata
- `public/*.html` — Portal semantic meta tags, comments, and footer attributions
- `public/js/ui.js` — Client runtime watermark object and DevTools console banner
- `scripts/testIntegrity.js` — Dedicated unit & child process tamper verification tests
- `scripts/runTests.js` — Master test runner integrating Group 11 tamper verification suite
