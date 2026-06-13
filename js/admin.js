(function() {
  var chartInstance = null;

  window.initChart = function() {
    var ctx = document.getElementById('categoryChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Verbal', 'Sosial', 'Cyberbullying', 'Fisik', 'Seksual'],
        datasets: [{
          label: 'Jumlah Laporan',
          data: [0, 0, 0, 0, 0],
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  };

  window.seedDemoData = function() {
    var dummies = [
      { id: 'SSF-2026-1001', cat: 'Cyberbullying', loc: 'Grup WA Kelas', urg: 'Tinggi', date: '2026-06-02', status: 'Baru Masuk', desc: 'Saya diejek dan foto saya disebar di grup tanpa izin.', evidence: 'demo-bukti.png', appointment: 'Menunggu proses peninjauan awal.', createdAt: Date.now() - 20000, author: 'demo_user', displayName: 'D***' },
      { id: 'SSF-2026-1002', cat: 'Verbal', loc: 'Ruang Kelas', urg: 'Sedang', date: '2026-06-05', status: 'Direview', desc: 'Saya sering dihina soal penampilan saat presentasi.', evidence: 'Tidak ada lampiran', appointment: 'Sedang dalam peninjauan bukti oleh Admin.', createdAt: Date.now() - 15000, author: 'demo_user', displayName: 'demo_user' },
      { id: 'SSF-2026-1003', cat: 'Sosial', loc: 'Lingkungan Kampus', urg: 'Rendah', date: '2026-06-06', status: 'Selesai', desc: 'Teman saya dikucilkan dari kelompok tugas.', evidence: 'Tidak ada lampiran', appointment: 'Telah dilakukan mediasi dan edukasi pencegahan.', createdAt: Date.now() - 10000, author: 'demo_user', displayName: 'D***' },
      { id: 'SSF-2026-1004', cat: 'Fisik', loc: 'Parkiran Kampus', urg: 'Tinggi', date: '2026-06-08', status: 'Diproses', desc: 'Ada tindakan represif dan ancaman jika saya melapor.', evidence: 'rekaman_suara.mp3', appointment: 'Jadwal Konseling: Kasus dialihkan ke Satgas PPKS.', createdAt: Date.now() - 5000, author: 'demo_user', displayName: 'demo_user' }
    ];

    reportData = dummies.slice();
    Storage.save('reports', reportData);
    updateDashboardUI();
    showTopSystemAlert('Data demo berhasil dimuat!');
  };

  window.clearAllData = function() {
    if (confirm('Apakah Anda yakin ingin menghapus semua data laporan demo?')) {
      reportData = [];
      Storage.remove('reports');
      updateDashboardUI();
    }
  };

  window.updateDashboardUI = function() {
    var total = reportData.length;
    var tinggi = reportData.filter(function(r) { return r.urg === 'Tinggi'; }).length;
    var selesai = reportData.filter(function(r) { return r.status === 'Selesai'; }).length;

    var catCounts = {};
    var dominant = '-';
    var maxCount = 0;
    reportData.forEach(function(r) {
      catCounts[r.cat] = (catCounts[r.cat] || 0) + 1;
      if (catCounts[r.cat] > maxCount) { maxCount = catCounts[r.cat]; dominant = r.cat; }
    });

    document.getElementById('m-total').innerText = total;
    document.getElementById('m-tinggi').innerText = tinggi;
    document.getElementById('m-selesai').innerText = selesai;
    document.getElementById('m-dominan').innerText = dominant;

    if (chartInstance) {
      chartInstance.data.datasets[0].data = [
        catCounts['Verbal'] || 0, catCounts['Sosial'] || 0, catCounts['Cyberbullying'] || 0, catCounts['Fisik'] || 0, catCounts['Seksual'] || 0
      ];
      chartInstance.update();
    }

    var listContainer = document.getElementById('adminReportList');
    if (reportData.length === 0) {
      listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Belum ada data laporan.</p>';
      return;
    }

    listContainer.innerHTML = '';
    reportData.forEach(function(report) {
      var riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
      var html = '<div class="report-item" onclick="viewReportDetail(\'' + report.id + '\')">' +
        '<div class="report-info">' +
        '<h4>' + report.id + ' <span style="color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;">' + report.date + '</span></h4>' +
        '<p><b>Kategori:</b> ' + report.cat + ' &bull; <b>Pelapor:</b> ' + (report.displayName || report.author) + ' &bull; <b>Status:</b> <span style="color:var(--primary);">' + report.status + '</span></p>' +
        '</div>' +
        '<div class="risk-badge ' + riskClass + '">Urgensi ' + report.urg + '</div>' +
        '</div>';
      listContainer.insertAdjacentHTML('beforeend', html);
    });
  };

  var currentDetailId = null;

  window.viewReportDetail = function(id) {
    var report = reportData.find(function(r) { return r.id === id; });
    if (!report) return;
    currentDetailId = id;

    document.getElementById('detailTitle').innerText = 'Detail Kasus ' + report.id;

    var content = '<div style="grid-column: 1 / -1; background: #e8f0ff; padding: 12px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 8px;">' +
      '<span style="color: var(--primary2);">Pelapor:</span><br>' +
      '<strong style="font-size: 16px; color: var(--primary);">' + (report.displayName || report.author) + '</strong>' +
      '</div>' +
      '<div><span>Waktu Kejadian:</span><br><strong>' + report.date + '</strong></div>' +
      '<div><span>Kategori:</span><br><strong>' + report.cat + '</strong></div>' +
      '<div><span>Lokasi Kejadian:</span><br><strong>' + report.loc + '</strong></div>' +
      '<div><span>Tingkat Risiko:</span><br><strong>' + report.urg + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Lampiran Bukti:</span><br><strong style="color: var(--primary);">' + (report.evidence || 'Tidak ada lampiran') + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Kronologi Lengkap:</span><br><strong style="font-weight: 500; font-size: 14px; line-height: 1.5; margin-top: 4px;">"' + report.desc + '"</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Status Terakhir:</span><br><strong style="color: var(--primary);">' + report.status + '</strong></div>';
    document.getElementById('detailContent').innerHTML = content;

    var selectStatus = report.status;
    if (selectStatus === 'Baru Masuk' || selectStatus === 'Direview' || selectStatus === 'Diproses' || selectStatus === 'Selesai') {
      document.getElementById('updateStatusSelect').value = selectStatus;
    } else {
      document.getElementById('updateStatusSelect').value = 'Baru Masuk';
    }

    document.getElementById('updateAppointment').value = report.appointment || '';
    document.getElementById('reportDetailModal').classList.add('show');
  };

  window.closeReportDetailModal = function() {
    document.getElementById('reportDetailModal').classList.remove('show');
    currentDetailId = null;
  };

  window.saveReportStatus = function() {
    if (!currentDetailId) return;
    var report = reportData.find(function(r) { return r.id === currentDetailId; });
    if (report) {
      var newStatus = document.getElementById('updateStatusSelect').value;
      var newAppt = sanitizeInput(document.getElementById('updateAppointment').value) || 'Menunggu pembaruan lanjutan...';

      report.status = newStatus;
      report.appointment = newAppt;
      Storage.save('reports', reportData);
      updateDashboardUI();
      updateUserDashboardUI();

      closeReportDetailModal();
      showTopSystemAlert('Berhasil! Status terupdate secara real-time.');
    }
  };

  window.addEventListener('click', function(event) {
    var modal1 = document.getElementById('reportDetailModal');
    var modal2 = document.getElementById('forgotPasswordModal');
    if (event.target === modal1) closeReportDetailModal();
    if (event.target === modal2) closeForgotModal();
  });
})();
