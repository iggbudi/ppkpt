# Security Scan Results

Date: 2026-06-13

## npm audit
- Root: 0 vulnerabilities
- Server: 0 vulnerabilities

## Secret Scanning
- API keys in code: None found (no `sk-` patterns in tracked files)
- Hardcoded passwords: Found
  - `server/auth.js:4` — admin password `safesphere` hardcoded in seed data
  - `server/index.js:38` — session secret fallback `'safesphere-session-secret-change-in-production'`
  - `public/js/auth.js:19` — demo credentials displayed in login UI

## CSP Headers
- Content-Security-Policy: present (via `helmet`, configured in `server/index.js:19-32`)
  - defaultSrc: `'self'`
  - scriptSrc: `'self'` + `cdn.jsdelivr.net`
  - styleSrc: `'self'` + `'unsafe-inline'`
  - frameSrc: `id.wikipedia.org`
  - objectSrc: `'none'`
  - baseUri: `'self'`
  - formAction: `'self'`
- X-Frame-Options: DENY (via `helmet` `frameguard: { action: 'deny' }`)
- X-Content-Type-Options: nosniff (helmet default)

## Recommendations
1. Move admin seed password to environment variable
2. Ensure `SESSION_SECRET` is set via `.env` in production (remove hardcoded fallback)
3. Consider removing demo credentials from login UI in production builds
