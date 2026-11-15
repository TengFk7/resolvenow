## 2026-11-06T08:22:00Z
You are teamwork_worker_m1_1.
Your working directory is: c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_worker_m1_1

Read the following files carefully before starting:
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\PROJECT.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m1_1\handoff.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m1_1\proposed_integrityGuard.js
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m1_2\handoff.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m1_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You have exclusive write ownership over:
- `utils/integrityGuard.js`
- `package.json`
- `server.js`
- `config/db.js`
- `config/seed.js`
- `config/slaJob.js`
- `routes/tickets.js`
- `routes/auth.js`
- `routes/ceo.js`
- `utils/slaHelper.js`
- `utils/spamFilter.js`
- `routes/ai.js`

Tasks for Milestone 1:
1. Create `utils/integrityGuard.js`:
   Implement the complete production integrity guard engine using the verified code from `c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m1_1\proposed_integrityGuard.js`. Ensure it contains:
   - Canonical attribution: "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
   - Dual SHA-256 (`72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51`) and SHA-512 hashes
   - `verifyIntegrity`, `assertIntegrity`, `integrityMiddleware`, `printStartupBanner`, and memory-sealed exports.
2. Update `package.json`:
   Add `"author": "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"` per Explorer M1-2's specification.
3. Update `server.js`:
   - Import `integrityGuard` methods (`printStartupBanner`, etc.)
   - Update lines 181–188 for `/health` and `/api/health` to include developer metadata and `integrity: 'VERIFIED_GENUINE'`.
   - Update lines 368–373 to call `printStartupBanner(PORT)`.
4. Update Module Header Docstrings across core modules per Explorer M1-3's specification:
   - `server.js`, `config/db.js`, `config/seed.js`, `config/slaJob.js`, `routes/tickets.js`, `routes/auth.js`, `routes/ceo.js`, `utils/slaHelper.js`, `utils/spamFilter.js`.
   - `routes/ai.js` (CRITICAL: Strictly adhere to Explorer M1-3's clean docstring without any pipe `|`, arrow `→`, or urgency words so Group 7 test parser is not affected).
5. Build and Test Verification:
   Run `npm test` (`node scripts/runTests.js`). Verify that ALL 52 automated tests pass with 100% success.
   Document the exact terminal output and verification commands in your handoff report.
6. Write your complete handoff report to:
   `c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_worker_m1_1\handoff.md`
   And send a message to your parent upon completion.
