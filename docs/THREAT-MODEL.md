# SafeSphere Threat Model

Tanggal: 13 Juni 2026

## Aset yang Dilindungi
- Identitas pelapor (anonim/rahasia)
- Isi laporan perundungan
- Bukti (file, screenshot)
- Sesi autentikasi admin/user
- API key MiMo

## Ancaman dan Mitigasi

| ID | Ancaman | Vector | Mitigasi | Status |
|----|---------|--------|----------|--------|
| T1 | Auth Bypass | DevTools localStorage | Server-side session + RBAC | Mitigated |
| T2 | Data Tampering | Direct API call | requireAuth + requireAdmin middleware | Mitigated |
| T3 | XSS | Script injection di laporan | DOM helpers (createEl, textContent) | Mitigated |
| T4 | CSRF | Cross-origin submission | SameSite=strict cookie, JSON Content-Type | Mitigated |
| T5 | Clickjacking | Iframe embedding | X-Frame-Options: DENY via helmet | Mitigated |
| T6 | API Abuse | Spam chat endpoint | Rate limit IP (60/min) + session (20/10min) | Mitigated |
| T7 | PII Leakage | Email/HP ke LLM provider | PII redaction sebelum request | Mitigated |
| T8 | Secret Exposure | .git, .env accessible | public/ isolation, .gitignore | Mitigated |
| T9 | Stored XSS | Data dari storage/API | DOM helpers, perlu CSP ketat | Partial |

## Risk Acceptance
- Prototype mode: data in-memory, hilang saat restart
- LLM provider: data diproses pihak ketiga
- Kontak darurat: placeholder, perlu validasi
