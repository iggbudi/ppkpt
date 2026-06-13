# SafeSphere Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge GitHub repo backend (risk.js, mimoClient.js, tests) and frontend features (CSP, DOM helpers, markdown, action buttons) into local modular project.

**Architecture:** Replace server.js with server/ directory. Add DOM helpers and markdown rendering to utils.js. Update chat.js for new backend response format.

**Tech Stack:** Node.js, Express, CORS, dotenv, Xiaomi MiMo API

---

### Task 1: Replace server.js with server/ from GitHub

**Covers:** [S3]

**Files:**
- Delete: `server.js`
- Create: `server/index.js`, `server/risk.js`, `server/mimoClient.js`, `server/package.json`, `server/.env.example`

- [ ] **Step 1: Delete local server.js**

```bash
del server.js
```

- [ ] **Step 2: Copy server/ from GitHub repo clone**

Copy these files from `ppkpt-temp/server/`:
- `index.js`
- `risk.js`
- `mimoClient.js`
- `package.json`
- `.env.example`

- [ ] **Step 3: Install server dependencies**

```bash
cd server
npm install
```

- [ ] **Step 4: Create server .env from template**

```bash
cp server/.env.example server/.env
```

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat: replace server.js with GitHub server/ (risk classifier, mimoClient, tests)"
```

---

### Task 2: Add .env.example to root and update package.json

**Covers:** [S5]

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update root package.json**

Change start script to point to server/:

```json
{
  "name": "safesphere",
  "version": "1.0.0",
  "description": "SafeSphere - Pelaporan Anonim Anti-Perundungan",
  "scripts": {
    "start": "node server/index.js",
    "test": "cd server && npm test"
  },
  "dependencies": {
    "express": "^4.18.0",
    "dotenv": "^16.0.0"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: update package.json start script to server/"
```

---

### Task 3: Add CSP meta tag to index.html

**Covers:** [S4]

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add CSP meta tag after charset**

Find `<meta charset="utf-8">` and add after it:

```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; frame-src https://id.wikipedia.org; object-src 'none'; base-uri 'self'; form-action 'self';">
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "security: add CSP meta tag to index.html"
```

---

### Task 4: Add DOM helpers and markdown rendering to js/utils.js

**Covers:** [S4]

**Files:**
- Modify: `js/utils.js`

- [ ] **Step 1: Add DOM helpers to utils.js**

Add these functions inside the IIFE, after `showTopSystemAlert`:

```javascript
  window.createEl = function(tag, options, children) {
    options = options || {};
    children = children || [];
    var element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text;
    if (options.style) {
      if (typeof options.style === 'string') element.setAttribute('style', options.style);
      else Object.assign(element.style, options.style);
    }
    if (options.type) element.type = options.type;
    if (options.href) element.href = options.href;
    if (options.onClick) element.addEventListener('click', options.onClick);
    children.forEach(function(child) {
      element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return element;
  };

  window.clearElement = function(element) {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
  };

  window.setChildren = function(element, children) {
    clearElement(element);
    children.forEach(function(child) {
      element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
  };

  window.appendBr = function(element) {
    element.appendChild(document.createElement('br'));
  };

  window.appendInlineMarkdown = function(parent, text) {
    var pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
    var lastIndex = 0;
    var match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      if (match[2] || match[3]) {
        parent.appendChild(createEl('strong', { text: match[2] || match[3] }));
      } else if (match[4] || match[5]) {
        parent.appendChild(createEl('em', { text: match[4] || match[5] }));
      } else if (match[6]) {
        parent.appendChild(createEl('code', { text: match[6] }));
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  };

  window.renderMarkdownMessage = function(element, content) {
    clearElement(element);
    var lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
    var paragraphLines = [];
    var list = null;

    function flushParagraph() {
      if (paragraphLines.length === 0) return;
      var p = createEl('p');
      appendInlineMarkdown(p, paragraphLines.join(' '));
      element.appendChild(p);
      paragraphLines = [];
    }

    function flushList() {
      if (!list) return;
      element.appendChild(list);
      list = null;
    }

    lines.forEach(function(line) {
      var trimmed = line.trim();
      var listMatch = trimmed.match(/^[-*]\s+(.+)$/);
      var numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);

      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      if (listMatch || numberedMatch) {
        flushParagraph();
        if (!list) list = createEl(numberedMatch ? 'ol' : 'ul');
        var li = createEl('li');
        appendInlineMarkdown(li, listMatch ? listMatch[1] : numberedMatch[1]);
        list.appendChild(li);
        return;
      }

      flushList();
      paragraphLines.push(trimmed.replace(/^#{1,6}\s+/, ''));
    });

    flushParagraph();
    flushList();
  };
```

- [ ] **Step 2: Commit**

```bash
git add js/utils.js
git commit -m "feat: add DOM helpers and markdown rendering to utils.js"
```

---

### Task 5: Update js/chat.js for new backend response format

**Covers:** [S4]

**Files:**
- Modify: `js/chat.js`

- [ ] **Step 1: Rewrite chat.js**

The new backend returns `{ reply, risk, actions, source }`. Update chat.js to:
1. Use `createEl` and `renderMarkdownMessage` from utils.js
2. Parse `actions` array and render buttons
3. Handle risk level display
4. Keep typing indicator and input handling

Rewrite `js/chat.js` with:

```javascript
(function() {
  var chatHistory = [];
  var isWaiting = false;

  function addChatMessage(content, sender, actions) {
    var container = document.getElementById('chatMessages');
    if (!container) return;

    var message = createEl('div', { className: 'chat-message ' + sender });

    if (sender === 'bot') {
      renderMarkdownMessage(message, content);
    } else {
      message.textContent = content;
    }

    if (actions && actions.length > 0) {
      var actionsDiv = createEl('div', { className: 'chat-message-actions' });
      actions.forEach(function(action) {
        var btn = createEl('a', {
          className: action.className || 'btn primary',
          href: action.href || '#',
          text: action.text || 'Action'
        });
        actionsDiv.appendChild(btn);
      });
      message.appendChild(actionsDiv);
    }

    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    var container = document.getElementById('chatMessages');
    if (!container || document.getElementById('chatTypingIndicator')) return;

    var indicator = createEl('div', { className: 'chat-message bot typing' }, [
      createEl('span'),
      createEl('span'),
      createEl('span'),
      ' SafeBot sedang mengetik...'
    ]);
    indicator.id = 'chatTypingIndicator';
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('chatTypingIndicator');
    if (el) el.remove();
  }

  async function sendMessage() {
    var input = document.getElementById('chatInput');
    if (!input || isWaiting) return;

    var message = input.value.trim();
    if (!message) return;

    isWaiting = true;
    input.value = '';
    input.style.height = 'auto';
    input.readOnly = true;

    var sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerText = 'Mengirim...';
    }

    addChatMessage(message, 'user');
    chatHistory.push({ role: 'user', content: message });

    showTyping();

    try {
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          user: currentUser ? { name: currentUser.name, role: currentUser.role } : null
        })
      });

      var data = await response.json();

      hideTyping();

      if (!response.ok) {
        if (response.status === 429 && data && data.message) {
          addChatMessage(data.message, 'bot');
        } else {
          addChatMessage('Maaf, terjadi kesalahan. Coba lagi nanti.', 'bot');
        }
      } else {
        addChatMessage(data.reply, 'bot', data.actions || []);
        chatHistory.push({ role: 'assistant', content: data.reply });
      }
    } catch (err) {
      hideTyping();

      // Fallback: use frontend risk detection
      var riskScore = getRiskScore(message);
      if (riskScore.score >= 5 || riskScore.foundHighRisk) {
        addChatMessage('Maaf, SafeBot sedang tidak dapat dihubungi. Namun pesanmu menunjukkan kemungkinan situasi darurat. Segera cari tempat aman, hubungi kontak darurat kampus atau orang terpercaya.', 'bot', [
          { href: '#kontak', text: 'Kontak Darurat', className: 'btn danger' },
          { href: '#lapor', text: 'Buat Laporan', className: 'btn primary' }
        ]);
      } else {
        addChatMessage('Maaf, SafeBot sedang tidak dapat dihubungi. Jika situasi darurat, segera hubungi kontak kampus atau orang terpercaya di sekitarmu.', 'bot');
      }
    }

    input.readOnly = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerText = 'Kirim';
    }
    isWaiting = false;
  }

  window.initChat = function() {
    var input = document.getElementById('chatInput');
    var sendBtn = document.getElementById('chatSendBtn');

    if (!input || !sendBtn) return;

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('chatMessages')) {
      initChat();
    }
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/chat.js
git commit -m "feat: update chat.js for new backend format with action buttons and markdown"
```

---

### Task 6: Update index.html chat page structure

**Covers:** [S4]

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace chat page content**

Replace the current `#page-chat` content with GitHub's structure:

```html
<div id="page-chat" class="page">
  <section class="section card chat-section">
    <div class="card-header">
      <h2>Chat Bersama SafeBot & Ahli</h2>
      <p class="muted">Ceritakan keluh kesahmu dengan aman. SafeBot membantu mengenali risiko dan mengarahkan langkah berikutnya.</p>
    </div>

    <div class="safebot-disclaimer" role="note">
      <strong>Catatan keamanan:</strong> SafeBot adalah pendamping awal, bukan pengganti layanan darurat, konselor, atau keputusan resmi kampus. Jika kamu sedang dalam bahaya langsung, segera hubungi kontak darurat atau orang terpercaya di sekitarmu.
    </div>

    <div class="chat-container">
      <div class="chat-messages" id="chatMessages" aria-live="polite">
        <div class="chat-message bot">Halo. Saya SafeBot. Ruang ini aman dan anonim. Ada yang ingin kamu ceritakan atau keluhkan hari ini?</div>
      </div>
      <div class="chat-input-area">
        <textarea id="chatInput" placeholder="Ceritakan detail kejadiannya di sini... (Enter untuk kirim, Shift + Enter untuk baris baru)" rows="4"></textarea>
        <button class="btn primary" id="chatSendBtn" type="button">Kirim</button>
      </div>
    </div>
  </section>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: update chat page structure with disclaimer and new layout"
```

---

### Task 7: Update style.css with GitHub chat styles

**Covers:** [S4]

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Replace chat styles**

Find and replace the existing chat styles (`.chat-messages` through `@keyframes typing`) with GitHub's more comprehensive styles:

```css
/* --- SafeBot Chat ------------------------------------------ */
.chat-section {
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.safebot-disclaimer {
  margin-top: 16px;
  padding: 12px 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.5;
}

.safebot-disclaimer strong {
  color: #78350f;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 500px;
  margin-top: 20px;
  overflow: hidden;
  background: white;
  border: 1px solid var(--line);
  border-radius: 12px;
}

.chat-messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding: 20px;
  background: #f8fafc;
}

.chat-message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

.chat-message.user {
  align-self: flex-end;
  background: var(--primary);
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-message.bot {
  align-self: flex-start;
  background: white;
  color: var(--ink);
  border: 1px solid var(--line);
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.chat-message p {
  margin: 0 0 10px;
}

.chat-message p:last-child {
  margin-bottom: 0;
}

.chat-message ul,
.chat-message ol {
  margin: 8px 0 10px 18px;
  padding: 0;
}

.chat-message li {
  margin: 4px 0;
}

.chat-message code {
  background: #eef2ff;
  border-radius: 5px;
  color: var(--primary2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
  padding: 1px 5px;
}

.chat-message.typing {
  display: flex;
  gap: 5px;
  align-items: center;
  color: var(--muted);
  font-style: italic;
}

.chat-message.typing span {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.35;
  animation: typingPulse 1.2s infinite ease-in-out;
}

.chat-message.typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.chat-message.typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typingPulse {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-3px); opacity: 0.9; }
}

.chat-message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.chat-message-actions .btn {
  padding: 6px 14px;
  font-size: 12px;
  text-decoration: none;
}

.chat-input-area {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 16px;
  background: white;
  border-top: 1px solid var(--line);
}

.chat-input-area textarea {
  flex: 1;
  width: 100%;
  min-height: 120px;
  padding: 16px;
  resize: vertical;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: none;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  transition: all 0.2s ease;
}

.chat-input-area textarea:focus {
  background: white;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.chat-input-area textarea:disabled,
.chat-input-area textarea.is-readonly {
  cursor: not-allowed;
  opacity: 0.65;
}

.chat-input-area button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.chat-input-area button {
  height: 48px;
  padding: 0 24px;
}
```

- [ ] **Step 2: Add responsive chat styles**

Add to the `@media (max-width: 768px)` section:

```css
  .chat-container {
    height: 560px;
  }
  .chat-input-area {
    flex-direction: column;
    align-items: stretch;
  }
  .chat-input-area button {
    width: 100%;
  }
  .chat-message {
    max-width: 92%;
  }
```

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: update chat styles with GitHub's comprehensive chat UI"
```

---

### Task 8: Install dependencies and verify

**Covers:** [S8]

**Files:** None (verification only)

- [ ] **Step 1: Install server dependencies**

```bash
cd server && npm install
```

- [ ] **Step 2: Verify server files exist**

```bash
dir server\index.js
dir server\risk.js
dir server\mimoClient.js
dir server\package.json
dir server\.env.example
```

- [ ] **Step 3: Verify CSP meta tag**

```bash
findstr "Content-Security-Policy" index.html
```

- [ ] **Step 4: Verify DOM helpers in utils.js**

```bash
findstr "createEl" js/utils.js
findstr "renderMarkdownMessage" js/utils.js
```

- [ ] **Step 5: Verify chat.js uses new format**

```bash
findstr "actions" js/chat.js
findstr "risk" js/chat.js
```

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: merge complete — GitHub backend + local modular frontend"
```
