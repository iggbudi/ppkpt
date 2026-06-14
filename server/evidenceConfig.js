const { isEncryptionEnabled } = require('./fileEncryption');

function validateEvidenceProductionConfig() {
  const driver = process.env.EVIDENCE_STORAGE_DRIVER || 'local';

  if (driver === 's3') {
    const required = ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      throw new Error(`Konfigurasi S3 evidence belum lengkap: ${missing.join(', ')}`);
    }
    if (process.env.EVIDENCE_ENCRYPTION_ENABLED !== 'true') {
      throw new Error('EVIDENCE_ENCRYPTION_ENABLED=true wajib untuk storage S3 production');
    }
  } else if (!isEncryptionEnabled()) {
    throw new Error('Production evidence memerlukan EVIDENCE_ENCRYPTION_ENABLED=true dan EVIDENCE_ENCRYPTION_KEY (min 32 karakter)');
  }

  if (process.env.EVIDENCE_SCANNER_MODE !== 'strict') {
    throw new Error('Production evidence memerlukan EVIDENCE_SCANNER_MODE=strict');
  }
}

function isEvidenceUploadsEnabled(nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === 'test') return true;
  if (process.env.EVIDENCE_UPLOADS_ENABLED !== 'true') return false;
  if (nodeEnv === 'production') {
    validateEvidenceProductionConfig();
    return true;
  }
  return nodeEnv !== 'production';
}

function getEvidenceStorageDriver() {
  return process.env.EVIDENCE_STORAGE_DRIVER || 'local';
}

module.exports = {
  validateEvidenceProductionConfig,
  isEvidenceUploadsEnabled,
  getEvidenceStorageDriver
};