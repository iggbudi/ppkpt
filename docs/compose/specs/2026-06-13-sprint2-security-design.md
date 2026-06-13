# Sprint 2: Security Hardening — Design Spec

## [S1] Problem

Sprint 1 fixed privacy and schema issues. Sprint 2 addresses security hardening:
- innerHTML still used in some places
- No validation for invalid types (e.g., non-string password causes 500)
- Session doesn't regenerate after login
- No login rate limit
- No centralized error handler (stack traces exposed)
- XSS payloads accepted without rejection

## [S2] Solution Overview

### S2-1: Schema Validation
- Add Zod validation for all endpoints
- Allowlist for category, urgency, status
- Type validation for username/password
- Max length for all string fields

### S2-2: XSS Removal
- Replace remaining innerHTML with DOM helpers
- Remove all inline event handlers
- Replace insertAdjacentHTML with textContent/createEl

### S2-3: Session Hardening
- Regenerate session ID after login (prevent session fixation)
- Add login rate limit (5 attempts per 5 minutes)
- Add centralized JSON error handler
- Wajibkan SESSION_SECRET in production

### S2-4: Tests
- Test XSS payloads render as text
- Test invalid types return 400, not 500
- Test login brute force throttling
- Test session ID changes after login

## [S3] Implementation Order

| Step | Task | Priority |
|------|------|----------|
| 1 | Schema validation with Zod | P1 |
| 2 | Session hardening (regenerate, login rate limit) | P1 |
| 3 | Centralized error handler | P1 |
| 4 | XSS removal in frontend | P1 |
| 5 | Security tests | P1 |

## [S4] Success Criteria

- [ ] All endpoints validate input types and values
- [ ] Invalid types return 400, not 500
- [ ] Session ID changes after login
- [ ] Login brute force returns 429 after 5 attempts
- [ ] No innerHTML with user data
- [ ] XSS payloads render as text
- [ ] Error responses don't expose stack traces
