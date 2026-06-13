# Phase 1: Backend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side auth, report storage, RBAC, and audit logging to SafeSphere.

**Architecture:** Express session for auth, in-memory store for reports, middleware for RBAC, append-only audit log.

**Tech Stack:** Node.js, Express, express-session, bcryptjs

---

### Task 1: Add session middleware

**Covers:** [S3]

**Files:**
- Modify: `server/index.js`
- Modify: `server/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd server && npm install express-session bcryptjs
```

- [ ] **Step 2: Add session middleware to server/index.js**

After `app.use(express.json({ limit: '20kb' }));`, add:

```javascript
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET || 'safesphere-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set true in production with HTTPS
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "feat: add express-session middleware for server-side auth"
```

---

### Task 2: Create auth routes

**Covers:** [S3]

**Files:**
- Create: `server/auth.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/auth.js**

```javascript
const bcrypt = require('bcryptjs');

// Demo users (in production, use database)
const users = [
  { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('safesphere', 10), role: 'admin', name: 'Admin PPKS' },
  { id: 2, username: 'demo', passwordHash: bcrypt.hashSync('demo123', 10), role: 'user', name: 'Demo User' }
];

function setupAuthRoutes(app, auditLog) {
  // Login
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

  // Logout
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

  // Check current session
  app.get('/api/auth/me', (req, res) => {
    if (req.session.user) {
      res.json({ user: req.session.user });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });
}

module.exports = { setupAuthRoutes, users };
```

- [ ] **Step 2: Add auth routes to server/index.js**

Before the static file serving, add:

```javascript
const auditLog = [];
const { setupAuthRoutes } = require('./auth');
setupAuthRoutes(app, auditLog);
```

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "feat: add auth routes (login, logout, me) with bcrypt"
```

---

### Task 3: Create report store and routes

**Covers:** [S4]

**Files:**
- Create: `server/reports.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/reports.js**

```javascript
function setupReportRoutes(app, auditLog) {
  const reports = [];

  // Auth middleware
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

  // Create report
  app.post('/api/reports', requireAuth, (req, res) => {
    const { category, location, urgency, incidentDate, description, evidence, isAnonymous } = req.body;
    
    if (!category || !location || !urgency || !incidentDate || !description) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const user = req.session.user;
    const maskedName = isAnonymous !== false 
      ? user.name.charAt(0).toUpperCase() + '***'
      : user.name;

    const report = {
      id: 'SSF-2026-' + Math.floor(1000 + Math.random() * 9000),
      category,
      location,
      urgency,
      incidentDate,
      status: 'Baru Masuk',
      description,
      evidence: evidence || 'Tidak ada lampiran',
      appointment: 'Menunggu proses peninjauan awal dari tim Satgas.',
      createdAt: Date.now(),
      authorId: user.id,
      authorName: maskedName,
      isAnonymous: isAnonymous !== false
    };

    reports.push(report);

    auditLog.push({
      timestamp: Date.now(),
      userId: user.id,
      action: 'report.create',
      targetId: report.id,
      ip: req.ip,
      details: { category, urgency, isAnonymous: report.isAnonymous }
    });

    res.json({ report });
  });

  // List reports
  app.get('/api/reports', requireAuth, (req, res) => {
    const user = req.session.user;
    let userReports;

    if (user.role === 'admin') {
      userReports = reports;
    } else {
      userReports = reports.filter(r => r.authorId === user.id);
    }

    res.json({ reports: userReports });
  });

  // Get single report
  app.get('/api/reports/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const report = reports.find(r => r.id === req.params.id);
    
    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    
    if (user.role !== 'admin' && report.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    auditLog.push({
      timestamp: Date.now(),
      userId: user.id,
      action: 'report.view',
      targetId: report.id,
      ip: req.ip,
      details: {}
    });

    res.json({ report });
  });

  // Update report status (admin only)
  app.patch('/api/reports/:id/status', requireAuth, requireAdmin, (req, res) => {
    const { status, appointment } = req.body;
    const report = reports.find(r => r.id === req.params.id);
    
    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    
    const validStatuses = ['Baru Masuk', 'Direview', 'Diproses', 'Selesai'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    const oldStatus = report.status;
    report.status = status;
    if (appointment) report.appointment = appointment;

    auditLog.push({
      timestamp: Date.now(),
      userId: req.session.user.id,
      action: 'report.status_update',
      targetId: report.id,
      ip: req.ip,
      details: { oldStatus, newStatus: status }
    });

    res.json({ report });
  });

  // Seed demo data (admin only)
  app.post('/api/reports/seed', requireAuth, requireAdmin, (req, res) => {
    const dummies = [
      { id: 'SSF-2026-1001', category: 'Cyberbullying', location: 'Grup WA Kelas', urgency: 'Tinggi', incidentDate: '2026-06-02', status: 'Baru Masuk', description: 'Saya diejek dan foto saya disebar di grup tanpa izin.', evidence: 'demo-bukti.png', appointment: 'Menunggu proses peninjauan awal.', createdAt: Date.now() - 20000, authorId: 2, authorName: 'D***', isAnonymous: true },
      { id: 'SSF-2026-1002', category: 'Verbal', location: 'Ruang Kelas', urgency: 'Sedang', incidentDate: '2026-06-05', status: 'Direview', description: 'Saya sering dihina soal penampilan saat presentasi.', evidence: 'Tidak ada lampiran', appointment: 'Sedang dalam peninjauan bukti oleh Admin.', createdAt: Date.now() - 15000, authorId: 2, authorName: 'demo_user', isAnonymous: false },
      { id: 'SSF-2026-1003', category: 'Sosial', location: 'Lingkungan Kampus', urgency: 'Rendah', incidentDate: '2026-06-06', status: 'Selesai', description: 'Teman saya dikucilkan dari kelompok tugas.', evidence: 'Tidak ada lampiran', appointment: 'Telah dilakukan mediasi dan edukasi pencegahan.', createdAt: Date.now() - 10000, authorId: 2, authorName: 'D***', isAnonymous: true },
      { id: 'SSF-2026-1004', category: 'Fisik', location: 'Parkiran Kampus', urgency: 'Tinggi', incidentDate: '2026-06-08', status: 'Diproses', description: 'Ada tindakan represif dan ancaman jika saya melapor.', evidence: 'rekaman_suara.mp3', appointment: 'Jadwal Konseling: Kasus dialihkan ke Satgas PPKS.', createdAt: Date.now() - 5000, authorId: 2, authorName: 'demo_user', isAnonymous: false }
    ];

    reports.length = 0;
    dummies.forEach(d => reports.push(d));

    auditLog.push({
      timestamp: Date.now(),
      userId: req.session.user.id,
      action: 'reports.seed',
      ip: req.ip,
      details: { count: dummies.length }
    });

    res.json({ ok: true, count: dummies.length });
  });

  // Clear all reports (admin only)
  app.delete('/api/reports', requireAuth, requireAdmin, (req, res) => {
    const count = reports.length;
    reports.length = 0;

    auditLog.push({
      timestamp: Date.now(),
      userId: req.session.user.id,
      action: 'reports.clear',
      ip: req.ip,
      details: { cleared: count }
    });

    res.json({ ok: true, cleared: count });
  });

  // Get audit log (admin only)
  app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
    res.json({ log: auditLog });
  });
}

module.exports = { setupReportRoutes };
```

- [ ] **Step 2: Add report routes to server/index.js**

```javascript
const { setupReportRoutes } = require('./reports');
setupReportRoutes(app, auditLog);
```

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "feat: add server-side report storage, RBAC, and audit logging"
```

---

### Task 4: Update frontend auth flow

**Covers:** [S7]

**Files:**
- Modify: `public/js/auth.js`
- Modify: `public/app.js`

- [ ] **Step 1: Update auth.js to use server API**

Replace the login handler to call `/api/auth/login`:

```javascript
window.handleMainLogin = async function(event) {
  event.preventDefault();
  var username = sanitizeInput(document.getElementById('loginEmail').value);
  var pass = document.getElementById('loginPass').value;
  var errorBox = document.getElementById('loginError');

  errorBox.classList.add('hidden');
  errorBox.innerText = '';

  if (!username || !pass) {
    errorBox.classList.remove('hidden');
    errorBox.innerText = 'Username dan Password tidak boleh kosong!';
    return;
  }

  try {
    var response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: pass })
    });

    var data = await response.json();

    if (!response.ok) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = data.error || 'Login gagal';
      return;
    }

    currentUser = data.user;
    updateNavForUser(currentUser);
    window.location.hash = currentUser.role === 'admin' ? '#admin' : '#dashboard';
  } catch (err) {
    errorBox.classList.remove('hidden');
    errorBox.innerText = 'Koneksi gagal. Coba lagi.';
  }
};
```

- [ ] **Step 2: Update logout to call server**

```javascript
window.handleLogout = async function() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    // ignore
  }
  currentUser = null;
  updateNavForUser(null);
  window.location.hash = '#beranda';
};
```

- [ ] **Step 3: Update app.js to check session on load**

In `DOMContentLoaded`, add before `handleRouting()`:

```javascript
try {
  var meResponse = await fetch('/api/auth/me');
  if (meResponse.ok) {
    var meData = await meResponse.json();
    currentUser = meData.user;
    updateNavForUser(currentUser);
  }
} catch (err) {
  // not logged in
}
```

- [ ] **Step 4: Add updateNavForUser helper**

```javascript
function updateNavForUser(user) {
  if (!user) {
    document.getElementById('navGuest').classList.remove('hidden');
    document.getElementById('navUser').classList.add('hidden');
    document.getElementById('navAdmin').classList.add('hidden');
    document.getElementById('welcomeMessage').classList.add('hidden');
  } else if (user.role === 'admin') {
    document.getElementById('navGuest').classList.add('hidden');
    document.getElementById('navUser').classList.add('hidden');
    document.getElementById('navAdmin').classList.remove('hidden');
    document.getElementById('welcomeMessage').classList.remove('hidden');
    document.getElementById('welcomeName').innerText = user.name;
  } else {
    document.getElementById('navGuest').classList.add('hidden');
    document.getElementById('navAdmin').classList.add('hidden');
    document.getElementById('navUser').classList.remove('hidden');
    document.getElementById('welcomeMessage').classList.remove('hidden');
    document.getElementById('welcomeName').innerText = user.name;
    document.getElementById('userNameDisplay').innerText = 'Halo, ' + user.name + '!';
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add public/js/auth.js public/app.js
git commit -m "feat: update frontend auth to use server-side sessions"
```

---

### Task 5: Update frontend report flow

**Covers:** [S7]

**Files:**
- Modify: `public/js/reports.js`
- Modify: `public/js/admin.js`

- [ ] **Step 1: Update submitReport to call server API**

```javascript
window.submitReport = async function(event) {
  event.preventDefault();
  var resultBox = document.getElementById('reportResult');
  var btn = event.target.querySelector('button[type="submit"]');

  btn.innerText = 'Mengirim Laporan...';
  btn.style.opacity = '0.7';

  try {
    var response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: document.getElementById('category').value,
        location: sanitizeInput(document.getElementById('location').value),
        urgency: document.getElementById('urgent').value,
        incidentDate: document.getElementById('incidentDate').value,
        description: sanitizeInput(document.getElementById('description').value),
        evidence: document.getElementById('evidence').files.length > 0 
          ? sanitizeInput(document.getElementById('evidence').files[0].name) 
          : 'Tidak ada lampiran',
        isAnonymous: document.getElementById('isAnonymous').checked
      })
    });

    var data = await response.json();

    if (!response.ok) {
      resultBox.classList.remove('hidden');
      resultBox.classList.add('error');
      resultBox.innerText = data.error || 'Gagal mengirim laporan';
      return;
    }

    btn.innerText = 'Kirim Laporan (Demo)';
    btn.style.opacity = '1';

    resultBox.classList.remove('hidden');
    resultBox.classList.add('success');
    resultBox.innerHTML = '<strong>Laporan Demo Berhasil Dikirim!</strong><br><br>' +
      'Nomor Pelacakan: <b>' + data.report.id + '</b><br>' +
      '<button class="btn secondary" type="button" onclick="viewInvoiceFromSubmit(\'' + data.report.id + '\')" style="margin-top: 10px;">Lacak Status</button>';

    event.target.reset();
  } catch (err) {
    btn.innerText = 'Kirim Laporan (Demo)';
    btn.style.opacity = '1';
    resultBox.classList.remove('hidden');
    resultBox.classList.add('error');
    resultBox.innerText = 'Koneksi gagal. Coba lagi.';
  }
};
```

- [ ] **Step 2: Update admin dashboard to fetch from server**

```javascript
window.updateDashboardUI = async function() {
  try {
    var response = await fetch('/api/reports');
    if (!response.ok) return;
    var data = await response.json();
    reportData = data.reports;
  } catch (err) {
    return;
  }

  // ... rest of existing UI update logic ...
};
```

- [ ] **Step 3: Update seedDemoData to call server**

```javascript
window.seedDemoData = async function() {
  try {
    var response = await fetch('/api/reports/seed', { method: 'POST' });
    if (response.ok) {
      showTopSystemAlert('Data demo berhasil dimuat!');
      updateDashboardUI();
    }
  } catch (err) {
    showTopSystemAlert('Gagal memuat data demo');
  }
};
```

- [ ] **Step 4: Update clearAllData to call server**

```javascript
window.clearAllData = async function() {
  if (!confirm('Hapus semua data?')) return;
  try {
    var response = await fetch('/api/reports', { method: 'DELETE' });
    if (response.ok) {
      reportData = [];
      updateDashboardUI();
    }
  } catch (err) {
    showTopSystemAlert('Gagal menghapus data');
  }
};
```

- [ ] **Step 5: Update saveReportStatus to call server**

```javascript
window.saveReportStatus = async function() {
  if (!currentDetailId) return;
  try {
    var response = await fetch('/api/reports/' + currentDetailId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: document.getElementById('updateStatusSelect').value,
        appointment: sanitizeInput(document.getElementById('updateAppointment').value)
      })
    });

    if (response.ok) {
      closeReportDetailModal();
      showTopSystemAlert('Status berhasil diupdate!');
      updateDashboardUI();
    }
  } catch (err) {
    showTopSystemAlert('Gagal update status');
  }
};
```

- [ ] **Step 6: Commit**

```bash
git add public/js/reports.js public/js/admin.js
git commit -m "feat: update frontend to use server-side report API"
```

---

### Task 6: Test end-to-end

**Covers:** [S9]

**Files:** None (verification)

- [ ] **Step 1: Run existing tests**

```bash
cd server && npm test
```

- [ ] **Step 2: Test auth flow manually**

```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"safesphere"}' -c cookies.txt

# Check session
curl http://localhost:3000/api/auth/me -b cookies.txt

# Create report
curl -X POST http://localhost:3000/api/reports -H "Content-Type: application/json" -d '{"category":"Verbal","location":"Test","urgency":"Rendah","incidentDate":"2026-06-13","description":"Test"}' -b cookies.txt

# List reports
curl http://localhost:3000/api/reports -b cookies.txt
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete — server-side auth, reports, RBAC, audit"
```
