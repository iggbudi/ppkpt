# Rencana Improvement SafeSphere

Tanggal audit: 13 Juni 2026  
Cakupan: source frontend, backend Express, konfigurasi, dependensi, test, keamanan aplikasi, privasi, safety flow, UI/UX, dan aksesibilitas.

## Ringkasan Eksekutif

SafeSphere saat ini adalah prototipe frontend yang cukup baik untuk mendemonstrasikan konsep, tetapi **belum layak dipakai untuk menerima laporan nyata atau data sensitif**.

Risiko utamanya bukan hanya bug teknis. UI menyatakan laporan anonim, terenkripsi end-to-end, terverifikasi, dan diproses real-time, sementara implementasinya masih menyimpan identitas serta laporan mentah di `localStorage`, tidak mengunggah bukti, tidak memiliki backend laporan, dan tidak memiliki autentikasi server. Hal ini menciptakan risiko keamanan, privasi, dan kepercayaan pengguna yang sangat tinggi untuk aplikasi penanganan perundungan.

Prioritas perbaikan:

1. Hentikan eksposur file internal dan perbaiki bug safety risiko tinggi.
2. Selaraskan semua klaim UI dengan kemampuan produk yang nyata.
3. Pindahkan autentikasi, otorisasi, laporan, status, dan bukti ke backend yang aman.
4. Desain ulang alur pelaporan agar benar-benar mendukung pilihan anonim atau rahasia.
5. Penuhi aksesibilitas WCAG 2.2 AA dan lakukan pengujian lintas perangkat.
6. Terapkan governance untuk AI, data sensitif, operasional, dan respons insiden.

## Metode dan Batasan Audit

Audit dilakukan melalui:

- Review seluruh source yang relevan.
- Review konfigurasi CSP, static serving, penyimpanan, autentikasi, dan alur data.
- Pengujian respons server lokal dan file yang dapat diakses publik.
- `npm audit` pada root dan backend.
- `npm test` dan `npm run check`.
- Review statis DOM, CSS responsif, event handling, ARIA, dan alur UX.

Batasan:

- Otomasi browser lokal gagal diinisialisasi pada sandbox Windows, sehingga visual QA langsung belum dilakukan.
- Belum ada environment produksi, database, object storage, atau konfigurasi deployment untuk diaudit.
- Belum dilakukan penetration test aktif terhadap deployment publik.

## Baseline Positif

- API key MiMo berada di backend, bukan di source frontend.
- `/api/chat` membatasi body JSON dan panjang pesan.
- Kasus risiko tinggi ditangani template lokal tanpa menunggu LLM.
- Output LLM pada chat dirender menggunakan DOM helper, bukan `innerHTML`.
- Ada rate limit dasar untuk endpoint chat.
- Ada CSP dasar pada HTML, walaupun belum cukup kuat.
- Enam test backend lulus.
- `npm audit` root dan backend melaporkan 0 vulnerability pada 13 Juni 2026.

## Temuan Kritis

### P0-1: Model keamanan utama hanya berjalan di browser

**Bukti**

- Role admin dan user dibaca dari `localStorage`: `app.js:219-229`.
- Kredensial admin hard-coded di frontend: `js/auth.js:19`, `js/auth.js:46-54`.
- Otorisasi halaman admin hanya berupa pemeriksaan object JavaScript: `app.js:19-23`.
- Laporan dan perubahan status hanya disimpan ke `localStorage`: `js/reports.js:42`, `js/admin.js:140`.

**Dampak**

- Pengguna dapat mengubah role menjadi admin dari DevTools.
- Pengguna dapat membaca atau mengubah laporan pada browser yang sama.
- Tidak ada isolasi data antar pengguna, audit trail, kontrol akses server, atau sumber data yang dapat dipercaya.
- Dashboard admin bukan dashboard lintas pengguna; hanya membaca data browser lokal.

**Perbaikan**

- Implementasikan autentikasi dan otorisasi server-side.
- Gunakan session cookie `HttpOnly`, `Secure`, dan `SameSite`, bukan role dari `localStorage`.
- Seluruh CRUD laporan dan perubahan status harus melalui API dengan RBAC.
- Tambahkan audit log append-only untuk aktivitas admin.

### P0-2: Klaim privasi dan fungsi tidak sesuai implementasi

**Bukti**

- UI menyatakan enkripsi end-to-end: `index.html:192`, `index.html:245`, `js/reports.js:47-54`.
- Nama asli tetap disimpan sebagai `author` walaupun checkbox anonim aktif: `js/reports.js:20-36`.
- Laporan mentah disimpan di `localStorage`: `js/storage.js`.
- Upload bukti hanya menyimpan nama file: `js/reports.js:14-17`, `js/reports.js:34`.
- Registrasi, OTP, dan social login hanya simulasi tetapi tampil seperti fitur aktif: `js/auth.js:100-132`, `js/auth.js:174-230`, `app.js:181-194`.
- Kontak darurat masih placeholder: `index.html:302-304`.

**Dampak**

- Pengguna dapat mengambil keputusan keselamatan berdasarkan informasi yang tidak nyata.
- Pengguna dapat memasukkan password asli ke form demo yang tidak memiliki sistem akun.
- Pengguna mengira laporan sudah dikirim dan bukti sudah diamankan, padahal tidak.
- Klaim end-to-end encryption tidak benar. Jika admin harus membaca laporan, istilah yang tepat biasanya adalah encryption in transit dan encryption at rest, bukan end-to-end.

**Perbaikan**

- Sebelum backend selesai, tampilkan banner jelas: **Demo/Prototipe - jangan masukkan data nyata**.
- Hapus atau ubah semua klaim anonim, terenkripsi, real-time, terverifikasi, OTP, dan upload agar sesuai kondisi nyata.
- Jangan meminta password pada mode demo.
- Isi kontak darurat dari konfigurasi organisasi yang tervalidasi dan memiliki owner.
- Definisikan dua mode yang jelas:
  - **Anonim**: tidak membutuhkan login dan identitas tidak dikumpulkan.
  - **Rahasia/terautentikasi**: identitas disimpan dengan akses sangat terbatas.

### P0-3: Server mempublikasikan file internal dan tidak memiliki security headers

**Bukti**

- Static server menunjuk ke root repository: `server/index.js:19`.
- Pengujian lokal mengembalikan HTTP 200 untuk:
  - `/package.json`
  - `/server/index.js`
  - `/docs/compose/specs/2026-06-13-safebot-llm-design.md`
  - `/.git/config`
- Respons server tidak memiliki header `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, atau `X-Content-Type-Options`.
- CSP hanya dipasang sebagai meta tag: `index.html:5`.

**Dampak**

- Source backend, metadata, dokumen desain, remote Git, dan kemungkinan history/object Git dapat direkonstruksi oleh pihak luar.
- Aplikasi rentan clickjacking karena `frame-ancestors` tidak dapat diandalkan melalui meta CSP.
- Informasi internal mempermudah serangan lanjutan.

**Perbaikan segera**

- Sajikan hanya direktori `public/`, bukan root repository.
- Tolak semua dotfiles dan path internal secara eksplisit.
- Pastikan `.git`, `server`, `docs`, `.env*`, package metadata, dan test tidak ikut artifact deployment.
- Gunakan `helmet` dan kirim CSP melalui response header.
- Tambahkan minimal:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Strict-Transport-Security` pada HTTPS
  - `frame-ancestors 'none'` atau origin yang benar-benar dibutuhkan

### P0-4: Fallback chat gagal mengenali pesan risiko tinggi

**Bukti**

- `getRiskScore()` mengembalikan angka: `js/safety.js:51-64`.
- Catch handler memperlakukannya sebagai object dengan `.score` dan `.foundHighRisk`: `js/chat.js:104-105`.

**Dampak**

Ketika backend tidak dapat dihubungi, pesan risiko tinggi tidak masuk ke cabang respons darurat yang seharusnya menampilkan aksi kontak darurat dan laporan.

**Perbaikan segera**

- Jadikan kontrak classifier konsisten dan teruji.
- Gunakan satu implementasi classifier sebagai sumber kebenaran.
- Tambahkan test frontend untuk kondisi backend offline dan pesan risiko tinggi.
- Pastikan fallback tetap menampilkan jalur bantuan yang valid dan sudah diverifikasi.

## Temuan Keamanan dan Privasi Prioritas Tinggi

### P1-1: Data sensitif persisten tanpa proteksi

- `currentUser` dan seluruh laporan disimpan permanen di `localStorage`.
- Logout hanya menghapus user aktif, bukan laporan sensitif.
- Quick escape hanya menutup tampilan; data dan history tetap ada.
- Setiap script pada origin yang sama dapat membaca data tersebut.

**Rencana**

- Jangan menyimpan laporan sensitif di `localStorage`.
- Gunakan backend dengan encryption at rest, kebijakan retensi, dan penghapusan.
- Simpan draft hanya jika pengguna memilih secara eksplisit; berikan expiry singkat.
- Tambahkan mode perangkat bersama dan pembersihan state sensitif.

### P1-2: Data laporan dirender melalui HTML dinamis

**Bukti**

- `innerHTML`/`insertAdjacentHTML` dipakai untuk daftar dan detail laporan: `js/reports.js:88-133`, `js/admin.js:73-113`.
- `Storage.load()` mempercayai struktur dan isi data dari browser.

**Risiko**

Sanitasi input saat submit tidak cukup sebagai boundary keamanan. Data yang berasal dari storage, API, migrasi, atau admin harus dianggap tidak tepercaya. Pola ini akan menjadi stored XSS ketika data laporan dipindahkan ke backend atau CSP berubah.

**Rencana**

- Render semua data dinamis dengan `textContent`/DOM helper.
- Validasi schema input dan output.
- Gunakan CSP ketat tanpa inline handler dan tanpa `unsafe-inline`.
- Tambahkan test payload XSS untuk semua field laporan dan catatan admin.

### P1-3: CSP dan event handler tidak konsisten

- CSP tidak mengizinkan inline script.
- HTML masih memiliki `onmouseover`/`onmouseout`: `index.html:17`.
- Daftar laporan membuat `onclick` inline secara dinamis: `js/reports.js`, `js/admin.js`.

**Dampak**

Selain memperlemah maintainability, handler dinamis tersebut berpotensi diblokir CSP sehingga klik daftar laporan/detail tidak berfungsi.

**Rencana**

- Hapus seluruh inline event handler.
- Gunakan event delegation dan elemen semantik `<button>` atau `<a>`.
- Pin/self-host Chart.js dan gunakan SRI jika tetap memakai CDN.
- Hapus `style-src 'unsafe-inline'` setelah inline style dimigrasikan.

### P1-4: Endpoint AI dapat disalahgunakan dan rate limit belum production-grade

- `/api/chat` dapat dipanggil anonim dan berpotensi menghabiskan kuota provider.
- Rate limit memakai `Map` in-memory tanpa cleanup periodik: `server/index.js:14`, `server/index.js:41-68`.
- `trust proxy` selalu `false`: `server/index.js:16`; di belakang reverse proxy semua user dapat terlihat sebagai satu IP.
- Rate limit tidak shared antar instance.

**Rencana**

- Tambahkan abuse protection berbasis risiko, session, IP yang tervalidasi, dan batas biaya.
- Gunakan external rate-limit store untuk deployment multi-instance.
- Konfigurasikan `trust proxy` sesuai topologi deployment.
- Bersihkan entry expired dan tambahkan observability atas 429/provider cost.
- Pertimbangkan challenge/captcha yang aksesibel hanya ketika abuse terdeteksi.

### P1-5: PII dikirim ke provider LLM tanpa consent yang jelas

- Frontend mengirim nama dan role user: `js/chat.js:81-84`.
- Backend memasukkan nama ke system context dan mengirimnya ke provider: `server/mimoClient.js:51-73`.
- UI menyebut chat aman dan anonim: `index.html:312-322`.

**Rencana**

- Jangan kirim nama atau identifier ke LLM secara default.
- Berikan disclosure sebelum chat: data apa yang dikirim, ke provider mana, tujuan, retensi, dan batasannya.
- Minta consent eksplisit untuk pemrosesan AI.
- Terapkan redaksi PII sebelum request provider.
- Review kontrak provider, lokasi data, retention, dan penggunaan data untuk training.
- Sediakan jalur non-AI dan human handoff.

### P1-6: Tracking ID lemah dan berpotensi bentrok

- ID menggunakan tahun hard-coded dan hanya 9.000 kemungkinan random: `js/reports.js:13`.
- Tidak ada pemeriksaan collision.

**Rencana**

- Gunakan ID publik berentropi tinggi yang dihasilkan server, misalnya UUID/ULID plus tracking secret terpisah.
- Jangan gunakan tracking ID sebagai satu-satunya authorization factor.
- Tambahkan expiry, rate limit, dan audit untuk akses tracking anonim.

## Temuan UI/UX dan Aksesibilitas

### UX-1: Alur anonim bertentangan dengan kewajiban login

Menu bernama "Lapor Anonim", tetapi route memaksa login. Setelah login, nama asli tetap disimpan pada laporan. Ini membuat mental model pengguna tidak konsisten.

**Rencana**

- Pada awal alur, tampilkan pilihan:
  - Lapor anonim tanpa akun.
  - Lapor rahasia dengan akun untuk memantau status.
- Jelaskan konsekuensi setiap pilihan sebelum pengguna mengisi kronologi.
- Gunakan copy yang konkret: siapa yang dapat melihat identitas, data apa yang disimpan, dan berapa lama.

### UX-2: Form laporan belum safety-first

- Pemeriksaan risiko hanya mengubah urgency secara otomatis.
- Saat teks dihapus, urgency tidak dikembalikan ke kondisi sebelumnya.
- Classifier frontend memakai substring sederhana dan berbeda dari backend.
- Tidak ada langkah awal "apakah Anda dalam bahaya sekarang?".
- Tanggal masa depan, ukuran file, dan jenis file belum divalidasi sesuai copy.
- `accept` mengizinkan DOC/DOCX, tetapi helper hanya menyebut JPG, PNG, PDF.

**Rencana**

- Tambahkan safety check sebagai langkah pertama dengan aksi darurat yang valid.
- Gunakan form bertahap: keselamatan, kejadian, bukti, identitas/anonimitas, review, submit.
- Jelaskan saat sistem menyarankan perubahan urgency dan izinkan pengguna mengoreksi.
- Tambahkan validasi ukuran, MIME type, malware scan, metadata stripping, dan progress upload.
- Hindari meminta detail traumatis yang tidak diperlukan.
- Tambahkan review page sebelum submit.

### UX-3: Quick escape belum benar-benar aman

- Quick escape hanya menampilkan iframe Wikipedia dan mengganti title.
- URL/browser history tetap menunjukkan SafeSphere.
- Data sensitif tetap berada di halaman dan `localStorage`.
- Iframe pihak ketiga dapat gagal karena kebijakan framing pihak tersebut.

**Rencana**

- Definisikan threat model quick escape.
- Arahkan ke URL netral yang dapat dikonfigurasi dan telah diuji.
- Bersihkan state sensitif sementara jika sesuai pilihan pengguna.
- Jangan bergantung pada iframe pihak ketiga.
- Uji dengan keyboard, mobile, browser history, dan shared-device scenario.

### UX-4: Kontak darurat dan human handoff belum actionable

- Nomor kontak masih placeholder.
- Kontak hanya berupa teks, bukan link `tel:`.
- Chat menyarankan kontak darurat yang belum dapat digunakan.

**Rencana**

- Kelola kontak melalui konfigurasi per institusi dengan owner dan tanggal verifikasi.
- Tambahkan tombol telepon, salin nomor, dan kanal alternatif.
- Tampilkan jam layanan serta ekspektasi respons.
- Sediakan fallback nasional/lokal yang telah diverifikasi oleh pemilik produk.
- Audit copy bersama ahli PPKS, konselor, dan legal.

### UX-5: Status, registrasi, dan login menyesatkan pada mode demo

- Registrasi menyatakan akun terverifikasi tetapi tidak menyimpan akun.
- OTP selalu menyatakan terkirim.
- Social login tampak aktif tetapi hanya placeholder.
- Status laporan terlihat real-time walaupun hanya state browser lokal.

**Rencana**

- Pada demo, gunakan data sintetis dan label "simulasi".
- Disable atau sembunyikan kontrol yang tidak berfungsi.
- Pada produk nyata, tampilkan state loading, success, error, retry, dan support path yang faktual.

### A11Y-1: Navigasi SPA tidak mengelola fokus dan konteks

- Perubahan hash tidak memindahkan fokus ke heading halaman.
- `document.title` tidak berubah per route.
- Active navigation tidak memiliki `aria-current`.
- Sidebar tidak memiliki `aria-expanded`, focus trap, atau close-on-Escape.
- Tidak ada skip link.

**Rencana**

- Setelah route berubah, update title dan fokuskan heading utama.
- Tambahkan skip link dan landmark yang jelas.
- Kelola `aria-current`, `aria-expanded`, dan focus return.
- Buat sidebar mobile sebagai disclosure/dialog yang dapat dioperasikan keyboard.

### A11Y-2: Modal dan kontrol klik belum semantik

- Modal tidak memiliki `role="dialog"`, `aria-modal`, label, focus trap, atau focus return.
- Tombol close modal berupa `<span>`: `index.html:450`, `index.html:513`.
- Report item yang dapat diklik berupa `<div>` tanpa keyboard semantics: `style.css:897-914`.
- Tab login tidak menggunakan semantics tab atau state terpilih.

**Rencana**

- Gunakan `<dialog>` atau implementasi dialog aksesibel.
- Gunakan `<button>` untuk close dan report item action.
- Tambahkan keyboard activation, focus ring, dan accessible name.
- Implementasikan tab pattern yang benar atau gunakan kontrol sederhana yang lebih mudah.

### A11Y-3: Status dinamis dan form feedback belum konsisten

- Toast dibuat tanpa `role="status"`/`role="alert"`.
- Error form tidak dihubungkan dengan `aria-describedby` dan `aria-invalid`.
- Chat textarea hanya memiliki placeholder, tanpa label.
- Chart admin tidak memiliki alternatif tabel/ringkasan.
- Widget aksesibilitas tidak memiliki `aria-expanded` atau `aria-pressed`.

**Rencana**

- Gunakan live region yang tepat dan jangan hanya mengandalkan warna.
- Hubungkan error ke field terkait dan fokuskan error summary.
- Tambahkan label chat, counter karakter, serta status pengiriman.
- Sediakan tabel/ringkasan untuk chart.
- Persist preferensi aksesibilitas non-sensitif dan expose state kontrol.

### A11Y-4: Motion dan focus style belum lengkap

- Ada animasi global dan smooth scroll, tetapi tidak ada `prefers-reduced-motion`.
- Focus style hanya ada pada sebagian field; link dan button tidak memiliki `:focus-visible` yang konsisten.

**Rencana**

- Tambahkan reduced-motion mode.
- Buat focus ring global yang kontras.
- Uji zoom 200% dan 400%, keyboard-only, screen reader, serta reflow mobile.

## Target Arsitektur

```text
Browser
  |
  | HTTPS + session cookie
  v
Backend/API
  |-- Authentication + RBAC
  |-- Anonymous report service
  |-- Report/status workflow
  |-- Evidence upload service
  |-- Audit log
  |-- Safety policy engine
  |-- AI gateway with PII redaction and consent
  |
  +--> Database terenkripsi
  +--> Object storage private + malware scan
  +--> Notification service
  +--> LLM provider
```

Prinsip:

- Backend adalah satu-satunya sumber kebenaran untuk identitas, role, laporan, dan status.
- Anonymous report tidak mengumpulkan identitas kecuali pengguna memilih memberi kontak.
- Admin hanya melihat data minimum sesuai role dan kebutuhan kasus.
- Bukti berada di private object storage dengan signed URL singkat.
- Semua perubahan status dan akses data sensitif diaudit.
- AI tidak menjadi pengambil keputusan akhir dan tidak menerima PII yang tidak diperlukan.

## Roadmap Implementasi

### Fase 0: Containment dan Kejujuran Produk

Target: 1-3 hari.

- [ ] `SEC-001` Pindahkan static asset ke `public/` dan hentikan eksposur `.git`, backend, docs, test, serta package metadata.
- [ ] `SEC-002` Tambahkan security headers melalui `helmet` dan deployment HTTPS.
- [ ] `SAFE-001` Perbaiki kontrak `getRiskScore()` dan fallback risiko tinggi.
- [ ] `TRUST-001` Tambahkan banner demo dan larangan memasukkan data nyata.
- [ ] `TRUST-002` Hapus klaim end-to-end encryption, real-time, verifikasi, OTP, dan upload yang belum nyata.
- [ ] `TRUST-003` Ganti kontak placeholder dengan kontak tervalidasi atau nonaktifkan jalur darurat sampai siap.
- [ ] `PRIV-001` Hentikan pengiriman nama ke provider LLM.
- [ ] `SEC-003` Verifikasi secret history dan rotasi credential jika pernah terekspos.
- [ ] `TEST-001` Tambahkan regression test untuk file internal yang harus 404.

**Exit criteria**

- Tidak ada file internal repository yang dapat diakses dari web.
- Pesan risiko tinggi tetap mendapat respons darurat saat backend/provider gagal.
- Tidak ada copy yang menyatakan fungsi atau proteksi yang belum benar.
- Pengguna jelas mengetahui bahwa build adalah demo.

### Fase 1: Fondasi Backend dan Data

Target: 2-4 sprint.

- [ ] `AUTH-001` Implementasikan autentikasi server-side dan session management.
- [ ] `AUTH-002` Implementasikan RBAC admin, case worker, reviewer, dan user.
- [ ] `REPORT-001` Buat API laporan anonim dan rahasia dengan server-side validation.
- [ ] `REPORT-002` Gunakan tracking token berentropi tinggi dan authorization yang tepat.
- [ ] `REPORT-003` Buat state machine status laporan dan audit log.
- [ ] `EVID-001` Implementasikan private upload, file size/MIME validation, malware scan, dan metadata stripping.
- [ ] `DATA-001` Terapkan encryption at rest, backup, restore test, retention, dan deletion policy.
- [ ] `DATA-002` Pisahkan identifier pengguna dari isi kasus dan minimalkan PII.
- [ ] `OPS-001` Tambahkan logging terstruktur dengan redaksi, metrics, alert, dan incident response.

**Exit criteria**

- Memodifikasi `localStorage` tidak dapat memberikan akses admin atau data pihak lain.
- Anonymous report dapat dibuat tanpa menyimpan identitas.
- Semua akses dan perubahan data sensitif tercatat.
- Bukti tidak pernah public dan hanya dapat diakses role yang berwenang.

### Fase 2: Redesign Alur Pelaporan dan Aksesibilitas

Target: 1-2 sprint.

- [ ] `UX-001` Redesign pilihan anonim vs rahasia.
- [ ] `UX-002` Buat form bertahap dengan safety check, review, submit, dan recovery.
- [ ] `UX-003` Buat status page yang menjelaskan timeline, owner, dan next action.
- [ ] `UX-004` Redesign quick escape berdasarkan threat model.
- [ ] `UX-005` Buat kontak darurat dan human handoff yang actionable.
- [ ] `A11Y-001` Perbaiki routing focus, title, skip link, dan active state.
- [ ] `A11Y-002` Perbaiki dialog, sidebar, tab, report item, dan semua keyboard interaction.
- [ ] `A11Y-003` Tambahkan live region, error association, chart alternative, dan reduced motion.
- [ ] `DESIGN-001` Pindahkan inline style ke design system/tokens dan buat komponen state yang konsisten.

**Exit criteria**

- Semua alur utama dapat diselesaikan keyboard-only.
- Tidak ada keyboard trap.
- Lulus audit WCAG 2.2 AA untuk halaman dan alur utama.
- Pengguna dapat memahami siapa yang melihat data dan apa yang terjadi setelah submit.
- Visual QA lulus pada mobile kecil, tablet, desktop, zoom 200%, dan zoom 400%.

### Fase 3: AI Safety dan Governance

Target: 1-2 sprint, dilanjutkan secara berkala.

- [ ] `AI-001` Tambahkan consent dan disclosure pemrosesan AI.
- [ ] `AI-002` Redaksi PII sebelum request provider.
- [ ] `AI-003` Satukan classifier risiko di server dan versioning rule.
- [ ] `AI-004` Tambahkan human handoff untuk risiko tinggi dan ketidakpastian.
- [ ] `AI-005` Buat evaluation set Bahasa Indonesia untuk self-harm, kekerasan, pelecehan, negasi, slang, false positive, dan prompt injection.
- [ ] `AI-006` Tambahkan batas biaya, abuse monitoring, timeout, retry policy, dan provider outage playbook.
- [ ] `AI-007` Dokumentasikan bahwa output AI bukan diagnosis atau keputusan kasus.

**Exit criteria**

- Tidak ada nama/PII yang dikirim tanpa kebutuhan dan consent.
- Risiko tinggi selalu mendapat jalur bantuan deterministik.
- Evaluasi safety memiliki threshold yang disetujui owner produk dan ahli domain.
- Provider outage tidak memutus jalur bantuan darurat.

### Fase 4: Hardening dan Release Readiness

Target: sebelum pilot dan sebelum production.

- [ ] `SEC-010` Threat modeling dan abuse-case review.
- [ ] `SEC-011` SAST, secret scanning, dependency scanning, dan CSP test di CI.
- [ ] `SEC-012` Penetration test independen.
- [ ] `TEST-010` E2E test untuk anonim, user, admin, bukti, status, logout, dan recovery.
- [ ] `TEST-011` Automated accessibility scan plus manual screen-reader test.
- [ ] `OPS-010` Backup/restore drill, incident drill, dan key rotation procedure.
- [ ] `LEGAL-001` Review privacy notice, consent, retention, data processor, dan kewajiban institusi.
- [ ] `CONTENT-001` Review seluruh safety copy dan kontak oleh ahli PPKS/konselor/legal.

## Acceptance Criteria Teknis Utama

### Keamanan

- Request ke `/.git/*`, `/server/*`, `/docs/*`, `.env*`, package metadata, dan test mengembalikan 404.
- Tidak ada role atau authorization decision yang dipercaya dari client.
- Session menggunakan cookie aman dan memiliki expiry/revocation.
- Semua endpoint sensitif memiliki authentication, authorization, validation, rate limit, dan audit log.
- Tidak ada user-controlled value yang masuk ke `innerHTML`.
- CSP dikirim melalui header dan tidak membutuhkan inline script.
- Secret scanning dan dependency audit berjalan di CI.

### Privasi

- Mode anonim tidak menyimpan identifier akun, nama, email, IP mentah, atau metadata yang tidak diperlukan.
- Retention dan deletion policy dapat diuji.
- Chat tidak mengirim PII ke provider tanpa consent eksplisit.
- Copy privasi sesuai implementasi dan telah direview.

### Safety

- Kontak darurat valid, dapat digunakan, dan memiliki tanggal verifikasi.
- Pesan risiko tinggi mendapat respons deterministik walaupun AI/provider/backend gagal.
- Sistem tidak menjanjikan respons manusia atau penyelesaian yang tidak dapat dipenuhi.
- Human handoff dan escalation path terdokumentasi.

### UI/UX dan Aksesibilitas

- Anonymous vs confidential reporting dapat dipahami sebelum data diisi.
- Tidak ada fitur placeholder yang terlihat seperti fitur aktif.
- Error menjelaskan masalah dan cara memperbaikinya.
- Alur utama dapat diselesaikan keyboard-only dan screen reader.
- Lulus WCAG 2.2 AA, responsive QA, reduced motion, dan zoom/reflow.

## Strategi Test yang Disarankan

### Unit

- Risk classifier, termasuk negasi, substring, slang, dan false positive.
- Validation schema laporan, status transition, dan file metadata.
- Authorization policy per role.
- Redaction PII.

### Integration

- Login/session/logout/revocation.
- Anonymous submit dan confidential submit.
- Upload, scan, storage, dan signed URL expiry.
- Audit log dan notification.
- Provider AI timeout, 429, malformed response, dan outage.

### Security

- IDOR/BOLA pada laporan dan bukti.
- Privilege escalation.
- Stored/reflected/DOM XSS.
- CSRF, clickjacking, brute force, rate-limit bypass, dan cost abuse.
- Static file disclosure dan secret exposure.
- Prompt injection dan unsafe model output.

### UI/E2E

- Mobile, tablet, dan desktop.
- Keyboard-only dan screen reader.
- Quick escape.
- Form validation/recovery.
- Backend/provider offline.
- Shared-device/logout scenario.

## Release Gate Sebelum Pilot

Pilot dengan data nyata tidak boleh dimulai sebelum seluruh kondisi berikut terpenuhi:

- [ ] Tidak ada eksposur `.git`, backend source, docs internal, atau secret.
- [ ] Autentikasi, RBAC, dan laporan sudah server-side.
- [ ] Mode anonim benar-benar tidak mengumpulkan identitas.
- [ ] Seluruh klaim privasi dan fungsi sesuai implementasi.
- [ ] Kontak darurat serta escalation path telah diverifikasi.
- [ ] Fallback risiko tinggi telah diperbaiki dan diuji.
- [ ] Data retention, audit log, backup, dan incident response tersedia.
- [ ] Review privasi/legal dan ahli domain selesai.
- [ ] Audit WCAG 2.2 AA dan penetration test tidak memiliki temuan P0/P1 terbuka.

## Metrik Keberhasilan

- 0 file internal atau dotfile dapat diakses publik.
- 0 keputusan authorization dilakukan hanya di client.
- 100% kasus risiko tinggi pada evaluation set menerima jalur bantuan deterministik.
- 100% kontak darurat memiliki owner dan tanggal verifikasi.
- 0 P0/P1 terbuka sebelum pilot.
- Tingkat penyelesaian form, waktu submit, error rate, dan abandonment terukur tanpa merekam isi sensitif.
- Seluruh alur utama lulus keyboard-only, screen reader, dan WCAG 2.2 AA.

## Hal yang Tidak Disarankan

- Jangan "mengamankan" arsitektur saat ini hanya dengan mengenkripsi `localStorage`; key pada client tetap dapat diambil.
- Jangan menyimpan kredensial atau role admin di frontend.
- Jangan mengklaim end-to-end encryption jika admin/server harus membaca isi laporan.
- Jangan menjadikan LLM sebagai satu-satunya penentu risiko atau jalur darurat.
- Jangan menyimpan raw message, laporan, bukti, token, atau PII di log.
- Jangan membuka pilot dengan kontak placeholder atau fitur simulasi yang terlihat nyata.

## Validasi Audit Saat Ini

- `npm test`: 6/6 test lulus.
- `npm run check` pada backend: lulus.
- `npm audit` root: 0 vulnerability.
- `npm audit` backend: 0 vulnerability.
- Pengujian static exposure: `/package.json`, `/server/index.js`, dokumen internal, dan `/.git/config` mengembalikan HTTP 200.
- Visual browser QA: belum dapat dijalankan pada environment audit; wajib dilakukan pada fase verifikasi.
