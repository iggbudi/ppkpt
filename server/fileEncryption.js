const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const key = process.env.EVIDENCE_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('EVIDENCE_ENCRYPTION_KEY minimal 32 karakter');
  }
  return key;
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    data: encrypted,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptBuffer(encryptedData, ivHex, saltHex, authTagHex) {
  const key = crypto.scryptSync(getEncryptionKey(), Buffer.from(saltHex, 'hex'), 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

function isEncryptionEnabled() {
  return process.env.EVIDENCE_ENCRYPTION_ENABLED === 'true'
    && Boolean(process.env.EVIDENCE_ENCRYPTION_KEY);
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
  isEncryptionEnabled
};