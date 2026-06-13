# Navigation Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve SafeSphere navigation UX with active indicators, mobile hamburger menu, user dropdown, chat badge, smart sticky nav, and page transitions.

**Architecture:** CSS-first approach. Most changes are CSS-only. JS additions are minimal (scroll detection, dropdown toggle, badge toggle).

**Tech Stack:** Vanilla CSS, Vanilla JS

---

### Task 1: Active nav indicator

**Covers:** [S3]

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Add active indicator styles**

Find `.main-nav a:hover,` and `.main-nav a.active {` and replace with:

```css
.main-nav a {
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  transition: color 0.2s ease;
  position: relative;
  padding-bottom: 4px;
}

.main-nav a:hover,
.main-nav a.active {
  color: var(--primary);
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

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add active nav indicator underline"
```

---

### Task 2: Hamburger breakpoint 768→950px

**Covers:** [S5]

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Change hamburger breakpoint**

Find `@media (max-width: 768px)` and change to `@media (max-width: 950px)`.

Also move the hamburger-related styles from the 768px media query to the 950px media query.

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: change hamburger breakpoint from 768px to 950px"
```

---

### Task 3: Mobile auth in hamburger

**Covers:** [S4]

**Files:**
- Modify: `style.css`
- Modify: `app.js`

- [ ] **Step 1: Add mobile auth styles**

In the `@media (max-width: 950px)` section, add:

```css
  .auth-buttons {
    width: 100%;
    padding: 12px 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .auth-buttons .btn {
    width: 100%;
    text-align: center;
  }
```

- [ ] **Step 2: Update hamburger JS to include auth**

In `app.js`, update the hamburger toggle to also show/hide auth buttons:

```javascript
// In setupEventListeners, update hamburger click handler:
hamburger.addEventListener('click', function() {
  hamburger.classList.toggle('active');
  mainNav.classList.toggle('open');
  // Also toggle auth buttons visibility on mobile
  var authButtons = document.querySelectorAll('.auth-buttons');
  authButtons.forEach(function(btn) {
    btn.classList.toggle('mobile-open');
  });
});
```

- [ ] **Step 3: Add mobile-open CSS**

```css
@media (max-width: 950px) {
  .auth-buttons {
    display: none;
  }
  .auth-buttons.mobile-open {
    display: flex;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add style.css app.js
git commit -m "feat: move auth buttons inside hamburger on mobile"
```

---

### Task 4: User dropdown menu

**Covers:** [S6]

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `app.js`

- [ ] **Step 1: Update navUser HTML**

Replace the current `navUser` section:

```html
<div class="auth-buttons hidden" id="navUser">
  <div class="user-menu">
    <button class="user-menu-trigger" id="userMenuTrigger">
      <span class="user-avatar" id="userAvatar">U</span>
      <span class="user-name" id="navUserName">User</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="user-dropdown hidden" id="userDropdown">
      <a href="#dashboard" class="dropdown-item">Dashboard Saya</a>
      <button class="dropdown-item" id="navUserLogoutBtn">Keluar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add dropdown CSS**

```css
.user-menu {
  position: relative;
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
  transition: all 0.2s;
}

.user-menu-trigger:hover {
  border-color: var(--primary);
  background: var(--soft);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  min-width: 180px;
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  background: transparent;
  border: none;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--soft);
  color: var(--primary);
}
```

- [ ] **Step 3: Add dropdown JS**

```javascript
// In setupEventListeners:
var userMenuTrigger = document.getElementById('userMenuTrigger');
var userDropdown = document.getElementById('userDropdown');
if (userMenuTrigger && userDropdown) {
  userMenuTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    userDropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', function() {
    userDropdown.classList.add('hidden');
  });
}
```

- [ ] **Step 4: Update welcomeName to also set navUserName**

In the login handler, also set `navUserName` text.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat: add user dropdown menu replacing separate auth buttons"
```

---

### Task 5: Chat badge

**Covers:** [S7]

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/chat.js`

- [ ] **Step 1: Add badge HTML to chat nav link**

```html
<a href="#chat" class="nav-link-with-badge">Chat Ahli<span class="nav-badge hidden" id="chatBadge">1</span></a>
```

- [ ] **Step 2: Add badge CSS**

```css
.nav-link-with-badge {
  position: relative;
}

.nav-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background: var(--danger);
  color: white;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  padding: 0 4px;
}
```

- [ ] **Step 3: Add badge JS**

In `js/chat.js`, show badge when bot sends a response with high risk:

```javascript
function showChatBadge() {
  var badge = document.getElementById('chatBadge');
  if (badge) badge.classList.remove('hidden');
}

function hideChatBadge() {
  var badge = document.getElementById('chatBadge');
  if (badge) badge.classList.add('hidden');
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html style.css js/chat.js
git commit -m "feat: add chat notification badge on nav link"
```

---

### Task 6: Smart sticky nav

**Covers:** [S8]

**Files:**
- Modify: `style.css`
- Modify: `app.js`

- [ ] **Step 1: Add scroll detection JS**

```javascript
// In setupEventListeners or DOMContentLoaded:
var topbar = document.querySelector('.topbar');
var lastScrollY = window.scrollY;
var topbarHeight = topbar ? topbar.offsetHeight : 0;

window.addEventListener('scroll', function() {
  var currentScrollY = window.scrollY;
  
  if (currentScrollY > lastScrollY && currentScrollY > topbarHeight) {
    // Scrolling down — hide topbar
    topbar.style.transform = 'translateY(-100%)';
  } else {
    // Scrolling up — show topbar
    topbar.style.transform = 'translateY(0)';
  }
  
  lastScrollY = currentScrollY;
});
```

- [ ] **Step 2: Add transition CSS**

```css
.topbar {
  transition: transform 0.3s ease;
}
```

- [ ] **Step 3: Commit**

```bash
git add style.css app.js
git commit -m "feat: add smart sticky nav (hide on scroll down, show on scroll up)"
```

---

### Task 7: Page transitions

**Covers:** [S9]

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Update page animation**

The existing `.page` already has a fadeIn animation. Enhance it:

```css
.page {
  display: none;
  animation: fadeIn 0.3s ease-out forwards;
  min-height: 70vh;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: enhance page transition animations"
```
