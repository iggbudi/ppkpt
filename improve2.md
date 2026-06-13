# Re-Audit dan Rencana Improvement Lanjutan SafeSphere

Tanggal re-audit: 13 Juni 2026  
Acuan: `improve-codex.md` dan implementasi terbaru pada branch `master`.

## Ringkasan Eksekutif

Implementasi SafeSphere sudah meningkat signifikan:

- Static asset telah dipisahkan ke `public/`.
- Security headers melalui Helmet telah aktif.
- Autentikasi, session, laporan, RBAC, dan audit log dasar telah dipindahkan ke backend.
- Alur laporan anonim dan rahasia telah dibedakan pada UI.
- Safety check, AI consent, PII redaction dasar, rate limit, serta evaluasi risk classifier telah ditambahkan.
- Seluruh 25 test lulus dan `npm audit` tidak menemukan vulnerability.

Namun, aplikasi **belum layak untuk pilot menggunakan data nyata**. Beberapa kontrol keamanan dan privasi masih bersifat prototipe, sejumlah alur frontend tidak kompatibel dengan schema backend, serta dokumentasi threat model dan aksesibilitas menandai beberapa item sebagai selesai meskipun implementasinya belum memenuhi acceptance criteria.

Prioritas tertinggi:

1. Pastikan laporan anonim tidak dapat dikaitkan ke akun atau IP.
2. Perbaiki kontrak data laporan antara backend dan frontend.
3. Harden autentikasi, session, error handling, dan rate limit.
4. Terapkan validasi schema server-side dan hapus sink XSS.
5. Koreksi seluruh klaim UI dan dokumentasi agar sesuai implementasi.
6. Selesaikan aksesibilitas modal, navigasi, kontrol dinamis, dan focus management.

## Hasil Validasi

- `npm test`: 25/25 test lulus.
- `npm run check`: lulus.
- `npm audit` root: 0 vulnerability.
- `npm audit` server: 0 vulnerability.
- Security headers aktif melalui Helmet.
- File internal tidak lagi disajikan sebagai raw file.
- Otomasi browser visual tidak dapat dilakukan karena in-app browser tidak tersedia.

## Temuan Kritis

### P0-1: Laporan berlabel anonim masih dapat dikaitkan ke pengguna

**Bukti kode**

- `server/reports.js:24-27` membaca session user walaupun laporan anonim.
- `server/reports.js:40` menyimpan `authorId` dari session.
- `server/reports.js:47-54` menyimpan `userId` dan IP pada audit log.
- UI menyatakan identitas tidak dikumpulkan pada `public/index.html:203-207`.

**Hasil pengujian langsung**

Laporan yang dibuat oleh user login dengan `isAnonymous: true` menghasilkan:

```text
isAnonymous: true
authorId: 2
authorName: D***
audit userId: 2
audit IP: 127.0.0.1
```

**Dampak**

Pernyataan "identitas tidak dikumpulkan" tidak benar. Admin atau pihak yang mengakses audit log dapat menghubungkan laporan anonim dengan akun pelapor.

**Perbaikan**

- Tentukan kebijakan anonimitas yang eksplisit.
- Untuk laporan anonim:
  - Set `authorId: null`.
  - Jangan menyimpan `userId` dalam audit event laporan.
  - Jangan menyimpan IP mentah; gunakan agregasi, hash dengan rotasi, atau hilangkan jika tidak benar-benar diperlukan.
  - Jangan mengembalikan identifier internal ke client.
- Pisahkan audit keamanan sistem dari metadata identitas pelapor.
- Tambahkan test yang memastikan laporan anonim dari session aktif tetap tidak memiliki identifier akun.

**Acceptance criteria**

- Laporan anonim dari pengguna login dan logout menghasilkan data identitas yang sama-sama kosong.
- Admin tidak dapat menghubungkan laporan anonim ke akun melalui API, audit log, atau storage.

### P0-2: Kontak darurat tidak tersedia tetapi direkomendasikan pada kondisi risiko tinggi

**Bukti**

- Kontak darurat masih bertuliskan `Belum tersedia (demo)` pada `public/index.html:381-383`.
- High-risk response mengarahkan pengguna ke kontak darurat pada `server/index.js:58-70`.
- Safety check mengarahkan pengguna dalam bahaya langsung ke `#kontak`.

**Dampak**

Pengguna dalam situasi berbahaya diarahkan ke halaman tanpa jalur bantuan yang dapat digunakan.

**Perbaikan**

- Untuk demo, tampilkan jalur bantuan umum yang telah diverifikasi atau jangan menjanjikan kontak kampus.
- Tambahkan owner, tanggal verifikasi, jam layanan, dan mekanisme update kontak.
- Jangan menampilkan CTA "Kontak Darurat" sampai minimal satu jalur bantuan valid tersedia.
- Review seluruh safety copy bersama ahli domain.

**Acceptance criteria**

- Setiap CTA darurat mengarah ke nomor atau kanal yang valid dan dapat digunakan.
- Kontak memiliki owner dan tanggal verifikasi.

### P0-3: Schema backend dan frontend laporan tidak kompatibel

**Schema backend**

```text
category
location
urgency
incidentDate
description
authorId
authorName
```

**Schema yang dibaca frontend**

```text
cat
loc
urg
date
desc
author
displayName
```

**Bukti**

- Backend: `server/reports.js:29-43`.
- Admin frontend: `public/js/admin.js:60-124`.
- User dashboard: `public/js/reports.js:86-131`.

**Dampak**

- Dashboard admin menampilkan nilai `undefined`.
- Metrik urgency dan kategori tidak akurat.
- Detail laporan tidak menampilkan data yang benar.
- Dashboard user masih bergantung pada `localStorage` dan tidak memuat laporan dari API.
- Tombol tracking anonim mengarah ke dashboard login dan tidak dapat melacak laporan.

**Perbaikan**

- Definisikan satu schema canonical untuk report.
- Gunakan nama properti backend secara konsisten pada frontend.
- Tambahkan mapper hanya jika diperlukan dan uji kontraknya.
- Dashboard user harus memanggil `GET /api/reports`.
- Hapus `Storage.load('reports')` sebagai sumber laporan.
- Untuk laporan anonim, jangan tampilkan tombol tracking jika memang tidak dapat dilacak.
- Tambahkan contract/integration test untuk seluruh report lifecycle.

**Acceptance criteria**

- Report create, admin list, admin detail, status update, dan user dashboard menampilkan data yang sama.
- Tidak ada field `undefined`.
- Tidak ada laporan sensitif yang dibaca dari `localStorage`.

## Temuan Prioritas Tinggi

### P1-1: Session dan autentikasi belum production-safe

**Bukti**

- Password admin dan demo hard-coded: `server/auth.js:3-5`.
- Session secret memiliki fallback diketahui: `server/index.js:38`.
- Cookie menggunakan `secure: false`: `server/index.js:43`.
- Session masih memakai default MemoryStore.
- Session ID tidak berubah setelah login.
- Tidak ada rate limit pada login.
- Password bertipe non-string menyebabkan HTTP 500.
- Error response dapat membocorkan stack trace dan path server.

**Hasil pengujian**

- 12 login gagal berturut-turut seluruhnya hanya menghasilkan 401, tanpa 429.
- Session ID sebelum dan setelah login sama.
- Payload password angka menghasilkan HTTP 500 dengan stack trace.

**Perbaikan**

- Tolak startup production jika `SESSION_SECRET` tidak tersedia atau terlalu lemah.
- Gunakan cookie `secure: true` pada HTTPS dan konfigurasi `trust proxy` yang benar.
- Gunakan external session store.
- Regenerate session setelah login dan destroy secara lengkap saat logout.
- Tambahkan rate limit login berbasis akun dan IP.
- Validasi tipe username/password sebelum memanggil bcrypt.
- Tambahkan centralized error handler yang tidak membocorkan stack trace.
- Pindahkan demo user/password ke seed development-only.

**Acceptance criteria**

- Tidak ada hard-coded production credential.
- Session ID berubah setelah login.
- Brute force menghasilkan throttling/lockout yang sesuai.
- Invalid input selalu menghasilkan JSON 4xx tanpa stack trace.

### P1-2: Validasi laporan server-side belum memadai

**Hasil pengujian langsung**

API menerima:

```text
category: <img src=x onerror=alert(1)>
location: <a href=https://evil.example>click</a>
urgency: NotARealUrgency
incidentDate: 2099-12-31
description: <form><input name=password></form>
evidence: evil.exe
```

**Dampak**

- Data tidak valid masuk ke sistem.
- Stored XSS menjadi mungkin karena frontend menggunakan `innerHTML`.
- Kategori, urgency, tanggal, dan bukti tidak dapat dipercaya.

**Perbaikan**

- Tambahkan schema validation server-side menggunakan library terstruktur seperti Zod, Joi, atau JSON Schema.
- Terapkan allowlist kategori, urgency, status, tanggal, panjang teks, dan format evidence.
- Tolak tanggal masa depan jika tidak valid untuk domain.
- Normalisasi string tanpa mengubah data menjadi HTML entity.
- Evidence harus menggunakan upload service nyata atau field harus dihapus dari demo.
- Tambahkan test invalid payload dan XSS payload.

**Acceptance criteria**

- Payload di luar schema mendapat HTTP 400.
- Tidak ada data user-controlled yang dirender melalui `innerHTML`.

### P1-3: Stored/DOM XSS masih terbuka

**Bukti**

- `public/app.js:302-308` memasukkan input form ke `innerHTML`.
- `public/js/admin.js:93-124` memasukkan data API ke HTML dinamis.
- `public/js/reports.js:45-131` menggunakan `innerHTML`, `insertAdjacentHTML`, dan inline `onclick`.
- CSP masih mengizinkan inline style dan kode masih memiliki inline event handler.

**Perbaikan**

- Render seluruh data dinamis memakai `textContent`, `createEl`, atau template DOM aman.
- Hapus semua inline `onclick`, `onmouseover`, dan `onmouseout`.
- Gunakan event delegation atau listener eksplisit.
- Tambahkan automated test yang memastikan payload XSS tampil sebagai teks.
- Setelah inline style dipindahkan, hapus `style-src 'unsafe-inline'`.

### P1-4: Klaim PII redaction dan consent AI terlalu luas

**Bukti**

- Consent menyatakan identitas tidak dikirim: `public/index.html:403-405`.
- Redaction hanya mendeteksi email dan nomor tanpa spasi: `server/index.js:114-120`.

**Hasil pengujian**

Berikut tidak teredaksi:

```text
Nama saya Budi Santoso
NIM saya 123456789
Nomor saya 0812 3456 7890
```

**Perbaikan**

- Ubah copy consent menjadi faktual: sistem mencoba meredaksi pola tertentu tetapi pengguna tetap harus menghindari PII.
- Tambahkan redaksi nomor dengan spasi/pemisah dan identifier kampus.
- Jangan mengklaim redaksi nama otomatis jika belum dapat dilakukan dengan andal.
- Tambahkan test redaction Bahasa Indonesia.
- Dokumentasikan retention dan pemrosesan provider.

### P1-5: Tracking ID dan anonymous tracking belum diselesaikan

**Bukti**

- ID masih memakai `Math.random()` dengan sekitar 9.000 kemungkinan: `server/reports.js:30`.
- Tahun hard-coded.
- UI menampilkan nomor tracking untuk laporan anonim, tetapi tidak ada endpoint tracking anonim.
- Tombol tracking mengarah ke dashboard yang memerlukan login.

**Perbaikan**

- Gunakan identifier publik dengan entropi tinggi, misalnya UUID/ULID.
- Jika anonymous tracking diperlukan, gunakan tracking secret terpisah.
- Jangan menggunakan ID sebagai satu-satunya authorization factor.
- Tambahkan rate limit, expiry, dan audit pada anonymous tracking.
- Jika tracking anonim tidak didukung, jangan tampilkan tombol tracking.

### P1-6: Endpoint laporan anonim tidak memiliki abuse protection

Endpoint `POST /api/reports` dapat dipanggil tanpa autentikasi dan tanpa rate limit.

**Perbaikan**

- Tambahkan rate limit khusus laporan.
- Tambahkan batas body dan panjang field.
- Tambahkan abuse monitoring.
- Pertimbangkan challenge aksesibel jika abuse terdeteksi.
- Jangan mengorbankan anonimitas dengan logging IP permanen.

## Temuan UI/UX

### UX-1: Klaim UI masih tidak sesuai implementasi

Copy yang perlu diperbaiki:

- "Status laporan dipantau realtime" pada beranda.
- "Laporan terenkripsi milik Anda" pada dashboard.
- "Pembaruan status secara real-time".
- "Data disimpan secara lokal" dan "laporan disimpan di browser lokal", padahal laporan kini berada di memory backend.
- "Upload Bukti" dan "Maks 5MB", padahal hanya nama file yang dikirim.
- "Akun Anda terverifikasi", padahal registrasi hanya simulasi.
- "Ruang ini aman dan anonim", walaupun pesan dikirim ke layanan AI pihak ketiga.

**Perbaikan**

- Lakukan audit copy menyeluruh.
- Gunakan istilah demo/simulasi secara konsisten.
- Sembunyikan fitur yang belum tersedia, bukan hanya menampilkan success palsu.
- Jangan meminta password pada form registrasi simulasi.

### UX-2: Form bertahap tidak memvalidasi setiap langkah

Tombol `Selanjutnya` hanya berpindah langkah tanpa memeriksa field required. Validasi HTML baru terjadi saat submit akhir.

**Perbaikan**

- Validasi field pada setiap langkah sebelum melanjutkan.
- Fokuskan field pertama yang invalid.
- Tampilkan error summary yang jelas.
- Tambahkan `aria-invalid` dan `aria-describedby`.

### UX-3: Quick escape belum memenuhi threat model

Quick escape masih menampilkan iframe Wikipedia dan mengganti title tanpa:

- Mengubah URL/history.
- Membersihkan state sensitif.
- Menutup session.
- Menjamin iframe dapat dimuat.

**Perbaikan**

- Definisikan ulang quick escape sebagai fitur demo atau implementasikan redirect ke URL netral.
- Uji shared-device scenario, browser history, keyboard, dan mobile.

## Temuan Aksesibilitas

Dokumen `docs/ACCESSIBILITY-AUDIT.md` menandai beberapa item sebagai selesai secara tidak akurat.

### A11Y-1: Modal belum aksesibel

- Modal tidak memiliki `role="dialog"` atau `aria-modal`.
- Close modal masih berupa `<span>`, bukan `<button>`.
- Tidak ada focus trap atau focus return.
- Tidak ada close via Escape yang spesifik untuk modal.

### A11Y-2: Navigasi dan widget belum expose state

- Hamburger tidak memiliki `aria-expanded`.
- A11y menu toggle tidak memiliki `aria-expanded`.
- Toggle aksesibilitas tidak memiliki `aria-pressed`.
- Sidebar tidak mengelola focus saat dibuka.

### A11Y-3: Kontrol dan output dinamis belum semantik

- Chat textarea tidak memiliki label.
- Report item berupa `<div>` dengan inline click.
- Progress step tidak memiliki semantics.
- Chart tidak memiliki alternatif tabel/ringkasan.
- Error belum dihubungkan ke input dengan `aria-describedby`.
- Tidak ada focus style global `:focus-visible` yang konsisten.

### A11Y-4: Audit belum membuktikan WCAG 2.2 AA

Belum ada:

- Manual screen reader testing.
- Keyboard flow testing end-to-end.
- Contrast verification.
- Zoom 200%/400%.
- Reflow/mobile visual QA.

**Perbaikan**

- Koreksi status checklist menjadi "belum diverifikasi" sampai pengujian manual selesai.
- Tambahkan axe/pa11y di CI.
- Lakukan pengujian NVDA atau screen reader lain.

## Temuan Dokumentasi dan Operasional

### DOC-1: Threat model melebih-lebihkan status mitigasi

`docs/THREAT-MODEL.md` menyatakan beberapa ancaman "Mitigated", tetapi:

- Data tampering masih mungkin melalui payload API tidak valid.
- XSS belum termitigasi karena data API masuk ke `innerHTML`.
- CSRF hanya mengandalkan SameSite dan JSON Content-Type.
- API abuse belum mencakup login dan laporan.
- PII redaction belum mencakup banyak identifier.

Perbarui status menjadi `Partial` atau `Open` sesuai bukti.

### DOC-2: Tidak ada CI security pipeline

Tidak ditemukan `.github/workflows` atau pipeline lain yang menjalankan:

- Test.
- Dependency audit.
- Secret scanning.
- Static analysis.
- Accessibility checks.

### OPS-1: Storage dan audit log masih in-memory

- Semua laporan dan audit log hilang saat restart.
- Default session MemoryStore tidak cocok untuk production.
- Tidak ada database, backup otomatis, restore test, retention, atau deletion workflow.

## Roadmap Perbaikan

### Sprint 1: Blocker Privasi dan Fungsional

- [ ] Benarkan anonimitas laporan: hapus `authorId`, `userId`, dan IP mentah untuk laporan anonim.
- [ ] Samakan schema laporan frontend/backend.
- [ ] Pindahkan dashboard user sepenuhnya ke API.
- [ ] Hapus tracking anonim palsu atau implementasikan tracking secret.
- [ ] Koreksi CTA darurat dan seluruh klaim UI yang tidak benar.
- [ ] Tambahkan test anonimitas dan report contract.

### Sprint 2: Security Hardening

- [ ] Tambahkan schema validation untuk seluruh endpoint.
- [ ] Hapus sink `innerHTML` dan inline event handler.
- [ ] Tambahkan login/report rate limit.
- [ ] Regenerate session setelah login.
- [ ] Gunakan production session store.
- [ ] Wajibkan `SESSION_SECRET` dan secure cookie pada production.
- [ ] Tambahkan centralized JSON error handler.
- [ ] Tambahkan test XSS, invalid types, brute force, dan session fixation.

### Sprint 3: UX dan Aksesibilitas

- [ ] Validasi setiap langkah form.
- [ ] Implementasikan dialog aksesibel.
- [ ] Tambahkan label chat dan state ARIA.
- [ ] Buat report item sebagai button/link semantik.
- [ ] Tambahkan global focus-visible style.
- [ ] Tambahkan tabel alternatif chart.
- [ ] Lakukan manual keyboard, screen reader, contrast, zoom, dan reflow QA.

### Sprint 4: Data dan Operasional

- [ ] Implementasikan database dan migration.
- [ ] Implementasikan private object storage jika upload bukti diaktifkan.
- [ ] Tambahkan malware scan dan metadata stripping.
- [ ] Implementasikan retention, deletion, backup, dan restore.
- [ ] Gunakan audit log append-only yang tidak mengorbankan anonimitas.
- [ ] Tambahkan CI untuk test, audit, secret scan, SAST, dan aksesibilitas.

## Test yang Perlu Ditambahkan

### Security

- Laporan anonim dari user login tidak memiliki `authorId`, audit `userId`, atau IP mentah.
- Payload XSS dirender sebagai teks.
- Invalid category, urgency, date, dan evidence ditolak.
- Login brute force dibatasi.
- Session ID berubah setelah login.
- Invalid JSON/type tidak mengembalikan stack trace.

### Integration

- User login membuat laporan rahasia lalu melihatnya di dashboard.
- Admin melihat laporan, membuka detail, dan mengubah status.
- User melihat status terbaru.
- Anonymous report tidak dapat dilacak melalui akun.
- Restart behavior sesuai dokumentasi.

### Accessibility

- Modal focus trap dan focus return.
- Semua alur dapat dijalankan keyboard-only.
- Error terhubung ke field.
- Route change dan status update diumumkan screen reader.

## Release Gate Sebelum Pilot

Pilot dengan data nyata tetap tidak boleh dimulai sebelum:

- [ ] Laporan anonim benar-benar tidak dapat dikaitkan ke pengguna.
- [ ] Kontak darurat valid dan telah diverifikasi.
- [ ] Schema laporan konsisten dan seluruh alur utama berfungsi.
- [ ] Tidak ada data user-controlled yang masuk ke `innerHTML`.
- [ ] Session dan autentikasi production-safe.
- [ ] Validasi API dan abuse protection tersedia.
- [ ] Database, retention, deletion, backup, dan incident response tersedia.
- [ ] Seluruh klaim UI sesuai implementasi.
- [ ] Threat model dan accessibility audit diperbarui berdasarkan bukti.
- [ ] Tidak ada P0/P1 terbuka.
- [ ] Penetration test dan WCAG 2.2 AA manual audit selesai.

## Status Fase Terhadap `improve-codex.md`

| Fase | Status | Catatan |
|---|---|---|
| Fase 0: Containment | Partial | Static isolation dan headers selesai; klaim UI serta kontak darurat belum selesai |
| Fase 1: Backend dan Data | Partial | Auth/RBAC/API ada; anonimitas, storage, schema, session, dan upload belum selesai |
| Fase 2: UX dan Aksesibilitas | Partial | Choice flow dan step form ada; tracking, validation, modal, ARIA, dan manual QA belum selesai |
| Fase 3: AI Safety | Partial | Consent, redaction dasar, rate limit, evaluation ada; PII coverage dan handoff belum cukup |
| Fase 4: Hardening | Partial | Test dan docs ada; CI, pentest, database, operasional, serta audit manual belum tersedia |

## Kesimpulan

Perubahan terbaru berhasil mengatasi beberapa kelemahan awal paling terlihat, terutama static file exposure dan client-only authorization. Namun, implementasi saat ini masih merupakan prototipe dan belum memenuhi release gate yang ditetapkan dalam `improve-codex.md`.

Fokus berikutnya sebaiknya bukan menambah fitur baru, tetapi menyelesaikan anonimitas, kontrak data, validasi server, session hardening, XSS removal, serta koreksi klaim UI dan dokumentasi.
