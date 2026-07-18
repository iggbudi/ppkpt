const crypto = require('crypto');
const fs = require('fs');
const { z } = require('zod');
const express = require('express');
const { pipeline } = require('stream/promises');
const db = require('./db');
const { reportRateLimiter } = require('./rateLimiter');
const { createBackup, restoreFromBackup, validateBackup } = require('./backup');
const { requestDeletion, approveDeletion, rejectDeletion, placeLegalHold, releaseLegalHold, getPendingDeletions, getLegalHolds } = require('./deletion');
const { uploadEvidence, scanEvidence, downloadEvidence, deleteEvidence, purgeEvidence, getEvidenceByReport, cleanupEvidenceFiles, getEvidenceStats, UPLOAD_LIMITS, ALLOWED_MIME_TYPES } = require('./evidence');
const { handleUpload, validateUploadedFile, calculateFileSHA256, moveToQuarantine, cleanupRequestFiles } = require('./uploadMiddleware');
const { isEvidenceUploadsEnabled } = require('./evidenceConfig');
const { backupEvidenceArtifacts, restoreEvidenceArtifacts } = require('./evidenceArtifacts');

const NODE_ENV = process.env.NODE_ENV;
const EVIDENCE_UPLOADS_ENABLED = isEvidenceUploadsEnabled(NODE_ENV);

const reportSchema = z.object({
  category: z.enum(['Verbal', 'Sosial', 'Cyberbullying', 'Fisik', 'Seksual']),
  location: z.string().min(1).max(500),
  urgency: z.enum(['Rendah', 'Sedang', 'Tinggi']),
  incidentDate: z.string().min(1).refine((val) => {
    // Validasi format ISO date (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(val)) return false;
    const date = new Date(val + 'T00:00:00Z');
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === val && date <= new Date();
  }, { message: 'Tanggal harus valid, format YYYY-MM-DD, dan tidak boleh di masa depan' }),
  description: z.string().min(1).max(5000),
  evidence: z.string().max(200).optional(),
  isAnonymous: z.preprocess(value => value === 'true' ? true : value === 'false' ? false : value, z.boolean().optional())
});

// State machine untuk status transitions
const VALID_STATUS_TRANSITIONS = {
  'Baru Masuk': ['Direview'],
  'Direview': ['Diproses', 'Baru Masuk'],
  'Diproses': ['Selesai', 'Direview'],
  'Selesai': [] // Final state, tidak bisa diubah
};

function generateId() {
  return 'SSF-' + crypto.randomUUID();
}

// Mapper: konversi SQLite integer ke boolean
function mapReportFromDb(report) {
  if (!report) return null;
  return {
    ...report,
    isAnonymous: report.isAnonymous === 1
  };
}

function mapReportsFromDb(reports) {
  return reports.map(mapReportFromDb);
}

function syncReportEvidenceSummary(reportId) {
  const files = db.prepare(
    'SELECT safe_name FROM evidence_files WHERE report_id = ? AND deleted_at IS NULL ORDER BY uploaded_at'
  ).all(reportId);
  const summary = files.length > 0
    ? files.map((file) => file.safe_name).join(', ')
    : 'Tidak ada lampiran';
  db.prepare('UPDATE reports SET evidence = ? WHERE id = ?').run(summary, reportId);
  return summary;
}

function setupReportRoutes(app) {
  const insertReport = db.prepare('INSERT INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const selectAllReports = db.prepare('SELECT * FROM reports WHERE deleted_at IS NULL');
  const selectReportById = db.prepare('SELECT * FROM reports WHERE id = ? AND deleted_at IS NULL');
  const selectReportsByAuthor = db.prepare('SELECT * FROM reports WHERE authorId = ? AND deleted_at IS NULL');
  const updateReportStatus = db.prepare('UPDATE reports SET status = ?, appointment = ? WHERE id = ?');
  const deleteAllReports = db.prepare('DELETE FROM reports');
  const countReports = db.prepare('SELECT COUNT(*) as count FROM reports');
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  const selectAllAudit = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC');

  function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  }

  // Middleware: tolak operasi destruktif di production
  function requireDevOrTest(req, res, next) {
    if (NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Endpoint ini tidak tersedia di production' });
    }
    next();
  }

  app.post('/api/reports', reportRateLimiter.middleware(), handleUpload, async (req, res) => {
    if (!EVIDENCE_UPLOADS_ENABLED && req.files && req.files.length > 0) {
      cleanupRequestFiles(req);
      return res.status(503).json({ error: 'Unggah bukti belum tersedia pada environment ini' });
    }
    let parsed;
    try {
      parsed = reportSchema.parse(req.body);
    } catch (err) {
      // Cleanup temp files jika validasi gagal
      cleanupRequestFiles(req);
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }

    const { category, location, urgency, incidentDate, description, evidence, isAnonymous } = parsed;
    const user = req.session.user || null;
    const isAnon = isAnonymous !== false || !user;
    const authorIdVal = isAnon ? null : user.id;
    const authorNameVal = isAnon ? 'Anonim' : (isAnonymous !== false ? user.name.charAt(0).toUpperCase() + '***' : user.name);

    const reportId = generateId();
    const uploadedEvidence = [];

    try {
      const validatedFiles = [];
      for (const file of (req.files || [])) {
        const validation = await validateUploadedFile(file);
        if (!validation.valid) {
          throw new Error(`${file.originalname}: ${validation.errors.join(', ')}`);
        }
        validatedFiles.push({ file, validation });
      }

      insertReport.run(reportId, category, location, urgency, incidentDate, 'Baru Masuk', description, evidence || 'Tidak ada lampiran', 'Menunggu proses peninjauan awal dari tim Satgas.', Date.now(), authorIdVal, authorNameVal, isAnon ? 1 : 0);

      insertAudit.run(Date.now(), isAnon ? null : user.id, 'report.create', reportId, isAnon ? null : req.ip, JSON.stringify({ category, urgency, isAnonymous: isAnon }));

      // Proses file uploads jika ada
      if (validatedFiles.length > 0) {
        for (const { file, validation } of validatedFiles) {
          try {
            // Baca file buffer
            const fileBuffer = fs.readFileSync(file.path);

            // Upload ke evidence system
            const result = await uploadEvidence(
              reportId,
              fileBuffer,
              file.originalname,
              validation.detectedMime,
              user ? user.id : null,
              isAnon
            );

            if (result.success) {
              uploadedEvidence.push(result.evidence);
            } else {
              throw new Error(`${file.originalname}: ${result.error}`);
            }
          } finally {
            // Cleanup temp file
            try {
              if (file.path && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            } catch {}
          }
        }
      }

      if (uploadedEvidence.length > 0) {
        syncReportEvidenceSummary(reportId);
      }

      const report = selectReportById.get(reportId);
      res.json({ 
        report: mapReportFromDb(report),
        evidence: uploadedEvidence
      });
    } catch (err) {
      for (const item of uploadedEvidence) await purgeEvidence(item.id);
      try {
        db.prepare('DELETE FROM reports WHERE id = ?').run(reportId);
      } catch {}
      cleanupRequestFiles(req);
      res.status(400).json({ error: err.message || 'Gagal membuat laporan' });
    }
  });

  app.get('/api/reports', requireAuth, (req, res) => {
    const user = req.session.user;
    const reports = user.role === 'admin' ? selectAllReports.all() : selectReportsByAuthor.all(user.id);
    res.json({ reports: mapReportsFromDb(reports) });
  });

  app.get('/api/reports/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const report = selectReportById.get(req.params.id);

    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

    if (user.role !== 'admin' && report.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    insertAudit.run(Date.now(), user.id, 'report.view', report.id, req.ip, '{}');

    res.json({ report: mapReportFromDb(report) });
  });

  app.patch('/api/reports/:id/status', requireAuth, requireAdmin, (req, res) => {
    const { status, appointment } = req.body;
    const report = selectReportById.get(req.params.id);

    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

    // Validasi status exists
    const validStatuses = ['Baru Masuk', 'Direview', 'Diproses', 'Selesai'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    // Validasi state machine - cek apakah transisi diizinkan
    const allowedTransitions = VALID_STATUS_TRANSITIONS[report.status] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({ 
        error: `Transisi dari '${report.status}' ke '${status}' tidak diizinkan`,
        allowedTransitions 
      });
    }

    // Validasi appointment jika ada
    if (appointment && (typeof appointment !== 'string' || appointment.length > 1000)) {
      return res.status(400).json({ error: 'Appointment tidak valid (maks 1000 karakter)' });
    }

    const oldStatus = report.status;
    updateReportStatus.run(status, appointment || report.appointment, report.id);

    insertAudit.run(Date.now(), req.session.user.id, 'report.status_update', report.id, req.ip, JSON.stringify({ oldStatus, newStatus: status }));

    res.json({ report: mapReportFromDb(selectReportById.get(report.id)) });
  });

  // Endpoint seed hanya untuk development/test
  app.post('/api/reports/seed', requireDevOrTest, requireAuth, requireAdmin, (req, res) => {
    const dummies = [
      { id: 'SSF-2026-1001', category: 'Cyberbullying', location: 'Grup WA Kelas', urgency: 'Tinggi', incidentDate: '2026-06-02', status: 'Baru Masuk', description: 'Saya diejek dan foto saya disebar di grup tanpa izin.', evidence: 'demo-bukti.png', appointment: 'Menunggu proses peninjauan awal.', createdAt: Date.now() - 20000, authorId: null, authorName: 'Anonim', isAnonymous: 1 },
      { id: 'SSF-2026-1002', category: 'Verbal', location: 'Ruang Kelas', urgency: 'Sedang', incidentDate: '2026-06-05', status: 'Direview', description: 'Saya sering dihina soal penampilan saat presentasi.', evidence: 'Tidak ada lampiran', appointment: 'Sedang dalam peninjauan bukti oleh Admin.', createdAt: Date.now() - 15000, authorId: null, authorName: 'Anonim', isAnonymous: 1 },
      { id: 'SSF-2026-1003', category: 'Sosial', location: 'Lingkungan Kampus', urgency: 'Rendah', incidentDate: '2026-06-06', status: 'Selesai', description: 'Teman saya dikucilkan dari kelompok tugas.', evidence: 'Tidak ada lampiran', appointment: 'Telah dilakukan mediasi dan edukasi pencegahan.', createdAt: Date.now() - 10000, authorId: null, authorName: 'Anonim', isAnonymous: 1 },
      { id: 'SSF-2026-1004', category: 'Fisik', location: 'Parkiran Kampus', urgency: 'Tinggi', incidentDate: '2026-06-08', status: 'Diproses', description: 'Ada tindakan represif dan ancaman jika saya melapor.', evidence: 'rekaman_suara.mp3', appointment: 'Jadwal Konseling: Kasus dialihkan ke Satgas PPKS.', createdAt: Date.now() - 5000, authorId: null, authorName: 'Anonim', isAnonymous: 1 }
    ];

    const insertMany = db.transaction((items) => {
      deleteAllReports.run();
      for (const d of items) {
        insertReport.run(d.id, d.category, d.location, d.urgency, d.incidentDate, d.status, d.description, d.evidence, d.appointment, d.createdAt, d.authorId, d.authorName, d.isAnonymous);
      }
    });
    insertMany(dummies);

    insertAudit.run(Date.now(), req.session.user.id, 'reports.seed', null, req.ip, JSON.stringify({ count: dummies.length }));

    res.json({ ok: true, count: dummies.length });
  });

  // Endpoint clear hanya untuk development/test
  app.delete('/api/reports', requireDevOrTest, requireAuth, requireAdmin, (req, res) => {
    const { count } = countReports.get();
    deleteAllReports.run();

    insertAudit.run(Date.now(), req.session.user.id, 'reports.clear', null, req.ip, JSON.stringify({ cleared: count }));

    res.json({ ok: true, cleared: count });
  });

  app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
    const log = selectAllAudit.all().map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : {}
    }));
    res.json({ log });
  });

  // Export hanya untuk development/test
  app.get('/api/export', requireDevOrTest, requireAuth, requireAdmin, (req, res) => {
    const reports = db.prepare('SELECT * FROM reports').all();
    const auditLog = db.prepare('SELECT * FROM audit_log').all();

    // Audit logging untuk export
    insertAudit.run(Date.now(), req.session.user.id, 'reports.export', null, req.ip, JSON.stringify({ 
      reportCount: reports.length, 
      auditCount: auditLog.length 
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=safesphere-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    res.json({ reports: mapReportsFromDb(reports), auditLog, exportedAt: Date.now() });
  });

  // Import hanya untuk development/test
  app.post('/api/import', requireDevOrTest, requireAuth, requireAdmin, express.json({ limit: '10mb' }), (req, res) => {
    const { reports: incomingReports } = req.body;

    if (!Array.isArray(incomingReports)) {
      return res.status(400).json({ error: 'Invalid backup format: reports must be an array' });
    }

    // Validasi batas jumlah record
    if (incomingReports.length > 10000) {
      return res.status(400).json({ error: 'Terlalu banyak laporan (maks 10000)' });
    }

    // Validasi schema untuk setiap report
    const validStatuses = ['Baru Masuk', 'Direview', 'Diproses', 'Selesai'];
    const validCategories = ['Verbal', 'Sosial', 'Cyberbullying', 'Fisik', 'Seksual'];
    const validUrgencies = ['Rendah', 'Sedang', 'Tinggi'];

    for (let i = 0; i < incomingReports.length; i++) {
      const r = incomingReports[i];
      
      if (!r.id || typeof r.id !== 'string') {
        return res.status(400).json({ error: `Report[${i}]: id tidak valid` });
      }
      if (!r.category || !validCategories.includes(r.category)) {
        return res.status(400).json({ error: `Report[${i}]: category tidak valid` });
      }
      if (!r.location || typeof r.location !== 'string' || r.location.length > 500) {
        return res.status(400).json({ error: `Report[${i}]: location tidak valid` });
      }
      if (!r.urgency || !validUrgencies.includes(r.urgency)) {
        return res.status(400).json({ error: `Report[${i}]: urgency tidak valid` });
      }
      if (!r.incidentDate || typeof r.incidentDate !== 'string') {
        return res.status(400).json({ error: `Report[${i}]: incidentDate tidak valid` });
      }
      if (!r.description || typeof r.description !== 'string' || r.description.length > 5000) {
        return res.status(400).json({ error: `Report[${i}]: description tidak valid` });
      }
      if (r.status && !validStatuses.includes(r.status)) {
        return res.status(400).json({ error: `Report[${i}]: status tidak valid` });
      }
      if (r.createdAt && (typeof r.createdAt !== 'number' || r.createdAt < 0)) {
        return res.status(400).json({ error: `Report[${i}]: createdAt tidak valid` });
      }
    }

    // Gunakan transaction dengan rollback jika ada error
    const insertMany = db.transaction((items) => {
      for (const r of items) {
        db.prepare(`
          INSERT OR REPLACE INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(r.id, r.category, r.location, r.urgency, r.incidentDate, r.status || 'Baru Masuk', r.description, r.evidence || 'Tidak ada lampiran', r.appointment || 'Menunggu proses peninjauan.', r.createdAt || Date.now(), r.authorId || null, r.authorName || 'Anonim', r.isAnonymous ? 1 : 0);
      }
    });

    try {
      insertMany(incomingReports);

      insertAudit.run(Date.now(), req.session.user.id, 'reports.import', null, req.ip, JSON.stringify({ imported: incomingReports.length }));

      res.json({ ok: true, imported: incomingReports.length });
    } catch (err) {
      res.status(500).json({ error: 'Import gagal: ' + err.message });
    }
  });

  // Backup endpoint (admin only)
  app.get('/api/backup', requireAuth, requireAdmin, async (req, res) => {
    const includeAudit = req.query.includeAudit !== 'false';
    const includeEvidence = req.query.includeEvidence === 'true';
    const encrypt = req.query.encrypt === 'true';
    if (encrypt) return res.status(400).json({ error: 'Gunakan POST /api/backup untuk backup terenkripsi' });
    let backup;
    try {
      backup = createBackup({ includeAudit, includeEvidence });
      if (includeEvidence) {
        const artifacts = await backupEvidenceArtifacts(String(backup.exportedAt));
        backup.evidenceArtifacts = {
          backupId: artifacts.backupId,
          fileCount: artifacts.fileCount,
          manifest: artifacts.manifest
        };
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    insertAudit.run(Date.now(), req.session.user.id, 'backup.create', null, req.ip, JSON.stringify({
      includeAudit,
      includeEvidence,
      encrypted: encrypt,
      counts: backup.counts,
      evidenceArtifacts: backup.evidenceArtifacts?.backupId || null
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=safesphere-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    res.json(backup);
  });

  app.post('/api/backup', requireAuth, requireAdmin, async (req, res) => {
    const { includeAudit = true, includeEvidence = false, encrypt = false, encryptionKey = null } = req.body;
    if (encrypt && !encryptionKey) return res.status(400).json({ error: 'Encryption key diperlukan' });
    let backup;
    try {
      backup = createBackup({ includeAudit, includeEvidence, encrypt, encryptionKey });
      if (includeEvidence) {
        const artifacts = await backupEvidenceArtifacts(String(backup.exportedAt));
        backup.evidenceArtifacts = {
          backupId: artifacts.backupId,
          fileCount: artifacts.fileCount,
          manifest: artifacts.manifest
        };
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    insertAudit.run(Date.now(), req.session.user.id, 'backup.create', null, req.ip, JSON.stringify({ 
      includeAudit, 
      includeEvidence,
      encrypted: encrypt, 
      counts: backup.counts,
      evidenceArtifacts: backup.evidenceArtifacts?.backupId || null
    }));
    res.json(backup);
  });

  // Restore endpoint (admin only)
  app.post('/api/restore', requireAuth, requireAdmin, express.json({ limit: '50mb' }), async (req, res) => {
    const { backup: backupData, dryRun = true, decrypt = false, decryptionKey = null, confirmRestore = false } = req.body;

    if (!backupData) {
      return res.status(400).json({ error: 'Data backup diperlukan' });
    }
    if (!dryRun && !confirmRestore) return res.status(400).json({ error: 'Restore aktual memerlukan confirmRestore=true' });

    let preRestoreSnapshot = null;
    if (!dryRun) {
      try {
        preRestoreSnapshot = createBackup({ includeAudit: true });
      } catch (err) {
        return res.status(500).json({ error: 'Gagal membuat snapshot sebelum restore: ' + err.message });
      }
    }

    const result = restoreFromBackup(backupData, { decrypt, decryptionKey, dryRun });

    if (!result.success) {
      return res.status(400).json({ error: result.error, errors: result.errors });
    }

    if (!dryRun && backupData.evidenceArtifacts?.backupId) {
      try {
        const artifactRestore = await restoreEvidenceArtifacts(backupData.evidenceArtifacts.backupId);
        result.evidenceArtifactsRestored = artifactRestore.restored;
      } catch (err) {
        return res.status(400).json({ error: 'Restore metadata berhasil tetapi artifact evidence gagal: ' + err.message });
      }
    }

    insertAudit.run(Date.now(), req.session.user.id, dryRun ? 'backup.validate' : 'backup.restore', null, req.ip, JSON.stringify({
      dryRun,
      restoredReports: result.restoredReports || 0,
      restoredAudit: result.restoredAudit || 0,
      preRestoreChecksum: preRestoreSnapshot?.checksum || null
    }));

    if (!dryRun && preRestoreSnapshot) {
      result.preRestoreChecksum = preRestoreSnapshot.checksum;
    }

    res.json(result);
  });

  // Deletion request (user can request deletion of their own report)
  app.post('/api/reports/:id/request-deletion', requireAuth, (req, res) => {
    const { reason } = req.body;
    const report = selectReportById.get(req.params.id);

    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

    // User hanya bisa request deletion untuk laporan sendiri
    if (req.session.user.role !== 'admin' && report.authorId !== req.session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = requestDeletion(req.params.id, req.session.user.id, reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    insertAudit.run(Date.now(), req.session.user.id, 'report.deletion_requested', req.params.id, req.ip, JSON.stringify({ reason }));

    res.json(result);
  });

  // Approve deletion (admin only)
  app.post('/api/reports/:id/approve-deletion', requireAuth, requireAdmin, (req, res) => {
    const { reason } = req.body;
    const result = approveDeletion(req.params.id, req.session.user.id, reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  });

  // Reject deletion (admin only)
  app.post('/api/reports/:id/reject-deletion', requireAuth, requireAdmin, (req, res) => {
    const { reason } = req.body;
    const result = rejectDeletion(req.params.id, req.session.user.id, reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  });

  // Get pending deletions (admin only)
  app.get('/api/admin/pending-deletions', requireAuth, requireAdmin, (req, res) => {
    const pendingDeletions = getPendingDeletions();
    res.json({ pendingDeletions });
  });

  // Legal hold endpoints (admin only)
  app.post('/api/reports/:id/legal-hold', requireAuth, requireAdmin, (req, res) => {
    const { reason } = req.body;
    const result = placeLegalHold(req.params.id, req.session.user.id, reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  });

  app.delete('/api/reports/:id/legal-hold', requireAuth, requireAdmin, (req, res) => {
    const { reason } = req.body;
    const result = releaseLegalHold(req.params.id, req.session.user.id, reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  });

  app.get('/api/admin/legal-holds', requireAuth, requireAdmin, (req, res) => {
    const legalHolds = getLegalHolds();
    res.json({ legalHolds });
  });

  // Evidence endpoints
  // Upload evidence untuk laporan (multipart)
  app.post('/api/reports/:id/evidence', requireAuth, handleUpload, async (req, res) => {
    if (!EVIDENCE_UPLOADS_ENABLED) {
      cleanupRequestFiles(req);
      return res.status(503).json({ error: 'Unggah bukti belum tersedia pada environment ini' });
    }
    const reportId = req.params.id;
    const report = selectReportById.get(reportId);

    if (!report) {
      cleanupRequestFiles(req);
      return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    }

    // Cek otorisasi
    if (req.session.user.role !== 'admin' && report.authorId !== req.session.user.id) {
      cleanupRequestFiles(req);
      return res.status(403).json({ error: 'Tidak memiliki akses' });
    }

    // Proses file uploads
    const uploadedEvidence = [];
    const errors = [];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    for (const file of req.files) {
      try {
        // Validasi file
        const validation = await validateUploadedFile(file);
        if (!validation.valid) {
          errors.push({ file: file.originalname, errors: validation.errors });
          continue;
        }

        // Baca file buffer
        const fs = require('fs');
        const fileBuffer = fs.readFileSync(file.path);

        // Upload ke evidence system
        const result = await uploadEvidence(
          reportId,
          fileBuffer,
          file.originalname,
          validation.detectedMime,
          req.session.user.id,
          report.isAnonymous
        );

        if (result.success) {
          uploadedEvidence.push(result.evidence);
        } else {
          errors.push({ file: file.originalname, error: result.error });
        }
      } catch (err) {
        errors.push({ file: file.originalname, error: err.message });
      } finally {
        // Cleanup temp file
        try {
          const fs = require('fs');
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {}
      }
    }

    if (uploadedEvidence.length > 0) {
      syncReportEvidenceSummary(reportId);
    }

    res.json({
      success: uploadedEvidence.length > 0,
      uploaded: uploadedEvidence,
      errors: errors.length > 0 ? errors : undefined
    });
  });

  // Batch upload evidence (multiple files)
  app.post('/api/reports/:id/evidence/batch', requireAuth, handleUpload, async (req, res) => {
    if (!EVIDENCE_UPLOADS_ENABLED) {
      cleanupRequestFiles(req);
      return res.status(503).json({ error: 'Unggah bukti belum tersedia pada environment ini' });
    }
    const reportId = req.params.id;
    const report = selectReportById.get(reportId);

    if (!report) {
      cleanupRequestFiles(req);
      return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    }

    if (req.session.user.role !== 'admin' && report.authorId !== req.session.user.id) {
      cleanupRequestFiles(req);
      return res.status(403).json({ error: 'Tidak memiliki akses' });
    }

    const uploadedEvidence = [];
    const errors = [];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    // Proses semua files dengan transaction-like behavior
    for (const file of req.files) {
      try {
        const validation = await validateUploadedFile(file);
        if (!validation.valid) {
          errors.push({ file: file.originalname, errors: validation.errors });
          continue;
        }

        const fs = require('fs');
        const fileBuffer = fs.readFileSync(file.path);

        const result = await uploadEvidence(
          reportId,
          fileBuffer,
          file.originalname,
          validation.detectedMime,
          req.session.user.id,
          report.isAnonymous
        );

        if (result.success) {
          uploadedEvidence.push(result.evidence);
        } else {
          errors.push({ file: file.originalname, error: result.error });
        }
      } catch (err) {
        errors.push({ file: file.originalname, error: err.message });
      } finally {
        try {
          const fs = require('fs');
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {}
      }
    }

    if (uploadedEvidence.length > 0) {
      syncReportEvidenceSummary(reportId);
    }

    res.json({
      success: uploadedEvidence.length > 0,
      uploaded: uploadedEvidence,
      errors: errors.length > 0 ? errors : undefined
    });
  });

  // Get evidence list untuk laporan
  app.get('/api/reports/:id/evidence', requireAuth, (req, res) => {
    const result = getEvidenceByReport(
      req.params.id,
      req.session.user.id,
      req.session.user.role
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  });

  // Download evidence
  app.get('/api/reports/:reportId/evidence/:fileId/download', requireAuth, async (req, res) => {
    const result = await downloadEvidence(
      req.params.fileId,
      req.session.user.id,
      req.session.user.role
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Set headers untuk download
    res.setHeader('Content-Type', result.metadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.metadata.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      await pipeline(result.stream, res);
    } catch (error) {
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Gagal mengirim file bukti' });
      }
      res.destroy(error);
    }
  });

  // Delete evidence
  app.delete('/api/reports/:reportId/evidence/:fileId', requireAuth, async (req, res) => {
    const result = await deleteEvidence(
      req.params.fileId,
      req.params.reportId,
      req.session.user.id,
      req.session.user.role
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    syncReportEvidenceSummary(req.params.reportId);
    res.json(result);
  });

  // Admin: scan evidence
  app.post('/api/admin/evidence/:fileId/scan', requireAuth, requireAdmin, async (req, res) => {
    const result = await scanEvidence(req.params.fileId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  });

  // Admin: cleanup evidence files
  app.post('/api/admin/evidence/cleanup', requireAuth, requireAdmin, async (req, res) => {
    const result = await cleanupEvidenceFiles();
    res.json({ success: true, ...result });
  });

  // Admin: evidence stats
  app.get('/api/admin/evidence/stats', requireAuth, requireAdmin, async (req, res) => {
    const result = await getEvidenceStats();
    res.json(result);
  });

  // Upload limits info
  app.get('/api/evidence/limits', (req, res) => {
    res.json({
      maxFileSize: UPLOAD_LIMITS.maxFileSize,
      maxTotalSize: UPLOAD_LIMITS.maxTotalSize,
      maxFilesPerReport: UPLOAD_LIMITS.maxFilesPerReport,
      allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES)
    });
  });
}

module.exports = { setupReportRoutes };
