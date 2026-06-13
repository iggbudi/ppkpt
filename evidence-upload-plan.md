# Rencana Implementasi Unggah Bukti SafeSphere

Tanggal: 13 Juni 2026

## Tujuan

Menambahkan unggah bukti pada alur Lapor Anonim dan Lapor Rahasia tanpa membocorkan identitas pelapor, metadata sensitif, atau file kepada pengguna yang tidak berwenang.

Fitur teks `evidence` yang sudah ada tetap dipertahankan sebagai deskripsi bukti. File disimpan sebagai entitas terpisah.

## Keputusan Arsitektur

- File tidak boleh disimpan di `public/` atau dilayani melalui URL statis.
- Metadata file disimpan pada tabel `evidence_files`; isi file disimpan pada private object storage.
- Untuk development/test, gunakan adapter penyimpanan lokal privat di luar `public/`.
- Untuk production, gunakan object storage privat dengan enkripsi at-rest dan lifecycle policy.
- Download hanya melalui endpoint backend setelah pemeriksaan sesi, role, kepemilikan laporan, legal hold, dan audit.
- Nama file asli tidak digunakan sebagai nama object. Gunakan UUID acak.
- File tidak tersedia untuk admin sebelum status scan menjadi `clean`.
- Upload anonim tidak menyimpan user ID pada metadata file atau audit pembuatan laporan.

## Batas Awal

- Maksimal 5 file per laporan.
- Maksimal 10 MB per file dan 25 MB total per laporan.
- Tipe awal: PDF, PNG, JPEG, WebP, TXT, MP3, M4A, dan MP4.
- Validasi berdasarkan MIME hasil pemeriksaan isi file, bukan hanya ekstensi/header browser.
- Tolak executable, archive, macro-enabled document, SVG, HTML, dan format yang tidak dikenal.
- Deskripsi bukti tetap opsional dengan batas maksimal 500 karakter.

## Model Data

Tambahkan migration baru:

```sql
CREATE TABLE evidence_files (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  safe_name TEXT NOT NULL,
  detected_mime TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'pending',
  scan_result TEXT,
  uploaded_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);
```

Nilai `scan_status`: `pending`, `clean`, `rejected`, atau `error`.

Tambahkan index pada `report_id`, `scan_status`, dan `sha256`.

## Alur Pengguna

1. Pengguna mengisi laporan dan memilih file bukti.
2. UI menampilkan nama, ukuran, progress, batas file, serta peringatan metadata.
3. Browser mengirim laporan dan file menggunakan `multipart/form-data`.
4. Server memvalidasi field laporan sebelum menyimpan file.
5. Server memvalidasi jumlah, ukuran, signature/MIME, lalu menghitung SHA-256.
6. Server menghapus metadata yang aman untuk dihapus pada gambar sebelum penyimpanan final.
7. File masuk area quarantine dan status scan menjadi `pending`.
8. Scanner malware memproses file secara asynchronous.
9. Hanya file `clean` yang dapat diakses admin/pemilik laporan.
10. File `rejected` dihapus dari storage dan alasan generik ditampilkan tanpa detail scanner sensitif.

Jika laporan gagal dibuat, seluruh file sementara harus dihapus.

## Endpoint

- `POST /api/reports`
  - Ubah agar menerima `multipart/form-data`.
  - Field laporan tetap divalidasi dengan Zod.
  - Upload file opsional.

- `GET /api/reports/:reportId/evidence`
  - Mengembalikan metadata file yang boleh dilihat pengguna.

- `GET /api/reports/:reportId/evidence/:fileId/download`
  - Memeriksa otorisasi dan status scan.
  - Mengirim file sebagai attachment dengan header aman.

- `DELETE /api/reports/:reportId/evidence/:fileId`
  - Hanya sebelum laporan diproses, atau oleh admin sesuai kebijakan.
  - Ditolak jika legal hold aktif.

Jangan membuat URL object storage publik atau permanen. Jika menggunakan signed URL, masa berlaku maksimal 60 detik dan tetap diaudit.

## Kontrol Keamanan

- Gunakan parser upload streaming agar file besar tidak memenuhi memory.
- Terapkan rate limit khusus upload berdasarkan IP dan report/session signal.
- Batasi request body di reverse proxy dan aplikasi.
- Sanitasi nama file untuk display; jangan gunakan sebagai path.
- Pastikan storage key tidak dapat dipilih pengguna.
- Gunakan `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, dan CSP yang sesuai.
- Audit upload, hasil scan, download, penghapusan, dan kegagalan akses.
- Audit anonim tidak menyimpan IP pada event pembuatan bukti; abuse-control metadata dipisah dan memiliki retention pendek.
- File mengikuti legal hold, deletion workflow, retention, backup, dan purge laporan.
- Backup file dan database harus konsisten serta terenkripsi.
- Jangan meneruskan file bukti ke layanan AI.

## UI/UX dan Aksesibilitas

- Pisahkan label `Deskripsi Bukti` dan `Unggah File Bukti`.
- Sediakan tombol file picker yang dapat digunakan keyboard.
- Tampilkan tipe, ukuran, jumlah maksimum, dan status scan sebelum submit.
- Tampilkan progress per file serta tombol batal/hapus.
- Berikan peringatan: file dapat memuat nama, lokasi, wajah, suara, atau metadata perangkat.
- Jelaskan bahwa anonim berarti identitas akun tidak dicatat pada laporan, bukan anonimitas jaringan absolut.
- Gunakan pesan error spesifik dan dapat dipulihkan tanpa menghapus isi form.
- Quick escape harus membatalkan upload aktif dan membersihkan daftar file dari UI.

## Tahapan Implementasi

### Fase 1: Fondasi

- [ ] Tambahkan migration `evidence_files`.
- [ ] Buat interface storage: `put`, `get`, `delete`, dan `quarantine`.
- [ ] Implementasikan local private storage adapter untuk development/test.
- [ ] Tambahkan konfigurasi batas upload dan allowlist MIME.
- [ ] Tambahkan cleanup file sementara.

### Fase 2: Upload Aman

- [ ] Implementasikan multipart streaming pada `POST /api/reports`.
- [ ] Validasi signature/MIME, ukuran, jumlah, dan SHA-256.
- [ ] Simpan file ke quarantine.
- [ ] Implementasikan scanner malware dan metadata stripping.
- [ ] Pastikan transaction/cleanup berjalan saat salah satu file gagal.

### Fase 3: Akses dan Lifecycle

- [ ] Implementasikan endpoint daftar/download/hapus bukti.
- [ ] Terapkan authorization, legal hold, retention, dan audit.
- [ ] Integrasikan file ke backup/restore dan deletion workflow.
- [ ] Tambahkan scheduled cleanup untuk file orphan/rejected/expired.

### Fase 4: UI/UX

- [ ] Tambahkan file picker, daftar file, progress, status scan, dan error state.
- [ ] Pertahankan deskripsi bukti sebagai field terpisah.
- [ ] Batalkan upload dan bersihkan UI saat quick escape.
- [ ] Uji keyboard-only, screen reader, mobile, koneksi lambat, dan retry.

### Fase 5: Production Hardening

- [ ] Gunakan private object storage production.
- [ ] Aktifkan enkripsi, lifecycle policy, monitoring, dan alert.
- [ ] Jalankan restore drill yang mencakup file.
- [ ] Lakukan penetration test khusus upload/download.
- [ ] Dokumentasikan incident response untuk file berbahaya.

## Test Wajib

- File valid berhasil diunggah dan hanya dapat diunduh pihak berwenang.
- File tanpa ekstensi tetapi MIME valid diproses sesuai hasil deteksi.
- Ekstensi palsu, executable, SVG/HTML, file terlalu besar, dan jumlah berlebih ditolak.
- Malware test fixture ditolak dan tidak dapat diunduh.
- Path traversal pada nama file tidak memengaruhi storage path.
- Pengguna lain tidak dapat melihat atau mengunduh bukti.
- File `pending`, `rejected`, dan `error` tidak dapat diunduh.
- Anonymous upload tidak mencatat user ID pada report/audit.
- Legal hold mencegah penghapusan bukti.
- Soft delete, purge, backup, restore, dan cleanup orphan konsisten.
- Kegagalan sebagian tidak meninggalkan file atau row orphan.
- Quick escape membatalkan upload aktif.

## Release Gate

Fitur belum boleh dipakai untuk data nyata sebelum:

- Seluruh test upload/download/lifecycle lulus.
- Object storage production bersifat private dan terenkripsi.
- Malware scanner aktif dan kegagalan scanner bersifat fail-closed.
- Authorization dan audit download telah diuji.
- Backup/restore file berhasil dalam restore drill.
- Retention, legal hold, dan purge file telah diverifikasi.
- Penetration test upload selesai tanpa temuan kritis/tinggi.

