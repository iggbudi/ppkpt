const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'safesphere.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
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
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const result = db.prepare("DELETE FROM reports WHERE createdAt < ? AND status = 'Selesai'").run(cutoff);
  return result.changes;
}

function cleanupOldAudit(daysToKeep) {
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const result = db.prepare('DELETE FROM audit_log WHERE timestamp < ?').run(cutoff);
  return result.changes;
}

module.exports = db;
module.exports.cleanupOldReports = cleanupOldReports;
module.exports.cleanupOldAudit = cleanupOldAudit;
