# Sprint 4: Data & Operational — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SQLite persistence, backup/restore, CI pipeline, and retention policy.

**Architecture:** SQLite via better-sqlite3, JSON export/import, GitHub Actions.

---

### Task 1: SQLite Database + Migration

**Covers:** [S4-1]

**Files:**
- Modify: `server/reports.js`
- Modify: `server/index.js`
- Modify: `server/package.json`

- [ ] **Step 1: Install better-sqlite3**

```bash
cd server && npm install better-sqlite3
```

- [ ] **Step 2: Create database module**

Create `server/db.js`:

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'safesphere.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    urgency TEXT NOT NULL,
    incidentDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Baru Masuk',
    description TEXT NOT NULL,
    evidence TEXT,
    appointment TEXT,
    createdAt INTEGER NOT NULL,
    authorId INTEGER,
    authorName TEXT,
    isAnonymous INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    userId INTEGER,
    action TEXT NOT NULL,
    targetId TEXT,
    ip TEXT,
    details TEXT
  );
`);

module.exports = db;
```

- [ ] **Step 3: Update reports.js to use SQLite**

Replace the in-memory `reports` array with database operations:

```javascript
const db = require('./db');

// Prepared statements
const insertReport = db.prepare(`
  INSERT INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectAllReports = db.prepare('SELECT * FROM reports');
const selectReportsByAuthor = db.prepare('SELECT * FROM reports WHERE authorId = ?');
const selectReportById = db.prepare('SELECT * FROM reports WHERE id = ?');
const updateReportStatus = db.prepare('UPDATE reports SET status = ?, appointment = ? WHERE id = ?');
const deleteAllReports = db.prepare('DELETE FROM reports');
const countReports = db.prepare('SELECT COUNT(*) as count FROM reports');
```

- [ ] **Step 4: Update all report operations to use database**

Replace `reports.push(report)` with `insertReport.run(...)`.
Replace `reports.find(...)` with `selectReportById.get(...)`.
Replace `reports.filter(...)` with `selectReportsByAuthor.all(...)`.

- [ ] **Step 5: Update audit log to use SQLite**

```javascript
const insertAudit = db.prepare(`
  INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const selectAllAudit = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC');
```

- [ ] **Step 6: Update server/index.js to export db for other modules**

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "data: add SQLite database for reports and audit log persistence"
```

---

### Task 2: Backup/Export Endpoints

**Covers:** [S4-2]

**Files:**
- Modify: `server/reports.js`

- [ ] **Step 1: Add export endpoint**

```javascript
app.get('/api/export', requireAuth, requireAdmin, (req, res) => {
  const reports = db.prepare('SELECT * FROM reports').all();
  const auditLog = db.prepare('SELECT * FROM audit_log').all();
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=safesphere-backup-' + new Date().toISOString().slice(0, 10) + '.json');
  res.json({ reports, auditLog, exportedAt: Date.now() });
});
```

- [ ] **Step 2: Add import endpoint**

```javascript
app.post('/api/import', requireAuth, requireAdmin, express.json({ limit: '10mb' }), (req, res) => {
  const { reports, auditLog } = req.body;
  
  if (!Array.isArray(reports)) {
    return res.status(400).json({ error: 'Invalid backup format' });
  }
  
  const insertMany = db.transaction((items) => {
    for (const r of items) {
      db.prepare(`
        INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r.id, r.category, r.location, r.urgency, r.incidentDate, r.status, r.description, r.evidence, r.appointment, r.createdAt, r.authorId, r.authorName, r.isAnonymous);
    }
  });
  
  insertMany(reports);
  
  res.json({ ok: true, imported: reports.length });
});
```

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "ops: add export/import endpoints for backup and restore"
```

---

### Task 3: CI Pipeline

**Covers:** [S4-3]

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create GitHub Actions workflow**

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install root dependencies
        run: npm install
      
      - name: Install server dependencies
        run: cd server && npm install
      
      - name: Run tests
        run: cd server && npm test
      
      - name: Run npm audit
        run: npm audit --audit-level=high
      
      - name: Run server audit
        run: cd server && npm audit --audit-level=high
      
      - name: Check for secrets
        run: |
          grep -r "sk-" --include="*.js" --include="*.html" . 2>/dev/null | grep -v node_modules | grep -v .env.example || echo "No secrets found"
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow for tests, audit, and secret scan"
```

---

### Task 4: Retention Policy

**Covers:** [S4-4]

**Files:**
- Modify: `server/index.js`
- Modify: `server/db.js`

- [ ] **Step 1: Add retention cleanup function**

In `server/db.js`, add:

```javascript
function cleanupOldReports(daysToKeep) {
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const result = db.prepare('DELETE FROM reports WHERE createdAt < ? AND status = ?').run(cutoff, 'Selesai');
  return result.changes;
}

function cleanupOldAudit(daysToKeep) {
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const result = db.prepare('DELETE FROM audit_log WHERE timestamp < ?').run(cutoff);
  return result.changes;
}
```

- [ ] **Step 2: Run cleanup on server start**

In `server/index.js`:

```javascript
const retentionDays = Number(process.env.RETENTION_DAYS || 90);
const cleanedReports = db.prepare('DELETE FROM reports WHERE createdAt < ? AND status = ?').run(Date.now() - (retentionDays * 24 * 60 * 60 * 1000), 'Selesai');
console.log(`Cleaned up ${cleanedReports.changes} old reports`);
```

- [ ] **Step 3: Add RETENTION_DAYS to .env.example**

```
RETENTION_DAYS=90
```

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "ops: add retention policy for old reports (configurable via RETENTION_DAYS)"
```
