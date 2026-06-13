# SafeSphere Deployment Guide

## Prerequisites
- Node.js 18+
- npm
- Reverse proxy (Apache/Nginx) untuk HTTPS
- Xiaomi MiMo API key

## Environment Variables (server/.env)

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No | Server port (default: 3000) |
| HOST | No | Server host (default: 127.0.0.1) |
| MIMO_API_KEY | Yes | Xiaomi MiMo API key |
| MIMO_BASE_URL | Yes | MiMo API base URL |
| MIMO_MODEL | No | Model name (default: mimo-v2.5) |
| SESSION_SECRET | Yes | Session encryption secret |
| CHAT_RATE_LIMIT_MAX | No | Max requests per window (default: 60) |

## Local Development

```bash
git clone https://github.com/iggbudi/ppkpt.git
cd ppkpt
npm install
cd server && npm install && cd ..
cp server/.env.example server/.env
# Edit server/.env
npm start
# Buka http://localhost:3000
```

## Production

```bash
pm2 start server/index.js --name safesphere
pm2 save
pm2 startup
```

## Health Check

```bash
curl http://localhost:3000/api/health
```

## Incident Response

1. API abuse → check rate limit, block IP
2. High-risk escalation → review audit log, contact security
3. Data breach → rotate SESSION_SECRET
4. Provider outage → fallback to local risk classifier
