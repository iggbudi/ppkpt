/**
 * Rate Limiter Module
 * Menyediakan rate limiting untuk berbagai endpoint
 */

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
    this.windowMs = options.windowMs || 60_000;
    this.maxRequests = options.maxRequests || 10;
    this.message = options.message || 'Terlalu banyak request. Coba lagi nanti.';
    this.keyGenerator = options.keyGenerator || getRateLimitKey;
    this.store = new Map();
    
    // Cleanup expired entries setiap 5 menit
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const now = Date.now();

      let entry = this.store.get(key);
      if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + this.windowMs };
      }

      entry.count++;
      this.store.set(key, entry);

      // Set rate limit headers
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

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  clear() {
    this.store.clear();
  }
}

// Report rate limiter: 10 laporan per 10 menit per IP
const reportRateLimiter = new RateLimiter({
  windowMs: 10 * 60 * 1000, // 10 menit
  maxRequests: 10,
  message: 'Terlalu banyak laporan dalam waktu singkat. Coba lagi dalam 10 menit.',
  keyGenerator: getRateLimitKey
});

// Chat rate limiter: 60 pesan per menit per IP
const chatRateLimiter = new RateLimiter({
  windowMs: Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  maxRequests: Number(process.env.CHAT_RATE_LIMIT_MAX || 60),
  message: 'Terlalu banyak pesan dalam waktu singkat. Coba lagi sebentar lagi.',
  keyGenerator: getRateLimitKey
});

// Login rate limiter: 5 attempts per 5 menit per IP
const loginRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 menit
  maxRequests: 5,
  message: 'Terlalu banyak percobaan login. Coba lagi dalam 5 menit.',
  keyGenerator: getRateLimitKey
});

// API rate limiter: 100 request per menit per IP
const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 menit
  maxRequests: 100,
  message: 'Terlalu banyak request API. Coba lagi sebentar lagi.',
  keyGenerator: getRateLimitKey
});

module.exports = {
  RateLimiter,
  getRateLimitKey,
  reportRateLimiter,
  chatRateLimiter,
  loginRateLimiter,
  apiRateLimiter
};
