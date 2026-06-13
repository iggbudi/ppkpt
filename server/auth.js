const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('./db');

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
});

const users = [
  { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('safesphere', 10), role: 'admin', name: 'Admin PPKS' },
  { id: 2, username: 'demo', passwordHash: bcrypt.hashSync('demo123', 10), role: 'user', name: 'Demo User' }
];

const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');

function setupAuthRoutes(app, loginRateLimiter) {
  app.post('/api/auth/login', loginRateLimiter, (req, res) => {
    const { username, password } = req.body;

    let parsed;
    try {
      parsed = loginSchema.parse({ username, password });
    } catch (err) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const user = users.find(u => u.username === parsed.username);
    if (!user || !bcrypt.compareSync(parsed.password, user.passwordHash)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    req.session.regenerate(function(err) {
      if (err) {
        return res.status(500).json({ error: 'Session error' });
      }
      req.session.user = { id: user.id, username: user.username, role: user.role, name: user.name };

      insertAudit.run(Date.now(), user.id, 'auth.login', null, req.ip, JSON.stringify({ username: user.username, role: user.role }));

      res.json({ user: req.session.user });
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
}

module.exports = { setupAuthRoutes, users };
