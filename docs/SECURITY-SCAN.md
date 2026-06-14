# Security Scan Results

Date: 2026-06-14 (Sprint 5 — Internal Structured Pentest)

## npm audit

- Root: 0 vulnerabilities
- Server: 0 vulnerabilities
- E2E: run `cd e2e && npm audit` after install

## Secret Scanning

- API keys in tracked code: None (`sk-` patterns)
- `.env` not in git (gitignored)
- Admin credentials: env-only bootstrap (`users.js`)
- Demo user: dev/test only

## CSP Headers

Configured in `server/index.js` via helmet:

- `default-src 'self'`
- `script-src 'self'` (Chart.js vendored lokal)
- `style-src 'self' 'unsafe-inline'`
- `frame-src https://id.wikipedia.org`
- `object-src 'none'`

## Automated Pentest Checks (sprint5.test.js)

| Check | Result |
|-------|--------|
| Security headers on /api/health | PASS |
| Anonymous report no authorId | PASS |
| Chat audit no raw message body | PASS |
| No innerHTML in primary UI modules | PASS |
| 50 concurrent reports no crash | PASS |
| PII redaction NIK/address/card | PASS |
| Prompt injection sanitization | PASS |

## Manual Findings

| Severity | Finding | Status |
|----------|---------|--------|
| — | No Critical/High open | Clean |
| Low | `style-src unsafe-inline` masih diperlukan | Accepted pilot |
| Low | Kontak kampus generik | Accepted pilot |
| Info | Pentest eksternal belum dijadwalkan | Backlog post-pilot |

## Recommendations (Post-Pilot)

1. Pentest eksternal sebelum multi-fakultas
2. Migrasi inline styles untuk CSP strict
3. CAPTCHA pada register jika abuse terdeteksi
4. Alerting webhook untuk evidence critical alerts