const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs').promises;
const { pipeline } = require('stream/promises');

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

/**
 * Encrypt from input stream to file + write .enc.json metadata.
 * Avoids loading full file into memory.
 */
async function encryptStream(inputStream, outputFilePath) {
  const metadataPath = `${outputFilePath}.enc.json`;
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const output = fs.createWriteStream(outputFilePath);

  try {
    await pipeline(inputStream, cipher, output);
    const meta = {
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex')
    };
    await fsp.writeFile(metadataPath, JSON.stringify(meta));
  } catch (error) {
    await Promise.allSettled([
      fsp.unlink(outputFilePath),
      fsp.unlink(metadataPath)
    ]);
    throw error;
  }
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
  isEncryptionEnabled,
  encryptStream
};
