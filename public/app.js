// Global state
var currentUser = null;
var reportData = [];
var currentViewedInvoiceId = null;

function updateNavForUser(user) {
  if (!user) {
    document.getElementById('sidebarGuest').classList.remove('hidden');
    document.getElementById('sidebarUser').classList.add('hidden');
    document.getElementById('sidebarAdmin').classList.add('hidden');
    document.getElementById('welcomeMessage').classList.add('hidden');
  } else if (user.role === 'admin') {
    document.getElementById('sidebarGuest').classList.add('hidden');
    document.getElementById('sidebarUser').classList.add('hidden');
    document.getElementById('sidebarAdmin').classList.remove('hidden');
    document.getElementById('welcomeMessage').classList.remove('hidden');
    document.getElementById('welcomeName').innerText = user.name;
    var userAvatar = document.getElementById('userAvatar');
    if (userAvatar) userAvatar.innerText = user.name.charAt(0).toUpperCase();
    var navUserName = document.getElementById('navUserName');
    if (navUserName) navUserName.innerText = user.name;
  } else {
    document.getElementById('sidebarGuest').classList.add('hidden');
    document.getElementById('sidebarAdmin').classList.add('hidden');
    document.getElementById('sidebarUser').classList.remove('hidden');
    document.getElementById('welcomeMessage').classList.remove('hidden');
    document.getElementById('welcomeName').innerText = user.name;
    document.getElementById('userNameDisplay').innerText = 'Halo, ' + user.name + '!';
    var userAvatar2 = document.getElementById('userAvatar');
    if (userAvatar2) userAvatar2.innerText = user.name.charAt(0).toUpperCase();
    var navUserName2 = document.getElementById('navUserName');
    if (navUserName2) navUserName2.innerText = user.name;
  }
}

function handleRouting() {
  var hash = window.location.hash || '#beranda';
  var validPages = ['#beranda', '#lapor', '#edukasi', '#kontak', '#chat', '#register', '#login', '#admin', '#dashboard'];

  if (validPages.indexOf(hash) === -1) {
    hash = '#beranda';
  }

  if (hash === '#admin' && (!currentUser || currentUser.role !== 'admin')) {
    showTopSystemAlert('Akses Ditolak. Anda tidak memiliki otoritas Admin.');
    window.location.hash = '#login';
    return;
  }
  if (hash === '#dashboard' && (!currentUser || (currentUser.role !== 'user' && currentUser.role !== 'mahasiswa'))) {
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

  // Update document title
  var pageTitles = {
    '#beranda': 'Beranda - SafeSphere',
    '#lapor': 'Lapor Anonim - SafeSphere',
    '#edukasi': 'Edukasi - SafeSphere',
    '#kontak': 'Kontak Darurat - SafeSphere',
    '#chat': 'Chat Ahli - SafeSphere',
    '#login': 'Masuk - SafeSphere',
    '#register': 'Daftar - SafeSphere',
    '#admin': 'Dashboard Admin - SafeSphere',
    '#dashboard': 'Dashboard Saya - SafeSphere'
  };
  document.title = pageTitles[hash] || 'SafeSphere';

  // Focus heading for screen readers
  if (targetElement) {
    var heading = targetElement.querySelector('h1, h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }

  // aria-current on active nav link
  document.querySelectorAll('.sidebar-link').forEach(function(link) {
    link.removeAttribute('aria-current');
  });
  if (activeLink) activeLink.setAttribute('aria-current', 'page');

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

  // Report choice flow
  var choiceAnonim = document.getElementById('choiceAnonim');
  var choiceRahasia = document.getElementById('choiceRahasia');
  var reportChoiceScreen = document.getElementById('reportChoiceScreen');
  var reportFormSection = document.getElementById('reportFormSection');
  var backToChoice = document.getElementById('backToChoice');
  var safetyDanger = document.getElementById('safetyDanger');
  var safetySafe = document.getElementById('safetySafe');
  var safetyCheck = document.getElementById('safetyCheck');
  var reportForm = document.getElementById('reportForm');

  // Step-by-step form navigation
  var currentFormStep = 1;
  var totalFormSteps = 4;

  function updateFormSteps() {
    document.querySelectorAll('.form-step').forEach(function(step) {
      var stepNum = parseInt(step.dataset.step);
      step.classList.remove('active', 'done');
      if (stepNum === currentFormStep) step.classList.add('active');
      else if (stepNum < currentFormStep) step.classList.add('done');
    });
    document.querySelectorAll('.form-section').forEach(function(section) {
      section.classList.add('hidden');
    });
    var currentSection = document.getElementById('formStep' + currentFormStep);
    if (currentSection) currentSection.classList.remove('hidden');
  }

  function validateStep(step) {
    var section = document.getElementById('formStep' + step);
    if (!section) return true;
    var requiredFields = section.querySelectorAll('[required]');
    var firstInvalid = null;
    requiredFields.forEach(function(field) {
      if (!field.value || (field.value.trim && field.value.trim() === '')) {
        field.style.borderColor = 'var(--danger)';
        if (!firstInvalid) firstInvalid = field;
      } else {
        field.style.borderColor = '';
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      showTopSystemAlert('Harap isi semua field yang wajib diisi.');
      return false;
    }
    return true;
  }

  function goToStep(step) {
    currentFormStep = step;
    updateFormSteps();
  }

  function populateReview() {
    var summary = document.getElementById('reviewSummary');
    if (!summary) return;
    var cat = document.getElementById('category').value || '-';
    var loc = document.getElementById('location').value || '-';
    var date = document.getElementById('incidentDate').value || '-';
    var urg = document.getElementById('urgent').value || '-';
    var desc = document.getElementById('description').value || '-';
    var anon = document.getElementById('isAnonymous').checked ? 'Ya' : 'Tidak';
    summary.innerHTML = '<h3 style="margin-top:0;">Review Laporan</h3>' +
      '<p><b>Kategori:</b> ' + cat + '</p>' +
      '<p><b>Lokasi:</b> ' + loc + '</p>' +
      '<p><b>Tanggal:</b> ' + date + '</p>' +
      '<p><b>Urgensi:</b> ' + urg + '</p>' +
      '<p><b>Anonim:</b> ' + anon + '</p>' +
      '<p><b>Deskripsi:</b> ' + desc.substring(0, 200) + (desc.length > 200 ? '...' : '') + '</p>';
  }

  var nextStep1 = document.getElementById('nextStep1');
  if (nextStep1) nextStep1.addEventListener('click', function() { if (validateStep(1)) goToStep(2); });
  var nextStep2 = document.getElementById('nextStep2');
  if (nextStep2) nextStep2.addEventListener('click', function() { if (validateStep(2)) goToStep(3); });
  var nextStep3 = document.getElementById('nextStep3');
  if (nextStep3) nextStep3.addEventListener('click', function() { if (validateStep(3)) { populateReview(); goToStep(4); } });

  var prevStep2 = document.getElementById('prevStep2');
  if (prevStep2) prevStep2.addEventListener('click', function() { goToStep(1); });
  var prevStep3 = document.getElementById('prevStep3');
  if (prevStep3) prevStep3.addEventListener('click', function() { goToStep(2); });
  var prevStep4 = document.getElementById('prevStep4');
  if (prevStep4) prevStep4.addEventListener('click', function() { goToStep(3); });

  if (choiceAnonim) {
    choiceAnonim.addEventListener('click', function() {
      reportChoiceScreen.classList.add('hidden');
      reportFormSection.classList.remove('hidden');
      document.getElementById('reportFormTitle').innerText = 'Form Lapor Anonim';
      document.getElementById('reportFormSubtitle').innerText = 'Identitas Anda tidak akan dikumpulkan.';
      var anonCheckbox = document.getElementById('isAnonymous');
      if (anonCheckbox) {
        anonCheckbox.checked = true;
        anonCheckbox.disabled = true;
      }
    });
  }

  if (choiceRahasia) {
    choiceRahasia.addEventListener('click', function() {
      if (!currentUser) {
        showTopSystemAlert('Silakan login terlebih dahulu untuk melapor secara rahasia.');
        window.location.hash = '#login';
        return;
      }
      reportChoiceScreen.classList.add('hidden');
      reportFormSection.classList.remove('hidden');
      document.getElementById('reportFormTitle').innerText = 'Form Lapor Rahasia';
      document.getElementById('reportFormSubtitle').innerText = 'Identitas Anda disimpan dengan akses terbatas.';
      var anonCheckbox2 = document.getElementById('isAnonymous');
      if (anonCheckbox2) {
        anonCheckbox2.checked = false;
        anonCheckbox2.disabled = false;
      }
    });
  }

  if (backToChoice) {
    backToChoice.addEventListener('click', function() {
      reportFormSection.classList.add('hidden');
      reportChoiceScreen.classList.remove('hidden');
      if (safetyCheck) safetyCheck.classList.remove('hidden');
      if (reportForm) reportForm.classList.add('hidden');
      var resultBox = document.getElementById('reportResult');
      if (resultBox) resultBox.classList.add('hidden');
    });
  }

  if (safetyDanger) {
    safetyDanger.addEventListener('click', function() {
      window.location.hash = '#kontak';
    });
  }

  if (safetySafe) {
    safetySafe.addEventListener('click', function() {
      safetyCheck.classList.add('hidden');
      reportForm.classList.remove('hidden');
      currentFormStep = 1;
      updateFormSteps();
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

document.addEventListener('DOMContentLoaded', async function() {
  reportData = Storage.load('reports', []);

  try {
    var meResponse = await fetch('/api/auth/me');
    if (meResponse.ok) {
      var meData = await meResponse.json();
      currentUser = meData.user;
      updateNavForUser(currentUser);
    }
  } catch (err) {}

  setupEventListeners();
  handleRouting();
});

window.addEventListener('hashchange', handleRouting);
