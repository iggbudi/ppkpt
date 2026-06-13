const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

function request(app, method, path, body, cookies) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (cookies) options.headers['Cookie'] = cookies;

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          server.close();
          resolve({
            status: res.statusCode,
            body: JSON.parse(data || '{}'),
            cookies: setCookie
          });
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

test('E2E: Anonymous report submission', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/reports', {
    category: 'Verbal',
    location: 'Test Location',
    urgency: 'Rendah',
    incidentDate: '2026-06-13',
    description: 'Test anonymous report'
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.report.id.startsWith('SSF-'));
  assert.equal(res.body.report.authorName, 'Anonim');
});

test('E2E: Login as user', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/auth/login', {
    username: 'demo',
    password: 'demo123'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'user');
  assert.ok(res.cookies);
});

test('E2E: Login as admin', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/auth/login', {
    username: 'admin',
    password: 'safesphere'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'admin');
});

test('E2E: Wrong password rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/auth/login', {
    username: 'admin',
    password: 'wrong'
  });
  assert.equal(res.status, 401);
});

test('E2E: Unauthenticated report list rejected', async () => {
  const app = require('../index.js');
  const res = await request(app, 'GET', '/api/reports');
  assert.equal(res.status, 401);
});

test('E2E: Chat endpoint works', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/chat', {
    message: 'halo'
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.reply);
});

test('E2E: High-risk message returns template', async () => {
  const app = require('../index.js');
  const res = await request(app, 'POST', '/api/chat', {
    message: 'Saya dipukul dan diancam dengan pisau'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.source, 'template');
  assert.ok(res.body.actions.length > 0);
});

test('E2E: Health endpoint works', async () => {
  const app = require('../index.js');
  const res = await request(app, 'GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
