# SafeSphere Accessibility Audit

Tanggal: 14 Juni 2026 (Sprint 4 update)

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

## Known Issues (Non-blocking)
- Some inline styles remain in report upload zone (CSP still needs unsafe-inline for style)
- Full WCAG contrast audit not automated — spot check on primary buttons passed
- Manual NVDA/VoiceOver session recommended before public pilot expansion

## Recommendations (Sprint 5+)
1. Continue migrating inline styles to CSS classes
2. Add Playwright E2E for keyboard flows
3. Run formal contrast audit with tooling (axe/Lighthouse)
4. Localize screen reader instructions for evidence upload warnings