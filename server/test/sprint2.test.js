const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const db = require('../db');
const { clearAllRateLimiters } = require('../rateLimiter');
const { uploadEvidence, downloadEvidence, scanEvidence } = require('../evidence');
const { backupEvidenceArtifacts, restoreEvidenceArtifacts } = require('../evidenceArtifacts');
const { MALICIOUS_SIGNATURES } = require('../scanner');

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
          try { parsed = JSON.parse(data || '{}'); } catch { parsed = { raw: data }; }
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
  return request(app, 'POST', '/api/auth/login', {
    username: process.env.ADMIN_USERNAME || 'testadmin',
    password: process.env.ADMIN_PASSWORD || 'testpassword123'
  }).then((res) => {
    assert.equal(res.status, 200);
    return res.cookies[0].split(';')[0];
  });
}

test('EICAR test file is rejected on upload', async () => {
  clearAllRateLimiters();
  const reportId = 'SSF-sprint2-eicar-report';
  db.prepare(`
    INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
    VALUES (?, 'Verbal', 'Test', 'Rendah', '2026-06-13', 'Baru Masuk', 'EICAR', 'none', 'pending', ?, NULL, 'Anonim', 1)
  `).run(reportId, Date.now());

  const result = await uploadEvidence(
    reportId,
    Buffer.from(MALICIOUS_SIGNATURES.eicar, 'ascii'),
    'eicar.txt',
    'text/plain',
    null,
    true
  );

  assert.equal(result.success, false);
});

test('pending evidence cannot be downloaded', async () => {
  const evidenceId = 'EV-sprint2-pending';
  const reportId = 'SSF-sprint2-pending-report';
  db.prepare(`
    INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
    VALUES (?, 'Verbal', 'Test', 'Rendah', '2026-06-13', 'Baru Masuk', 'Pending', 'none', 'pending', ?, 2, 'Demo User', 0)
  `).run(reportId, Date.now());
  db.prepare(`
    INSERT OR REPLACE INTO evidence_files (id, report_id, storage_key, original_name, safe_name, detected_mime, size_bytes, sha256, scan_status, uploaded_at)
    VALUES (?, ?, 'pending-key', 'pending.txt', 'pending.txt', 'text/plain', 4, 'abc', 'pending', ?)
  `).run(evidenceId, reportId, Date.now());

  const result = await downloadEvidence(evidenceId, 2, 'user');
  assert.equal(result.success, false);
  assert.match(result.error, /belum tersedia/i);
});

test('unauthorized user cannot download evidence', async () => {
  const reportId = 'SSF-sprint2-auth-report';
  const evidenceId = 'EV-sprint2-auth';
  db.prepare(`
    INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
    VALUES (?, 'Verbal', 'Test', 'Rendah', '2026-06-13', 'Baru Masuk', 'Auth', 'none', 'pending', ?, 2, 'Demo User', 0)
  `).run(reportId, Date.now());
  db.prepare(`
    INSERT OR REPLACE INTO evidence_files (id, report_id, storage_key, original_name, safe_name, detected_mime, size_bytes, sha256, scan_status, uploaded_at)
    VALUES (?, ?, 'auth-clean-key', 'auth.txt', 'auth.txt', 'text/plain', 4, 'abc', 'clean', ?)
  `).run(evidenceId, reportId, Date.now());

  const result = await downloadEvidence(evidenceId, 99, 'user');
  assert.equal(result.success, false);
  assert.match(result.error, /akses/i);
});

test('evidence artifact backup and restore preserves files', async () => {
  clearAllRateLimiters();
  const app = require('../index');
  const reportId = 'SSF-sprint2-artifact-report';
  db.prepare(`
    INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
    VALUES (?, 'Verbal', 'Test', 'Rendah', '2026-06-13', 'Baru Masuk', 'Artifact', 'none', 'pending', ?, NULL, 'Anonim', 1)
  `).run(reportId, Date.now());

  const upload = await uploadEvidence(reportId, Buffer.from('artifact backup test'), 'artifact.txt', 'text/plain', null, true);
  assert.equal(upload.success, true);

  const backup = await backupEvidenceArtifacts('sprint2-test-backup');
  assert.ok(backup.fileCount >= 1);

  const row = db.prepare('SELECT storage_key FROM evidence_files WHERE id = ?').get(upload.evidence.id);
  const { getStorageAdapterRef } = require('../evidence');
  await getStorageAdapterRef().delete(row.storage_key);

  const restore = await restoreEvidenceArtifacts('sprint2-test-backup');
  assert.ok(restore.restored >= 1);

  const download = await downloadEvidence(upload.evidence.id, 1, 'admin');
  assert.equal(download.success, true);
});