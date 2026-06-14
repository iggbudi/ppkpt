(function() {
  // ============================================================
  // SafeSphere Edukasi — Multi-Scenario Decision Tree + Progress
  // ============================================================

  // --- Data Skema Skenario ---
  var scenarios = [
    {
      id: 'bystander',
      title: 'Skenario Saksi Mata (Bystander)',
      description: 'Anda sedang duduk di kantin fakultas dan melihat seorang mahasiswa baru didorong dan diejek oleh sekelompok senior.',
      badge: '🛡️ Bystander Aktif',
      nodes: {
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
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Berbahaya!</strong> Menghadapi pelaku secara langsung tanpa perhitungan bisa membahayakan keselamatan diri Anda.' }
        },
        pasif: {
          text: 'Korban semakin dipermalukan. Karena tidak ada mahasiswa lain yang berani bertindak, pelaku merasa perilaku mereka wajar dan kekerasan semakin dinormalisasi di kampus.',
          options: [
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Efek Bystander (Pembiaran):</strong> Diam berarti secara tidak langsung Anda membiarkan perundungan terus terjadi.' }
        },
        pintar: {
          text: 'Tepat sekali! Anda berhasil mendapatkan bukti rekaman wajah pelaku tanpa membahayakan diri sendiri. Laporan anonim Anda di SafeSphere langsung diproses oleh Satgas PPKS, dan korban segera mendapatkan perlindungan.',
          options: [
            { text: '🏆 Selesai — Kembali ke Daftar', nextNode: '_back', isSuccess: true }
          ],
          feedback: { type: 'success', message: '<strong>Langkah Cerdas!</strong> Mengamankan bukti dan melapor secara terenkripsi adalah tindakan paling efektif untuk memutus rantai perundungan.' }
        }
      }
    },
    {
      id: 'cyberbullying',
      title: 'Cyberbullying di Grup WhatsApp',
      description: 'Kamu melihat angkatanmu mengolok-olok mahasiswa baru di grup WA. Pesannya sudah 50+, banyak yang ikut menertawakan.',
      badge: '🛡️ Pelapor Digital',
      nodes: {
        start: {
          text: 'Kamu membuka grup WhatsApp angkatan dan melihat percakapan yang sudah berlangsung lama. Seorang mahasiswa baru sedang diolok-olok karena penampilannya. Pesan sudah lebih dari 50, banyak yang ikut menertawakan dengan sticker dan meme. Apa yang kamu lakukan?',
          options: [
            { text: 'A. Ikut menertawakan agar tidak di-bully juga.', nextNode: 'ikut' },
            { text: 'B. Diam saja, toh bukan urusanmu.', nextNode: 'diam' },
            { text: 'C. Screenshot, DM korban untuk dukungan, lalu laporkan.', nextNode: 'pintar' }
          ],
          feedback: null
        },
        ikut: {
          text: 'Korban melihat nama kamu di antara yang menertawakan. Ia merasa semakin terisolasi dan tidak memiliki siapapun. Keesokan harinya, ia tidak masuk kuliah.',
          options: [
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Complicity:</strong> Mengikuti kerumunan yang merundung membuatmu bagian dari masalah. Dampak psikologis korban bisa bertahan bertahun-tahun.' }
        },
        diam: {
          text: 'Karena tidak ada yang membela, pelaku semakin menjadi. Mereka mulai mengirim DM ancaman ke korban. Korban mulai mengalami kecemasan dan mempertimbangkan untuk berhenti kuliah.',
          options: [
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Efek Bystander Digital:</strong> Diam di dunia digital sama dengan membiarkan. Setiap pesan yang tidak dilawan adalah kontribusi pada normalisasi perundungan.' }
        },
        pintar: {
          text: 'Kamu mengambil screenshot seluruh percakapan sebagai bukti. Kamu mengirim DM pribadi ke korban: "Hei, aku lihat apa yang terjadi. Kamu tidak sendirian. Kalau butuh bantuan, aku di sini." Kamu juga melaporkan kejadian ini melalui SafeSphere.',
          options: [
            { text: '🏆 Selesai — Kembali ke Daftar', nextNode: '_back', isSuccess: true }
          ],
          feedback: { type: 'success', message: '<strong>Langkah Cerdas!</strong> Mengamankan bukti digital dan memberi dukungan langsung kepada korban adalah tindakan bystander yang paling efektif di era digital.' }
        }
      }
    },
    {
      id: 'senior',
      title: 'Perundungan Senior terhadap Maba',
      description: 'Kamu melihat senior memaksa maba melakukan hukuman fisik yang memalukan dengan alasan "ospek".',
      badge: '🛡️ Pelindung Maba',
      nodes: {
        start: {
          text: 'Di area parkir kampus, kamu melihat sekelompok senior memaksa mahasiswa baru untuk push-up di genangan air sambil diteriaki. Mereka bilang ini "tradisi ospek" dan menyuruhmu ikut bergabung. Apa reaksimu?',
          options: [
            { text: 'A. Ikut-ikutan karena dulu kamu juga pernah mengalaminya.', nextNode: 'ikut' },
            { text: 'B. Rekam diam-diam, lalu cari bantuan petugas/PPKS.', nextNode: 'pintar' },
            { text: 'C. Langsung konfrontasi fisik ke senior.', nextNode: 'konfrontasi' }
          ],
          feedback: null
        },
        ikut: {
          text: 'Dengan ikut serta, kamu memperkuat budaya kekerasan yang seharusnya sudah ditinggalkan. Mahasiswa baru yang dipaksa mengalami trauma dan mempertanyakan keputusannya masuk kampus ini.',
          options: [
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Normalisasi Kekerasan:</strong> Pengalaman masa lalu bukan pembenaran. "Dulu saya juga mengalami" justru harusnya membuatmu lebih empati, bukan ikut menyakiti.' }
        },
        pintar: {
          text: 'Kamu merekam kejadian dari kejauhan, lalu segera menghubungi Satgas PPKS melalui tombol darurat di SafeSphere. Petugas keamanan datang dan menghentikan kejadian. Senior yang terlibat dipanggil untuk mediasi.',
          options: [
            { text: '🏆 Selesai — Kembali ke Daftar', nextNode: '_back', isSuccess: true }
          ],
          feedback: { type: 'success', message: '<strong>Tindakan Tepat!</strong> Merekam bukti dan mencari otoritas yang berwenang adalah cara paling aman dan efektif untuk menghentikan perundungan sistemik.' }
        },
        konfrontasi: {
          text: 'Kamu mendorong senior tersebut. Situasi langsung memanas. Kamu kini menjadi target intimidasi bersama mahasiswa baru. Kekerasan berlanjut hingga petugas keamanan datang terlambat.',
          options: [
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Berbahaya!</strong> Konfrontasi fisik bisa membahayakan dirimu dan membuat situasi semakin buruk. Gunakan jalur aman: rekam, laporkan, biarkan otoritas menangani.' }
        }
      }
    },
    {
      id: 'dosen',
      title: 'Pelecehan Verbal dari Dosen',
      description: 'Kamu mendengar dosen membuat komentar bernada seksual kepada mahasiswi di kelas.',
      badge: '🛡️ Pembela Akademik',
      nodes: {
        start: {
          text: 'Di tengah kuliah, dosen membuat komentar bernada seksual kepada seorang mahasiswi di depan kelas. "Kamu cantik begini, ngapain serius kuliah?" Mahasiswi terlihat tidak nyaman dan menunduk. Tidak ada yang berbicara. Apa yang kamu lakukan?',
          options: [
            { text: 'A. Diam, toh itu urusan dosen dan mahasiswi.', nextNode: 'diam' },
            { text: 'B. Catat kejadian, tawarkan dukungan ke korban setelah kelas.', nextNode: 'pintar' },
            { text: 'C. Langsung protes keras di depan kelas.', nextNode: 'protes' }
          ],
          feedback: null
        },
        diam: {
          text: 'Dosen melanjutkan komentarnya di pertemuan berikutnya. Mahasiswi tersebut mulai menghindari kelas dan prestasinya menurun. Ia merasa tidak punya siapapun yang bisa ia ajak bicara.',
          options: [
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Pelecehan Akademik:</strong> Pelecehan di lingkungan akademik adalah pelanggaran serius. Diam berarti membiarkan penyalahgunaan kekuasaan terus berlanjut.' }
        },
        pintar: {
          text: 'Kamu mencatat tanggal, waktu, dan kata-kata yang diucapkan dosen. Setelah kelas, kamu menghampiri mahasiswi tersebut dengan lembut: "Aku dengar tadi. Kamu tidak sendirian. Kalau mau, kita bisa laporkan bersama." Kamu juga mengirim laporan melalui SafeSphere.',
          options: [
            { text: '🏆 Selesai — Kembali ke Daftar', nextNode: '_back', isSuccess: true }
          ],
          feedback: { type: 'success', message: '<strong>Langkah Tepat!</strong> Memberi dukungan dan mendokumentasi adalah langkah penting. Kamu memberdayakan korban untuk mengambil keputusan sendiri sambil memastikan ada catatan resmi.' }
        },
        protes: {
          text: 'Kamu berdiri dan memprotes dosen di depan kelas. Dosen merasa terpojok dan memberimu nilai buruk. Mahasiswi yang kamu bela justru merasa lebih malu karena perhatian tertuju padanya.',
          options: [
            { text: '↩ Ulangi Skenario', nextNode: 'start', isRestart: true }
          ],
          feedback: { type: 'error', message: '<strong>Risiko Konfrontasi Langsung:</strong> Meski niat baik, konfrontasi langsung di depan pelaku bisa membuat situasi lebih buruk bagi korban. Pendekatan diam-diam seringkali lebih efektif.' }
        }
      }
    }
  ];

  // --- Progress Tracking (localStorage) ---
  var STORAGE_KEY = 'safesphere_edu_progress';

  function getProgress() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) { /* ignore */ }
    return { completed: [], totalXP: 0 };
  }

  function saveProgress(scenarioId) {
    var progress = getProgress();
    if (progress.completed.indexOf(scenarioId) === -1) {
      progress.completed.push(scenarioId);
      progress.totalXP += 20;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch (e) { /* ignore */ }
    }
    return progress;
  }

  function isScenarioCompleted(scenarioId) {
    var progress = getProgress();
    return progress.completed.indexOf(scenarioId) !== -1;
  }

  function getCompletedCount() {
    return getProgress().completed.length;
  }

  // --- UI Rendering ---

  function renderProgressBar() {
    var bar = document.getElementById('eduProgressBar');
    var text = document.getElementById('eduProgressText');
    var badge = document.getElementById('eduChampionBadge');
    if (!bar || !text) return;

    var completed = getCompletedCount();
    var total = scenarios.length;
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    bar.style.width = pct + '%';
    text.textContent = completed + '/' + total + ' skenario selesai';

    if (badge) {
      if (completed >= total) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  function renderScenarioList() {
    var listEl = document.getElementById('scenarioList');
    var detailEl = document.getElementById('scenarioDetail');
    if (!listEl || !detailEl) return;

    listEl.classList.remove('hidden');
    detailEl.classList.add('hidden');

    listEl.innerHTML = '';
    scenarios.forEach(function(scenario, index) {
      var completed = isScenarioCompleted(scenario.id);
      var card = document.createElement('div');
      card.className = 'scenario-card' + (completed ? ' completed' : '');

      var statusBadge = completed
        ? '<span class="scenario-status status-done">✓ Selesai</span>'
        : '<span class="scenario-status status-new">Baru</span>';

      card.innerHTML =
        '<div class="scenario-card-header">' +
          '<span class="scenario-number">' + (index + 1) + '</span>' +
          statusBadge +
        '</div>' +
        '<h4 class="scenario-card-title">' + scenario.title + '</h4>' +
        '<p class="scenario-card-desc">' + scenario.description + '</p>' +
        (completed ? '<div class="scenario-badge-earned">' + scenario.badge + '</div>' : '');

      card.onclick = function() { loadScenario(scenario.id); };
      listEl.appendChild(card);
    });
  }

  function loadScenario(scenarioId) {
    var scenario = null;
    for (var i = 0; i < scenarios.length; i++) {
      if (scenarios[i].id === scenarioId) {
        scenario = scenarios[i];
        break;
      }
    }
    if (!scenario) return;

    var listEl = document.getElementById('scenarioList');
    var detailEl = document.getElementById('scenarioDetail');
    var detailTitle = document.getElementById('scenarioDetailTitle');
    var backBtn = document.getElementById('scenarioBackBtn');

    if (listEl) listEl.classList.add('hidden');
    if (detailEl) detailEl.classList.remove('hidden');
    if (detailTitle) detailTitle.textContent = scenario.title;
    if (backBtn) backBtn.onclick = function() { renderScenarioList(); renderProgressBar(); };

    if (detailEl) detailEl.setAttribute('data-scenario-id', scenarioId);

    renderStoryNode(scenarioId, 'start');
  }

  function renderStoryNode(scenarioId, nodeId) {
    if (nodeId === '_back') {
      renderScenarioList();
      renderProgressBar();
      return;
    }

    var scenario = null;
    for (var i = 0; i < scenarios.length; i++) {
      if (scenarios[i].id === scenarioId) {
        scenario = scenarios[i];
        break;
      }
    }
    if (!scenario) return;

    var node = scenario.nodes[nodeId];
    if (!node) return;

    var textEl = document.getElementById('gameText');
    var optionsEl = document.getElementById('gameOptions');
    var feedbackEl = document.getElementById('gameFeedback');
    var sceneEl = document.getElementById('gameScene');

    if (!textEl || !optionsEl || !feedbackEl || !sceneEl) return;

    // Simpan progress otomatis saat user mencapai ending success.
    // Ini membuat progress bar langsung bergerak setelah memilih jawaban benar,
    // tanpa bergantung pada klik tombol selesai.
    if (node.feedback && node.feedback.type === 'success') {
      saveProgress(scenarioId);
      renderProgressBar();
    }

    sceneEl.style.opacity = '0';

    setTimeout(function() {
      textEl.innerText = node.text;
      optionsEl.innerHTML = '';

      node.options.forEach(function(opt) {
        var btn = document.createElement('button');
        btn.innerText = opt.text;
        if (opt.isSuccess === true) {
          btn.className = 'quiz-option-success';
        }
        if (opt.isRestart) {
          btn.className = 'quiz-option-restart';
        }
        btn.onclick = function() {
          if (opt.isSuccess === true) {
            saveProgress(scenarioId);
            renderProgressBar();
          }
          renderStoryNode(scenarioId, opt.nextNode);
        };
        optionsEl.appendChild(btn);
      });

      if (node.feedback) {
        feedbackEl.className = 'result ' + node.feedback.type;
        feedbackEl.innerHTML = node.feedback.message;
        feedbackEl.classList.remove('hidden');
      } else {
        feedbackEl.className = 'result hidden';
      }

      sceneEl.style.opacity = '1';
    }, 300);
  }

  // --- Public API ---
  window.renderStoryNode = renderStoryNode;
  window.loadScenario = loadScenario;
  window.renderScenarioList = renderScenarioList;
  window.renderProgressBar = renderProgressBar;

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('scenarioList') || document.getElementById('gamificationContainer')) {
      renderProgressBar();
      renderScenarioList();
    }
  });
})();
