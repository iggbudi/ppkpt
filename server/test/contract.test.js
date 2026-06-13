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
  assert.equal(res.body.report.id.length, 12); // SSF- + 8 chars
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
