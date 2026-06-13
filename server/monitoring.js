/**
 * Monitoring & Alerting Module
 * Memantau kesehatan evidence system dan mengirim alert
 */

const db = require('./db');
const { EventEmitter } = require('events');

class EvidenceMonitor extends EventEmitter {
  constructor() {
    super();
    this.alerts = [];
    this.metrics = {
      uploads: { total: 0, success: 0, failed: 0 },
      scans: { clean: 0, rejected: 0, pending: 0, error: 0 },
      downloads: { total: 0, authorized: 0, unauthorized: 0 },
      storage: { orphanFiles: 0, tempFiles: 0, totalSize: 0 },
      errors: []
    };
    
    // Thresholds untuk alerting
    this.thresholds = {
      pendingScansMax: 50,
      orphanFilesMax: 100,
      errorRateMax: 0.1, // 10%
      storageSizeMax: 10 * 1024 * 1024 * 1024, // 10GB
      scanTimeoutHours: 24
    };
    
    // Bind event handlers
    this.on('alert', this.handleAlert.bind(this));
  }

  /**
   * Record upload event
   */
  recordUpload(success, metadata = {}) {
    this.metrics.uploads.total++;
    if (success) {
      this.metrics.uploads.success++;
    } else {
      this.metrics.uploads.failed++;
      this.metrics.errors.push({
        type: 'upload',
        timestamp: Date.now(),
        ...metadata
      });
    }

    // Check error rate
    this.checkErrorRate();
  }

  /**
   * Record scan event
   */
  recordScan(status, metadata = {}) {
    if (this.metrics.scans[status] !== undefined) {
      this.metrics.scans[status]++;
    }

    // Check pending scans threshold
    if (this.metrics.scans.pending > this.thresholds.pendingScansMax) {
      this.emit('alert', {
        level: 'warning',
        type: 'pending_scans',
        message: `Pending scans exceed threshold: ${this.metrics.scans.pending}`,
        threshold: this.thresholds.pendingScansMax
      });
    }
  }

  /**
   * Record download event
   */
  recordDownload(authorized, metadata = {}) {
    this.metrics.downloads.total++;
    if (authorized) {
      this.metrics.downloads.authorized++;
    } else {
      this.metrics.downloads.unauthorized++;
      this.emit('alert', {
        level: 'warning',
        type: 'unauthorized_download',
        message: 'Unauthorized download attempt detected',
        ...metadata
      });
    }
  }

  /**
   * Record storage metrics
   */
  recordStorage(stats) {
    this.metrics.storage = { ...this.metrics.storage, ...stats };

    // Check orphan files
    if (stats.orphanFiles > this.thresholds.orphanFilesMax) {
      this.emit('alert', {
        level: 'warning',
        type: 'orphan_files',
        message: `Orphan files exceed threshold: ${stats.orphanFiles}`,
        threshold: this.thresholds.orphanFilesMax
      });
    }

    // Check storage size
    if (stats.totalSize > this.thresholds.storageSizeMax) {
      this.emit('alert', {
        level: 'critical',
        type: 'storage_full',
        message: `Storage size exceeds threshold: ${formatBytes(stats.totalSize)}`,
        threshold: formatBytes(this.thresholds.storageSizeMax)
      });
    }
  }

  /**
   * Check error rate
   */
  checkErrorRate() {
    const { total, failed } = this.metrics.uploads;
    if (total > 100) { // Only check after 100 uploads
      const errorRate = failed / total;
      if (errorRate > this.thresholds.errorRateMax) {
        this.emit('alert', {
          level: 'critical',
          type: 'high_error_rate',
          message: `Upload error rate exceeds threshold: ${(errorRate * 100).toFixed(1)}%`,
          threshold: `${(this.thresholds.errorRateMax * 100).toFixed(1)}%`
        });
      }
    }
  }

  /**
   * Handle alert
   */
  handleAlert(alert) {
    const alertEntry = {
      ...alert,
      timestamp: Date.now(),
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    this.alerts.push(alertEntry);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Log to console
    const logMethod = alert.level === 'critical' ? 'error' : 'warn';
    console[logMethod](`[Evidence Alert] ${alert.type}: ${alert.message}`);

    // Persist to database
    this.persistAlert(alertEntry);

    // Send notification (placeholder)
    this.sendNotification(alertEntry);
  }

  /**
   * Persist alert to database
   */
  persistAlert(alert) {
    try {
      const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
      insertAudit.run(
        alert.timestamp,
        null,
        `alert.${alert.type}`,
        alert.id,
        null,
        JSON.stringify({
          level: alert.level,
          message: alert.message,
          threshold: alert.threshold,
          ...alert
        })
      );
    } catch (err) {
      console.error('Failed to persist alert:', err.message);
    }
  }

  /**
   * Send notification (placeholder)
   * Production: integrasi dengan email, Slack, webhook, dll.
   */
  sendNotification(alert) {
    // Placeholder untuk production notification
    if (alert.level === 'critical') {
      // TODO: Send to admin email/Slack
      // sendEmail({ to: 'admin@example.com', subject: `Critical Alert: ${alert.type}`, body: alert.message });
      // sendSlack({ channel: '#alerts', text: `🚨 ${alert.message}` });
    }
  }

  /**
   * Scan for stuck pending files
   */
  async scanForStuckFiles() {
    const pendingCutoff = Date.now() - (this.thresholds.scanTimeoutHours * 60 * 60 * 1000);
    
    const stuckFiles = db.prepare(`
      SELECT COUNT(*) as count 
      FROM evidence_files 
      WHERE scan_status = 'pending' AND uploaded_at < ?
    `).get(pendingCutoff);

    if (stuckFiles.count > 0) {
      this.emit('alert', {
        level: 'warning',
        type: 'stuck_scans',
        message: `${stuckFiles.count} files stuck in pending for >${this.thresholds.scanTimeoutHours}h`,
        count: stuckFiles.count
      });
    }

    return stuckFiles.count;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      uptime: process.uptime()
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit = 50) {
    return this.alerts.slice(-limit);
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    // Check database connectivity
    let dbHealthy = true;
    try {
      db.prepare('SELECT 1').get();
    } catch {
      dbHealthy = false;
    }

    // Check storage
    let storageHealthy = true;
    let storageError = null;
    try {
      const { storageAdapter } = require('./evidence');
      const stats = await storageAdapter.getStats();
      if (stats.error) {
        storageHealthy = false;
        storageError = stats.error;
      }
    } catch (err) {
      storageHealthy = false;
      storageError = err.message;
    }

    // Count pending scans
    const pendingScans = db.prepare("SELECT COUNT(*) as count FROM evidence_files WHERE scan_status = 'pending'").get();

    // Count recent errors
    const recentErrors = this.metrics.errors.filter(e => 
      Date.now() - e.timestamp < 24 * 60 * 60 * 1000
    ).length;

    const healthy = dbHealthy && storageHealthy && pendingScans.count < this.thresholds.pendingScansMax;

    return {
      healthy,
      status: healthy ? 'ok' : 'degraded',
      checks: {
        database: { healthy: dbHealthy },
        storage: { healthy: storageHealthy, error: storageError },
        pendingScans: { count: pendingScans.count, threshold: this.thresholds.pendingScansMax },
        recentErrors: { count: recentErrors }
      },
      metrics: this.getMetrics(),
      timestamp: Date.now()
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      uploads: { total: 0, success: 0, failed: 0 },
      scans: { clean: 0, rejected: 0, pending: 0, error: 0 },
      downloads: { total: 0, authorized: 0, unauthorized: 0 },
      storage: { orphanFiles: 0, tempFiles: 0, totalSize: 0 },
      errors: []
    };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Singleton instance
const monitor = new EvidenceMonitor();

// Start periodic health checks
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await monitor.scanForStuckFiles();
    } catch (err) {
      console.error('Health check error:', err.message);
    }
  }, 60 * 60 * 1000); // Every hour
}

module.exports = {
  EvidenceMonitor,
  monitor,
  formatBytes
};
