require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { callMimoChat } = require('./mimoClient');
const { classifyRisk } = require('./risk');
const db = require('./db');

const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const chatRateLimitWindowMs = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60_000);
const chatRateLimitMax = Number(process.env.CHAT_RATE_LIMIT_MAX || 60);
const chatRateLimitStore = new Map();

app.set('trust proxy', false);
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
app.use(express.json({ limit: '20kb' }));

const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET || 'safesphere-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const loginRateLimitStore = new Map();

function loginRateLimiter(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxAttempts = 5;

  let entry = loginRateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count++;
  loginRateLimitStore.set(key, entry);

  if (entry.count > maxAttempts) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam 5 menit.' });
  }

  next();
}

const { setupAuthRoutes } = require('./auth');
setupAuthRoutes(app, loginRateLimiter);

const { setupReportRoutes } = require('./reports');
setupReportRoutes(app);

const retentionDays = Number(process.env.RETENTION_DAYS || 90);
try {
  const cleanedReports = db.prepare("DELETE FROM reports WHERE createdAt < ? AND status = 'Selesai'").run(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
  console.log('Cleaned up ' + cleanedReports.changes + ' old reports');
} catch (err) {
  console.error('Retention cleanup failed:', err.message);
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

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function chatRateLimiter(req, res, next) {
  if (!Number.isFinite(chatRateLimitWindowMs) || !Number.isFinite(chatRateLimitMax) || chatRateLimitMax <= 0) {
    return next();
  }

  const now = Date.now();
  const key = getClientIp(req);
  let entry = chatRateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + chatRateLimitWindowMs };
  }

  entry.count += 1;
  chatRateLimitStore.set(key, entry);

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  res.set('RateLimit-Limit', String(chatRateLimitMax));
  res.set('RateLimit-Remaining', String(Math.max(0, chatRateLimitMax - entry.count)));
  res.set('RateLimit-Reset', String(retryAfterSeconds));

  if (entry.count > chatRateLimitMax) {
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'rate limit exceeded',
      message: 'Terlalu banyak pesan dalam waktu singkat. Coba lagi sebentar lagi.'
    });
  }

  return next();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'safesphere-chat', model: process.env.MIMO_MODEL || 'mimo-v2.5' });
});

function redactPII(text) {
  if (!text) return text;
  // Email addresses
  let redacted = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  // Phone numbers (Indonesian: 08xx, +62xx, 62xx)
  redacted = redacted.replace(/(\+?62|0)\d{8,12}/g, '[PHONE]');
  return redacted;
}

app.post('/api/chat', chatRateLimiter, async (req, res) => {
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
module.exports.chatRateLimitStore = chatRateLimitStore;

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
