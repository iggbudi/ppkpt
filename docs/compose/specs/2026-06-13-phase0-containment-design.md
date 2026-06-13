# Phase 0: Containment & Product Honesty — Design Spec

## [S1] Problem

SafeSphere has critical security, privacy, and trust issues that must be fixed before any real use:
- Server exposes internal files (.git, server/, docs/, package.json)
- UI claims features that don't exist (E2E encryption, real-time, verification, OTP, upload)
- Chat fallback fails to detect high-risk messages
- User's name is sent to LLM provider without consent
- No demo banner warning users not to enter real data

## [S2] Solution Overview

Phase 0 focuses on containment (stop the bleeding) and honesty (align UI with reality). All items are achievable in 1-3 days.

## [S3] SEC-001: Static Asset Isolation

**Current:** `express.static(path.join(__dirname, '..'))` serves entire repo root.

**Fix:** Create `public/` directory, move only frontend files there, serve only `public/`.

Files to move to `public/`:
- `index.html`
- `style.css`
- `app.js`
- `js/` (all modules)
- `image/` (logo)

Files that must NOT be served:
- `.git/`
- `server/`
- `docs/`
- `.env`, `.env.example`
- `package.json`, `package-lock.json`
- `improve-codex.md`
- `ftp.txt` (already deleted)
- `assets_placeholder` (already deleted)

## [S4] SEC-002: Security Headers

Add `helmet` middleware to Express server:
- `Content-Security-Policy` via response header
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (if HTTPS)

## [S5] SAFE-001: Fix Risk Classifier Contract

**Current:** `getRiskScore()` in `js/safety.js` returns a number. Chat fallback in `js/chat.js` expects an object with `.score` and `.foundHighRisk`.

**Fix:** Make `getRiskScore()` return an object matching the backend's `classifyRisk()` format:
```javascript
function getRiskScore(text) {
  // ... detection logic ...
  return { score: score, level: level, foundHighRisk: foundHighRisk };
}
```

## [S6] TRUST-001: Demo Banner

Add a visible banner at the top of the page:
```
⚠️ MODE DEMO — SafeSphere adalah purwarupa. Jangan masukkan data nyata atau pribadi.
```

Dismissible (stored in sessionStorage so it reappears on new session).

## [S7] TRUST-002: Remove False Claims

Changes needed:
- Remove "enkripsi end-to-end" claims → replace with "purwarupa"
- Remove "terverifikasi" from registration → replace with "simulasi"
- Remove OTP functionality → disable or label as demo
- Remove "upload bukti" → label as "simulasi upload"
- Remove "real-time" from status → replace with "simulasi"
- Add "Simulasi" label to social login buttons

## [S8] TRUST-003: Emergency Contacts

Replace placeholder numbers with either:
- Real validated contacts (if available), or
- Clear "Belum tersedia" with explanation

Add `tel:` links for real numbers. Add note about service hours.

## [S9] PRIV-001: Stop Sending Name to LLM

In `js/chat.js`, stop sending `user.name` to backend. In `server/mimoClient.js`, stop including user name in system context.

## [S10] TEST-001: Static Exposure Regression Test

Add test that verifies internal files return 404:
```javascript
test('internal files are not accessible', async () => {
  const res = await request(app).get('/package.json');
  expect(res.status).toBe(404);
});
```

## [S11] Implementation Order

| Step | Task | ID | Priority |
|------|------|-----|----------|
| 1 | SEC-001: Create public/ and move files | SEC-001 | P0 |
| 2 | SEC-002: Add helmet and security headers | SEC-002 | P0 |
| 3 | SAFE-001: Fix getRiskScore() contract | SAFE-001 | P0 |
| 4 | TRUST-001: Add demo banner | TRUST-001 | P0 |
| 5 | TRUST-002: Remove false claims | TRUST-002 | P0 |
| 6 | TRUST-003: Fix emergency contacts | TRUST-003 | P0 |
| 7 | PRIV-001: Stop sending name to LLM | PRIV-001 | P1 |
| 8 | TEST-001: Add static exposure test | TEST-001 | P1 |

## [S12] Success Criteria

- [ ] `/package.json`, `/server/index.js`, `/.git/config` return 404
- [ ] Security headers present in responses
- [ ] `getRiskScore()` returns object, not number
- [ ] Demo banner visible and dismissible
- [ ] No false encryption/verification/OTP claims
- [ ] Emergency contacts clearly labeled or disabled
- [ ] User name not sent to LLM provider
- [ ] Regression test for static exposure passes
