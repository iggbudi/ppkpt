# Phase 4: Hardening & Release Readiness — Design Spec

## [S1] Problem

Before pilot with real data, the system needs security hardening, automated testing, operational readiness, and compliance checks.

## [S2] Solution Overview

Phase 4 focuses on what can be automated/implemented in code:

### Practical for code:
- SEC-010: Lightweight threat model documentation
- SEC-011: npm audit, secret scanning, CSP validation
- TEST-010: E2E test coverage for critical flows
- TEST-011: Automated accessibility checklist
- OPS-010: Backup/restore documentation and scripts

### Requires external experts (document only):
- SEC-012: Penetration test — needs external tester
- LEGAL-001: Legal review — needs lawyer
- CONTENT-001: Safety copy review — needs PPKS expert

## [S3] SEC-010: Threat Model

Document key threats and mitigations:

| Threat | Vector | Mitigation |
|--------|--------|-----------|
| Auth bypass | DevTools localStorage | Server-side session (done) |
| Data tampering | Direct API calls | RBAC middleware (done) |
| XSS | Report descriptions | DOM helpers, no innerHTML (done) |
| CSRF | Cross-origin requests | SameSite cookie (done) |
| Clickjacking | Iframe embedding | X-Frame-Options: DENY (done) |
| API abuse | Rapid chat requests | Rate limit IP + session (done) |
| PII leakage | LLM provider | PII redaction (done) |
| Secret exposure | .git, server files | public/ isolation (done) |

## [S4] SEC-011: Security Scanning

- `npm audit` on both root and server
- Check for secrets in code (API keys, passwords)
- Validate CSP headers
- Check for outdated dependencies

## [S5] TEST-010: E2E Test Coverage

Critical flows to test:
1. Anonymous report submission
2. Login → authenticated report → view dashboard
3. Admin login → seed data → view all reports → update status
4. Chat: send message → receive response
5. High-risk message → emergency response
6. Session persistence (refresh)
7. Logout → session destroyed

## [S6] TEST-011: Accessibility Checklist

Automated checks:
- All images have alt text
- All form inputs have labels
- Color contrast ratios
- Focus visible on interactive elements
- ARIA attributes present

## [S7] OPS-010: Backup & Documentation

- Document deployment process
- Document environment variables
- Create backup/restore script for in-memory data (export to JSON)
- Document incident response steps

## [S8] Implementation Order

| Step | Task | Type |
|------|------|------|
| 1 | SEC-011: npm audit + dependency check | Automated |
| 2 | TEST-010: E2E test scripts | Automated |
| 3 | SEC-010: Threat model document | Documentation |
| 4 | OPS-010: Deployment & backup docs | Documentation |
| 5 | TEST-011: Accessibility audit | Documentation |

## [S9] Success Criteria

- [ ] npm audit reports 0 vulnerabilities
- [ ] No secrets in codebase
- [ ] E2E tests cover 7 critical flows
- [ ] Threat model documented
- [ ] Deployment process documented
- [ ] Accessibility issues documented
