# Phase 1: Backend Foundation — Design Spec

## [S1] Problem

SafeSphere's security model runs entirely in the browser. Roles, auth, and reports are in localStorage — anyone can bypass via DevTools. There's no data isolation between users, no audit trail, and no server-side access control.

## [S2] Solution Overview

Add server-side authentication, report storage, RBAC, and audit logging. Use in-memory store (can upgrade to SQLite/Postgres later).

## [S3] Server-side Authentication

### Approach
- Express session with `express-session` and `connect-session-koa` (or memory store)
- Session cookie: `HttpOnly`, `Secure` (in production), `SameSite: strict`
- Login endpoint: `POST /api/auth/login`
- Logout endpoint: `POST /api/auth/logout`
- Me endpoint: `GET /api/auth/me` (check current session)

### Users (demo seed)
```javascript
const users = [
  { id: 1, username: 'admin', password: 'safesphere', role: 'admin', name: 'Admin PPKS' },
  { id: 2, username: 'demo', password: 'demo123', role: 'user', name: 'Demo User' }
];
```

### Session behavior
- Login → create session, set cookie
- Logout → destroy session, clear cookie
- `/api/auth/me` → return user info if session exists, 401 if not

## [S4] Server-side Report Storage

### In-memory store
```javascript
const reports = [];
const auditLog = [];
```

### Report API
- `POST /api/reports` — create report (requires auth)
- `GET /api/reports` — list reports (admin: all, user: own only)
- `GET /api/reports/:id` — get single report
- `PATCH /api/reports/:id/status` — update status (admin only)

### Report object
```javascript
{
  id: 'SSF-2026-xxxx',
  category: 'Cyberbullying',
  location: 'Grup WA',
  urgency: 'Tinggi',
  incidentDate: '2026-06-02',
  status: 'Baru Masuk',
  description: '...',
  evidence: 'filename.png',
  appointment: '...',
  createdAt: timestamp,
  authorId: userId,
  authorName: 'D***', // masked if anonymous
  isAnonymous: true
}
```

## [S5] RBAC (Role-Based Access Control)

### Roles
- `admin` — can view all reports, update status, view audit log
- `user` — can create reports, view own reports

### Middleware
```javascript
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
```

## [S6] Audit Log

Every sensitive action is logged:
```javascript
{
  timestamp: Date.now(),
  userId: 1,
  action: 'report.create',
  targetId: 'SSF-2026-1234',
  ip: '127.0.0.1',
  details: { category: 'Cyberbullying', urgency: 'Tinggi' }
}
```

### Audit actions
- `auth.login` — user logged in
- `auth.logout` — user logged out
- `report.create` — report created
- `report.view` — report viewed
- `report.status_update` — status changed

### Audit API
- `GET /api/audit` — view audit log (admin only)

## [S7] Frontend Changes

### Auth flow
- Login form → `POST /api/auth/login` → session cookie set
- On page load → `GET /api/auth/me` → restore session
- Logout → `POST /api/auth/logout` → session destroyed

### Report flow
- Submit report → `POST /api/reports` → stored server-side
- User dashboard → `GET /api/reports` (filtered by user)
- Admin dashboard → `GET /api/reports` (all reports)
- Update status → `PATCH /api/reports/:id/status`

### Remove localStorage dependency
- Remove `Storage.save/load/remove` calls for reports and currentUser
- Keep localStorage only for UI preferences (a11y, banner dismiss)

## [S8] Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Add session middleware to server | `server/index.js`, `server/package.json` |
| 2 | Create auth routes | `server/auth.js` |
| 3 | Create report store and routes | `server/reports.js` |
| 4 | Add RBAC middleware | `server/middleware.js` |
| 5 | Add audit logging | `server/audit.js` |
| 6 | Update frontend auth flow | `public/js/auth.js`, `public/app.js` |
| 7 | Update frontend report flow | `public/js/reports.js`, `public/js/admin.js` |
| 8 | Test end-to-end | — |

## [S9] Success Criteria

- [ ] DevTools cannot grant admin access
- [ ] Reports stored server-side, survive browser refresh
- [ ] Admin sees all reports, user sees own only
- [ ] Status changes logged with user and timestamp
- [ ] Session cookie is HttpOnly and SameSite
- [ ] All 10 existing tests still pass
- [ ] New tests for auth, reports, RBAC
