# Sprint 4: Data & Operational — Design Spec

## [S1] Problem

Sprint 3 fixed UX and accessibility. Sprint 4 addresses data persistence and operational readiness:
- All reports and audit logs are in-memory (lost on restart)
- No backup/restore capability
- No CI pipeline for automated testing
- No retention/deletion policy

## [S2] Solution Overview

### S4-1: SQLite Database
- Replace in-memory arrays with SQLite via `better-sqlite3`
- Tables: reports, audit_log, sessions
- Migration on server start

### S4-2: Backup & Restore
- Export endpoint: `GET /api/export` (admin only)
- Import endpoint: `POST /api/import` (admin only)
- Manual backup script

### S4-3: Retention Policy
- Configurable retention period (default: 90 days)
- Auto-delete old reports on schedule

### S4-4: CI Pipeline
- GitHub Actions workflow for:
  - npm test
  - npm audit
  - Secret scanning

## [S3] Implementation Order

| Step | Task | Priority |
|------|------|----------|
| 1 | SQLite database + migration | P1 |
| 2 | Backup/export endpoints | P1 |
| 3 | CI pipeline | P1 |
| 4 | Retention policy | P2 |

## [S4] Success Criteria

- [ ] Reports persist across server restarts
- [ ] Audit log persists across restarts
- [ ] Export/import endpoints work
- [ ] CI pipeline runs tests on push
- [ ] Old data can be cleaned up
