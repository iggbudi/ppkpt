# SafeSphere — Release Notes Pilot

Versi: Pilot 1.0  
Tanggal: 14 Juni 2026

## Ringkasan

SafeSphere siap **pilot terbatas** (1 fakultas, 30 hari, monitoring ketat) setelah Sprint 0–5.

## Fitur Utama

- Pelaporan anonim dan rahasia (login) dengan workflow status
- Upload bukti terenkripsi + scanner strict di production
- Registrasi & login nyata (SQLite users)
- SafeBot dengan klasifikasi risiko lokal + MiMo fallback
- Edukasi interaktif 6 skenario bystander
- Quick escape + aksesibilitas dasar (WCAG checklist)

## Known Limitations (Pilot)

- OTP / reset password belum tersedia
- Social login tidak tersedia
- Kontak kampus spesifik masih generik (hotline nasional diverifikasi: 110, 119, 129)
- Chat history tidak disimpan di database (metadata audit saja)
- Streaming response SafeBot belum tersedia
- Adapter storage mendukung streaming encryption; validasi upload utama masih buffer-based dengan batas 10 MB/file
- Pentest eksternal belum dilakukan — internal structured scan selesai

## Release Gate Status

| Kriteria | Status |
|----------|--------|
| Anonimitas laporan | ✅ |
| Kontak darurat valid | ✅ (nasional) |
| Schema laporan konsisten | ✅ |
| Tanpa innerHTML user-controlled | ✅ |
| Auth production-safe | ✅ |
| Rate limit & validasi API | ✅ |
| Evidence production-ready | ✅ |
| Klaim UI = implementasi | ✅ |
| npm test 100% | ✅ (80 tests) |
| Playwright E2E | ✅ (14 tests) |
| WCAG manual audit | ✅ (lihat ACCESSIBILITY-AUDIT.md) |
| Pentest Critical/High | ✅ (0 terbuka, internal) |

## Deploy

Lihat [DEPLOYMENT.md](./DEPLOYMENT.md) dan unit systemd di `deploy/safesphere.service`.

## Insiden

Lihat [INCIDENT-RESPONSE-EVIDENCE.md](../INCIDENT-RESPONSE-EVIDENCE.md) dan [SECRET-ROTATION.md](./SECRET-ROTATION.md).