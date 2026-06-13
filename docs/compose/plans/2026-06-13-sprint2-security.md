# Sprint 2: Security Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add schema validation, session hardening, error handler, XSS removal, and security tests.

**Tech Stack:** Node.js, Zod validation, Express session

---

### Task 1: Schema Validation with Zod

**Covers:** [S2-1]

**Files:**
- Modify: `server/reports.js`
- Modify: `server/auth.js`
- Modify: `server/package.json`

- [ ] **Step 1: Install Zod**

```bash
cd server && npm install zod
```

- [ ] **Step 2: Add validation to reports.js**

At the top of server/reports.js, add:

```javascript
const { z } = require('zod');

const reportSchema = z.object({
  category: z.enum(['Verbal', 'Sosial', 'Cyberbullying', 'Fisik', 'Seksual']),
  location: z.string().min(1).max(500),
  urgency: z.enum(['Rendah', 'Sedang', 'Tinggi']),
  incidentDate: z.string().min(1),
  description: z.string().min(1).max(5000),
  evidence: z.string().max(200).optional(),
  isAnonymous: z.boolean().optional()
});
```

In the POST /api/reports handler, add validation before creating the report:

```javascript
  let parsed;
  try {
    parsed = reportSchema.parse(req.body);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid input', details: err.errors });
  }
```

Then use `parsed.category`, `parsed.location`, etc. instead of destructuring from `req.body`.

- [ ] **Step 3: Add validation to auth.js**

```javascript
const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});
```

In the login handler:

```javascript
  let parsed;
  try {
    parsed = loginSchema.parse(req.body);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid input' });
  }
```

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "security: add Zod schema validation for auth and report endpoints"
```

---

### Task 2: Session Hardening

**Covers:** [S2-3]

**Files:**
- Modify: `server/index.js`
- Modify: `server/auth.js`

- [ ] **Step 1: Add login rate limit to server/index.js**

```javascript
const loginRateLimitStore = new Map();

function loginRateLimiter(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxAttempts = 5;

  let entry = loginRateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count++;
  loginRateLimitStore.set(key, entry);

  if (entry.count > maxAttempts) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam 5 menit.' });
  }

  next();
}
```

- [ ] **Step 2: Apply login rate limiter to auth route**

In auth.js, wrap the login route with the rate limiter.

- [ ] **Step 3: Regenerate session after login**

In auth.js login handler, after setting `req.session.user`, add:

```javascript
req.session.regenerate(function(err) {
  if (err) {
    return res.status(500).json({ error: 'Session error' });
  }
  req.session.user = userObj;
  res.json({ user: req.session.user });
});
```

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "security: add login rate limit and session regeneration"
```

---

### Task 3: Centralized Error Handler

**Covers:** [S2-3]

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add error handler middleware**

Before the 404 handler, add:

```javascript
// Centralized error handler — no stack traces exposed
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});
```

- [ ] **Step 2: Add global uncaughtException handler**

At the bottom of server/index.js:

```javascript
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
```

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "security: add centralized error handler, no stack traces exposed"
```

---

### Task 4: XSS Removal in Frontend

**Covers:** [S2-2]

**Files:**
- Modify: `public/js/reports.js`
- Modify: `public/js/admin.js`

- [ ] **Step 1: Replace insertAdjacentHTML with DOM helpers in reports.js**

Find `listContainer.insertAdjacentHTML('beforeend', html)` in `updateUserDashboardUI` and replace with `createEl` DOM construction.

- [ ] **Step 2: Replace insertAdjacentHTML in admin.js**

Same change in `updateDashboardUI`.

- [ ] **Step 3: Commit**

```bash
git add public/js/
git commit -m "security: replace insertAdjacentHTML with DOM helpers to prevent XSS"
```

---

### Task 5: Security Tests

**Covers:** [S2-4]

**Files:**
- Create: `server/test/security.test.js`

- [ ] **Step 1: Create security test file**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

function request(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1', port, path, method,
        headers: { 'Content-Type': 'application/json' }
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

test('Security: XSS payload in category is rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: '<script>alert(1)</script>',
    location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test'
  });
  assert.equal(res.status, 400);
});

test('Security: Invalid urgency is rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'INVALID',
    incidentDate: '2026-06-13', description: 'Test'
  });
  assert.equal(res.status, 400);
});

test('Security: Non-string password returns 400', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/auth/login', {
    username: 'admin',
    password: 12345
  });
  assert.ok(res.status === 400 || res.status === 401);
  assert.ok(!res.body.stack, 'should not expose stack trace');
});

test('Security: Missing fields returns 400', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {});
  assert.equal(res.status, 400);
});

test('Security: Error responses are JSON', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {});
  assert.equal(res.status, 400);
  assert.ok(res.body.error, 'should have error field');
});
```

- [ ] **Step 2: Run all tests**

```bash
cd server && npm test
```

- [ ] **Step 3: Commit**

```bash
git add server/test/
git commit -m "test: add security tests for XSS, validation, and error handling"
```
