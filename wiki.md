# SafeSphere Codebase Wiki

## Ringkasan

SafeSphere adalah aplikasi web statis berbentuk single page application (SPA) untuk purwarupa pelaporan anonim anti-perundungan. Aplikasi berjalan langsung dari HTML, CSS, dan JavaScript tanpa build tool, backend, database nyata, atau package manager.

Fokus fitur saat ini:

- Pelaporan anonim dengan nomor pelacakan.
- Dashboard mahasiswa untuk melihat riwayat dan invoice/status laporan.
- Dashboard admin untuk melihat metrik, daftar laporan, detail kasus, dan update status.
- Edukasi anti-perundungan melalui materi dan simulasi bystander.
- SafeBot chat sederhana berbasis keyword risk detection.
- Quick escape/discreet mode ke halaman Wikipedia.
- Mode aksesibilitas: kontras tinggi, teks besar, dan ramah disleksia.

## Struktur Direktori

```text
/var/www/safesphere.my.id
├── public/                         # Direktori live/static yang disajikan web server
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── assets_placeholder
│   └── image/
│       └── logo2a.png
├── public.backup-20260611143651/   # Backup deploy sebelumnya
│   └── index.html
├── repo/                           # Git working repo/source utama
│   ├── .git/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── assets_placeholder
│   └── image/
│       └── logo2a.png
└── wiki.md                         # Dokumentasi ini
```

`repo/` adalah source yang di-commit. `public/` adalah copy live. Setelah mengubah `repo/`, sinkronkan file terkait ke `public/`.

## Git

Working repo berada di:

```bash
repo/
```

Remote saat ini:

```text
origin https://github.com/iggbudi/ppkpt.git
```

Commit terakhir saat dokumentasi ini dibuat:

```text
37845d2 Sync SafeBot chat and branding
```

Status terakhir setelah commit tersebut: branch `main` ahead `origin/main` sebanyak 1 commit dan belum dipush.

## File Utama

### `repo/index.html`

Berisi seluruh struktur UI aplikasi. Semua halaman SPA ada dalam satu file sebagai elemen:

- `#page-beranda`
- `#page-lapor`
- `#page-edukasi`
- `#page-kontak`
- `#page-chat`
- `#page-register`
- `#page-login`
- `#page-admin`
- `#page-dashboard`

Routing dilakukan berdasarkan `window.location.hash`, bukan routing server.

Bagian penting:

- CSP meta tag ada di `<head>`.
- Header menggunakan logo `image/logo2a.png`.
- Form laporan memakai `#reportForm`.
- SafeBot chat memakai `#chatMessages`, `#chatInput`, dan `#chatSendBtn`.
- Dashboard admin memakai `#categoryChart`, `#adminReportList`, dan modal `#reportDetailModal`.
- Dashboard user memakai `#userReportList` dan `#invoiceResult`.
- Widget aksesibilitas memakai `#a11yWidget`, `#a11yMenu`, dan `#a11yToggleBtn`.

### `repo/style.css`

Berisi semua styling aplikasi:

- CSS variables di `:root`.
- Reset dan layout global.
- Topbar, brand, tombol, form, cards.
- Hero section dan SDG section.
- Dashboard admin, report list, risk badge.
- Invoice dan timeline.
- SafeBot chat UI.
- Responsive media query.
- Accessibility override classes:
  - `body.a11y-high-contrast`
  - `body.a11y-large-text`
  - `body.a11y-dyslexia`

### `repo/app.js`

Berisi semua logic frontend. Tidak memakai module system.

Bagian utama:

- State global:
  - `currentUser`
  - `currentViewedInvoiceId`
  - `reportData`
  - `chartInstance`
- DOM helper:
  - `sanitizeInput`
  - `clearElement`
  - `createEl`
  - `setChildren`
  - `renderStrongPrefixMessage`
- Routing:
  - `handleRouting`
  - `setupEventListeners`
- Login/register simulasi:
  - `switchLoginTab`
  - `handleMainLogin`
  - `handleLogout`
  - `handleRegister`
- Laporan:
  - `submitReport`
  - `viewInvoiceFromSubmit`
  - `renderInvoice`
- Admin dashboard:
  - `initChart`
  - `seedDemoData`
  - `clearAllData`
  - `updateDashboardUI`
  - `viewReportDetail`
  - `saveReportStatus`
- User dashboard:
  - `updateUserDashboardUI`
- Edukasi:
  - `storyNodes`
  - `renderStoryNode`
- Quick escape:
  - `activateDiscreetMode`
  - `deactivateDiscreetMode`
- Aksesibilitas:
  - `toggleA11yMenu`
  - `toggleA11yFeature`
- Risk analysis:
  - `triggerDictionary`
  - `analyzeSentiment`
  - `getRiskScore`
- SafeBot:
  - `handleChatKeyDown`
  - `sendChatMessage`
  - `addChatMessage`
  - `processBotResponse`

## Alur Aplikasi

### Boot

Saat `DOMContentLoaded`:

1. `setupEventListeners()` memasang semua event listener.
2. `handleRouting()` membuka halaman berdasarkan hash.

Tidak ada inline event handler yang diperlukan untuk fitur utama. Pola ini menjaga compatibility dengan CSP.

### Routing

Routing berbasis hash:

```text
#beranda
#lapor
#edukasi
#kontak
#chat
#register
#login
#admin
#dashboard
```

Proteksi route:

- `#lapor` hanya bisa diakses jika ada `currentUser`.
- `#admin` hanya bisa diakses jika `currentUser.role === 'admin'`.
- `#dashboard` hanya bisa diakses jika `currentUser.role === 'mahasiswa'`.

Jika akses ditolak, user diarahkan ke `#login` dan muncul top alert.

## Autentikasi Simulasi

Tidak ada autentikasi backend. Login hanya mengubah object `currentUser` di memori browser.

Admin demo:

```text
username: admin
password: safesphere
```

Mahasiswa/umum:

- Username/email bebas.
- Password harus tidak kosong.
- Setelah login, role diset ke `mahasiswa`.

Logout menghapus `currentUser`, menyembunyikan nav user/admin, dan kembali ke `#beranda`.

## Data Laporan

Data laporan disimpan di array memori:

```js
let reportData = [];
```

Tidak ada persistence. Refresh browser akan menghapus laporan kecuali data demo di-seed ulang.

Format object laporan:

```js
{
  id: 'SSF-2026-1234',
  cat: 'Cyberbullying',
  loc: 'Grup WA Kelas',
  urg: 'Tinggi',
  date: '2026-06-08',
  status: 'Baru Masuk',
  desc: 'Kronologi',
  evidence: 'nama-file.png',
  appointment: 'Menunggu proses peninjauan awal...',
  createdAt: 1780000000000,
  author: 'Nama User',
  displayName: 'N***'
}
```

`author` dipakai untuk filter dashboard user. `displayName` dipakai untuk menampilkan nama yang disamarkan jika laporan anonim.

## Form Lapor

User harus login sebelum membuka `#lapor`.

Saat submit:

1. Button berubah menjadi status loading.
2. Nomor tracking dibuat random dengan format `SSF-2026-xxxx`.
3. Nama file bukti diambil dari input file, tetapi file tidak benar-benar diupload.
4. Nama pelapor disimpan sebagai `author`.
5. Jika anonim aktif, `displayName` menjadi format huruf pertama + `***`.
6. Object laporan dimasukkan ke `reportData`.
7. User mendapat tanda terima dan tombol untuk melihat invoice/status.

Catatan: label UI menyebut terenkripsi/end-to-end, tetapi di code saat ini tidak ada enkripsi nyata.

## Dashboard Admin

Admin membuka `#admin`.

Fitur:

- Metrik total laporan.
- Metrik laporan risiko tinggi.
- Metrik laporan selesai.
- Kategori dominan.
- Chart kategori menggunakan Chart.js dari CDN.
- Tombol `Isi Data Demo`.
- Tombol `Reset Data`.
- Daftar laporan.
- Modal detail kasus.
- Update status dan catatan tindak lanjut.

Status yang didukung:

- `Baru Masuk`
- `Direview`
- `Diproses`
- `Selesai`

Jika status diubah admin, dashboard admin dan dashboard user diperbarui dari state memori yang sama.

## Dashboard Mahasiswa

Mahasiswa membuka `#dashboard`.

Dashboard menampilkan laporan yang memenuhi:

```js
report.author === currentUser.name
```

User bisa klik laporan untuk membuka invoice/status. Timeline invoice disusun dari status laporan.

## SafeBot Chat

Halaman `#chat` menyediakan chat lokal berbasis keyword.

Input:

- `Enter` mengirim pesan.
- `Shift + Enter` membuat baris baru.
- Tombol `Kirim` juga mengirim pesan.

Alur:

1. User message ditambahkan ke `#chatMessages`.
2. Setelah delay pendek, `processBotResponse()` menganalisis teks.
3. `getRiskScore()` memakai `triggerDictionary.highRisk` dan `triggerDictionary.medRisk`.
4. Bot merespons berdasarkan skor:
   - Risiko tinggi: arahkan login/register jika belum login, atau arahkan ke `#lapor` jika sudah login.
   - Risiko sedang: sarankan simpan bukti dan lapor anonim.
   - Intent sederhana: salam, terima kasih, bantuan, emosi.
   - Default: respons empatik random.

Implementasi pesan bot menggunakan DOM helper, bukan `innerHTML`, agar lebih aman dan sesuai CSP.

## Sentiment/Risk Analysis

Risk detection memakai keyword dictionary:

- `highRisk`: kekerasan fisik, pelecehan seksual, ancaman nyawa, self-harm, doxing, dan sejenisnya.
- `medRisk`: hinaan, pengucilan, fitnah, cyberbullying, intimidasi, dan sejenisnya.

Pada form laporan, `analyzeSentiment()`:

- Mengubah progress bar risiko.
- Mengubah label risiko.
- Otomatis mengatur dropdown urgensi ke `Sedang` atau `Tinggi` jika kata kunci terdeteksi.

SafeBot menggunakan dictionary yang sama melalui `getRiskScore()`.

## Edukasi dan Simulasi

Halaman `#edukasi` punya materi dan simulasi bystander.

Simulasi dikendalikan oleh object `storyNodes`. Tiap node punya:

- `text`
- `options`
- `feedback`

`renderStoryNode()` mengganti teks, tombol opsi, dan feedback dengan efek fade.

## Quick Escape / Discreet Mode

Ada dua cara aktif:

- Klik tombol `Tutup Cepat (Esc 2x)`.
- Tekan `Escape` dua kali dalam 1 detik.

Efek:

- Overlay fullscreen muncul.
- Iframe Wikipedia Indonesia ditampilkan.
- Tombol panic disembunyikan.
- Title tab berubah menjadi `Wikipedia bahasa Indonesia`.

Tombol `X` di overlay mengembalikan aplikasi.

## Aksesibilitas

Widget aksesibilitas ada di kiri bawah.

Mode:

- Kontras Tinggi: menambah kontras warna.
- Perbesar Teks: memperbesar font dan kontrol.
- Ramah Disleksia: mengganti font dan spacing.

Mode disimpan hanya di DOM class selama sesi halaman. Tidak ada persistence ke localStorage.

## Content Security Policy

Meta CSP saat ini:

```html
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline';
frame-src https://id.wikipedia.org;
object-src 'none';
base-uri 'self';
form-action 'self';
```

Implikasi:

- Script lokal dan Chart.js CDN diizinkan.
- Inline style masih diizinkan karena HTML masih banyak memakai `style="..."`.
- Inline JS event handler sebaiknya tetap dihindari.
- Iframe hanya mengizinkan Wikipedia Indonesia untuk discreet mode.

## Dependency Eksternal

Satu dependency runtime eksternal:

```html
https://cdn.jsdelivr.net/npm/chart.js
```

Jika CDN tidak bisa diakses, dashboard admin tetap tampil tetapi chart dapat gagal.

## Deployment Manual

Karena tidak ada build step, deploy berarti menyalin file dari `repo/` ke `public/`.

Contoh:

```bash
rtk sudo install -o www-data -g www-data -m 0644 repo/index.html public/index.html
rtk sudo install -o www-data -g www-data -m 0644 repo/style.css public/style.css
rtk sudo install -o www-data -g www-data -m 0644 repo/app.js public/app.js
rtk sudo install -d -o www-data -g www-data public/image
rtk sudo install -o www-data -g www-data -m 0644 repo/image/logo2a.png public/image/logo2a.png
```

Verifikasi source dan live identik:

```bash
rtk diff -qr public repo
```

Output normal hanya:

```text
Only in repo: .git
```

## Cara Test Manual

### Routing

1. Buka `#beranda`.
2. Buka `#lapor` tanpa login.
3. Pastikan diarahkan ke `#login`.
4. Login sebagai mahasiswa.
5. Buka `#lapor`, `#dashboard`, `#chat`.

### Login Admin

1. Buka `#login`.
2. Pilih tab admin.
3. Login dengan `admin` / `safesphere`.
4. Pastikan masuk `#admin`.

### Laporan

1. Login sebagai mahasiswa.
2. Buat laporan.
3. Pastikan nomor tracking muncul.
4. Klik tombol lacak.
5. Pastikan invoice muncul di dashboard.

### Admin

1. Login admin.
2. Klik `Isi Data Demo`.
3. Pastikan metrik dan chart berubah.
4. Klik laporan.
5. Ubah status.
6. Pastikan modal tertutup dan daftar diperbarui.

### SafeBot

1. Buka `#chat`.
2. Kirim `halo`.
3. Kirim kalimat normal panjang.
4. Kirim keyword sedang seperti `diejek`.
5. Kirim keyword tinggi seperti `dipukul` atau `diancam`.
6. Test saat belum login dan saat sudah login.

### Quick Escape

1. Tekan `Escape` dua kali cepat.
2. Pastikan overlay Wikipedia muncul.
3. Klik `X`.
4. Pastikan aplikasi kembali.

## Keterbatasan Saat Ini

- Tidak ada backend.
- Tidak ada database persistent.
- Tidak ada autentikasi nyata.
- Tidak ada upload file nyata.
- Tidak ada enkripsi end-to-end nyata.
- `sanitizeInput()` hanya melakukan `trim()`, bukan sanitasi penuh. Keamanan XSS terutama dijaga dengan penggunaan `textContent` dan DOM construction.
- Chart.js bergantung pada CDN.
- Banyak inline style masih ada, sehingga CSP masih butuh `style-src 'unsafe-inline'`.
- State aplikasi hilang saat refresh.

## Rekomendasi Lanjutan

1. Tambahkan persistence minimal dengan `localStorage` atau backend kecil.
2. Pindahkan inline style ke CSS agar CSP bisa diperketat.
3. Vendor Chart.js lokal atau tambah fallback saat CDN gagal.
4. Tambahkan test browser otomatis sederhana untuk routing dan form utama.
5. Pisahkan `app.js` menjadi modul jika aplikasi mulai membesar.
6. Jika klaim enkripsi tetap dipakai di UI, implementasikan enkripsi nyata atau ubah copy agar tidak misleading.
