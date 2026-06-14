/**
 * Evidence Manager Module
 * Mengelola file bukti: upload, scan, download, delete
 * Mengintegrasikan storage dengan database
 */

const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const {
  ALLOWED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  UPLOAD_LIMITS,
  generateStorageKey,
  sanitizeFileName,
  detectMimeType,
  isMimeAllowed,
  isSuspiciousExtension,
  calculateSHA256
} = require('./storage');
const { getStorageAdapter } = require('./storageFactory');
const { stripImageMetadata, validateImageDimensions } = require('./metadataStripper');
const { scanFileWithCache } = require('./scanner');
const { monitor } = require('./monitoring');

const storageAdapter = getStorageAdapter();

// Prepared statements
const insertEvidence = db.prepare(`
  INSERT INTO evidence_files (id, report_id, storage_key, original_name, safe_name, detected_mime, size_bytes, sha256, scan_status, uploaded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectEvidenceById = db.prepare('SELECT * FROM evidence_files WHERE id = ?');
const selectEvidenceByReport = db.prepare('SELECT * FROM evidence_files WHERE report_id = ? AND deleted_at IS NULL');
const selectEvidenceByStorageKey = db.prepare('SELECT * FROM evidence_files WHERE storage_key = ?');

const updateScanStatus = db.prepare('UPDATE evidence_files SET scan_status = ?, scan_result = ? WHERE id = ?');
const softDeleteEvidence = db.prepare('UPDATE evidence_files SET deleted_at = ? WHERE id = ?');

const countEvidenceByReport = db.prepare('SELECT COUNT(*) as count FROM evidence_files WHERE report_id = ? AND deleted_at IS NULL');
const sumEvidenceByReport = db.prepare('SELECT COALESCE(SUM(size_bytes), 0) as total FROM evidence_files WHERE report_id = ? AND deleted_at IS NULL');

/**
 * Generate evidence ID
 */
function generateEvidenceId() {
  return 'EV-' + crypto.randomUUID();
}

/**
 * Validasi file sebelum upload
 */
function validateFile(fileBuffer, fileName, mimeType) {
  const errors = [];

  // Cek ukuran
  if (fileBuffer.length > UPLOAD_LIMITS.maxFileSize) {
    errors.push(`File terlalu besar (maks ${UPLOAD_LIMITS.maxFileSize / 1024 / 1024} MB)`);
  }

  // Cek extension mencurigakan
  if (isSuspiciousExtension(fileName)) {
    errors.push('Tipe file tidak diizinkan');
  }

  // Cek MIME type
  const detectedMime = detectMimeType(fileBuffer);
  
  if (detectedMime && BLOCKED_MIME_TYPES.has(detectedMime)) {
    errors.push('Tipe file diblokir');
  }

  if (!isMimeAllowed(mimeType) && !isMimeAllowed(detectedMime)) {
    errors.push('Tipe file tidak didukung');
  }

  // Validasi konsistensi extension vs detected MIME
  if (detectedMime && mimeType && detectedMime !== mimeType) {
    // Peringatan, bukan error (beberapa browser mengirim MIME berbeda)
    // Tapi blokir jika detected adalah tipe berbahaya
    if (BLOCKED_MIME_TYPES.has(detectedMime)) {
      errors.push('Tipe file terdeteksi berbahaya');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    detectedMime: detectedMime || mimeType
  };
}

/**
 * Upload file bukti
 */
async function uploadEvidence(reportId, fileBuffer, originalName, mimeType, userId, isAnonymous) {
  // Cek batas jumlah file
  const { count } = countEvidenceByReport.get(reportId);
  if (count >= UPLOAD_LIMITS.maxFilesPerReport) {
    return {
      success: false,
      error: `Batas maksimal ${UPLOAD_LIMITS.maxFilesPerReport} file per laporan`
    };
  }

  // Cek batas total size
  const { total } = sumEvidenceByReport.get(reportId);
  if (total + fileBuffer.length > UPLOAD_LIMITS.maxTotalSize) {
    return {
      success: false,
      error: `Total ukuran file melebihi batas ${UPLOAD_LIMITS.maxTotalSize / 1024 / 1024} MB`
    };
  }

  // Validasi file
  const validation = validateFile(fileBuffer, originalName, mimeType);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join(', ')
    };
  }

  // Generate ID dan storage key
  const evidenceId = generateEvidenceId();
  const storageKey = generateStorageKey(originalName);
  const sanitizedName = sanitizeFileName(originalName);
  const safeName = isAnonymous ? `bukti${path.extname(sanitizedName).toLowerCase()}` : sanitizedName;
  // Validasi dimensi gambar
  if (validation.detectedMime && validation.detectedMime.startsWith('image/')) {
    const dimValidation = await validateImageDimensions(fileBuffer, validation.detectedMime);
    if (!dimValidation.valid) {
      return {
        success: false,
        error: dimValidation.error
      };
    }
  }

  // Strip metadata dari gambar
  let processedBuffer = fileBuffer;
  if (validation.detectedMime && validation.detectedMime.startsWith('image/')) {
    const stripResult = await stripImageMetadata(fileBuffer, validation.detectedMime);
    if (stripResult.success) {
      processedBuffer = stripResult.buffer;
      if (stripResult.stripped.length > 0) {
        console.log(`Stripped metadata from ${originalName}: ${stripResult.stripped.join(', ')}`);
      }
    } else {
      console.error('Metadata stripping failed:', stripResult.error);
      return { success: false, error: 'File gambar tidak dapat diproses dengan aman' };
    }
  }

  const sha256 = calculateSHA256(processedBuffer);
  const storedSize = processedBuffer.length;

  // Simpan lalu pindahkan ke quarantine sebelum scan.
  const putResult = await storageAdapter.put(storageKey, processedBuffer, {
    evidenceId,
    reportId,
    originalName: safeName,
    safeName,
    sha256,
    uploadedBy: isAnonymous ? 'anonymous' : userId
  });

  if (!putResult.success) {
    return {
      success: false,
      error: 'Gagal menyimpan file'
    };
  }
  const quarantineResult = await storageAdapter.quarantine(storageKey);
  if (!quarantineResult.success) {
    await storageAdapter.delete(storageKey);
    return { success: false, error: 'Gagal memindahkan file ke quarantine' };
  }

  // Simpan metadata ke database
  try {
    insertEvidence.run(
      evidenceId,
      reportId,
      storageKey,
      safeName,
      safeName,
      validation.detectedMime,
      storedSize,
      sha256,
      'pending', // scan_status
      Date.now()
    );

    // Audit logging
    const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
    insertAudit.run(
      Date.now(),
      isAnonymous ? null : userId,
      'evidence.upload',
      evidenceId,
      null,
      JSON.stringify({
        reportId,
        fileName: safeName,
        size: storedSize,
        mimeType: validation.detectedMime,
        sha256
      })
    );

    // Record monitoring
    const scanResult = await scanEvidence(evidenceId);
    if (!scanResult.success || scanResult.status !== 'clean') {
      await purgeEvidence(evidenceId);
      return { success: false, error: 'File tidak lolos pemeriksaan keamanan' };
    }

    monitor.recordUpload(true, { evidenceId, reportId, size: storedSize });

    return {
      success: true,
      evidence: {
        id: evidenceId,
        reportId,
        originalName: safeName,
        safeName,
        mimeType: validation.detectedMime,
        size: storedSize,
        sha256,
        scanStatus: 'clean'
      }
    };
  } catch (err) {
    // Rollback: hapus file dari storage
    await storageAdapter.delete(storageKey);
    
    // Record monitoring error
    monitor.recordUpload(false, { error: err.message, reportId });
    
    return {
      success: false,
      error: 'Gagal menyimpan metadata: ' + err.message
    };
  }
}

/**
 * Jalankan scan malware (placeholder)
 * Production: integrasi dengan ClamAV atau service lain
 */
async function scanEvidence(evidenceId) {
  const evidence = selectEvidenceById.get(evidenceId);
  
  if (!evidence) {
    return { success: false, error: 'File bukti tidak ditemukan' };
  }

  if (evidence.scan_status !== 'pending') {
    return { success: false, error: 'File sudah di-scan' };
  }

  // Ambil file dari storage
  const fileResult = await storageAdapter.get(evidence.storage_key);
  if (!fileResult.success) {
    return { success: false, error: 'File tidak ditemukan di storage' };
  }

  // Baca file buffer
  const chunks = [];
  for await (const chunk of fileResult.stream) {
    chunks.push(chunk);
  }
  const fileBuffer = Buffer.concat(chunks);

  // Scan dengan scanner
  const scanResult = await scanFileWithCache(fileBuffer, evidence.detected_mime, evidence.original_name);
  const isClean = scanResult.clean;
  const resultMessage = scanResult.result;

  // Update status
  if (isClean) {
    // Pindahkan dari quarantine ke storage
    const approveResult = await storageAdapter.approve(evidence.storage_key);
    if (!approveResult.success) {
      updateScanStatus.run('error', 'Gagal memindahkan file dari quarantine', evidenceId);
      return { success: false, error: 'Gagal menyelesaikan pemeriksaan file' };
    }
    updateScanStatus.run('clean', resultMessage, evidenceId);
  } else {
    updateScanStatus.run('rejected', resultMessage, evidenceId);
    
    // Hapus file
    await storageAdapter.delete(evidence.storage_key);
  }

  // Audit logging
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertAudit.run(
    Date.now(),
    null,
    'evidence.scan',
    evidenceId,
    null,
    JSON.stringify({
      status: isClean ? 'clean' : 'rejected',
      result: resultMessage,
      fromCache: scanResult.fromCache || false
    })
  );

  // Record monitoring
  monitor.recordScan(isClean ? 'clean' : 'rejected', { evidenceId, result: resultMessage });

  return {
    success: true,
    status: isClean ? 'clean' : 'rejected',
    result: resultMessage
  };
}

async function purgeEvidence(evidenceId) {
  const evidence = selectEvidenceById.get(evidenceId);
  if (!evidence) return;
  await storageAdapter.delete(evidence.storage_key);
  db.prepare('DELETE FROM evidence_files WHERE id = ?').run(evidenceId);
}

/**
 * Download file bukti
 */
async function downloadEvidence(evidenceId, userId, userRole) {
  const evidence = selectEvidenceById.get(evidenceId);
  
  if (!evidence) {
    return { success: false, error: 'File bukti tidak ditemukan' };
  }

  if (evidence.deleted_at) {
    return { success: false, error: 'File telah dihapus' };
  }

  // Hanya file clean yang bisa diunduh
  if (evidence.scan_status !== 'clean') {
    return {
      success: false,
      error: 'File belum tersedia untuk diunduh'
    };
  }

  // Cek otorisasi
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND deleted_at IS NULL').get(evidence.report_id);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  // Admin bisa download semua, user biasa hanya laporan sendiri
  if (userRole !== 'admin' && report.authorId !== userId) {
    return { success: false, error: 'Tidak memiliki akses' };
  }

  // Ambil file dari storage
  const getResult = await storageAdapter.get(evidence.storage_key);
  
  if (!getResult.success) {
    return { success: false, error: 'File tidak ditemukan di storage' };
  }

  // Audit logging
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertAudit.run(
    Date.now(),
    userId,
    'evidence.download',
    evidenceId,
    null,
    JSON.stringify({
      reportId: evidence.report_id,
      fileName: evidence.safe_name
    })
  );

  // Record monitoring
  monitor.recordDownload(true, { evidenceId, userId });

  return {
    success: true,
    stream: getResult.stream,
    metadata: {
      fileName: evidence.safe_name,
      mimeType: evidence.detected_mime,
      size: evidence.size_bytes
    }
  };
}

/**
 * Hapus file bukti (soft delete)
 */
async function deleteEvidence(evidenceId, userId, userRole) {
  const evidence = selectEvidenceById.get(evidenceId);
  
  if (!evidence) {
    return { success: false, error: 'File bukti tidak ditemukan' };
  }

  if (evidence.deleted_at) {
    return { success: false, error: 'File sudah dihapus' };
  }

  // Cek otorisasi
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(evidence.report_id);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  // Cek legal hold
  if (report.legal_hold) {
    return { success: false, error: 'File memiliki legal hold aktif' };
  }

  // Admin bisa hapus semua, user biasa hanya laporan sendiri dan sebelum diproses
  if (userRole !== 'admin') {
    if (report.authorId !== userId) {
      return { success: false, error: 'Tidak memiliki akses' };
    }
    if (['Diproses', 'Selesai'].includes(report.status)) {
      return { success: false, error: 'File tidak dapat dihapus setelah laporan diproses' };
    }
  }

  // Soft delete
  softDeleteEvidence.run(Date.now(), evidenceId);
  
  // Hapus file dari storage
  await storageAdapter.delete(evidence.storage_key);

  // Audit logging
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertAudit.run(
    Date.now(),
    userId,
    'evidence.delete',
    evidenceId,
    null,
    JSON.stringify({
      reportId: evidence.report_id,
      fileName: evidence.safe_name
    })
  );

  return { success: true };
}

/**
 * Dapatkan daftar file bukti untuk laporan
 */
function getEvidenceByReport(reportId, userId, userRole) {
  // Cek otorisasi
  const report = db.prepare('SELECT * FROM reports WHERE id = ? AND deleted_at IS NULL').get(reportId);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  if (userRole !== 'admin' && report.authorId !== userId) {
    return { success: false, error: 'Tidak memiliki akses' };
  }

  const evidence = selectEvidenceByReport.all(reportId);
  
  return {
    success: true,
    evidence: evidence.map(e => ({
      id: e.id,
      originalName: e.original_name,
      safeName: e.safe_name,
      mimeType: e.detected_mime,
      size: e.size_bytes,
      scanStatus: e.scan_status,
      uploadedAt: e.uploaded_at
    }))
  };
}

/**
 * Cleanup file orphan, rejected, dan expired
 */
async function cleanupEvidenceFiles() {
  // Dapatkan semua storage key yang valid (belum dihapus)
  const validKeys = db.prepare('SELECT storage_key FROM evidence_files WHERE deleted_at IS NULL').all().map(r => r.storage_key);
  
  // Cleanup orphan files (ada di storage tapi tidak ada di database)
  const orphanResult = await storageAdapter.cleanupOrphanFiles(validKeys);
  
  // Cleanup temp files (lebih dari 24 jam)
  const tempResult = await storageAdapter.cleanupTempFiles(24 * 60 * 60 * 1000);

  // Cleanup rejected files yang sudah lebih dari 7 hari
  const rejectedCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const rejectedFiles = db.prepare("SELECT * FROM evidence_files WHERE scan_status = 'rejected' AND uploaded_at < ?").all(rejectedCutoff);
  
  let rejectedCleaned = 0;
  for (const file of rejectedFiles) {
    try {
      await storageAdapter.delete(file.storage_key);
      db.prepare('UPDATE evidence_files SET deleted_at = ? WHERE id = ?').run(Date.now(), file.id);
      rejectedCleaned++;
    } catch (err) {
      console.error('Cleanup rejected file error:', err.message);
    }
  }

  // Cleanup soft-deleted evidence yang sudah lebih dari 30 hari
  const deletedCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const deletedFiles = db.prepare('SELECT * FROM evidence_files WHERE deleted_at IS NOT NULL AND deleted_at < ?').all(deletedCutoff);
  
  let deletedCleaned = 0;
  for (const file of deletedFiles) {
    try {
      await storageAdapter.delete(file.storage_key);
      db.prepare('DELETE FROM evidence_files WHERE id = ?').run(file.id);
      deletedCleaned++;
    } catch (err) {
      console.error('Cleanup deleted file error:', err.message);
    }
  }

  // Cleanup pending files yang sudah lebih dari 24 jam (stuck)
  const pendingCutoff = Date.now() - (24 * 60 * 60 * 1000);
  const pendingFiles = db.prepare("SELECT * FROM evidence_files WHERE scan_status = 'pending' AND uploaded_at < ?").all(pendingCutoff);
  
  let pendingCleaned = 0;
  for (const file of pendingFiles) {
    try {
      // Auto-reject stuck files
      updateScanStatus.run('rejected', 'Timeout: scan tidak selesai dalam 24 jam', file.id);
      await storageAdapter.delete(file.storage_key);
      pendingCleaned++;
    } catch (err) {
      console.error('Cleanup pending file error:', err.message);
    }
  }

  return {
    orphanFiles: orphanResult.cleaned || 0,
    tempFiles: tempResult.cleaned || 0,
    rejectedFiles: rejectedCleaned,
    deletedFiles: deletedCleaned,
    pendingFiles: pendingCleaned
  };
}

/**
 * Dapatkan statistik evidence
 */
async function getEvidenceStats() {
  const storageStats = await storageAdapter.getStats();
  
  const dbStats = {
    total: db.prepare('SELECT COUNT(*) as count FROM evidence_files').get().count,
    pending: db.prepare("SELECT COUNT(*) as count FROM evidence_files WHERE scan_status = 'pending'").get().count,
    clean: db.prepare("SELECT COUNT(*) as count FROM evidence_files WHERE scan_status = 'clean'").get().count,
    rejected: db.prepare("SELECT COUNT(*) as count FROM evidence_files WHERE scan_status = 'rejected'").get().count,
    deleted: db.prepare('SELECT COUNT(*) as count FROM evidence_files WHERE deleted_at IS NOT NULL').get().count
  };

  return {
    storage: storageStats,
    database: dbStats
  };
}

function getStorageAdapterRef() {
  return storageAdapter;
}

module.exports = {
  uploadEvidence,
  scanEvidence,
  getStorageAdapterRef,
  downloadEvidence,
  deleteEvidence,
  getEvidenceByReport,
  cleanupEvidenceFiles,
  getEvidenceStats,
  storageAdapter,
  purgeEvidence,
  UPLOAD_LIMITS,
  ALLOWED_MIME_TYPES
};
