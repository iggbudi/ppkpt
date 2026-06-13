const bcrypt = require('bcryptjs');

const users = [
  { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('safesphere', 10), role: 'admin', name: 'Admin PPKS' },
  { id: 2, username: 'demo', passwordHash: bcrypt.hashSync('demo123', 10), role: 'user', name: 'Demo User' }
];

function setupAuthRoutes(app, auditLog) {
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password harus diisi' });
    }

    const user = users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role, name: user.name };
    
    auditLog.push({
      timestamp: Date.now(),
      userId: user.id,
      action: 'auth.login',
      ip: req.ip,
      details: { username: user.username, role: user.role }
    });

    res.json({ user: req.session.user });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.session.user) {
      auditLog.push({
        timestamp: Date.now(),
        userId: req.session.user.id,
        action: 'auth.logout',
        ip: req.ip,
        details: {}
      });
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
