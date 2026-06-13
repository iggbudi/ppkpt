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
