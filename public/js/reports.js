(function() {
  window.currentViewedInvoiceId = null;

  window.submitReport = function(event) {
    event.preventDefault();
    var resultBox = document.getElementById('reportResult');
    var btn = event.target.querySelector('button[type="submit"]');

    btn.innerText = 'Mengirim Laporan (Demo)...';
    btn.style.opacity = '0.7';

    setTimeout(function() {
      var trackingID = 'SSF-2026-' + Math.floor(1000 + Math.random() * 9000);
      var evidenceInput = document.getElementById('evidence');
      var evidenceName = 'Tidak ada lampiran';
      if (evidenceInput.files.length > 0) {
        evidenceName = sanitizeInput(evidenceInput.files[0].name);
      }

      var checkboxAnon = document.getElementById('isAnonymous');
      var isAnon = checkboxAnon ? checkboxAnon.checked : true;

      var originalName = currentUser ? currentUser.name : 'Anonim';
      var maskedName = originalName !== 'Anonim' ? originalName.charAt(0).toUpperCase() + '***' : 'Anonim';

      var newReport = {
        id: trackingID,
        cat: document.getElementById('category').value,
        loc: sanitizeInput(document.getElementById('location').value),
        urg: document.getElementById('urgent').value,
        date: document.getElementById('incidentDate').value,
        status: 'Baru Masuk',
        desc: sanitizeInput(document.getElementById('description').value),
        evidence: evidenceName,
        appointment: 'Menunggu proses peninjauan awal dari tim Satgas.',
        createdAt: Date.now(),
        author: originalName,
        displayName: isAnon ? maskedName : originalName
      };

      reportData.unshift(newReport);
      Storage.save('reports', reportData);

      if (window.location.hash === '#admin') updateDashboardUI();
      if (window.location.hash === '#dashboard') updateUserDashboardUI();

      btn.innerText = 'Kirim Laporan (Demo)';
      btn.style.opacity = '1';

      resultBox.classList.remove('hidden');
      resultBox.classList.add('success');
      resultBox.innerHTML = '<strong>Laporan Demo Berhasil Dikirim!</strong><br><br>' +
        'Nomor Pelacakan Anda: <b style="font-size:18px; color:var(--ink);">' + trackingID + '</b><br>' +
        '<em>Simulasi: data disimpan di browser lokal.</em><br><br>' +
        '<button class="btn secondary" type="button" onclick="viewInvoiceFromSubmit(\'' + trackingID + '\')" style="margin-top: 10px;">Lacak Status Laporan Ini</button>';

      event.target.reset();
    }, 1500);
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
    if (!currentUser || currentUser.role !== 'mahasiswa') return;
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
