(function() {
  window.toggleA11yMenu = function() {
    var menu = document.getElementById('a11yMenu');
    var toggle = document.querySelector('[aria-label="Buka Menu Aksesibilitas"]');
    if (menu.classList.contains('hidden')) {
      menu.classList.remove('hidden');
      menu.classList.add('show');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    } else {
      menu.classList.add('hidden');
      menu.classList.remove('show');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  };

  window.toggleA11yFeature = function(feature) {
    var body = document.body;
    var className = 'a11y-' + feature;
    var button = document.querySelector('[data-feature="' + feature + '"]');

    if (body.classList.contains(className)) {
      body.classList.remove(className);
      if (button) button.setAttribute('aria-pressed', 'false');
      var modeName = feature === 'high-contrast' ? 'Kontras Tinggi' : (feature === 'large-text' ? 'Perbesar Teks' : 'Ramah Disleksia');
      showTopSystemAlert('Aksesibilitas: Mode ' + modeName + ' dinonaktifkan.');
    } else {
      body.classList.add(className);
      if (button) button.setAttribute('aria-pressed', 'true');
      var modeName2 = feature === 'high-contrast' ? 'Kontras Tinggi' : (feature === 'large-text' ? 'Perbesar Teks' : 'Ramah Disleksia');
      showTopSystemAlert('Aksesibilitas: Mode ' + modeName2 + ' diaktifkan.');
    }

    // Simpan preferensi ke localStorage
    try {
      var prefs = JSON.parse(localStorage.getItem('a11yPrefs') || '{}');
      prefs[feature] = body.classList.contains(className);
      localStorage.setItem('a11yPrefs', JSON.stringify(prefs));
    } catch (e) {}

    toggleA11yMenu();
  };

  // Restore preferensi saat page load
  function restoreA11yPrefs() {
    try {
      var prefs = JSON.parse(localStorage.getItem('a11yPrefs') || '{}');
      var body = document.body;
      
      ['high-contrast', 'large-text', 'dyslexia'].forEach(function(feature) {
        if (prefs[feature]) {
          body.classList.add('a11y-' + feature);
          var button = document.querySelector('[data-feature="' + feature + '"]');
          if (button) button.setAttribute('aria-pressed', 'true');
        }
      });
    } catch (e) {}
  }

  // Jalankan saat DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreA11yPrefs);
  } else {
    restoreA11yPrefs();
  }
})();
