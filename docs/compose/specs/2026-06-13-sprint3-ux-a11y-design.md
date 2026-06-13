# Sprint 3: UX & Accessibility — Design Spec

## [S1] Problem

Sprint 2 fixed security hardening. Sprint 3 addresses UX and accessibility gaps:
- Step form doesn't validate each step before proceeding
- Modals not accessible (no role="dialog", no focus trap, no Escape close)
- Chat textarea has no label
- Report items use div with inline onclick
- No global focus-visible style
- ARIA states not exposed on hamburger, a11y toggle

## [S2] Solution Overview

### S3-1: Step Form Validation
- Validate required fields at each step before "Next" button proceeds
- Show error on invalid fields
- Focus first invalid field
- Add aria-describedby for errors

### S3-2: Accessible Dialog
- Use `<dialog>` element for modals
- Add focus trap
- Close on Escape
- Focus return to trigger element

### S3-3: ARIA States
- Hamburger: aria-expanded
- A11y toggle: aria-pressed
- A11y menu: aria-expanded
- Chat textarea: add label

### S3-4: Global Focus Style
- Add :focus-visible styles for all interactive elements

### S3-5: Semantic Report Items
- Replace div with button for clickable report items

## [S3] Implementation Order

| Step | Task | Priority |
|------|------|----------|
| 1 | Step form validation | P1 |
| 2 | Accessible dialog/modal | P1 |
| 3 | ARIA states for navigation | P1 |
| 4 | Global focus-visible style | P2 |
| 5 | Semantic report items | P2 |

## [S4] Success Criteria

- [ ] Step form validates before proceeding
- [ ] Modal has role="dialog", focus trap, Escape close
- [ ] Hamburger has aria-expanded
- [ ] All interactive elements have :focus-visible
- [ ] Report items are buttons
- [ ] Chat textarea has label
