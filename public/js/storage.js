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
