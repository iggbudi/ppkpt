/**
 * Rate Limiter Module
 * Menyediakan rate limiting untuk berbagai endpoint
 */

const { SqliteRateLimitStore } = require('./rateLimitStore');

function normalizeIp(value) {
  if (!value) return 'unknown';
  return String(value).replace(/^::ffff:/, '');
}

function getRateLimitKey(req) {
  const socketIp = normalizeIp(req.socket?.remoteAddress);
  const trustProxy = req.app?.get('trust proxy');

  if (!trustProxy) {
    return socketIp;
  }

  const trustedProxies = new Set(['127.0.0.1', '::1']);
  if (trustedProxies.has(socketIp)) {
    const realIp = req.get('X-Real-IP');
    if (realIp) {
      return normalizeIp(realIp.trim());
    }
    return normalizeIp(req.ip) || socketIp;
  }

  return normalizeIp(req.ip) || socketIp;
}

class RateLimiter {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.windowMs = options.windowMs || 60_000;
    this.maxRequests = options.maxRequests || 10;
    this.message = options.message || 'Terlalu banyak request. Coba lagi nanti.';
    this.keyGenerator = options.keyGenerator || getRateLimitKey;
    this.store = options.store || new SqliteRateLimitStore(this.name);
  }

  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const now = Date.now();
      const entry = this.store.consume(key, this.windowMs);
      const remaining = Math.max(0, this.maxRequests - entry.count);
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

      res.set('RateLimit-Limit', String(this.maxRequests));
      res.set('RateLimit-Remaining', String(remaining));
      res.set('RateLimit-Reset', String(retryAfterSeconds));

      if (entry.count > this.maxRequests) {
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          error: 'rate limit exceeded',
          message: this.message
        });
      }

      next();
    };
  }

  clear() {
    this.store.clear();
  }
}

const reportRateLimiter = new RateLimiter({
  name: 'reports',
  windowMs: Number(process.env.REPORT_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  maxRequests: Number(process.env.REPORT_RATE_LIMIT_MAX || 10),
  message: 'Terlalu banyak laporan dalam waktu singkat. Coba lagi dalam 10 menit.',
  keyGenerator: getRateLimitKey
});

const chatRateLimiter = new RateLimiter({
  name: 'chat',
  windowMs: Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  maxRequests: Number(process.env.CHAT_RATE_LIMIT_MAX || 60),
  message: 'Terlalu banyak pesan dalam waktu singkat. Coba lagi sebentar lagi.',
  keyGenerator: getRateLimitKey
});

const loginRateLimiter = new RateLimiter({
  name: 'login',
  windowMs: 5 * 60 * 1000,
  maxRequests: 5,
  message: 'Terlalu banyak percobaan login. Coba lagi dalam 5 menit.',
  keyGenerator: getRateLimitKey
});

const apiRateLimiter = new RateLimiter({
  name: 'api',
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'Terlalu banyak request API. Coba lagi sebentar lagi.',
  keyGenerator: getRateLimitKey
});

function clearAllRateLimiters() {
  reportRateLimiter.clear();
  chatRateLimiter.clear();
  loginRateLimiter.clear();
  apiRateLimiter.clear();
}

module.exports = {
  RateLimiter,
  getRateLimitKey,
  reportRateLimiter,
  chatRateLimiter,
  loginRateLimiter,
  apiRateLimiter,
  clearAllRateLimiters
};