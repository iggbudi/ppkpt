require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const { callMimoChat } = require('./mimoClient');
const { classifyRisk } = require('./risk');

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const chatRateLimitWindowMs = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60_000);
const chatRateLimitMax = Number(process.env.CHAT_RATE_LIMIT_MAX || 60);
const chatRateLimitStore = new Map();

app.set('trust proxy', false);
app.use(cors({ origin: false }));
app.use(express.json({ limit: '20kb' }));
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

app.post('/api/chat', chatRateLimiter, async (req, res) => {
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
    return res.json({
      reply: highRiskReply,
      risk: risk.level,
      actions: highRiskActions(),
      source: 'template'
    });
  }

  try {
    const reply = await callMimoChat({ message: trimmedMessage, user, risk });
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
