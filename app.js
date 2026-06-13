// State Pengguna Global
    let currentUser = null; 
    let currentViewedInvoiceId = null;

    // --- Helper Sanitasi Input (Simulasi Backend Safety / XSS Protection) ---
    function sanitizeInput(text) {
      const element = document.createElement('div');
      element.innerText = text;
      return element.innerHTML.trim();
    }

    // --- Routing System (Simulasi SPA) ---
    function handleRouting() {
      let hash = window.location.hash || '#beranda';
      const validPages = ['#beranda', '#lapor', '#edukasi', '#kontak', '#chat', '#register', '#login', '#admin', '#dashboard'];
      
      if (!validPages.includes(hash)) {
        hash = '#beranda';
      }

      // Proteksi Akses Halaman Internal
      if (hash === '#lapor' && !currentUser) {
        showTopSystemAlert('Anda harus Masuk (Login) terlebih dahulu untuk membuat laporan.');
        window.location.hash = '#login';
        return;
      }
      if (hash === '#admin' && (!currentUser || currentUser.role !== 'admin')) {
        showTopSystemAlert('Akses Ditolak. Anda tidak memiliki otoritas Admin.');
        window.location.hash = '#login';
        return;
      }
      if (hash === '#dashboard' && (!currentUser || currentUser.role !== 'mahasiswa')) {
        showTopSystemAlert('Silakan login sebagai Mahasiswa untuk membuka Dashboard.');
        window.location.hash = '#login';
        return;
      }

      document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
      document.querySelectorAll('.main-nav a').forEach(link => link.classList.remove('active'));

      const targetPageId = 'page-' + hash.substring(1);
      const targetElement = document.getElementById(targetPageId);
      if (targetElement) targetElement.classList.add('active');

      const activeLink = document.querySelector(`.main-nav a[href="${hash}"]`);
      if (activeLink) activeLink.classList.add('active');

      if (hash === '#admin') {
        setTimeout(() => {
          if (!chartInstance) initChart();
          updateDashboardUI();
        }, 100);
      }
      if (hash === '#dashboard') {
        setTimeout(() => {
          updateUserDashboardUI();
        }, 100);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.addEventListener('hashchange', handleRouting);
    window.addEventListener('DOMContentLoaded', handleRouting);


    // --- Logika Login Utama dengan Proteksi Keamanan ---
    let currentLoginMode = 'mahasiswa';

    function switchLoginTab(mode) {
      currentLoginMode = mode;
      const tabM = document.getElementById('tabMahasiswa');
      const tabA = document.getElementById('tabAdmin');
      const subtitle = document.getElementById('loginSubtitle');
      const emailInput = document.getElementById('loginEmail');
      const errorBox = document.getElementById('loginError');
      
      if(errorBox) errorBox.classList.add('hidden');
      
      if (mode === 'admin') {
        tabM.style.borderBottomColor = 'transparent';
        tabM.style.color = 'var(--muted)';
        tabA.style.borderBottomColor = 'var(--primary)';
        tabA.style.color = 'var(--primary)';
        subtitle.innerHTML = 'Gunakan kredensial admin Anda.<br><em>(Demo: Username: <b>admin</b>, Password: <b>safesphere</b>)</em>';
        emailInput.placeholder = 'Username admin';
      } else {
        tabA.style.borderBottomColor = 'transparent';
        tabA.style.color = 'var(--muted)';
        tabM.style.borderBottomColor = 'var(--primary)';
        tabM.style.color = 'var(--primary)';
        subtitle.innerText = 'Silakan masukkan email/nama dan password Anda untuk melanjutkan.';
        emailInput.placeholder = 'Masukkan nama atau email';
      }
    }

    function handleMainLogin(event) {
      event.preventDefault();
      const user = sanitizeInput(document.getElementById('loginEmail').value);
      const pass = document.getElementById('loginPass').value;
      const errorBox = document.getElementById('loginError');

      errorBox.classList.add('hidden');
      errorBox.innerText = '';

      // Validasi Input Kosong
      if (!user || !pass) {
        errorBox.classList.remove('hidden');
        errorBox.innerText = '⚠️ Nama/Email dan Password tidak boleh kosong!';
        return;
      }

      if (currentLoginMode === 'admin' || user === 'admin') {
        // Proteksi Berlapis Kredensial Admin Kampus
        if (user !== 'admin' || pass !== 'safesphere') {
          errorBox.classList.remove('hidden');
          errorBox.innerHTML = '<strong>⚠️ AKSES DITOLAK:</strong> Kredensial Admin salah. Percobaan login ilegal ini otomatis dicatat oleh sistem pertahanan siber SafeSphere.';
          return;
        }
        
        currentUser = { role: 'admin', name: 'Admin PPKS' };
        
        document.getElementById('navGuest').classList.add('hidden');
        document.getElementById('navUser').classList.add('hidden');
        document.getElementById('navAdmin').classList.remove('hidden');
        
        document.getElementById('welcomeMessage').classList.remove('hidden');
        document.getElementById('welcomeName').innerText = currentUser.name;

        window.location.hash = '#admin';
      } else {
        // Login Ruang Lingkup Mahasiswa / Umum
        currentUser = { role: 'mahasiswa', name: user };
        
        document.getElementById('navGuest').classList.add('hidden');
        document.getElementById('navAdmin').classList.add('hidden');
        document.getElementById('navUser').classList.remove('hidden');
        document.getElementById('userNameDisplay').innerText = 'Halo, ' + user + '!';
        
        document.getElementById('welcomeMessage').classList.remove('hidden');
        document.getElementById('welcomeName').innerText = currentUser.name;

        window.location.hash = '#dashboard';
      }
      
      document.getElementById('loginEmail').value = '';
      document.getElementById('loginPass').value = '';
    }

    function handleLogout() {
      currentUser = null;
      document.getElementById('navGuest').classList.remove('hidden');
      document.getElementById('navUser').classList.add('hidden');
      document.getElementById('navAdmin').classList.add('hidden');
      document.getElementById('welcomeMessage').classList.add('hidden');
      document.getElementById('invoiceResult').classList.add('hidden');
      currentViewedInvoiceId = null;

      window.location.hash = '#beranda';
    }


    // --- Logika Lupa Password Modal ---
    function openForgotModal(event) {
      event.preventDefault();
      document.getElementById('forgotPasswordModal').classList.add('show');
    }

    function closeForgotModal() {
      document.getElementById('forgotPasswordModal').classList.remove('show');
    }

    function sendOTP(event) {
      event.preventDefault();
      const target = sanitizeInput(document.getElementById('otpTarget').value);
      if (!target) {
        showTopSystemAlert('Mohon masukkan No. HP atau Email terlebih dahulu.');
        return;
      }
      const btn = event.target;
      btn.innerText = 'Mengirim OTP...';
      btn.style.opacity = '0.7';

      setTimeout(() => {
        btn.innerText = 'Kirim Kode OTP';
        btn.style.opacity = '1';
        showTopSystemAlert(`Kode OTP berhasil dikirim ke: ${target}`);
        closeForgotModal();
      }, 1500);
    }


    // --- Database Simulation (Memori Lokal/Cloud) ---
    let reportData = [];
    let chartInstance = null;
    let db = null;
    let appId = 'safesphere-app-2026';

    async function initFirebase() {
      if (typeof __firebase_config === 'undefined') {
        console.warn("Berjalan dalam mode Memori Lokal.");
        return;
      }
      // Logika Firebase disembunyikan untuk fokus pada Mode Memori Lokal di Purwarupa
    }
    initFirebase();


    // --- Logika Admin Dashboard ---
    function initChart() {
      const ctx = document.getElementById('categoryChart').getContext('2d');
      if(chartInstance) chartInstance.destroy();
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
    }

    function seedDemoData() {
      const dummies = [
        { id: 'SSF-2026-1001', cat: 'Cyberbullying', loc: 'Grup WA Kelas', urg: 'Tinggi', date: '2026-06-02', status: 'Baru Masuk', desc: 'Saya diejek dan foto saya disebar di grup tanpa izin.', evidence: 'demo-bukti.png', appointment: 'Menunggu proses peninjauan awal.', createdAt: Date.now() - 20000, author: 'demo_user', displayName: 'D***' },
        { id: 'SSF-2026-1002', cat: 'Verbal', loc: 'Ruang Kelas', urg: 'Sedang', date: '2026-06-05', status: 'Direview', desc: 'Saya sering dihina soal penampilan saat presentasi.', evidence: 'Tidak ada lampiran', appointment: 'Sedang dalam peninjauan bukti oleh Admin.', createdAt: Date.now() - 15000, author: 'demo_user', displayName: 'demo_user' },
        { id: 'SSF-2026-1003', cat: 'Sosial', loc: 'Lingkungan Kampus', urg: 'Rendah', date: '2026-06-06', status: 'Selesai', desc: 'Teman saya dikucilkan dari kelompok tugas.', evidence: 'Tidak ada lampiran', appointment: 'Telah dilakukan mediasi dan edukasi pencegahan.', createdAt: Date.now() - 10000, author: 'demo_user', displayName: 'D***' },
        { id: 'SSF-2026-1004', cat: 'Fisik', loc: 'Parkiran Kampus', urg: 'Tinggi', date: '2026-06-08', status: 'Diproses', desc: 'Ada tindakan represif dan ancaman jika saya melapor.', evidence: 'rekaman_suara.mp3', appointment: 'Jadwal Konseling: Kasus dialihkan ke Satgas PPKS.', createdAt: Date.now() - 5000, author: 'demo_user', displayName: 'demo_user' }
      ];

      reportData = [...dummies];
      updateDashboardUI();
      showTopSystemAlert("Data demo berhasil dimuat!");
    }

    function clearAllData() {
      if (confirm('Apakah Anda yakin ingin menghapus semua data laporan demo?')) {
        reportData = [];
        updateDashboardUI();
      }
    }

    function updateDashboardUI() {
      const total = reportData.length;
      const tinggi = reportData.filter(r => r.urg === 'Tinggi').length;
      const selesai = reportData.filter(r => r.status === 'Selesai').length;

      let catCounts = {};
      let dominant = '-';
      let maxCount = 0;
      reportData.forEach(r => {
        catCounts[r.cat] = (catCounts[r.cat] || 0) + 1;
        if(catCounts[r.cat] > maxCount) { maxCount = catCounts[r.cat]; dominant = r.cat; }
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

      const listContainer = document.getElementById('adminReportList');
      if (reportData.length === 0) {
        listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Belum ada data laporan.</p>';
        return;
      }

      listContainer.innerHTML = '';
      reportData.forEach(report => {
        let riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
        let html = `
          <div class="report-item" onclick="viewReportDetail('${report.id}')">
            <div class="report-info">
              <h4>${report.id} <span style="color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;">${report.date}</span></h4>
              <p><b>Kategori:</b> ${report.cat} &bull; <b>Pelapor:</b> ${report.displayName || report.author} &bull; <b>Status:</b> <span style="color:var(--primary);">${report.status}</span></p>
            </div>
            <div class="risk-badge ${riskClass}">Urgensi ${report.urg}</div>
          </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
      });
    }

    function updateUserDashboardUI() {
      if (!currentUser || currentUser.role !== 'mahasiswa') return;
      const listContainer = document.getElementById('userReportList');
      const userReports = reportData.filter(r => r.author === currentUser.name);

      if (userReports.length === 0) {
        listContainer.innerHTML = '<p class="muted" style="text-align:center; padding:20px;">Anda belum pernah membuat laporan.</p>';
        return;
      }

      listContainer.innerHTML = '';
      userReports.forEach(report => {
        let riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
        let html = `
          <div class="report-item" onclick="viewInvoiceFromSubmit('${report.id}')">
            <div class="report-info">
              <h4>${report.id} <span style="color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;">${report.date}</span></h4>
              <p><b>Kategori:</b> ${report.cat} &bull; <b>Status Laporan:</b> <span style="color:var(--primary); font-weight:bold;">${report.status}</span></p>
            </div>
            <div class="risk-badge ${riskClass}">Lihat Invoice ></div>
          </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
      });
    }

    let currentDetailId = null;

    function viewReportDetail(id) {
      const report = reportData.find(r => r.id === id);
      if (!report) return;
      currentDetailId = id;
      
      document.getElementById('detailTitle').innerText = 'Detail Kasus ' + report.id;
      
      // INTEGRASI KODE TAMPILAN ADMIN (NAMA ANONIM)
      const content = `
        <div style="grid-column: 1 / -1; background: #e8f0ff; padding: 12px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 8px;">
          <span style="color: var(--primary2);">Pelapor:</span><br>
          <strong style="font-size: 16px; color: var(--primary);">${report.displayName || report.author}</strong>
        </div>
        <div><span>Waktu Kejadian:</span><br><strong>${report.date}</strong></div>
        <div><span>Kategori:</span><br><strong>${report.cat}</strong></div>
        <div><span>Lokasi Kejadian:</span><br><strong>${report.loc}</strong></div>
        <div><span>Tingkat Risiko:</span><br><strong>${report.urg}</strong></div>
        <div style="grid-column: 1 / -1;"><span>Lampiran Bukti:</span><br><strong style="color: var(--primary);">${report.evidence || 'Tidak ada lampiran'}</strong></div>
        <div style="grid-column: 1 / -1;"><span>Kronologi Lengkap:</span><br><strong style="font-weight: 500; font-size: 14px; line-height: 1.5; margin-top: 4px;">"${report.desc}"</strong></div>
        <div style="grid-column: 1 / -1;"><span>Status Terakhir:</span><br><strong style="color: var(--primary);">${report.status}</strong></div>
      `;
      document.getElementById('detailContent').innerHTML = content;
      
      let selectStatus = report.status;
      if(selectStatus === 'Baru Masuk' || selectStatus === 'Direview' || selectStatus === 'Diproses' || selectStatus === 'Selesai') {
        document.getElementById('updateStatusSelect').value = selectStatus;
      } else {
        document.getElementById('updateStatusSelect').value = 'Baru Masuk'; 
      }
      
      document.getElementById('updateAppointment').value = report.appointment || '';
      document.getElementById('reportDetailModal').classList.add('show');
    }

    function closeReportDetailModal() {
      document.getElementById('reportDetailModal').classList.remove('show');
      currentDetailId = null;
    }

    function saveReportStatus() {
      if (!currentDetailId) return;
      const report = reportData.find(r => r.id === currentDetailId);
      if (report) {
        const newStatus = document.getElementById('updateStatusSelect').value;
        const newAppt = sanitizeInput(document.getElementById('updateAppointment').value) || 'Menunggu pembaruan lanjutan...';
        
        report.status = newStatus;
        report.appointment = newAppt;
        updateDashboardUI();
        updateUserDashboardUI();
        
        closeReportDetailModal();
        showTopSystemAlert('Berhasil! Status terupdate secara real-time.');
      }
    }

    window.addEventListener('click', function(event) {
      let modal1 = document.getElementById('reportDetailModal');
      let modal2 = document.getElementById('forgotPasswordModal');
      if (event.target == modal1) closeReportDetailModal();
      if (event.target == modal2) closeForgotModal();
    });


    // ========================================================
    // FITUR 3: GAMIFIKASI SIMULASI BYSTANDER
    // ========================================================
    
    // Database Skenario (Tree / Cabang Cerita)
    const storyNodes = {
      start: {
        text: "Anda sedang duduk di kantin fakultas dan melihat seorang mahasiswa baru didorong dan diejek oleh sekelompok senior. Mereka merekam kejadian tersebut sambil tertawa. Apa tindakan pertama Anda?",
        options: [
          { text: "A. Langsung menghampiri, marah, dan membentak para senior tersebut.", nextNode: "agresif" },
          { text: "B. Pura-pura tidak melihat sambil melanjutkan makan agar tidak ikut terseret.", nextNode: "pasif" },
          { text: "C. Menjauh ke titik aman, merekam diam-diam sebagai bukti, lalu melapor ke SafeSphere.", nextNode: "pintar" }
        ],
        feedback: null
      },
      agresif: {
        text: "Anda mencoba melawan. Namun karena kalah jumlah, Anda kini malah ikut menjadi target intimidasi fisik dan verbal mereka. Bertindak heroik dengan emosi seringkali bukan solusi yang aman.",
        options: [
          { text: "🔄 Ulangi Simulasi", nextNode: "start" }
        ],
        feedback: { type: "error", message: "<strong>Berbahaya!</strong> Menghadapi pelaku secara langsung tanpa perhitungan bisa membahayakan keselamatan diri Anda." }
      },
      pasif: {
        text: "Korban semakin dipermalukan. Karena tidak ada mahasiswa lain yang berani bertindak, pelaku merasa perilaku mereka wajar dan kekerasan semakin dinormalisasi di kampus.",
        options: [
          { text: "🔄 Ulangi Simulasi", nextNode: "start" }
        ],
        feedback: { type: "error", message: "<strong>Efek Bystander (Pembiaran):</strong> Diam berarti secara tidak langsung Anda membiarkan perundungan terus terjadi." }
      },
      pintar: {
        text: "Tepat sekali! Anda berhasil mendapatkan bukti rekaman wajah pelaku tanpa membahayakan diri sendiri. Laporan anonim Anda di SafeSphere langsung diproses oleh Satgas PPKS, dan korban segera mendapatkan perlindungan.",
        options: [
          { text: "🌟 Mainkan Lagi", nextNode: "start" }
        ],
        feedback: { type: "success", message: "<strong>Langkah Cerdas!</strong> Mengamankan bukti dan melapor secara terenkripsi adalah tindakan paling efektif untuk memutus rantai perundungan." }
      }
    };

    // Fungsi untuk merender teks dan tombol berdasarkan Node/Skenario
    function renderStoryNode(nodeId) {
      const node = storyNodes[nodeId];
      const textEl = document.getElementById('gameText');
      const optionsEl = document.getElementById('gameOptions');
      const feedbackEl = document.getElementById('gameFeedback');
      const sceneEl = document.getElementById('gameScene');

      // Efek transisi pudar (fade out)
      sceneEl.style.opacity = 0;

      setTimeout(() => {
        // Ganti teks cerita
        textEl.innerText = node.text;
        
        // Bersihkan opsi lama
        optionsEl.innerHTML = '';
        
        // Buat tombol baru sesuai skenario
        node.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.innerText = opt.text;
          btn.onclick = () => renderStoryNode(opt.nextNode); // Pindah ke skenario berikutnya saat diklik
          optionsEl.appendChild(btn);
        });

        // Tampilkan kotak masukan (feedback/akibat) jika ada
        if (node.feedback) {
          feedbackEl.className = `result ${node.feedback.type}`;
          feedbackEl.innerHTML = node.feedback.message;
        } else {
          feedbackEl.className = 'result hidden';
        }

        // Munculkan kembali layar (fade in)
        sceneEl.style.opacity = 1;
      }, 300); // Waktu jeda agar transisi terlihat halus
    }

    // Panggil skenario 'start' secara otomatis saat halaman web pertama kali dimuat
    window.addEventListener('DOMContentLoaded', () => {
      // Pastikan elemennya ada sebelum memanggil fungsi
      if (document.getElementById('gamificationContainer')) {
        renderStoryNode('start');
      }
    });

    // --- INTEGRASI FITUR SUBMIT LAPORAN DENGAN ANONIMITAS ---
    async function submitReport(event) {
      event.preventDefault();
      const resultBox = document.getElementById('reportResult');
      const btn = event.target.querySelector('button[type="submit"]');
      
      btn.innerText = "Mengamankan Laporan...";
      btn.style.opacity = "0.7";

      setTimeout(async () => {
        const trackingID = "SSF-2026-" + Math.floor(1000 + Math.random() * 9000);
        const evidenceInput = document.getElementById('evidence');
        let evidenceName = 'Tidak ada lampiran';
        if (evidenceInput.files.length > 0) {
          evidenceName = sanitizeInput(evidenceInput.files[0].name);
        }

        // Logika Penyamaran Nama
        const checkboxAnon = document.getElementById('isAnonymous');
        const isAnon = checkboxAnon ? checkboxAnon.checked : true; // Default true jika elemen belum ada
        
        let originalName = currentUser ? currentUser.name : 'Anonim';
        let maskedName = originalName !== 'Anonim' ? originalName.charAt(0).toUpperCase() + '***' : 'Anonim';

        const newReport = {
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

        // Simpan ke Memori Lokal
        reportData.unshift(newReport);
        if(window.location.hash === '#admin') updateDashboardUI();
        if(window.location.hash === '#dashboard') updateUserDashboardUI();

        btn.innerText = "Kirim Laporan Terenkripsi";
        btn.style.opacity = "1";
        
        resultBox.classList.remove('hidden');
        resultBox.classList.add('success');
        resultBox.innerHTML = `<strong>Laporan Berhasil Terkirim & Terenkripsi!</strong><br><br>
        Nomor Pelacakan Anda: <b style="font-size:18px; color:var(--ink);">${trackingID}</b><br>
        <em>Harap simpan nomor ini. Data terenkripsi end-to-end.</em><br><br>
        <button class="btn secondary" type="button" onclick="viewInvoiceFromSubmit('${trackingID}')" style="margin-top: 10px;">Lacak Status Laporan Ini</button>`;
        
        event.target.reset();
      }, 1500);
    }

    function viewInvoiceFromSubmit(id) {
      window.location.hash = '#dashboard';
      setTimeout(() => { 
        const report = reportData.find(r => r.id === id);
        if (report) {
          document.getElementById('invoiceResult').classList.remove('hidden');
          renderInvoice(report);
          document.getElementById('invoiceResult').scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }

    function renderInvoice(report) {
      currentViewedInvoiceId = report.id; 
      const invoiceBox = document.getElementById('invoiceResult');
      
      let t1 = '', t2 = '', t3 = '', t4 = '';
      if (report.status === 'Baru Masuk') {
        t1 = 'active';
      } else if (report.status === 'Direview') {
        t1 = 'done'; t2 = 'active';
      } else if (report.status === 'Diproses') {
        t1 = 'done'; t2 = 'done'; t3 = 'active';
      } else if (report.status === 'Selesai') {
        t1 = 'done'; t2 = 'done'; t3 = 'done'; t4 = 'done';
      }

      invoiceBox.innerHTML = `
        <div class="invoice-header">
          <h3>Tanda Terima Pengaduan</h3>
          <p class="muted" style="margin:0;">No. Pelacakan: <strong>${report.id}</strong></p>
        </div>
        <div class="invoice-details">
          <div><span>Tanggal Kejadian:</span><br><strong>${report.date}</strong></div>
          <div><span>Kategori:</span><br><strong>${report.cat}</strong></div>
          <div><span>Lokasi:</span><br><strong>${report.loc}</strong></div>
          <div><span>Tingkat Urgensi:</span><br><strong>${report.urg}</strong></div>
          <div style="grid-column: 1 / -1;"><span>Lampiran Bukti:</span><br><strong style="color: var(--primary);">${report.evidence || 'Tidak ada lampiran'}</strong></div>
          <div style="grid-column: 1 / -1;"><span>Kronologi Singkat:</span><br><strong style="font-weight: 500; font-size: 13px; line-height: 1.5; margin-top: 4px;">"${report.desc}"</strong></div>
        </div>
        <div class="timeline-container">
          <h4 style="margin: 0 0 16px 0;">Update Status Pelaporan</h4>
          <ul class="timeline">
            <li class="timeline-item ${t1 || 'done'}"><div class="timeline-marker"></div><div class="timeline-content"><h4>Laporan Diterima</h4><p>Laporan masuk ke sistem aman.</p></div></li>
            <li class="timeline-item ${t2}"><div class="timeline-marker"></div><div class="timeline-content"><h4>Tahap Review (Verifikasi)</h4><p>Tim admin memverifikasi kelayakan berkas.</p></div></li>
            <li class="timeline-item ${t3}"><div class="timeline-marker"></div><div class="timeline-content"><h4>Sedang Diproses</h4><p>Kasus ditangani unit kemahasiswaan/Satgas PPKS.</p></div></li>
            <li class="timeline-item ${t4}"><div class="timeline-marker"></div><div class="timeline-content"><h4>Tindak Lanjut & Appointment</h4><p style="color: var(--primary); font-weight: 600; margin-top: 4px;">Info: ${report.appointment}</p></div></li>
          </ul>
        </div>
      `;
    }


    // --- BACKEND SAFETY: Validasi Ketat Pendaftaran (Register Page) ---
    function toggleStatusFields() {
      const status = document.getElementById('regStatus').value;
      const contInstansi = document.getElementById('containerInstansi');
      const contPeran = document.getElementById('containerPeran');
      
      if (status === 'Mahasiswa' || status === 'Umum') {
        contInstansi.style.display = 'block';
        contPeran.style.display = 'block';
      } else if (status === 'Lainnya') {
        contInstansi.style.display = 'block';
        contPeran.style.display = 'none';
      } else {
        contInstansi.style.display = 'none';
        contPeran.style.display = 'none';
      }
    }

    function checkPasswordStrength() {
      const pw = document.getElementById('regPassword').value;
      const helper = document.getElementById('pwHelper');
      if (pw.length === 0) {
        helper.className = 'form-helper';
        helper.innerText = 'Minimal 6 karakter, 1 huruf kapital, 1 angka, dan 1 karakter spesial.';
        return false;
      }
      if (/[A-Z]/.test(pw) && /\d/.test(pw) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(pw) && pw.length >= 6) {
        helper.className = 'form-helper text-success';
        helper.innerText = '✔️ Struktur password sangat kuat dan aman.';
        return true;
      } else {
        helper.className = 'form-helper text-danger';
        helper.innerText = '⚠️ Belum memenuhi: Min 6 karakter, 1 Kapital, 1 Angka, & 1 Karakter Spesial.';
        return false;
      }
    }

    function handleRegister(event) {
      event.preventDefault();
      
      const errorBox = document.getElementById('registerError');
      const resultBox = document.getElementById('registerResult');
      
      errorBox.classList.add('hidden');
      errorBox.innerText = '';
      resultBox.classList.add('hidden');

      const name = sanitizeInput(document.getElementById('regName').value);
      const status = document.getElementById('regStatus').value;
      const instansi = sanitizeInput(document.getElementById('regInstansi').value);
      const peran = sanitizeInput(document.getElementById('regPeran').value);
      const email = sanitizeInput(document.getElementById('regEmail').value);
      const pw = document.getElementById('regPassword').value;
      const pwConfirm = document.getElementById('regConfirmPassword').value;

      if (!name || !status || !email || !pw || !pwConfirm) {
        errorBox.classList.remove('hidden');
        errorBox.innerText = '⚠️ Kegagalan Validasi: Semua kolom bertanda bintang wajib diisi!';
        return;
      }

      if ((status === 'Mahasiswa' || status === 'Umum') && (!instansi || !peran)) {
        errorBox.classList.remove('hidden');
        errorBox.innerText = '⚠️ Kegagalan Validasi: Informasi Instansi dan Peran wajib dilengkapi!';
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errorBox.classList.remove('hidden');
        errorBox.innerText = '⚠️ Kegagalan Sistem: Format alamat email tidak valid! Gunakan struktur baku (contoh: mhs@kampus.ac.id).';
        return;
      }

      if (!checkPasswordStrength()) {
        errorBox.classList.remove('hidden');
        errorBox.innerText = '⚠️ Kebijakan Keamanan: Struktur password terlalu lemah untuk menahan serangan brute-force.';
        return;
      }

      if (pw !== pwConfirm) {
        errorBox.classList.remove('hidden');
        errorBox.innerText = '⚠️ Sinkronisasi Gagal: Nilai konfirmasi kata sandi tidak cocok dengan password utama.';
        return;
      }

      const btn = event.target.querySelector('button[type="submit"]');
      btn.innerText = "Mengenkripsi Data & Mendaftarkan...";
      btn.style.opacity = '0.7';

      setTimeout(() => {
        btn.innerText = "Daftar Sekarang";
        btn.style.opacity = '1';
        
        resultBox.classList.remove('hidden');
        resultBox.classList.add('success');
        resultBox.innerHTML = `<strong>Registrasi Berhasil!</strong> Akun Anda terverifikasi dengan aman. Silakan menuju halaman <a href="#login">Login</a> untuk masuk ke dashboard.`;
        event.target.reset();
        document.getElementById('pwHelper').className = 'form-helper';
        document.getElementById('pwHelper').innerText = 'Minimal 6 karakter, 1 huruf kapital, 1 angka, dan 1 karakter spesial.';
      }, 1500);
    }

    function showTopSystemAlert(message) {
      const alertDiv = document.createElement('div');
      alertDiv.style.position = 'fixed';
      alertDiv.style.top = '20px';
      alertDiv.style.left = '50%';
      alertDiv.style.transform = 'translateX(-50%)';
      alertDiv.style.background = '#fee2e2';
      alertDiv.style.color = '#991b1b';
      alertDiv.style.padding = '14px 24px';
      alertDiv.style.borderRadius = '10px';
      alertDiv.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
      alertDiv.style.zIndex = '9999';
      alertDiv.style.fontWeight = '600';
      alertDiv.style.fontSize = '14px';
      alertDiv.style.border = '1px solid #fecaca';
      alertDiv.innerText = message;
      
      document.body.appendChild(alertDiv);
      setTimeout(() => alertDiv.remove(), 3500);
    }

    // ========================================================
    // FITUR 1: DISCREET MODE (QUICK ESCAPE) LOGIC
    // ========================================================
    let escPressCount = 0;
    let escTimer = null;
    let originalTitle = document.title; // Menyimpan judul asli web

    // Fungsi untuk mengaktifkan mode penyamaran
    function activateDiscreetMode() {
      document.getElementById('discreetOverlay').style.display = 'block';
      document.getElementById('quickEscapeBtn').style.display = 'none'; // Sembunyikan tombol panic
      
      // Ubah judul Tab Browser agar tidak ketahuan
      document.title = "Wikipedia bahasa Indonesia"; 
    }

    // Fungsi rahasia untuk kembali (dicuplik di pojok kanan atas overlay)
    function deactivateDiscreetMode() {
      document.getElementById('discreetOverlay').style.display = 'none';
      document.getElementById('quickEscapeBtn').style.display = 'flex';
      
      // Kembalikan judul Tab Browser
      document.title = originalTitle; 
    }

    // Pendeteksi Tekanan Tombol "Esc" 2 kali berturut-turut
    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        escPressCount++;
        
        if (escPressCount === 2) {
          activateDiscreetMode();
          escPressCount = 0; // Reset
        }
        
        // Jika tidak ditekan 2x dalam 1 detik, hitungan di-reset
        clearTimeout(escTimer);
        escTimer = setTimeout(() => {
          escPressCount = 0;
        }, 1000); 
      }
    });

    // ========================================================
    // FITUR 4: MODE AKSESIBILITAS (INKLUSIVITAS)
    // ========================================================
    
    // Fungsi membuka/menutup menu widget
    function toggleA11yMenu() {
      const menu = document.getElementById('a11yMenu');
      if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        menu.classList.add('show');
      } else {
        menu.classList.add('hidden');
        menu.classList.remove('show');
      }
    }

    // Fungsi menghidupkan/mematikan mode tertentu
    function toggleA11yFeature(feature) {
      const body = document.body;
      const className = `a11y-${feature}`;
      
      // Toggle CSS Class di body
      if (body.classList.contains(className)) {
        body.classList.remove(className);
        
        // Terjemahan label untuk notifikasi
        let modeName = feature === 'high-contrast' ? 'Kontras Tinggi' : (feature === 'large-text' ? 'Perbesar Teks' : 'Ramah Disleksia');
        showTopSystemAlert(`Aksesibilitas: Mode ${modeName} dinonaktifkan.`);
      } else {
        body.classList.add(className);
        
        let modeName = feature === 'high-contrast' ? 'Kontras Tinggi' : (feature === 'large-text' ? 'Perbesar Teks' : 'Ramah Disleksia');
        showTopSystemAlert(`Aksesibilitas: Mode ${modeName} diaktifkan.`);
      }
      
      // (Opsional) Tutup menu otomatis setelah memilih
      toggleA11yMenu();
    }

    // ========================================================
    // FITUR 5: SENTIMENT ANALYSIS & EXPANDED TRIGGER DICTIONARY
    // ========================================================
    
    // Perluasan Kamus Kata Sensitif & Rentan
    const triggerDictionary = {
      // Tingkat Darurat/Tinggi: Kekerasan Fisik, Pelecehan Seksual, Ancaman Nyawa, Self-Harm
      highRisk: [
        'bunuh', 'mati', 'ancam', 'mengancam', 'pukul', 'dipukul', 'hajar', 'dihajar', 
        'tampar', 'ditampar', 'cekik', 'dicekik', 'bunuh diri', 'self harm', 'sayat', 
        'kunci', 'dikunci', 'seksual', 'raba', 'diraba', 'leceh', 'dilecehkan', 'perkosa', 
        'diperkosa', 'paksa', 'dipaksa', 'sebar video', 'sebar foto', 'telanjang', 
        'senjata', 'pisau', 'darah', 'luka', 'depresi berat', 'akhiri hidup', 'doxing'
      ],
      // Tingkat Sedang: Verbal, Pengucilan Sosial, Pemerasan, Cyberbullying
      medRisk: [
        'hina', 'menghina', 'ejek', 'diejek', 'olok', 'diolok', 'kucil', 'dikucilkan', 
        'jauhi', 'dijauhi', 'fitnah', 'difitnah', 'cyberbullying', 'komentar jahat', 
        'bodoh', 'jelek', 'miskin', 'cacat', 'sialan', 'palak', 'dipalak', 'uang', 
        'ancaman ringan', 'intimidasi', 'malu', 'dipermalukan', 'labrak', 'dilabrak', 
        'grup', 'sindir', 'disindir', 'toxic'
      ]
    };

    // Fungsi Utama Analisis Sentimen (Dipanggil setiap kali tombol keyboard ditekan)
    function analyzeSentiment() {
      const text = document.getElementById('description').value.toLowerCase();
      const bar = document.getElementById('sentimentBar');
      const label = document.getElementById('sentimentText');
      const urgensiDropdown = document.getElementById('urgent'); // Untuk auto-select
      
      // Jika kotak teks kosong, reset indikator
      if (text.trim().length === 0) {
        bar.style.width = '0%';
        bar.style.background = 'var(--ok)';
        label.innerText = 'Menganalisis teks...';
        label.style.color = 'var(--muted)';
        return;
      }

      let score = 0;
      let foundHighRisk = false;
      
      // Deteksi Kata Tingkat Tinggi (Looping)
      triggerDictionary.highRisk.forEach(word => {
        if (text.includes(word)) { 
          score += 5; 
          foundHighRisk = true; 
        }
      });
      
      // Deteksi Kata Tingkat Sedang (Looping)
      triggerDictionary.medRisk.forEach(word => {
        // Tambahkan spasi di Regex atau pakai includes agar mendeteksi suku kata yang cocok
        if (text.includes(word)) { 
          score += 2; 
        }
      });

      // === PERUBAHAN UI VISUAL & SMART AUTO-SELECT ===
      
      if (score >= 5 || foundHighRisk) {
        // Status: DARURAT / TINGGI
        bar.style.width = '100%';
        bar.style.background = 'var(--danger)'; // Warna Merah
        label.innerText = '⚠️ Indikasi Darurat Terdeteksi';
        label.style.color = 'var(--danger)';
        
        // Inovasi: Otomatis memindahkan dropdown urgensi ke "Tinggi"
        urgensiDropdown.value = 'Tinggi'; 
        
      } else if (score >= 2) {
        // Status: SEDANG
        bar.style.width = '60%';
        bar.style.background = 'var(--warn)'; // Warna Oranye/Kuning
        label.innerText = 'Indikasi Intimidasi Sedang';
        label.style.color = 'var(--warn)';
        
        // Inovasi: Otomatis memindahkan dropdown urgensi ke "Sedang"
        if(urgensiDropdown.value === 'Rendah' || urgensiDropdown.value === '') {
          urgensiDropdown.value = 'Sedang';
        }
        
      } else {
        // Status: NORMAL / RENDAH
        bar.style.width = '25%';
        bar.style.background = 'var(--ok)'; // Warna Hijau
        label.innerText = 'Terpantau Stabil (Rendah)';
        label.style.color = 'var(--ok)';
      }
    }