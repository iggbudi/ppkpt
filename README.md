# SafeSphere

SafeSphere adalah aplikasi pelaporan anti-perundungan berbasis web untuk membuat laporan anonim atau rahasia, mengelola tindak lanjut kasus, dan menyediakan dukungan awal melalui SafeBot.

Project ini menggunakan frontend statis, backend Express, dan SQLite. Fokus implementasi adalah privasi pelapor, kontrol akses berbasis sesi, integritas laporan, pengelolaan bukti terenkripsi, serta kesiapan operasional pilot.

> **Status:** siap **pilot terbatas** (1 fakultas, 30 hari, monitoring ketat). Release gate Sprint 0–5 terpenuhi. Lihat [Release Notes Pilot](docs/RELEASE-NOTES-PILOT.md).

**Live:** [safesphere.my.id](https://safesphere.my.id)

## Fitur

- Pelaporan anonim tanpa menyimpan identitas akun pada laporan dan audit pembuatannya.
- Pelaporan rahasia untuk pengguna login yang ingin melacak status.
- Registrasi & login nyata (tabel `users`, bcrypt, validasi Zod).
- Manajemen pengguna admin (list, create, deactivate + audit).
- Deskripsi dan unggah file bukti opsional dengan enkripsi at-rest (AES-256-GCM).
- Validasi signature/MIME, quarantine, metadata stripping, scanner strict + ClamAV opsional.
- Dashboard pengguna dan admin dengan tabel alternatif untuk screen reader.
- Workflow status laporan: `Baru Masuk` → `Direview` → `Diproses` → `Selesai`.
- Deletion request, soft delete, dan legal hold.
- Audit log untuk aktivitas penting (termasuk metadata chat tanpa isi pesan).
- SafeBot dengan klasifikasi risiko lokal, redaksi PII, prompt injection filter, dan MiMo fallback.
- Edukasi interaktif 6 skenario bystander dengan progress tracking.
- Quick escape (Esc×2) yang membersihkan input sensitif dan overlay samaran.
- Rate limiting persisten (SQLite) untuk login, chat, API, dan laporan.
- Session store persisten (SQLite), backup/restore, monitoring, dan health check operasional.
- Dukungan aksesibilitas dasar (WCAG checklist manual selesai).

## Arsitektur

```text
Browser
  |
  | HTTP / session cookie / multipart upload
  v
Apache (HTTPS) ──► static public/
                 └─► /api/* ──► Express :3000
                                    |
                                    |-- Auth & RBAC (users DB)
                                    |-- Report workflow
                                    |-- Evidence: encrypt, scan, quarantine
                                    |-- Risk classifier + MiMo circuit breaker
                                    |-- Audit, retention, backup, monitoring
                                    |
                                    +-- SQLite: data/safesphere.db
                                    +-- Encrypted evidence: data/evidence
                                    +-- Quarantine/temp: data/quarantine, data/temp-uploads
```

Frontend berada di `public/` dan dilayani oleh Express (atau Apache untuk static di production). Backend utama berada di `server/`.

### Penyimpanan Data

| Environment | Database |
|---|---|
| Development | `data/safesphere.db` |
| Test | SQLite in-memory |
| Custom | Nilai `DATABASE_PATH` |

Tabel utama:

- `reports`, `audit_log`, `migrations`, `retention_policy`
- `legal_holds`, `evidence_files`, `users`

Admin di-bootstrap dari `ADMIN_USERNAME` / `ADMIN_PASSWORD` ke tabel `users` saat startup. Demo user (`demo`/`demo123`) hanya dibuat di development/test.

## Alur Unggah Bukti

1. Browser mengirim laporan dan file dalam satu request `multipart/form-data`.
2. Server memvalidasi field, jumlah file, ukuran, extension, dan signature/MIME.
3. Metadata gambar dihapus menggunakan `sharp`.
4. Hash SHA-256 dihitung; file dienkripsi dan disimpan ke private storage.
5. Scanner strict memeriksa file; status `pending` diproses async via scan queue.
6. Download hanya tersedia setelah status `clean` dan otorisasi sesi.
7. Jika salah satu file gagal, laporan dan file di-rollback atomik.

Batas default: 5 file/laporan, 10 MB/file, 25 MB total. Allowlist: PDF, TXT, JPEG, PNG, WebP, MP3, M4A, MP4, WebM.

## Persyaratan

- Node.js 18+ (22 direkomendasikan untuk CI).
- npm.
- Xiaomi MiMo API key opsional (fallback lokal tersedia jika provider down).

## Menjalankan Secara Lokal

```bash
git clone https://github.com/iggbudi/ppkpt.git
cd ppkpt/server
npm install
cp .env.example .env
# Edit .env — minimal NODE_ENV, SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
node index.js
```

Buka `http://127.0.0.1:3000`.

Atau dari root:

```bash
npm start
```

### Login Development

- Admin: nilai `ADMIN_USERNAME` / `ADMIN_PASSWORD` dari `server/.env`.
- Demo user: `demo` / `demo123` (hanya development/test).
- Registrasi nyata tersedia di `#register`.

Jangan commit `server/.env`, database, atau isi direktori `data/`.

## Konfigurasi

Variabel utama: [`server/.env.example`](server/.env.example). Panduan lengkap: [DEPLOYMENT.md](docs/DEPLOYMENT.md).

| Variable | Keterangan |
|---|---|
| `NODE_ENV` | Wajib: `development`, `test`, atau `production` |
| `SESSION_SECRET` | Min 32 karakter, entropi memadai (production) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Bootstrap admin ke tabel users |
| `EVIDENCE_UPLOADS_ENABLED` | `true` di production (dengan encryption key) |
| `EVIDENCE_ENCRYPTION_KEY` | AES-256-GCM untuk file bukti |
| `EVIDENCE_SCANNER_MODE` | `strict` di production |
| `MIMO_API_KEY`, `MIMO_MODEL` | Xiaomi MiMo (opsional) |
| `TRUST_PROXY` | Set `1` di belakang Apache/Nginx |

## API Utama

| Area | Endpoint |
|---|---|
| Health | `GET /api/health` (disk, DB, quarantine, MiMo status) |
| Auth | `POST /api/auth/register`, `login`, `logout`, `GET /me` |
| Users (admin) | `GET/POST /api/admin/users`, `PATCH .../deactivate` |
| Reports | `POST/GET /api/reports`, `GET /:id`, `PATCH /:id/status` |
| Evidence | upload, download, delete (auth + scan status) |
| Chat | `POST /api/chat` (metadata audit, tanpa simpan isi pesan) |
| Chat logs (admin) | `GET /api/admin/chat/logs` |
| Operations | audit, status, backup, restore, evidence metrics |

Endpoint destruktif (seed, clear, import) hanya tersedia di development/test.

## Testing

```bash
# API & unit tests (80 tests)
cd server && npm test

# Browser E2E Playwright (14 tests)
cd e2e && npm install && npx playwright install chromium && npm test

# Semua dari root
npm test
npm run test:e2e
```

Test suite mencakup: kontrak API, keamanan, rate limit, evidence EICAR, auth/register, anonimitas, release gate, load 50 concurrent, dan E2E browser (laporan, login, admin, chat, quick escape).

## Keamanan

- Session persisten SQLite + RBAC (`admin` / `user`).
- Cookie `HttpOnly`, `SameSite=Strict`, `Secure` di production.
- Helmet, CSP (`script-src 'self'`), rate limiting SQLite.
- Validasi Zod, soft delete, legal hold, audit logging.
- PII redaction (NIK, alamat, kartu) + prompt injection filter sebelum LLM.
- Evidence terenkripsi, scanner strict, fail-closed di production.
- Structured logging tanpa isi pesan sensitif.

Catatan privasi: laporan anonim tidak menyimpan `authorId` pada laporan maupun audit `report.create`. Metadata teknis (IP) tidak dicatat pada audit laporan anonim.

## Production

```bash
# PM2 (saat ini)
pm2 start server/index.js --name safesphere-chat
pm2 save

# Systemd (alternatif)
sudo cp deploy/safesphere.service /etc/systemd/system/
sudo systemctl enable --now safesphere
```

Checklist sebelum go-live: [DEPLOYMENT.md](docs/DEPLOYMENT.md), rotasi secret: [SECRET-ROTATION.md](docs/SECRET-ROTATION.md), insiden: [INCIDENT-RESPONSE-EVIDENCE.md](INCIDENT-RESPONSE-EVIDENCE.md).

## Struktur Project

```text
.
|-- public/                 # Frontend SPA (hash routing)
|-- server/
|   |-- index.js            # Express application
|   |-- auth.js, users.js   # Auth & user management
|   |-- reports.js          # Report, evidence, deletion routes
|   |-- piiRedaction.js     # PII & prompt injection filter
|   |-- mimoCircuitBreaker.js
|   |-- opsHealth.js        # Operational health checks
|   |-- test/               # 80 automated tests
|   `-- .env.example
|-- e2e/                    # Playwright browser tests (14)
|-- deploy/                 # systemd unit file
|-- docs/                   # Deployment, security, pilot docs
`-- INCIDENT-RESPONSE-EVIDENCE.md
```

## Dokumentasi

- [Deployment guide](docs/DEPLOYMENT.md)
- [Release notes pilot](docs/RELEASE-NOTES-PILOT.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Security scan](docs/SECURITY-SCAN.md)
- [Accessibility audit](docs/ACCESSIBILITY-AUDIT.md)
- [Secret rotation](docs/SECRET-ROTATION.md)
- [Incident drill log](docs/INCIDENT-DRILL-LOG.md)
- [Status dan backlog](progress.md)

## Batasan Pilot

- OTP / reset password & social login: sengaja disembunyikan (bukan klaim palsu).
- Kontak kampus spesifik masih generik (hotline nasional 110/119/129 diverifikasi).
- Chat isi pesan tidak disimpan DB (metadata audit saja).
- Pentest eksternal belum dilakukan (internal selesai, 0 Critical/High).
- Pipeline evidence memiliki dukungan stream pada adapter storage, tetapi validasi upload utama masih memproses file maksimal 10 MB sebagai buffer.
- Riwayat chat tidak disimpan agar batas privasi dan retensi tetap sederhana selama pilot.

## Kontribusi

1. Buat branch untuk perubahan.
2. Pastikan `cd server && npm test` lulus (80/80).
3. Untuk perubahan UI, jalankan `cd e2e && npm test` jika memungkinkan.
4. Jangan commit secret, `.env`, database, atau file evidence.
5. Sertakan test untuk perubahan auth, laporan, evidence, atau lifecycle data.