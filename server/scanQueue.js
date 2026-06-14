const db = require('./db');

let queueTimer = null;

function startScanQueue(scanHandler, options = {}) {
  if (queueTimer || process.env.NODE_ENV === 'test') return;

  const intervalMs = Number(process.env.EVIDENCE_SCAN_QUEUE_INTERVAL_MS || 30_000);
  const batchSize = Number(process.env.EVIDENCE_SCAN_QUEUE_BATCH || 10);

  queueTimer = setInterval(async () => {
    try {
      const pending = db.prepare(`
        SELECT id FROM evidence_files
        WHERE scan_status = 'pending'
        ORDER BY uploaded_at ASC
        LIMIT ?
      `).all(batchSize);

      for (const row of pending) {
        await scanHandler(row.id);
      }
    } catch (err) {
      console.error('Evidence scan queue error:', err.message);
    }
  }, intervalMs);

  queueTimer.unref();
}

function stopScanQueue() {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
  }
}

function getPendingScanCount() {
  return db.prepare("SELECT COUNT(*) as count FROM evidence_files WHERE scan_status = 'pending'").get().count;
}

module.exports = {
  startScanQueue,
  stopScanQueue,
  getPendingScanCount
};