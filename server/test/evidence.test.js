const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const app = require('../index');

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function reportForm(file, type, name) {
  const form = new FormData();
  form.append('category', 'Verbal');
  form.append('location', 'Test');
  form.append('urgency', 'Rendah');
  form.append('incidentDate', '2026-06-13');
  form.append('description', 'Evidence integration test');
  form.append('isAnonymous', 'true');
  form.append('evidence', new Blob([file], { type }), name);
  return form;
}

test('anonymous multipart report stores clean evidence', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      body: reportForm('plain evidence text', 'text/plain', 'proof.txt')
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.report.authorId, null);
    assert.equal(body.evidence.length, 1);
    assert.equal(body.evidence[0].scanStatus, 'clean');
  });
});

test('spoofed MIME rejects the entire report', async () => {
  const before = db.prepare('SELECT COUNT(*) count FROM reports').get().count;
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      body: reportForm('not a real PDF', 'application/pdf', 'fake.pdf')
    });
    assert.equal(response.status, 400);
  });
  const after = db.prepare('SELECT COUNT(*) count FROM reports').get().count;
  assert.equal(after, before);
});
