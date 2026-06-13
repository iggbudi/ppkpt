/**
 * Database Migration System
 * Menangani versioning dan migrasi schema database
 */

const db = require('./db');

// Buat tabel migrations jika belum ada
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );
`);

const SCHEMA_VERSIONS = [
  {
    name: '001_initial_schema',
    up: `
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
    `
  },
  {
    name: '002_add_indexes',
    up: `
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
      CREATE INDEX IF NOT EXISTS idx_reports_createdAt ON reports(createdAt);
      CREATE INDEX IF NOT EXISTS idx_reports_authorId ON reports(authorId);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_userId ON audit_log(userId);
    `
  },
  {
    name: '003_add_retention_metadata',
    up: `
      CREATE TABLE IF NOT EXISTS retention_policy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        days_to_keep INTEGER NOT NULL,
        date_column TEXT NOT NULL,
        status_column TEXT,
        status_value TEXT,
        last_cleanup INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      INSERT OR IGNORE INTO retention_policy (table_name, days_to_keep, date_column, status_column, status_value)
      VALUES 
        ('reports', 90, 'createdAt', 'status', 'Selesai'),
        ('audit_log', 365, 'timestamp', NULL, NULL);
    `
  },
  {
    name: '004_deletion_and_session_schema',
    up: () => {
      const columns = new Set(db.prepare('PRAGMA table_info(reports)').all().map(c => c.name));
      const additions = [
        ['deleted_at', 'INTEGER DEFAULT NULL'],
        ['legal_hold', 'INTEGER DEFAULT 0'],
        ['deletion_requested_at', 'INTEGER DEFAULT NULL'],
        ['deletion_requested_by', 'INTEGER DEFAULT NULL'],
        ['deletion_reason', 'TEXT']
      ];
      for (const [name, definition] of additions) {
        if (!columns.has(name)) db.exec(`ALTER TABLE reports ADD COLUMN ${name} ${definition}`);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS legal_holds (
          id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT NOT NULL, reason TEXT NOT NULL,
          placed_by INTEGER NOT NULL, placed_at INTEGER NOT NULL, released_by INTEGER,
          released_at INTEGER, active INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (report_id) REFERENCES reports(id)
        );
        CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON reports(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_legal_holds_report_active ON legal_holds(report_id, active);
      `);
    }
  },
  {
    name: '005_evidence_files',
    up: `
      CREATE TABLE IF NOT EXISTS evidence_files (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        safe_name TEXT NOT NULL,
        detected_mime TEXT,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        scan_status TEXT NOT NULL DEFAULT 'pending',
        scan_result TEXT,
        uploaded_at INTEGER NOT NULL,
        deleted_at INTEGER,
        FOREIGN KEY (report_id) REFERENCES reports(id)
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_files_report_id ON evidence_files(report_id);
      CREATE INDEX IF NOT EXISTS idx_evidence_files_scan_status ON evidence_files(scan_status);
      CREATE INDEX IF NOT EXISTS idx_evidence_files_sha256 ON evidence_files(sha256);
      CREATE INDEX IF NOT EXISTS idx_evidence_files_deleted_at ON evidence_files(deleted_at);

      -- Tambahkan retention policy untuk evidence_files
      INSERT OR IGNORE INTO retention_policy (table_name, days_to_keep, date_column, status_column, status_value)
      VALUES ('evidence_files', 90, 'uploaded_at', 'scan_status', 'clean');
    `
  }
];

function getAppliedMigrations() {
  return db.prepare('SELECT name FROM migrations ORDER BY id').all().map(r => r.name);
}

function runMigrations() {
  const applied = getAppliedMigrations();
  const pending = SCHEMA_VERSIONS.filter(m => !applied.includes(m.name));

  if (pending.length === 0) {
    console.log('Database: Semua migrasi sudah dijalankan');
    return { applied: 0 };
  }

  console.log(`Database: ${pending.length} migrasi tertunda`);

  const applyMigration = db.transaction((migration) => {
    if (typeof migration.up === 'function') migration.up();
    else db.exec(migration.up);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    console.log(`  ✓ ${migration.name}`);
  });

  for (const migration of pending) {
    applyMigration(migration);
  }

  console.log(`Database: ${pending.length} migrasi berhasil dijalankan`);
  return { applied: pending.length };
}

function getCurrentVersion() {
  const applied = getAppliedMigrations();
  return {
    current: applied.length,
    total: SCHEMA_VERSIONS.length,
    pending: SCHEMA_VERSIONS.length - applied.length,
    lastApplied: applied[applied.length - 1] || null
  };
}

function rollbackLastMigration() {
  const applied = getAppliedMigrations();
  if (applied.length === 0) {
    return { error: 'Tidak ada migrasi untuk di-rollback' };
  }

  // Note: Rollback tidak didukung untuk migrasi yang sudah dijalankan
  // karena tidak ada down migration. Ini fitur keamanan.
  return { 
    error: 'Rollback otomatis tidak didukung. Gunakan backup/restore.',
    hint: 'Gunakan endpoint /api/backup untuk backup sebelum migrasi'
  };
}

module.exports = {
  runMigrations,
  getCurrentVersion,
  getAppliedMigrations,
  rollbackLastMigration
};
