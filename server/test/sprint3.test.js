const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const db = require('../db');
const { clearAllRateLimiters } = require('../rateLimiter');

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

function sessionCookie(cookies) {
  return cookies[0] ? cookies[0].split(';')[0] : '';
}

const validPassword = 'Test@123';
const registerPayload = {
  name: 'Mahasiswa Baru',
  email: 'mahasiswa.bar@test.local',
  password: validPassword,
  status: 'Mahasiswa',
  instansi: 'Universitas Contoh',
  peran: 'Teknik Informatika'
};

test.beforeEach(() => {
  clearAllRateLimiters();
});

test('Register creates user in database', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/auth/register', registerPayload);
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'mahasiswa.bar@test.local');
  assert.equal(res.body.user.role, 'user');

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get('mahasiswa.bar@test.local');
  assert.ok(row);
  assert.equal(row.name, 'Mahasiswa Baru');
  assert.equal(row.active, 1);
});

test('Register rejects duplicate email', async () => {
  const app = require('../index.js');
  await request(app, 'POST', '/api/auth/register', registerPayload);
  const res = await request(app, 'POST', '/api/auth/register', registerPayload);
  assert.equal(res.status, 409);
});

test('Register rejects weak password', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/auth/register', {
    ...registerPayload,
    email: 'weak.pass@test.local',
    password: 'weakpass'
  });
  assert.equal(res.status, 400);
});

test('Flow: register → login → secret report → dashboard', async () => {
  const app = require('../index.js');
  const email = 'flow.user@test.local';

  const registerRes = await request(app, 'POST', '/api/auth/register', {
    ...registerPayload,
    email,
    name: 'Flow User'
  });
  assert.equal(registerRes.status, 201);

  const loginRes = await request(app, 'POST', '/api/auth/login', {
    username: email,
    password: validPassword
  });
  assert.equal(loginRes.status, 200);
  const cookie = sessionCookie(loginRes.cookies);

  const reportRes = await request(app, 'POST', '/api/reports', {
    category: 'Verbal',
    location: 'Lab Komputer',
    urgency: 'Sedang',
    incidentDate: '2026-06-13',
    description: 'Laporan rahasia dari user terdaftar',
    isAnonymous: false
  }, { Cookie: cookie });
  assert.equal(reportRes.status, 200);
  assert.equal(reportRes.body.report.authorId, loginRes.body.user.id);
  assert.equal(reportRes.body.report.isAnonymous, false);

  const listRes = await request(app, 'GET', '/api/reports', null, { Cookie: cookie });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.reports.length, 1);
  assert.equal(listRes.body.reports[0].id, reportRes.body.report.id);
});

test('Anonymous report has no authorId and audit has no userId/IP', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal',
    location: 'Perpustakaan',
    urgency: 'Rendah',
    incidentDate: '2026-06-13',
    description: 'Laporan anonim sprint 3'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.report.authorId, null);
  assert.equal(res.body.report.isAnonymous, true);

  const audit = db.prepare(`
    SELECT * FROM audit_log
    WHERE action = 'report.create' AND targetId = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(res.body.report.id);

  assert.ok(audit);
  assert.equal(audit.userId, null);
  assert.equal(audit.ip, null);
});

test('Admin can list, create, and deactivate users', async () => {
  const app = require('../index.js');
  const adminUsername = process.env.ADMIN_USERNAME || 'testadmin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'testpassword123';

  const adminLogin = await request(app, 'POST', '/api/auth/login', {
    username: adminUsername,
    password: adminPassword
  });
  assert.equal(adminLogin.status, 200);
  const adminCookie = sessionCookie(adminLogin.cookies);

  const listRes = await request(app, 'GET', '/api/admin/users', null, { Cookie: adminCookie });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.users));
  assert.ok(listRes.body.users.some((user) => user.role === 'admin'));

  const createRes = await request(app, 'POST', '/api/admin/users', {
    name: 'User Admin Buat',
    email: 'admin.created@test.local',
    password: validPassword,
    role: 'user',
    status: 'Umum',
    instansi: 'Kampus',
    peran: 'Staff'
  }, { Cookie: adminCookie });
  assert.equal(createRes.status, 201);

  const auditCreate = db.prepare(`
    SELECT * FROM audit_log WHERE action = 'user.create' AND targetId = ?
  `).get(String(createRes.body.user.id));
  assert.ok(auditCreate);

  const deactivateRes = await request(app, 'PATCH', `/api/admin/users/${createRes.body.user.id}/deactivate`, null, {
    Cookie: adminCookie
  });
  assert.equal(deactivateRes.status, 200);
  assert.equal(deactivateRes.body.user.active, false);

  const loginDeactivated = await request(app, 'POST', '/api/auth/login', {
    username: 'admin.created@test.local',
    password: validPassword
  });
  assert.equal(loginDeactivated.status, 401);
});

test('Demo user login works in test environment', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/auth/login', {
    username: 'demo',
    password: 'demo123'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'user');
});