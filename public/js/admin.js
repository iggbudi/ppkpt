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

  window.seedDemoData = async function() {
    try {
      var response = await fetch('/api/reports/seed', { method: 'POST' });
      if (response.ok) {
        showTopSystemAlert('Data demo berhasil dimuat!');
        updateDashboardUI();
      }
    } catch (err) {
      showTopSystemAlert('Gagal memuat data demo');
    }
  };

  window.clearAllData = async function() {
    if (!confirm('Hapus semua data?')) return;
    try {
      var response = await fetch('/api/reports', { method: 'DELETE' });
      if (response.ok) {
        reportData = [];
        updateDashboardUI();
      }
    } catch (err) {
      showTopSystemAlert('Gagal menghapus data');
    }
  };

  window.updateDashboardUI = async function() {
    try {
      var response = await fetch('/api/reports');
      if (response.ok) {
        var data = await response.json();
        reportData = data.reports;
      }
    } catch (err) {}

    var total = reportData.length;
    var tinggi = reportData.filter(function(r) { return r.urgency === 'Tinggi'; }).length;
    var selesai = reportData.filter(function(r) { return r.status === 'Selesai'; }).length;

    var catCounts = {};
    var dominant = '-';
    var maxCount = 0;
    reportData.forEach(function(r) {
      catCounts[r.category] = (catCounts[r.category] || 0) + 1;
      if (catCounts[r.category] > maxCount) { maxCount = catCounts[r.category]; dominant = r.category; }
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
      var riskClass = report.urgency === 'Tinggi' ? 'risk-tinggi' : (report.urgency === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
      var html = '<div class="report-item" onclick="viewReportDetail(\'' + report.id + '\')">' +
        '<div class="report-info">' +
        '<h4>' + report.id + ' <span style="color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;">' + report.incidentDate + '</span></h4>' +
        '<p><b>Kategori:</b> ' + report.category + ' &bull; <b>Pelapor:</b> ' + report.authorName + ' &bull; <b>Status:</b> <span style="color:var(--primary);">' + report.status + '</span></p>' +
        '</div>' +
        '<div class="risk-badge ' + riskClass + '">Urgensi ' + report.urgency + '</div>' +
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
      '<strong style="font-size: 16px; color: var(--primary);">' + report.authorName + '</strong>' +
      '</div>' +
      '<div><span>Waktu Kejadian:</span><br><strong>' + report.incidentDate + '</strong></div>' +
      '<div><span>Kategori:</span><br><strong>' + report.category + '</strong></div>' +
      '<div><span>Lokasi Kejadian:</span><br><strong>' + report.location + '</strong></div>' +
      '<div><span>Tingkat Risiko:</span><br><strong>' + report.urgency + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Lampiran Bukti:</span><br><strong style="color: var(--primary);">' + (report.evidence || 'Tidak ada lampiran') + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Kronologi Lengkap:</span><br><strong style="font-weight: 500; font-size: 14px; line-height: 1.5; margin-top: 4px;">"' + report.description + '"</strong></div>' +
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

  window.saveReportStatus = async function() {
    if (!currentDetailId) return;
    try {
      var response = await fetch('/api/reports/' + currentDetailId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: document.getElementById('updateStatusSelect').value,
          appointment: sanitizeInput(document.getElementById('updateAppointment').value)
        })
      });

      if (response.ok) {
        closeReportDetailModal();
        showTopSystemAlert('Status berhasil diupdate!');
        updateDashboardUI();
      }
    } catch (err) {
      showTopSystemAlert('Gagal update status');
    }
  };

  window.addEventListener('click', function(event) {
    var modal1 = document.getElementById('reportDetailModal');
    var modal2 = document.getElementById('forgotPasswordModal');
    if (event.target === modal1) closeReportDetailModal();
    if (event.target === modal2) closeForgotModal();
  });
})();
