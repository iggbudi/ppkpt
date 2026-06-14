# SafeSphere Threat Model

Tanggal: 14 Juni 2026 (Sprint 5 update)

## Aset yang Dilindungi

- Identitas pelapor (anonim/rahasia)
- Isi laporan perundungan
- Bukti (file, screenshot)
- Sesi autentikasi admin/user
- API key MiMo

## Ancaman dan Mitigasi

| ID | Ancaman | Vector | Mitigasi | Status |
|----|---------|--------|----------|--------|
| T1 | Auth Bypass | Session tampering | SQLite session store + RBAC + bcrypt users | Mitigated |
| T2 | Data Tampering | Direct API call | requireAuth + requireAdmin middleware | Mitigated |
| T3 | XSS | Script injection di laporan | DOM helpers (createEl, textContent) | Mitigated |
| T4 | CSRF | Cross-origin submission | SameSite=strict cookie, JSON Content-Type | Mitigated |
| T5 | Clickjacking | Iframe embedding | X-Frame-Options: DENY via helmet | Mitigated |
| T6 | API Abuse | Spam chat/report | SQLite rate limit store, per-IP + per-session | Mitigated |
| T7 | PII Leakage | Email/NIK/alamat ke LLM | piiRedaction.js sebelum request MiMo | Mitigated |
| T8 | Secret Exposure | .git, .env accessible | public/ isolation, .gitignore, helmet CSP | Mitigated |
| T9 | Stored XSS | Data dari API | DOM helpers + CSP script-src self | Mitigated |
| T10 | Evidence malware | Upload malicious file | Scanner strict + quarantine + rollback | Mitigated |
| T11 | Provider outage | MiMo unavailable | Circuit breaker 5 menit + template fallback | Mitigated |
| T12 | Prompt injection | LLM manipulation | sanitizePromptInjection + risk classifier | Mitigated |

## Bukti Test

- `server/test/sprint1.test.js` — rate limit, session, backup
- `server/test/sprint2.test.js` — evidence EICAR, artifact restore
- `server/test/sprint3.test.js` — auth, anonimitas
- `server/test/sprint5.test.js` — PII, release gate, load 50 concurrent
- `e2e/tests/*.spec.js` — browser flows

## Risk Acceptance (Pilot)

- LLM provider memproses pesan terredaksi (bukan zero-knowledge)
- Kontak kampus spesifik belum terverifikasi per institusi
- Pentest eksternal belum dilakukan (internal structured scan selesai)
- Chat isi pesan tidak disimpan DB — metadata audit saja