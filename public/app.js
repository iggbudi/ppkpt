// Global state
var currentUser = null;
var reportData = [];
var currentViewedInvoiceId = null;
var authStateResolved = false;
var authStateReady = Promise.resolve();

function openModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal && modal.showModal) {
    modal.showModal();
  }
}

function closeModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal && modal.close) {
    modal.close();
  }
}

/**
 * Sinkronisasi active state antara desktop nav dan mobile sidebar
 * @param {string} hash - Hash halaman aktif (e.g., '#beranda')
 */
function syncActiveNav(hash) {
  // Update sidebar links (mobile)
  document.querySelectorAll('.sidebar-link').forEach(function(link) {
    link.classList.remove('active');
    if (link.getAttribute('href') === hash) {
      link.classList.add('active');
    }
  });

  // Update topbar links (desktop)
  document.querySelectorAll('.topbar-link').forEach(function(link) {
    link.classList.remove('active');
    if (link.getAttribute('href') === hash) {
      link.classList.add('active');
    }
  });

  // Update aria-current on both navs
  document.querySelectorAll('.sidebar-link, .topbar-link').forEach(function(link) {
    link.removeAttribute('aria-current');
    if (link.getAttribute('href') === hash) {
      link.setAttribute('aria-current', 'page');
    }
  });
}

/**
 * Toggle dropdown menu untuk user/admin
 * @param {string} dropdownId - ID dropdown element
 * @param {string} btnId - ID button trigger
 */
function toggleDropdown(dropdownId, btnId) {
  var dropdown = document.getElementById(dropdownId);
  var btn = document.getElementById(btnId);
  if (!dropdown || !btn) return;

  var isOpen = dropdown.classList.contains('show');
  closeAllDropdowns();

  if (!isOpen) {
    dropdown.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
  }
}

/**
 * Tutup semua dropdown yang terbuka
 */
function closeAllDropdowns() {
  document.querySelectorAll('.topbar-dropdown').forEach(function(dd) {
    dd.classList.remove('show');
  });
  document.querySelectorAll('[aria-haspopup="true"]').forEach(function(btn) {
    btn.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Handle klik di luar dropdown untuk menutup
 */
function handleOutsideClick(event) {
  if (!event.target.closest('.topbar-auth-user') &&
      !event.target.closest('.topbar-auth-admin')) {
    closeAllDropdowns();
  }
}

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

  // Topbar (desktop) auth state sync
  var topbarGuest = document.getElementById('topbarGuest');
  var topbarUser = document.getElementById('topbarUser');
  var topbarAdmin = document.getElementById('topbarAdmin');
  if (topbarGuest && topbarUser && topbarAdmin) {
    if (!user) {
      topbarGuest.classList.remove('hidden');
      topbarUser.classList.add('hidden');
      topbarAdmin.classList.add('hidden');
    } else if (user.role === 'admin') {
      topbarGuest.classList.add('hidden');
      topbarUser.classList.add('hidden');
      topbarAdmin.classList.remove('hidden');
      var tAdminAvatar = document.querySelector('#topbarAdmin .topbar-avatar');
      if (tAdminAvatar) tAdminAvatar.innerText = user.name.charAt(0).toUpperCase();
    } else {
      topbarGuest.classList.add('hidden');
      topbarAdmin.classList.add('hidden');
      topbarUser.classList.remove('hidden');
      var tUserAvatar = document.getElementById('topbarAvatar');
      if (tUserAvatar) tUserAvatar.innerText = user.name.charAt(0).toUpperCase();
      var tUserName = document.getElementById('topbarUserName');
      if (tUserName) tUserName.innerText = user.name;
    }
  }
}

function handleRouting() {
  var hash = window.location.hash || '#beranda';
  var validPages = ['#beranda', '#lapor', '#edukasi', '#kontak', '#chat', '#register', '#login', '#admin', '#dashboard'];

  if (validPages.indexOf(hash) === -1) {
    hash = '#beranda';
  }

  if ((hash === '#admin' || hash === '#dashboard') && !authStateResolved) {
    authStateReady.then(handleRouting);
    return;
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

  // Sinkronisasi active state desktop + mobile
  syncActiveNav(hash);

  var targetPageId = 'page-' + hash.substring(1);
  var targetElement = document.getElementById(targetPageId);
  if (targetElement) targetElement.classList.add('active');

  if (hash === '#lapor' && typeof window.prepareReportEntryForRoute === 'function') {
    window.prepareReportEntryForRoute();
  }

  // Update document title
  var pageTitles = {
    '#beranda': 'Beranda - SafeSphere',
    '#lapor': 'Lapor Anonim - SafeSphere',
    '#edukasi': 'Edukasi - SafeSphere',
    '#kontak': 'Kontak Darurat - SafeSphere',
    '#chat': 'SafeBot - SafeSphere',
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

  if (hash === '#admin') {
    if (typeof updateUsersUI === 'function') {
      updateUsersUI();
    }
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
    if (sidebar) {
      sidebar.classList.add('open');
      sidebar.removeAttribute('inert');
      sidebar.setAttribute('aria-hidden', 'false');
    }
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (sidebarClose) sidebarClose.focus();
  }

  function closeSidebar(restoreFocus) {
    if (sidebar) {
      sidebar.classList.remove('open');
      sidebar.setAttribute('inert', '');
      sidebar.setAttribute('aria-hidden', 'true');
    }
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (restoreFocus !== false && hamburger) hamburger.focus();
  }

  if (hamburger) {
    hamburger.addEventListener('click', function() {
      var isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }
  if (sidebarClose) {
    sidebarClose.addEventListener('click', function() { closeSidebar(true); });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', function() { closeSidebar(true); });
  }

  window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSidebar(true);
    }
  }, true);

  // Close sidebar when clicking a nav link without stealing focus from routed content.
  var sidebarLinks = document.querySelectorAll('.sidebar-link[href]');
  sidebarLinks.forEach(function(link) {
    link.addEventListener('click', function() { closeSidebar(false); });
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

  // Topbar dropdown triggers
  var topbarUserBtn = document.getElementById('topbarUserBtn');
  if (topbarUserBtn) {
    topbarUserBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleDropdown('topbarUserDropdown', 'topbarUserBtn');
    });
  }
  var topbarAdminBtn = document.getElementById('topbarAdminBtn');
  if (topbarAdminBtn) {
    topbarAdminBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleDropdown('topbarAdminDropdown', 'topbarAdminBtn');
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', handleOutsideClick);

  function getOpenDropdown() {
    return document.querySelector('.topbar-dropdown.show');
  }

  function focusDropdownItem(items, index) {
    if (!items.length) return;
    var nextIndex = Math.max(0, Math.min(index, items.length - 1));
    items[nextIndex].focus();
  }

  document.addEventListener('keydown', function(e) {
    var openDropdown = getOpenDropdown();
    if (!openDropdown) {
      if (e.key === 'Escape') closeAllDropdowns();
      return;
    }

    var items = Array.prototype.slice.call(
      openDropdown.querySelectorAll('.topbar-dropdown-item[role="menuitem"]')
    );

    if (e.key === 'Escape') {
      e.preventDefault();
      var trigger = document.querySelector('[aria-expanded="true"][aria-haspopup="true"]');
      closeAllDropdowns();
      if (trigger) trigger.focus();
      return;
    }

    if (!items.length) return;
    var currentIndex = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusDropdownItem(items, currentIndex < 0 ? 0 : currentIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusDropdownItem(items, currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusDropdownItem(items, 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusDropdownItem(items, items.length - 1);
    }
  });

  // Topbar logout buttons
  var topbarLogoutBtn = document.getElementById('topbarLogoutBtn');
  if (topbarLogoutBtn) {
    topbarLogoutBtn.addEventListener('click', handleLogout);
  }
  var topbarAdminLogoutBtn = document.getElementById('topbarAdminLogoutBtn');
  if (topbarAdminLogoutBtn) {
    topbarAdminLogoutBtn.addEventListener('click', handleLogout);
  }

  // Close dropdown when clicking topbar nav links
  document.querySelectorAll('.topbar-link').forEach(function(link) {
    link.addEventListener('click', function() {
      closeAllDropdowns();
    });
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

  // Pilot banner dismiss
  var pilotBanner = document.getElementById('pilotBanner');
  var dismissBanner = document.getElementById('dismissBanner');
  if (pilotBanner && dismissBanner) {
    if (sessionStorage.getItem('bannerDismissed')) {
      pilotBanner.classList.add('is-hidden');
    }
    dismissBanner.addEventListener('click', function() {
      pilotBanner.classList.add('is-hidden');
      sessionStorage.setItem('bannerDismissed', 'true');
    });
  }

  // Report choice flow
  var chooseAnonimBtn = document.getElementById('chooseAnonimBtn');
  var chooseRahasiaBtn = document.getElementById('chooseRahasiaBtn');
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

  function setFieldError(field, message) {
    if (!field) return;
    var errorId = field.id + '-error';
    var errorEl = document.getElementById(errorId);
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.id = errorId;
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      field.parentNode.appendChild(errorEl);
    }
    if (message) {
      errorEl.textContent = message;
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', errorId);
    } else {
      errorEl.textContent = '';
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    }
  }

  function validateStep(step) {
    var section = document.getElementById('formStep' + step);
    if (!section) return true;
    var requiredFields = section.querySelectorAll('[required]');
    var firstInvalid = null;
    var labels = {
      category: 'Pilih kategori perundungan',
      location: 'Isi lokasi kejadian',
      incidentDate: 'Pilih tanggal kejadian',
      urgent: 'Pilih tingkat urgensi',
      description: 'Ceritakan kronologi kejadian'
    };

    requiredFields.forEach(function(field) {
      var empty = !field.value || (field.value.trim && field.value.trim() === '');
      if (empty) {
        setFieldError(field, labels[field.id] || 'Field ini wajib diisi');
        if (!firstInvalid) firstInvalid = field;
      } else {
        setFieldError(field, '');
      }
    });

    if (step === 1) {
      var dateField = document.getElementById('incidentDate');
      if (dateField && dateField.value) {
        var selected = new Date(dateField.value + 'T00:00:00');
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selected > today) {
          setFieldError(dateField, 'Tanggal kejadian tidak boleh di masa depan');
          if (!firstInvalid) firstInvalid = dateField;
        }
      }
    }

    if (firstInvalid) {
      firstInvalid.focus();
      showTopSystemAlert('Harap perbaiki field yang ditandai sebelum melanjutkan.');
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
    
    // Gunakan DOM API alih-alih innerHTML untuk keamanan
    summary.textContent = ''; // Clear
    
    var h3 = document.createElement('h3');
    h3.style.marginTop = '0';
    h3.textContent = 'Review Laporan';
    summary.appendChild(h3);
    
    var fields = [
      { label: 'Kategori:', value: cat },
      { label: 'Lokasi:', value: loc },
      { label: 'Tanggal:', value: date },
      { label: 'Urgensi:', value: urg },
      { label: 'Anonim:', value: anon },
      { label: 'Deskripsi:', value: desc.substring(0, 200) + (desc.length > 200 ? '...' : '') }
    ];
    
    fields.forEach(function(field) {
      var p = document.createElement('p');
      var b = document.createElement('b');
      b.textContent = field.label;
      p.appendChild(b);
      p.appendChild(document.createTextNode(' ' + field.value));
      summary.appendChild(p);
    });
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

  var requestedReportMode = null;
  var pendingConfidentialMode = false;

  function showReportChoice() {
    reportFormSection.classList.add('hidden');
    reportChoiceScreen.classList.remove('hidden');
    if (safetyCheck) safetyCheck.classList.remove('hidden');
    if (reportForm) reportForm.classList.add('hidden');
    var resultBox = document.getElementById('reportResult');
    if (resultBox) resultBox.classList.add('hidden');
  }

  function applyReportMode(mode) {
    if (mode === 'confidential' && !authStateResolved) {
      pendingConfidentialMode = true;
      authStateReady.then(function() {
        if (!pendingConfidentialMode || window.location.hash !== '#lapor') return;
        pendingConfidentialMode = false;
        applyReportMode(mode);
      });
      return;
    }

    if (mode === 'confidential' && !currentUser) {
      showTopSystemAlert('Masuk diperlukan agar kamu dapat melacak laporan rahasia.');
      window.location.hash = '#login';
      return;
    }

    reportChoiceScreen.classList.add('hidden');
    reportFormSection.classList.remove('hidden');
    if (safetyCheck) safetyCheck.classList.remove('hidden');
    if (reportForm) reportForm.classList.add('hidden');

    var isAnonymousMode = mode === 'anonymous';
    document.getElementById('reportFormTitle').innerText = isAnonymousMode ? 'Laporan tanpa identitas akun' : 'Laporan rahasia';
    document.getElementById('reportFormSubtitle').innerText = isAnonymousMode
      ? 'Identitas akun tidak dicatat pada laporan atau audit pembuatannya.'
      : 'Identitas akun disimpan dengan akses terbatas agar kamu dapat melacak status.';

    var anonCheckbox = document.getElementById('isAnonymous');
    if (anonCheckbox) {
      anonCheckbox.checked = isAnonymousMode;
      anonCheckbox.disabled = isAnonymousMode;
    }

    window.requestAnimationFrame(function() {
      var safetyHeading = document.getElementById('safetyCheckHeading');
      if (safetyHeading) safetyHeading.focus();
    });
  }

  function startReportMode(mode) {
    pendingConfidentialMode = false;
    requestedReportMode = mode;
    if (window.location.hash !== '#lapor') {
      window.location.hash = '#lapor';
    } else {
      applyReportMode(requestedReportMode);
      requestedReportMode = null;
    }
  }

  window.startReportMode = startReportMode;
  window.prepareReportEntryForRoute = function() {
    if (requestedReportMode) {
      applyReportMode(requestedReportMode);
      requestedReportMode = null;
    } else {
      showReportChoice();
    }
  };

  var heroAnonymousCta = document.getElementById('heroAnonymousCta');
  if (heroAnonymousCta) {
    heroAnonymousCta.addEventListener('click', function(event) {
      event.preventDefault();
      startReportMode('anonymous');
    });
  }

  if (chooseAnonimBtn) {
    chooseAnonimBtn.addEventListener('click', function() { startReportMode('anonymous'); });
  }

  if (chooseRahasiaBtn) {
    chooseRahasiaBtn.addEventListener('click', function() { startReportMode('confidential'); });
  }

  if (backToChoice) {
    backToChoice.addEventListener('click', showReportChoice);
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
      var firstField = document.getElementById('category');
      if (firstField) firstField.focus();
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
  // Safety-critical public actions bind before auth lookup completes.
  setupEventListeners();

  authStateReady = fetch('/api/auth/me')
    .then(function(meResponse) {
      if (!meResponse.ok) return null;
      return meResponse.json();
    })
    .then(function(meData) {
      currentUser = meData ? meData.user : null;
      updateNavForUser(currentUser);
    })
    .catch(function() {
      currentUser = null;
      updateNavForUser(null);
    })
    .finally(function() {
      authStateResolved = true;
    });

  handleRouting();
});

window.addEventListener('hashchange', handleRouting);
