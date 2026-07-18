/**
 * Local Storage Adapter
 * Implementasi StorageInterface untuk development/test
 * Menyimpan file di filesystem lokal di luar public/
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { StorageInterface, STORAGE_CONFIG } = require('./storage');
const { encryptBuffer, decryptBuffer, isEncryptionEnabled, encryptStream } = require('./fileEncryption');

class LocalStorageAdapter extends StorageInterface {
  constructor(options = {}) {
    super();
    this.basePath = options.basePath || STORAGE_CONFIG.localStoragePath;
    this.quarantinePath = options.quarantinePath || STORAGE_CONFIG.quarantinePath;
    this.tempPath = options.tempPath || STORAGE_CONFIG.tempPath;
    this.encryptAtRest = options.encryptAtRest ?? isEncryptionEnabled();
    this.initialized = false;
  }

  async writeEncryptedPayload(filePath, buffer) {
    if (!this.encryptAtRest) {
      await fsp.writeFile(filePath, buffer);
      return;
    }

    const encrypted = encryptBuffer(buffer);
    await fsp.writeFile(filePath, encrypted.data);
    await fsp.writeFile(`${filePath}.enc.json`, JSON.stringify({
      iv: encrypted.iv,
      salt: encrypted.salt,
      authTag: encrypted.authTag
    }));
  }

  async readEncryptedPayload(filePath) {
    const raw = await fsp.readFile(filePath);
    const encMetaPath = `${filePath}.enc.json`;

    try {
      await fsp.access(encMetaPath);
    } catch {
      if (this.encryptAtRest) {
        throw new Error('Metadata enkripsi tidak ditemukan');
      }
      return raw;
    }

    // Sidecar yang ada harus valid. Gagal parse/decrypt berarti fail-closed.
    const meta = JSON.parse(await fsp.readFile(encMetaPath, 'utf8'));
    return decryptBuffer(raw, meta.iv, meta.salt, meta.authTag);
  }

  /**
   * Inisialisasi direktori storage
   */
  async initialize() {
    if (this.initialized) return;

    const dirs = [this.basePath, this.quarantinePath, this.tempPath];
    
    for (const dir of dirs) {
      try {
        await fsp.access(dir);
      } catch {
        await fsp.mkdir(dir, { recursive: true });
      }
    }

    this.initialized = true;
  }

  /**
   * Dapatkan path lengkap untuk file
   */
  getFilePath(key, type = 'storage') {
    const basePath = type === 'quarantine' ? this.quarantinePath : this.basePath;
    return path.join(basePath, key);
  }

  /**
   * Simpan file ke local storage
   */
  async put(key, data, metadata = {}) {
    await this.initialize();

    const filePath = this.getFilePath(key, 'storage');
    const dir = path.dirname(filePath);

    // Pastikan direktori ada
    try {
      await fsp.access(dir);
    } catch {
      await fsp.mkdir(dir, { recursive: true });
    }

    try {
      if (Buffer.isBuffer(data)) {
        await this.writeEncryptedPayload(filePath, data);
      } else if (data && typeof data.pipe === 'function') {
        // Stream — support encryption without full buffer in memory
        if (this.encryptAtRest) {
          await encryptStream(data, filePath);
        } else {
          const writeStream = fs.createWriteStream(filePath);
          await new Promise((resolve, reject) => {
            data.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });
        }
      } else {
        throw new Error('Invalid data type');
      }

      // Simpan metadata jika ada
      if (metadata && Object.keys(metadata).length > 0) {
        const metaPath = filePath + '.meta.json';
        await fsp.writeFile(metaPath, JSON.stringify(metadata, null, 2));
      }

      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Ambil file dari local storage
   */
  async get(key) {
    await this.initialize();

    let filePath = this.getFilePath(key, 'storage');

    try {
      try {
        await fsp.access(filePath);
      } catch {
        filePath = this.getFilePath(key, 'quarantine');
        await fsp.access(filePath);
      }
      
      const stat = await fsp.stat(filePath);
      // Verifikasi tag AES-GCM sepenuhnya sebelum byte plaintext diekspos ke pemanggil.
      const decrypted = await this.readEncryptedPayload(filePath);
      const { Readable } = require('stream');
      const stream = Readable.from(decrypted);

      // Baca metadata jika ada
      let metadata = {};
      const metaPath = filePath + '.meta.json';
      try {
        const metaContent = await fsp.readFile(metaPath, 'utf8');
        metadata = JSON.parse(metaContent);
      } catch {
        // Metadata tidak ada, abaikan
      }

      return {
        success: true,
        stream,
        metadata: {
          ...metadata,
          size: decrypted.length,
          createdAt: stat.birthtime,
          modifiedAt: stat.mtime
        }
      };
    } catch (err) {
      return { success: false, error: 'File tidak ditemukan' };
    }
  }

  /**
   * Hapus file dari local storage
   */
  async delete(key) {
    await this.initialize();

    const filePath = this.getFilePath(key, 'storage');
    const quarantineFilePath = this.getFilePath(key, 'quarantine');

    try {
      // Hapus dari storage
      try {
        await fsp.access(filePath);
        await fsp.unlink(filePath);
      } catch {
        // File tidak ada di storage
      }

      // Hapus dari quarantine
      try {
        await fsp.access(quarantineFilePath);
        await fsp.unlink(quarantineFilePath);
      } catch {
        // File tidak ada di quarantine
      }

      // Hapus metadata
      for (const target of [filePath, quarantineFilePath]) {
        for (const suffix of ['.meta.json', '.enc.json']) {
          try {
            await fsp.unlink(target + suffix);
          } catch {}
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Pindahkan file ke quarantine
   */
  async quarantine(key) {
    await this.initialize();

    const sourcePath = this.getFilePath(key, 'storage');
    const destPath = this.getFilePath(key, 'quarantine');

    try {
      await fsp.access(sourcePath);
      
      // Pastikan direktori quarantine ada
      const dir = path.dirname(destPath);
      try {
        await fsp.access(dir);
      } catch {
        await fsp.mkdir(dir, { recursive: true });
      }

      await fsp.rename(sourcePath, destPath);
      
      // Pindahkan metadata juga
      for (const suffix of ['.meta.json', '.enc.json']) {
        try {
          await fsp.rename(sourcePath + suffix, destPath + suffix);
        } catch {
          // Metadata tidak ada
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Pindahkan file dari quarantine ke storage (approve)
   */
  async approve(key) {
    await this.initialize();

    const sourcePath = this.getFilePath(key, 'quarantine');
    const destPath = this.getFilePath(key, 'storage');

    try {
      await fsp.access(sourcePath);
      
      // Pastikan direktori storage ada
      const dir = path.dirname(destPath);
      try {
        await fsp.access(dir);
      } catch {
        await fsp.mkdir(dir, { recursive: true });
      }

      await fsp.rename(sourcePath, destPath);
      
      // Pindahkan metadata juga
      for (const suffix of ['.meta.json', '.enc.json']) {
        try {
          await fsp.rename(sourcePath + suffix, destPath + suffix);
        } catch {
          // Metadata tidak ada
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Cek apakah file ada
   */
  async exists(key) {
    await this.initialize();

    const storagePath = this.getFilePath(key, 'storage');
    const quarantinePath = this.getFilePath(key, 'quarantine');

    try {
      await fsp.access(storagePath);
      return true;
    } catch {
      try {
        await fsp.access(quarantinePath);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Cleanup file temporary yang sudah expired
   */
  async cleanupTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
    await this.initialize();

    try {
      const files = await fsp.readdir(this.tempPath);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.tempPath, file);
        try {
          const stat = await fsp.stat(filePath);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fsp.unlink(filePath);
            cleaned++;
          }
        } catch {
          // File mungkin sudah dihapus
        }
      }

      return { success: true, cleaned };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Cleanup file orphan (ada di storage tapi tidak ada di database)
   */
  async cleanupOrphanFiles(validKeys) {
    await this.initialize();

    try {
      const files = await fsp.readdir(this.basePath);
      const validKeysSet = new Set(validKeys);
      let cleaned = 0;

      for (const file of files) {
        // Sidecar metadata mengikuti lifecycle file utama.
        if (file.endsWith('.meta.json') || file.endsWith('.enc.json')) continue;

        if (!validKeysSet.has(file)) {
          const filePath = path.join(this.basePath, file);
          try {
            await fsp.unlink(filePath);
            for (const suffix of ['.meta.json', '.enc.json']) {
              try {
                await fsp.unlink(filePath + suffix);
              } catch {}
            }
            cleaned++;
          } catch {
            // File mungkin sedang digunakan
          }
        }
      }

      return { success: true, cleaned };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Dapatkan statistik storage
   */
  async getStats() {
    await this.initialize();

    const getDirStats = async (dirPath) => {
      try {
        const files = await fsp.readdir(dirPath);
        let totalSize = 0;
        let fileCount = 0;

        for (const file of files) {
          if (file.endsWith('.meta.json') || file.endsWith('.enc.json')) continue;

          const filePath = path.join(dirPath, file);
          try {
            const stat = await fsp.stat(filePath);
            if (stat.isFile()) {
              totalSize += stat.size;
              fileCount++;
            }
          } catch {
            // File mungkin sudah dihapus
          }
        }

        return { fileCount, totalSize };
      } catch {
        return { fileCount: 0, totalSize: 0 };
      }
    };

    const [storage, quarantine, temp] = await Promise.all([
      getDirStats(this.basePath),
      getDirStats(this.quarantinePath),
      getDirStats(this.tempPath)
    ]);

    return {
      storage,
      quarantine,
      temp,
      totalFiles: storage.fileCount + quarantine.fileCount + temp.fileCount,
      totalSize: storage.totalSize + quarantine.totalSize + temp.totalSize
    };
  }
}

module.exports = LocalStorageAdapter;
