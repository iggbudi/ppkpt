function setupReportRoutes(app, auditLog) {
  const reports = [];

  function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  }

  app.post('/api/reports', requireAuth, (req, res) => {
    const { category, location, urgency, incidentDate, description, evidence, isAnonymous } = req.body;
    
    if (!category || !location || !urgency || !incidentDate || !description) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const user = req.session.user;
    const maskedName = isAnonymous !== false 
      ? user.name.charAt(0).toUpperCase() + '***'
      : user.name;

    const report = {
      id: 'SSF-2026-' + Math.floor(1000 + Math.random() * 9000),
      category,
      location,
      urgency,
      incidentDate,
      status: 'Baru Masuk',
      description,
      evidence: evidence || 'Tidak ada lampiran',
      appointment: 'Menunggu proses peninjauan awal dari tim Satgas.',
      createdAt: Date.now(),
      authorId: user.id,
      authorName: maskedName,
      isAnonymous: isAnonymous !== false
    };

    reports.push(report);

    auditLog.push({
      timestamp: Date.now(),
      userId: user.id,
      action: 'report.create',
      targetId: report.id,
      ip: req.ip,
      details: { category, urgency, isAnonymous: report.isAnonymous }
    });

    res.json({ report });
  });

  app.get('/api/reports', requireAuth, (req, res) => {
    const user = req.session.user;
    let userReports;

    if (user.role === 'admin') {
      userReports = reports;
    } else {
      userReports = reports.filter(r => r.authorId === user.id);
    }

    res.json({ reports: userReports });
  });

  app.get('/api/reports/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const report = reports.find(r => r.id === req.params.id);
    
    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    
    if (user.role !== 'admin' && report.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    auditLog.push({
      timestamp: Date.now(),
      userId: user.id,
      action: 'report.view',
      targetId: report.id,
      ip: req.ip,
      details: {}
    });

    res.json({ report });
  });

  app.patch('/api/reports/:id/status', requireAuth, requireAdmin, (req, res) => {
    const { status, appointment } = req.body;
    const report = reports.find(r => r.id === req.params.id);
    
    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
    
    const validStatuses = ['Baru Masuk', 'Direview', 'Diproses', 'Selesai'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    const oldStatus = report.status;
    report.status = status;
    if (appointment) report.appointment = appointment;

    auditLog.push({
      timestamp: Date.now(),
      userId: req.session.user.id,
      action: 'report.status_update',
      targetId: report.id,
      ip: req.ip,
      details: { oldStatus, newStatus: status }
    });

    res.json({ report });
  });

  app.post('/api/reports/seed', requireAuth, requireAdmin, (req, res) => {
    const dummies = [
      { id: 'SSF-2026-1001', category: 'Cyberbullying', location: 'Grup WA Kelas', urgency: 'Tinggi', incidentDate: '2026-06-02', status: 'Baru Masuk', description: 'Saya diejek dan foto saya disebar di grup tanpa izin.', evidence: 'demo-bukti.png', appointment: 'Menunggu proses peninjauan awal.', createdAt: Date.now() - 20000, authorId: 2, authorName: 'D***', isAnonymous: true },
      { id: 'SSF-2026-1002', category: 'Verbal', location: 'Ruang Kelas', urgency: 'Sedang', incidentDate: '2026-06-05', status: 'Direview', description: 'Saya sering dihina soal penampilan saat presentasi.', evidence: 'Tidak ada lampiran', appointment: 'Sedang dalam peninjauan bukti oleh Admin.', createdAt: Date.now() - 15000, authorId: 2, authorName: 'demo_user', isAnonymous: false },
      { id: 'SSF-2026-1003', category: 'Sosial', location: 'Lingkungan Kampus', urgency: 'Rendah', incidentDate: '2026-06-06', status: 'Selesai', description: 'Teman saya dikucilkan dari kelompok tugas.', evidence: 'Tidak ada lampiran', appointment: 'Telah dilakukan mediasi dan edukasi pencegahan.', createdAt: Date.now() - 10000, authorId: 2, authorName: 'D***', isAnonymous: true },
      { id: 'SSF-2026-1004', category: 'Fisik', location: 'Parkiran Kampus', urgency: 'Tinggi', incidentDate: '2026-06-08', status: 'Diproses', description: 'Ada tindakan represif dan ancaman jika saya melapor.', evidence: 'rekaman_suara.mp3', appointment: 'Jadwal Konseling: Kasus dialihkan ke Satgas PPKS.', createdAt: Date.now() - 5000, authorId: 2, authorName: 'demo_user', isAnonymous: false }
    ];

    reports.length = 0;
    dummies.forEach(d => reports.push(d));

    auditLog.push({
      timestamp: Date.now(),
      userId: req.session.user.id,
      action: 'reports.seed',
      ip: req.ip,
      details: { count: dummies.length }
    });

    res.json({ ok: true, count: dummies.length });
  });

  app.delete('/api/reports', requireAuth, requireAdmin, (req, res) => {
    const count = reports.length;
    reports.length = 0;

    auditLog.push({
      timestamp: Date.now(),
      userId: req.session.user.id,
      action: 'reports.clear',
      ip: req.ip,
      details: { cleared: count }
    });

    res.json({ ok: true, cleared: count });
  });

  app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
    res.json({ log: auditLog });
  });
}

module.exports = { setupReportRoutes };
