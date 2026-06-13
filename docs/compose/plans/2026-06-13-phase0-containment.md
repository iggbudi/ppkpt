# Phase 0: Containment & Product Honesty — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical security exposures, align UI claims with reality, add demo banner, and stop PII leakage to LLM.

**Architecture:** Move static files to `public/`, add helmet security headers, fix risk classifier contract, add demo banner, remove false claims.

**Tech Stack:** Node.js, Express, helmet

---

### Task 1: SEC-001 — Create public/ and move static files

**Covers:** [S3]

**Files:**
- Create: `public/` directory
- Move: `index.html`, `style.css`, `app.js`, `js/`, `image/` → `public/`
- Modify: `server/index.js` — change static path

- [ ] **Step 1: Create public/ directory and move files**

```bash
mkdir public
Move-Item index.html public/
Move-Item style.css public/
Move-Item app.js public/
Move-Item js public/
Move-Item image public/
```

- [ ] **Step 2: Update server/index.js static path**

Find:
```javascript
app.use(express.static(path.join(__dirname, '..')));
```

Replace with:
```javascript
app.use(express.static(path.join(__dirname, '..', 'public')));
```

Update SPA fallback:
```javascript
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
```

- [ ] **Step 3: Update .gitignore**

Add `public/` to .gitignore if we want to keep source separate from deployed files. Or keep public/ tracked if this is a single-repo deployment.

Decision: Keep public/ tracked since this is a competition project with single-repo deployment.

- [ ] **Step 4: Update package.json start script**

Ensure start script still works: `node server/index.js`

- [ ] **Step 5: Verify internal files return 404**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/package.json
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/server/index.js
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/.git/config
```

Expected: all return 404 or serve index.html (SPA fallback).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "security: move static files to public/, stop exposing internal files"
```

---

### Task 2: SEC-002 — Add helmet and security headers

**Covers:** [S4]

**Files:**
- Modify: `server/index.js`
- Modify: `server/package.json` (add helmet dependency)

- [ ] **Step 1: Install helmet**

```bash
cd server && npm install helmet
```

- [ ] **Step 2: Add helmet to server/index.js**

After `const cors = require('cors');`, add:
```javascript
const helmet = require('helmet');
```

After `app.use(cors({ origin: false }));`, add:
```javascript
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
```

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "security: add helmet with CSP, X-Frame-Options, and security headers"
```

---

### Task 3: SAFE-001 — Fix getRiskScore() contract

**Covers:** [S5]

**Files:**
- Modify: `js/safety.js`

- [ ] **Step 1: Update getRiskScore() to return object**

Find the current `getRiskScore` function and replace:

```javascript
window.getRiskScore = function(text) {
  var lowerText = text.toLowerCase();
  var score = 0;
  var foundHighRisk = false;

  triggerDictionary.highRisk.forEach(function(word) {
    if (lowerText.includes(word)) {
      score += 5;
      foundHighRisk = true;
    }
  });

  triggerDictionary.medRisk.forEach(function(word) {
    if (lowerText.includes(word)) score += 2;
  });

  var level = 'low';
  if (score >= 5 || foundHighRisk) level = 'high';
  else if (score >= 2) level = 'medium';

  return { score: score, level: level, foundHighRisk: foundHighRisk };
};
```

- [ ] **Step 2: Verify chat.js uses the new format**

Check that `js/chat.js` uses `riskScore.score` and `riskScore.foundHighRisk` (not just `riskScore` as a number).

- [ ] **Step 3: Commit**

```bash
git add js/safety.js
git commit -m "fix: getRiskScore() returns object matching backend classifier format"
```

---

### Task 4: TRUST-001 — Add demo banner

**Covers:** [S6]

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `app.js`

- [ ] **Step 1: Add banner HTML to index.html**

After `<body>`, add:
```html
  <div id="demoBanner" class="demo-banner">
    <span>MODE DEMO — SafeSphere adalah purwarupa kompetisi. Jangan masukkan data nyata atau pribadi.</span>
    <button id="dismissBanner" class="demo-banner-close" type="button" aria-label="Tutup banner">&times;</button>
  </div>
```

- [ ] **Step 2: Add banner CSS**

```css
.demo-banner {
  background: #fef3c7;
  color: #92400e;
  padding: 10px 6vw;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid #fde68a;
  z-index: 100;
}

.demo-banner-close {
  background: transparent;
  border: none;
  color: #92400e;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  font-weight: 700;
}

.demo-banner-close:hover {
  background: rgba(0,0,0,0.05);
  border-radius: 4px;
}
```

- [ ] **Step 3: Add dismiss JS to app.js**

In `setupEventListeners()`:
```javascript
var demoBanner = document.getElementById('demoBanner');
var dismissBanner = document.getElementById('dismissBanner');
if (demoBanner && dismissBanner) {
  // Check if already dismissed this session
  if (sessionStorage.getItem('bannerDismissed')) {
    demoBanner.style.display = 'none';
  }
  dismissBanner.addEventListener('click', function() {
    demoBanner.style.display = 'none';
    sessionStorage.setItem('bannerDismissed', 'true');
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html style.css app.js
git commit -m "trust: add demo banner warning users not to enter real data"
```

---

### Task 5: TRUST-002 — Remove false claims

**Covers:** [S7]

**Files:**
- Modify: `index.html`
- Modify: `js/auth.js`
- Modify: `js/reports.js`

- [ ] **Step 1: Update report form claims**

In `index.html`, find and replace:
- "Data Anda dilindungi dengan enkripsi end-to-end" → "Data disimpan secara lokal untuk demo ini"
- "Kirim Laporan Terenkripsi" → "Kirim Laporan (Demo)"
- "Data terenkripsi end-to-end" → "Data disimpan di browser lokal"

- [ ] **Step 2: Update registration claims**

In `js/auth.js`, find and replace:
- "Registrasi Berhasil! Akun Anda terverifikasi" → "Registrasi Demo Berhasil! (Simulasi — tidak ada akun yang dibuat)"
- "Mengenkripsi Data & Mendaftarkan..." → "Mendaftarkan (Simulasi)..."

- [ ] **Step 3: Update OTP claims**

In `js/auth.js`, find `sendOTP` function:
- Change "Kode OTP berhasil dikirim" → "Simulasi: OTP tidak benar-benar dikirim (demo)"

- [ ] **Step 4: Update invoice claims**

In `js/reports.js`, find "Tanda Terima Pengaduan":
- Add "(Demo)" prefix
- Change "Laporan masuk ke sistem aman" → "Simulasi: laporan disimpan di browser lokal"

- [ ] **Step 5: Update social login**

In `app.js`, find social login click handlers:
- Change "Fitur ini akan segera tersedia" → "Simulasi: fitur ini belum aktif"

- [ ] **Step 6: Commit**

```bash
git add index.html js/auth.js js/reports.js app.js
git commit -m "trust: remove false claims, add demo/simulation labels"
```

---

### Task 6: TRUST-003 — Fix emergency contacts

**Covers:** [S8]

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update contact section**

Replace the current contact section with clear labeling:

```html
<div id="page-kontak" class="page">
  <section class="section card">
    <div class="card-header">
      <h2>Kontak Darurat Kampus</h2>
      <p class="muted">Hubungi nomor berikut jika terjadi situasi perundungan atau kekerasan yang mengancam keselamatan fisik.</p>
    </div>
    <div class="safebot-disclaimer" role="note">
      <strong>Catatan:</strong> Nomor kontak berikut adalah contoh untuk demo. Untuk produksi, hubungi Satgas PPKS kampus Anda untuk mendapatkan nomor yang valid dan terverifikasi.
    </div>
    <div class="feature-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
      <div><b>Satgas PPKS Kampus</b><span style="color:var(--primary); font-weight:bold;">Belum tersedia (demo)</span></div>
      <div><b>Keamanan / Satpam</b><span style="color:var(--primary); font-weight:bold;">Belum tersedia (demo)</span></div>
      <div><b>Layanan Psikologi Mhs</b><span style="color:var(--primary); font-weight:bold;">Belum tersedia (demo)</span></div>
    </div>
  </section>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "trust: label emergency contacts as demo/placeholder"
```

---

### Task 7: PRIV-001 — Stop sending name to LLM

**Covers:** [S9]

**Files:**
- Modify: `js/chat.js`
- Modify: `server/mimoClient.js`

- [ ] **Step 1: Update chat.js to not send name**

In `js/chat.js`, find:
```javascript
body: JSON.stringify({
  message: message,
  user: currentUser ? { name: currentUser.name, role: currentUser.role } : null
})
```

Replace with:
```javascript
body: JSON.stringify({
  message: message
})
```

- [ ] **Step 2: Update mimoClient.js to not use name**

In `server/mimoClient.js`, find:
```javascript
const userContext = user?.name
  ? `Konteks pengguna: nama ${user.name}, role ${user.role || 'tidak diketahui'}.`
  : 'Konteks pengguna: belum login atau anonim.';
```

Replace with:
```javascript
const userContext = 'Konteks pengguna: anonim atau belum login.';
```

- [ ] **Step 3: Commit**

```bash
git add js/chat.js server/mimoClient.js
git commit -m "privacy: stop sending user name to LLM provider"
```

---

### Task 8: TEST-001 — Add static exposure regression test

**Covers:** [S10]

**Files:**
- Modify: `server/test/chat.test.js`

- [ ] **Step 1: Add test for internal file exposure**

Add to the test file:

```javascript
describe('Static file exposure', () => {
  test('package.json is not accessible', async () => {
    const res = await request(app).get('/package.json');
    expect(res.status).toBe(404);
  });

  test('server source is not accessible', async () => {
    const res = await request(app).get('/server/index.js');
    expect(res.status).toBe(404);
  });

  test('.git config is not accessible', async () => {
    const res = await request(app).get('/.git/config');
    expect(res.status).toBe(404);
  });

  test('.env is not accessible', async () => {
    const res = await request(app).get('/.env');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd server && npm test
```

- [ ] **Step 3: Commit**

```bash
git add server/test/
git commit -m "test: add regression test for static file exposure"
```
