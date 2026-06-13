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
      clearElement(resultBox);
      resultBox.appendChild(createEl('strong', { text: 'Laporan Demo Berhasil Dikirim!' }));
      resultBox.appendChild(document.createElement('br'));
      resultBox.appendChild(document.createElement('br'));
      resultBox.appendChild(document.createTextNode('Nomor Referensi: '));
      resultBox.appendChild(createEl('b', { text: data.report.id }));
      resultBox.appendChild(document.createElement('br'));
      if (data.report.isAnonymous) {
        resultBox.appendChild(createEl('p', { text: 'Laporan anonim tidak dapat dilacak.', style: 'color:var(--muted); font-size:13px;' }));
      } else {
        var btn = createEl('button', { className: 'btn secondary', type: 'button', text: 'Lacak Status', style: 'margin-top: 10px;' });
        btn.addEventListener('click', function() { viewInvoiceFromSubmit(data.report.id); });
        resultBox.appendChild(btn);
      }

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
      { cls: t1 || 'done', title: 'Laporan Diterima', desc: 'Laporan disimpan di server demo.' },
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
