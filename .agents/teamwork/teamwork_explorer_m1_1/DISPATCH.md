## 2026-11-06T08:14:48Z
You are teamwork_explorer_m1_1.
Your working directory is: c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m1_1

Read the following files carefully:
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\PROJECT.md
- c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_spec_miner_survey_3\handoff.md

Task:
Design the exact, production-ready code structure for `utils/integrityGuard.js` for Milestone 1:
1. Canonical watermark string: "Chatayodom Choikhuea 0970543528 id line rapbeerteng555teng55 เป็น Full Stack Developer"
2. Verified Dual Cryptographic Hashes:
   - SHA-256: `72d9c9f2ac8a64f7c6542c208c4cc024e10895f02dc65916c45d35fb1ca88f51`
   - SHA-512: `32a47e34ccae92a2c985bcc331ae84d280b83906c8a6f8a91d0053b9a5f7e41199ca2c794a8771f542174d452ca1bcabfa2d550ea7da8898a08b0abf577e1be8`
3. Function interfaces:
   - `verifyIntegrity(candidateString)`: pure function returning `{ valid: boolean, error?: string, sha256: string }`, with NFC normalization and `crypto.timingSafeEqual`.
   - `assertIntegrity(options)`: calls `verifyIntegrity()`. If invalid:
     - if `options.exitOnError === false`, throws `IntegrityTamperError`.
     - otherwise prints prominent Red ANSI tamper alert banner to `stderr` and invokes cached native `process.exit(1)`.
   - `integrityMiddleware(req, res, next)`: O(1) in-memory check for `/api/*` routes.
   - `printStartupBanner(port)`: formatted ASCII banner printing developer attribution, watermark status, and URLs.
4. Security hardening:
   - `Object.freeze()` on all exported objects and constants.
   - Capture `_nativeExit = process.exit.bind(process)` at module load to resist monkey-patching.
5. Provide the exact, complete drop-in code specification for the Worker.

Write your report to:
`c:\Users\TENG\OneDrive\Desktop\ResolveNow\.agents\teamwork\teamwork_explorer_m1_1\handoff.md`
And send a message to your parent upon completion.
