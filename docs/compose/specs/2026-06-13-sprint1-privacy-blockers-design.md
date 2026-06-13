# Sprint 1: Privacy & Functional Blockers — Design Spec

## [S1] Problem

After Phase 0-4 implementation, several critical issues remain:
- Anonymous reports still contain authorId, userId, and IP
- Backend uses `category`, frontend reads `cat` — schema mismatch
- User dashboard still reads from localStorage
- Emergency contacts are placeholder but CTAs point to them
- UI claims don't match implementation

## [S2] Solution Overview

### S2-1: Fix Anonymous Reporting
- For anonymous reports: `authorId: null`, no userId in audit, no raw IP
- For logged-in anonymous: same result as unauthenticated
- Test: anonymous from login and logout produce identical data

### S2-2: Schema Alignment
- Backend schema (canonical): `category`, `location`, `urgency`, `incidentDate`, `description`, `authorId`, `authorName`
- Update all frontend to use backend field names
- Remove old short names (`cat`, `loc`, `urg`, `date`, `desc`)

### S2-3: User Dashboard via API
- Remove `Storage.load('reports')` as report source
- User dashboard calls `GET /api/reports`
- Remove localStorage dependency for reports

### S2-4: Fix Anonymous Tracking
- For anonymous reports: hide tracking button (no endpoint exists)
- For authenticated reports: keep tracking
- Use UUID instead of Math.random for IDs

### S2-5: Fix UI Claims
- Remove "realtime" claims
- Remove "terenkripsi" claims
- Fix "data disimpan lokal" → "data disimpan di server demo"
- Fix "upload bukti" → "simulasi upload"
- Fix emergency contacts CTA

### S2-6: Add Tests
- Test anonymous report has no authorId
- Test schema contract
- Test user dashboard returns own reports

## [S3] Implementation Order

| Step | Task | Priority |
|------|------|----------|
| 1 | Fix anonymous report (remove identifiers) | P0 |
| 2 | Align schema (frontend → backend names) | P0 |
| 3 | User dashboard via API | P0 |
| 4 | Fix tracking ID + hide anon tracking | P1 |
| 5 | Fix UI claims | P1 |
| 6 | Add contract tests | P1 |

## [S4] Success Criteria

- [ ] Anonymous report has `authorId: null`
- [ ] Anonymous audit log has no userId or raw IP
- [ ] Frontend uses backend field names everywhere
- [ ] User dashboard fetches from API
- [ ] No localStorage reports dependency
- [ ] Anonymous reports don't show tracking button
- [ ] All UI claims match implementation
- [ ] Contract tests pass
