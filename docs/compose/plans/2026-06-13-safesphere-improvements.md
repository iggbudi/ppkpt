# SafeSphere Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve SafeSphere security (CSP, XSS), add localStorage persistence, and modularize app.js into focused files.

**Architecture:** Incremental refactor — no new frameworks, no backend. Keep SPA pattern. Split 883-line app.js into 8 focused modules under `js/`. Add localStorage wrapper for persistence. Remove inline event handlers and harden sanitization.

**Tech Stack:** Vanilla JS, localStorage, Chart.js (CDN)

---

## File Structure

```
js/
  storage.js      ← NEW: localStorage wrapper
  utils.js        ← NEW: sanitizeInput, showTopSystemAlert
  auth.js         ← NEW: login, register, logout, password modal
  reports.js      ← NEW: submit, invoice, report data management
  admin.js        ← NEW: admin dashboard, chart, seed, detail modal
  edukasi.js      ← NEW: bystander simulation game
  a11y.js         ← NEW: accessibility widget
  safety.js       ← NEW: quick escape, sentiment analysis
  app.js          ← REFACTORED: orchestrator, init, routing
```

Delete: `ftp.txt`, `assets_placeholder`
Create: `.gitignore`

---

### Task 1: Cleanup — Delete sensitive files, create .gitignore

**Covers:** [S1]

**Files:**
- Create: `.gitignore`
- Delete: `ftp.txt`
- Delete: `assets_placeholder`

- [ ] **Step 1: Create .gitignore**

```gitignore
ftp.txt
.env
.env.*
*.log
node_modules/
```

- [ ] **Step 2: Delete ftp.txt and assets_placeholder**

Run:
```bash
del ftp.txt
del assets_placeholder
```

- [ ] **Step 3: Verify deletion**

Run:
```bash
dir
```
Expected: No `ftp.txt` or `assets_placeholder` in listing.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore, remove credentials and stale placeholder"
```

---

### Task 2: Create localStorage wrapper (storage.js)

**Covers:** [S4]

**Files:**
- Create: `js/storage.js`

- [ ] **Step 1: Create js/ directory**

Run:
```bash
mkdir js
```

- [ ] **Step 2: Create js/storage.js**

```javascript
(function() {
  var PREFIX = 'safesphere_';

  window.Storage = {
    save: function(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (e) {
        console.warn('Storage.save failed:', e);
      }
    },
    load: function(key, fallback) {
      try {
        var data = localStorage.getItem(PREFIX + key);
        return data ? JSON.parse(data) : (fallback || null);
      } catch (e) {
        console.warn('Storage.load failed:', e);
        return fallback || null;
      }
    },
    remove: function(key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (e) {
        console.warn('Storage.remove failed:', e);
      }
    }
  };
})();
```

- [ ] **Step 3: Commit**

```bash
git add js/storage.js
git commit -m "feat: add localStorage wrapper for data persistence"
```

---

### Task 3: Create utils.js with sanitizeInput and showTopSystemAlert

**Covers:** [S1]

**Files:**
- Create: `js/utils.js`

- [ ] **Step 1: Create js/utils.js**

```javascript
(function() {
  window.sanitizeInput = function(text) {
    var element = document.createElement('div');
    element.appendChild(document.createTextNode(text || ''));
    return element.innerHTML;
  };

  window.showTopSystemAlert = function(message) {
    var alertDiv = document.createElement('div');
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.background = '#fee2e2';
    alertDiv.style.color = '#991b1b';
    alertDiv.style.padding = '14px 24px';
    alertDiv.style.borderRadius = '10px';
    alertDiv.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.fontWeight = '600';
    alertDiv.style.fontSize = '14px';
    alertDiv.style.border = '1px solid #fecaca';
    alertDiv.innerText = message;

    document.body.appendChild(alertDiv);
    setTimeout(function() { alertDiv.remove(); }, 3500);
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/utils.js
git commit -m "feat: add utils module with sanitizeInput and showTopSystemAlert"
```

---

### Task 4: Create auth.js — login, register, logout, password modal

**Covers:** [S3]

**Files:**
- Create: `js/auth.js`

- [ ] **Step 1: Create js/auth.js**

```javascript
(function() {
  var currentLoginMode = 'mahasiswa';

  window.switchLoginTab = function(mode) {
    currentLoginMode = mode;
    var tabM = document.getElementById('tabMahasiswa');
    var tabA = document.getElementById('tabAdmin');
    var subtitle = document.getElementById('loginSubtitle');
    var emailInput = document.getElementById('loginEmail');
    var errorBox = document.getElementById('loginError');

    if (errorBox) errorBox.classList.add('hidden');

    if (mode === 'admin') {
      tabM.style.borderBottomColor = 'transparent';
      tabM.style.color = 'var(--muted)';
      tabA.style.borderBottomColor = 'var(--primary)';
      tabA.style.color = 'var(--primary)';
      subtitle.innerHTML = 'Gunakan kredensial admin Anda.<br><em>(Demo: Username: <b>admin</b>, Password: <b>safesphere</b>)</em>';
      emailInput.placeholder = 'Username admin';
    } else {
      tabA.style.borderBottomColor = 'transparent';
      tabA.style.color = 'var(--muted)';
      tabM.style.borderBottomColor = 'var(--primary)';
      tabM.style.color = 'var(--primary)';
      subtitle.innerText = 'Silakan masukkan email/nama dan password Anda untuk melanjutkan.';
      emailInput.placeholder = 'Masukkan nama atau email';
    }
  };

  window.handleMainLogin = function(event) {
    event.preventDefault();
    var user = sanitizeInput(document.getElementById('loginEmail').value);
    var pass = document.getElementById('loginPass').value;
    var errorBox = document.getElementById('loginError');

    errorBox.classList.add('hidden');
    errorBox.innerText = '';

    if (!user || !pass) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Nama/Email dan Password tidak boleh kosong!';
      return;
    }

    if (currentLoginMode === 'admin' || user === 'admin') {
      if (user !== 'admin' || pass !== 'safesphere') {
        errorBox.classList.remove('hidden');
        errorBox.innerHTML = '<strong>AKSES DITOLAK:</strong> Kredensial Admin salah.';
        return;
      }

      currentUser = { role: 'admin', name: 'Admin PPKS' };
      Storage.save('currentUser', currentUser);

      document.getElementById('navGuest').classList.add('hidden');
      document.getElementById('navUser').classList.add('hidden');
      document.getElementById('navAdmin').classList.remove('hidden');
      document.getElementById('welcomeMessage').classList.remove('hidden');
      document.getElementById('welcomeName').innerText = currentUser.name;

      window.location.hash = '#admin';
    } else {
      currentUser = { role: 'mahasiswa', name: user };
      Storage.save('currentUser', currentUser);

      document.getElementById('navGuest').classList.add('hidden');
      document.getElementById('navAdmin').classList.add('hidden');
      document.getElementById('navUser').classList.remove('hidden');
      document.getElementById('userNameDisplay').innerText = 'Halo, ' + user + '!';
      document.getElementById('welcomeMessage').classList.remove('hidden');
      document.getElementById('welcomeName').innerText = currentUser.name;

      window.location.hash = '#dashboard';
    }

    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPass').value = '';
  };

  window.handleLogout = function() {
    currentUser = null;
    Storage.remove('currentUser');

    document.getElementById('navGuest').classList.remove('hidden');
    document.getElementById('navUser').classList.add('hidden');
    document.getElementById('navAdmin').classList.add('hidden');
    document.getElementById('welcomeMessage').classList.add('hidden');
    document.getElementById('invoiceResult').classList.add('hidden');
    currentViewedInvoiceId = null;

    window.location.hash = '#beranda';
  };

  window.openForgotModal = function(event) {
    event.preventDefault();
    document.getElementById('forgotPasswordModal').classList.add('show');
  };

  window.closeForgotModal = function() {
    document.getElementById('forgotPasswordModal').classList.remove('show');
  };

  window.sendOTP = function(event) {
    event.preventDefault();
    var target = sanitizeInput(document.getElementById('otpTarget').value);
    if (!target) {
      showTopSystemAlert('Mohon masukkan No. HP atau Email terlebih dahulu.');
      return;
    }
    var btn = event.target;
    btn.innerText = 'Mengirim OTP...';
    btn.style.opacity = '0.7';

    setTimeout(function() {
      btn.innerText = 'Kirim Kode OTP';
      btn.style.opacity = '1';
      showTopSystemAlert('Kode OTP berhasil dikirim ke: ' + target);
      closeForgotModal();
    }, 1500);
  };

  window.toggleStatusFields = function() {
    var status = document.getElementById('regStatus').value;
    var contInstansi = document.getElementById('containerInstansi');
    var contPeran = document.getElementById('containerPeran');

    if (status === 'Mahasiswa' || status === 'Umum') {
      contInstansi.style.display = 'block';
      contPeran.style.display = 'block';
    } else if (status === 'Lainnya') {
      contInstansi.style.display = 'block';
      contPeran.style.display = 'none';
    } else {
      contInstansi.style.display = 'none';
      contPeran.style.display = 'none';
    }
  };

  window.checkPasswordStrength = function() {
    var pw = document.getElementById('regPassword').value;
    var helper = document.getElementById('pwHelper');
    if (pw.length === 0) {
      helper.className = 'form-helper';
      helper.innerText = 'Minimal 6 karakter, 1 huruf kapital, 1 angka, dan 1 karakter spesial.';
      return false;
    }
    if (/[A-Z]/.test(pw) && /\d/.test(pw) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(pw) && pw.length >= 6) {
      helper.className = 'form-helper text-success';
      helper.innerText = 'Struktur password sangat kuat dan aman.';
      return true;
    } else {
      helper.className = 'form-helper text-danger';
      helper.innerText = 'Belum memenuhi: Min 6 karakter, 1 Kapital, 1 Angka, & 1 Karakter Spesial.';
      return false;
    }
  };

  window.handleRegister = function(event) {
    event.preventDefault();

    var errorBox = document.getElementById('registerError');
    var resultBox = document.getElementById('registerResult');

    errorBox.classList.add('hidden');
    errorBox.innerText = '';
    resultBox.classList.add('hidden');

    var name = sanitizeInput(document.getElementById('regName').value);
    var status = document.getElementById('regStatus').value;
    var instansi = sanitizeInput(document.getElementById('regInstansi').value);
    var peran = sanitizeInput(document.getElementById('regPeran').value);
    var email = sanitizeInput(document.getElementById('regEmail').value);
    var pw = document.getElementById('regPassword').value;
    var pwConfirm = document.getElementById('regConfirmPassword').value;

    if (!name || !status || !email || !pw || !pwConfirm) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Semua kolom bertanda bintang wajib diisi!';
      return;
    }

    if ((status === 'Mahasiswa' || status === 'Umum') && (!instansi || !peran)) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Informasi Instansi dan Peran wajib dilengkapi!';
      return;
    }

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Format alamat email tidak valid!';
      return;
    }

    if (!checkPasswordStrength()) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Struktur password terlalu lemah.';
      return;
    }

    if (pw !== pwConfirm) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Konfirmasi kata sandi tidak cocok.';
      return;
    }

    var btn = event.target.querySelector('button[type="submit"]');
    btn.innerText = 'Mendaftarkan...';
    btn.style.opacity = '0.7';

    setTimeout(function() {
      btn.innerText = 'Daftar Sekarang';
      btn.style.opacity = '1';

      resultBox.classList.remove('hidden');
      resultBox.classList.add('success');
      resultBox.innerHTML = '<strong>Registrasi Berhasil!</strong> Akun Anda terverifikasi. Silakan menuju <a href="#login">Login</a>.';
      event.target.reset();
      document.getElementById('pwHelper').className = 'form-helper';
      document.getElementById('pwHelper').innerText = 'Minimal 6 karakter, 1 huruf kapital, 1 angka, dan 1 karakter spesial.';
    }, 1500);
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/auth.js
git commit -m "feat: add auth module with login, register, logout, password modal"
```

---

### Task 5: Create reports.js — submit, invoice, report data management

**Covers:** [S4]

**Files:**
- Create: `js/reports.js`

- [ ] **Step 1: Create js/reports.js**

```javascript
(function() {
  window.currentViewedInvoiceId = null;

  window.submitReport = function(event) {
    event.preventDefault();
    var resultBox = document.getElementById('reportResult');
    var btn = event.target.querySelector('button[type="submit"]');

    btn.innerText = 'Mengamankan Laporan...';
    btn.style.opacity = '0.7';

    setTimeout(function() {
      var trackingID = 'SSF-2026-' + Math.floor(1000 + Math.random() * 9000);
      var evidenceInput = document.getElementById('evidence');
      var evidenceName = 'Tidak ada lampiran';
      if (evidenceInput.files.length > 0) {
        evidenceName = sanitizeInput(evidenceInput.files[0].name);
      }

      var checkboxAnon = document.getElementById('isAnonymous');
      var isAnon = checkboxAnon ? checkboxAnon.checked : true;

      var originalName = currentUser ? currentUser.name : 'Anonim';
      var maskedName = originalName !== 'Anonim' ? originalName.charAt(0).toUpperCase() + '***' : 'Anonim';

      var newReport = {
        id: trackingID,
        cat: document.getElementById('category').value,
        loc: sanitizeInput(document.getElementById('location').value),
        urg: document.getElementById('urgent').value,
        date: document.getElementById('incidentDate').value,
        status: 'Baru Masuk',
        desc: sanitizeInput(document.getElementById('description').value),
        evidence: evidenceName,
        appointment: 'Menunggu proses peninjauan awal dari tim Satgas.',
        createdAt: Date.now(),
        author: originalName,
        displayName: isAnon ? maskedName : originalName
      };

      reportData.unshift(newReport);
      Storage.save('reports', reportData);

      if (window.location.hash === '#admin') updateDashboardUI();
      if (window.location.hash === '#dashboard') updateUserDashboardUI();

      btn.innerText = 'Kirim Laporan Terenkripsi';
      btn.style.opacity = '1';

      resultBox.classList.remove('hidden');
      resultBox.classList.add('success');
      resultBox.innerHTML = '<strong>Laporan Berhasil Terkirim & Terenkripsi!</strong><br><br>' +
        'Nomor Pelacakan Anda: <b style="font-size:18px; color:var(--ink);">' + trackingID + '</b><br>' +
        '<em>Harap simpan nomor ini. Data terenkripsi end-to-end.</em><br><br>' +
        '<button class="btn secondary" type="button" onclick="viewInvoiceFromSubmit(\'' + trackingID + '\')" style="margin-top: 10px;">Lacak Status Laporan Ini</button>';

      event.target.reset();
    }, 1500);
  };

  window.viewInvoiceFromSubmit = function(id) {
    window.location.hash = '#dashboard';
    setTimeout(function() {
      var report = reportData.find(function(r) { return r.id === id; });
      if (report) {
        document.getElementById('invoiceResult').classList.remove('hidden');
        renderInvoice(report);
        document.getElementById('invoiceResult').scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  function renderInvoice(report) {
    currentViewedInvoiceId = report.id;
    var invoiceBox = document.getElementById('invoiceResult');

    var t1 = '', t2 = '', t3 = '', t4 = '';
    if (report.status === 'Baru Masuk') {
      t1 = 'active';
    } else if (report.status === 'Direview') {
      t1 = 'done'; t2 = 'active';
    } else if (report.status === 'Diproses') {
      t1 = 'done'; t2 = 'done'; t3 = 'active';
    } else if (report.status === 'Selesai') {
      t1 = 'done'; t2 = 'done'; t3 = 'done'; t4 = 'done';
    }

    invoiceBox.innerHTML = '<div class="invoice-header">' +
      '<h3>Tanda Terima Pengaduan</h3>' +
      '<p class="muted" style="margin:0;">No. Pelacakan: <strong>' + report.id + '</strong></p>' +
      '</div>' +
      '<div class="invoice-details">' +
      '<div><span>Tanggal Kejadian:</span><br><strong>' + report.date + '</strong></div>' +
      '<div><span>Kategori:</span><br><strong>' + report.cat + '</strong></div>' +
      '<div><span>Lokasi:</span><br><strong>' + report.loc + '</strong></div>' +
      '<div><span>Tingkat Urgensi:</span><br><strong>' + report.urg + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Lampiran Bukti:</span><br><strong style="color: var(--primary);">' + (report.evidence || 'Tidak ada lampiran') + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Kronologi Singkat:</span><br><strong style="font-weight: 500; font-size: 13px; line-height: 1.5; margin-top: 4px;">"' + report.desc + '"</strong></div>' +
      '</div>' +
      '<div class="timeline-container">' +
      '<h4 style="margin: 0 0 16px 0;">Update Status Pelaporan</h4>' +
      '<ul class="timeline">' +
      '<li class="timeline-item ' + (t1 || 'done') + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Laporan Diterima</h4><p>Laporan masuk ke sistem aman.</p></div></li>' +
      '<li class="timeline-item ' + t2 + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Tahap Review (Verifikasi)</h4><p>Tim admin memverifikasi kelayakan berkas.</p></div></li>' +
      '<li class="timeline-item ' + t3 + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Sedang Diproses</h4><p>Kasus ditangani unit kemahasiswaan/Satgas PPKS.</p></div></li>' +
      '<li class="timeline-item ' + t4 + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Tindak Lanjut & Appointment</h4><p style="color: var(--primary); font-weight: 600; margin-top: 4px;">Info: ' + report.appointment + '</p></div></li>' +
      '</ul>' +
      '</div>';
  }

  window.renderInvoice = renderInvoice;

  window.updateUserDashboardUI = function() {
    if (!currentUser || currentUser.role !== 'mahasiswa') return;
    var listContainer = document.getElementById('userReportList');
    var userReports = reportData.filter(function(r) { return r.author === currentUser.name; });

    if (userReports.length === 0) {
      listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Anda belum pernah membuat laporan.</p>';
      return;
    }

    listContainer.innerHTML = '';
    userReports.forEach(function(report) {
      var riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
      var html = '<div class="report-item" onclick="viewInvoiceFromSubmit(\'' + report.id + '\')">' +
        '<div class="report-info">' +
        '<h4>' + report.id + ' <span style="color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;">' + report.date + '</span></h4>' +
        '<p><b>Kategori:</b> ' + report.cat + ' &bull; <b>Status Laporan:</b> <span style="color:var(--primary); font-weight:bold;">' + report.status + '</span></p>' +
        '</div>' +
        '<div class="risk-badge ' + riskClass + '">Lihat Invoice &gt;</div>' +
        '</div>';
      listContainer.insertAdjacentHTML('beforeend', html);
    });
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/reports.js
git commit -m "feat: add reports module with submit, invoice, user dashboard"
```

---

### Task 6: Create admin.js — admin dashboard, chart, seed data, detail modal

**Covers:** [S3, S4]

**Files:**
- Create: `js/admin.js`

- [ ] **Step 1: Create js/admin.js**

```javascript
(function() {
  var chartInstance = null;

  window.initChart = function() {
    var ctx = document.getElementById('categoryChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Verbal', 'Sosial', 'Cyberbullying', 'Fisik', 'Seksual'],
        datasets: [{
          label: 'Jumlah Laporan',
          data: [0, 0, 0, 0, 0],
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  };

  window.seedDemoData = function() {
    var dummies = [
      { id: 'SSF-2026-1001', cat: 'Cyberbullying', loc: 'Grup WA Kelas', urg: 'Tinggi', date: '2026-06-02', status: 'Baru Masuk', desc: 'Saya diejek dan foto saya disebar di grup tanpa izin.', evidence: 'demo-bukti.png', appointment: 'Menunggu proses peninjauan awal.', createdAt: Date.now() - 20000, author: 'demo_user', displayName: 'D***' },
      { id: 'SSF-2026-1002', cat: 'Verbal', loc: 'Ruang Kelas', urg: 'Sedang', date: '2026-06-05', status: 'Direview', desc: 'Saya sering dihina soal penampilan saat presentasi.', evidence: 'Tidak ada lampiran', appointment: 'Sedang dalam peninjauan bukti oleh Admin.', createdAt: Date.now() - 15000, author: 'demo_user', displayName: 'demo_user' },
      { id: 'SSF-2026-1003', cat: 'Sosial', loc: 'Lingkungan Kampus', urg: 'Rendah', date: '2026-06-06', status: 'Selesai', desc: 'Teman saya dikucilkan dari kelompok tugas.', evidence: 'Tidak ada lampiran', appointment: 'Telah dilakukan mediasi dan edukasi pencegahan.', createdAt: Date.now() - 10000, author: 'demo_user', displayName: 'D***' },
      { id: 'SSF-2026-1004', cat: 'Fisik', loc: 'Parkiran Kampus', urg: 'Tinggi', date: '2026-06-08', status: 'Diproses', desc: 'Ada tindakan represif dan ancaman jika saya melapor.', evidence: 'rekaman_suara.mp3', appointment: 'Jadwal Konseling: Kasus dialihkan ke Satgas PPKS.', createdAt: Date.now() - 5000, author: 'demo_user', displayName: 'demo_user' }
    ];

    reportData = dummies.slice();
    Storage.save('reports', reportData);
    updateDashboardUI();
    showTopSystemAlert('Data demo berhasil dimuat!');
  };

  window.clearAllData = function() {
    if (confirm('Apakah Anda yakin ingin menghapus semua data laporan demo?')) {
      reportData = [];
      Storage.remove('reports');
      updateDashboardUI();
    }
  };

  window.updateDashboardUI = function() {
    var total = reportData.length;
    var tinggi = reportData.filter(function(r) { return r.urg === 'Tinggi'; }).length;
    var selesai = reportData.filter(function(r) { return r.status === 'Selesai'; }).length;

    var catCounts = {};
    var dominant = '-';
    var maxCount = 0;
    reportData.forEach(function(r) {
      catCounts[r.cat] = (catCounts[r.cat] || 0) + 1;
      if (catCounts[r.cat] > maxCount) { maxCount = catCounts[r.cat]; dominant = r.cat; }
    });

    document.getElementById('m-total').innerText = total;
    document.getElementById('m-tinggi').innerText = tinggi;
    document.getElementById('m-selesai').innerText = selesai;
    document.getElementById('m-dominan').innerText = dominant;

    if (chartInstance) {
      chartInstance.data.datasets[0].data = [
        catCounts['Verbal'] || 0, catCounts['Sosial'] || 0, catCounts['Cyberbullying'] || 0, catCounts['Fisik'] || 0, catCounts['Seksual'] || 0
      ];
      chartInstance.update();
    }

    var listContainer = document.getElementById('adminReportList');
    if (reportData.length === 0) {
      listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Belum ada data laporan.</p>';
      return;
    }

    listContainer.innerHTML = '';
    reportData.forEach(function(report) {
      var riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
      var html = '<div class="report-item" onclick="viewReportDetail(\'' + report.id + '\')">' +
        '<div class="report-info">' +
        '<h4>' + report.id + ' <span style="color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;">' + report.date + '</span></h4>' +
        '<p><b>Kategori:</b> ' + report.cat + ' &bull; <b>Pelapor:</b> ' + (report.displayName || report.author) + ' &bull; <b>Status:</b> <span style="color:var(--primary);">' + report.status + '</span></p>' +
        '</div>' +
        '<div class="risk-badge ' + riskClass + '">Urgensi ' + report.urg + '</div>' +
        '</div>';
      listContainer.insertAdjacentHTML('beforeend', html);
    });
  };

  var currentDetailId = null;

  window.viewReportDetail = function(id) {
    var report = reportData.find(function(r) { return r.id === id; });
    if (!report) return;
    currentDetailId = id;

    document.getElementById('detailTitle').innerText = 'Detail Kasus ' + report.id;

    var content = '<div style="grid-column: 1 / -1; background: #e8f0ff; padding: 12px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 8px;">' +
      '<span style="color: var(--primary2);">Pelapor:</span><br>' +
      '<strong style="font-size: 16px; color: var(--primary);">' + (report.displayName || report.author) + '</strong>' +
      '</div>' +
      '<div><span>Waktu Kejadian:</span><br><strong>' + report.date + '</strong></div>' +
      '<div><span>Kategori:</span><br><strong>' + report.cat + '</strong></div>' +
      '<div><span>Lokasi Kejadian:</span><br><strong>' + report.loc + '</strong></div>' +
      '<div><span>Tingkat Risiko:</span><br><strong>' + report.urg + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Lampiran Bukti:</span><br><strong style="color: var(--primary);">' + (report.evidence || 'Tidak ada lampiran') + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Kronologi Lengkap:</span><br><strong style="font-weight: 500; font-size: 14px; line-height: 1.5; margin-top: 4px;">"' + report.desc + '"</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Status Terakhir:</span><br><strong style="color: var(--primary);">' + report.status + '</strong></div>';
    document.getElementById('detailContent').innerHTML = content;

    var selectStatus = report.status;
    if (selectStatus === 'Baru Masuk' || selectStatus === 'Direview' || selectStatus === 'Diproses' || selectStatus === 'Selesai') {
      document.getElementById('updateStatusSelect').value = selectStatus;
    } else {
      document.getElementById('updateStatusSelect').value = 'Baru Masuk';
    }

    document.getElementById('updateAppointment').value = report.appointment || '';
    document.getElementById('reportDetailModal').classList.add('show');
  };

  window.closeReportDetailModal = function() {
    document.getElementById('reportDetailModal').classList.remove('show');
    currentDetailId = null;
  };

  window.saveReportStatus = function() {
    if (!currentDetailId) return;
    var report = reportData.find(function(r) { return r.id === currentDetailId; });
    if (report) {
      var newStatus = document.getElementById('updateStatusSelect').value;
      var newAppt = sanitizeInput(document.getElementById('updateAppointment').value) || 'Menunggu pembaruan lanjutan...';

      report.status = newStatus;
      report.appointment = newAppt;
      Storage.save('reports', reportData);
      updateDashboardUI();
      updateUserDashboardUI();

      closeReportDetailModal();
      showTopSystemAlert('Berhasil! Status terupdate secara real-time.');
    }
  };

  window.addEventListener('click', function(event) {
    var modal1 = document.getElementById('reportDetailModal');
    var modal2 = document.getElementById('forgotPasswordModal');
    if (event.target === modal1) closeReportDetailModal();
    if (event.target === modal2) closeForgotModal();
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/admin.js
git commit -m "feat: add admin module with dashboard, chart, seed, detail modal"
```

---

### Task 7: Create edukasi.js — bystander simulation game

**Covers:** [S3]

**Files:**
- Create: `js/edukasi.js`

- [ ] **Step 1: Create js/edukasi.js**

```javascript
(function() {
  var storyNodes = {
    start: {
      text: 'Anda sedang duduk di kantin fakultas dan melihat seorang mahasiswa baru didorong dan diejek oleh sekelompok senior. Mereka merekam kejadian tersebut sambil tertawa. Apa tindakan pertama Anda?',
      options: [
        { text: 'A. Langsung menghampiri, marah, dan membentak para senior tersebut.', nextNode: 'agresif' },
        { text: 'B. Pura-pura tidak melihat sambil melanjutkan makan agar tidak ikut terseret.', nextNode: 'pasif' },
        { text: 'C. Menjauh ke titik aman, merekam diam-diam sebagai bukti, lalu melapor ke SafeSphere.', nextNode: 'pintar' }
      ],
      feedback: null
    },
    agresif: {
      text: 'Anda mencoba melawan. Namun karena kalah jumlah, Anda kini malah ikut menjadi target intimidasi fisik dan verbal mereka. Bertindak heroik dengan emosi seringkali bukan solusi yang aman.',
      options: [
        { text: 'Ulangi Simulasi', nextNode: 'start' }
      ],
      feedback: { type: 'error', message: '<strong>Berbahaya!</strong> Menghadapi pelaku secara langsung tanpa perhitungan bisa membahayakan keselamatan diri Anda.' }
    },
    pasif: {
      text: 'Korban semakin dipermalukan. Karena tidak ada mahasiswa lain yang berani bertindak, pelaku merasa perilaku mereka wajar dan kekerasan semakin dinormalisasi di kampus.',
      options: [
        { text: 'Ulangi Simulasi', nextNode: 'start' }
      ],
      feedback: { type: 'error', message: '<strong>Efek Bystander (Pembiaran):</strong> Diam berarti secara tidak langsung Anda membiarkan perundungan terus terjadi.' }
    },
    pintar: {
      text: 'Tepat sekali! Anda berhasil mendapatkan bukti rekaman wajah pelaku tanpa membahayakan diri sendiri. Laporan anonim Anda di SafeSphere langsung diproses oleh Satgas PPKS, dan korban segera mendapatkan perlindungan.',
      options: [
        { text: 'Mainkan Lagi', nextNode: 'start' }
      ],
      feedback: { type: 'success', message: '<strong>Langkah Cerdas!</strong> Mengamankan bukti dan melapor secara terenkripsi adalah tindakan paling efektif untuk memutus rantai perundungan.' }
    }
  };

  function renderStoryNode(nodeId) {
    var node = storyNodes[nodeId];
    var textEl = document.getElementById('gameText');
    var optionsEl = document.getElementById('gameOptions');
    var feedbackEl = document.getElementById('gameFeedback');
    var sceneEl = document.getElementById('gameScene');

    sceneEl.style.opacity = 0;

    setTimeout(function() {
      textEl.innerText = node.text;
      optionsEl.innerHTML = '';

      node.options.forEach(function(opt) {
        var btn = document.createElement('button');
        btn.innerText = opt.text;
        btn.onclick = function() { renderStoryNode(opt.nextNode); };
        optionsEl.appendChild(btn);
      });

      if (node.feedback) {
        feedbackEl.className = 'result ' + node.feedback.type;
        feedbackEl.innerHTML = node.feedback.message;
      } else {
        feedbackEl.className = 'result hidden';
      }

      sceneEl.style.opacity = 1;
    }, 300);
  }

  window.renderStoryNode = renderStoryNode;

  document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('gamificationContainer')) {
      renderStoryNode('start');
    }
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/edukasi.js
git commit -m "feat: add edukasi module with bystander simulation game"
```

---

### Task 8: Create a11y.js — accessibility widget

**Covers:** [S3]

**Files:**
- Create: `js/a11y.js`

- [ ] **Step 1: Create js/a11y.js**

```javascript
(function() {
  window.toggleA11yMenu = function() {
    var menu = document.getElementById('a11yMenu');
    if (menu.classList.contains('hidden')) {
      menu.classList.remove('hidden');
      menu.classList.add('show');
    } else {
      menu.classList.add('hidden');
      menu.classList.remove('show');
    }
  };

  window.toggleA11yFeature = function(feature) {
    var body = document.body;
    var className = 'a11y-' + feature;

    if (body.classList.contains(className)) {
      body.classList.remove(className);
      var modeName = feature === 'high-contrast' ? 'Kontras Tinggi' : (feature === 'large-text' ? 'Perbesar Teks' : 'Ramah Disleksia');
      showTopSystemAlert('Aksesibilitas: Mode ' + modeName + ' dinonaktifkan.');
    } else {
      body.classList.add(className);
      var modeName2 = feature === 'high-contrast' ? 'Kontras Tinggi' : (feature === 'large-text' ? 'Perbesar Teks' : 'Ramah Disleksia');
      showTopSystemAlert('Aksesibilitas: Mode ' + modeName2 + ' diaktifkan.');
    }

    toggleA11yMenu();
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/a11y.js
git commit -m "feat: add a11y module with accessibility widget"
```

---

### Task 9: Create safety.js — quick escape and sentiment analysis

**Covers:** [S3]

**Files:**
- Create: `js/safety.js`

- [ ] **Step 1: Create js/safety.js**

```javascript
(function() {
  var escPressCount = 0;
  var escTimer = null;
  var originalTitle = document.title;

  window.activateDiscreetMode = function() {
    document.getElementById('discreetOverlay').style.display = 'block';
    document.getElementById('quickEscapeBtn').style.display = 'none';
    document.title = 'Wikipedia bahasa Indonesia';
  };

  window.deactivateDiscreetMode = function() {
    document.getElementById('discreetOverlay').style.display = 'none';
    document.getElementById('quickEscapeBtn').style.display = 'flex';
    document.title = originalTitle;
  };

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      escPressCount++;

      if (escPressCount === 2) {
        activateDiscreetMode();
        escPressCount = 0;
      }

      clearTimeout(escTimer);
      escTimer = setTimeout(function() {
        escPressCount = 0;
      }, 1000);
    }
  });

  var triggerDictionary = {
    highRisk: [
      'bunuh', 'mati', 'ancam', 'mengancam', 'pukul', 'dipukul', 'hajar', 'dihajar',
      'tampar', 'ditampar', 'cekik', 'dicekik', 'bunuh diri', 'self harm', 'sayat',
      'kunci', 'dikunci', 'seksual', 'raba', 'diraba', 'leceh', 'dilecehkan', 'perkosa',
      'diperkosa', 'paksa', 'dipaksa', 'sebar video', 'sebar foto', 'telanjang',
      'senjata', 'pisau', 'darah', 'luka', 'depresi berat', 'akhiri hidup', 'doxing'
    ],
    medRisk: [
      'hina', 'menghina', 'ejek', 'diejek', 'olok', 'diolok', 'kucil', 'dikucilkan',
      'jauhi', 'dijauhi', 'fitnah', 'difitnah', 'cyberbullying', 'komentar jahat',
      'bodoh', 'jelek', 'miskin', 'cacat', 'sialan', 'palak', 'dipalak', 'uang',
      'ancaman ringan', 'intimidasi', 'malu', 'dipermalukan', 'labrak', 'dilabrak',
      'grup', 'sindir', 'disindir', 'toxic'
    ]
  };

  window.getRiskScore = function(text) {
    var score = 0;
    var lower = text.toLowerCase();

    triggerDictionary.highRisk.forEach(function(word) {
      if (lower.includes(word)) score += 5;
    });

    triggerDictionary.medRisk.forEach(function(word) {
      if (lower.includes(word)) score += 2;
    });

    return score;
  };

  window.analyzeSentiment = function() {
    var text = document.getElementById('description').value.toLowerCase();
    var bar = document.getElementById('sentimentBar');
    var label = document.getElementById('sentimentText');
    var urgensiDropdown = document.getElementById('urgent');

    if (text.trim().length === 0) {
      bar.style.width = '0%';
      bar.style.background = 'var(--ok)';
      label.innerText = 'Menganalisis teks...';
      label.style.color = 'var(--muted)';
      return;
    }

    var score = 0;
    var foundHighRisk = false;

    triggerDictionary.highRisk.forEach(function(word) {
      if (text.includes(word)) {
        score += 5;
        foundHighRisk = true;
      }
    });

    triggerDictionary.medRisk.forEach(function(word) {
      if (text.includes(word)) {
        score += 2;
      }
    });

    if (score >= 5 || foundHighRisk) {
      bar.style.width = '100%';
      bar.style.background = 'var(--danger)';
      label.innerText = 'Indikasi Darurat Terdeteksi';
      label.style.color = 'var(--danger)';
      urgensiDropdown.value = 'Tinggi';
    } else if (score >= 2) {
      bar.style.width = '60%';
      bar.style.background = 'var(--warn)';
      label.innerText = 'Indikasi Intimidasi Sedang';
      label.style.color = 'var(--warn)';
      if (urgensiDropdown.value === 'Rendah' || urgensiDropdown.value === '') {
        urgensiDropdown.value = 'Sedang';
      }
    } else {
      bar.style.width = '25%';
      bar.style.background = 'var(--ok)';
      label.innerText = 'Terpantau Stabil (Rendah)';
      label.style.color = 'var(--ok)';
    }
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/safety.js
git commit -m "feat: add safety module with quick escape and sentiment analysis"
```

---

### Task 10: Refactor app.js — orchestrator with init, routing, localStorage integration

**Covers:** [S3, S4, S5]

**Files:**
- Modify: `app.js` (rewrite)
- Modify: `index.html` (script tags)

- [ ] **Step 1: Rewrite app.js as orchestrator**

```javascript
// Global state
var currentUser = null;
var reportData = [];
var currentViewedInvoiceId = null;

function handleRouting() {
  var hash = window.location.hash || '#beranda';
  var validPages = ['#beranda', '#lapor', '#edukasi', '#kontak', '#chat', '#register', '#login', '#admin', '#dashboard'];

  if (validPages.indexOf(hash) === -1) {
    hash = '#beranda';
  }

  if (hash === '#lapor' && !currentUser) {
    showTopSystemAlert('Anda harus Masuk (Login) terlebih dahulu untuk membuat laporan.');
    window.location.hash = '#login';
    return;
  }
  if (hash === '#admin' && (!currentUser || currentUser.role !== 'admin')) {
    showTopSystemAlert('Akses Ditolak. Anda tidak memiliki otoritas Admin.');
    window.location.hash = '#login';
    return;
  }
  if (hash === '#dashboard' && (!currentUser || currentUser.role !== 'mahasiswa')) {
    showTopSystemAlert('Silakan login sebagai Mahasiswa untuk membuka Dashboard.');
    window.location.hash = '#login';
    return;
  }

  document.querySelectorAll('.page').forEach(function(page) { page.classList.remove('active'); });
  document.querySelectorAll('.main-nav a').forEach(function(link) { link.classList.remove('active'); });

  var targetPageId = 'page-' + hash.substring(1);
  var targetElement = document.getElementById(targetPageId);
  if (targetElement) targetElement.classList.add('active');

  var activeLink = document.querySelector('.main-nav a[href="' + hash + '"]');
  if (activeLink) activeLink.classList.add('active');

  if (hash === '#admin') {
    setTimeout(function() {
      if (typeof initChart === 'function' && !document.getElementById('categoryChart').dataset.initialized) {
        initChart();
        document.getElementById('categoryChart').dataset.initialized = 'true';
      }
      updateDashboardUI();
    }, 100);
  }
  if (hash === '#dashboard') {
    setTimeout(function() {
      updateUserDashboardUI();
    }, 100);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupEventListeners() {
  // Login form
  var loginForm = document.querySelector('#page-login form');
  if (loginForm) loginForm.addEventListener('submit', handleMainLogin);

  // Register form
  var registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  // Report form
  var reportForm = document.getElementById('reportForm');
  if (reportForm) reportForm.addEventListener('submit', submitReport);

  // Sentiment analysis on description input
  var descInput = document.getElementById('description');
  if (descInput) descInput.addEventListener('input', analyzeSentiment);

  // Password strength check
  var pwInput = document.getElementById('regPassword');
  if (pwInput) pwInput.addEventListener('input', checkPasswordStrength);

  // Status field toggle
  var statusSelect = document.getElementById('regStatus');
  if (statusSelect) statusSelect.addEventListener('change', toggleStatusFields);

  // Login tab switching
  var tabMahasiswa = document.getElementById('tabMahasiswa');
  var tabAdmin = document.getElementById('tabAdmin');
  if (tabMahasiswa) tabMahasiswa.addEventListener('click', function() { switchLoginTab('mahasiswa'); });
  if (tabAdmin) tabAdmin.addEventListener('click', function() { switchLoginTab('admin'); });

  // Logout buttons
  document.querySelectorAll('[onclick="handleLogout()"]').forEach(function(btn) {
    btn.removeAttribute('onclick');
    btn.addEventListener('click', handleLogout);
  });

  // Quick escape button
  var quickEscapeBtn = document.getElementById('quickEscapeBtn');
  if (quickEscapeBtn) {
    quickEscapeBtn.removeAttribute('onclick');
    quickEscapeBtn.addEventListener('click', activateDiscreetMode);
  }

  // Discreet mode close button
  var discreetClose = document.querySelector('#discreetOverlay button');
  if (discreetClose) {
    discreetClose.removeAttribute('onclick');
    discreetClose.addEventListener('click', deactivateDiscreetMode);
  }

  // Forgot password link
  var forgotLink = document.querySelector('[onclick="openForgotModal(event)"]');
  if (forgotLink) {
    forgotLink.removeAttribute('onclick');
    forgotLink.addEventListener('click', openForgotModal);
  }

  // OTP send button
  var otpBtn = document.querySelector('[onclick="sendOTP(event)"]');
  if (otpBtn) {
    otpBtn.removeAttribute('onclick');
    otpBtn.addEventListener('click', sendOTP);
  }

  // Admin buttons
  var seedBtn = document.querySelector('[onclick="seedDemoData()"]');
  if (seedBtn) {
    seedBtn.removeAttribute('onclick');
    seedBtn.addEventListener('click', seedDemoData);
  }

  var clearBtn = document.querySelector('[onclick="clearAllData()"]');
  if (clearBtn) {
    clearBtn.removeAttribute('onclick');
    clearBtn.addEventListener('click', clearAllData);
  }

  // Admin detail modal
  var detailClose = document.querySelector('[onclick="closeReportDetailModal()"]');
  if (detailClose) {
    detailClose.removeAttribute('onclick');
    detailClose.addEventListener('click', closeReportDetailModal);
  }

  var saveStatusBtn = document.querySelector('[onclick="saveReportStatus()"]');
  if (saveStatusBtn) {
    saveStatusBtn.removeAttribute('onclick');
    saveStatusBtn.addEventListener('click', saveReportStatus);
  }

  // A11y widget
  var a11yToggle = document.querySelector('[aria-label="Buka Menu Aksesibilitas"]');
  if (a11yToggle) {
    a11yToggle.removeAttribute('onclick');
    a11yToggle.addEventListener('click', toggleA11yMenu);
  }

  document.querySelectorAll('[onclick^="toggleA11yFeature"]').forEach(function(btn) {
    var feature = btn.getAttribute('onclick').match(/toggleA11yFeature\('(.+?)'\)/);
    if (feature) {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function() { toggleA11yFeature(feature[1]); });
    }
  });

  // Social login buttons (placeholder alerts)
  document.querySelectorAll('.btn-social').forEach(function(btn) {
    btn.removeAttribute('onclick');
    btn.addEventListener('click', function() {
      showTopSystemAlert('Fitur ini akan segera tersedia.');
    });
  });

  // Chat button (placeholder)
  var chatBtn = document.querySelector('#page-chat .btn-primary');
  if (chatBtn) {
    chatBtn.removeAttribute('onclick');
    chatBtn.addEventListener('click', function() {
      showTopSystemAlert('Membuka sesi Chat Aman...');
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  currentUser = Storage.load('currentUser', null);
  reportData = Storage.load('reports', []);

  if (currentUser) {
    if (currentUser.role === 'admin') {
      document.getElementById('navGuest').classList.add('hidden');
      document.getElementById('navUser').classList.add('hidden');
      document.getElementById('navAdmin').classList.remove('hidden');
    } else {
      document.getElementById('navGuest').classList.add('hidden');
      document.getElementById('navAdmin').classList.add('hidden');
      document.getElementById('navUser').classList.remove('hidden');
    }
    document.getElementById('welcomeMessage').classList.remove('hidden');
    document.getElementById('welcomeName').innerText = currentUser.name;
  }

  setupEventListeners();
  handleRouting();
});

window.addEventListener('hashchange', handleRouting);
```

- [ ] **Step 2: Update index.html script tags**

Replace the single `<script src="app.js"></script>` at the bottom of `index.html` with:

```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/reports.js"></script>
  <script src="js/admin.js"></script>
  <script src="js/edukasi.js"></script>
  <script src="js/a11y.js"></script>
  <script src="js/safety.js"></script>
  <script src="app.js"></script>
```

Note: Chart.js CDN moved to top of script block (before app.js) since admin.js uses it.

- [ ] **Step 3: Commit**

```bash
git add app.js index.html
git commit -m "refactor: app.js becomes orchestrator, load modular scripts"
```

---

### Task 11: Remove all inline event handlers from index.html

**Covers:** [S1]

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remove inline handlers from index.html**

Search and remove all `onclick=`, `onsubmit=`, `oninput=`, `onchange=` attributes from `index.html`. The handlers are now registered via `addEventListener` in `setupEventListeners()`.

Specific removals:
- Line 18: `onclick="deactivateDiscreetMode()"`
- Line 23: `onclick="activateDiscreetMode()"`
- Line 51: `onclick="handleLogout()"`
- Line 56: `onclick="handleLogout()"`
- Line 128: `onsubmit="submitReport(event)"`
- Line 157: `oninput="analyzeSentiment()"`
- Line 264: `onsubmit="handleRegister(event)"`
- Line 271: `onchange="toggleStatusFields()"`
- Line 294: `oninput="checkPasswordStrength()"`
- Line 319: `onclick="switchLoginTab('mahasiswa')"`
- Line 320: `onclick="switchLoginTab('admin')"`
- Line 326: `onsubmit="handleMainLogin(event)"`
- Line 333: `onclick="openForgotModal(event)"`
- Line 346: `onclick="alert('Membuka Login Google...')"`
- Line 355: `onclick="alert('Membuka Login Instagram...')"`
- Line 363: `onclick="alert('Kirim Magic Link ke Email...')"`
- Line 382: `onclick="sendOTP(event)"`
- Line 398: `onclick="seedDemoData()"`
- Line 399: `onclick="clearAllData()"`
- Line 439: `onclick="closeReportDetailModal()"`
- Line 458: `onclick="saveReportStatus()"`
- Line 249: `onclick="alert('Membuka sesi Chat Aman...')"`
- Line 472: `onclick="viewInvoiceFromSubmit(..."` (dynamic HTML, kept in JS)

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "security: remove all inline event handlers from HTML"
```

---

### Task 12: Final verification — test all features

**Covers:** [S1, S2, S3, S4, S5]

**Files:** None (verification only)

- [ ] **Step 1: Verify no inline handlers remain**

Run:
```bash
findstr /i "onclick\|onsubmit\|oninput\|onchange" index.html
```
Expected: No output (all inline handlers removed).

- [ ] **Step 2: Verify js/ files exist**

Run:
```bash
dir js\
```
Expected: 8 files — storage.js, utils.js, auth.js, reports.js, admin.js, edukasi.js, a11y.js, safety.js

- [ ] **Step 3: Verify deleted files**

Run:
```bash
dir ftp.txt 2>nul && echo EXISTS || echo DELETED
dir assets_placeholder 2>nul && echo EXISTS || echo DELETED
```
Expected: DELETED, DELETED

- [ ] **Step 4: Verify app.js line count**

Run:
```bash
find /c /v "" app.js
```
Expected: ~150 lines or less (down from 883)

- [ ] **Step 5: Manual browser test checklist**

Open `index.html` in browser and verify:
1. `#beranda` loads correctly with hero and SDG sections
2. `#login` — login as admin (`admin`/`safesphere`) → redirects to `#admin`
3. `#admin` — seed demo data → metrics and chart update
4. `#admin` — click report → modal opens → change status → save
5. Logout → back to guest nav
6. `#login` — login as any user → redirects to `#dashboard`
7. `#lapor` — submit report → tracking number shown
8. `#dashboard` — report appears in list → click → invoice shows
9. `#edukasi` — bystander simulation works
10. `#kontak` — emergency contacts display
11. Quick escape (Esc 2x) → overlay shows → X returns
12. A11y widget → toggle high contrast, large text, dyslexia
13. Refresh browser → data persists (reports and login)
14. `#register` — register new user → success message

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "chore: SafeSphere improvements — security, persistence, modularity"
```
