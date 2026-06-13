# Navigation Improvements Design

## [S1] Problem

Current navigation has several UX issues:
- 5 nav links + 3 auth buttons = too crowded on tablet (~950px)
- Hamburger only appears at ≤768px, leaving 768-950px cramped
- Auth buttons separate from nav — user looks at two places
- No visual active state indicator beyond color change
- Mobile: nav and auth buttons are far apart

## [S2] Solution Overview

Three tiers of improvement:

### Tier 1: Quick Wins (CSS only)
1. **Active nav indicator** — underline bar below active link
2. **Mobile auth in hamburger** — auth buttons move inside hamburger menu on mobile
3. **Hamburger breakpoint** — change from 768px to 950px

### Tier 2: Medium Effort
4. **User dropdown menu** — replace separate Dashboard/Logout buttons with a dropdown
5. **Chat badge** — notification dot on "Chat Ahli" nav link

### Tier 3: Nice to Have
6. **Smart sticky nav** — hide on scroll down, show on scroll up
7. **Page transitions** — fade animation on page change

## [S3] Active Nav Indicator

Replace simple color change with an underline bar:

```css
.main-nav a {
  position: relative;
  padding-bottom: 4px;
}

.main-nav a.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary);
  border-radius: 2px;
}
```

## [S4] Mobile Auth in Hamburger

On mobile (≤950px), move auth buttons inside the hamburger dropdown:

Current structure:
```
.topbar
  .brand
  .hamburger
  .main-nav
  .auth-buttons (navGuest/navUser/navAdmin)
```

New behavior on mobile:
- Auth buttons hidden from topbar
- Auth buttons appear at bottom of hamburger menu
- Hamburger menu becomes a full-screen overlay

## [S5] Hamburger Breakpoint

Change from 768px to 950px so tablet users get the hamburger experience too.

## [S6] User Dropdown Menu

Replace separate auth buttons with a user avatar/name dropdown:

Desktop:
```
[Avatar] Username ▼
  └─ Dashboard Saya
  └─ Keluar
```

Mobile (inside hamburger):
```
Dashboard Saya
Keluar
```

## [S7] Chat Badge

Add a notification badge on "Chat Ahli" nav link when there are unread messages.

Since we don't have a real notification system yet, this will be a visual indicator that can be toggled programmatically.

## [S8] Smart Sticky Nav

Hide topbar when scrolling down, show when scrolling up. Uses scroll position tracking.

## [S9] Page Transitions

Add fade-in/fade-out animation when switching between SPA pages.

## [S10] Implementation Order

| Step | Task | Type |
|------|------|------|
| 1 | Active nav indicator (CSS) | Quick win |
| 2 | Hamburger breakpoint 768→950px (CSS) | Quick win |
| 3 | Mobile auth in hamburger (HTML + CSS + JS) | Quick win |
| 4 | User dropdown menu (HTML + CSS + JS) | Medium |
| 5 | Chat badge (CSS + JS) | Medium |
| 6 | Smart sticky nav (CSS + JS) | Nice to have |
| 7 | Page transitions (CSS) | Nice to have |

## [S11] Success Criteria

- [ ] Active nav link has visible underline indicator
- [ ] Hamburger appears at ≤950px (not 768px)
- [ ] Auth buttons inside hamburger on mobile
- [ ] User dropdown menu on desktop
- [ ] Chat badge visible on nav link
- [ ] Topbar hides on scroll down, shows on scroll up
- [ ] Page transitions animate smoothly
- [ ] No regressions on existing features
