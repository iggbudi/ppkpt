const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_PATH = process.env.DATABASE_PATH;

let dbPath;

if (DATABASE_PATH) {
  // Gunakan path yang ditentukan
  dbPath = DATABASE_PATH;
} else if (NODE_ENV === 'test') {
  // Gunakan in-memory database untuk test
  dbPath = ':memory:';
} else {
  // Default: file database
  dbPath = path.join(__dirname, '..', 'data', 'safesphere.db');
}

// Buat directory jika diperlukan (hanya untuk file database)
if (dbPath !== ':memory:') {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    urgency TEXT NOT NULL,
    incidentDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Baru Masuk',
    description TEXT NOT NULL,
    evidence TEXT,
    appointment TEXT,
    createdAt INTEGER NOT NULL,
    authorId INTEGER,
    authorName TEXT,
    isAnonymous INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    userId INTEGER,
    action TEXT NOT NULL,
    targetId TEXT,
    ip TEXT,
    details TEXT
  );
`);

function cleanupOldReports(daysToKeep) {
  if (NODE_ENV === 'test') return 0; // Jangan cleanup saat test
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const result = db.prepare("DELETE FROM reports WHERE createdAt < ? AND status = 'Selesai'").run(cutoff);
  return result.changes;
}

function cleanupOldAudit(daysToKeep) {
  if (NODE_ENV === 'test') return 0; // Jangan cleanup saat test
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const result = db.prepare('DELETE FROM audit_log WHERE timestamp < ?').run(cutoff);
  return result.changes;
}

function runRetentionCleanup() {
  if (NODE_ENV === 'test') return { reports: 0, audit: 0 };

  // Baca retention policy dari database
  let policies;
  try {
    policies = db.prepare('SELECT * FROM retention_policy').all();
  } catch (err) {
    // Fallback jika tabel belum ada
    const retentionDays = Number(process.env.RETENTION_DAYS || 90);
    return {
      reports: cleanupOldReports(retentionDays),
      audit: cleanupOldAudit(365)
    };
  }

  const results = {};

  for (const policy of policies) {
    const cutoff = Date.now() - (policy.days_to_keep * 24 * 60 * 60 * 1000);
    let query;
    let params = [cutoff];

    if (policy.status_column && policy.status_value) {
      query = `DELETE FROM ${policy.table_name} WHERE ${policy.date_column} < ? AND ${policy.status_column} = ?`;
      params.push(policy.status_value);
    } else {
      query = `DELETE FROM ${policy.table_name} WHERE ${policy.date_column} < ?`;
    }

    try {
      const result = db.prepare(query).run(...params);
      results[policy.table_name] = result.changes;

      // Update last_cleanup timestamp
      db.prepare('UPDATE retention_policy SET last_cleanup = ? WHERE id = ?').run(Date.now(), policy.id);
    } catch (err) {
      console.error(`Retention cleanup error for ${policy.table_name}:`, err.message);
      results[policy.table_name] = 0;
    }
  }

  return results;
}

function checkDatabaseIntegrity() {
  try {
    // PRAGMA integrity_check akan memeriksa corrupt pages
    const result = db.prepare('PRAGMA integrity_check').get();
    const isOk = result.integrity_check === 'ok';

    // Periksa page count dan size
    const pageCount = db.prepare('PRAGMA page_count').get();
    const pageSize = db.prepare('PRAGMA page_size').get();
    const freelistCount = db.prepare('PRAGMA freelist_count').get();

    // Periksa WAL mode
    const journalMode = db.prepare('PRAGMA journal_mode').get();

    return {
      healthy: isOk,
      integrity: result.integrity_check,
      database: {
        pageCount: pageCount?.page_count || 0,
        pageSize: pageSize?.page_size || 0,
        sizeBytes: (pageCount?.page_count || 0) * (pageSize?.page_size || 0),
        freelistCount: freelistCount?.freelist_count || 0,
        journalMode: journalMode?.journal_mode || 'unknown'
      }
    };
  } catch (err) {
    return {
      healthy: false,
      error: err.message
    };
  }
}

function optimizeDatabase() {
  try {
    // Vacuum untuk mengembalikan space
    db.prepare('PRAGMA optimize').run();
    
    // Checkpoint WAL file
    db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').run();
    
    return { success: true, message: 'Database dioptimasi' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = db;
module.exports.cleanupOldReports = cleanupOldReports;
module.exports.cleanupOldAudit = cleanupOldAudit;
module.exports.runRetentionCleanup = runRetentionCleanup;
module.exports.checkDatabaseIntegrity = checkDatabaseIntegrity;
module.exports.optimizeDatabase = optimizeDatabase;
module.exports.dbPath = dbPath;
