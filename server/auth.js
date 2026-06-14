const { z } = require('zod');
const db = require('./db');
const {
  findUserByLogin,
  verifyPassword,
  mapUserForSession,
  createRegisteredUser,
  createUserByAdmin,
  listUsers,
  deactivateUserById
} = require('./users');

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});

const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function setupAuthRoutes(app, loginRateLimiter) {
  app.post('/api/auth/register', loginRateLimiter, (req, res) => {
    try {
      const user = createRegisteredUser(req.body);
      insertAudit.run(
        Date.now(),
        null,
        'auth.register',
        String(user.id),
        req.ip,
        JSON.stringify({ email: user.email, role: user.role })
      );
      res.status(201).json({ user });
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      if (err.status === 409) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Gagal mendaftarkan akun' });
    }
  });

  app.post('/api/auth/login', loginRateLimiter, (req, res) => {
    let parsed;
    try {
      parsed = loginSchema.parse(req.body);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const user = findUserByLogin(parsed.username);
    if (!user || !verifyPassword(user, parsed.password)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const sessionUser = mapUserForSession(user);

    req.session.regenerate(function regenerateCallback(err) {
      if (err) {
        return res.status(500).json({ error: 'Session error' });
      }
      req.session.user = sessionUser;

      insertAudit.run(
        Date.now(),
        sessionUser.id,
        'auth.login',
        null,
        req.ip,
        JSON.stringify({ username: sessionUser.username, role: sessionUser.role })
      );

      res.json({ user: sessionUser });
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.session.user) {
      insertAudit.run(Date.now(), req.session.user.id, 'auth.logout', null, req.ip, '{}');
    }
    req.session.destroy();
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    if (req.session.user) {
      res.json({ user: req.session.user });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    res.json({ users: listUsers() });
  });

  app.post('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    try {
      const user = createUserByAdmin(req.body);
      insertAudit.run(
        Date.now(),
        req.session.user.id,
        'user.create',
        String(user.id),
        req.ip,
        JSON.stringify({ email: user.email, role: user.role, createdBy: req.session.user.id })
      );
      res.status(201).json({ user });
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid input', details: err.errors });
      }
      if (err.status === 409) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Gagal membuat user' });
    }
  });

  app.patch('/api/admin/users/:id/deactivate', requireAuth, requireAdmin, (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (req.session.user.id === userId) {
      return res.status(400).json({ error: 'Tidak dapat menonaktifkan akun sendiri' });
    }

    try {
      const user = deactivateUserById(userId);
      insertAudit.run(
        Date.now(),
        req.session.user.id,
        'user.deactivate',
        String(userId),
        req.ip,
        JSON.stringify({ email: user.email, deactivatedBy: req.session.user.id })
      );
      res.json({ user });
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: err.message });
      if (err.status === 400) return res.status(400).json({ error: err.message });
      return res.status(500).json({ error: 'Gagal menonaktifkan user' });
    }
  });
}

module.exports = { setupAuthRoutes };