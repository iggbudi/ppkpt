const LocalStorageAdapter = require('./storageLocal');
const { getEvidenceStorageDriver } = require('./evidenceConfig');

let adapterInstance = null;

function createStorageAdapter() {
  const driver = getEvidenceStorageDriver();

  if (driver === 's3') {
    const S3StorageAdapter = require('./storageS3');
    return new S3StorageAdapter();
  }

  return new LocalStorageAdapter({
    encryptAtRest: process.env.EVIDENCE_ENCRYPTION_ENABLED === 'true'
  });
}

function getStorageAdapter() {
  if (!adapterInstance) {
    adapterInstance = createStorageAdapter();
  }
  return adapterInstance;
}

function resetStorageAdapter() {
  adapterInstance = null;
}

module.exports = {
  createStorageAdapter,
  getStorageAdapter,
  resetStorageAdapter
};