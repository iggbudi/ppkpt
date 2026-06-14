const fs = require('fs');
const path = require('path');
const db = require('./db');
const { dbPath } = require('./db');
const { circuitBreaker } = require('./mimoCircuitBreaker');

function getDatabaseSizeBytes() {
  if (!dbPath || dbPath === ':memory:') return 0;
  try {
    return fs.statSync(dbPath).size;
  } catch {
    return null;
  }
}

function getDiskStats(targetPath) {
  try {
    const { statfsSync } = require('node:fs');
    const stats = statfsSync(targetPath);
    const freeBytes = Number(stats.bfree) * Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    return {
      freeBytes,
      totalBytes,
      healthy: freeBytes > 100 * 1024 * 1024
    };
  } catch {
    return { freeBytes: null, totalBytes: null, healthy: true };
  }
}

function getQuarantineCount() {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM evidence_files
      WHERE scan_status IN ('rejected', 'pending', 'error')
    `).get();
    return row?.count || 0;
  } catch {
    return 0;
  }
}

function getOperationalHealth() {
  let databaseHealthy = true;
  try {
    db.prepare('SELECT 1').get();
  } catch {
    databaseHealthy = false;
  }

  const dbSizeBytes = getDatabaseSizeBytes();
  const diskPath = dbPath && dbPath !== ':memory:' ? path.dirname(dbPath) : process.cwd();
  const disk = getDiskStats(diskPath);
  const quarantineCount = getQuarantineCount();
  const reportCount = db.prepare('SELECT COUNT(*) as count FROM reports WHERE deleted_at IS NULL').get()?.count || 0;
  const mimo = circuitBreaker.getStatus();

  const healthy = databaseHealthy
    && disk.healthy
    && quarantineCount < 200
    && !mimo.open;

  return {
    ok: healthy,
    service: 'safesphere-chat',
    model: process.env.MIMO_MODEL || 'mimo-v2.5',
    environment: process.env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      database: {
        healthy: databaseHealthy,
        sizeBytes: dbSizeBytes
      },
      disk: {
        healthy: disk.healthy,
        freeBytes: disk.freeBytes,
        totalBytes: disk.totalBytes,
        path: diskPath
      },
      quarantine: {
        count: quarantineCount,
        healthy: quarantineCount < 200
      },
      reports: {
        count: reportCount
      },
      mimo: {
        healthy: !mimo.open,
        ...mimo
      }
    },
    timestamp: Date.now()
  };
}

module.exports = {
  getOperationalHealth,
  getDatabaseSizeBytes,
  getDiskStats,
  getQuarantineCount
};