# SafeSphere Merge Design — GitHub Repo + Local Project

## [S1] Problem

Two versions of SafeSphere exist with complementary strengths:
- **GitHub repo** (`iggbudi/ppkpt`): Mature backend (risk classifier, LLM client, tests, CORS, health endpoint), CSP meta tag, DOM helpers, markdown rendering, chat action buttons
- **Local project** (SAFESPHERE): Modular frontend (8 files), localStorage persistence, hamburger menu, chat avatars

Neither is complete alone. The merge combines both into a single production-ready codebase.

## [S2] Solution Overview

Upgrade local project in-place by:
1. Replace `server.js` with GitHub's `server/` directory (backend upgrade)
2. Add GitHub's frontend features to local modular structure (frontend upgrade)
3. Update chat integration for new backend response format

## [S3] Backend Merge

### Replace server.js with server/ directory

**Delete:** `server.js`

**Create from GitHub:**
- `server/index.js` — Express server with CORS, health endpoint, rate limiter, chat route
- `server/risk.js` — Regex word-boundary risk classifier (more accurate than simple `includes()`)
- `server/mimoClient.js` — LLM client with timeout, context injection, response trimming
- `server/package.json` — dependencies (express, dotenv, cors)
- `server/.env.example` — configuration template
- `server/test/chat.test.js` — unit tests

**Update root `package.json`:**
- Change `start` script to `cd server && node index.js`
- Or keep root `package.json` minimal and let `server/` have its own

### Backend improvements over local server.js

| Feature | Local server.js | GitHub server/ |
|---------|----------------|----------------|
| Risk classifier | Simple `includes()` | Regex word-boundary matching |
| CORS | No | Yes (`cors` middleware) |
| Health endpoint | No | `GET /api/health` |
| Tests | No | Yes (risk, input, rate limit) |
| Response trimming | No | Yes (max 1200 chars) |
| Context injection | No | Yes (user name, risk level) |
| Rate limit headers | No | Yes (RateLimit-Limit, Remaining, Reset) |
| Message length limit | No | Yes (2000 chars max) |

## [S4] Frontend Merge

### Add CSP meta tag to index.html

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; frame-src https://id.wikipedia.org; object-src 'none'; base-uri 'self'; form-action 'self';">
```

### Add DOM helpers to js/utils.js

From GitHub's `app.js`:
- `createEl(tag, options, children)` — create DOM element safely
- `setChildren(element, children)` — clear and set children
- `clearElement(element)` — remove all children
- `appendBr(element)` — append `<br>`
- `appendInlineMarkdown(parent, text)` — render bold/italic/code inline
- `renderMarkdownMessage(element, content)` — render markdown paragraphs/lists
- `renderStrongPrefixMessage(element, message)` — render `<strong>` prefix

### Update js/chat.js

1. Use `createEl` instead of innerHTML for bot messages
2. Add `renderMarkdownMessage` for bot responses (supports bold, italic, lists)
3. Add action button rendering — parse `actions` array from backend response
4. Handle `risk` level display (optional badge)
5. Handle `source` for fallback messages

### Update chat page HTML

- Add `safebot-disclaimer` div
- Update chat container structure (`.chat-container`, `.chat-messages`, `.chat-input-area`)
- Remove avatars (GitHub uses simpler bubble-only style)

### Update style.css

- Add GitHub's chat styles (`.chat-container`, `.chat-message p`, `.chat-message ul/ol`, `.chat-message code`, `.chat-message-actions`, `.chat-input-area` improvements)
- Add `.safebot-disclaimer` styles
- Add `.typing` animation styles

## [S5] Configuration

### .env.example (new)

```env
PORT=3000
HOST=127.0.0.1
MIMO_API_KEY=your_api_key_here
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
MIMO_TIMEOUT_MS=20000
CHAT_RATE_LIMIT_WINDOW_MS=60000
CHAT_RATE_LIMIT_MAX=60
```

### Update .gitignore

Already has `.env`. Add `server/node_modules/` if not covered.

## [S6] Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Delete `server.js`, copy `server/` from GitHub | `server.js`, `server/` |
| 2 | Install server dependencies | `server/package.json` |
| 3 | Add `.env.example` | `server/.env.example` |
| 4 | Add DOM helpers + markdown to `js/utils.js` | `js/utils.js` |
| 5 | Update `js/chat.js` for new backend format | `js/chat.js` |
| 6 | Update `index.html` — CSP meta tag + chat page structure | `index.html` |
| 7 | Update `style.css` — chat styles from GitHub | `style.css` |
| 8 | Update root `package.json` start script | `package.json` |
| 9 | Test backend and frontend | — |

## [S7] Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Server/ directory structure change breaks deployment | Update deployment scripts |
| Chat response format change breaks frontend | Update chat.js to handle new format |
| GitHub's chat styles conflict with local styles | Merge carefully, keep local base styles |
| Tests may not pass with new .env | Ensure .env.example matches expected format |

## [S8] Success Criteria

- [ ] `server/` directory with all backend files
- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] `POST /api/chat` returns `{ reply, risk, actions, source }`
- [ ] Risk classifier works (high-risk returns template, not LLM)
- [ ] Tests pass (`npm test` in server/)
- [ ] CSP meta tag in index.html
- [ ] DOM helpers available in utils.js
- [ ] Chat renders markdown (bold, italic, lists)
- [ ] Chat renders action buttons from backend
- [ ] All existing features still work
- [ ] `.env.example` exists
