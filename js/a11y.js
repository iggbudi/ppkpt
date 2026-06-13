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
