# Incident Response: Evidence Upload Security

Dokumentasi ini menjelaskan prosedur penanganan insiden terkait unggah bukti di SafeSphere.

## Jenis Insiden

### 1. Malware Upload Detected

**Severity**: High  
**Trigger**: File ditolak oleh malware scanner

**Response Steps**:
1. File otomatis ditolak dan tidak disimpan
2. Event tercatat di audit log dengan detail:
   - `action: evidence.scan`
   - `scan_status: rejected`
   - `scan_result`: reason (tanpa detail sensitif)
3. Alert dikirim ke admin (jika dikonfigurasi)
4. Monitoring mencatat di metrics

**Investigation**:
```sql
SELECT * FROM audit_log 
WHERE action = 'evidence.scan' 
AND details LIKE '%rejected%'
ORDER BY timestamp DESC
LIMIT 100;
```

**Follow-up**:
- Review pattern file yang ditolak
- Update scanner rules jika diperlukan
- Block IP jika ada pola abuse

---

### 2. Mass Upload Attempt (Abuse)

**Severity**: Medium-High  
**Trigger**: Rate limit exceeded atau anomali volume

**Response Steps**:
1. Rate limiter memblokir request berlebih
2. User mendapat error 429
3. Event tercatat di audit log
4. Monitoring mencatat di metrics

**Investigation**:
```sql
-- Check for rapid uploads from same IP/session
SELECT ip, COUNT(*) as attempts, MIN(timestamp) as first, MAX(timestamp) as last
FROM audit_log
WHERE action = 'evidence.upload'
AND timestamp > NOW() - 3600000 -- 1 hour
GROUP BY ip
HAVING attempts > 10
ORDER BY attempts DESC;
```

**Follow-up**:
- Temporary IP block jika diperlukan
- Review rate limit thresholds
- Implementasi CAPTCHA untuk suspicious patterns

---

### 3. Unauthorized Download Attempt

**Severity**: High  
**Trigger**: User mencoba download file tanpa otorisasi

**Response Steps**:
1. Request diblokir dengan 403
2. Event tercatat di audit log
3. Monitoring mencatat unauthorized download

**Investigation**:
```sql
SELECT * FROM audit_log
WHERE action = 'evidence.download'
AND details LIKE '%unauthorized%'
ORDER BY timestamp DESC;
```

**Follow-up**:
- Review authorization logic
- Check for IDOR vulnerabilities
- Notify affected users jika ada breach

---

### 4. Storage Corruption/Loss

**Severity**: Critical  
**Trigger**: File tidak dapat diakses atau checksum mismatch

**Response Steps**:
1. Health check mendeteksi masalah
2. Alert critical dikirim
3. Incident commander dihubungi

**Investigation**:
```sql
-- Check for files with scan_status=clean but missing from storage
SELECT ef.* FROM evidence_files ef
WHERE ef.scan_status = 'clean'
AND ef.deleted_at IS NULL;
```

**Recovery**:
1. Restore dari backup terakhir
2. Verify integrity semua file
3. Re-scan files jika diperlukan
4. Post-mortem analysis

---

### 5. PII Leakage in Metadata

**Severity**: High  
**Trigger**: Metadata stripping gagal atau tidak lengkap

**Response Steps**:
1. File tetap disimpan (sudah di-strip)
2. Alert warning dikirim
3. Manual review diperlukan

**Investigation**:
```sql
-- Check for images that might have metadata issues
SELECT * FROM evidence_files
WHERE detected_mime LIKE 'image/%'
AND scan_status = 'clean'
ORDER BY uploaded_at DESC;
```

**Follow-up**:
- Review metadata stripping logic
- Update stripping rules
- Re-process affected files jika diperlukan

---

## Severity Levels

| Level | Response Time | Escalation |
|-------|---------------|------------|
| **Critical** | < 15 menit | CTO/Security Lead |
| **High** | < 1 jam | Security Team |
| **Medium** | < 4 jam | Dev Team |
| **Low** | < 24 jam | Ops Team |

---

## Communication Templates

### Internal Alert

```
🚨 [SEVERITY] Evidence Upload Incident

Type: [INCIDENT_TYPE]
Time: [TIMESTAMP]
Affected: [SCOPE]
Status: [INVESTIGATING/MITIGATED/RESOLVED]

Details:
[DESCRIPTION]

Next Steps:
[ACTIONS]

Incident Commander: [NAME]
```

### User Notification (jika diperlukan)

```
Subject: SafeSphere Security Notice

Kepada Pengguna SafeSphere,

Kami mendeteksi aktivitas tidak biasa pada sistem unggah bukti. 
Tindakan telah diambil untuk melindungi data Anda.

[YANG PERLU DILAKUKAN USER]

Jika Anda memiliki pertanyaan, hubungi security@safesphere.id

Tim SafeSphere
```

---

## Post-Incident Checklist

- [ ] Root cause analysis completed
- [ ] Timeline documented
- [ ] Impact assessment done
- [ ] Fix implemented and tested
- [ ] Monitoring improved (if needed)
- [ ] Documentation updated
- [ ] Team debrief scheduled
- [ ] Prevention measures documented

---

## Monitoring Endpoints

| Endpoint | Fungsi |
|----------|--------|
| `GET /api/admin/evidence/health` | System health status |
| `GET /api/admin/evidence/metrics` | Upload/scan/download metrics |
| `GET /api/admin/evidence/alerts` | Recent alerts |
| `GET /api/admin/status` | Overall system status |

---

## Automated Responses

### Rate Limit Exceeded
```
Action: Block IP temporary (1 hour)
Log: audit_log with action 'security.rate_limit'
Alert: Warning to admin
```

### Malware Detected
```
Action: Reject file, delete from quarantine
Log: audit_log with action 'evidence.scan'
Alert: Warning to admin
```

### Storage Full
```
Action: Alert critical, block new uploads
Log: audit_log with action 'alert.storage_full'
Alert: Critical to all admins
```

### Scan Timeout
```
Action: Auto-reject pending files after 24h
Log: audit_log with action 'evidence.timeout'
Alert: Warning to admin
```

---

## Tools & Commands

### Check Evidence System Health
```bash
curl -H "Cookie: session=..." http://localhost:3000/api/admin/evidence/health
```

### View Recent Alerts
```bash
curl -H "Cookie: session=..." http://localhost:3000/api/admin/evidence/alerts?limit=20
```

### Check Database for Issues
```sql
-- Pending scans older than 24 hours
SELECT COUNT(*) FROM evidence_files 
WHERE scan_status = 'pending' 
AND uploaded_at < strftime('%s', 'now') * 1000 - 86400000;

-- Files without database entry (orphan)
-- (Run via admin cleanup endpoint)

-- Recent failed uploads
SELECT * FROM audit_log 
WHERE action = 'evidence.upload' 
AND details LIKE '%error%'
ORDER BY timestamp DESC LIMIT 20;
```

---

## References

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheet/File_Upload_Cheat_Sheet.html)
- [CWE-434: Unrestricted Upload of File with Dangerous Type](https://cwe.mitre.org/data/definitions/434.html)
- [NIST SP 800-61: Computer Security Incident Handling Guide](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)
