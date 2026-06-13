/**
 * Storage Interface Module
 * Menyediakan abstraction layer untuk file storage
 * Mendukung local storage untuk development/test
 * dan interface untuk object storage production
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pipeline } = require('stream/promises');

// MIME types yang diizinkan
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'text/plain',
  
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  
  // Audio
  'audio/mpeg', // MP3
  'audio/mp4',  // M4A
  'audio/x-m4a',
  
  // Video
  'video/mp4',
  'video/webm'
]);

// MIME types yang DITOLAK (bahkan jika extension valid)
const BLOCKED_MIME_TYPES = new Set([
  'application/x-executable',
  'application/x-msdos-program',
  'application/x-msdownload',
  'application/x-sh',
  'application/x-bat',
  'application/x-csh',
  'text/x-script.python',
  'text/x-shellscript',
  'application/java-archive',
  'application/x-java-archive',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/x-ms-shortcut',
  'application/vnd.microsoft.portable-executable'
]);

// Magic bytes untuk validasi file signature
const FILE_SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'audio/mpeg': [0xFF, 0xFB], // MP3 frame sync
  'video/mp4': [0x00, 0x00, 0x00], // validated further below
};

// Batas upload
const UPLOAD_LIMITS = {
  maxFileSize: 10 * 1024 * 1024, // 10 MB per file
  maxTotalSize: 25 * 1024 * 1024, // 25 MB total per laporan
  maxFilesPerReport: 5,
  maxFileNameLength: 255
};

// Konfigurasi storage
const defaultDataPath = process.env.NODE_ENV === 'test'
  ? path.join(os.tmpdir(), `safesphere-evidence-test-${process.pid}`)
  : path.join(__dirname, '..', 'data');
const STORAGE_CONFIG = {
  localStoragePath: process.env.EVIDENCE_STORAGE_PATH || path.join(defaultDataPath, 'evidence'),
  quarantinePath: process.env.EVIDENCE_QUARANTINE_PATH || path.join(defaultDataPath, 'quarantine'),
  tempPath: process.env.EVIDENCE_TEMP_PATH || path.join(defaultDataPath, 'temp-uploads')
};

/**
 * Generate storage key yang aman (tidak dapat diprediksi)
 */
function generateStorageKey(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();
  return `${timestamp}-${uuid}${ext}`;
}

/**
 * Generate nama file aman untuk display
 */
function sanitizeFileName(fileName) {
  // Hapus path components
  const baseName = path.basename(fileName);
  
  // Ganti karakter berbahaya
  const sanitized = baseName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
  
  // Batasi panjang
  const ext = path.extname(sanitized);
  const nameWithoutExt = path.basename(sanitized, ext);
  
  if (nameWithoutExt.length > 200) {
    return nameWithoutExt.substring(0, 200) + ext;
  }
  
  return sanitized || 'unnamed' + ext;
}

/**
 * Validasi MIME type berdasarkan magic bytes
 */
function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4';
  }
  
  for (const [mime, signature] of Object.entries(FILE_SIGNATURES)) {
    if (signature.every((byte, index) => buffer[index] === byte)) {
      return mime;
    }
  }
  
  // Deteksi berdasarkan content
  const header = buffer.toString('ascii', 0, Math.min(100, buffer.length));
  
  if (header.includes('%PDF')) return 'application/pdf';
  if (header.includes('<?xml') && header.includes('<svg')) return 'image/svg+xml';
  if (header.includes('<!DOCTYPE html') || header.includes('<html')) return 'text/html';
  if (!buffer.includes(0) && /^[\x09\x0a\x0d\x20-\x7e]*$/.test(buffer.toString('utf8'))) return 'text/plain';
  
  return null;
}

/**
 * Validasi apakah MIME type diizinkan
 */
function isMimeAllowed(mimeType) {
  if (!mimeType) return false;
  if (BLOCKED_MIME_TYPES.has(mimeType)) return false;
  return ALLOWED_MIME_TYPES.has(mimeType);
}

/**
 * Validasi apakah file extension mencurigakan
 */
function isSuspiciousExtension(fileName) {
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
    '.sh', '.bash', '.csh', '.ksh',
    '.js', '.vbs', '.vbe', '.wsf', '.wsh',
    '.ps1', '.psm1', '.psd1',
    '.jar', '.class',
    '.py', '.rb', '.pl',
    '.dll', '.so', '.dylib',
    '.sys', '.drv',
    '.lnk', '.url',
    '.hta', '.cpl', '.msc',
    '.inf', '.reg',
    '.svg', '.html', '.htm', '.xhtml'
  ];
  
  const ext = path.extname(fileName).toLowerCase();
  return dangerousExtensions.includes(ext);
}

/**
 * Hitung SHA-256 hash dari buffer
 */
function calculateSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Sanitasi metadata EXIF dari gambar (placeholder)
 * Production: gunakan sharp atau jimp
 */
async function stripImageMetadata(buffer, mimeType) {
  // Untuk development, return buffer as-is
  // Production: implementasi dengan sharp/jimp
  // - Hapus EXIF data
  // - Hapus GPS coordinates
  // - Hapus camera info
  // - Hapus thumbnail
  return buffer;
}

/**
 * Base storage interface
 * Semua storage adapter harus mengimplementasikan interface ini
 */
class StorageInterface {
  /**
   * Simpan file ke storage
   * @param {string} key - Storage key
   * @param {Buffer|ReadableStream} data - File data
   * @param {Object} metadata - File metadata
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  async put(key, data, metadata) {
    throw new Error('Not implemented');
  }

  /**
   * Ambil file dari storage
   * @param {string} key - Storage key
   * @returns {Promise<{success: boolean, stream?: ReadableStream, metadata?: Object, error?: string}>}
   */
  async get(key) {
    throw new Error('Not implemented');
  }

  /**
   * Hapus file dari storage
   * @param {string} key - Storage key
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async delete(key) {
    throw new Error('Not implemented');
  }

  /**
   * Pindahkan file ke quarantine
   * @param {string} key - Storage key
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async quarantine(key) {
    throw new Error('Not implemented');
  }

  /**
   * Pindahkan file dari quarantine ke storage final
   * @param {string} key - Storage key
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async approve(key) {
    throw new Error('Not implemented');
  }

  /**
   * Cek apakah file ada
   * @param {string} key - Storage key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    throw new Error('Not implemented');
  }
}

module.exports = {
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  UPLOAD_LIMITS,
  STORAGE_CONFIG,
  FILE_SIGNATURES,
  generateStorageKey,
  sanitizeFileName,
  detectMimeType,
  isMimeAllowed,
  isSuspiciousExtension,
  calculateSHA256,
  stripImageMetadata,
  StorageInterface
};
