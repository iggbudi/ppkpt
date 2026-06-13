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