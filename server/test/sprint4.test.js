const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');

const publicRoot = path.join(__dirname, '..', '..', 'public');

function requestStatic(app, urlPath) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method: 'GET' }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        });
      });
      req.on('error', reject);
      req.end();
    });
  });
}

test('Edukasi scenarios JSON has at least 6 scenarios including 2 bystander', () => {
  const jsonPath = path.join(publicRoot, 'edukasi', 'scenarios.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);

  assert.ok(Array.isArray(data.scenarios));
  assert.ok(data.scenarios.length >= 6);

  const bystanderCount = data.scenarios.filter((scenario) => (
    scenario.id === 'bystander'
    || scenario.id.startsWith('bystander-')
    || scenario.badge === 'Bystander Aktif'
  )).length;
  assert.ok(bystanderCount >= 3);

  data.scenarios.forEach((scenario) => {
    assert.ok(scenario.id);
    assert.ok(scenario.title);
    assert.ok(scenario.nodes && scenario.nodes.start);
    assert.ok(Array.isArray(scenario.nodes.start.options));
  });
});

test('Chart.js is vendored locally and served without CDN', async () => {
  const chartPath = path.join(publicRoot, 'vendor', 'chart.umd.min.js');
  assert.ok(fs.existsSync(chartPath));
  assert.ok(fs.statSync(chartPath).size > 100000);

  const app = require('../index.js');
  const res = await requestStatic(app, '/vendor/chart.umd.min.js');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-security-policy'], /script-src[^;]*'self'/);
  assert.doesNotMatch(res.body, /cdn\.jsdelivr\.net/);
});

test('Edukasi scenarios JSON is served by static host', async () => {
  const app = require('../index.js');
  const res = await requestStatic(app, '/edukasi/scenarios.json');
  assert.equal(res.status, 200);
  const data = JSON.parse(res.body);
  assert.ok(data.scenarios.length >= 6);
});