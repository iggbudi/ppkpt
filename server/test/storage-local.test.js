const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

process.env.EVIDENCE_ENCRYPTION_KEY = 'test-encryption-key-with-at-least-32-characters';

const LocalStorageAdapter = require('../storageLocal');

test('encrypted stream storage preserves payload and sidecar lifecycle', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'safesphere-storage-'));
  const adapter = new LocalStorageAdapter({
    basePath: path.join(root, 'storage'),
    quarantinePath: path.join(root, 'quarantine'),
    tempPath: path.join(root, 'temp'),
    encryptAtRest: true
  });
  const key = 'proof.txt';
  const payload = Buffer.from('streamed encrypted evidence');

  try {
    assert.equal((await adapter.put(key, Readable.from(payload), { kind: 'test' })).success, true);
    assert.equal((await adapter.quarantine(key)).success, true);
    assert.equal((await adapter.approve(key)).success, true);

    const result = await adapter.get(key);
    assert.equal(result.success, true);
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);

    assert.deepEqual(Buffer.concat(chunks), payload);
    assert.equal(result.metadata.size, payload.length);

    const sidecarPath = path.join(root, 'storage', `${key}.enc.json`);
    assert.equal(fs.existsSync(sidecarPath), true);

    const readerAfterConfigChange = new LocalStorageAdapter({
      basePath: path.join(root, 'storage'),
      quarantinePath: path.join(root, 'quarantine'),
      tempPath: path.join(root, 'temp'),
      encryptAtRest: false
    });
    const existingEncryptedFile = await readerAfterConfigChange.get(key);
    assert.equal(existingEncryptedFile.success, true);
    const existingChunks = [];
    for await (const chunk of existingEncryptedFile.stream) existingChunks.push(chunk);
    assert.deepEqual(Buffer.concat(existingChunks), payload);

    const stats = await adapter.getStats();
    assert.equal(stats.storage.fileCount, 1);

    const payloadPath = path.join(root, 'storage', key);
    const encryptedPayload = await fsp.readFile(payloadPath);
    const tamperedPayload = Buffer.from(encryptedPayload);
    tamperedPayload[0] ^= 0xff;
    await fsp.writeFile(payloadPath, tamperedPayload);
    assert.equal((await adapter.get(key)).success, false);

    await fsp.writeFile(payloadPath, encryptedPayload);
    await fsp.writeFile(sidecarPath, '{invalid json');
    assert.equal((await adapter.get(key)).success, false);

    await fsp.unlink(sidecarPath);
    assert.equal((await adapter.get(key)).success, false);

    const cleanup = await adapter.cleanupOrphanFiles([]);
    assert.equal(cleanup.cleaned, 1);
    assert.equal(fs.existsSync(path.join(root, 'storage', `${key}.enc.json`)), false);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});
