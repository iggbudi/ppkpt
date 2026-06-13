# SafeSphere Accessibility Audit

Tanggal: 13 Juni 2026

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

### Motion
- [x] prefers-reduced-motion supported

### Keyboard
- [x] All buttons keyboard accessible
- [x] Modal close via button
- [x] Form navigation via Tab

## Known Issues
- Inline styles present (CSP needs unsafe-inline)
- Some insertAdjacentHTML in report lists
- Chart.js CDN (no local fallback)

## Recommendations
1. Move inline styles to CSS classes
2. Replace insertAdjacentHTML with DOM helpers
3. Vendor Chart.js locally
4. Manual screen reader testing
5. Contrast ratio verification
