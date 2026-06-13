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
    clearElement(listContainer);
    if (reportData.length === 0) {
      listContainer.appendChild(createEl('p', { className: 'muted', style: 'text-align:center; padding:20px;', text: 'Belum ada data laporan.' }));
      return;
    }

    reportData.forEach(function(report) {
      var riskClass = report.urgency === 'Tinggi' ? 'risk-tinggi' : (report.urgency === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
      var item = createEl('button', { className: 'report-item', type: 'button' });
      item.addEventListener('click', function() { viewReportDetail(report.id); });
      var info = createEl('div', { className: 'report-info' });
      info.appendChild(createEl('h4', {}, [
        report.id,
        createEl('span', { text: report.incidentDate, style: 'color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;' })
      ]));
      var p = createEl('p');
      p.appendChild(document.createTextNode('Kategori: '));
      p.appendChild(createEl('b', { text: report.category }));
      p.appendChild(document.createTextNode(' \u2022 Pelapor: '));
      p.appendChild(createEl('b', { text: report.authorName }));
      p.appendChild(document.createTextNode(' \u2022 Status: '));
      p.appendChild(createEl('span', { text: report.status, style: 'color:var(--primary);' }));
      info.appendChild(p);
      item.appendChild(info);
      item.appendChild(createEl('div', { className: 'risk-badge ' + riskClass, text: 'Urgensi ' + report.urgency }));
      listContainer.appendChild(item);
    });
  };

  var currentDetailId = null;

  window.viewReportDetail = function(id) {
    var report = reportData.find(function(r) { return r.id === id; });
    if (!report) return;
    currentDetailId = id;

    document.getElementById('detailTitle').innerText = 'Detail Kasus ' + report.id;

    var contentEl = document.getElementById('detailContent');
    clearElement(contentEl);

    var reporterBox = createEl('div', { style: 'grid-column: 1 / -1; background: #e8f0ff; padding: 12px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 8px;' });
    reporterBox.appendChild(createEl('span', { text: 'Pelapor:', style: 'color: var(--primary2);' }));
    appendBr(reporterBox);
    reporterBox.appendChild(createEl('strong', { text: report.authorName, style: 'font-size: 16px; color: var(--primary);' }));
    contentEl.appendChild(reporterBox);

    var fields = [
      { label: 'Waktu Kejadian:', value: report.incidentDate },
      { label: 'Kategori:', value: report.category },
      { label: 'Lokasi Kejadian:', value: report.location },
      { label: 'Tingkat Risiko:', value: report.urgency }
    ];
    fields.forEach(function(f) {
      var d = createEl('div');
      d.appendChild(createEl('span', { text: f.label }));
      appendBr(d);
      d.appendChild(createEl('strong', { text: f.value }));
      contentEl.appendChild(d);
    });

    var evidenceDiv = createEl('div', { style: 'grid-column: 1 / -1;' });
    evidenceDiv.appendChild(createEl('span', { text: 'Lampiran Bukti:' }));
    appendBr(evidenceDiv);
    evidenceDiv.appendChild(createEl('strong', { text: report.evidence || 'Tidak ada lampiran', style: 'color: var(--primary);' }));
    contentEl.appendChild(evidenceDiv);

    var descDiv = createEl('div', { style: 'grid-column: 1 / -1;' });
    descDiv.appendChild(createEl('span', { text: 'Kronologi Lengkap:' }));
    appendBr(descDiv);
    descDiv.appendChild(createEl('strong', { text: '"' + report.description + '"', style: 'font-weight: 500; font-size: 14px; line-height: 1.5; margin-top: 4px;' }));
    contentEl.appendChild(descDiv);

    var statusDiv = createEl('div', { style: 'grid-column: 1 / -1;' });
    statusDiv.appendChild(createEl('span', { text: 'Status Terakhir:' }));
    appendBr(statusDiv);
    statusDiv.appendChild(createEl('strong', { text: report.status, style: 'color: var(--primary);' }));
    contentEl.appendChild(statusDiv);

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
