const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { getStorageAdapter } = require('./storageFactory');

function getArtifactBackupRoot() {
  const base = process.env.EVIDENCE_BACKUP_PATH || path.join(__dirname, '..', 'data', 'evidence-backups');
  return base;
}

async function backupEvidenceArtifacts(backupId = Date.now().toString()) {
  const storageAdapter = getStorageAdapter();
  const backupDir = path.join(getArtifactBackupRoot(), backupId);
  await fsp.mkdir(backupDir, { recursive: true });

  const files = db.prepare(`
    SELECT id, storage_key, sha256, safe_name, detected_mime, size_bytes, scan_status
    FROM evidence_files
    WHERE deleted_at IS NULL AND scan_status = 'clean'
  `).all();

  const manifest = [];

  for (const file of files) {
    const fileResult = await storageAdapter.get(file.storage_key);
    if (!fileResult.success) continue;

    const chunks = [];
    for await (const chunk of fileResult.stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    if (checksum !== file.sha256) {
      throw new Error(`Checksum mismatch untuk evidence ${file.id}`);
    }

    const destPath = path.join(backupDir, file.storage_key);
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    await fsp.writeFile(destPath, buffer);

    manifest.push({
      id: file.id,
      storageKey: file.storage_key,
      sha256: file.sha256,
      safeName: file.safe_name,
      mimeType: file.detected_mime,
      sizeBytes: file.size_bytes
    });
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  await fsp.writeFile(manifestPath, JSON.stringify({ backupId, createdAt: Date.now(), files: manifest }, null, 2));

  return {
    backupId,
    backupDir,
    manifest,
    fileCount: manifest.length
  };
}

async function restoreEvidenceArtifacts(backupId) {
  const backupDir = path.join(getArtifactBackupRoot(), backupId);
  const manifestPath = path.join(backupDir, 'manifest.json');
  const manifestRaw = await fsp.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const storageAdapter = getStorageAdapter();

  let restored = 0;
  for (const file of manifest.files) {
    const sourcePath = path.join(backupDir, file.storageKey);
    const buffer = await fsp.readFile(sourcePath);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    if (checksum !== file.sha256) {
      throw new Error(`Checksum gagal saat restore evidence ${file.id}`);
    }

    const putResult = await storageAdapter.put(file.storageKey, buffer, {
      evidenceId: file.id,
      restored: true
    });
    if (!putResult.success) {
      throw new Error(`Gagal restore file ${file.storageKey}: ${putResult.error}`);
    }
    restored += 1;
  }

  return { restored, backupId };
}

module.exports = {
  backupEvidenceArtifacts,
  restoreEvidenceArtifacts,
  getArtifactBackupRoot
};