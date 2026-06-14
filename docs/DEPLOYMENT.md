# SafeSphere Deployment Guide

Tanggal: 14 Juni 2026

## Prerequisites

- Node.js 18+
- npm
- Reverse proxy Apache/Nginx dengan HTTPS
- Xiaomi MiMo API key (opsional — fallback lokal tersedia)
- SQLite writable path (`repo/data/`)

## Environment Variables (`server/.env`)

| Variable | Required (prod) | Description |
|----------|-----------------|-------------|
| NODE_ENV | Yes | `production` |
| SESSION_SECRET | Yes | Min 32 karakter, entropi tinggi |
| ADMIN_USERNAME | Yes | Username admin bootstrap |
| ADMIN_PASSWORD | Yes | Min 12 karakter |
| PORT | No | Default 3000 |
| HOST | No | Default 127.0.0.1 |
| TRUST_PROXY | Prod | `1` jika di belakang Apache |
| MIMO_API_KEY | Recommended | API key MiMo |
| MIMO_BASE_URL | Recommended | Endpoint MiMo |
| EVIDENCE_UPLOADS_ENABLED | Prod | `true` + encryption key |
| EVIDENCE_ENCRYPTION_KEY | Prod | Min 32 karakter jika upload aktif |

Lihat `server/.env.example` untuk daftar lengkap.

## Local Development

```bash
git clone https://github.com/iggbudi/ppkpt.git
cd ppkpt/server && npm install
cp .env.example .env
# Edit .env
npm start
# Buka http://127.0.0.1:3000
```

## Production — PM2 (current)

```bash
cd /var/www/safesphere.my.id/repo/server
npm install --omit=dev
pm2 start index.js --name safesphere-chat
pm2 save
pm2 startup
```

## Production — Systemd (alternatif)

```bash
sudo cp deploy/safesphere.service /etc/systemd/system/safesphere.service
sudo systemctl daemon-reload
sudo systemctl enable safesphere
sudo systemctl start safesphere
sudo systemctl status safesphere
```

## Sync Frontend

```bash
sudo install -m 644 repo/public/index.html /var/www/safesphere.my.id/public/index.html
sudo install -m 644 repo/public/app.js /var/www/safesphere.my.id/public/app.js
# Ulangi untuk js/*, style.css, vendor/, edukasi/
```

## Apache Proxy

```apache
ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/
```

Static files dilayani langsung dari `/var/www/safesphere.my.id/public/`.

## Health & Monitoring

```bash
curl -s http://127.0.0.1:3000/api/health | jq
```

Health mencakup: database, disk, quarantine count, MiMo circuit breaker.

Admin endpoints:
- `GET /api/admin/status`
- `GET /api/admin/evidence/health`
- `GET /api/admin/chat/logs` (metadata only, tanpa isi pesan)

## Testing sebelum deploy

```bash
cd server && npm test                    # 78 API/unit tests
cd ../e2e && npm install && npm test     # Playwright E2E
```

## Incident & Secret Rotation

- [INCIDENT-RESPONSE-EVIDENCE.md](../INCIDENT-RESPONSE-EVIDENCE.md)
- [INCIDENT-DRILL-LOG.md](./INCIDENT-DRILL-LOG.md)
- [SECRET-ROTATION.md](./SECRET-ROTATION.md)

## Pilot Release

Lihat [RELEASE-NOTES-PILOT.md](./RELEASE-NOTES-PILOT.md) untuk known limitations.