# Secret Rotation Procedure — SafeSphere Pilot

Tanggal: 14 Juni 2026

## SESSION_SECRET

1. Jadwalkan maintenance window 15 menit (semua sesi akan logout).
2. Generate secret baru (min 32 karakter, entropi tinggi):
   ```bash
   openssl rand -base64 48
   ```
3. Update `repo/server/.env` → `SESSION_SECRET=<baru>`.
4. Restart service:
   ```bash
   pm2 restart safesphere-chat
   # atau
   sudo systemctl restart safesphere
   ```
5. Verifikasi:
   ```bash
   curl -s http://127.0.0.1:3000/api/health | jq .ok
   ```
6. Catat rotasi di audit operasional (tanggal, operator, tidak perlu menyimpan secret).

## ADMIN_PASSWORD

1. Set `ADMIN_PASSWORD` baru di `.env` (min 12 karakter).
2. Restart backend — bootstrap akan memperbarui hash admin di tabel `users`.
3. Login admin dengan password baru.
4. Nonaktifkan sesi admin lama jika masih aktif (logout semua admin).

## MIMO_API_KEY

1. Buat key baru di konsol provider MiMo.
2. Update `MIMO_API_KEY` di `.env`.
3. Restart backend.
4. Uji chat SafeBot (`POST /api/chat`).
5. Revoke key lama setelah 24 jam stabil.

## EVIDENCE_ENCRYPTION_KEY

1. Backup penuh database + artifact evidence (`/api/backup`).
2. Deploy key baru hanya jika re-encrypt direncanakan — **jangan rotate tanpa re-encrypt**.
3. Untuk pilot: rotasi encryption key memerlukan migrasi file terenkripsi (hubungi tim infra).

## Frekuensi rekomendasi

| Secret | Frekuensi |
|--------|-----------|
| SESSION_SECRET | 90 hari / setelah insiden |
| ADMIN_PASSWORD | 90 hari |
| MIMO_API_KEY | 180 hari |
| EVIDENCE_ENCRYPTION_KEY | Hanya saat kompromi + drill restore |