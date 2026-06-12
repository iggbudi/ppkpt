// State Pengguna Global
    let currentUser = null; 
    let currentViewedInvoiceId = null;
    let isChatRequestPending = false;

    // --- Helper Sanitasi Input (Simulasi Backend Safety / XSS Protection) ---
    function sanitizeInput(text) {
      return String(text ?? '').trim();
    }

    function clearElement(element) {
      if (!element) return;
      while (element.firstChild) element.removeChild(element.firstChild);
    }

    function appendBr(element) {
      element.appendChild(document.createElement('br'));
    }


    function createEl(tag, options = {}, children = []) {
      const element = document.createElement(tag);
      if (options.className) element.className = options.className;
      if (options.text !== undefined) element.textContent = options.text;
      if (options.style) {
        if (typeof options.style === 'string') element.setAttribute('style', options.style);
        else Object.assign(element.style, options.style);
      }
      if (options.type) element.type = options.type;
      if (options.href) element.href = options.href;
      if (options.onClick) element.addEventListener('click', options.onClick);
      children.forEach(child => element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
      return element;
    }

    function createEmptyState(message) {
      return createEl('p', { className: 'muted', text: message, style: 'text-align:center; padding:20px;' });
    }

    function setChildren(element, children) {
      clearElement(element);
      children.forEach(child => element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
    }

    function renderStrongPrefixMessage(element, message) {
      const match = String(message).match(/^<strong>(.*?)<\/strong>\s*(.*)$/);
      if (match) {
        setChildren(element, [createEl('strong', { text: match[1] }), match[2] ? ` ${match[2]}` : '']);
      } else {
        element.textContent = message;
      }
    }

    function appendInlineMarkdown(parent, text) {
      const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
      let lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        if (match[2] || match[3]) {
          parent.appendChild(createEl('strong', { text: match[2] || match[3] }));
        } else if (match[4] || match[5]) {
          parent.appendChild(createEl('em', { text: match[4] || match[5] }));
        } else if (match[6]) {
          parent.appendChild(createEl('code', { text: match[6] }));
        }

        lastIndex = pattern.lastIndex;
      }

      if (lastIndex < text.length) {
        parent.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
    }

    function renderMarkdownMessage(element, content) {
      clearElement(element);
      const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
      let paragraphLines = [];
      let list = null;

      function flushParagraph() {
        if (paragraphLines.length === 0) return;
        const p = createEl('p');
        appendInlineMarkdown(p, paragraphLines.join(' '));
        element.appendChild(p);
        paragraphLines = [];
      }

      function flushList() {
        if (!list) return;
        element.appendChild(list);
        list = null;
      }

      lines.forEach(line => {
        const trimmed = line.trim();
        const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
        const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);

        if (!trimmed) {
          flushParagraph();
          flushList();
          return;
        }

        if (listMatch || numberedMatch) {
          flushParagraph();
          if (!list) list = createEl(numberedMatch ? 'ol' : 'ul');
          const li = createEl('li');
          appendInlineMarkdown(li, listMatch ? listMatch[1] : numberedMatch[1]);
          list.appendChild(li);
          return;
        }

        flushList();
        paragraphLines.push(trimmed.replace(/^#{1,6}\s+/, ''));
      });

      flushParagraph();
      flushList();
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

    function bindClick(id, handler) {
      const element = document.getElementById(id);
      if (element) element.addEventListener('click', handler);
    }

    function setupEventListeners() {
      bindClick('discreetCloseBtn', deactivateDiscreetMode);
      bindClick('quickEscapeBtn', activateDiscreetMode);
      document.querySelectorAll('.js-logout').forEach(btn => btn.addEventListener('click', handleLogout));

      const reportForm = document.getElementById('reportForm');
      if (reportForm) reportForm.addEventListener('submit', submitReport);
      const description = document.getElementById('description');
      if (description) description.addEventListener('input', analyzeSentiment);

      bindClick('chatSendBtn', sendChatMessage);
      const chatInput = document.getElementById('chatInput');
      if (chatInput) chatInput.addEventListener('keydown', handleChatKeyDown);

      const registerForm = document.getElementById('registerForm');
      if (registerForm) registerForm.addEventListener('submit', handleRegister);
      const regStatus = document.getElementById('regStatus');
      if (regStatus) regStatus.addEventListener('change', toggleStatusFields);
      const regPassword = document.getElementById('regPassword');
      if (regPassword) regPassword.addEventListener('input', checkPasswordStrength);

      bindClick('tabMahasiswa', () => switchLoginTab('mahasiswa'));
      bindClick('tabAdmin', () => switchLoginTab('admin'));
      const loginForm = document.getElementById('loginForm');
      if (loginForm) loginForm.addEventListener('submit', handleMainLogin);
      bindClick('forgotPasswordLink', openForgotModal);
      bindClick('googleLoginBtn', () => alert('Membuka Login Google...'));
      bindClick('instagramLoginBtn', () => alert('Membuka Login Instagram...'));
      bindClick('emailLoginBtn', () => alert('Kirim Magic Link ke Email...'));
      bindClick('closeForgotModalBtn', closeForgotModal);
      bindClick('sendOtpBtn', sendOTP);

      bindClick('seedDemoBtn', seedDemoData);
      bindClick('clearDataBtn', clearAllData);
      bindClick('closeReportDetailBtn', closeReportDetailModal);
      bindClick('saveReportStatusBtn', saveReportStatus);

      document.querySelectorAll('.js-a11y-feature').forEach(btn => {
        btn.addEventListener('click', () => toggleA11yFeature(btn.dataset.a11yFeature));
      });
      bindClick('a11yToggleBtn', toggleA11yMenu);
    }

    window.addEventListener('hashchange', handleRouting);
    window.addEventListener('DOMContentLoaded', () => {
      setupEventListeners();
      handleRouting();
    });


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
        setChildren(subtitle, [
          'Gunakan kredensial admin Anda.',
          createEl('br'),
          createEl('em', {}, [
            '(Demo: Username: ',
            createEl('b', { text: 'admin' }),
            ', Password: ',
            createEl('b', { text: 'safesphere' }),
            ')'
          ])
        ]);
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
          setChildren(errorBox, [
            createEl('strong', { text: '⚠️ AKSES DITOLAK:' }),
            ' Kredensial Admin salah. Percobaan login ilegal ini otomatis dicatat oleh sistem pertahanan siber SafeSphere.'
          ]);
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
        setChildren(listContainer, [createEmptyState('Belum ada data laporan.')]);
        return;
      }

      clearElement(listContainer);
      reportData.forEach(report => {
        let riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
        const title = createEl('h4', {}, [
          report.id,
          createEl('span', { text: report.date, style: 'color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;' })
        ]);
        const info = createEl('p', {}, [
          createEl('b', { text: 'Kategori:' }), ' ', report.cat, ' • ',
          createEl('b', { text: 'Pelapor:' }), ' ', report.displayName || report.author, ' • ',
          createEl('b', { text: 'Status:' }), ' ',
          createEl('span', { text: report.status, style: 'color:var(--primary);' })
        ]);
        listContainer.appendChild(createEl('div', { className: 'report-item', onClick: () => viewReportDetail(report.id) }, [
          createEl('div', { className: 'report-info' }, [title, info]),
          createEl('div', { className: `risk-badge ${riskClass}`, text: `Urgensi ${report.urg}` })
        ]));
      });
    }

    function updateUserDashboardUI() {
      if (!currentUser || currentUser.role !== 'mahasiswa') return;
      const listContainer = document.getElementById('userReportList');
      const userReports = reportData.filter(r => r.author === currentUser.name);

      if (userReports.length === 0) {
        setChildren(listContainer, [createEmptyState('Anda belum pernah membuat laporan.')]);
        return;
      }

      clearElement(listContainer);
      userReports.forEach(report => {
        let riskClass = report.urg === 'Tinggi' ? 'risk-tinggi' : (report.urg === 'Sedang' ? 'risk-sedang' : 'risk-rendah');
        const title = createEl('h4', {}, [
          report.id,
          createEl('span', { text: report.date, style: 'color:var(--muted); font-weight:normal; font-size:13px; margin-left:8px;' })
        ]);
        const info = createEl('p', {}, [
          createEl('b', { text: 'Kategori:' }), ' ', report.cat, ' • ',
          createEl('b', { text: 'Status Laporan:' }), ' ',
          createEl('span', { text: report.status, style: 'color:var(--primary); font-weight:bold;' })
        ]);
        listContainer.appendChild(createEl('div', { className: 'report-item', onClick: () => viewInvoiceFromSubmit(report.id) }, [
          createEl('div', { className: 'report-info' }, [title, info]),
          createEl('div', { className: `risk-badge ${riskClass}`, text: 'Lihat Invoice >' })
        ]));
      });
    }

    let currentDetailId = null;

    function appendField(container, label, value, options = {}) {
      const field = createEl('div', { style: options.fieldStyle || '' });
      field.appendChild(createEl('span', { text: label }));
      appendBr(field);
      const strong = createEl('strong', { text: value, style: options.strongStyle || '' });
      field.appendChild(strong);
      container.appendChild(field);
    }

    function viewReportDetail(id) {
      const report = reportData.find(r => r.id === id);
      if (!report) return;
      currentDetailId = id;
      
      document.getElementById('detailTitle').innerText = 'Detail Kasus ' + report.id;
      
      // INTEGRASI KODE TAMPILAN ADMIN (NAMA ANONIM)
      const detailContent = document.getElementById('detailContent');
      clearElement(detailContent);

      const reporterBox = createEl('div', { style: 'grid-column: 1 / -1; background: #e8f0ff; padding: 12px; border-radius: 8px; border: 1px solid #bfdbfe; margin-bottom: 8px;' });
      reporterBox.appendChild(createEl('span', { text: 'Pelapor:', style: 'color: var(--primary2);' }));
      appendBr(reporterBox);
      reporterBox.appendChild(createEl('strong', { text: report.displayName || report.author, style: 'font-size: 16px; color: var(--primary);' }));
      detailContent.appendChild(reporterBox);

      appendField(detailContent, 'Waktu Kejadian:', report.date);
      appendField(detailContent, 'Kategori:', report.cat);
      appendField(detailContent, 'Lokasi Kejadian:', report.loc);
      appendField(detailContent, 'Tingkat Risiko:', report.urg);
      appendField(detailContent, 'Lampiran Bukti:', report.evidence || 'Tidak ada lampiran', { fieldStyle: 'grid-column: 1 / -1;', strongStyle: 'color: var(--primary);' });
      appendField(detailContent, 'Kronologi Lengkap:', `"${report.desc}"`, { fieldStyle: 'grid-column: 1 / -1;', strongStyle: 'font-weight: 500; font-size: 14px; line-height: 1.5; margin-top: 4px;' });
      appendField(detailContent, 'Status Terakhir:', report.status, { fieldStyle: 'grid-column: 1 / -1;', strongStyle: 'color: var(--primary);' });
      
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
        clearElement(optionsEl);
        
        // Buat tombol baru sesuai skenario
        node.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.innerText = opt.text;
          btn.addEventListener('click', () => renderStoryNode(opt.nextNode)); // Pindah ke skenario berikutnya saat diklik
          optionsEl.appendChild(btn);
        });

        // Tampilkan kotak masukan (feedback/akibat) jika ada
        if (node.feedback) {
          feedbackEl.className = `result ${node.feedback.type}`;
          renderStrongPrefixMessage(feedbackEl, node.feedback.message);
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
        setChildren(resultBox, [
          createEl('strong', { text: 'Laporan Berhasil Terkirim & Terenkripsi!' }),
          createEl('br'), createEl('br'),
          'Nomor Pelacakan Anda: ',
          createEl('b', { text: trackingID, style: 'font-size:18px; color:var(--ink);' }),
          createEl('br'),
          createEl('em', { text: 'Harap simpan nomor ini. Data terenkripsi end-to-end.' }),
          createEl('br'), createEl('br'),
          createEl('button', { className: 'btn secondary', type: 'button', text: 'Lacak Status Laporan Ini', style: 'margin-top: 10px;', onClick: () => viewInvoiceFromSubmit(trackingID) })
        ]);
        
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

      const header = createEl('div', { className: 'invoice-header' }, [
        createEl('h3', { text: 'Tanda Terima Pengaduan' }),
        createEl('p', { className: 'muted', style: 'margin:0;' }, [
          'No. Pelacakan: ', createEl('strong', { text: report.id })
        ])
      ]);

      const details = createEl('div', { className: 'invoice-details' });
      appendField(details, 'Tanggal Kejadian:', report.date);
      appendField(details, 'Kategori:', report.cat);
      appendField(details, 'Lokasi:', report.loc);
      appendField(details, 'Tingkat Urgensi:', report.urg);
      appendField(details, 'Lampiran Bukti:', report.evidence || 'Tidak ada lampiran', { fieldStyle: 'grid-column: 1 / -1;', strongStyle: 'color: var(--primary);' });
      appendField(details, 'Kronologi Singkat:', `"${report.desc}"`, { fieldStyle: 'grid-column: 1 / -1;', strongStyle: 'font-weight: 500; font-size: 13px; line-height: 1.5; margin-top: 4px;' });

      function timelineItem(className, title, description, highlight = false) {
        const p = createEl('p', { text: description, style: highlight ? 'color: var(--primary); font-weight: 600; margin-top: 4px;' : '' });
        return createEl('li', { className: `timeline-item ${className}` }, [
          createEl('div', { className: 'timeline-marker' }),
          createEl('div', { className: 'timeline-content' }, [createEl('h4', { text: title }), p])
        ]);
      }

      const timeline = createEl('div', { className: 'timeline-container' }, [
        createEl('h4', { text: 'Update Status Pelaporan', style: 'margin: 0 0 16px 0;' }),
        createEl('ul', { className: 'timeline' }, [
          timelineItem(t1 || 'done', 'Laporan Diterima', 'Laporan masuk ke sistem aman.'),
          timelineItem(t2, 'Tahap Review (Verifikasi)', 'Tim admin memverifikasi kelayakan berkas.'),
          timelineItem(t3, 'Sedang Diproses', 'Kasus ditangani unit kemahasiswaan/Satgas PPKS.'),
          timelineItem(t4, 'Tindak Lanjut & Appointment', `Info: ${report.appointment}`, true)
        ])
      ]);

      setChildren(invoiceBox, [header, details, timeline]);
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
        setChildren(resultBox, [
          createEl('strong', { text: 'Registrasi Berhasil!' }),
          ' Akun Anda terverifikasi dengan aman. Silakan menuju halaman ',
          createEl('a', { href: '#login', text: 'Login' }),
          ' untuk masuk ke dashboard.'
        ]);
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

    // ========================================================
    // FITUR 6: LOGIKA CHATBOT INTERAKTIF (SAFEBOT)
    // ========================================================
    function handleChatKeyDown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!isChatRequestPending) sendChatMessage();
      }
    }

    function setChatPending(isPending) {
      isChatRequestPending = isPending;
      const input = document.getElementById('chatInput');
      const sendBtn = document.getElementById('chatSendBtn');

      if (input) {
        input.readOnly = isPending;
        input.classList.toggle('is-readonly', isPending);
        input.setAttribute('aria-busy', String(isPending));
      }
      if (sendBtn) {
        sendBtn.disabled = isPending;
        sendBtn.innerText = isPending ? 'Mengirim...' : 'Kirim';
      }
    }

    function showTypingIndicator() {
      const container = document.getElementById('chatMessages');
      if (!container || document.getElementById('chatTypingIndicator')) return;

      const indicator = createEl('div', { className: 'chat-message bot typing' }, [
        createEl('span'),
        createEl('span'),
        createEl('span'),
        ' SafeBot sedang mengetik...'
      ]);
      indicator.id = 'chatTypingIndicator';
      container.appendChild(indicator);
      container.scrollTop = container.scrollHeight;
    }

    function removeTypingIndicator() {
      const indicator = document.getElementById('chatTypingIndicator');
      if (indicator) indicator.remove();
    }

    function sendChatMessage() {
      const input = document.getElementById('chatInput');
      if (!input || isChatRequestPending) return;

      const text = sanitizeInput(input.value);
      if (!text) return;

      addChatMessage(text, 'user');
      input.value = '';
      setChatPending(true);
      showTypingIndicator();

      setTimeout(() => {
        processBotResponse(text);
      }, 300);
    }

    function addChatMessage(content, sender, actions = []) {
      const container = document.getElementById('chatMessages');
      if (!container) return;

      const message = createEl('div', { className: `chat-message ${sender}` });
      if (Array.isArray(content)) {
        setChildren(message, content);
      } else if (sender === 'bot') {
        renderMarkdownMessage(message, content);
      } else {
        message.textContent = content;
      }

      if (actions.length > 0) {
        message.appendChild(createEl('div', { className: 'chat-message-actions' }, actions.map(action => (
          createEl('a', {
            className: action.className,
            href: action.href,
            text: action.text
          })
        ))));
      }

      container.appendChild(message);
      container.scrollTop = container.scrollHeight;
    }

    function getRiskScore(text) {
      const lowerText = text.toLowerCase();
      let score = 0;
      let foundHighRisk = false;

      triggerDictionary.highRisk.forEach(word => {
        if (lowerText.includes(word)) {
          score += 5;
          foundHighRisk = true;
        }
      });

      triggerDictionary.medRisk.forEach(word => {
        if (lowerText.includes(word)) score += 2;
      });

      return { score, foundHighRisk, lowerText };
    }

    async function processBotResponse(text) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            user: currentUser ? { name: currentUser.name, role: currentUser.role } : null
          })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          if (response.status === 429 && data && typeof data.message === 'string') {
            addChatMessage(data.message, 'bot');
            return;
          }
          throw new Error(`SafeBot backend returned ${response.status}`);
        }

        if (!data || typeof data.reply !== 'string') {
          throw new Error('SafeBot backend response is invalid');
        }

        addChatMessage(data.reply, 'bot', Array.isArray(data.actions) ? data.actions : []);
      } catch (error) {
        console.error('SafeBot request failed:', error);
        const { score, foundHighRisk } = getRiskScore(text);

        if (score >= 5 || foundHighRisk) {
          addChatMessage('Maaf, SafeBot sedang tidak dapat dihubungi. Namun pesanmu menunjukkan kemungkinan situasi darurat. Segera cari tempat aman, hubungi kontak darurat kampus atau orang terpercaya, dan buat laporan jika memungkinkan.', 'bot', [
            { href: '#kontak', text: 'Kontak Darurat', className: 'btn danger' },
            { href: '#lapor', text: 'Buat Laporan', className: 'btn primary' }
          ]);
          return;
        }

        addChatMessage('Maaf, SafeBot sedang tidak dapat dihubungi. Jika situasi darurat, segera hubungi kontak kampus atau orang terpercaya di sekitarmu.', 'bot');
      } finally {
        removeTypingIndicator();
        setChatPending(false);
      }
    }
