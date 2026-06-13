# SafeSphere

SafeSphere adalah aplikasi pelaporan anti-perundungan berbasis web untuk membuat laporan anonim atau rahasia, mengelola tindak lanjut kasus, dan menyediakan dukungan awal melalui SafeBot.

Project ini menggunakan frontend statis, backend Express, dan SQLite. Fokus implementasi saat ini adalah privasi pelapor, kontrol akses berbasis sesi, integritas laporan, serta pengelolaan bukti secara privat.

> **Status:** siap untuk development dan evaluasi. Belum siap menangani data nyata di production sebelum release gate keamanan dan operasional dipenuhi.

## Fitur

- Pelaporan anonim tanpa menyimpan identitas akun pada laporan dan audit pembuatannya.
- Pelaporan rahasia untuk pengguna yang login dan ingin melacak status.
- Deskripsi dan unggah file bukti opsional.
- Validasi signature/MIME, batas ukuran, quarantine, metadata stripping gambar, dan scanning dasar.
- Dashboard pengguna dan admin.
- Workflow status laporan: `Baru Masuk` → `Direview` → `Diproses` → `Selesai`.
- Deletion request, soft delete, dan legal hold.
- Audit log untuk aktivitas penting.
- SafeBot dengan klasifikasi risiko lokal, redaksi PII, dan integrasi Xiaomi MiMo opsional.
- Quick escape yang membersihkan input sensitif dan membatalkan upload aktif.
- Rate limiting untuk login, chat, API, dan pengiriman laporan.
- Migration, retention policy, backup/restore metadata, monitoring, serta health check.
- Dukungan aksesibilitas dasar dan navigasi keyboard.

## Arsitektur

```text
Browser
  |
  | HTTP / session cookie / multipart upload
  v
Express application
  |-- Auth dan RBAC
  |-- Report workflow
  |-- Evidence validation, quarantine, dan scanning
  |-- Risk classifier dan MiMo client
  |-- Audit, retention, backup, dan monitoring
  |
  +-- SQLite: data/safesphere.db
  +-- Private local evidence storage: data/evidence
  +-- Quarantine/temp storage: data/quarantine, data/temp-uploads
```

Frontend berada di `public/` dan dilayani oleh aplikasi Express yang sama. Backend utama berada di `server/`.

### Penyimpanan Data

SafeSphere menggunakan SQLite melalui `better-sqlite3`.

| Environment | Database |
|---|---|
| Development | `data/safesphere.db` |
| Test | SQLite in-memory |
| Custom | Nilai `DATABASE_PATH` |

Tabel utama:

- `reports`
- `audit_log`
- `migrations`
- `retention_policy`
- `legal_holds`
- `evidence_files`

Kredensial admin tidak disimpan pada tabel SQLite. Admin dibuat saat startup dari `ADMIN_USERNAME` dan `ADMIN_PASSWORD`, lalu password di-hash dengan bcrypt di memory.

## Alur Unggah Bukti

1. Browser mengirim laporan dan file dalam satu request `multipart/form-data`.
2. Server memvalidasi field laporan, jumlah file, ukuran, extension, dan signature/MIME.
3. Metadata gambar dihapus menggunakan `sharp`.
4. Hash SHA-256 dihitung dari file akhir.
5. File disimpan ke quarantine dan diperiksa scanner.
6. File hanya dipindahkan ke private storage setelah status `clean`.
7. Download hanya tersedia melalui endpoint backend dengan pemeriksaan sesi dan otorisasi.
8. Jika salah satu file gagal, laporan dan file yang sudah diproses di-rollback.

Batas default:

- Maksimal 5 file per laporan.
- Maksimal 10 MB per file.
- Maksimal 25 MB total per laporan.
- Allowlist backend: PDF, TXT, JPEG, PNG, WebP, MP3, M4A, MP4, dan WebM.

Scanner saat ini merupakan scanner dasar berbasis signature/pattern. Karena itu, upload evidence sengaja ditolak saat production jika diaktifkan. Integrasikan scanner malware dan private object storage nyata sebelum production.

## Persyaratan

- Node.js 22 direkomendasikan, sesuai konfigurasi CI.
- npm.
- Windows, Linux, atau macOS.
- Xiaomi MiMo API key hanya diperlukan jika ingin menggunakan respons model eksternal.

## Menjalankan Secara Lokal

```bash
git clone <repository-url>
cd SAFESPHERE
npm install
cd server
npm install
cd ..
```

Buat konfigurasi development:

```bash
cp server/.env.example server/.env
```

PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

Minimal isi `server/.env`:

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
SESSION_SECRET=ganti-dengan-secret-development-minimal-32-karakter
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ganti-dengan-password-admin-yang-kuat
EVIDENCE_UPLOADS_ENABLED=true
```

Jalankan aplikasi:

```bash
npm start
```

Buka `http://127.0.0.1:3000`.

### Login Development

- Admin menggunakan nilai `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari `server/.env`.
- Demo user development: `demo` / `demo123`.
- Demo user tidak dibuat pada production.

Jangan commit `server/.env`, database, atau isi direktori `data/`.

## Konfigurasi

Variabel utama tersedia di [`server/.env.example`](server/.env.example).

| Variable | Keterangan |
|---|---|
| `NODE_ENV` | Wajib: `development`, `test`, atau `production` |
| `HOST`, `PORT` | Alamat dan port server |
| `SESSION_SECRET` | Wajib dan minimal 32 karakter pada production |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Kredensial bootstrap admin |
| `DATABASE_PATH` | Lokasi SQLite custom |
| `TRUST_PROXY` | Jumlah/alamat trusted proxy; default `false` |
| `MIMO_API_KEY`, `MIMO_MODEL` | Konfigurasi Xiaomi MiMo |
| `CHAT_RATE_LIMIT_*` | Batas request chat |
| `EVIDENCE_UPLOADS_ENABLED` | Mengaktifkan upload evidence pada development/test |
| `EVIDENCE_STORAGE_PATH` | Private local evidence storage |
| `EVIDENCE_QUARANTINE_PATH` | Lokasi quarantine |
| `EVIDENCE_TEMP_PATH` | Lokasi temporary upload |

## API Utama

| Area | Endpoint utama |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Reports | `POST /api/reports`, `GET /api/reports`, `GET /api/reports/:id` |
| Workflow | `PATCH /api/reports/:id/status` |
| Evidence | `GET /api/reports/:id/evidence`, download dan delete evidence |
| Chat | `POST /api/chat` |
| Deletion | request, approve, reject deletion |
| Legal hold | place, release, dan list legal hold |
| Operations | audit, status, optimize, backup, restore, evidence metrics |

Endpoint admin memerlukan sesi dengan role `admin`. Endpoint seed, clear, import, dan export lama hanya tersedia pada development/test.

## Testing dan Quality Checks

Jalankan seluruh test:

```bash
npm test
```

Atau dari direktori server:

```bash
cd server
npm test
npm run check
npm audit --audit-level=high
```

Test suite mencakup kontrak API, E2E backend, keamanan dasar, risk classifier, rate limit, serta upload evidence anonim dan MIME spoofing.

GitHub Actions menjalankan test, dependency audit, Gitleaks, secret pattern scan, dan pemeriksaan isolasi database.

## Keamanan

Kontrol yang sudah diterapkan:

- Server-side session dan role-based access control.
- Regenerasi session setelah login.
- Cookie `HttpOnly`, `SameSite=Strict`, dan `Secure` pada production.
- Helmet, CSP, frame protection, dan `nosniff`.
- Input validation dengan Zod.
- State machine status laporan.
- Soft delete dan legal hold.
- Rate limiting.
- Audit logging.
- PII redaction sebelum pesan dikirim ke provider AI.
- Private evidence storage dan authorization sebelum download.
- Production configuration fail-closed.
- Evidence upload production fail-closed selama scanner/storage production belum tersedia.

Catatan privasi: laporan anonim tidak menyimpan identitas akun pada laporan dan audit pembuatannya. Server, jaringan, reverse proxy, serta kontrol anti-abuse tetap dapat memproses metadata teknis.

## Production

Production harus menetapkan `NODE_ENV=production` secara eksplisit. Startup akan ditolak jika session secret atau kredensial admin tidak memenuhi persyaratan minimum.

Sebelum production:

- Gunakan HTTPS dan reverse proxy tepercaya.
- Gunakan persistent/distributed session store.
- Gunakan private object storage terenkripsi.
- Integrasikan scanner malware nyata.
- Implementasikan backup artifact evidence dan restore drill.
- Terapkan secret manager, monitoring, alerting, dan incident response.
- Lakukan penetration test dan audit aksesibilitas manual.

Jangan mengaktifkan `EVIDENCE_UPLOADS_ENABLED=true` pada production saat implementasi scanner dan storage masih placeholder.

## Struktur Project

```text
.
|-- public/                 # Frontend HTML, CSS, dan JavaScript
|-- server/
|   |-- index.js            # Express application
|   |-- auth.js             # Login, logout, session user
|   |-- reports.js          # Report, evidence, deletion, backup routes
|   |-- db.js               # SQLite initialization dan retention
|   |-- migrations.js       # Schema migrations
|   |-- evidence.js         # Evidence lifecycle
|   |-- storage*.js         # Storage abstraction/adapters
|   |-- scanner.js          # Scanner dasar
|   |-- test/               # Automated tests
|   `-- .env.example        # Template konfigurasi
|-- docs/                   # Security, deployment, dan accessibility docs
|-- .github/workflows/      # CI workflow
`-- INCIDENT-RESPONSE-EVIDENCE.md
```

## Dokumentasi Tambahan

- [Deployment guide](docs/DEPLOYMENT.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Security scan](docs/SECURITY-SCAN.md)
- [Accessibility audit](docs/ACCESSIBILITY-AUDIT.md)
- [Evidence upload plan](evidence-upload-plan.md)
- [Evidence incident response](INCIDENT-RESPONSE-EVIDENCE.md)

## Batasan Saat Ini

- Scanner malware production belum terintegrasi.
- Adapter S3 masih template dan belum digunakan oleh evidence manager.
- Backup/restore evidence ditolak karena artifact file belum dicadangkan secara konsisten.
- Session production masih perlu dipindahkan dari default store ke persistent/distributed store.
- Belum ada sistem manajemen user; admin berasal dari environment variable dan demo user hanya untuk development/test.
- Browser E2E, penetration test, dan audit WCAG manual masih diperlukan sebelum menangani data nyata.

## Kontribusi

1. Buat branch untuk perubahan.
2. Pastikan `npm test`, `npm run check`, dan dependency audit lulus.
3. Jangan commit secret, `.env`, database, atau file evidence.
4. Sertakan test untuk perubahan pada autentikasi, laporan, evidence, atau lifecycle data.
