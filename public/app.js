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
  document.querySelectorAll('.sidebar-link').forEach(function(link) { link.classList.remove('active'); });

  var targetPageId = 'page-' + hash.substring(1);
  var targetElement = document.getElementById(targetPageId);
  if (targetElement) targetElement.classList.add('active');

  var activeLink = document.querySelector('.sidebar-link[href="' + hash + '"]');
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
  // Sidebar toggle
  var hamburger = document.getElementById('hamburgerBtn');
  var sidebar = document.getElementById('sidebar');
  var sidebarOverlay = document.getElementById('sidebarOverlay');
  var sidebarClose = document.getElementById('sidebarClose');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (hamburger) {
    hamburger.addEventListener('click', openSidebar);
  }
  if (sidebarClose) {
    sidebarClose.addEventListener('click', closeSidebar);
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  // Close sidebar when clicking a nav link
  var sidebarLinks = document.querySelectorAll('.sidebar-link[href]');
  sidebarLinks.forEach(function(link) {
    link.addEventListener('click', closeSidebar);
  });

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

  // Logout buttons (sidebar user and admin)
  document.querySelectorAll('#navUserLogoutBtn, #navAdminLogoutBtn').forEach(function(btn) {
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
      showTopSystemAlert('Simulasi: fitur ini belum aktif');
    });
  });

  // Demo banner dismiss
  var demoBanner = document.getElementById('demoBanner');
  var dismissBanner = document.getElementById('dismissBanner');
  if (demoBanner && dismissBanner) {
    if (sessionStorage.getItem('bannerDismissed')) {
      demoBanner.style.display = 'none';
    }
    dismissBanner.addEventListener('click', function() {
      demoBanner.style.display = 'none';
      sessionStorage.setItem('bannerDismissed', 'true');
    });
  }

  // Chat button (placeholder)
  var chatBtn = document.querySelector('#page-chat .btn-primary');
  if (chatBtn) {
    chatBtn.addEventListener('click', function() {
      showTopSystemAlert('Membuka sesi Chat Aman...');
    });
  }

  // Smart sticky nav
  var topbar = document.querySelector('.topbar');
  var lastScrollY = window.scrollY;
  var topbarHeight = topbar ? topbar.offsetHeight : 0;

  window.addEventListener('scroll', function() {
    var currentScrollY = window.scrollY;
    
    if (currentScrollY > lastScrollY && currentScrollY > topbarHeight) {
      topbar.style.transform = 'translateY(-100%)';
    } else {
      topbar.style.transform = 'translateY(0)';
    }
    
    lastScrollY = currentScrollY;
  });
}

document.addEventListener('DOMContentLoaded', function() {
  currentUser = Storage.load('currentUser', null);
  reportData = Storage.load('reports', []);

  if (currentUser) {
    if (currentUser.role === 'admin') {
      document.getElementById('sidebarGuest').classList.add('hidden');
      document.getElementById('sidebarUser').classList.add('hidden');
      document.getElementById('sidebarAdmin').classList.remove('hidden');
    } else {
      document.getElementById('sidebarGuest').classList.add('hidden');
      document.getElementById('sidebarAdmin').classList.add('hidden');
      document.getElementById('sidebarUser').classList.remove('hidden');
    }
    document.getElementById('welcomeMessage').classList.remove('hidden');
    document.getElementById('welcomeName').innerText = currentUser.name;
    var userAvatar = document.getElementById('userAvatar');
    if (userAvatar) userAvatar.innerText = currentUser.name.charAt(0).toUpperCase();
    var navUserName = document.getElementById('navUserName');
    if (navUserName) navUserName.innerText = currentUser.name;
  }

  setupEventListeners();
  handleRouting();
});

window.addEventListener('hashchange', handleRouting);
