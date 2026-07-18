# UX Sprint 01 — Protective Entry Experience

**Status:** Implemented — 18 Juli 2026

**Durasi:** 7 hari kerja
**Target:** mahasiswa korban/saksi yang mengakses dari ponsel dalam kondisi stres
**Area:** beranda dan pintu masuk pelaporan
**North star:** dalam 10 detik pengguna memahami bahwa ia tidak sendirian, dapat melapor tanpa akun, dapat meminta bantuan darurat, dan dapat keluar cepat.

## 1. Tujuan Sprint

Mengubah halaman publik SafeSphere dari tampilan generic blue SaaS menjadi pengalaman yang tenang, manusiawi, dan terasa melindungi, tanpa mengubah API atau kontrak data laporan.

Hierarki pengalaman yang dituju:

1. reassurance;
2. laporan anonim;
3. bantuan darurat;
4. bukti perlindungan;
5. proses setelah melapor;
6. konteks institusional.

## 2. Masalah yang Diselesaikan

- Beranda terasa seperti landing page produk/kompetisi, bukan ruang pendampingan.
- Gradient biru, shadow, card, badge, dan ikon terlalu dominan.
- SDG dan promosi fitur tampil sebelum kebutuhan keselamatan pengguna.
- Tidak ada satu tindakan utama yang jelas bagi korban dalam kondisi stres.
- Copy seperti “Gunakan dengan bijak” berpotensi terdengar menyalahkan.
- Pengguna perlu melewati pilihan tambahan sebelum memulai laporan anonim.
- Emergency action, batas privasi, dan proses tindak lanjut belum cukup jelas.

## 3. Scope

- Design tokens protective calm untuk area publik.
- Restrukturisasi beranda.
- CTA langsung untuk laporan anonim.
- Penyederhanaan pilihan anonim/rahasia.
- Redesign safety check.
- Responsive, keyboard, focus, reduced motion, dan zoom behavior.
- Regression test browser untuk entry flow baru.
- Pembaruan audit aksesibilitas dan status sprint.

## 4. Non-Goals

Sprint ini tidak mencakup:

- perubahan backend, API, database, atau schema laporan;
- redesign empat langkah isi formulir;
- redesign dashboard pengguna/admin;
- redesign SafeBot, edukasi, auth, dan evidence upload;
- rebrand/logo baru atau ilustrasi kompleks;
- testimonial, gamifikasi, animasi dekoratif, atau klaim keamanan baru;
- perubahan perilaku quick escape.

## 5. User Stories

1. Sebagai mahasiswa yang sedang stres, saya langsung melihat pesan empatik dan satu tindakan utama.
2. Sebagai korban yang takut identitas terbuka, saya dapat memulai laporan anonim tanpa login.
3. Sebagai pengguna dalam bahaya, saya dapat menuju bantuan darurat tanpa membuka formulir.
4. Sebagai pengguna dengan privasi terbatas, saya dapat menemukan dan menggunakan quick escape.
5. Sebagai pengguna keyboard atau screen reader, saya memahami urutan dan status setiap keputusan.
6. Sebagai pengguna ponsel, saya tidak menghadapi card overload atau horizontal scroll.

## 6. Design Direction

### Visual tokens

| Token | Arah awal |
|---|---|
| Background | warm off-white `#F6F4EF` |
| Surface | white `#FFFFFF` |
| Text | neutral dark `#24302D` |
| Primary | deep muted teal `#285E61` |
| Primary dark | `#1F4A4D` |
| Protective surface | sage `#DDE9E3` |
| Muted text | `#66736F` |
| Border | `#D9E1DD` |
| Emergency | `#B42318` |
| Radius | 10–12px |

Nilai final harus lolos pemeriksaan kontras; tabel ini adalah titik awal, bukan alasan melewati validasi WCAG.

### Prinsip

- Tidak ada gradient biru pada beranda/report entry.
- Shadow hanya digunakan jika benar-benar menjelaskan lapisan.
- Warna merah hanya untuk kondisi darurat/error.
- Card bukan satu-satunya pembentuk hierarki.
- Hanya ada satu CTA primary pada hero.
- Bahasa menggunakan “kamu”, singkat, empatik, dan tidak menghakimi.
- Tidak ada klaim “100% aman” atau anonimitas absolut.

## 7. Sprint Backlog

### UX-01 — Kunci baseline dan invariant

**Estimasi:** 0,5 hari
**File referensi:** `public/index.html`, `public/app.js`, `public/js/safety.js`, `e2e/tests/*.spec.js`

- Catat flow: `#beranda` → `#lapor` → mode → safety check → form.
- Simpan screenshot baseline 390×844 dan 1440×900 sebagai artifact review.
- Pertahankan ID dan kontrak penting:
  - `#choiceAnonim`;
  - `#choiceRahasia`;
  - `#safetyDanger`;
  - `#safetySafe`;
  - `#quickEscapeBtn`;
  - `#reportForm`.

**Acceptance:** baseline dan invariant tersedia sebelum implementasi; tidak ada perubahan source dalam task ini.

### UX-02 — Protective calm design tokens

**Estimasi:** 1 hari
**File:** `public/style.css`

- Ganti token warna, radius, shadow, dan focus ring.
- Tambahkan `--surface-protective`, `--emergency`, dan `--focus-ring`.
- Hilangkan gradient dan shadow besar pada area sprint.
- Pertahankan status success/warning/error yang tidak bergantung pada warna saja.

**Acceptance:** body text minimal 4.5:1; teks besar/komponen UI minimal 3:1; focus indicator jelas; halaman non-scope tetap terbaca.

### UX-03 — Restrukturisasi beranda

**Estimasi:** 1,5 hari
**File:** `public/index.html`, `public/style.css`

Hero baru:

- heading: **“Kamu tidak harus menghadapi ini sendirian.”**
- CTA primary: **“Lapor tanpa identitas”**;
- CTA secondary: **“Saya butuh bantuan segera”** → `#kontak`;
- trust facts faktual:
  - laporan anonim tidak memerlukan akun;
  - identitas akun tidak dicatat pada laporan anonim;
  - quick escape tersedia;
  - bukti diproses dengan pembatasan keamanan.

Tambahkan bagian “Apa yang terjadi setelah kamu melapor?” maksimal empat langkah. Pindahkan SDG ke bagian terbawah dan turunkan bobot visualnya. Ganti banner pilot dengan copy netral.

**Acceptance:** pada 390×844, reassurance dan kedua tindakan utama terlihat sebelum konten sekunder; SDG tidak mendahului entry pelaporan.

### UX-04 — Direct anonymous entry dan report choice

**Estimasi:** 1 hari
**File:** `public/index.html`, `public/app.js`, `public/style.css`

- Buat helper perilaku tunggal seperti `startReportMode(mode)`.
- CTA hero langsung membuka mode anonim dan safety check.
- Pertahankan pilihan mode saat pengguna masuk dari navigasi `#lapor`.
- Jadikan anonim opsi utama; rahasia opsi sekunder dengan penjelasan login/tracking.
- Pastikan tombol tetap target semantik, bukan hanya card clickable.

**Acceptance:** guest mencapai safety check anonim dalam satu aktivasi; mode rahasia guest tetap menuju login; payload dan `isAnonymous` tidak berubah.

### UX-05 — Redesign safety check

**Estimasi:** 0,5 hari
**File:** `public/index.html`, `public/style.css`, `public/app.js`

- Gunakan protective surface, bukan alarm panel.
- Pisahkan jelas:
  - “Saya dalam bahaya sekarang” → `#kontak`;
  - “Saya aman untuk melanjutkan” → step pertama.
- Jelaskan bahwa SafeSphere bukan layanan respons darurat dan pengguna boleh keluar kapan saja.

**Acceptance:** heading dan penjelasan dibaca sebelum tombol; keputusan tidak ambigu; emergency red tidak mendominasi seluruh layar.

### UX-06 — Responsive dan cognitive load

**Estimasi:** 1 hari
**File:** `public/style.css`, `public/index.html`

- Validasi 320px, 390px, 768px, 950px, dan 1440px.
- Batasi lebar baca 60–68 karakter.
- Target interaksi minimum 44×44px.
- Pastikan CTA bertumpuk pada mobile.
- Hormati `prefers-reduced-motion`.
- Pastikan quick escape tidak tertutup CTA/footer.

**Acceptance:** tidak ada horizontal scroll; zoom 200% tetap reflow; tab order mengikuti urutan visual.

### UX-07 — Regression test protective entry

**Estimasi:** 1 hari
**File baru:** `e2e/tests/victim-entry.spec.js`
**File terkait:** `e2e/tests/smoke.spec.js`, `auth-report.spec.js`, `chat-escape.spec.js`

Test minimum:

- copy dan CTA utama beranda;
- CTA anonim langsung ke safety check;
- jalur bahaya menuju kontak;
- jalur aman membuka step 1;
- mode rahasia guest menuju login;
- keyboard activation dan focus;
- mobile viewport tanpa overflow;
- tidak ada `pageerror`;
- quick escape tetap bekerja dari hero/safety check.

**Acceptance:** test memeriksa perilaku, bukan class dekoratif; seluruh server dan Playwright suite lulus.

### UX-08 — Safety, accessibility, dan copy review

**Estimasi:** 0,5 hari
**File:** `docs/ACCESSIBILITY-AUDIT.md`, `progress.md`

- Audit keyboard, heading, screen reader smoke, contrast, zoom 200%, mobile reflow, reduced motion, dan quick escape.
- Review copy untuk janji privasi, nada menyalahkan, dan emergency routing.
- Catat residual issue secara faktual.

**Acceptance:** audit memiliki tanggal, viewport/perangkat, hasil nyata, dan tidak mengklaim pemeriksaan yang belum dilakukan.

## 8. Rencana 7 Hari

| Hari | Fokus |
|---|---|
| 1 | Baseline, invariant, skeleton test, design tokens |
| 2 | Struktur dan copy beranda |
| 3 | Direct anonymous entry dan report choice |
| 4 | Safety check dan responsive behavior |
| 5 | Playwright regression dan perbaikan integrasi |
| 6 | A11y, contrast, keyboard, zoom, reduced motion |
| 7 | Review copy/safety, before-after review, final validation |

## 9. Global Acceptance Criteria

- Guest dapat memulai laporan anonim dari hero dengan satu aktivasi.
- CTA bantuan selalu menuju `#kontak`, bukan SafeBot atau form.
- Copy membedakan anonimitas akun dari anonimitas jaringan.
- Beranda tidak didominasi gradient, marketing cards, SDG, badge, atau shadow besar.
- API, schema, auth, evidence upload, quick escape, dan form empat langkah tetap kompatibel.
- Tidak ada `innerHTML`/`insertAdjacentHTML` baru untuk data dinamis.
- Tidak ada console/page error atau broken hash routing.
- Tidak ada horizontal overflow pada 320px–1440px.
- WCAG 2.1 AA dipenuhi pada area yang disentuh sprint.

## 10. Safety Constraints

- Quick escape Esc dua kali, abort submit, pembersihan field, overlay, title, dan focus tidak boleh rusak.
- Jangan menggunakan warna sebagai satu-satunya pembeda.
- Jangan menambahkan foto korban, ilustrasi kekerasan, countdown, urgency pressure, atau testimonial traumatis.
- Jangan menyebut SafeBot sebagai ahli manusia.
- Jangan memakai kata “jujur” sebagai syarat moral pada instruksi laporan.
- Heading, skip link, landmark, `aria-current`, live region, dan focus management harus dipertahankan.

## 11. Validation

```bash
git diff --check
node --check public/app.js
cd server && npm test
cd ../e2e && npm test
npx playwright test tests/victim-entry.spec.js tests/smoke.spec.js tests/auth-report.spec.js tests/chat-escape.spec.js
```

Manual review:

- 390×844 mobile;
- 768×1024 tablet;
- 1440×900 desktop;
- zoom 200%;
- keyboard-only;
- screen reader smoke;
- `prefers-reduced-motion: reduce`;
- contrast checker;
- before/after screenshot.

## 12. Definition of Done

- Seluruh backlog sprint selesai tanpa memperluas scope.
- Beranda dan report entry memenuhi acceptance criteria.
- Seluruh server test dan Playwright test lulus.
- Tidak ada page error, horizontal overflow, atau regresi quick escape.
- Contrast, keyboard, mobile, reduced motion, dan zoom 200% telah divalidasi.
- Before/after desktop dan mobile direview product owner.
- Accessibility audit dan progress diperbarui secara faktual.
- Diff direview untuk simplicity, safety copy, accessibility, dan klaim keamanan.
- Working tree hanya memuat file sprint yang disetujui sebelum commit.

## 13. Hasil Implementasi

- 80/80 server tests lulus.
- 14/14 Playwright tests lulus, termasuk 6 test protective entry baru.
- Reflow tanpa horizontal overflow tervalidasi pada 320, 390, 768, 950, dan 1440px.
- Reduced motion, keyboard entry, focus management, emergency route, confidential guest route, dan quick escape tervalidasi otomatis.
- Contrast token yang disentuh lulus perhitungan WCAG AA; detail tercatat di `docs/ACCESSIBILITY-AUDIT.md`.
- Before/after screenshot tersimpan sebagai artifact lokal yang di-ignore di `.pi-subagents/ux-sprint-01/`.
- Manual NVDA/VoiceOver, manual browser zoom 200%, axe/Lighthouse, dan usability test dengan mahasiswa tetap menjadi tindak lanjut.

## 14. Risiko

- Perubahan token global dapat memengaruhi seluruh SPA; lakukan smoke visual pada halaman non-scope.
- Direct anonymous entry dapat membawa stale state pada browser back/hash navigation.
- Copy privasi mudah berubah menjadi janji absolut.
- Emergency CTA yang terlalu dominan dapat meningkatkan kecemasan; terlalu lemah dapat terlewat.
- CSS besar dan bertumpuk dapat menyebabkan specificity regression.
- Sprint ini belum menggantikan usability test dengan mahasiswa; lakukan pengujian terpisah menggunakan protokol etis dan skenario stres rendah.
