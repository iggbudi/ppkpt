# Re-Audit Keempat dan Rencana Improvement SafeSphere

Tanggal audit: 13 Juni 2026  
Acuan: implementasi terbaru setelah `improve3.md`.

## Ringkasan Eksekutif

Implementasi terbaru berhasil menyelesaikan beberapa temuan penting:

- Kredensial admin tidak lagi hardcoded atau ditampilkan pada UI.
- Seed dan reset ditolak ketika aplikasi benar-benar berjalan dengan `NODE_ENV=production`.
- Database test menggunakan SQLite in-memory ketika `NODE_ENV=test`.
- UUID laporan sekarang menggunakan UUID penuh.
- Nilai `isAnonymous` dari SQLite dipetakan kembali menjadi boolean pada API.
- Review laporan tidak lagi menggunakan `innerHTML`.
- Modal close control sudah menjadi button.
- State sidebar dan toggle aksesibilitas membaik.
- Report rate limiter, migration system, backup/restore, deletion workflow, legal hold, retention, dan monitoring database mulai diterapkan.
- Kontak SAPA 129, Polri 110, dan PSC 119 telah ditambahkan.
- `npm audit` root dan server tidak menemukan vulnerability.

Namun, beberapa fitur baru memperkenalkan blocker yang lebih serius:

- Form pengiriman laporan dari UI rusak.
- Konfigurasi production masih fail-open.
- Backup/restore terenkripsi tidak berfungsi dengan benar.
- Deletion workflow dan legal hold tidak menjaga integritas data.
- Report rate limiter dapat dilewati.
- Test dan CI masih gagal serta menggantung.

SafeSphere masih **belum siap untuk pilot atau production menggunakan data nyata**.

## Hasil Validasi

- `npm test`: menggantung lebih dari dua menit karena process handle/timer tetap aktif.
- CI-equivalent test dengan `NODE_ENV=test`: **34/40 lulus, 6 gagal**.
- Test tanpa environment CI: **33/40 lulus, 7 gagal**.
- `server npm run check`: lulus.
- Syntax check modul baru: lulus.
- `npm audit` root: 0 vulnerability.
- `npm audit` server: 0 vulnerability.
- Database production tidak berubah saat contract test dijalankan dengan `NODE_ENV=test`.
- Browser terintegrasi tidak tersedia; UI diverifikasi melalui struktur DOM dan kode frontend.

## Temuan Kritis

### P0-1: Form pengiriman laporan dari UI rusak

**Bukti**

- Input bukti telah diubah menjadi `type="text"` pada `public/index.html:303-305`.
- Submit handler masih membaca:

```javascript
document.getElementById('evidence').files.length
```

pada `public/js/reports.js:22-24`.

**Dampak**

`HTMLInputElement.files` tidak tersedia untuk input teks. Submit laporan melalui UI akan melempar error sebelum request dikirim dan menampilkan pesan koneksi gagal.

**Perbaikan**

- Ubah submit handler untuk membaca `.value`.
- Ganti label `Upload Bukti` menjadi `Deskripsi Bukti`.
- Tambahkan browser/E2E test yang mengisi form lengkap dan memastikan request laporan terkirim.

**Acceptance criteria**

- Laporan anonim dan rahasia dapat dikirim melalui UI.
- Deskripsi bukti tampil pada dashboard admin dan user.
- Tidak ada error JavaScript pada submit.

### P0-2: Konfigurasi production masih fail-open

**Bukti**

- `NODE_ENV` default menjadi `development` pada `server/index.js:13`.
- Production safety checks hanya berjalan jika nilai tepat `production`.
- `server/.env` saat ini tidak memiliki `NODE_ENV`.
- Panduan production pada `docs/DEPLOYMENT.md:34-40` tidak menetapkan `NODE_ENV=production`.

**Dampak**

Deployment yang mengikuti dokumentasi dapat berjalan sebagai development dan mengaktifkan:

- Demo user.
- Endpoint seed/reset/import/export lama.
- Cookie tanpa `Secure`.
- Fallback session secret development.
- Retention dan kontrol keamanan dengan konfigurasi development.

**Perbaikan**

- Buat konfigurasi production fail-closed.
- Wajibkan environment eksplisit, misalnya `APP_ENV=development|test|production`.
- Tolak startup ketika environment tidak valid.
- Perbarui deployment guide agar menetapkan `NODE_ENV=production`.
- Tambahkan startup test untuk seluruh kombinasi environment.

**Acceptance criteria**

- Deployment production tidak dapat berjalan tanpa environment production eksplisit.
- Tidak ada endpoint development aktif pada production.
- Cookie production selalu `Secure`.
- Demo user tidak tersedia pada production.

## Temuan Prioritas Tinggi

### P1-1: Backup terenkripsi dan restore tidak berfungsi dengan benar

**Hasil pengujian langsung**

- Request `encrypt=true` tanpa key menghasilkan HTTP 200 dan backup plaintext.
- Encryption key dikirim melalui query parameter URL.
- Backup terenkripsi yang dibuat aplikasi gagal direstore dengan status 400.
- Request restore lebih dari 20 KB gagal dengan HTTP 500 karena parser global.

**Bukti kode**

- Global parser `20kb`: `server/index.js:65`.
- Key dibaca dari query: `server/reports.js:287-292`.
- Enkripsi hanya berjalan jika `encrypt && encryptionKey`: `server/backup.js:43`.
- Decryption mengganti object backup dengan data hasil dekripsi dan kehilangan metadata/checksum yang diperlukan: `server/backup.js:129-148`.
- Restore menghapus seluruh reports dan audit log: `server/backup.js:168-170`.

**Dampak**

- Operator dapat mengira backup terenkripsi padahal plaintext.
- Secret dapat masuk ke URL, proxy log, browser history, atau monitoring.
- Restore production tidak dapat dipercaya.
- Restore yang gagal atau salah dapat menyebabkan kehilangan seluruh data.

**Perbaikan**

- Tolak `encrypt=true` tanpa encryption key.
- Jangan mengirim key melalui URL; gunakan secret server-side atau body yang tidak dicatat.
- Perbaiki format encrypted envelope dan proses dekripsi/checksum.
- Gunakan parser body khusus route restore sebelum parser global.
- Wajibkan dry-run, backup otomatis sebelum restore, step-up authentication, dan approval dua pihak.
- Tambahkan restore integration test pada temporary database.

**Acceptance criteria**

- `encrypt=true` tanpa key menghasilkan HTTP 400.
- Backup terenkripsi dapat divalidasi dan direstore.
- Backup plaintext dan terenkripsi memiliki format versi yang terdokumentasi.
- Restore invalid tidak mengubah database.
- Restore berhasil telah dibuktikan melalui automated restore drill.

### P1-2: Deletion workflow dan legal hold tidak menjaga integritas data

**Hasil pengujian langsung**

- `GET /api/admin/pending-deletions` menghasilkan HTTP 500.
- Deletion approval tetap berhasil ketika legal hold aktif.
- Laporan soft-deleted masih muncul pada daftar admin/user.
- Status laporan berubah menjadi `Dihapus`, padahal schema status utama tidak mengenal status tersebut.

**Bukti kode**

- Pending deletion melakukan `LEFT JOIN users`, tetapi tabel `users` tidak ada: `server/deletion.js:209-217`.
- `approveDeletion()` tidak memeriksa legal hold: `server/deletion.js:74-104`.
- Query daftar laporan tidak memfilter `deleted_at`: `server/reports.js:54-56`.
- Soft delete menetapkan status `Dihapus`: `server/deletion.js:85-90`.

**Dampak**

- Legal hold dapat dilanggar.
- Laporan yang dianggap terhapus masih terlihat.
- Workflow status dan dashboard menjadi tidak konsisten.
- Endpoint admin tidak dapat digunakan.

**Perbaikan**

- Hapus join ke tabel users atau implementasikan tabel user yang benar.
- Tolak approval deletion jika legal hold aktif.
- Filter `deleted_at IS NULL` pada seluruh endpoint laporan aktif.
- Pisahkan deletion state dari report status.
- Tambahkan endpoint/admin view khusus deleted reports.
- Jalankan deletion + legal hold integration test.

**Acceptance criteria**

- Pending deletion endpoint menghasilkan HTTP 200.
- Laporan legal hold tidak dapat dihapus.
- Soft-deleted report tidak tampil di daftar aktif.
- Legal hold, deletion request, approval, rejection, dan release tercatat konsisten.

### P1-3: Report rate limiter dapat dilewati

**Hasil pengujian langsung**

Lima belas request laporan anonim berturut-turut semuanya menghasilkan HTTP 200.

**Bukti**

`server/rateLimiter.js:72-75` menggunakan:

```javascript
return req.sessionID || req.ip || 'unknown';
```

Untuk request anonim baru, session ID baru dapat dibuat pada setiap request sehingga counter selalu berbeda.

**Risiko tambahan**

Production menetapkan `trust proxy: true` tanpa batas proxy tepercaya. Rotasi `X-Forwarded-For` dapat melewati limiter berbasis IP jika aplikasi dapat diakses langsung.

**Perbaikan**

- Gunakan IP tervalidasi sebagai key utama untuk anonymous report.
- Kombinasikan IP, device/session cookie privacy-aware, dan abuse signal.
- Konfigurasikan trusted proxy secara spesifik, bukan boolean `true`.
- Gunakan distributed rate-limit store untuk multi-instance.
- Tambahkan test burst tanpa cookie dan rotasi `X-Forwarded-For`.

**Acceptance criteria**

- Burst anonymous report menghasilkan HTTP 429.
- Rotasi header `X-Forwarded-For` tidak melewati limiter.
- Rate limiter tidak menyimpan IP mentah permanen pada laporan atau audit anonim.

### P1-4: Test suite dan CI masih gagal

**Hasil**

- CI-equivalent: 34/40 test lulus.
- Empat chat test gagal karena masih menggunakan export `chatRateLimitStore` yang sudah dihapus.
- Dua status transition test gagal karena helper test tidak mengembalikan cookie.
- `npm test` tidak berhenti karena timer rate limiter.

**Bukti**

- Timer cleanup: `server/rateLimiter.js:15`.
- Chat test lama: `server/test/chat.test.js:9`.
- CI menjalankan `npm test`: `.github/workflows/ci.yml:31-37`.

**Perbaikan**

- Panggil `.unref()` pada cleanup interval atau destroy limiter setelah test.
- Expose API reset limiter khusus test atau ubah test menggunakan instance limiter.
- Perbaiki helper cookie pada contract test.
- Tambahkan test cleanup/teardown database dan interval.

**Acceptance criteria**

- `npm test` selesai normal tanpa force exit.
- Seluruh test lulus lokal dan CI.
- Tidak ada process handle tersisa setelah test.

### P1-5: CI security controls masih fail-open

**Bukti**

- `npm audit` root/server menggunakan `continue-on-error: true`.
- Gitleaks menggunakan `continue-on-error: true`.
- Secret pattern scanner secara eksplisit menjalankan `exit 0` ketika temuan ditemukan.
- Test isolation hanya memeriksa `server/data/safesphere.db`, padahal database aplikasi berada di root `data/`.
- Modul baru dan security test masih untracked sehingga tidak akan tersedia pada CI.

**Perbaikan**

- Hapus `continue-on-error` dari release gate security.
- Gagalkan CI saat Gitleaks atau secret scan menemukan temuan valid.
- Periksa database path sebenarnya atau lakukan hash/count comparison.
- Track seluruh modul/test/lockfile yang dibutuhkan.
- Tambahkan lint, `git diff --check`, SAST, dan accessibility scan.

**Acceptance criteria**

- Secret test fixture menggagalkan CI.
- High/critical dependency vulnerability menggagalkan CI.
- CI memverifikasi database production tidak berubah.
- Fresh clone dapat menjalankan seluruh test.

### P1-6: Session production masih memakai MemoryStore

**Hasil pengujian**

Production test menampilkan peringatan resmi `express-session` bahwa MemoryStore tidak cocok untuk production.

**Bukti**

- Session tidak menentukan `store` pada `server/index.js:69-79`.
- Production menerima session secret sangat pendek dan password admin lemah selama nilainya tersedia.

**Perbaikan**

- Gunakan persistent session store.
- Validasi panjang/entropi session secret.
- Terapkan kebijakan minimum admin password atau gunakan identity provider.
- Batasi trusted proxy ke jumlah/alamat proxy yang benar.
- Tambahkan session revocation dan rotation.

**Acceptance criteria**

- Production tidak memakai MemoryStore.
- Secret lemah dan password admin lemah ditolak saat startup.
- Session dapat dicabut dan bekerja pada beberapa instance.

### P1-7: Endpoint backup production belum memiliki step-up authentication

**Bukti**

- `/api/backup` dan `/api/restore` hanya memerlukan role admin.
- Tidak ada re-authentication, MFA, approval, atau batas environment.
- Backup dapat menyertakan seluruh laporan dan audit log.

**Dampak**

Session admin yang dicuri cukup untuk mengekspor atau mengganti seluruh data.

**Perbaikan**

- Tambahkan step-up authentication/MFA.
- Terapkan role terpisah untuk data export/restore.
- Tambahkan approval dua pihak untuk restore.
- Batasi frekuensi dan audit semua aktivitas backup.

## Temuan Prioritas Sedang

### P2-1: Validasi tanggal masih menerima tanggal masa depan

**Hasil pengujian**

`incidentDate: 2099-12-31` diterima dengan HTTP 200.

**Bukti**

Validasi hanya memeriksa format dan parse date pada `server/reports.js:15-21`.

**Perbaikan**

- Tentukan kebijakan domain untuk tanggal kejadian.
- Tolak tanggal masa depan jika laporan hanya untuk kejadian yang telah terjadi.
- Gunakan validasi kalender ketat agar tanggal seperti `2026-02-31` tidak dinormalisasi diam-diam.

### P2-2: Quick escape belum memenuhi threat model

Quick escape masih hanya menampilkan overlay iframe tanpa:

- Mengubah URL/history.
- Membersihkan state sensitif.
- Menutup session.
- Menghapus isi form/chat.

**Perbaikan**

- Definisikan fitur sebagai discreet overlay saja atau implementasikan redirect netral.
- Uji shared-device scenario dan history.

### P2-3: Registrasi demo masih meminta password dan menyatakan terverifikasi

**Bukti**

- Form registrasi tetap meminta password.
- `public/js/auth.js:205` masih menampilkan `Akun Anda terverifikasi`.

**Perbaikan**

- Hilangkan password pada simulasi registrasi.
- Ubah hasil menjadi jelas bahwa tidak ada akun dibuat.

### P2-4: Klaim anonimitas laporan masih terlalu absolut

**Bukti**

- `public/app.js:393` menyatakan `Identitas Anda tidak akan dikumpulkan`.

Implementasi laporan/audit memang mengosongkan identifier laporan anonim, tetapi server, jaringan, proxy, dan rate limiter tetap memproses metadata teknis.

**Perbaikan**

Gunakan copy yang lebih defensible:

> Identitas akun tidak disimpan pada laporan atau audit pembuatan laporan anonim.

### P2-5: Nomor darurat `118` belum terverifikasi

Sumber resmi yang diperiksa mendukung:

- SAPA 129.
- Polri 110.
- PSC 119.

Nomor `118` belum terverifikasi dari sumber resmi yang diperiksa.

**Perbaikan**

- Hapus `118` atau dokumentasikan sumber dan cakupan layanan yang valid.
- Tambahkan owner dan tanggal verifikasi kontak.

## Temuan Data dan Operasional

### OPS-1: Migration system belum mencakup deletion schema

Kolom deletion/legal hold ditambahkan melalui `ALTER TABLE` saat module load pada `server/deletion.js:8-19`, bukan melalui migration version yang tercatat.

**Dampak**

- Schema database sulit direproduksi dan diaudit.
- Sebagian ALTER dapat berhasil lalu sebagian gagal, tetapi error diabaikan.

**Perbaikan**

- Pindahkan seluruh perubahan schema deletion/legal hold ke migration version.
- Jangan mengabaikan seluruh error migration.
- Verifikasi schema sesudah migration.

### OPS-2: Backup otomatis belum benar-benar menyimpan backup

`scheduleBackup()` hanya menyimpan metadata backup di array memory dan tidak menyimpan isi backup ke file/cloud.

**Perbaikan**

- Jangan menyebutnya backup otomatis sampai artifact backup benar-benar disimpan.
- Implementasikan encrypted off-site backup dan restore drill.

### OPS-3: Soft-deleted data tetap masuk backup

Backup menggunakan `SELECT * FROM reports` sehingga laporan soft-deleted tetap diekspor tanpa kebijakan eksplisit.

**Perbaikan**

- Tentukan apakah deleted reports masuk backup/legal retention.
- Dokumentasikan retention dan purge workflow.

### OPS-4: Audit event legal hold tercatat dua kali

Legal hold dicatat di `deletion.js` dan kembali dicatat oleh route pada `reports.js`.

**Perbaikan**

- Tetapkan satu ownership boundary untuk audit logging.
- Tambahkan test jumlah event per operasi.

## Temuan Dokumentasi

Dokumentasi masih tidak sesuai implementasi:

- `docs/DEPLOYMENT.md` masih menyebut Node.js 18+ dan tidak menetapkan `NODE_ENV=production`.
- `docs/THREAT-MODEL.md` masih menyebut data in-memory dan beberapa risiko sebagai `Mitigated`.
- `docs/ACCESSIBILITY-AUDIT.md` masih menyebut `insertAdjacentHTML` pada report list.
- `docs/SECURITY-SCAN.md` masih menyebut session secret fallback lama.

**Perbaikan**

- Perbarui seluruh dokumen berdasarkan implementasi terbaru.
- Gunakan status `Open`, `Partial`, atau `Mitigated` berdasarkan test.
- Jangan menjadikan dokumen sebagai bukti selesai tanpa automated/manual verification.

## Perbaikan yang Sudah Tervalidasi

- Admin credential tidak lagi hardcoded atau ditampilkan.
- Production safety check tersedia ketika `NODE_ENV=production`.
- Seed/reset ditolak pada production.
- Test database terisolasi ketika `NODE_ENV=test`.
- UUID penuh dan boolean mapping laporan bekerja.
- Seed report anonim tidak lagi menyimpan `authorId`.
- Review laporan tidak lagi menggunakan `innerHTML`.
- Modal close sudah menjadi button.
- Sidebar `aria-controls` dan `aria-expanded` membaik.
- Toggle aksesibilitas memiliki `aria-pressed`.
- Kontak SAPA 129, Polri 110, dan PSC 119 tersedia.
- Redaksi PII mencakup lebih banyak pola.

## Roadmap Perbaikan

### Sprint 1: Pulihkan Alur Utama dan CI

- [ ] Perbaiki submit laporan setelah input evidence menjadi teks.
- [ ] Buat `npm test` selesai normal tanpa force exit.
- [ ] Perbaiki seluruh 6 test yang gagal.
- [ ] Track modul baru, security test, dan lockfile.
- [ ] Buat security checks CI benar-benar menggagalkan pipeline.
- [ ] Jadikan konfigurasi production fail-closed.

### Sprint 2: Perbaiki Data Integrity

- [ ] Perbaiki deletion workflow dan legal hold.
- [ ] Filter soft-deleted reports dari daftar aktif.
- [ ] Pindahkan deletion schema ke migration system.
- [ ] Perbaiki report rate limiter.
- [ ] Validasi tanggal masa depan dan kalender.
- [ ] Tambahkan test seluruh workflow status/deletion/legal hold.

### Sprint 3: Harden Backup, Auth, dan Session

- [ ] Perbaiki encrypted backup/restore.
- [ ] Tolak encryption tanpa key.
- [ ] Hilangkan key dari query URL.
- [ ] Tambahkan dry-run wajib, pre-restore backup, step-up auth, dan approval.
- [ ] Gunakan persistent session/rate-limit store.
- [ ] Validasi entropi secret dan admin password.

### Sprint 4: UI, Safety, dan Operasional

- [ ] Koreksi registrasi demo dan klaim anonimitas.
- [ ] Verifikasi/hapus nomor 118.
- [ ] Perbaiki quick escape.
- [ ] Perbarui dokumentasi.
- [ ] Implementasikan backup artifact nyata dan restore drill.
- [ ] Lakukan browser E2E, penetration test, dan manual WCAG audit.

## Test yang Harus Ditambahkan

### Frontend E2E

- Form laporan dengan deskripsi bukti berhasil dikirim.
- Laporan anonim dan rahasia tampil sesuai kebijakan.
- Tidak ada console error pada submit.
- Modal, sidebar, quick escape, dan aksesibilitas bekerja keyboard-only.

### Rate Limit

- Anonymous report burst tanpa cookie menghasilkan 429.
- Rotasi `X-Forwarded-For` tidak melewati limiter.
- Timer limiter tidak membuat test process menggantung.

### Backup/Restore

- Encrypt tanpa key ditolak.
- Encrypted backup dapat direstore.
- Wrong key dan corrupt checksum ditolak tanpa perubahan database.
- Restore besar dalam batas yang diizinkan berhasil.
- Restore melakukan rollback penuh jika satu record invalid.

### Deletion dan Legal Hold

- Pending deletion endpoint berhasil.
- Legal hold mencegah deletion approval.
- Deleted report tidak muncul pada daftar aktif.
- Release legal hold dan deletion approval menghasilkan audit event tunggal.

### Production Configuration

- Startup gagal jika environment production tidak lengkap.
- Deployment tanpa environment eksplisit gagal.
- Demo user dan dev endpoints tidak tersedia pada production.
- Session secret/password lemah ditolak.

## Release Gate Sebelum Pilot

Pilot menggunakan data nyata tidak boleh dimulai sebelum:

- [ ] Submit laporan UI berfungsi end-to-end.
- [ ] Konfigurasi production fail-closed.
- [ ] Seluruh test dan CI lulus tanpa force exit.
- [ ] Security checks CI benar-benar memblokir temuan.
- [ ] Report abuse protection tidak dapat dilewati.
- [ ] Backup terenkripsi dan restore telah diuji.
- [ ] Legal hold dan deletion workflow menjaga integritas data.
- [ ] Production tidak memakai MemoryStore.
- [ ] Kontak darurat telah diverifikasi.
- [ ] Dokumentasi sesuai implementasi.
- [ ] Browser E2E, penetration test, dan manual WCAG audit selesai.

## Kesimpulan

Perubahan terbaru berhasil menyelesaikan banyak temuan lama terkait kredensial admin, anonimitas seed, kontrak API, XSS review, test database isolation, serta aksesibilitas dasar. Namun, fitur baru backup/restore, deletion workflow, legal hold, dan rate limiter belum cukup matang dan saat ini menambah risiko data integrity serta operasional.

Prioritas berikutnya harus memulihkan alur submit laporan dan CI, membuat konfigurasi production fail-closed, lalu memperbaiki workflow backup/deletion/rate-limit sebelum menambah fitur baru.
