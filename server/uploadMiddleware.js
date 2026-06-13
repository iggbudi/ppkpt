/**
 * Upload Middleware Module
 * Menangani multipart upload dengan validasi streaming
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const {
  UPLOAD_LIMITS,
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  detectMimeType,
  isMimeAllowed,
  isSuspiciousExtension,
  sanitizeFileName
} = require('./storage');

// Temp directory untuk upload
const { STORAGE_CONFIG } = require('./storage');
const TEMP_DIR = STORAGE_CONFIG.tempPath;

// Pastikan temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Storage engine untuk multer yang menyimpan ke temp directory
 */
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

/**
 * File filter untuk validasi awal
 */
function fileFilter(req, file, cb) {
  // Cek extension mencurigakan
  if (isSuspiciousExtension(file.originalname)) {
    return cb(new Error('Tipe file tidak diizinkan'), false);
  }

  // Cek MIME type dari header
  if (BLOCKED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Tipe file diblokir'), false);
  }

  // Lanjutkan, validasi lebih detail dilakukan setelah upload
  cb(null, true);
}

/**
 * Konfigurasi multer
 */
const upload = multer({
  storage: tempStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.maxFileSize,
    files: UPLOAD_LIMITS.maxFilesPerReport,
    fieldSize: 1024 * 1024, // 1MB untuk field
    fieldNameSize: 100,
    fields: 20
  }
});

/**
 * Middleware untuk upload multiple files
 */
const uploadEvidenceFiles = upload.array('evidence', UPLOAD_LIMITS.maxFilesPerReport);

/**
 * Middleware wrapper dengan error handling
 */
function handleUpload(req, res, next) {
  uploadEvidenceFiles(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer error
      let message = 'Upload error';
      
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          message = `File terlalu besar (maks ${UPLOAD_LIMITS.maxFileSize / 1024 / 1024} MB)`;
          break;
        case 'LIMIT_FILE_COUNT':
          message = `Terlalu banyak file (maks ${UPLOAD_LIMITS.maxFilesPerReport})`;
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          message = 'Field file tidak diharapkan';
          break;
        default:
          message = err.message;
      }

      // Cleanup temp files
      cleanupTempFiles(req.files);

      return res.status(400).json({ error: message });
    } else if (err) {
      // Other error
      cleanupTempFiles(req.files);
      return res.status(400).json({ error: err.message });
    }

    next();
  });
}

/**
 * Cleanup temp files
 */
function cleanupTempFiles(files) {
  if (!files) return;
  
  const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
  
  for (const file of fileArray) {
    try {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      console.error('Cleanup temp file error:', err.message);
    }
  }
}

/**
 * Validasi file setelah upload (signature/MIME check)
 */
async function validateUploadedFile(file) {
  const errors = [];
  
  try {
    // Baca beberapa byte pertama untuk deteksi MIME
    const fd = fs.openSync(file.path, 'r');
    const buffer = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    // Deteksi MIME berdasarkan magic bytes
    const detectedMime = detectMimeType(buffer.subarray(0, bytesRead));
    
    // Cek apakah detected MIME diblokir
    if (detectedMime && BLOCKED_MIME_TYPES.has(detectedMime)) {
      errors.push(`File terdeteksi sebagai ${detectedMime} yang diblokir`);
    }
    
    // Cek apakah MIME diizinkan
    if (!detectedMime) {
      errors.push('Signature file tidak dikenali');
    }
    const effectiveMime = detectedMime;
    if (!isMimeAllowed(effectiveMime)) {
      errors.push(`Tipe file ${effectiveMime} tidak didukung`);
    }

    // Cek konsistensi
    if (detectedMime && file.mimetype && detectedMime !== file.mimetype) {
      errors.push('Tipe file tidak sesuai dengan isi file');
    }

    return {
      valid: errors.length === 0,
      errors,
      detectedMime: effectiveMime,
      originalMime: file.mimetype
    };
  } catch (err) {
    return {
      valid: false,
      errors: ['Gagal membaca file: ' + err.message],
      detectedMime: null,
      originalMime: file.mimetype
    };
  }
}

/**
 * Hitung SHA-256 dari file
 */
function calculateFileSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Simpan file dari temp ke quarantine
 */
async function moveToQuarantine(file, storageAdapter) {
  const storageKey = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
  
  // Baca file dari temp
  const fileBuffer = fs.readFileSync(file.path);
  
  // Simpan ke quarantine
  const result = await storageAdapter.put(storageKey, fileBuffer, {
    originalName: file.originalname,
    tempPath: file.path
  });

  if (result.success) {
    // Hapus file temp
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }

  return {
    ...result,
    storageKey
  };
}

/**
 * Cleanup semua temp files untuk request
 */
function cleanupRequestFiles(req) {
  if (req.files) {
    cleanupTempFiles(req.files);
  }
}

module.exports = {
  handleUpload,
  validateUploadedFile,
  calculateFileSHA256,
  moveToQuarantine,
  cleanupTempFiles,
  cleanupRequestFiles,
  upload
};
