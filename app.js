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
  // Hamburger menu toggle
  var hamburger = document.getElementById('hamburgerBtn');
  var mainNav = document.getElementById('mainNav');
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      mainNav.classList.toggle('open');
    });
    // Close menu when clicking a nav link
    mainNav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        mainNav.classList.remove('open');
      });
    });
  }

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

  // Logout buttons (nav user and nav admin)
  document.querySelectorAll('#navUser .btn.outline, #navAdmin .btn.outline').forEach(function(btn) {
    btn.addEventListener('click', handleLogout);
  });

  // Quick escape button
  var quickEscapeBtn = document.getElementById('quickEscapeBtn');
  if (quickEscapeBtn) {
    quickEscapeBtn.addEventListener('click', activateDiscreetMode);
  }

  // Discreet mode close button
  var discreetClose = document.querySelector('#discreetOverlay button');
  if (discreetClose) {
    discreetClose.addEventListener('click', deactivateDiscreetMode);
  }

  // Forgot password link
  var forgotLink = document.querySelector('#page-login a[href="#"]');
  if (forgotLink) {
    forgotLink.addEventListener('click', openForgotModal);
  }

  // OTP send button
  var otpBtn = document.querySelector('#forgotPasswordModal .btn.primary');
  if (otpBtn) {
    otpBtn.addEventListener('click', sendOTP);
  }

  // Admin buttons
  var seedBtn = document.querySelector('#adminDashboardArea .btn-light-primary');
  if (seedBtn) {
    seedBtn.addEventListener('click', seedDemoData);
  }

  var clearBtn = document.querySelector('#adminDashboardArea .btn-light-danger');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllData);
  }

  // Admin detail modal
  var detailClose = document.querySelector('#reportDetailModal .close-modal');
  if (detailClose) {
    detailClose.addEventListener('click', closeReportDetailModal);
  }

  var saveStatusBtn = document.querySelector('#reportDetailModal .btn.primary');
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', saveReportStatus);
  }

  // A11y widget toggle
  var a11yToggle = document.querySelector('[aria-label="Buka Menu Aksesibilitas"]');
  if (a11yToggle) {
    a11yToggle.addEventListener('click', toggleA11yMenu);
  }

  // A11y feature buttons (Kontras Tinggi, Perbesar Teks, Ramah Disleksia)
  var a11yFeatures = ['high-contrast', 'large-text', 'dyslexia'];
  var a11yMenu = document.getElementById('a11yMenu');
  if (a11yMenu) {
    var a11yBtns = a11yMenu.querySelectorAll('button');
    a11yBtns.forEach(function(btn, idx) {
      if (a11yFeatures[idx]) {
        btn.addEventListener('click', function() { toggleA11yFeature(a11yFeatures[idx]); });
      }
    });
  }

  // Social login buttons (placeholder)
  document.querySelectorAll('.btn-social').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showTopSystemAlert('Fitur ini akan segera tersedia.');
    });
  });

  // Chat button (placeholder)
  var chatBtn = document.querySelector('#page-chat .btn-primary');
  if (chatBtn) {
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
