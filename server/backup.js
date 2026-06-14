/**
 * Backup & Restore Module
 * Menangani backup terenkripsi dan restore dengan validasi
 */

const crypto = require('crypto');
const db = require('./db');
const { storageAdapter } = require('./evidence');

const ALGORITHM = 'aes-256-gcm';
const BACKUP_VERSION = '1.0.0';

function generateBackupChecksum(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function createBackup(options = {}) {
  const { includeAudit = true, includeEvidence = false, encrypt = false, encryptionKey = null } = options;
  // Artifact file evidence ditangani terpisah via evidenceArtifacts.js

  // Ambil data
  const reports = db.prepare('SELECT * FROM reports WHERE deleted_at IS NULL').all();
  const auditLog = includeAudit ? db.prepare('SELECT * FROM audit_log').all() : [];
  const migrations = db.prepare('SELECT * FROM migrations ORDER BY id').all();
  const evidenceFiles = includeEvidence ? db.prepare('SELECT * FROM evidence_files WHERE deleted_at IS NULL').all() : [];
  const legalHolds = db.prepare('SELECT * FROM legal_holds').all();
  const retentionPolicies = db.prepare('SELECT * FROM retention_policy').all();

  const backupData = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    exportedAt: Date.now(),
    counts: {
      reports: reports.length,
      auditLog: auditLog.length,
      migrations: migrations.length,
      evidenceFiles: evidenceFiles.length,
      legalHolds: legalHolds.length
    },
    data: {
      reports,
      auditLog,
      migrations,
      evidenceFiles,
      legalHolds,
      retentionPolicies
    }
  };

  // Generate checksum sebelum enkripsi
  backupData.checksum = generateBackupChecksum(backupData.data);

  if (encrypt && !encryptionKey) throw new Error('Encryption key diperlukan');
  if (encrypt) {
    // Enkripsi backup
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(encryptionKey, salt, 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(JSON.stringify(backupData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encrypted: true,
      version: BACKUP_VERSION,
      createdAt: backupData.createdAt,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
      checksum: backupData.checksum,
      counts: backupData.counts
    };
  }

  return backupData;
}

function validateBackup(backupData) {
  const errors = [];

  // Cek versi
  if (!backupData.version) {
    errors.push('Backup tidak memiliki versi');
  }

  // Cek checksum
  if (backupData.checksum) {
    const calculatedChecksum = generateBackupChecksum(backupData.data);
    if (calculatedChecksum !== backupData.checksum) {
      errors.push('Checksum tidak cocok - data mungkin corrupt');
    }
  }

  // Cek struktur data
  if (!backupData.data) {
    errors.push('Backup tidak memiliki data');
    return { valid: false, errors };
  }

  if (!Array.isArray(backupData.data.reports)) {
    errors.push('Data reports tidak valid');
  }

  // Validasi setiap report
  if (backupData.data.reports) {
    const validCategories = ['Verbal', 'Sosial', 'Cyberbullying', 'Fisik', 'Seksual'];
    const validStatuses = ['Baru Masuk', 'Direview', 'Diproses', 'Selesai'];
    const validUrgencies = ['Rendah', 'Sedang', 'Tinggi'];

    for (let i = 0; i < backupData.data.reports.length; i++) {
      const report = backupData.data.reports[i];

      if (!report.id || typeof report.id !== 'string') {
        errors.push(`Report[${i}]: id tidak valid`);
      }
      if (!report.category || !validCategories.includes(report.category)) {
        errors.push(`Report[${i}]: category tidak valid`);
      }
      if (!report.urgency || !validUrgencies.includes(report.urgency)) {
        errors.push(`Report[${i}]: urgency tidak valid`);
      }
      if (report.status && !validStatuses.includes(report.status)) {
        errors.push(`Report[${i}]: status tidak valid`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: backupData.counts
  };
}

function restoreFromBackup(backupData, options = {}) {
  const { decrypt = false, decryptionKey = null, dryRun = false } = options;

  // Dekripsi jika diperlukan
  if (backupData.encrypted && (!decrypt || !decryptionKey)) {
    return { success: false, error: 'Decryption key diperlukan' };
  }
  if (backupData.encrypted && decrypt && decryptionKey) {
    try {
      const key = crypto.scryptSync(decryptionKey, Buffer.from(backupData.salt, 'hex'), 32);
      const iv = Buffer.from(backupData.iv, 'hex');
      const authTag = Buffer.from(backupData.authTag, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(backupData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      backupData = JSON.parse(decrypted);
    } catch (err) {
      return { success: false, error: 'Dekripsi gagal: ' + err.message };
    }
  }

  // Validasi backup
  const validation = validateBackup(backupData);
  if (!validation.valid) {
    return { success: false, error: 'Backup tidak valid', errors: validation.errors };
  }
  if (backupData.data.evidenceFiles && backupData.data.evidenceFiles.length > 0 && !backupData.evidenceArtifacts) {
    return { success: false, error: 'Restore evidence memerlukan evidenceArtifacts pada backup' };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: 'Validasi berhasil, restore tidak dijalankan (dry run)',
      counts: backupData.counts
    };
  }

  // Restore data dengan transaction
  const restoreTransaction = db.transaction(() => {
    // Backup data yang ada sebelum restore
    const existingReports = db.prepare('SELECT COUNT(*) as count FROM reports').get();
    const existingAudit = db.prepare('SELECT COUNT(*) as count FROM audit_log').get();
    const existingEvidence = db.prepare('SELECT COUNT(*) as count FROM evidence_files').get();

    // Hapus data lama
    db.prepare('DELETE FROM reports').run();
    db.prepare('DELETE FROM audit_log').run();
    db.prepare('DELETE FROM evidence_files').run();
    db.prepare('DELETE FROM legal_holds').run();

    // Insert reports
    const insertReport = db.prepare(`
      INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous, deleted_at, legal_hold, deletion_requested_at, deletion_requested_by, deletion_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of backupData.data.reports) {
      insertReport.run(
        r.id, r.category, r.location, r.urgency, r.incidentDate,
        r.status || 'Baru Masuk', r.description, r.evidence || 'Tidak ada lampiran',
        r.appointment || 'Menunggu proses peninjauan.', r.createdAt,
        r.authorId || null, r.authorName || 'Anonim', r.isAnonymous ? 1 : 0,
        r.deleted_at || null, r.legal_hold || 0,
        r.deletion_requested_at || null, r.deletion_requested_by || null, r.deletion_reason || null
      );
    }

    // Insert audit log
    const insertAudit = db.prepare(`
      INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const a of (backupData.data.auditLog || [])) {
      insertAudit.run(a.timestamp, a.userId, a.action, a.targetId, a.ip, a.details);
    }

    // Insert evidence files metadata (tanpa file)
    const insertEvidence = db.prepare(`
      INSERT OR REPLACE INTO evidence_files (id, report_id, storage_key, original_name, safe_name, detected_mime, size_bytes, sha256, scan_status, scan_result, uploaded_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const e of (backupData.data.evidenceFiles || [])) {
      insertEvidence.run(
        e.id, e.report_id, e.storage_key, e.original_name, e.safe_name,
        e.detected_mime, e.size_bytes, e.sha256, e.scan_status, e.scan_result,
        e.uploaded_at, e.deleted_at || null
      );
    }

    // Insert legal holds
    const insertLegalHold = db.prepare(`
      INSERT OR REPLACE INTO legal_holds (id, report_id, reason, placed_by, placed_at, released_by, released_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const lh of (backupData.data.legalHolds || [])) {
      insertLegalHold.run(
        lh.id, lh.report_id, lh.reason, lh.placed_by, lh.placed_at,
        lh.released_by || null, lh.released_at || null, lh.active
      );
    }

    // Insert retention policies
    const insertRetentionPolicy = db.prepare(`
      INSERT OR REPLACE INTO retention_policy (id, table_name, days_to_keep, date_column, status_column, status_value, last_cleanup, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rp of (backupData.data.retentionPolicies || [])) {
      insertRetentionPolicy.run(
        rp.id, rp.table_name, rp.days_to_keep, rp.date_column,
        rp.status_column || null, rp.status_value || null,
        rp.last_cleanup || null, rp.created_at
      );
    }

    return {
      restoredReports: backupData.data.reports.length,
      restoredAudit: (backupData.data.auditLog || []).length,
      restoredEvidence: (backupData.data.evidenceFiles || []).length,
      restoredLegalHolds: (backupData.data.legalHolds || []).length,
      previousReports: existingReports.count,
      previousAudit: existingAudit.count,
      previousEvidence: existingEvidence.count
    };
  });

  try {
    const result = restoreTransaction();
    return {
      success: true,
      message: 'Restore berhasil',
      ...result
    };
  } catch (err) {
    return { success: false, error: 'Restore gagal: ' + err.message };
  }
}

function scheduleBackup(options = {}) {
  const { intervalHours = 24, maxBackups = 7 } = options;

  // Simpan backup ke memory (dalam production, simpan ke file/cloud)
  const backupHistory = [];

  const timer = setInterval(() => {
    try {
      const backup = createBackup({ includeAudit: true });
      backupHistory.push({
        timestamp: Date.now(),
        counts: backup.counts,
        checksum: backup.checksum
      });

      // Hapus backup lama
      while (backupHistory.length > maxBackups) {
        backupHistory.shift();
      }

      console.log(`Backup otomatis: ${backup.counts.reports} reports, ${backup.counts.auditLog} audit logs`);
    } catch (err) {
      console.error('Backup otomatis gagal:', err.message);
    }
  }, intervalHours * 60 * 60 * 1000);
  timer.unref();

  return backupHistory;
}

module.exports = {
  createBackup,
  validateBackup,
  restoreFromBackup,
  scheduleBackup,
  generateBackupChecksum
};
