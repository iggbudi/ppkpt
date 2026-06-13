(function() {
  var currentLoginMode = 'mahasiswa';

  window.switchLoginTab = function(mode) {
    currentLoginMode = mode;
    var tabM = document.getElementById('tabMahasiswa');
    var tabA = document.getElementById('tabAdmin');
    var subtitle = document.getElementById('loginSubtitle');
    var emailInput = document.getElementById('loginEmail');
    var errorBox = document.getElementById('loginError');

    if (errorBox) errorBox.classList.add('hidden');

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
  };

  window.handleMainLogin = function(event) {
    event.preventDefault();
    var user = sanitizeInput(document.getElementById('loginEmail').value);
    var pass = document.getElementById('loginPass').value;
    var errorBox = document.getElementById('loginError');

    errorBox.classList.add('hidden');
    errorBox.innerText = '';

    if (!user || !pass) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Nama/Email dan Password tidak boleh kosong!';
      return;
    }

    if (currentLoginMode === 'admin' || user === 'admin') {
      if (user !== 'admin' || pass !== 'safesphere') {
        errorBox.classList.remove('hidden');
        errorBox.innerHTML = '<strong>AKSES DITOLAK:</strong> Kredensial Admin salah.';
        return;
      }

      currentUser = { role: 'admin', name: 'Admin PPKS' };
      Storage.save('currentUser', currentUser);

      document.getElementById('navGuest').classList.add('hidden');
      document.getElementById('navUser').classList.add('hidden');
      document.getElementById('navAdmin').classList.remove('hidden');
      document.getElementById('welcomeMessage').classList.remove('hidden');
      document.getElementById('welcomeName').innerText = currentUser.name;
      var userAvatar = document.getElementById('userAvatar');
      if (userAvatar) userAvatar.innerText = currentUser.name.charAt(0).toUpperCase();
      var navUserName = document.getElementById('navUserName');
      if (navUserName) navUserName.innerText = currentUser.name;

      window.location.hash = '#admin';
    } else {
      currentUser = { role: 'mahasiswa', name: user };
      Storage.save('currentUser', currentUser);

      document.getElementById('navGuest').classList.add('hidden');
      document.getElementById('navAdmin').classList.add('hidden');
      document.getElementById('navUser').classList.remove('hidden');
      document.getElementById('userNameDisplay').innerText = 'Halo, ' + user + '!';
      document.getElementById('welcomeMessage').classList.remove('hidden');
      document.getElementById('welcomeName').innerText = currentUser.name;
      var userAvatar = document.getElementById('userAvatar');
      if (userAvatar) userAvatar.innerText = currentUser.name.charAt(0).toUpperCase();
      var navUserName = document.getElementById('navUserName');
      if (navUserName) navUserName.innerText = currentUser.name;

      window.location.hash = '#dashboard';
    }

    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPass').value = '';
  };

  window.handleLogout = function() {
    currentUser = null;
    Storage.remove('currentUser');

    document.getElementById('navGuest').classList.remove('hidden');
    document.getElementById('navUser').classList.add('hidden');
    document.getElementById('navAdmin').classList.add('hidden');
    document.getElementById('welcomeMessage').classList.add('hidden');
    document.getElementById('invoiceResult').classList.add('hidden');
    currentViewedInvoiceId = null;

    window.location.hash = '#beranda';
  };

  window.openForgotModal = function(event) {
    event.preventDefault();
    document.getElementById('forgotPasswordModal').classList.add('show');
  };

  window.closeForgotModal = function() {
    document.getElementById('forgotPasswordModal').classList.remove('show');
  };

  window.sendOTP = function(event) {
    event.preventDefault();
    var target = sanitizeInput(document.getElementById('otpTarget').value);
    if (!target) {
      showTopSystemAlert('Mohon masukkan No. HP atau Email terlebih dahulu.');
      return;
    }
    var btn = event.target;
    btn.innerText = 'Mengirim OTP...';
    btn.style.opacity = '0.7';

    setTimeout(function() {
      btn.innerText = 'Kirim Kode OTP';
      btn.style.opacity = '1';
      showTopSystemAlert('Kode OTP berhasil dikirim ke: ' + target);
      closeForgotModal();
    }, 1500);
  };

  window.toggleStatusFields = function() {
    var status = document.getElementById('regStatus').value;
    var contInstansi = document.getElementById('containerInstansi');
    var contPeran = document.getElementById('containerPeran');

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
  };

  window.checkPasswordStrength = function() {
    var pw = document.getElementById('regPassword').value;
    var helper = document.getElementById('pwHelper');
    if (pw.length === 0) {
      helper.className = 'form-helper';
      helper.innerText = 'Minimal 6 karakter, 1 huruf kapital, 1 angka, dan 1 karakter spesial.';
      return false;
    }
    if (/[A-Z]/.test(pw) && /\d/.test(pw) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(pw) && pw.length >= 6) {
      helper.className = 'form-helper text-success';
      helper.innerText = 'Struktur password sangat kuat dan aman.';
      return true;
    } else {
      helper.className = 'form-helper text-danger';
      helper.innerText = 'Belum memenuhi: Min 6 karakter, 1 Kapital, 1 Angka, & 1 Karakter Spesial.';
      return false;
    }
  };

  window.handleRegister = function(event) {
    event.preventDefault();

    var errorBox = document.getElementById('registerError');
    var resultBox = document.getElementById('registerResult');

    errorBox.classList.add('hidden');
    errorBox.innerText = '';
    resultBox.classList.add('hidden');

    var name = sanitizeInput(document.getElementById('regName').value);
    var status = document.getElementById('regStatus').value;
    var instansi = sanitizeInput(document.getElementById('regInstansi').value);
    var peran = sanitizeInput(document.getElementById('regPeran').value);
    var email = sanitizeInput(document.getElementById('regEmail').value);
    var pw = document.getElementById('regPassword').value;
    var pwConfirm = document.getElementById('regConfirmPassword').value;

    if (!name || !status || !email || !pw || !pwConfirm) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Semua kolom bertanda bintang wajib diisi!';
      return;
    }

    if ((status === 'Mahasiswa' || status === 'Umum') && (!instansi || !peran)) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Informasi Instansi dan Peran wajib dilengkapi!';
      return;
    }

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Format alamat email tidak valid!';
      return;
    }

    if (!checkPasswordStrength()) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Struktur password terlalu lemah.';
      return;
    }

    if (pw !== pwConfirm) {
      errorBox.classList.remove('hidden');
      errorBox.innerText = 'Konfirmasi kata sandi tidak cocok.';
      return;
    }

    var btn = event.target.querySelector('button[type="submit"]');
    btn.innerText = 'Mendaftarkan...';
    btn.style.opacity = '0.7';

    setTimeout(function() {
      btn.innerText = 'Daftar Sekarang';
      btn.style.opacity = '1';

      resultBox.classList.remove('hidden');
      resultBox.classList.add('success');
      resultBox.innerHTML = '<strong>Registrasi Berhasil!</strong> Akun Anda terverifikasi. Silakan menuju <a href="#login">Login</a>.';
      event.target.reset();
      document.getElementById('pwHelper').className = 'form-helper';
      document.getElementById('pwHelper').innerText = 'Minimal 6 karakter, 1 huruf kapital, 1 angka, dan 1 karakter spesial.';
    }, 1500);
  };
})();
