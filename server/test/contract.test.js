const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

function request(app, method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1', port, path, method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), cookies: res.headers['set-cookie'] || [] });
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
    incidentDate: '2026-06-13', description: 'Test anonim'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.report.authorId, null);
  assert.equal(res.body.report.authorName, 'Anonim');
  assert.equal(res.body.report.isAnonymous, true);
});

test('Report schema has correct field names', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test schema'
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
  assert.ok(typeof report.isAnonymous === 'boolean', 'should have isAnonymous boolean');
});

test('Report ID uses UUID format', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test UUID'
  });
  assert.ok(res.body.report.id.startsWith('SSF-'));
  // UUID format: SSF-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (40 chars total)
  assert.ok(res.body.report.id.length === 40, 'ID should be UUID format');
  // Check UUID pattern
  const uuidPattern = /^SSF-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  assert.ok(uuidPattern.test(res.body.report.id), 'ID should match UUID pattern');
});

test('Invalid category is rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: '<script>alert(1)</script>',
    location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test XSS'
  });
  // Should either reject or sanitize
  assert.ok(res.status === 400 || !res.body.report.category.includes('<script>'));
});

test('Invalid urgency is rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'NotARealUrgency',
    incidentDate: '2026-06-13', description: 'Test invalid'
  });
  assert.equal(res.status, 400);
});

test('Missing required fields returns 400', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal'
    // missing location, urgency, incidentDate, description
  });
  assert.equal(res.status, 400);
});

test('Invalid date format is rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: 'not-a-date', description: 'Test invalid date'
  });
  assert.equal(res.status, 400);
});

test('Valid ISO date is accepted', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test valid date'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.report.incidentDate, '2026-06-13');
});

test('Status transition from Selesai is rejected', async () => {
  const app = require('../index.js');
  
  // Create a report
  const createRes = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test status transition'
  });
  assert.equal(createRes.status, 200);
  const reportId = createRes.body.report.id;
  
  // Login as admin
  const adminUsername = process.env.ADMIN_USERNAME || 'testadmin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'testpassword123';
  const loginRes = await request(app, 'POST', '/api/auth/login', {
    username: adminUsername,
    password: adminPassword
  });
  assert.equal(loginRes.status, 200);
  const cookies = loginRes.cookies[0].split(';')[0];
  
  // Try to go directly from Baru Masuk to Selesai (should fail)
  const updateRes = await request(app, 'PATCH', `/api/reports/${reportId}/status`, {
    status: 'Selesai'
  }, cookies);
  assert.equal(updateRes.status, 400);
  assert.ok(updateRes.body.error.includes('tidak diizinkan'));
});

test('Valid status transition is accepted', async () => {
  const app = require('../index.js');
  
  // Create a report
  const createRes = await request(app, 'POST', '/api/reports', {
    category: 'Verbal', location: 'Test', urgency: 'Rendah',
    incidentDate: '2026-06-13', description: 'Test valid status transition'
  });
  assert.equal(createRes.status, 200);
  const reportId = createRes.body.report.id;
  
  // Login as admin
  const adminUsername = process.env.ADMIN_USERNAME || 'testadmin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'testpassword123';
  const loginRes = await request(app, 'POST', '/api/auth/login', {
    username: adminUsername,
    password: adminPassword
  });
  assert.equal(loginRes.status, 200);
  const cookies = loginRes.cookies[0].split(';')[0];
  
  // Baru Masuk -> Direview (should succeed)
  const updateRes = await request(app, 'PATCH', `/api/reports/${reportId}/status`, {
    status: 'Direview'
  }, cookies);
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.report.status, 'Direview');
});
