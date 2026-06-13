(function() {
  window.currentViewedInvoiceId = null;

  window.submitReport = async function(event) {
    event.preventDefault();
    var resultBox = document.getElementById('reportResult');
    var btn = event.target.querySelector('button[type="submit"]');

    btn.innerText = 'Mengirim Laporan...';
    btn.style.opacity = '0.7';

    try {
      var response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: document.getElementById('category').value,
          location: sanitizeInput(document.getElementById('location').value),
          urgency: document.getElementById('urgent').value,
          incidentDate: document.getElementById('incidentDate').value,
          description: sanitizeInput(document.getElementById('description').value),
          evidence: document.getElementById('evidence').files.length > 0
            ? sanitizeInput(document.getElementById('evidence').files[0].name)
            : 'Tidak ada lampiran',
          isAnonymous: document.getElementById('isAnonymous').checked
        })
      });

      var data = await response.json();

      if (!response.ok) {
        resultBox.classList.remove('hidden');
        resultBox.classList.add('error');
        resultBox.innerText = data.error || 'Gagal mengirim laporan';
        btn.innerText = 'Kirim Laporan (Demo)';
        btn.style.opacity = '1';
        return;
      }

      btn.innerText = 'Kirim Laporan (Demo)';
      btn.style.opacity = '1';

      resultBox.classList.remove('hidden');
      resultBox.classList.add('success');
      resultBox.innerHTML = '<strong>Laporan Demo Berhasil Dikirim!</strong><br><br>' +
        'Nomor Pelacakan: <b>' + data.report.id + '</b><br>' +
        '<button class="btn secondary" type="button" onclick="viewInvoiceFromSubmit(\'' + data.report.id + '\')" style="margin-top: 10px;">Lacak Status</button>';

      event.target.reset();
    } catch (err) {
      btn.innerText = 'Kirim Laporan (Demo)';
      btn.style.opacity = '1';
      resultBox.classList.remove('hidden');
      resultBox.classList.add('error');
      resultBox.innerText = 'Koneksi gagal. Coba lagi.';
    }
  };

  window.viewInvoiceFromSubmit = function(id) {
    window.location.hash = '#dashboard';
    setTimeout(function() {
      var report = reportData.find(function(r) { return r.id === id; });
      if (report) {
        document.getElementById('invoiceResult').classList.remove('hidden');
        renderInvoice(report);
        document.getElementById('invoiceResult').scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  function renderInvoice(report) {
    currentViewedInvoiceId = report.id;
    var invoiceBox = document.getElementById('invoiceResult');

    var t1 = '', t2 = '', t3 = '', t4 = '';
    if (report.status === 'Baru Masuk') {
      t1 = 'active';
    } else if (report.status === 'Direview') {
      t1 = 'done'; t2 = 'active';
    } else if (report.status === 'Diproses') {
      t1 = 'done'; t2 = 'done'; t3 = 'active';
    } else if (report.status === 'Selesai') {
      t1 = 'done'; t2 = 'done'; t3 = 'done'; t4 = 'done';
    }

    invoiceBox.innerHTML = '<div class="invoice-header">' +
      '<h3>Tanda Terima Pengaduan</h3>' +
      '<p class="muted" style="margin:0;">No. Pelacakan: <strong>' + report.id + '</strong></p>' +
      '</div>' +
      '<div class="invoice-details">' +
      '<div><span>Tanggal Kejadian:</span><br><strong>' + report.date + '</strong></div>' +
      '<div><span>Kategori:</span><br><strong>' + report.cat + '</strong></div>' +
      '<div><span>Lokasi:</span><br><strong>' + report.loc + '</strong></div>' +
      '<div><span>Tingkat Urgensi:</span><br><strong>' + report.urg + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Lampiran Bukti:</span><br><strong style="color: var(--primary);">' + (report.evidence || 'Tidak ada lampiran') + '</strong></div>' +
      '<div style="grid-column: 1 / -1;"><span>Kronologi Singkat:</span><br><strong style="font-weight: 500; font-size: 13px; line-height: 1.5; margin-top: 4px;">"' + report.desc + '"</strong></div>' +
      '</div>' +
      '<div class="timeline-container">' +
      '<h4 style="margin: 0 0 16px 0;">Update Status Pelaporan</h4>' +
      '<ul class="timeline">' +
      '<li class="timeline-item ' + (t1 || 'done') + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Laporan Diterima</h4><p>Simulasi: laporan disimpan di browser lokal.</p></div></li>' +
      '<li class="timeline-item ' + t2 + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Tahap Review (Verifikasi)</h4><p>Tim admin memverifikasi kelayakan berkas.</p></div></li>' +
      '<li class="timeline-item ' + t3 + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Sedang Diproses</h4><p>Kasus ditangani unit kemahasiswaan/Satgas PPKS.</p></div></li>' +
      '<li class="timeline-item ' + t4 + '"><div class="timeline-marker"></div><div class="timeline-content"><h4>Tindak Lanjut & Appointment</h4><p style="color: var(--primary); font-weight: 600; margin-top: 4px;">Info: ' + report.appointment + '</p></div></li>' +
      '</ul>' +
      '</div>';
  }

  window.renderInvoice = renderInvoice;

  window.updateUserDashboardUI = function() {
    if (!currentUser || (currentUser.role !== 'user' && currentUser.role !== 'mahasiswa')) return;
    var listContainer = document.getElementById('userReportList');
    var userReports = reportData.filter(function(r) { return r.author === currentUser.name; });

    if (userReports.length === 0) {
      listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Anda belum pernah membuat laporan.</p>';
      return;
    }

    listContainer.innerHTML = '';
    userReports.forEach(function(report) {
      var riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
      var html = '<div class="report-item" onclick="viewInvoiceFromSubmit(\'' + report.id + '\')">' +
        '<div class="report-info">' +
        '<h4>' + report.id + ' <span style="color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;">' + report.date + '</span></h4>' +
        '<p><b>Kategori:</b> ' + report.cat + ' &bull; <b>Status Laporan:</b> <span style="color:var(--primary); font-weight:bold;">' + report.status + '</span></p>' +
        '</div>' +
        '<div class="risk-badge ' + riskClass + '">Lihat Invoice &gt;</div>' +
        '</div>';
      listContainer.insertAdjacentHTML('beforeend', html);
    });
  };
})();
