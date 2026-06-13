# Re-Audit Ketiga dan Rencana Improvement SafeSphere

Tanggal audit: 13 Juni 2026  
Acuan: implementasi terbaru setelah `improve2.md`.

## Ringkasan Eksekutif

Implementasi terbaru berhasil meningkatkan SafeSphere pada beberapa area:

- Validasi Zod telah diterapkan pada login dan pembuatan laporan.
- Session ID diregenerasi setelah login.
- Error input login tidak lagi membocorkan stack trace.
- Daftar dan detail laporan utama telah dipindahkan dari `innerHTML` ke DOM API yang lebih aman.
- Validasi form bertahap, focus-visible, tombol laporan semantik, native dialog, dan beberapa state ARIA telah ditambahkan.
- Laporan dan audit log sekarang disimpan pada SQLite.
- Export/import, retention dasar, dan GitHub Actions CI telah mulai diterapkan.
- `npm audit` root dan server tidak menemukan vulnerability.

Namun, SafeSphere masih **belum siap untuk pilot menggunakan data nyata**. Risiko terbesar saat ini adalah kredensial admin publik yang dapat mengakses dan menghapus data persisten, test suite yang menulis ke database aplikasi, CI yang tidak kompatibel dengan dependency baru, serta backup/import yang belum aman.

## Hasil Validasi

- `npm test`: **34/36 lulus**, dua test kontrak gagal.
- `server npm run check`: lulus.
- Root `npm run check`: tidak tersedia.
- `npm audit` root: 0 vulnerability.
- `npm audit` server: 0 vulnerability.
- Browser terintegrasi tidak tersedia; UI diverifikasi melalui struktur DOM, event handler, dan stylesheet.
- Menjalankan test menambahkan laporan test ke `data/safesphere.db`.

## Temuan Kritis

### P0-1: Kredensial admin publik memiliki akses penuh ke data persisten

**Bukti**

- Kredensial admin masih hardcoded pada `server/auth.js:10-12`.
- Password admin ditampilkan pada UI di `public/js/auth.js:19`.
- Admin dapat menjalankan seed, reset, export, dan import.
- Endpoint seed menghapus seluruh laporan sebelum memasukkan data demo pada `server/reports.js:114-120`.
- Endpoint reset menghapus seluruh laporan pada `server/reports.js:127-133`.

**Dampak**

Siapa pun yang mengetahui kredensial demo dapat:

- Membaca seluruh laporan dan audit log.
- Mengekspor data sensitif.
- Mengimpor data tidak tervalidasi.
- Menghapus seluruh laporan.
- Mengganti seluruh laporan dengan data demo.

Setelah migrasi ke SQLite, dampaknya menjadi kehilangan atau kebocoran data persisten.

**Perbaikan**

- Hapus kredensial admin dari frontend dan source code.
- Buat admin bootstrap melalui environment variable atau migration satu kali.
- Tolak startup production jika kredensial admin default masih aktif.
- Nonaktifkan endpoint seed dan reset pada production.
- Tambahkan konfirmasi ulang password atau step-up authentication untuk export, import, dan delete.
- Pisahkan role admin operasional, reviewer, dan data administrator.

**Acceptance criteria**

- Tidak ada kredensial admin pada source code atau UI.
- Endpoint seed/reset tidak tersedia pada production.
- User biasa dan admin demo tidak dapat export/import/delete data produksi.
- Seluruh operasi destruktif tercatat dan memerlukan konfirmasi kuat.

## Temuan Prioritas Tinggi

### P1-1: Test suite menggunakan database aplikasi asli

**Bukti**

- Database selalu menggunakan `data/safesphere.db` pada `server/db.js:5`.
- Test memanggil aplikasi yang sama tanpa konfigurasi database test.
- Startup aplikasi menjalankan retention cleanup pada `server/index.js:81-87`.
- Setelah test dijalankan, database berisi laporan seperti `Test anonim`, `Test schema`, dan `Test UUID`.

**Dampak**

- Test mencemari data aplikasi.
- Test dapat menghapus laporan berstatus selesai yang melewati retention.
- Hasil test tidak terisolasi dan dapat berubah berdasarkan isi database sebelumnya.
- CI atau developer dapat tidak sengaja merusak database lokal.

**Perbaikan**

- Tambahkan `DATABASE_PATH` atau dependency injection untuk database.
- Gunakan SQLite `:memory:` atau temporary database untuk test.
- Buat setup/teardown per test suite.
- Jangan menjalankan retention cleanup ketika `NODE_ENV=test`.
- Tambahkan test yang memastikan database production tidak berubah.

**Acceptance criteria**

- Menjalankan `npm test` tidak mengubah `data/safesphere.db`.
- Setiap test berjalan pada database kosong dan terisolasi.
- Test dapat dijalankan berulang dengan hasil konsisten.

### P1-2: Test kontrak dan CI sedang gagal

**Bukti**

- SQLite mengembalikan `isAnonymous` sebagai integer `0/1`.
- API tidak memetakan nilai tersebut kembali menjadi boolean.
- Dua test kontrak gagal pada `server/test/contract.test.js:37` dan `:55`.
- Workflow menggunakan Node.js 18 pada `.github/workflows/ci.yml:16-19`.
- `better-sqlite3@12.10.0` membutuhkan Node.js 20 atau lebih baru.
- `server/test/security.test.js` belum tracked sehingga tidak tersedia pada CI.

**Dampak**

- Kontrak API berubah tanpa sengaja.
- Frontend bergantung pada truthy/falsy, tetapi consumer lain dapat menerima tipe yang salah.
- Workflow CI tidak dapat menjadi release gate yang dapat dipercaya.

**Perbaikan**

- Tambahkan mapper database-to-API yang mengubah `isAnonymous` menjadi boolean.
- Gunakan Node.js 22 pada CI dan dokumentasi deployment.
- Gunakan `npm ci`, bukan `npm install`.
- Track seluruh test keamanan yang diperlukan.
- Pastikan branch tidak dapat di-merge jika test gagal.

**Acceptance criteria**

- Seluruh test lulus.
- `isAnonymous` selalu boolean pada seluruh endpoint.
- CI berjalan pada runtime yang didukung dependency.
- Test lokal dan CI menghasilkan hasil yang sama.

### P1-3: Secret scanning CI tidak efektif

**Bukti**

Workflow hanya mencari pola `sk-`:

```yaml
grep -r "sk-" ... || echo "No secrets found"
```

Perintah tersebut tetap berhasil saat secret ditemukan karena hasil akhirnya dipipe dan memiliki fallback sukses.

**Dampak**

- Secret non-`sk-` tidak terdeteksi.
- Workflow dapat tetap hijau ketika secret ditemukan.
- Hardcoded password dan session secret fallback tidak dianggap failure.

**Perbaikan**

- Gunakan Gitleaks, TruffleHog, atau secret scanner resmi.
- Scan seluruh git history yang relevan.
- Gagalkan CI saat temuan valid ditemukan.
- Tambahkan allowlist terbatas untuk fixture test.

**Acceptance criteria**

- Commit dengan secret uji yang tidak di-allowlist menggagalkan CI.
- Hardcoded production credential tidak ada.

### P1-4: Session dan autentikasi belum production-safe

**Bukti**

- Session secret memiliki fallback diketahui pada `server/index.js:41`.
- Cookie menggunakan `secure: false` pada `server/index.js:46`.
- Session masih menggunakan default MemoryStore.
- `trust proxy` selalu `false`.
- Login limiter menghitung semua request login, termasuk login berhasil.
- Limiter hanya menggunakan IP dan disimpan in-memory.

**Dampak**

- Session dapat menggunakan secret lemah jika environment salah.
- Cookie dapat dikirim tanpa HTTPS.
- Session hilang saat restart dan tidak mendukung beberapa instance.
- Banyak pengguna di jaringan/proxy yang sama dapat saling mengunci.

**Perbaikan**

- Tolak startup production jika `SESSION_SECRET` kosong atau lemah.
- Konfigurasikan `secure: true` dan `trust proxy` sesuai deployment.
- Gunakan session store persisten.
- Hitung hanya login gagal atau reset counter setelah login berhasil.
- Kombinasikan limiter berbasis akun dan IP.
- Gunakan store limiter terdistribusi untuk deployment multi-instance.

**Acceptance criteria**

- Production tidak dapat berjalan dengan fallback secret.
- Cookie production memiliki `Secure`, `HttpOnly`, dan `SameSite`.
- Login berhasil tidak menyebabkan lockout.
- Session tetap valid sesuai kebijakan ketika server restart.

### P1-5: Backup/import belum aman dan belum dapat memulihkan seluruh data

**Bukti**

- Global `express.json({ limit: '20kb' })` dijalankan sebelum handler import.
- Limit `10mb` pada endpoint import tidak dapat menaikkan limit request yang sudah diproses middleware global.
- Import hanya memeriksa bahwa `reports` adalah array.
- Setiap report import langsung dimasukkan ke database tanpa schema validation.
- Export menyertakan audit log, tetapi import hanya memulihkan laporan.
- Tidak ada audit event untuk export/import.

**Dampak**

- Backup lebih dari 20 KB akan ditolak.
- Import dapat melewati validasi Zod dan memasukkan data rusak atau berbahaya.
- Restore tidak mengembalikan audit log.
- Aktivitas export/import tidak terlacak.

**Perbaikan**

- Definisikan parser body khusus import sebelum parser global atau gunakan upload file terkontrol.
- Validasi schema backup, versi format, ukuran, jumlah record, dan setiap field.
- Gunakan transaction yang rollback penuh ketika satu record tidak valid.
- Tentukan apakah audit log boleh direstore atau harus append-only.
- Catat export/import pada audit log.
- Tambahkan checksum, backup encryption, dan restore test.

**Acceptance criteria**

- Backup berukuran sesuai batas dapat di-import.
- Payload invalid ditolak tanpa perubahan database.
- Restore test membuktikan data yang diharapkan kembali.
- Export/import tercatat pada audit log.

### P1-6: Endpoint laporan belum memiliki abuse protection

**Bukti**

- `POST /api/reports` tidak memiliki rate limiter.
- Login dan chat memiliki limiter, tetapi laporan tidak.

**Dampak**

- Laporan anonim dapat digunakan untuk spam dan memenuhi database.
- Admin dapat kewalahan menangani laporan palsu.

**Perbaikan**

- Tambahkan rate limit khusus laporan.
- Terapkan batas per IP/session secara privacy-aware.
- Tambahkan monitoring volume dan mekanisme challenge aksesibel saat abuse terdeteksi.
- Jangan menyimpan IP mentah permanen untuk laporan anonim.

**Acceptance criteria**

- Burst laporan berlebihan menghasilkan `429`.
- Abuse protection tidak membocorkan atau menyimpan identitas pelapor anonim secara permanen.

### P1-7: Validasi laporan dan workflow masih belum lengkap

**Bukti**

- `incidentDate` hanya menggunakan `z.string().min(1)` pada `server/reports.js:10`.
- ID laporan masih memakai delapan karakter UUID pada `server/reports.js:16-18`.
- Seed anonim masih memiliki `authorId: 2` pada `server/reports.js:108` dan `:110`.
- Status dapat dipindahkan dari `Selesai` kembali ke status awal.
- Appointment belum memiliki schema dan batas panjang.

**Perbaikan**

- Validasi tanggal dengan format ISO dan larang tanggal masa depan bila tidak sesuai domain.
- Gunakan UUID penuh atau ULID.
- Pastikan seluruh data anonim memiliki `authorId: null`.
- Implementasikan state machine status.
- Validasi panjang dan tipe appointment.

**Acceptance criteria**

- Tanggal invalid dan tanggal masa depan yang tidak diperbolehkan ditolak.
- ID memiliki entropi tinggi.
- Tidak ada report anonim dengan identifier pengguna.
- Transisi status tidak valid mendapat HTTP 400.

## Temuan Safety dan Privasi

### SAFE-1: Kontak darurat masih tidak tersedia

**Bukti**

- Seluruh kontak pada `public/index.html:381-383` masih bertuliskan `Belum tersedia (demo)`.
- High-risk flow tetap mengarahkan pengguna ke halaman kontak.

**Dampak**

Pengguna dalam bahaya dapat diarahkan ke halaman tanpa jalur bantuan yang dapat digunakan.

**Perbaikan**

- Tampilkan minimal satu jalur bantuan yang valid dan terverifikasi.
- Tambahkan owner, tanggal verifikasi, dan jam layanan.
- Jangan tampilkan CTA kontak darurat yang tidak dapat digunakan.

### SAFE-2: Klaim chat anonim tidak sesuai implementasi

**Bukti**

- UI menyatakan ruang chat aman dan anonim pada `public/index.html:413`.
- High-risk chat mencatat session user ID dan IP pada `server/index.js:198-200`.
- Consent menyatakan identitas tidak dikirim, tetapi aplikasi masih memproses session dan metadata request.

**Perbaikan**

- Ubah copy agar menjelaskan data yang benar-benar diproses dan disimpan.
- Tentukan kebijakan audit high-risk yang eksplisit.
- Jangan menyebut chat anonim jika user ID/IP masih disimpan.

### SAFE-3: Redaksi PII masih terlalu terbatas

**Bukti**

Redaksi saat ini hanya menangani email dan nomor telepon tanpa separator pada `server/index.js:147-153`.

**Belum tertangani**

- Nama.
- NIM atau identifier kampus.
- Nomor telepon dengan spasi atau tanda hubung.
- Alamat dan identifier lain.

**Perbaikan**

- Koreksi klaim consent.
- Tambahkan redaksi pola Bahasa Indonesia.
- Tambahkan test untuk nomor dengan separator dan identifier kampus.
- Dokumentasikan data retention dan provider AI.

## Temuan UI/UX dan Aksesibilitas

### UX-1: Review laporan masih menggunakan `innerHTML` dengan input pengguna

**Bukti**

- `public/app.js:345-351` memasukkan lokasi dan deskripsi ke `innerHTML`.

**Dampak**

Payload HTML dapat memanipulasi tampilan review sebelum laporan dikirim. CSP saat ini mengurangi eksekusi script, tetapi pola tersebut tetap tidak aman.

**Perbaikan**

- Render seluruh field review menggunakan `textContent` dan DOM helper.
- Tambahkan test bahwa HTML ditampilkan sebagai teks.

### UX-2: Upload bukti masih bersifat palsu

**Bukti**

- UI menyatakan mendukung JPG, PNG, PDF, dan maksimum 5 MB.
- Frontend hanya mengirim nama file.
- Backend menyimpan nama file sebagai string.

**Perbaikan**

- Hapus kontrol upload sampai private upload benar-benar tersedia, atau:
- Implementasikan private object storage, size/type validation, malware scanning, metadata stripping, dan authorization download.

### UX-3: Registrasi dan OTP masih berupa simulasi yang menyesatkan

**Bukti**

- Form registrasi meminta password asli.
- Result menyatakan akun terverifikasi pada `public/js/auth.js:205`.
- Forgot password menyatakan OTP akan dikirim, tetapi fitur tidak benar-benar tersedia.

**Perbaikan**

- Jangan meminta password pada registrasi simulasi.
- Ubah copy menjadi jelas bahwa akun dan OTP tidak dibuat/dikirim.
- Sembunyikan fitur yang belum tersedia.

### A11Y-1: Native dialog belum sepenuhnya aksesibel

**Bukti**

- Modal sudah menggunakan `<dialog>`.
- Tombol tutup masih berupa `<span>` pada `public/index.html:541` dan `:604`.
- Dokumen audit menyatakan modal close via button, tetapi implementasi tidak sesuai.

**Perbaikan**

- Ganti close control dengan `<button type="button" aria-label="Tutup">`.
- Tambahkan `aria-labelledby`.
- Uji Escape, focus initial, focus return, dan keyboard-only flow.

### A11Y-2: State sidebar tidak konsisten

**Bukti**

- Hamburger memiliki `aria-controls="mainNav"`, tetapi ID `mainNav` tidak ada.
- Ketika sidebar ditutup melalui overlay atau link, `aria-expanded` tidak diubah kembali menjadi `false`.
- Sidebar belum mengelola focus saat dibuka.

**Perbaikan**

- Arahkan `aria-controls` ke ID sidebar yang benar.
- Sinkronkan `aria-expanded` pada seluruh jalur open/close.
- Pindahkan focus ke sidebar saat dibuka dan kembalikan ke hamburger saat ditutup.

### A11Y-3: Toggle aksesibilitas belum expose state

Tombol high contrast, large text, dan dyslexia belum memiliki `aria-pressed`.

**Perbaikan**

- Tambahkan dan sinkronkan `aria-pressed`.
- Simpan preferensi tampilan hanya jika kebijakan privasi mengizinkan.

## Temuan Data dan Operasional

### OPS-1: Retention audit log belum benar-benar dijalankan

**Bukti**

- `cleanupOldAudit()` tersedia pada `server/db.js:48-51`.
- Startup hanya menghapus laporan selesai lama pada `server/index.js:81-87`.

**Dampak**

Audit log, termasuk user ID dan IP, dapat tersimpan tanpa batas.

**Perbaikan**

- Jalankan retention audit sesuai kebijakan.
- Pisahkan retention berdasarkan jenis event.
- Dokumentasikan legal hold dan deletion workflow.

### OPS-2: SQLite belum memiliki kontrol operasional production

Belum ditemukan:

- Migration versioning.
- Encryption at rest.
- Permission hardening database file.
- Backup scheduling.
- Restore drill.
- Monitoring disk/database corruption.
- Strategi concurrency dan multi-instance.

### DOC-1: Dokumentasi tidak sesuai implementasi

**Bukti**

- Threat model masih menyebut data in-memory dan hilang saat restart.
- Threat model menyatakan API abuse dan PII leakage sudah mitigated.
- Accessibility audit menyatakan seluruh tombol keyboard accessible dan modal close via button.
- Accessibility audit masih menyebut `insertAdjacentHTML` pada report list walaupun sudah diperbaiki.

**Perbaikan**

- Perbarui status menjadi `Open`, `Partial`, atau `Mitigated` berdasarkan bukti terbaru.
- Catat SQLite, backup/import limitation, dan retention aktual.
- Jangan menandai WCAG selesai sebelum manual audit.

## Roadmap Perbaikan

### Sprint 1: Release Blocker

- [ ] Hapus kredensial admin publik dan default production credential.
- [ ] Nonaktifkan seed/reset/export/import untuk admin demo dan production tanpa step-up auth.
- [ ] Pisahkan database test dari database aplikasi.
- [ ] Perbaiki mapper boolean SQLite dan buat seluruh test lulus.
- [ ] Upgrade CI ke Node.js 22 dan gunakan `npm ci`.
- [ ] Track dan jalankan seluruh test keamanan di CI.
- [ ] Sediakan kontak darurat valid atau nonaktifkan CTA darurat.

### Sprint 2: Security dan Data Integrity

- [ ] Wajibkan `SESSION_SECRET` production dan secure cookie.
- [ ] Gunakan persistent session/rate-limit store.
- [ ] Tambahkan report rate limit.
- [ ] Validasi import dan jalankan restore test.
- [ ] Validasi tanggal, appointment, dan transisi status.
- [ ] Gunakan UUID penuh/ULID.
- [ ] Koreksi seed anonim.
- [ ] Implementasikan secret scanning yang benar.

### Sprint 3: Privacy, UI, dan Aksesibilitas

- [ ] Koreksi klaim chat anonim dan redaksi PII.
- [ ] Hapus `innerHTML` dari review laporan.
- [ ] Hapus atau implementasikan upload bukti nyata.
- [ ] Koreksi simulasi registrasi dan OTP.
- [ ] Ganti modal close `<span>` menjadi button.
- [ ] Sinkronkan state/focus sidebar dan widget aksesibilitas.
- [ ] Lakukan keyboard, screen reader, contrast, zoom, dan reflow audit.

### Sprint 4: Operasional Production

- [ ] Implementasikan migration versioning.
- [ ] Jalankan retention audit log.
- [ ] Tambahkan encrypted backup, restore drill, dan monitoring database.
- [ ] Definisikan deletion workflow dan legal hold.
- [ ] Lakukan penetration test dan incident-response exercise.

## Test yang Harus Ditambahkan

### Data Isolation

- Test tidak mengubah database aplikasi.
- Setiap suite menggunakan database temporary yang bersih.
- Retention tidak berjalan pada database production selama test.

### Security

- Kredensial default ditolak pada production.
- Login berhasil tidak dihitung sebagai kegagalan.
- Report spam menghasilkan `429`.
- Import invalid rollback tanpa perubahan database.
- Import tidak dapat memasukkan XSS, status invalid, atau authorId pada report anonim.
- Secret fixture menggagalkan CI secret scan.

### Contract

- `isAnonymous` selalu boolean.
- Seluruh response report menggunakan schema canonical.
- UUID memiliki format dan entropi yang disepakati.
- Tanggal invalid dan transisi status invalid ditolak.

### Accessibility

- Modal close dapat digunakan keyboard.
- Escape menutup dialog dan focus kembali ke trigger.
- Sidebar `aria-expanded` selalu sinkron.
- Toggle aksesibilitas memiliki `aria-pressed`.

## Release Gate Sebelum Pilot

Pilot dengan data nyata tidak boleh dimulai sebelum:

- [ ] Tidak ada kredensial admin publik/default.
- [ ] Test tidak dapat menyentuh database aplikasi.
- [ ] Seluruh test dan CI lulus pada runtime yang didukung.
- [ ] Seed/reset/export/import memiliki kontrol production yang aman.
- [ ] Kontak darurat valid dan dapat digunakan.
- [ ] Session, rate limit, dan secret management production-safe.
- [ ] Import tervalidasi dan restore telah diuji.
- [ ] Tidak ada report anonim yang terhubung ke user ID atau IP.
- [ ] Seluruh klaim privasi dan safety sesuai implementasi.
- [ ] Audit aksesibilitas manual dan penetration test selesai.

## Kesimpulan

Perubahan terbaru menyelesaikan sebagian besar kelemahan teknis awal pada validasi input, rendering laporan, session fixation, persistensi data, dan struktur UI. Akan tetapi, migrasi ke data persisten memperbesar dampak kontrol admin demo, test yang tidak terisolasi, serta endpoint operasional yang belum di-hardening.

Prioritas berikutnya harus berfokus pada pengamanan akses admin, isolasi database test, perbaikan CI, validasi backup/import, dan penyelesaian safety blocker sebelum menambah fitur baru.
