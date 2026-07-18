# SafeSphere — Progress

Terakhir diperbarui: 14 Juni 2026 (maintenance selesai)
Live: [safesphere.my.id](https://safesphere.my.id)
Repo: [iggbudi/ppkpt](https://github.com/iggbudi/ppkpt)

## Status Keseluruhan

| Aspek | Status |
|-------|--------|
| Sprint 0–5 (release gate pilot) | ✅ Selesai |
| Pilot terbatas (1 fakultas, 30 hari) | ✅ Siap dijalankan |
| Backend production (PM2 + Apache) | ✅ Berjalan |
| Upload bukti di production | ✅ Aktif |
| Test otomatis | ✅ 80 server + 8 E2E Playwright |

---

## Yang Sudah Selesai

### Sprint 0 — Stabilisasi
- [x] Sinkronisasi `repo/public/` ↔ deploy live
- [x] Semua test server hijau (tidak hang)
- [x] Perbaikan rate limit bypass, evidence 503, MIME spoofing
- [x] PM2 auto-restart, dokumentasi deployment Apache
- [x] CI GitHub Actions

### Sprint 1 — Keamanan & Integritas Data
- [x] Rate limiting persisten (SQLite), anti-bypass proxy header
- [x] Session store persisten (SQLite), cookie `Secure`/`HttpOnly`/`SameSite=Strict`
- [x] Validasi `SESSION_SECRET` dan `ADMIN_PASSWORD` saat startup
- [x] Soft delete, legal hold, filter laporan terhapus
- [x] Validasi tanggal laporan (tolak masa depan)
- [x] Hilangkan `innerHTML` untuk data user-controlled
- [x] Backup/restore terenkripsi + dry-run

### Sprint 2 — Evidence Production-Ready
- [x] Storage lokal terenkripsi (AES-256-GCM) + S3 opsional
- [x] Scanner strict, signature/MIME, ClamAV opsional, metadata stripping
- [x] `EVIDENCE_UPLOADS_ENABLED=true` di production
- [x] Rollback atomik jika upload gagal
- [x] Async scan queue, admin tidak bisa unduh file non-`clean`
- [x] Backup/restore artifact evidence
- [x] Monitoring quarantine threshold

### Sprint 3 — Auth & User Management
- [x] Registrasi & login nyata (`users`, bcrypt, Zod)
- [x] Admin: list / create / deactivate user + audit log
- [x] Dashboard user dari API (bukan simulasi localStorage)
- [x] Laporan anonim tanpa `authorId` di report & audit
- [x] Fitur OTP/social login disembunyikan (tidak ada sukses palsu)

### Sprint 4 — UX, A11y, & Edukasi
- [x] Validasi form per langkah, `aria-describedby` pada error
- [x] Quick escape (Esc×2), overlay samaran
- [x] Chart.js lokal, tabel alternatif admin untuk screen reader
- [x] 6 skenario edukasi bystander + progress tracking (`scenarios.json`)
- [x] Responsive navigation (topbar desktop + sidebar mobile)
- [x] Manual WCAG checklist (keyboard, screen reader, zoom 200%)

### Sprint 5 — Operasional & Release Gate
- [x] Playwright E2E (8 test): laporan, login, admin, chat, quick escape, abort upload
- [x] Load test 50 concurrent anonymous reports
- [x] Health check operasional (`opsHealth.js`)
- [x] PII redaction, prompt injection filter, MiMo circuit breaker
- [x] Admin chat logs (metadata saja, tanpa isi pesan)
- [x] Systemd unit (`deploy/safesphere.service`)
- [x] Dokumentasi: `RELEASE-NOTES-PILOT.md`, `SECRET-ROTATION.md`, `DEPLOYMENT.md`, dll.
- [x] Release gate 12/12 ✅

### Perbaikan Pasca-Sprint (14 Juni 2026)
- [x] Apache: header `X-Forwarded-Proto` agar session admin berfungsi di HTTPS
- [x] Backend: sinkronisasi kolom `reports.evidence` setelah upload file
- [x] Admin UI: tampilkan daftar bukti + link unduh dari `/api/reports/:id/evidence`
- [x] README diperbarui untuk status pilot

### Maintenance Pasca-Sprint (14 Juni 2026)
- [x] E2E Playwright: quick escape membatalkan upload aktif (safety.js + evidence-upload.js + test)
- [x] Konsolidasi status maintenance dan backlog ke `progress.md`
- [x] Perbaikan kontak darurat UI (tel: links + contoh spesifik kampus pilot + verifikasi Juni 2026)
- [x] Streaming encryption pada adapter storage (`fileEncryption.js` + `storageLocal.put`); pipeline validasi upload utama tetap dibatasi 10 MB/file dan menggunakan buffer
- [x] Skor/feedback per pilihan edukasi (scoreDelta di `scenarios.json` + live score + bonus XP di `edukasi.js`)
- [x] Cleanup referensi OTP/social login (hapus dead CSS + update docs agar konsisten "sengaja disembunyikan")
- [x] Update `progress.md` dengan status maintenance lengkap (task 7)

### Fitur Utama yang Berjalan
- Pelaporan anonim dan rahasia + workflow status
- Upload bukti foto/dokumen (anonim & login)
- SafeBot + klasifikasi risiko + MiMo fallback
- Dashboard admin & user
- Deletion request, legal hold, audit log
- Backup/restore, retention policy, monitoring

---

## Yang Masih Kurang

### Item Selesai di Maintenance (Juni 2026)
- Test E2E: quick escape membatalkan upload
- Skor/feedback per pilihan edukasi
- Streaming encryption pada adapter storage + lifecycle sidecar `.enc.json`
- Cleanup referensi OTP/social login
- Perbaikan kontak darurat + dokumentasi sinkronisasi

### Belum Diimplementasi (Bukan Blocker Pilot)

| Item | Prioritas | Catatan |
|------|-----------|---------|
| Pentest eksternal | Sedang | Internal structured scan selesai |
| Pentest khusus upload/download | Sedang | Manual, belum dijadwalkan |
| Streaming end-to-end sebelum validasi file | Rendah | Saat ini adapter storage mendukung stream; deteksi MIME dan metadata stripping masih buffer-based |

### Backlog Pasca-Pilot (Sengaja Ditunda)

| Item | Alasan |
|------|--------|
| Database chat history | Privasi & retention kompleks |
| JWT (selain session) | Session sudah memadai untuk pilot |
| Streaming response SafeBot | Enhancement UX |
| Dashboard operator manusia (live chat) | Butuh staffing |
| Handoff real-time admin ↔ korban | Kompleksitas operasional |
| RAG dokumen SOP kampus | Butuh konten & infra embedding |
| Enkripsi end-to-end nyata | Butuh key management infra |
| Gamifikasi edukasi (XP, leaderboard) | Enhancement |
| CMS artikel edukasi | Butuh workflow konten |
| Multi-tenant / multi-kampus | Arsitektur berbeda |

### Known Limitations Pilot

- Kontak kampus: nasional dibuat actionable (tel: links + verifikasi Juni 2026); spesifik kampus/fakultas masih mengandalkan instruksi ke bagian Kemahasiswaan (contoh pilot disertakan)
- Chat history tidak disimpan di DB (metadata audit saja)
- Pentest eksternal belum dilakukan

(Dokumentasi sudah disinkronkan di maintenance Juni 2026.)

## Release Gate Pilot

| Kriteria | Status |
|----------|--------|
| Laporan anonim tidak dapat dikaitkan ke akun | ✅ |
| Kontak darurat valid | ✅ (nasional) |
| Schema laporan konsisten frontend ↔ backend | ✅ |
| Tanpa innerHTML user-controlled | ✅ |
| Auth production-safe | ✅ |
| Rate limit & validasi API | ✅ |
| Evidence production-ready | ✅ |
| Klaim UI = implementasi | ✅ |
| `npm test` 100% | ✅ (80 tests) |
| Playwright E2E | ✅ (8 tests) |
| WCAG manual audit | ✅ |
| Pentest Critical/High terbuka | ✅ (0, internal) |

---

## Langkah Berikutnya (Disarankan)

1. **Rotasi** `ADMIN_PASSWORD` setelah pilot dimulai.
2. **Jadwalkan** pentest eksternal jika pilot diperluas melampaui 1 fakultas.
3. **Masukkan Playwright ke CI** setelah waktu eksekusi dan instalasi browser disepakati.
4. **Evaluasi streaming end-to-end** bila batas file dinaikkan di atas 10 MB.

(Lihat juga rencana implementasi untuk item low/opsional. Beberapa sudah selesai di maintenance Juni 2026: E2E quick escape, streaming, edukasi scoring, cleanup OTP/social.)

---

## Referensi Dokumen

| Dokumen | Isi |
|---------|-----|
| [docs/RELEASE-NOTES-PILOT.md](docs/RELEASE-NOTES-PILOT.md) | Catatan rilis pilot |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Panduan deployment dan operasi |
| [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) | Threat model dan accepted risks |
| [README.md](README.md) | Panduan developer dan deploy |

---

*Dokumen ini diperbarui setelah Sprint 5 + maintenance Juni 2026 (task 1–7: E2E quick escape, docs sync, kontak, streaming, edukasi scoring, OTP/social cleanup, progress update).*