process.env.CHAT_RATE_LIMIT_MAX = '3';
process.env.CHAT_RATE_LIMIT_WINDOW_MS = '60000';
process.env.MIMO_API_KEY = 'test-key';
process.env.MIMO_BASE_URL = 'http://127.0.0.1:9/v1';
process.env.MIMO_MODEL = 'mimo-v2.5';

const test = require('node:test');
const assert = require('node:assert/strict');
const { app, chatRateLimitStore } = require('../index');
const { classifyRisk } = require('../risk');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function postChat(baseUrl, message, ip = '127.0.0.1') {
  return fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': ip
    },
    body: JSON.stringify({ message })
  });
}

test('risk classifier avoids substring false positive and detects medium risk', () => {
  const result = classifyRisk('saya sering diejek dan dipermalukan di kelas');
  assert.equal(result.level, 'medium');
  assert.equal(result.foundHighRisk, false);
  assert.ok(result.matchedKeywords.includes('diejek'));
  assert.ok(result.matchedKeywords.includes('dipermalukan'));
  assert.equal(result.matchedKeywords.includes('luka'), false);
});

test('risk classifier detects high risk', () => {
  const result = classifyRisk('saya diancam dan dipukul');
  assert.equal(result.level, 'high');
  assert.equal(result.foundHighRisk, true);
});

test('chat API returns high-risk template without model dependency', async () => {
  chatRateLimitStore.clear();
  const { server, baseUrl } = await startServer();
  try {
    const response = await postChat(baseUrl, 'saya diancam dan dipukul', '10.0.0.1');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.risk, 'high');
    assert.equal(body.source, 'template');
    assert.equal(Array.isArray(body.actions), true);
    assert.ok(body.actions.some((action) => action.href === '#kontak'));
  } finally {
    server.close();
  }
});

test('chat API validates message body', async () => {
  chatRateLimitStore.clear();
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.2' },
      body: JSON.stringify({ message: '' })
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'message is required');
  } finally {
    server.close();
  }
});

test('chat API rate limits repeated requests per client', async () => {
  chatRateLimitStore.clear();
  const { server, baseUrl } = await startServer();
  try {
    const ip = '10.0.0.3';
    for (let i = 0; i < 3; i += 1) {
      const response = await postChat(baseUrl, 'saya diancam dan dipukul', ip);
      assert.equal(response.status, 200);
    }

    const limited = await postChat(baseUrl, 'saya diancam dan dipukul', ip);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.has('retry-after'), true);
    const body = await limited.json();
    assert.equal(body.error, 'rate limit exceeded');
  } finally {
    server.close();
  }
});

test('static file exposure: package.json is not served as raw file', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/package.json`);
    const body = await response.text();
    assert.equal(body.includes('"safesphere-chat-backend"'), false, 'package.json content must not be exposed');
  } finally {
    server.close();
  }
});

test('static file exposure: server source is not served as raw file', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/server/index.js`);
    const body = await response.text();
    assert.equal(body.includes('callMimoChat'), false, 'server source must not be exposed');
  } finally {
    server.close();
  }
});

test('static file exposure: .git config is not served as raw file', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/.git/config`);
    const body = await response.text();
    assert.equal(body.includes('[core]'), false, '.git/config must not be exposed');
  } finally {
    server.close();
  }
});

test('static file exposure: .env is not served as raw file', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/.env`);
    const body = await response.text();
    assert.equal(body.includes('MIMO_API_KEY'), false, '.env content must not be exposed');
  } finally {
    server.close();
  }
});

test('chat API does not allow X-Forwarded-For rotation to bypass rate limit', async () => {
  chatRateLimitStore.clear();
  const { server, baseUrl } = await startServer();
  try {
    for (let i = 0; i < 3; i += 1) {
      const response = await postChat(baseUrl, 'saya diancam dan dipukul', `10.0.1.${i}`);
      assert.equal(response.status, 200);
    }

    const limited = await postChat(baseUrl, 'saya diancam dan dipukul', '10.0.1.99');
    assert.equal(limited.status, 429);
  } finally {
    server.close();
  }
});
