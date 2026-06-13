# Phase 2: UX & Accessibility — Design Spec

## [S1] Problem

The current reporting flow has several UX and accessibility issues:
- "Lapor Anonim" menu forces login, contradicting the anonymous promise
- No safety check at the start of the form
- Single-page form with no step-by-step guidance
- No document.title update on route change
- No skip link for keyboard users
- No reduced-motion support

## [S2] Solution Overview

4 focused improvements:

### UX-001: Anonymous vs Secret Choice
Before the report form, show a clear choice:
- **Anonim**: No login required, identity not collected
- **Rahasia**: Login required, identity stored for status tracking

### UX-002: Step-by-Step Form
Break the report form into steps:
1. Safety check ("Are you in immediate danger?")
2. Incident details (category, location, date, urgency)
3. Description (with sentiment analysis)
4. Evidence (file upload)
5. Identity choice (anonymous vs authenticated)
6. Review & submit

### A11Y-001: Focus & Title Management
- Update `document.title` on route change
- Focus main heading after route change
- Add skip link to main content
- Add `aria-current="page"` to active nav link

### A11Y-003: Reduced Motion & Live Regions
- Add `prefers-reduced-motion` media query
- Add `role="status"` to toast notifications
- Add `aria-describedby` to form errors
- Add `aria-live` regions for dynamic content

## [S3] UX-001: Anonymous vs Secret Choice

Replace the current `#page-lapor` with a choice screen:

```html
<div id="page-lapor" class="page">
  <section class="section card">
    <div class="card-header">
      <h2>Buat Laporan</h2>
      <p class="muted">Pilih cara melapor sesuai kenyamanan Anda.</p>
    </div>
    <div class="report-choice-grid">
      <div class="report-choice-card" onclick="selectReportMode('anonim')">
        <h3>🔴 Lapor Anonim</h3>
        <p>Identitas Anda tidak akan dikumpulkan. Cocok jika Anda hanya ingin melaporkan kejadian tanpa melacak status.</p>
        <ul>
          <li>Tidak perlu login</li>
          <li>Identitas tidak disimpan</li>
          <li>Tidak bisa melacak status</li>
        </ul>
      </div>
      <div class="report-choice-card" onclick="selectReportMode('rahasia')">
        <h3>🔒 Lapor Rahasia</h3>
        <p>Identitas Anda disimpan dengan akses terbatas. Anda bisa melacak status laporan.</p>
        <ul>
          <li>Perlu login</li>
          <li>Identitas hanya bisa dilihat admin</li>
          <li>Bisa melacak status laporan</li>
        </ul>
      </div>
    </div>
    <div id="reportChoiceInfo" class="result hidden"></div>
  </section>
</div>
```

After choosing:
- Anonim → skip login, go directly to form
- Rahasia → require login, then go to form

## [S4] UX-002: Step-by-Step Form

Break the form into 6 steps with a progress indicator:

```
[1. Safety] → [2. Kejadian] → [3. Deskripsi] → [4. Bukti] → [5. Identitas] → [6. Review]
```

### Step 1: Safety Check
```html
<div class="safety-check">
  <h3>Apakah Anda dalam bahaya sekarang?</h3>
  <div class="safety-options">
    <button onclick="safetyCheck('danger')">Ya, saya dalam bahaya langsung</button>
    <button onclick="safetyCheck('safe')">Tidak, saya aman untuk melapor</button>
  </div>
</div>
```

If "danger" → show emergency contacts immediately
If "safe" → proceed to step 2

### Step 2-5: Form fields in steps
### Step 6: Review all data before submit

## [S5] A11Y-001: Focus & Title Management

### document.title update
In `handleRouting()`:
```javascript
var pageTitles = {
  '#beranda': 'Beranda - SafeSphere',
  '#lapor': 'Lapor Anonim - SafeSphere',
  '#edukasi': 'Edukasi - SafeSphere',
  '#kontak': 'Kontak Darurat - SafeSphere',
  '#chat': 'Chat Ahli - SafeSphere',
  '#login': 'Masuk - SafeSphere',
  '#register': 'Daftar - SafeSphere',
  '#admin': 'Dashboard Admin - SafeSphere',
  '#dashboard': 'Dashboard Saya - SafeSphere'
};
document.title = pageTitles[hash] || 'SafeSphere';
```

### Focus management
```javascript
var targetElement = document.getElementById(targetPageId);
if (targetElement) {
  targetElement.classList.add('active');
  var heading = targetElement.querySelector('h1, h2, h3');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
}
```

### Skip link
```html
<a href="#main-content" class="skip-link">Langsung ke konten utama</a>
```

```css
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  background: var(--primary);
  color: white;
  padding: 8px 16px;
  z-index: 10000;
  font-weight: 600;
}
.skip-link:focus {
  top: 0;
}
```

### aria-current
```javascript
var activeLink = document.querySelector('.sidebar-link[href="' + hash + '"]');
if (activeLink) {
  document.querySelectorAll('.sidebar-link').forEach(function(link) {
    link.removeAttribute('aria-current');
  });
  activeLink.setAttribute('aria-current', 'page');
}
```

## [S6] A11Y-003: Reduced Motion & Live Regions

### prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Toast with role
Update `showTopSystemAlert()`:
```javascript
alertDiv.setAttribute('role', 'status');
alertDiv.setAttribute('aria-live', 'polite');
```

### Form error association
```javascript
errorBox.setAttribute('role', 'alert');
errorBox.setAttribute('aria-live', 'assertive');
```

## [S7] Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | A11Y-001: Skip link, title, focus, aria-current | index.html, app.js, style.css |
| 2 | A11Y-003: Reduced motion, live regions | style.css, utils.js |
| 3 | UX-001: Anonymous vs secret choice | index.html, app.js, style.css, auth.js |
| 4 | UX-002: Step-by-step form | index.html, reports.js, style.css |

## [S8] Success Criteria

- [ ] document.title updates on every route change
- [ ] Main heading receives focus after route change
- [ ] Skip link visible on focus
- [ ] aria-current on active nav link
- [ ] prefers-reduced-motion disables animations
- [ ] Toast has role="status"
- [ ] Report form has safety check step
- [ ] Anonymous vs secret choice before form
