## 2026-11-06T08:43:11Z
You are teamwork_worker_m2_1.
Your working directory is: c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_worker_m2_1

Read the following files carefully before starting:
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\PROJECT.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m2_1\handoff.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m2_2\handoff.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m2_3\handoff.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_spec_miner_survey_3\handoff.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_survey_1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You have exclusive write ownership over:
- `public/index.html`
- `public/my-tickets.html`
- `public/admin.html`
- `public/tech.html`
- `public/executive-dashboard.html`
- `public/track.html`
- `public/project-poster.html`
- `public/liff-rating.html`
- `data_dictionary.html`
- `public/js/ui.js`
- `server.js`
- `config/db.js`
- `scripts/testIntegrity.js`
- `scripts/runTests.js`

Tasks:
Part A: Client Portals & Scripts (Developer Attribution Integration)
1. Apply line-level replacements for Portals 1 to 4 (`public/index.html`, `public/my-tickets.html`, `public/admin.html`, `public/tech.html`) per Explorer M2-1's handoff (top HTML comments, semantic meta tags, `.rn-footer`, drawer footers, admin sidebar).
2. Apply line-level replacements for Portals 5 to 7 + supplemental pages (`public/executive-dashboard.html`, `public/track.html`, `public/project-poster.html`, `public/liff-rating.html`, `data_dictionary.html`) per Explorer M2-2's handoff.
3. Update `public/js/ui.js` per Explorer M2-3's handoff to register the immutable `window.__RESOLVENOW_DEVELOPER__` runtime object and print the styled DevTools console watermark banner on load.

Part B: Multi-Layer Anti-Tamper Protection & Automated Test Suite
4. In `server.js`:
   - Mount pre-flight synchronous integrity assertion at the top of the file:
     `const { assertIntegrity, integrityMiddleware, printStartupBanner, DEVELOPER_ATTRIBUTION, DEVELOPER_METADATA } = require('./utils/integrityGuard');`
     `assertIntegrity();`
   - Mount `integrityMiddleware` on `/api` routes:
     `app.use('/api', integrityMiddleware);`
5. In `config/db.js`:
   - Mount secondary database connection interlock inside `connectDB()`:
     `const { assertIntegrity } = require('../utils/integrityGuard');`
     `assertIntegrity();`
6. Create `scripts/testIntegrity.js` and integrate Group 11 ("Developer Attribution & Anti-Tamper Integrity Protection") into `scripts/runTests.js` per Spec Miner 3's handoff:
   - Test canonical attribution string and metadata.
   - Test independent SHA-256 and SHA-512 cryptographic digests.
   - Test object immutability and memory sealing.
   - Test mutation rejection across single-character, phone digit, and Unicode mutations.
   - Test non-fatal `assertIntegrity({ exitOnError: false })` throwing `IntegrityTamperError`.
   - Test `integrityMiddleware` route protection.
   - Test subprocess tamper simulation verifying exit code 1 and Red ANSI breach banner output.

Part C: Verification & Reporting
7. Run `npm test` (`node scripts/runTests.js`). Verify all baseline tests (Groups 1–10) + Group 11 pass 100%.
8. Verify server startup on port 3001 using a background check or brief run.
9. Write complete handoff report to:
   `c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_worker_m2_1\handoff.md`
   And send a message to your parent upon completion.
