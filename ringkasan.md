# Ringkasan Proyek SafeSphere

**Tanggal Ringkasan:** 14 Juni 2026  
**Status:** Siap Pilot Terbatas (Sprint 0–5 selesai + release gate)

---

## Apa Itu SafeSphere?

**SafeSphere** adalah aplikasi web untuk **pelaporan dan penanganan kasus perundungan (bullying)** berbasis kampus/pendidikan vokasi di Indonesia.

Aplikasi ini memungkinkan pelapor (mahasiswa atau masyarakat umum) untuk membuat laporan secara **anonim** atau **rahasia**, mengunggah bukti dengan aman, melacak status penanganan, serta mendapatkan dukungan awal melalui chatbot (SafeBot). 

Tim admin (Satgas PPKS) dapat mengelola kasus melalui dashboard profesional, memperbarui status, menambahkan catatan tindak lanjut, dan mengakses bukti secara terkontrol.

**Live:** [safesphere.my.id](https://safesphere.my.id)

---

## Latar Belakang Masalah

Perundungan di lingkungan kampus masih menjadi isu serius di Indonesia. Korban sering enggan melapor karena:

- Stigma dan rasa malu
- Takut pembalasan
- Kurangnya kepercayaan terhadap proses pelaporan konvensional
- Risiko kebocoran identitas

Selain itu, **bukti digital** (screenshot, foto, rekaman) mengandung metadata yang dapat membahayakan pelapor jika tidak ditangani dengan benar. Sistem pelaporan tradisional juga kurang transparan dan sulit diaudit.

---

## Mengapa SafeSphere Dibutuhkan?

SafeSphere hadir sebagai solusi digital yang:

- Memberikan **jalur pelaporan yang aman dan rahasia**
- Melindungi **privasi pelapor** dan **integritas bukti**
- Meningkatkan **transparansi** bagi pelapor (bisa lihat status)
- Membantu tim penanganan kasus bekerja secara **profesional dan akuntabel**
- Memberikan **edukasi** bagi saksi melalui simulasi interaktif

Fokus utama proyek ini adalah **privasi** dan **keamanan bukti**, bukan sekadar form laporan biasa.

---

## Fitur Utama

- Pelaporan anonim atau dengan login (rahasia)
- Kategori perundungan + tingkat urgensi
- Unggah bukti (gambar, dokumen, audio, video) dengan batasan ketat
- SafeBot chatbot dengan klasifikasi risiko lokal + fallback LLM (Xiaomi MiMo)
- Dashboard pengguna untuk melacak laporan sendiri
- Dashboard admin lengkap dengan:
  - Daftar laporan & filter
  - Modal detail dua kolom (informasi + Aksi Admin)
  - Update status kasus
  - Penambahan jadwal/catatan tindak lanjut
  - Timeline riwayat
- Simulasi edukasi interaktif (6 skenario bystander)
- Quick escape (tekan Esc 2x)
- Widget aksesibilitas (kontras tinggi, teks besar, ramah disleksia)
- Manajemen pengguna admin

---

## Arsitektur Sistem

```
Browser (HTTPS)
   ↓
Apache (reverse proxy + HTTPS)
   ├── /          → Static files (public/)
   └── /api/*     → Express (port 3000)
                      ├── Auth & RBAC
                      ├── Report & Status Workflow
                      ├── Evidence Pipeline (encrypt, scan, strip, quarantine)
                      ├── SafeBot + Risk Classifier + Circuit Breaker
                      ├── Audit, Rate Limit, Backup
                      │
                      └── SQLite (safesphere.db)
                      └── Encrypted Evidence (data/evidence/)
```

**Karakteristik Arsitektur:**
- Frontend: SPA murni (Vanilla JS + HTML + CSS, tanpa framework berat)
- Backend: Node.js + Express
- Database: SQLite (sederhana untuk pilot)
- Storage: Pluggable (Local FS + S3)
- Deployment: Apache + PM2

---

## Keamanan dan Privasi (Fokus Utama)

SafeSphere dibangun dengan pendekatan **security-first**:

- Laporan anonim **benar-benar tidak menyimpan identitas** (bahkan di audit log)
- Bukti **dienkripsi at-rest** menggunakan AES-256-GCM
- Metadata otomatis dihapus (EXIF, lokasi, device info)
- PII Redaction sebelum data diproses LLM
- Scanner + quarantine untuk file berbahaya
- Rate limiting persisten (SQLite)
- Session persisten + RBAC (admin / user)
- Threat Model mendokumentasikan **12 ancaman utama** beserta mitigasinya (semua sudah ditangani)
- Quick escape untuk membersihkan data sensitif
- Soft delete + Legal hold

---

## Teknologi yang Digunakan

| Komponen     | Teknologi                              |
|--------------|----------------------------------------|
| Frontend     | HTML5, CSS3, Vanilla JavaScript, Chart.js |
| Backend      | Node.js, Express, Zod (validasi)       |
| Database     | SQLite                                 |
| Keamanan     | AES-256-GCM, Sharp, Helmet, CSP        |
| Testing      | 78+ Unit Test + 7 Playwright E2E       |
| Deployment   | Apache, PM2, systemd                   |
| Dokumentasi  | Threat Model, Security Scan, Accessibility Audit, Deployment Guide, Release Notes |

---

## Status Pengembangan

- **Sprint 0–5** telah selesai
- Semua release gate terpenuhi
- **Siap untuk pilot terbatas** (1 fakultas, 30 hari, monitoring ketat)
- 78 unit test + E2E browser test hijau
- Dokumentasi sangat lengkap (termasuk Threat Model, Incident Response, Secret Rotation, dll.)

**Item pasca-pilot** (bukan blocker):
- Kontak kampus spesifik
- OTP / social login
- Multipart streaming file besar
- Pentest eksternal

---

## Struktur Proyek (Ringkas)

```
repo/
├── public/                 # Source frontend SPA
├── server/                 # Backend Express
│   ├── index.js
│   ├── reports.js, auth.js, evidence.js
│   ├── piiRedaction.js
│   └── ...
├── data/                   # SQLite + evidence terenkripsi
├── docs/                   # Dokumentasi teknis lengkap
├── e2e/                    # Playwright tests
└── ringkasan.md            # File ini
```

---

## Dokumentasi Penting

- [README.md](README.md) — Dokumentasi utama
- [wiki.md](wiki.md) — Panduan codebase & deployment
- [docs/ROADMAP-SPRINT.md](docs/ROADMAP-SPRINT.md)
- [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/RELEASE-NOTES-PILOT.md](docs/RELEASE-NOTES-PILOT.md)

---

**SafeSphere** adalah proyek yang menekankan keseimbangan antara **kemudahan penggunaan bagi korban** dan **standar keamanan tinggi** untuk menangani data yang sangat sensitif.

Dibuat untuk kompetisi vokasi dengan semangat memberikan dampak nyata bagi pencegahan dan penanganan perundungan di kampus.

---

*Ringkasan ini dibuat berdasarkan eksplorasi menyeluruh terhadap codebase, dokumentasi, dan arsitektur proyek per 14 Juni 2026.*