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
  var loginForm = document.querySelector('#page-login form');
  if (loginForm) loginForm.addEventListener('submit', handleMainLogin);

  var registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  var reportForm = document.getElementById('reportForm');
  if (reportForm) reportForm.addEventListener('submit', submitReport);

  var descInput = document.getElementById('description');
  if (descInput) descInput.addEventListener('input', analyzeSentiment);

  var pwInput = document.getElementById('regPassword');
  if (pwInput) pwInput.addEventListener('input', checkPasswordStrength);

  var statusSelect = document.getElementById('regStatus');
  if (statusSelect) statusSelect.addEventListener('change', toggleStatusFields);

  var tabMahasiswa = document.getElementById('tabMahasiswa');
  var tabAdmin = document.getElementById('tabAdmin');
  if (tabMahasiswa) tabMahasiswa.addEventListener('click', function() { switchLoginTab('mahasiswa'); });
  if (tabAdmin) tabAdmin.addEventListener('click', function() { switchLoginTab('admin'); });

  document.querySelectorAll('[onclick="handleLogout()"]').forEach(function(btn) {
    btn.removeAttribute('onclick');
    btn.addEventListener('click', handleLogout);
  });

  var quickEscapeBtn = document.getElementById('quickEscapeBtn');
  if (quickEscapeBtn) {
    quickEscapeBtn.removeAttribute('onclick');
    quickEscapeBtn.addEventListener('click', activateDiscreetMode);
  }

  var discreetClose = document.querySelector('#discreetOverlay button');
  if (discreetClose) {
    discreetClose.removeAttribute('onclick');
    discreetClose.addEventListener('click', deactivateDiscreetMode);
  }

  var forgotLink = document.querySelector('[onclick="openForgotModal(event)"]');
  if (forgotLink) {
    forgotLink.removeAttribute('onclick');
    forgotLink.addEventListener('click', openForgotModal);
  }

  var otpBtn = document.querySelector('[onclick="sendOTP(event)"]');
  if (otpBtn) {
    otpBtn.removeAttribute('onclick');
    otpBtn.addEventListener('click', sendOTP);
  }

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

  document.querySelectorAll('.btn-social').forEach(function(btn) {
    btn.removeAttribute('onclick');
    btn.addEventListener('click', function() {
      showTopSystemAlert('Fitur ini akan segera tersedia.');
    });
  });

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
