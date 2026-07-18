# SafeSphere Codebase Wiki

Terakhir diperbarui: 14 Juni 2026

## Ringkasan

SafeSphere adalah aplikasi web **pelaporan anti-perundungan** berbasis SPA (hash routing) dengan backend Express + SQLite. Frontend statis tanpa build tool; backend Node.js melayani API dan static files.

Fokus fitur saat ini:

- Pelaporan anonim dan rahasia dengan workflow status.
- Dashboard mahasiswa dan admin.
- SafeBot chat via backend + Xiaomi MiMo (dengan risk classifier lokal).
- Unggah bukti (development/test; dinonaktifkan di production).
- Edukasi anti-perundungan + simulasi bystander.
- Quick escape, mode aksesibilitas, responsive navigation.

> **Status:** Pilot siap (Sprint 0–5 selesai + release gate ✅). Lihat progress.md untuk detail dan item pasca-pilot.

## Arsitektur Deployment

```text
Browser (HTTPS)
    |
    v
Apache (safesphere.my.id)
    |-- /           --> /var/www/safesphere.my.id/public/  (static)
    |-- /api/*      --> http://127.0.0.1:3000/api/         (Node.js)
                            |
                            +-- SQLite: repo/data/safesphere.db
                            +-- Evidence: repo/data/evidence/
```

Backend dijalankan via PM2 (`safesphere-chat`) dari `repo/server/index.js`.

## Struktur Direktori

```text
/var/www/safesphere.my.id
├── public/              # Live site (disajikan Apache)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── js/              # Modul frontend terpisah
│   └── image/
├── repo/                # Git repo utama
│   ├── public/          # Source frontend (sinkronkan ke ../public/)
│   ├── server/          # Backend Express
│   │   ├── index.js
│   │   ├── auth.js
│   │   ├── reports.js
│   │   ├── evidence.js
│   │   └── test/
│   ├── data/            # SQLite + file evidence
│   └── docs/
├── docs/                # Dokumentasi rencana (roadmap, responsive nav)
├── plan.md              # Plan MVP chat (SELESAI)
└── wiki.md              # Dokumen ini
```

## Sinkronisasi Deploy

Setelah mengubah frontend di `repo/public/`:

```bash
sudo install -o www-data -g www-data -m 0644 repo/public/app.js public/app.js
sudo install -o www-data -g www-data -m 0644 repo/public/index.html public/index.html
sudo install -o www-data -g www-data -m 0644 repo/public/style.css public/style.css
# Ulangi untuk file js/ yang berubah
```

Setelah mengubah backend:

```bash
cd repo/server
pm2 restart safesphere-chat
```

## Git

```bash
cd /var/www/safesphere.my.id/repo
```

Remote: `https://github.com/iggbudi/ppkpt.git`

## Frontend

### Routing

Hash-based SPA: `#beranda`, `#lapor`, `#edukasi`, `#kontak`, `#chat`, `#login`, `#register`, `#admin`, `#dashboard`.

### File utama

| File | Peran |
|------|-------|
| `index.html` | Seluruh struktur UI (~825 baris) |
| `style.css` | Styling + a11y overrides |
| `app.js` | Routing, navigasi, sidebar, state global |
| `js/auth.js` | Login/logout via `/api/auth/*` |
| `js/reports.js` | Submit laporan + upload bukti |
| `js/admin.js` | Dashboard admin + Chart.js |
| `js/chat.js` | SafeBot via `/api/chat` |
| `js/edukasi.js` | Simulasi bystander |
| `js/safety.js` | Quick escape (2x ESC) |
| `js/evidence-upload.js` | Validasi & preview file |
| `js/a11y.js` | Widget aksesibilitas |
| `js/utils.js` | DOM helpers |

Script load order di `index.html`: `storage.js` → `utils.js` → modul → `app.js`.

## Backend

### Stack

Node.js, Express 4, better-sqlite3, bcryptjs, helmet, zod, multer, sharp.

### API utama

| Area | Endpoint |
|------|----------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `logout`, `GET /api/auth/me` |
| Reports | `POST/GET /api/reports`, `PATCH /api/reports/:id/status` |
| Evidence | `GET/POST /api/reports/:id/evidence`, download, delete |
| Chat | `POST /api/chat` |
| Admin | audit, backup, restore, deletion, legal hold, monitoring |

### Auth

- Admin: `ADMIN_USERNAME` / `ADMIN_PASSWORD` dari `.env`
- Demo (dev/test only): `demo` / `demo123`
- Session cookie: HttpOnly, SameSite=Strict, Secure di production

### Workflow laporan

`Baru Masuk` → `Direview` → `Diproses` → `Selesai`

## Testing

```bash
cd repo/server
npm test    # 43 test (kontrak, E2E, keamanan, evidence, chat)
```

## Konfigurasi Production

File: `repo/server/.env`

| Variable | Keterangan |
|----------|------------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Min 32 karakter |
| `ADMIN_USERNAME/PASSWORD` | Kredensial bootstrap admin |
| `MIMO_API_KEY` | API key Xiaomi MiMo |
| `TRUST_PROXY` | `1` (Apache reverse proxy) |
| `EVIDENCE_UPLOADS_ENABLED` | `true` untuk production setelah encryption key dan scanner strict dikonfigurasi |
| `EVIDENCE_ENCRYPTION_KEY` | Kunci enkripsi evidence; wajib jika upload production aktif |
| `EVIDENCE_SCANNER_MODE` | `strict` untuk production |

## Batasan Pilot dan Backlog

Lihat `progress.md` untuk status lengkap. Ringkas:

- OTP, reset password, dan social login sengaja belum tersedia.
- Session persisten menggunakan SQLite dan sesuai untuk pilot single-node.
- Storage lokal terenkripsi tersedia; adapter S3 bersifat opsional.
- Browser E2E dan audit WCAG manual tersedia; pentest eksternal belum dilakukan.
- Multi-kampus, live handoff operator, dan RAG SOP ditunda sampai pasca-pilot.

## Dokumentasi Terkait

- `README.md` — dokumentasi teknis lengkap
- `progress.md` — status maintenance dan backlog
- `docs/DEPLOYMENT.md` — panduan deploy
- `docs/THREAT-MODEL.md` — threat model