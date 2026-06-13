# SafeBot LLM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered SafeBot chat using MiMo LLM with Node.js backend proxy.

**Architecture:** Node.js Express server proxies LLM API calls, keeps API key server-side. Frontend chat UI communicates via `/api/chat` endpoint.

**Tech Stack:** Node.js, Express, dotenv, MiMo LLM API (OpenAI-compatible)

---

## File Structure

```
NEW: server.js          ← Express server + API proxy
NEW: .env               ← MIMO_API_KEY (gitignored)
NEW: package.json       ← dependencies
NEW: js/chat.js         ← chat UI logic
MODIFY: index.html      ← chat page content + script tag
MODIFY: style.css       ← chat UI styles
MODIFY: .gitignore      ← add .env
```

---

### Task 1: Create .env and package.json

**Covers:** [S4]

**Files:**
- Create: `.env`
- Create: `package.json`

- [ ] **Step 1: Create .env**

```
MIMO_API_KEY=sk-xxxxx
PORT=3000
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "safesphere",
  "version": "1.0.0",
  "description": "SafeSphere - Pelaporan Anonim Anti-Perundungan",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "dotenv": "^16.0.0"
  }
}
```

- [ ] **Step 3: Update .gitignore**

Add `.env` to existing `.gitignore`:

```
ftp.txt
.env
.env.*
*.log
node_modules/
```

- [ ] **Step 4: Commit**

```bash
git add .env package.json .gitignore
git commit -m "feat: add env config and package.json for Node.js server"
```

---

### Task 2: Create server.js — Express server with /api/chat

**Covers:** [S4]

**Files:**
- Create: `server.js`

- [ ] **Step 1: Create server.js**

```javascript
require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MIMO_API_KEY;
const API_URL = 'https://api.xiaomimimo.com/v1/chat/completions';

const SYSTEM_PROMPT = `Kamu adalah SafeBot, asisten AI konseling untuk mahasiswa SafeSphere.

Kamu adalah psikolog kampus yang empatik, suportif, dan profesional.

Aturan:
- Dengarkan dengan empati, validasi perasaan korban
- Jangan memberikan diagnosis medis atau resep obat
- Jika pengguna dalam bahaya segera (ancaman bunuh diri/kekerasan fisik), arahkan ke:
  * Satgas PPKS Kampus: 0811-XXXX-XXXX
  * Keamanan/Satpam: 021-XXXX-XXXX
  * Layanan Psikologi: 0822-XXXX-XXXX
- Jika pengguna ingin melapor, arahkan ke halaman #lapor
- Jika ditanya tentang fitur SafeSphere, jelaskan dengan singkat
- Gunakan bahasa Indonesia yang hangat dan mudah dipahami
- Respons maksimal 3-4 kalimat agar tidak overwhelming`;

// Rate limiting (simple in-memory)
const rateLimit = {};
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimit[ip]) {
    rateLimit[ip] = [];
  }
  // Remove old entries
  rateLimit[ip] = rateLimit[ip].filter(t => now - t < RATE_WINDOW);
  if (rateLimit[ip].length >= RATE_LIMIT) {
    return false;
  }
  rateLimit[ip].push(now);
  return true;
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key belum dikonfigurasi di server.' });
  }

  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  // Build messages array
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  // Add history (last 10 messages max for context)
  if (Array.isArray(history)) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    });
  }

  // Add current user message
  messages.push({ role: 'user', content: message.trim() });

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('MiMo API error:', response.status, errorData);
      return res.status(502).json({ error: 'Gagal mendapat respons dari AI. Coba lagi.' });
    }

    const data = await response.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    if (!reply) {
      return res.status(502).json({ error: 'Respons AI kosong.' });
    }

    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error('Chat error:', err.message);
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Permintaan timeout. Coba lagi.' });
    }
    res.status(500).json({ error: 'Koneksi ke AI gagal. Coba lagi.' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SafeSphere server running on http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn('WARNING: MIMO_API_KEY not set in .env');
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: add Node.js Express server with MiMo LLM chat proxy"
```

---

### Task 3: Create js/chat.js — chat UI logic

**Covers:** [S5]

**Files:**
- Create: `js/chat.js`

- [ ] **Step 1: Create js/chat.js**

```javascript
(function() {
  var chatHistory = [];
  var isWaiting = false;

  function addChatMessage(role, content) {
    var container = document.getElementById('chatMessages');
    var div = document.createElement('div');
    div.className = 'chat-message ' + role;

    var avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerText = role === 'bot' ? 'SB' : 'You';

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerText = content;

    div.appendChild(avatar);
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    return bubble;
  }

  function showTyping() {
    var container = document.getElementById('chatMessages');
    var div = document.createElement('div');
    div.className = 'chat-message bot';
    div.id = 'typingIndicator';

    var avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerText = 'SB';

    var typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';

    div.appendChild(avatar);
    div.appendChild(typing);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  async function sendMessage() {
    var input = document.getElementById('chatInput');
    var message = input.value.trim();
    if (!message || isWaiting) return;

    isWaiting = true;
    input.value = '';
    input.style.height = 'auto';

    addChatMessage('user', message);
    chatHistory.push({ role: 'user', content: message });

    showTyping();

    try {
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, history: chatHistory })
      });

      var data = await response.json();

      hideTyping();

      if (data.error) {
        addChatMessage('bot', 'Maaf, terjadi kesalahan: ' + data.error);
      } else {
        addChatMessage('bot', data.reply);
        chatHistory.push({ role: 'assistant', content: data.reply });
      }
    } catch (err) {
      hideTyping();
      addChatMessage('bot', 'Koneksi gagal. Pastikan server berjalan dan coba lagi.');
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
git commit -m "feat: add chat UI module with MiMo LLM integration"
```

---

### Task 4: Update index.html — chat page content and script tag

**Covers:** [S5]

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace chat page content**

Find `<div id="page-chat" class="page">` and replace its inner section with:

```html
<div id="page-chat" class="page">
  <section class="section card">
    <div class="card-header">
      <h2>Chat Bersama Ahli</h2>
      <p class="muted">Konsultasi secara anonim dengan SafeBot — asisten AI konseling berbasis MiMo LLM.</p>
    </div>

    <div id="chatMessages" class="chat-messages">
      <div class="chat-message bot">
        <div class="chat-avatar">SB</div>
        <div class="chat-bubble">Halo! Saya SafeBot, asisten konseling SafeSphere. Ada yang bisa saya bantu hari ini?</div>
      </div>
    </div>

    <div class="chat-input-area">
      <textarea id="chatInput" placeholder="Ketik pesan Anda..." rows="1"></textarea>
      <button id="chatSendBtn" class="btn primary">Kirim</button>
    </div>
  </section>
</div>
```

- [ ] **Step 2: Add chat.js script tag**

In the `<script>` section at the bottom, add `js/chat.js` before `app.js`:

```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/reports.js"></script>
  <script src="js/admin.js"></script>
  <script src="js/edukasi.js"></script>
  <script src="js/a11y.js"></script>
  <script src="js/safety.js"></script>
  <script src="js/chat.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add chat UI to index.html with MiMo LLM integration"
```

---

### Task 5: Update style.css — chat UI styles

**Covers:** [S5]

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Add chat styles before responsive section**

Add these styles before the `@media (max-width: 950px)` rule:

```css
/* --- Chat UI ---------------------------------------------- */
.chat-messages {
  height: 400px;
  overflow-y: auto;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid var(--line);
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-message {
  display: flex;
  gap: 10px;
  max-width: 80%;
}

.chat-message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.chat-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.chat-message.bot .chat-avatar {
  background: var(--primary);
  color: white;
}

.chat-message.user .chat-avatar {
  background: #e0e7ff;
  color: var(--primary);
}

.chat-bubble {
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
}

.chat-message.bot .chat-bubble {
  background: white;
  border: 1px solid var(--line);
  border-top-left-radius: 4px;
}

.chat-message.user .chat-bubble {
  background: var(--primary);
  color: white;
  border-top-right-radius: 4px;
}

.chat-input-area {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input-area textarea {
  flex: 1;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  font: inherit;
  font-size: 14px;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  outline: none;
  background: #f8fafc;
}

.chat-input-area textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.chat-typing {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 16px;
  border-top-left-radius: 4px;
  width: fit-content;
}

.chat-typing span {
  width: 8px;
  height: 8px;
  background: #94a3b8;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.chat-typing span:nth-child(2) { animation-delay: 0.2s; }
.chat-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add chat UI styles with typing animation"
```

---

### Task 6: Install dependencies and test

**Covers:** [S8]

**Files:** None (verification only)

- [ ] **Step 1: Install npm dependencies**

```bash
npm install
```

- [ ] **Step 2: Start server**

```bash
npm start
```

Expected: `SafeSphere server running on http://localhost:3000`

- [ ] **Step 3: Test static serving**

Open `http://localhost:3000` in browser. Expected: SafeSphere homepage loads.

- [ ] **Step 4: Test chat API**

```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":"halo","history":[]}'
```

Expected: JSON response with `reply` field containing MiMo LLM response.

- [ ] **Step 5: Test chat UI**

Open `http://localhost:3000/#chat`, type a message, press Enter. Expected: typing indicator appears, then bot response renders.

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: SafeBot chat with MiMo LLM integration complete"
```
