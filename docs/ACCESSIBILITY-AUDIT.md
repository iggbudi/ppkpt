# SafeSphere Accessibility Audit

Tanggal: 18 Juli 2026 (UX Sprint 01 update)

## Automated Checks

### Structure
- [x] Logo has alt text
- [x] All inputs have labels
- [x] Skip link present
- [x] aria-current on active nav
- [x] document.title updates per route
- [x] Focus moves to heading after route change

### ARIA
- [x] Toast: role="status" + aria-live="polite"
- [x] Error: role="alert"
- [x] Consent: role="note"
- [x] Form step validation uses aria-invalid + aria-describedby
- [x] Quick escape overlay exposes aria-hidden and focusable close button

### Motion
- [x] prefers-reduced-motion supported

### Keyboard
- [x] All buttons keyboard accessible
- [x] Modal close via button
- [x] Form navigation via Tab
- [x] Topbar dropdown: ArrowUp/ArrowDown/Home/End/Escape
- [x] Quick escape close button receives focus on activate

### Screen Reader Alternatives
- [x] Admin chart has textual table summary (`adminChartTable`)
- [x] Canvas chart marked aria-hidden with table fallback

## Sprint 4 Improvements
- Removed misleading demo/simulation UI copy from auth and laporan flow
- Vendored Chart.js locally (`public/vendor/chart.umd.min.js`)
- CSP script-src restricted to `'self'` only
- Edukasi scenarios externalized to JSON with progress indicator (6 skenario)
- Quick escape clears hash history and focuses overlay close control
- Pilot banner replaces misleading "MODE DEMO" messaging

## Manual QA Checklist (Sprint 4)

| Area | Keyboard | Screen Reader | Zoom 200% | Status |
|------|----------|---------------|-----------|--------|
| Beranda | Tab order OK | Heading announced | Reflow OK | Pass |
| Lapor (multi-step) | Step nav OK | Errors linked to fields | Reflow OK | Pass |
| Edukasi | Scenario buttons OK | Progress text readable | Reflow OK | Pass |
| Login/Register | Form fields OK | Errors announced | Reflow OK | Pass |
| Admin dashboard | Dropdown keys OK | Chart table available | Reflow OK | Pass |
| Quick escape | Esc x2 + close btn | Overlay title changes | Fullscreen OK | Pass |

## UX Sprint 01 — Protective Entry Verification

### Automated browser coverage

- [x] Homepage reassurance, anonymous CTA, emergency CTA, and trust facts are visible.
- [x] Anonymous CTA reaches the safety check with one activation.
- [x] Safe path exposes step 1 and focuses the first field.
- [x] Confidential guest path redirects to login.
- [x] Keyboard activation works for the primary entry action.
- [x] Quick escape activates from the safety check, makes the application inert/hidden, and keeps keyboard focus on the close control.
- [x] Mobile drawer is inert while closed, moves focus on open, and returns focus on Escape.
- [x] No horizontal overflow on homepage, report choice, or safety check at 320, 390, 768, 950, and 1440 CSS pixels.
- [x] Accessibility widget does not overlap the emergency action at the tested widths.
- [x] `prefers-reduced-motion: reduce` reduces route animation duration.
- [x] Browser `pageerror` collection is empty on the covered entry paths.

Test file: `e2e/tests/victim-entry.spec.js`.

### Contrast calculation for touched tokens

| Pair | Ratio | WCAG AA result |
|---|---:|---|
| Body text `#24302D` / background `#F6F4EF` | 12.44:1 | Pass |
| Muted text `#5B6864` / background `#F6F4EF` | 5.29:1 | Pass |
| Muted text `#5B6864` / protective surface `#DDE9E3` | 4.67:1 | Pass |
| Primary `#285E61` / white | 7.33:1 | Pass |
| Emergency `#B42318` / `#FFF7F5` | 6.22:1 | Pass |
| High-contrast emergency `#FFB3AD` / black | 12.30:1 | Pass |

Calculation used the WCAG relative luminance formula. This is not a replacement for a full automated page audit.

### Visual review artifacts

Before/after screenshots were captured at 390×844 and 1440×900. Local artifacts are stored under ignored path `.pi-subagents/ux-sprint-01/` and are not production assets.

### Copy and structure review

- [x] Removed “Gunakan dengan bijak” and the moral instruction to report “secara jujur”.
- [x] Copy distinguishes account anonymity from broader technical anonymity.
- [x] SafeBot is not labelled as a human expert in primary navigation or page title.
- [x] Emergency action routes to verified click-to-call contacts, not to placeholders, SafeBot, or report submission.
- [x] Campus contacts are explicitly marked unavailable until configured from an official source.
- [x] SDG context appears after the primary safety and reporting content.

## Known Issues (Non-blocking)

- Some inline styles remain in report upload zone (CSP still needs unsafe-inline for style).
- Manual NVDA/VoiceOver testing was not performed in this implementation environment.
- Browser zoom 200% was represented by responsive reflow checks down to 768/320 CSS pixels, not a manual OS/browser zoom session.
- Full-page axe/Lighthouse automation is not installed.
- Usability testing with affected students requires a separate ethical research protocol.

## Recommendations

1. Continue migrating inline styles to CSS classes.
2. Run a manual NVDA/VoiceOver and browser zoom 200% session before a broader public pilot.
3. Add axe or Lighthouse CI after agreeing the tooling and thresholds.
4. Test the new entry experience with students using low-stress, trauma-informed scenarios.
5. Localize screen reader instructions for evidence upload warnings.