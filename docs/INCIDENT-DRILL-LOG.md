# Incident Response Drill Log

Tanggal drill: 14 Juni 2026  
Lingkup: Evidence upload + MiMo outage + secret rotation tabletop

## Drill 1 — Malware upload (EICAR)

| Langkah | Hasil |
|---------|-------|
| Upload file EICAR via API test | ✅ Ditolak, laporan di-rollback |
| Audit log `evidence.scan` | ✅ Tercatat tanpa isi file |
| File tidak bisa diunduh | ✅ Verified di sprint2.test.js |

## Drill 2 — MiMo provider outage

| Langkah | Hasil |
|---------|-------|
| Simulasi failure circuit breaker | ✅ Fallback template setelah threshold |
| Chat tetap merespons | ✅ source=fallback |
| Metadata chat tanpa isi pesan | ✅ sprint5.test.js |

## Drill 3 — Backup & restore evidence

| Langkah | Hasil |
|---------|-------|
| Backup artifact | ✅ sprint2 evidence artifact test |
| Restore + hash verify | ✅ Lulus |

## Drill 4 — Secret rotation tabletop

| Langkah | Hasil |
|---------|-------|
| Prosedur SESSION_SECRET | ✅ Dokumentasi SECRET-ROTATION.md |
| Dampak sesi logout | ✅ Diterima untuk pilot |

## Tindak lanjut

- [ ] Drill restore penuh di staging bulanan
- [ ] Pentest eksternal sebelum perluasan pilot
- [ ] Integrasi alerting email/Slack untuk alert critical