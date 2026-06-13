require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { callMimoChat } = require('./mimoClient');
const { classifyRisk } = require('./risk');
const db = require('./db');
const { runMigrations, getCurrentVersion } = require('./migrations');
const { chatRateLimiter, loginRateLimiter, apiRateLimiter } = require('./rateLimiter');

const NODE_ENV = process.env.NODE_ENV;
if (!['development', 'test', 'production'].includes(NODE_ENV)) {
  throw new Error('NODE_ENV wajib diisi: development, test, atau production');
}

// Production safety check
if (NODE_ENV === 'production') {
  // Tolak startup jika SESSION_SECRET masih default
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    console.error('FATAL: SESSION_SECRET harus diset untuk production!');
    process.exit(1);
  }

  // Tolak startup jika ADMIN_USERNAME/ADMIN_PASSWORD tidak diset
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
    console.error('FATAL: ADMIN_USERNAME dan ADMIN_PASSWORD harus diset untuk production!');
    process.exit(1);
  }
  if (process.env.EVIDENCE_UPLOADS_ENABLED === 'true') {
    throw new Error('Evidence upload production dinonaktifkan sampai scanner malware dan private object storage nyata dikonfigurasi');
  }
}

// Jalankan migrasi database
try {
  const migrationResult = runMigrations();
  if (migrationResult.applied > 0) {
    console.log(`Database: ${migrationResult.applied} migrasi baru dijalankan`);
  }
} catch (err) {
  console.error('Database migration error:', err.message);
  if (NODE_ENV === 'production') {
    process.exit(1);
  }
}

const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);
app.use(cors({ origin: false }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ["https://id.wikipedia.org"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  frameguard: { action: 'deny' }
}));
app.use(['/api/restore', '/api/import'], express.json({ limit: '50mb' }));
app.use(express.json({ limit: '20kb' }));

const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// API rate limiter untuk semua endpoint /api
app.use('/api', apiRateLimiter.middleware());

const { setupAuthRoutes } = require('./auth');
setupAuthRoutes(app, loginRateLimiter.middleware());

const { setupReportRoutes } = require('./reports');
setupReportRoutes(app);

// Retention cleanup hanya untuk production/development, bukan test
if (NODE_ENV !== 'test') {
  try {
    const { runRetentionCleanup } = require('./db');
    const cleanupResults = runRetentionCleanup();
    const totalCleaned = Object.values(cleanupResults).reduce((sum, count) => sum + count, 0);
    if (totalCleaned > 0) {
      console.log('Retention cleanup:', cleanupResults);
    }
  } catch (err) {
    console.error('Retention cleanup failed:', err.message);
  }

  // Evidence cleanup scheduler
  try {
    const { cleanupEvidenceFiles } = require('./evidence');
    
    // Jalankan cleanup evidence setiap 6 jam
    const EVIDENCE_CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam
    
    setInterval(async () => {
      try {
        const result = await cleanupEvidenceFiles();
        const totalCleaned = result.orphanFiles + result.tempFiles + result.rejectedFiles + result.deletedFiles + result.pendingFiles;
        if (totalCleaned > 0) {
          console.log('Evidence cleanup:', result);
        }
      } catch (err) {
        console.error('Evidence cleanup error:', err.message);
      }
    }, EVIDENCE_CLEANUP_INTERVAL);
    
    // Jalankan cleanup pertama kali setelah 1 menit
    setTimeout(async () => {
      try {
        const result = await cleanupEvidenceFiles();
        console.log('Initial evidence cleanup:', result);
      } catch (err) {
        console.error('Initial evidence cleanup error:', err.message);
      }
    }, 60 * 1000);
    
    console.log('Evidence cleanup scheduler started (interval: 6 hours)');
  } catch (err) {
    console.error('Evidence cleanup scheduler failed:', err.message);
  }
}

app.use(express.static(path.join(__dirname, '..', 'public')));

const highRiskReply = 'Saya mendeteksi tanda situasi berisiko tinggi. Keselamatanmu adalah prioritas utama. Jika kamu sedang dalam bahaya, segera menjauh ke tempat aman dan hubungi Satgas/keamanan kampus atau orang terpercaya. Jika memungkinkan, simpan bukti dan buat laporan dengan urgensi Tinggi.';
const modelFallbackReply = 'Maaf, SafeBot sedang mengalami gangguan koneksi ke layanan AI. Saya tetap ingin kamu aman: jika situasi terasa mendesak, hubungi kontak darurat kampus atau orang terpercaya. Jika memungkinkan, simpan bukti dan buat laporan melalui menu Lapor Anonim.';

function mediumRiskActions() {
  return [
    { href: '#lapor', text: 'Lapor Anonim', className: 'btn primary' }
  ];
}

function highRiskActions() {
  return [
    { href: '#kontak', text: 'Kontak Darurat', className: 'btn danger' },
    { href: '#lapor', text: 'Buat Laporan', className: 'btn primary' }
  ];
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'safesphere-chat', model: process.env.MIMO_MODEL || 'mimo-v2.5' });
});

// Admin endpoints untuk monitoring
app.get('/api/admin/status', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const migrationVersion = getCurrentVersion();
  const reportCount = db.prepare('SELECT COUNT(*) as count FROM reports').get();
  const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_log').get();
  const retentionPolicies = db.prepare('SELECT * FROM retention_policy').all();

  // Database integrity check
  const { checkDatabaseIntegrity } = require('./db');
  const dbHealth = checkDatabaseIntegrity();

  res.json({
    status: 'ok',
    environment: NODE_ENV,
    database: {
      migrations: migrationVersion,
      reports: reportCount.count,
      auditLogs: auditCount.count,
      health: dbHealth
    },
    retention: retentionPolicies,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Database optimize endpoint (admin only)
app.post('/api/admin/optimize', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { optimizeDatabase } = require('./db');
  const result = optimizeDatabase();

  insertAudit.run(Date.now(), req.session.user.id, 'admin.database_optimize', null, req.ip, JSON.stringify(result));

  res.json(result);
});

// Evidence system health check (admin only)
app.get('/api/admin/evidence/health', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { monitor } = require('./monitoring');
  const health = await monitor.getHealthStatus();
  
  res.status(health.healthy ? 200 : 503).json(health);
});

// Evidence system metrics (admin only)
app.get('/api/admin/evidence/metrics', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { monitor } = require('./monitoring');
  const metrics = monitor.getMetrics();
  const alerts = monitor.getAlerts(20);
  
  res.json({ metrics, alerts });
});

// Evidence system alerts (admin only)
app.get('/api/admin/evidence/alerts', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { monitor } = require('./monitoring');
  const limit = parseInt(req.query.limit) || 50;
  const alerts = monitor.getAlerts(limit);
  
  res.json({ alerts });
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function redactPII(text) {
  if (!text) return text;
  
  let redacted = text;
  
  // Email addresses
  redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  
  // Phone numbers Indonesian patterns:
  // - 08xx, +62 8xx, 62 8xx (with spaces/dashes)
  // - 08xxxxxxxxxx, 08xx-xxxx-xxxx, 08xx xxxx xxxx
  redacted = redacted.replace(/(\+?62[\s-]?|0)8[\d\s-]{8,13}/g, '[PHONE]');
  
  // Phone numbers with parentheses: (021) xxxxx, (08xx) xxxxx
  redacted = redacted.replace(/\(\d{2,4}\)[\s-]?\d{3,4}[\s-]?\d{3,4}/g, '[PHONE]');
  
  // NIM / Student ID patterns (common Indonesian formats):
  // - 10-15 digit numbers that look like NIM
  // - Often starts with year: 2020xxxxx, 2021xxxxx, etc.
  redacted = redacted.replace(/\b(20[12]\d{7,10})\b/g, '[NIM]');
  
  // Generic long number sequences (likely IDs, account numbers)
  // But not years (4 digits) or short numbers
  redacted = redacted.replace(/\b\d{10,16}\b/g, '[NUMBER]');
  
  // Indonesian ID card (NIK) - 16 digits
  redacted = redacted.replace(/\b\d{16}\b/g, '[NIK]');
  
  // Common Indonesian name patterns in context:
  // "nama saya [Name]", "saya [Name]", "teman saya [Name]"
  // This is tricky - we'll do basic pattern matching
  const namePatterns = [
    /(?:nama\s+(?:saya|aku|ku)\s+(?:adalah\s+)?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/gi,
    /(?:saya|aku)\s+(?:bernama|dipanggil)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/gi,
    /(?:teman\s+saya\s+(?:bernama|adalah)\s+)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/gi
  ];
  
  for (const pattern of namePatterns) {
    redacted = redacted.replace(pattern, (match, name) => {
      return match.replace(name, '[NAMA]');
    });
  }
  
  return redacted;
}

app.post('/api/chat', chatRateLimiter.middleware(), async (req, res) => {
  // Per-session rate limit
  if (!req.session.chatHistory) {
    req.session.chatHistory = [];
  }
  const sessionNow = Date.now();
  const sessionWindow = 10 * 60 * 1000; // 10 minutes
  req.session.chatHistory = req.session.chatHistory.filter(t => sessionNow - t < sessionWindow);

  if (req.session.chatHistory.length >= 20) {
    return res.status(429).json({
      error: 'rate limit exceeded',
      message: 'Terlalu banyak pesan. Coba lagi dalam beberapa menit.'
    });
  }

  req.session.chatHistory.push(sessionNow);

  const message = req.body?.message;

  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'message must be a string' });
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return res.status(400).json({ error: 'message is required' });
  }

  if (trimmedMessage.length > 2000) {
    return res.status(413).json({ error: 'message is too long' });
  }

  const user = req.body?.user && typeof req.body.user === 'object'
    ? {
        name: typeof req.body.user.name === 'string' ? req.body.user.name.slice(0, 120) : undefined,
        role: typeof req.body.user.role === 'string' ? req.body.user.role.slice(0, 60) : undefined
      }
    : null;

  const risk = classifyRisk(trimmedMessage);

  if (risk.level === 'high') {
    insertAudit.run(Date.now(), req.session?.user?.id || null, 'chat.high_risk_escalation', null, req.ip, JSON.stringify({ keywords: risk.matchedKeywords }));
    return res.json({
      reply: highRiskReply,
      risk: risk.level,
      actions: highRiskActions(),
      source: 'template'
    });
  }

  try {
    const redactedMessage = redactPII(trimmedMessage);
    const reply = await callMimoChat({ message: redactedMessage, user, risk });
    return res.json({
      reply,
      risk: risk.level,
      actions: risk.level === 'medium' ? mediumRiskActions() : [],
      source: 'mimo'
    });
  } catch (error) {
    console.error('MiMo chat fallback:', error.message);
    return res.json({
      reply: modelFallbackReply,
      risk: risk.level,
      actions: risk.level === 'medium' ? mediumRiskActions() : [],
      source: 'fallback'
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body terlalu besar' });
  res.status(500).json({ error: 'Internal server error' });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(port, host, () => {
    console.log(`SafeSphere chat backend listening on ${host}:${port}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.chatRateLimitStore = chatRateLimiter.store;

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
