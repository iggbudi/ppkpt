/**
 * S3-Compatible Storage Adapter
 * Untuk production: AWS S3, MinIO, R2, dll.
 * 
 * CATATAN: Ini adalah template. Install @aws-sdk/client-s3 sebelum menggunakan.
 */

const { StorageInterface, STORAGE_CONFIG } = require('./storage');
const crypto = require('crypto');

// Konfigurasi S3
const S3_CONFIG = {
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || null, // Untuk MinIO/R2
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
  },
  bucket: process.env.S3_BUCKET || 'safesphere-evidence',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' // Untuk MinIO
};

// Enkripsi config
const ENCRYPTION_CONFIG = {
  enabled: process.env.EVIDENCE_ENCRYPTION_ENABLED === 'true',
  algorithm: 'aes-256-gcm',
  key: process.env.EVIDENCE_ENCRYPTION_KEY || null
};

class S3StorageAdapter extends StorageInterface {
  constructor(options = {}) {
    super();
    this.config = { ...S3_CONFIG, ...options };
    this.client = null;
    this.initialized = false;
  }

  /**
   * Inisialisasi S3 client
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Dynamic import untuk optional dependency
      const { S3Client } = require('@aws-sdk/client-s3');
      
      this.client = new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint || undefined,
        credentials: this.config.credentials,
        forcePathStyle: this.config.forcePathStyle
      });

      this.initialized = true;
      console.log('S3 storage adapter initialized');
    } catch (err) {
      console.error('S3 initialization failed:', err.message);
      throw new Error('S3 storage not available. Install @aws-sdk/client-s3');
    }
  }

  /**
   * Enkripsi buffer
   */
  encryptBuffer(buffer) {
    if (!ENCRYPTION_CONFIG.enabled || !ENCRYPTION_CONFIG.key) {
      return { encrypted: false, data: buffer };
    }

    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_CONFIG.key, salt, 32);
    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted: true,
      data: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Dekripsi buffer
   */
  decryptBuffer(encryptedData, iv, salt, authTag) {
    if (!ENCRYPTION_CONFIG.key) {
      throw new Error('Encryption key not configured');
    }

    const key = crypto.scryptSync(ENCRYPTION_CONFIG.key, Buffer.from(salt, 'hex'), 32);
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }

  /**
   * Simpan file ke S3
   */
  async put(key, data, metadata = {}) {
    await this.initialize();

    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      
      let body = data;
      let encryptionMetadata = {};

      // Enkripsi jika diaktifkan
      if (ENCRYPTION_CONFIG.enabled) {
        const buffer = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
        const encrypted = this.encryptBuffer(buffer);
        body = encrypted.data;
        encryptionMetadata = {
          'x-amz-meta-encrypted': 'true',
          'x-amz-meta-encryption-iv': encrypted.iv,
          'x-amz-meta-encryption-salt': encrypted.salt,
          'x-amz-meta-encryption-auth-tag': encrypted.authTag
        };
      }

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: `evidence/${key}`,
        Body: body,
        ContentType: metadata.contentType || 'application/octet-stream',
        Metadata: {
          ...metadata,
          ...encryptionMetadata,
          'x-amz-meta-uploaded-at': Date.now().toString()
        },
        // Server-side encryption (SSE-S3 atau SSE-KMS)
        ServerSideEncryption: 'AES256'
      });

      await this.client.send(command);

      return { success: true, path: `s3://${this.config.bucket}/evidence/${key}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Ambil file dari S3
   */
  async get(key) {
    await this.initialize();

    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: `evidence/${key}`
      });

      const response = await this.client.send(command);
      
      // Convert stream to buffer
      const buffer = await streamToBuffer(response.Body);
      
      // Dekripsi jika diperlukan
      let data = buffer;
      const metadata = response.Metadata || {};
      
      if (metadata['x-amz-meta-encrypted'] === 'true') {
        data = this.decryptBuffer(
          buffer,
          metadata['x-amz-meta-encryption-iv'],
          metadata['x-amz-meta-encryption-salt'],
          metadata['x-amz-meta-encryption-auth-tag']
        );
      }

      return {
        success: true,
        stream: bufferToStream(data),
        metadata: {
          contentType: response.ContentType,
          contentLength: response.ContentLength,
          lastModified: response.LastModified,
          ...metadata
        }
      };
    } catch (err) {
      if (err.name === 'NoSuchKey') {
        return { success: false, error: 'File tidak ditemukan' };
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Hapus file dari S3
   */
  async delete(key) {
    await this.initialize();

    try {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: `evidence/${key}`
      });

      await this.client.send(command);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Pindahkan ke quarantine (copy + delete)
   */
  async quarantine(key) {
    // Di S3, kita bisa gunakan tag atau prefix untuk quarantine
    // Untuk simplisitas, kita pindahkan ke prefix berbeda
    return { success: true, note: 'Quarantine handled via scan_status in DB' };
  }

  /**
   * Approve (tidak perlu di S3 karena file sudah di final location)
   */
  async approve(key) {
    return { success: true, note: 'Approval handled via scan_status in DB' };
  }

  /**
   * Cek apakah file ada
   */
  async exists(key) {
    await this.initialize();

    try {
      const { HeadObjectCommand } = require('@aws-sdk/client-s3');
      
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: `evidence/${key}`
      });

      await this.client.send(command);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Generate signed URL untuk download (temporary)
   */
  async getSignedUrl(key, expiresIn = 60) {
    await this.initialize();

    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: `evidence/${key}`
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return { success: true, url, expiresIn };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Dapatkan statistik bucket
   */
  async getStats() {
    await this.initialize();

    try {
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      
      let totalCount = 0;
      let totalSize = 0;
      let continuationToken = null;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: 'evidence/',
          ContinuationToken: continuationToken
        });

        const response = await this.client.send(command);
        
        if (response.Contents) {
          totalCount += response.Contents.length;
          totalSize += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return {
        bucket: this.config.bucket,
        totalCount,
        totalSize
      };
    } catch (err) {
      return { error: err.message };
    }
  }
}

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Convert buffer to stream
 */
function bufferToStream(buffer) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

module.exports = S3StorageAdapter;
