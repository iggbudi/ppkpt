# SafeSphere Improvements Design

## [S1] Problem

SafeSphere adalah SPA anti-bullying untuk mahasiswa. Saat ini memiliki tiga masalah kritis:

1. **Keamanan lemah** — `sanitizeInput()` hanya trim(), ada 20+ inline event handlers (XSS vector), kredensial FTP dan admin hard-coded di repo.
2. **Tidak ada persistence** — data laporan dan session login hilang saat refresh browser.
3. **Code quality** — `app.js` 883 baris tanpa modularisasi, sulit maintain dan debug.

## [S2] Solution Overview

Tiga perbaikan bertahap:

### A. Keamanan & CSP (Incremental)
- Perkuat `sanitizeInput()` dengan proper HTML entity escaping
- Hapus semua inline event handlers (`onclick`, `onsubmit`, `oninput`, `onchange`) dari `index.html`, pindah ke `addEventListener` di JS
- Hapus `ftp.txt` dari repo, tambah ke `.gitignore`
- Hapus `assets_placeholder` yang sudah tidak relevan

### B. Data Persistence (localStorage)
- Buat `js/storage.js` sebagai wrapper localStorage
- Persist `reportData` array — simpan setiap kali berubah
- Persist `currentUser` object — simpan saat login, hapus saat logout
- Boot sequence load dari localStorage

### C. Code Quality (Modular Split)
- Pisahkan `app.js` ke 8 file dalam direktori `js/`
- Setiap file fokus pada satu fitur
- `app.js` menjadi orchestrator (init, routing, global state)

## [S3] Security Improvements Detail

### sanitizeInput Enhancement

```javascript
function sanitizeInput(text) {
  const element = document.createElement('div');
  element.appendChild(document.createTextNode(text));
  return element.innerHTML;
}
```

Menggunakan `document.createTextNode()` yang otomatis escape semua HTML entity (`<`, `>`, `&`, `"`, `'`).

### Inline Event Handler Removal

Handler yang perlu dipindah dari HTML ke JS:

| Handler | File Asal | Lokasi di HTML |
|---------|-----------|----------------|
| `onsubmit="submitReport(event)"` | index.html:128 | Form laporan |
| `oninput="analyzeSentiment()"` | index.html:157 | Textarea deskripsi |
| `onsubmit="handleRegister(event)"` | index.html:264 | Form register |
| `oninput="checkPasswordStrength()"` | index.html:294 | Input password |
| `onchange="toggleStatusFields()"` | index.html:271 | Select status |
| `onsubmit="handleMainLogin(event)"` | index.html:326 | Form login |
| `onclick="handleLogout()"` | index.html:51 | Tombol keluar |
| `onclick="activateDiscreetMode()"` | index.html:23 | Tombol quick escape |
| `onclick="deactivateDiscreetMode()"` | index.html:18 | Tombol X overlay |
| `onclick="switchLoginTab(...)"` | index.html:319,320 | Tab login |
| `onclick="openForgotModal(event)"` | index.html:333 | Link lupa password |
| `onclick="sendOTP(event)"` | index.html:382 | Tombol OTP |
| `onclick="seedDemoData()"` | index.html:398 | Tombol demo |
| `onclick="clearAllData()"` | index.html:399 | Tombol reset |
| `onclick="viewReportDetail(...)"` | index.html:287 | Report item (dynamic) |
| `onclick="saveReportStatus()"` | index.html:458 | Tombol simpan status |
| `onclick="closeReportDetailModal()"` | index.html:439 | Tombol close modal |
| `onclick="closeForgotModal()"` | index.html:375 | Tombol close modal |
| `onclick="toggleA11yMenu()"` | index.html:500 | Tombol aksesibilitas |
| `onclick="toggleA11yFeature(...)"` | index.html:495-497 | Tombol aksesibilitas |
| `onclick="viewInvoiceFromSubmit(...)"` | index.html:472,528 | Tombol invoice (dynamic) |

### Credential Cleanup

- Hapus `ftp.txt` dari working tree
- Buat/update `.gitignore`:
  ```
  ftp.txt
  *.env
  .env*
  ```

## [S4] Data Persistence Detail

### storage.js API

```javascript
window.Storage = {
  save(key, value) {
    try {
      localStorage.setItem('safesphere_' + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  },
  load(key, fallback = null) {
    try {
      const data = localStorage.getItem('safesphere_' + key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.warn('Storage load failed:', e);
      return fallback;
    }
  },
  remove(key) {
    localStorage.removeItem('safesphere_' + key);
  }
};
```

### Integration Points

**Boot (app.js init):**
```javascript
reportData = Storage.load('reports', []);
currentUser = Storage.load('currentUser', null);
if (currentUser) updateNavForUser(currentUser);
```

**submitReport (reports.js):**
```javascript
reportData.unshift(newReport);
Storage.save('reports', reportData);
```

**saveReportStatus (admin.js):**
```javascript
report.status = newStatus;
Storage.save('reports', reportData);
```

**handleMainLogin (auth.js):**
```javascript
currentUser = { role: 'admin', name: 'Admin PPKS' };
Storage.save('currentUser', currentUser);
```

**handleLogout (auth.js):**
```javascript
currentUser = null;
Storage.remove('currentUser');
```

**clearAllData (admin.js):**
```javascript
reportData = [];
Storage.remove('reports');
```

### Data Format

Format object laporan tidak berubah. Penambahan field baru tidak diperlukan.

## [S5] Modular Split Detail

### File Structure

```
index.html
style.css
js/
  storage.js      ← localStorage wrapper (new)
  utils.js        ← sanitizeInput, showTopSystemAlert (new)
  auth.js         ← login, register, logout, password modal (new)
  reports.js      ← submit, invoice, report data (new)
  admin.js        ← admin dashboard, chart, seed, detail modal (new)
  edukasi.js      ← bystander simulation game (new)
  a11y.js         ← accessibility widget (new)
  safety.js       ← quick escape, sentiment analysis (new)
  app.js          ← orchestrator: init, routing, global state (refactored)
```

### Dependency Order (script tags in index.html)

```html
<script src="js/storage.js"></script>
<script src="js/utils.js"></script>
<script src="js/auth.js"></script>
<script src="js/reports.js"></script>
<script src="js/admin.js"></script>
<script src="js/edukasi.js"></script>
<script src="js/a11y.js"></script>
<script src="js/safety.js"></script>
<script src="js/app.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

`app.js` dimuat terakhir karena bergantung pada semua modul lain.

### Module Pattern

Setiap file menggunakan global namespace:

```javascript
// js/auth.js
(function() {
  let currentLoginMode = 'mahasiswa';
  
  window.switchLoginTab = function(mode) { ... };
  window.handleMainLogin = function(event) { ... };
  window.handleLogout = function() { ... };
  // etc.
})();
```

### app.js Refactored Responsibilities

```javascript
// Global state
let currentUser = null;
let reportData = [];
let currentViewedInvoiceId = null;

// Boot
document.addEventListener('DOMContentLoaded', function() {
  currentUser = Storage.load('currentUser', null);
  reportData = Storage.load('reports', []);
  
  if (currentUser) updateNavForUser(currentUser);
  
  setupEventListeners();  // semua inline handlers dipindah ke sini
  handleRouting();
});

// Routing (tetap di sini)
function handleRouting() { ... }

// Nav update helper
function updateNavForUser(user) {
  if (!user) {
    document.getElementById('navGuest').classList.remove('hidden');
    document.getElementById('navUser').classList.add('hidden');
    document.getElementById('navAdmin').classList.add('hidden');
  } else if (user.role === 'admin') {
    document.getElementById('navGuest').classList.add('hidden');
    document.getElementById('navUser').classList.add('hidden');
    document.getElementById('navAdmin').classList.remove('hidden');
  } else {
    document.getElementById('navGuest').classList.add('hidden');
    document.getElementById('navUser').classList.remove('hidden');
    document.getElementById('navAdmin').classList.add('hidden');
  }
}
```

## [S6] Implementation Order

| Step | Task | Files Touched | Depends On |
|------|------|---------------|------------|
| 1 | Create `.gitignore`, delete `ftp.txt`, delete `assets_placeholder` | `.gitignore`, delete `ftp.txt`, delete `assets_placeholder` | — |
| 2 | Create `js/` directory, create `storage.js` | `js/storage.js` | — |
| 3 | Create `js/utils.js` with `sanitizeInput` and `showTopSystemAlert` | `js/utils.js` | — |
| 4 | Create `js/auth.js` — move login/register/logout/password logic | `js/auth.js` | Step 3 |
| 5 | Create `js/reports.js` — move submit/invoice/report data logic | `js/reports.js` | Step 2, 3 |
| 6 | Create `js/admin.js` — move admin dashboard/chart/seed/detail logic | `js/admin.js` | Step 2, 3, 5 |
| 7 | Create `js/edukasi.js` — move bystander simulation | `js/edukasi.js` | Step 3 |
| 8 | Create `js/a11y.js` — move accessibility widget logic | `js/a11y.js` | Step 3 |
| 9 | Create `js/safety.js` — move quick escape and sentiment analysis | `js/safety.js` | Step 3 |
| 10 | Refactor `app.js` — orchestrator with init, routing, setupEventListeners, localStorage integration | `app.js`, `index.html` (script tags) | Steps 2-9 |
| 11 | Remove all inline event handlers from `index.html` | `index.html` | Step 10 |
| 12 | Update `index.html` CSP meta tag if safe to do so | `index.html` | Step 11 |
| 13 | Manual test: routing, login, register, laporan, admin, edukasi, aksesibilitas, quick escape | — | Step 12 |

## [S7] Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing functionality during refactor | Test each module independently before integration |
| localStorage quota exceeded | Add try/catch in storage.js, log warning |
| Dynamic onclick handlers (in report items) harder to refactor | Use event delegation on parent container |
| CSP `unsafe-inline` still needed for styles | Accept for MVP, document as future improvement |

## [S8] Success Criteria

- [ ] Semua inline JS event handlers dihapus dari `index.html`
- [ ] `sanitizeInput()` menggunakan `createTextNode` approach
- [ ] `ftp.txt` dan `assets_placeholder` tidak ada di repo
- [ ] Data laporan persist setelah browser refresh
- [ ] Login session persist setelah browser refresh
- [ ] `app.js` tidak lebih dari 150 baris
- [ ] Semua fitur berfungsi normal (routing, login, laporan, admin, edukasi, aksesibilitas, quick escape)
- [ ] Tidak ada regressions pada UI/UX
