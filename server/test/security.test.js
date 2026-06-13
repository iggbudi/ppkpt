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
