const db = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key TEXT NOT NULL,
    limiter_name TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    reset_at INTEGER NOT NULL,
    PRIMARY KEY (bucket_key, limiter_name)
  );
  CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_buckets(limiter_name, reset_at);
`);

class SqliteRateLimitStore {
  constructor(limiterName) {
    this.limiterName = limiterName;
    this.selectStmt = db.prepare(
      'SELECT count, reset_at FROM rate_limit_buckets WHERE bucket_key = ? AND limiter_name = ?'
    );
    this.upsertStmt = db.prepare(`
      INSERT INTO rate_limit_buckets (bucket_key, limiter_name, count, reset_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(bucket_key, limiter_name) DO UPDATE SET
        count = excluded.count,
        reset_at = excluded.reset_at
    `);
    this.clearStmt = db.prepare('DELETE FROM rate_limit_buckets WHERE limiter_name = ?');
    this.purgeExpiredStmt = db.prepare(
      'DELETE FROM rate_limit_buckets WHERE limiter_name = ? AND reset_at < ?'
    );
  }

  consume(key, windowMs) {
    const now = Date.now();
    this.purgeExpiredStmt.run(this.limiterName, now);

    const row = this.selectStmt.get(key, this.limiterName);
    let count = 1;
    let resetAt = now + windowMs;

    if (row && now < row.reset_at) {
      count = row.count + 1;
      resetAt = row.reset_at;
    }

    this.upsertStmt.run(key, this.limiterName, count, resetAt);
    return { count, resetAt };
  }

  clear() {
    this.clearStmt.run(this.limiterName);
  }
}

module.exports = { SqliteRateLimitStore };