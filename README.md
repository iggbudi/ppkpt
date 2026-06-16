# SafeSphere

SafeSphere adalah aplikasi web untuk purwarupa pelaporan anonim anti-perundungan di lingkungan kampus. Aplikasi menyediakan form laporan, dashboard pelapor, dashboard admin, materi edukasi, mode aksesibilitas, quick escape, dan SafeBot berbasis AI untuk membantu pengguna mengenali risiko awal serta mengarahkan langkah berikutnya.

## Fitur Utama

- **Pelaporan anonim** dengan nomor pelacakan laporan.
- **Dashboard mahasiswa** untuk melihat riwayat dan status laporan.
- **Dashboard admin** untuk melihat metrik, daftar laporan, detail kasus, dan mengubah status laporan.
- **SafeBot chat** yang tersambung ke backend dan model LLM`.
- **Risk classifier backend** untuk mendeteksi pesan risiko tinggi tanpa bergantung penuh pada LLM.
- **Edukasi anti-perundungan** dan simulasi bystander.
- **Quick escape / discreet mode** ke Wikipedia.
- **Mode aksesibilitas**: kontras tinggi, perbesar teks, ramah disleksia.

## Arsitektur

Project ini terdiri dari dua bagian:

```text
Browser / Frontend statis
  ├─ public/index.html
  ├─ public/style.css
  └─ public/app.js
        │
        │ fetch('/api/chat')
        ▼
Node.js Backend
  └─ repo/server
        ├─ Express API
        ├─ Risk classifier
        └─ LLM Provider client
        │
        ▼
     LLM API
```

### Frontend

Frontend adalah SPA statis tanpa build step. Semua halaman berada di `index.html` dan routing memakai hash URL:

- `#beranda`
- `#lapor`
- `#edukasi`
- `#kontak`
- `#chat`
- `#register`
- `#login`
- `#admin`
- `#dashboard`

Logic utama berada di `app.js`. Styling utama berada di `style.css`.

### Backend Chat

Backend berada di `server/` dan menyediakan endpoint:

- `GET /api/health`
- `POST /api/chat`

Alur `POST /api/chat`:

1. Validasi input pesan.
2. Terapkan rate limit sederhana berbasis memori.
3. Jalankan risk classifier.
4. Jika risiko tinggi, langsung balas template darurat tanpa memanggil LLM.
5. Jika risiko rendah/sedang, panggil LLM.
6. Jika LLM gagal, balas fallback aman.

## Struktur Direktori

```text
repo/
├── index.html              # Struktur UI SPA
├── style.css               # Styling utama
├── app.js                  # Logic frontend
├── image/                  # Asset gambar
├── server/                 # Backend chat SafeBot
│   ├── index.js            # Express server dan route API
│   ├── mimoClient.js       # Client Xiaomi MiMo-compatible API
│   ├── risk.js             # Risk classifier
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   └── test/
│       └── chat.test.js
└── README.md
```

Di server produksi saat ini, `public/` adalah copy live dari file frontend di `repo/`.

## Prasyarat

- Node.js 18+ direkomendasikan. Server saat ini memakai Node.js 24.
- npm.
- Apache/Nginx atau reverse proxy lain untuk meneruskan `/api/` ke backend Node.js.
- API key Xiaomi MiMo.

## Instalasi Lokal

Clone repo:

```bash
git clone https://github.com/iggbudi/ppkpt.git
cd ppkpt
```

Install dependency backend:

```bash
cd server
npm install
```

Buat file environment:

```bash
cp .env.example .env
```

Isi `.env`:

```env
PORT=3000
HOST=127.0.0.1
API_KEY=isi_api_key_llm openAI Compatible
BASE_URL=https://base-url-open-ai-compatible/v1
MODEL=tuliskan_model_disini
TIMEOUT_MS=20000
CHAT_RATE_LIMIT_WINDOW_MS=60000
CHAT_RATE_LIMIT_MAX=60
```

Jalankan backend:

```bash
npm start
```

Test health:

```bash
curl http://127.0.0.1:3000/api/health
```

Untuk membuka frontend secara lokal, sajikan root repo dengan static server. Contoh:

```bash
cd ..
python3 -m http.server 8080
```

Lalu buka:

```text
http://127.0.0.1:8080/#chat
```

Catatan: jika frontend lokal berjalan di port berbeda dari backend, perlu proxy `/api/` atau penyesuaian CORS/development server.

## Menjalankan Test

Dari folder `server/`:

```bash
npm run check
npm test
```

Test mencakup:

- klasifikasi risiko rendah/sedang/tinggi,
- high-risk response tanpa dependency model,
- validasi input,
- rate limit,
- perlindungan dari bypass `X-Forwarded-For`.

## Deployment Produksi

### 1. Sinkronkan frontend ke direktori live

Pada server saat ini, source ada di `repo/` dan live static ada di `public/`:

```bash
sudo install -o www-data -g www-data -m 0644 repo/index.html public/index.html
sudo install -o www-data -g www-data -m 0644 repo/style.css public/style.css
sudo install -o www-data -g www-data -m 0644 repo/app.js public/app.js
```

### 2. Jalankan backend dengan PM2

```bash
cd /var/www/safesphere.my.id/repo/server
npm install
pm2 start index.js --name safesphere-chat
pm2 save
```

Restart setelah update:

```bash
pm2 restart safesphere-chat --update-env
```

### 3. Reverse proxy Apache

Tambahkan ke vhost SSL:

```apache
ProxyPreserveHost On
ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/
```

Lalu reload Apache:

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

## Akun Demo

Admin demo:

```text
username: admin
password: safesphere
```

Login mahasiswa/umum masih simulasi frontend. Username/email bebas, password tidak boleh kosong.

## Batasan Saat Ini

- Login/register masih simulasi di frontend.
- Data laporan masih disimpan di memori browser dan hilang saat refresh.
- Upload bukti belum benar-benar mengirim file ke server.
- Belum ada database untuk laporan/chat.
- Belum ada dashboard ahli/operator manusia.
- Klaim enkripsi pada beberapa teks UI masih bersifat purwarupa, belum implementasi enkripsi end-to-end nyata.
- Rate limit backend masih in-memory, reset saat proses restart.

## Keamanan

- Jangan commit `.env` atau API key.
- `.gitignore` sudah mengecualikan `.env`, `.env.*`, dan `node_modules/`.
- SafeBot tidak memakai `innerHTML` untuk merender output LLM; markdown ringan dirender via DOM node agar lebih aman.
- Pesan risiko tinggi tidak diserahkan sepenuhnya ke LLM, tetapi dibalas dengan template safety backend.

## Roadmap Singkat

- Tambah database untuk persistence laporan dan chat.
- Tambah autentikasi backend/JWT.
- Tambah dashboard ahli/operator untuk handoff kasus risiko tinggi.
- Tambah RAG berbasis SOP/kebijakan kampus.
- Pindahkan inline style ke CSS agar CSP bisa diperketat.
- Implementasikan upload file dan penyimpanan bukti secara aman.
