/**
 * Deletion Workflow & Legal Hold Module
 * Menangani soft delete, legal hold, dan deletion request
 */

const db = require('./db');

function requestDeletion(reportId, userId, reason) {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  // Cek legal hold
  const legalHold = db.prepare('SELECT * FROM legal_holds WHERE report_id = ? AND active = 1').get(reportId);
  if (legalHold) {
    return { 
      success: false, 
      error: 'Laporan memiliki legal hold aktif',
      holdReason: legalHold.reason
    };
  }

  // Cek apakah sudah ada request
  if (report.deletion_requested_at) {
    return { 
      success: false, 
      error: 'Deletion sudah diminta sebelumnya',
      requestedAt: new Date(report.deletion_requested_at).toISOString()
    };
  }

  db.prepare(`
    UPDATE reports 
    SET deletion_requested_at = ?, deletion_requested_by = ?, deletion_reason = ?
    WHERE id = ?
  `).run(Date.now(), userId, reason, reportId);

  return { 
    success: true, 
    message: 'Deletion request berhasil dibuat. Menunggu approval admin.' 
  };
}

function approveDeletion(reportId, adminId, approvalReason) {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  if (!report.deletion_requested_at) {
    return { success: false, error: 'Tidak ada deletion request untuk laporan ini' };
  }
  const legalHold = db.prepare('SELECT 1 FROM legal_holds WHERE report_id = ? AND active = 1').get(reportId);
  if (legalHold) return { success: false, error: 'Laporan memiliki legal hold aktif' };

  // Soft delete
  db.prepare(`
    UPDATE reports 
    SET deleted_at = ?
    WHERE id = ?
  `).run(Date.now(), reportId);

  // Catat di audit log
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertAudit.run(Date.now(), adminId, 'report.delete_approved', reportId, null, JSON.stringify({
    reason: approvalReason,
    originalReason: report.deletion_reason,
    requestedBy: report.deletion_requested_by,
    requestedAt: report.deletion_requested_at
  }));

  return { 
    success: true, 
    message: 'Laporan berhasil dihapus (soft delete)' 
  };
}

function rejectDeletion(reportId, adminId, rejectionReason) {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  // Reset deletion request
  db.prepare(`
    UPDATE reports 
    SET deletion_requested_at = NULL, deletion_requested_by = NULL, deletion_reason = NULL
    WHERE id = ?
  `).run(reportId);

  // Catat di audit log
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertAudit.run(Date.now(), adminId, 'report.delete_rejected', reportId, null, JSON.stringify({
    reason: rejectionReason,
    originalRequest: {
      reason: report.deletion_reason,
      requestedBy: report.deletion_requested_by,
      requestedAt: report.deletion_requested_at
    }
  }));

  return { 
    success: true, 
    message: 'Deletion request ditolak' 
  };
}

function placeLegalHold(reportId, adminId, reason) {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  // Cek apakah sudah ada legal hold aktif
  const existingHold = db.prepare('SELECT * FROM legal_holds WHERE report_id = ? AND active = 1').get(reportId);
  if (existingHold) {
    return { success: false, error: 'Laporan sudah memiliki legal hold aktif' };
  }

  // Buat legal hold
  db.prepare(`
    INSERT INTO legal_holds (report_id, reason, placed_by, placed_at, active)
    VALUES (?, ?, ?, ?, 1)
  `).run(reportId, reason, adminId, Date.now());

  // Update report
  db.prepare('UPDATE reports SET legal_hold = 1 WHERE id = ?').run(reportId);

  // Catat di audit log
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertAudit.run(Date.now(), adminId, 'legal_hold.placed', reportId, null, JSON.stringify({ reason }));

  return { 
    success: true, 
    message: 'Legal hold berhasil dipasang' 
  };
}

function releaseLegalHold(reportId, adminId, reason) {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
  
  if (!report) {
    return { success: false, error: 'Laporan tidak ditemukan' };
  }

  // Update legal hold
  db.prepare(`
    UPDATE legal_holds 
    SET released_by = ?, released_at = ?, active = 0
    WHERE report_id = ? AND active = 1
  `).run(adminId, Date.now(), reportId);

  // Update report
  db.prepare('UPDATE reports SET legal_hold = 0 WHERE id = ?').run(reportId);

  // Catat di audit log
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  insertAudit.run(Date.now(), adminId, 'legal_hold.released', reportId, null, JSON.stringify({ reason }));

  return { 
    success: true, 
    message: 'Legal hold berhasil dilepas' 
  };
}

function getDeletedReports() {
  return db.prepare(`
    SELECT r.*, 
           lh.reason as legal_hold_reason,
           lh.placed_at as legal_hold_placed_at
    FROM reports r
    LEFT JOIN legal_holds lh ON r.id = lh.report_id AND lh.active = 1
    WHERE r.deleted_at IS NOT NULL
    ORDER BY r.deleted_at DESC
  `).all();
}

function getPendingDeletions() {
  return db.prepare(`
    SELECT r.*
    FROM reports r
    WHERE r.deletion_requested_at IS NOT NULL AND r.deleted_at IS NULL
    ORDER BY r.deletion_requested_at ASC
  `).all();
}

function getLegalHolds(activeOnly = true) {
  const query = activeOnly
    ? 'SELECT lh.*, r.category, r.location FROM legal_holds lh JOIN reports r ON lh.report_id = r.id WHERE lh.active = 1 ORDER BY lh.placed_at DESC'
    : 'SELECT lh.*, r.category, r.location FROM legal_holds lh JOIN reports r ON lh.report_id = r.id ORDER BY lh.placed_at DESC';
  
  return db.prepare(query).all();
}

module.exports = {
  requestDeletion,
  approveDeletion,
  rejectDeletion,
  placeLegalHold,
  releaseLegalHold,
  getDeletedReports,
  getPendingDeletions,
  getLegalHolds
};
