const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const db = require('../db');
const { createBackup, restoreFromBackup } = require('../backup');
const { clearAllRateLimiters } = require('../rateLimiter');
const { placeLegalHold, approveDeletion, requestDeletion } = require('../deletion');

function request(app, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { 'Content-Type': 'application/json', ...headers }
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          let parsed = {};
          try {
            parsed = JSON.parse(data || '{}');
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, body: parsed, cookies: res.headers['set-cookie'] || [] });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

function loginAdmin(app) {
  const adminUsername = process.env.ADMIN_USERNAME || 'testadmin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'testpassword123';
  return request(app, 'POST', '/api/auth/login', {
    username: adminUsername,
    password: adminPassword
  }).then((res) => {
    assert.equal(res.status, 200);
    return res.cookies[0].split(';')[0];
  });
}

function createReport(app, headers = {}) {
  return request(app, 'POST', '/api/reports', {
    category: 'Verbal',
    location: 'Sprint1',
    urgency: 'Rendah',
    incidentDate: '2026-06-13',
    description: 'Sprint 1 test report'
  }, headers);
}

test('anonymous report burst returns 429', async () => {
  clearAllRateLimiters();
  const app = require('../index');
  let lastStatus = 200;

  for (let i = 0; i < 11; i += 1) {
    const res = await createReport(app);
    lastStatus = res.status;
  }

  assert.equal(lastStatus, 429);
});

test('report rate limit cannot be bypassed via X-Forwarded-For rotation', async () => {
  clearAllRateLimiters();
  const app = require('../index');
  let lastStatus = 200;

  for (let i = 0; i < 11; i += 1) {
    const res = await createReport(app, { 'X-Forwarded-For': `203.0.113.${i}` });
    lastStatus = res.status;
  }

  assert.equal(lastStatus, 429);
});

test('future incident date is rejected', async () => {
  clearAllRateLimiters();
  const app = require('../index');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal',
    location: 'Test',
    urgency: 'Rendah',
    incidentDate: '2099-12-31',
    description: 'Future date'
  });
  assert.equal(res.status, 400);
});

test('encrypted backup without key is rejected via API', async () => {
  const app = require('../index');
  const cookie = await loginAdmin(app);
  const res = await request(app, 'POST', '/api/backup', {
    encrypt: true
  }, { Cookie: cookie });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Encryption key/i);
});

test('encrypted backup roundtrip restores data', () => {
  const key = 'test-encryption-key-32chars!!';
  const encrypted = createBackup({ includeAudit: false, encrypt: true, encryptionKey: key });
  assert.equal(encrypted.encrypted, true);

  const beforeCount = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
  const result = restoreFromBackup(encrypted, { decrypt: true, decryptionKey: key, dryRun: false });
  assert.equal(result.success, true);
  const afterCount = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
  assert.equal(afterCount, result.restoredReports);
  assert.ok(afterCount >= beforeCount);
});

test('wrong decryption key does not restore data', () => {
  const key = 'correct-key-32-characters-long!!';
  const encrypted = createBackup({ includeAudit: false, encrypt: true, encryptionKey: key });
  const beforeReports = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
  const beforeAudit = db.prepare('SELECT COUNT(*) as count FROM audit_log').get().count;

  const result = restoreFromBackup(encrypted, {
    decrypt: true,
    decryptionKey: 'wrong-key-32-characters-long!!!',
    dryRun: false
  });

  assert.equal(result.success, false);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM reports').get().count, beforeReports);
  assert.equal(db.prepare('SELECT COUNT(*) as count FROM audit_log').get().count, beforeAudit);
});

test('legal hold blocks deletion approval', () => {
  const reportId = 'SSF-sprint1-legal-hold-test';
  db.prepare(`
    INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
    VALUES (?, 'Verbal', 'Test', 'Rendah', '2026-06-13', 'Baru Masuk', 'Legal hold test', 'none', 'pending', ?, 2, 'Demo User', 0)
  `).run(reportId, Date.now());

  requestDeletion(reportId, 2, 'User request');
  placeLegalHold(reportId, 1, 'Investigation');

  const approval = approveDeletion(reportId, 1, 'Admin approval');
  assert.equal(approval.success, false);
  assert.match(approval.error, /legal hold/i);

  const row = db.prepare('SELECT deleted_at FROM reports WHERE id = ?').get(reportId);
  assert.equal(row.deleted_at, null);
});

test('soft-deleted reports are hidden from active list endpoint', async () => {
  const app = require('../index');
  const reportId = 'SSF-sprint1-soft-delete-test';
  db.prepare(`
    INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous, deleted_at)
    VALUES (?, 'Verbal', 'Test', 'Rendah', '2026-06-13', 'Baru Masuk', 'Deleted', 'none', 'pending', ?, 2, 'Demo User', 0, ?)
  `).run(reportId, Date.now(), Date.now());

  const cookie = await loginAdmin(app);
  const res = await request(app, 'GET', '/api/reports', null, { Cookie: cookie });
  assert.equal(res.status, 200);
  assert.equal(res.body.reports.some((report) => report.id === reportId), false);
});

test('pending deletions endpoint returns 200', async () => {
  const app = require('../index');
  const cookie = await loginAdmin(app);
  const res = await request(app, 'GET', '/api/admin/pending-deletions', null, { Cookie: cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.pendingDeletions));
});