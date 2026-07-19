(function() {
  window.currentViewedInvoiceId = null;

  window.submitReport = async function(event) {
    event.preventDefault();
    var resultBox = document.getElementById('reportResult');
    var btn = event.target.querySelector('button[type="submit"]');

    btn.innerText = 'Mengirim Laporan...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
      // Check if there are files to upload
      var hasFiles = window.evidenceUpload && window.evidenceUpload.hasFiles();
      var reportId = null;

      if (hasFiles) {
        var formData = new FormData();
        formData.append('category', document.getElementById('category').value);
        formData.append('location', document.getElementById('location').value.trim());
        formData.append('urgency', document.getElementById('urgent').value);
        formData.append('incidentDate', document.getElementById('incidentDate').value);
        formData.append('description', document.getElementById('description').value.trim());
        formData.append('evidence', document.getElementById('evidence').value.trim() || 'Tidak ada lampiran');
        formData.append('isAnonymous', String(document.getElementById('isAnonymous').checked));
        window.evidenceUpload.getSelectedFiles().forEach(function(file) {
          formData.append('evidence', file);
        });

        window.activeEvidenceUploadAbort = new AbortController();
        var reportResponse = await fetch('/api/reports', {
          method: 'POST',
          body: formData,
          signal: window.activeEvidenceUploadAbort.signal
        });
        window.activeEvidenceUploadAbort = null;

        var reportData = await reportResponse.json();

        if (!reportResponse.ok) {
          throw new Error(reportData.error || 'Gagal membuat laporan');
        }

        reportId = reportData.report.id;
        var uploadResults = (reportData.evidence || []).map(function(item) {
          return { success: item.scanStatus === 'clean', evidence: item };
        });
        var failedUploads = uploadResults.filter(function(item) { return !item.success; });

        // Clear files after upload
        window.evidenceUpload.clearFiles();

        // Show success with report data
        resultBox.classList.remove('hidden');
        resultBox.classList.add('success');
        clearElement(resultBox);
        resultBox.appendChild(createEl('strong', { text: 'Laporan Berhasil Dikirim!' }));
        resultBox.appendChild(document.createElement('br'));
        resultBox.appendChild(document.createElement('br'));
        resultBox.appendChild(document.createTextNode('Nomor Referensi: '));
        resultBox.appendChild(createEl('b', { text: reportId }));
        resultBox.appendChild(document.createElement('br'));

        // Show upload summary
        var successUploads = uploadResults.filter(r => r.success);
        if (successUploads.length > 0) {
          resultBox.appendChild(createEl('p', {
            text: `${successUploads.length} file berhasil diupload.`,
            style: 'color:var(--ok); font-size:13px; margin-top:8px;'
          }));
        }
        if (failedUploads.length > 0) {
          resultBox.appendChild(createEl('p', {
            text: `${failedUploads.length} file gagal diupload.`,
            style: 'color:var(--warn); font-size:13px;'
          }));
        }

        if (reportData.report.isAnonymous) {
          resultBox.appendChild(createEl('p', { text: 'Laporan ini anonim: identitas akun nggak dicatat. Statusnya juga nggak bisa dicek dari dashboard.', style: 'color:var(--muted); font-size:13px;' }));
        } else {
          var trackBtn = createEl('button', { className: 'btn secondary', type: 'button', text: 'Lacak Status', style: 'margin-top: 10px;' });
          trackBtn.addEventListener('click', function() { viewInvoiceFromSubmit(reportId); });
          resultBox.appendChild(trackBtn);
        }
      } else {
        // No files, use original JSON approach
        var response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: document.getElementById('category').value,
            location: sanitizeInput(document.getElementById('location').value),
            urgency: document.getElementById('urgent').value,
            incidentDate: document.getElementById('incidentDate').value,
            description: sanitizeInput(document.getElementById('description').value),
            evidence: document.getElementById('evidence').value.trim() || 'Tidak ada lampiran',
            isAnonymous: document.getElementById('isAnonymous').checked
          })
        });

        var data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Gagal mengirim laporan');
        }

        resultBox.classList.remove('hidden');
        resultBox.classList.add('success');
        clearElement(resultBox);
        resultBox.appendChild(createEl('strong', { text: 'Laporan Berhasil Dikirim!' }));
        resultBox.appendChild(document.createElement('br'));
        resultBox.appendChild(document.createElement('br'));
        resultBox.appendChild(document.createTextNode('Nomor Referensi: '));
        resultBox.appendChild(createEl('b', { text: data.report.id }));
        resultBox.appendChild(document.createElement('br'));
        if (data.report.isAnonymous) {
          resultBox.appendChild(createEl('p', { text: 'Laporan ini anonim: identitas akun nggak dicatat. Statusnya juga nggak bisa dicek dari dashboard.', style: 'color:var(--muted); font-size:13px;' }));
        } else {
          var trackBtn = createEl('button', { className: 'btn secondary', type: 'button', text: 'Lacak Status', style: 'margin-top: 10px;' });
          trackBtn.addEventListener('click', function() { viewInvoiceFromSubmit(data.report.id); });
          resultBox.appendChild(trackBtn);
        }
      }

      event.target.reset();
    } catch (err) {
      resultBox.classList.remove('hidden');
      resultBox.classList.add('error');
      resultBox.innerText = err.name === 'AbortError' ? 'Pengiriman dibatalkan.' : (err.message || 'Koneksi gagal. Coba lagi.');
    } finally {
      window.activeEvidenceUploadAbort = null;
      btn.innerText = 'Kirim Laporan';
      btn.style.opacity = '1';
      btn.disabled = false;
    }
  };

  window.viewInvoiceFromSubmit = async function(id) {
    window.location.hash = '#dashboard';

    try {
      var response = await fetch('/api/reports/' + encodeURIComponent(id));
      if (!response.ok) return;
      var data = await response.json();
      if (!data.report) return;

      document.getElementById('invoiceResult').classList.remove('hidden');
      renderInvoice(data.report);
      document.getElementById('invoiceResult').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {}
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

    clearElement(invoiceBox);

    var header = createEl('div', { className: 'invoice-header' });
    header.appendChild(createEl('h3', { text: 'Tanda Terima Pengaduan' }));
    var trackingP = createEl('p', { className: 'muted', style: 'margin:0;' });
    trackingP.appendChild(document.createTextNode('No. Pelacakan: '));
    trackingP.appendChild(createEl('strong', { text: report.id }));
    header.appendChild(trackingP);
    invoiceBox.appendChild(header);

    var details = createEl('div', { className: 'invoice-details' });
    var invFields = [
      { label: 'Tanggal Kejadian:', value: report.incidentDate },
      { label: 'Kategori:', value: report.category },
      { label: 'Lokasi:', value: report.location },
      { label: 'Tingkat Urgensi:', value: report.urgency }
    ];
    invFields.forEach(function(f) {
      var d = createEl('div');
      d.appendChild(createEl('span', { text: f.label }));
      appendBr(d);
      d.appendChild(createEl('strong', { text: f.value }));
      details.appendChild(d);
    });

    var evidenceDiv = createEl('div', { style: 'grid-column: 1 / -1;' });
    evidenceDiv.appendChild(createEl('span', { text: 'Lampiran Bukti:' }));
    appendBr(evidenceDiv);
    evidenceDiv.appendChild(createEl('strong', { text: report.evidence || 'Tidak ada lampiran', style: 'color: var(--primary);' }));
    details.appendChild(evidenceDiv);

    var descDiv = createEl('div', { style: 'grid-column: 1 / -1;' });
    descDiv.appendChild(createEl('span', { text: 'Kronologi Singkat:' }));
    appendBr(descDiv);
    descDiv.appendChild(createEl('strong', { text: '"' + report.description + '"', style: 'font-weight: 500; font-size: 13px; line-height: 1.5; margin-top: 4px;' }));
    details.appendChild(descDiv);
    invoiceBox.appendChild(details);

    var timelineContainer = createEl('div', { className: 'timeline-container' });
    timelineContainer.appendChild(createEl('h4', { text: 'Update Status Pelaporan', style: 'margin: 0 0 16px 0;' }));
    var ul = createEl('ul', { className: 'timeline' });

    var timelineSteps = [
      { cls: t1 || 'done', title: 'Laporan Diterima', desc: 'Laporan tersimpan di server SafeSphere.' },
      { cls: t2, title: 'Tahap Review (Verifikasi)', desc: 'Tim admin memverifikasi kelayakan berkas.' },
      { cls: t3, title: 'Sedang Diproses', desc: 'Kasus ditangani unit kemahasiswaan/Satgas PPKS.' }
    ];
    timelineSteps.forEach(function(s) {
      var li = createEl('li', { className: 'timeline-item ' + s.cls });
      li.appendChild(createEl('div', { className: 'timeline-marker' }));
      var tc = createEl('div', { className: 'timeline-content' });
      tc.appendChild(createEl('h4', { text: s.title }));
      tc.appendChild(createEl('p', { text: s.desc }));
      li.appendChild(tc);
      ul.appendChild(li);
    });

    var li4 = createEl('li', { className: 'timeline-item ' + t4 });
    li4.appendChild(createEl('div', { className: 'timeline-marker' }));
    var tc4 = createEl('div', { className: 'timeline-content' });
    tc4.appendChild(createEl('h4', { text: 'Tindak Lanjut & Appointment' }));
    tc4.appendChild(createEl('p', { text: 'Info: ' + (report.appointment || ''), style: 'color: var(--primary); font-weight: 600; margin-top: 4px;' }));
    li4.appendChild(tc4);
    ul.appendChild(li4);
    timelineContainer.appendChild(ul);
    invoiceBox.appendChild(timelineContainer);
  }

  window.renderInvoice = renderInvoice;

  window.updateUserDashboardUI = async function() {
    if (!currentUser) return;
    var listContainer = document.getElementById('userReportList');
    
    try {
      var response = await fetch('/api/reports');
      if (!response.ok) {
        clearElement(listContainer);
        listContainer.appendChild(createEl('p', { className: 'muted', style: 'text-align:center; padding:20px;', text: 'Gagal memuat laporan.' }));
        return;
      }
      var data = await response.json();
      var userReports = data.reports;
    } catch (err) {
      clearElement(listContainer);
      listContainer.appendChild(createEl('p', { className: 'muted', style: 'text-align:center; padding:20px;', text: 'Gagal memuat laporan.' }));
      return;
    }

    clearElement(listContainer);
    if (userReports.length === 0) {
      listContainer.appendChild(createEl('p', { className: 'muted', style: 'text-align:center; padding:20px;', text: 'Anda belum pernah membuat laporan.' }));
      return;
    }

    userReports.forEach(function(report) {
      var riskClass = report.urgency === 'Tinggi' ? 'risk-tinggi' : (report.urgency === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
      var item = createEl('button', { className: 'report-item', type: 'button' });
      item.addEventListener('click', function() { viewInvoiceFromSubmit(report.id); });
      var info = createEl('div', { className: 'report-info' });
      info.appendChild(createEl('h4', {}, [
        report.id,
        createEl('span', { text: report.incidentDate, style: 'color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;' })
      ]));
      var p = createEl('p');
      p.appendChild(document.createTextNode('Kategori: '));
      p.appendChild(createEl('b', { text: report.category }));
      p.appendChild(document.createTextNode(' \u2022 Status Laporan: '));
      p.appendChild(createEl('span', { text: report.status, style: 'color:var(--primary); font-weight:bold;' }));
      info.appendChild(p);
      item.appendChild(info);
      item.appendChild(createEl('div', { className: 'risk-badge ' + riskClass, text: 'Lihat Invoice >' }));
      listContainer.appendChild(item);
    });
  };
})();
