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
    assert.equal(body.report.evidence, 'bukti.txt');
  });
});

test('deleting evidence refreshes the report evidence summary', async () => {
  await withServer(async baseUrl => {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testadmin', password: 'testpassword123' })
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get('set-cookie').split(';')[0];

    const createResponse = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      body: reportForm('evidence to delete', 'text/plain', 'delete-me.txt')
    });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 200);
    assert.equal(created.report.evidence, 'bukti.txt');

    const otherReportId = `${created.report.id}-other`;
    db.prepare(`
      INSERT INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
      VALUES (?, 'Verbal', 'Test', 'Rendah', '2026-06-13', 'Baru Masuk', 'Other report', 'sentinel.txt', 'pending', ?, NULL, 'Anonim', 1)
    `).run(otherReportId, Date.now());

    const mismatchedDelete = await fetch(
      `${baseUrl}/api/reports/${otherReportId}/evidence/${created.evidence[0].id}`,
      { method: 'DELETE', headers: { Cookie: cookie } }
    );
    assert.equal(mismatchedDelete.status, 400);
    assert.equal(db.prepare('SELECT evidence FROM reports WHERE id = ?').get(otherReportId).evidence, 'sentinel.txt');

    const deleteResponse = await fetch(
      `${baseUrl}/api/reports/${created.report.id}/evidence/${created.evidence[0].id}`,
      { method: 'DELETE', headers: { Cookie: cookie } }
    );
    assert.equal(deleteResponse.status, 200);

    const report = db.prepare('SELECT evidence FROM reports WHERE id = ?').get(created.report.id);
    assert.equal(report.evidence, 'Tidak ada lampiran');
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
