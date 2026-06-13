# Sprint 1: Privacy & Functional Blockers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix anonymous reporting identifiers, align backend/frontend schema, move user dashboard to API, fix tracking, fix UI claims.

**Architecture:** Server-side changes for anon report, frontend schema alignment, API-based dashboard.

---

### Task 1: Fix Anonymous Report — Remove Identifiers

**Covers:** [S2-1]

**Files:**
- Modify: `server/reports.js`

- [ ] **Step 1: Update report creation for anonymous**

In `server/reports.js`, update the POST `/api/reports` handler:

```javascript
// For anonymous reports, don't store any user identifiers
const isAnon = isAnonymous !== false || !user;
const authorId = isAnon ? null : user.id;
const authorName = isAnon ? 'Anonim' : (isAnonymous !== false ? user.name.charAt(0).toUpperCase() + '***' : user.name);
```

Update the report object:
```javascript
const report = {
  id: generateId(), // use UUID
  category,
  location,
  urgency,
  incidentDate,
  status: 'Baru Masuk',
  description,
  evidence: evidence || 'Tidak ada lampiran',
  appointment: 'Menunggu proses peninjauan awal dari tim Satgas.',
  createdAt: Date.now(),
  authorId: authorId,
  authorName: authorName,
  isAnonymous: isAnon
};
```

Update audit log for anonymous:
```javascript
auditLog.push({
  timestamp: Date.now(),
  userId: isAnon ? null : user.id,
  action: 'report.create',
  targetId: report.id,
  ip: isAnon ? null : req.ip, // don't store IP for anonymous
  details: { category, urgency, isAnonymous: isAnon }
});
```

- [ ] **Step 2: Add UUID generation**

```javascript
const crypto = require('crypto');

function generateId() {
  return 'SSF-' + crypto.randomUUID().substring(0, 8).toUpperCase();
}
```

- [ ] **Step 3: Commit**

```bash
git add server/reports.js
git commit -m "fix: remove identifiers from anonymous reports (authorId, userId, IP)"
```

---

### Task 2: Align Schema — Frontend uses Backend field names

**Covers:** [S2-2]

**Files:**
- Modify: `public/js/admin.js`
- Modify: `public/js/reports.js`

- [ ] **Step 1: Update admin.js to use backend field names**

Replace all occurrences:
- `report.cat` → `report.category`
- `report.loc` → `report.location`
- `report.urg` → `report.urgency`
- `report.date` → `report.incidentDate`
- `report.desc` → `report.description`
- `report.author` → `report.authorName`
- `report.displayName` → `report.authorName`

Also update the filter functions:
- `r.urg === 'Tinggi'` → `r.urgency === 'Tinggi'`
- `r.status === 'Selesai'` → stays the same

- [ ] **Step 2: Update reports.js to use backend field names**

Same replacements in reports.js.

- [ ] **Step 3: Update admin dashboard display**

In `updateDashboardUI`, fix the report list HTML to use new field names.

- [ ] **Step 4: Commit**

```bash
git add public/js/admin.js public/js/reports.js
git commit -m "fix: align frontend report schema with backend (category, location, urgency, etc.)"
```

---

### Task 3: User Dashboard via API

**Covers:** [S2-3]

**Files:**
- Modify: `public/js/reports.js`

- [ ] **Step 1: Update updateUserDashboardUI to fetch from API**

```javascript
window.updateUserDashboardUI = async function() {
  if (!currentUser) return;
  var listContainer = document.getElementById('userReportList');
  
  try {
    var response = await fetch('/api/reports');
    if (!response.ok) return;
    var data = await response.json();
    var userReports = data.reports;
  } catch (err) {
    listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Gagal memuat laporan.</p>';
    return;
  }

  if (userReports.length === 0) {
    listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Anda belum pernah membuat laporan.</p>';
    return;
  }

  listContainer.innerHTML = '';
  userReports.forEach(function(report) {
    // ... render with backend field names
  });
};
```

- [ ] **Step 2: Remove localStorage report loading**

Find any `Storage.load('reports')` and remove.

- [ ] **Step 3: Commit**

```bash
git add public/js/reports.js
git commit -m "fix: user dashboard fetches reports from API, not localStorage"
```

---

### Task 4: Fix Tracking ID + Hide Anonymous Tracking

**Covers:** [S2-4]

**Files:**
- Modify: `public/js/reports.js`

- [ ] **Step 1: Hide tracking button for anonymous reports**

In the submit result, only show tracking button if report is not anonymous:

```javascript
var trackingBtn = data.report.isAnonymous 
  ? '' 
  : '<button class="btn secondary" type="button" onclick="viewInvoiceFromSubmit(\'' + data.report.id + '\')" style="margin-top: 10px;">Lacak Status</button>';

resultBox.innerHTML = '<strong>Laporan Demo Berhasil Dikirim!</strong><br><br>' +
  'Nomor Pelacakan: <b>' + data.report.id + '</b><br>' +
  trackingBtn;
```

- [ ] **Step 2: Commit**

```bash
git add public/js/reports.js
git commit -m "fix: hide tracking button for anonymous reports"
```

---

### Task 5: Fix UI Claims

**Covers:** [S2-5]

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/auth.js`
- Modify: `public/js/reports.js`

- [ ] **Step 1: Fix hero claims**

Find and replace in index.html:
- "Status laporan dipantau realtime" → "Status laporan dapat dipantau"
- "Laporan terenkripsi milik Anda" → "Laporan Anda"

- [ ] **Step 2: Fix auth claims**

In auth.js:
- "Akun Anda terverifikasi" → "Registrasi demo berhasil (simulasi)"

- [ ] **Step 3: Fix report claims**

In reports.js:
- "data disimpan di browser lokal" → "data disimpan di server demo"

- [ ] **Step 4: Commit**

```bash
git add public/
git commit -m "fix: align all UI claims with actual implementation"
```

---

### Task 6: Add Contract Tests

**Covers:** [S2-6]

**Files:**
- Create: `server/test/contract.test.js`

- [ ] **Step 1: Create contract tests**

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

test('Anonymous report has no authorId', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.report.authorId, null);
  assert.equal(res.body.report.authorName, 'Anonim');
});

test('Report schema has correct field names', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test'
  });
  const report = res.body.report;
  assert.ok(report.category, 'should have category');
  assert.ok(report.location, 'should have location');
  assert.ok(report.urgency, 'should have urgency');
  assert.ok(report.incidentDate, 'should have incidentDate');
  assert.ok(report.description, 'should have description');
  assert.ok(report.id, 'should have id');
  assert.ok(report.status, 'should have status');
  assert.ok(report.createdAt, 'should have createdAt');
});

test('Invalid report fields are rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: '<script>alert(1)</script>',
    location: 'Test',
    urgency: 'InvalidUrgency',
    incidentDate: '2099-12-31',
    description: 'Test'
  });
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run tests**

```bash
cd server && npm test
```

- [ ] **Step 3: Commit**

```bash
git add server/test/
git commit -m "test: add contract tests for report schema and anonymity"
```
