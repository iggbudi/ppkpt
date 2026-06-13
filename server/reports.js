const crypto = require('crypto');
const { z } = require('zod');
const db = require('./db');

const reportSchema = z.object({
  category: z.enum(['Verbal', 'Sosial', 'Cyberbullying', 'Fisik', 'Seksual']),
  location: z.string().min(1).max(500),
  urgency: z.enum(['Rendah', 'Sedang', 'Tinggi']),
  incidentDate: z.string().min(1),
  description: z.string().min(1).max(5000),
  evidence: z.string().max(200).optional(),
  isAnonymous: z.boolean().optional()
});

function generateId() {
  return 'SSF-' + crypto.randomUUID().substring(0, 8).toUpperCase();
}

function setupReportRoutes(app) {
  const insertReport = db.prepare('INSERT INTO reports (id, category, location, urgency, incidentDate, status, description, evidence, appointment, createdAt, authorId, authorName, isAnonymous) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const selectAllReports = db.prepare('SELECT * FROM reports');
  const selectReportById = db.prepare('SELECT * FROM reports WHERE id = ?');
  const selectReportsByAuthor = db.prepare('SELECT * FROM reports WHERE authorId = ?');
  const updateReportStatus = db.prepare('UPDATE reports SET status = ?, appointment = ? WHERE id = ?');
  const deleteAllReports = db.prepare('DELETE FROM reports');
  const countReports = db.prepare('SELECT COUNT(*) as count FROM reports');
  const insertAudit = db.prepare('INSERT INTO audit_log (timestamp, userId, action, targetId, ip, details) VALUES (?, ?, ?, ?, ?, ?)');
  const selectAllAudit = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC');

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

  app.post('/api/reports', (req, res) => {
    let parsed;
    try {
      parsed = reportSchema.parse(req.body);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }

    const { category, location, urgency, incidentDate, description, evidence, isAnonymous } = parsed;
    const user = req.session.user || null;
    const isAnon = isAnonymous !== false || !user;
    const authorIdVal = isAnon ? null : user.id;
    const authorNameVal = isAnon ? 'Anonim' : (isAnonymous !== false ? user.name.charAt(0).toUpperCase() + '***' : user.name);

    const reportId = generateId();

    insertReport.run(reportId, category, location, urgency, incidentDate, 'Baru Masuk', description, evidence || 'Tidak ada lampiran', 'Menunggu proses peninjauan awal dari tim Satgas.', Date.now(), authorIdVal, authorNameVal, isAnon ? 1 : 0);

    insertAudit.run(Date.now(), isAnon ? null : user.id, 'report.create', reportId, isAnon ? null : req.ip, JSON.stringify({ category, urgency, isAnonymous: isAnon }));

    res.json({ report: selectReportById.get(reportId) });
  });

  app.get('/api/reports', requireAuth, (req, res) => {
    const user = req.session.user;
    const userReports = user.role === 'admin' ? selectAllReports.all() : selectReportsByAuthor.all(user.id);
    res.json({ reports: userReports });
  });

  app.get('/api/reports/:id', requireAuth, (req, res) => {
    const user = req.session.user;
    const report = selectReportById.get(req.params.id);

    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

    if (user.role !== 'admin' && report.authorId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    insertAudit.run(Date.now(), user.id, 'report.view', report.id, req.ip, '{}');

    res.json({ report });
  });

  app.patch('/api/reports/:id/status', requireAuth, requireAdmin, (req, res) => {
    const { status, appointment } = req.body;
    const report = selectReportById.get(req.params.id);

    if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

    const validStatuses = ['Baru Masuk', 'Direview', 'Diproses', 'Selesai'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    const oldStatus = report.status;
    updateReportStatus.run(status, appointment || report.appointment, report.id);

    insertAudit.run(Date.now(), req.session.user.id, 'report.status_update', report.id, req.ip, JSON.stringify({ oldStatus, newStatus: status }));

    res.json({ report: selectReportById.get(report.id) });
  });

  app.post('/api/reports/seed', requireAuth, requireAdmin, (req, res) => {
    const dummies = [
      { id: 'SSF-2026-1001', category: 'Cyberbullying', location: 'Grup WA Kelas', urgency: 'Tinggi', incidentDate: '2026-06-02', status: 'Baru Masuk', description: 'Saya diejek dan foto saya disebar di grup tanpa izin.', evidence: 'demo-bukti.png', appointment: 'Menunggu proses peninjauan awal.', createdAt: Date.now() - 20000, authorId: 2, authorName: 'D***', isAnonymous: 1 },
      { id: 'SSF-2026-1002', category: 'Verbal', location: 'Ruang Kelas', urgency: 'Sedang', incidentDate: '2026-06-05', status: 'Direview', description: 'Saya sering dihina soal penampilan saat presentasi.', evidence: 'Tidak ada lampiran', appointment: 'Sedang dalam peninjauan bukti oleh Admin.', createdAt: Date.now() - 15000, authorId: 2, authorName: 'demo_user', isAnonymous: 0 },
      { id: 'SSF-2026-1003', category: 'Sosial', location: 'Lingkungan Kampus', urgency: 'Rendah', incidentDate: '2026-06-06', status: 'Selesai', description: 'Teman saya dikucilkan dari kelompok tugas.', evidence: 'Tidak ada lampiran', appointment: 'Telah dilakukan mediasi dan edukasi pencegahan.', createdAt: Date.now() - 10000, authorId: 2, authorName: 'D***', isAnonymous: 1 },
      { id: 'SSF-2026-1004', category: 'Fisik', location: 'Parkiran Kampus', urgency: 'Tinggi', incidentDate: '2026-06-08', status: 'Diproses', description: 'Ada tindakan represif dan ancaman jika saya melapor.', evidence: 'rekaman_suara.mp3', appointment: 'Jadwal Konseling: Kasus dialihkan ke Satgas PPKS.', createdAt: Date.now() - 5000, authorId: 2, authorName: 'demo_user', isAnonymous: 0 }
    ];

    const insertMany = db.transaction((items) => {
      deleteAllReports.run();
      for (const d of items) {
        insertReport.run(d.id, d.category, d.location, d.urgency, d.incidentDate, d.status, d.description, d.evidence, d.appointment, d.createdAt, d.authorId, d.authorName, d.isAnonymous);
      }
    });
    insertMany(dummies);

    insertAudit.run(Date.now(), req.session.user.id, 'reports.seed', null, req.ip, JSON.stringify({ count: dummies.length }));

    res.json({ ok: true, count: dummies.length });
  });

  app.delete('/api/reports', requireAuth, requireAdmin, (req, res) => {
    const { count } = countReports.get();
    deleteAllReports.run();

    insertAudit.run(Date.now(), req.session.user.id, 'reports.clear', null, req.ip, JSON.stringify({ cleared: count }));

    res.json({ ok: true, cleared: count });
  });

  app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
    const log = selectAllAudit.all().map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : {}
    }));
    res.json({ log });
  });
}

module.exports = { setupReportRoutes };
