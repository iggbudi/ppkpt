# SafeBot Chat with MiMo LLM — Design Spec

## [S1] Problem

SafeBot chat feature was planned (wiki.md) but never implemented. The `triggerDictionary` and `getRiskScore()` in `safety.js` provide basic keyword detection, but the chat UI and LLM integration are missing. Users need an empathetic AI counselor they can talk to about bullying, not just a keyword-responder.

## [S2] Solution Overview

Integrate MiMo LLM (OpenAI-compatible API at `https://api.xiaomimimo.com/v1`) into SafeBot chat. Add Node.js Express server as API proxy to keep API key secure. Create chat UI in `#page-chat`.

### Architecture

```
Browser (index.html + js/)
    ↓ POST /api/chat { message, history }
Node.js Server (server.js)
    ↓ Adds system prompt + history
    ↓ Calls MiMo API (https://api.xiaomimimo.com/v1/chat/completions)
MiMo LLM
    ↓ Returns response
Node.js Server → Browser
    ↓ Renders in chat UI
```

## [S3] System Prompt

SafeBot persona: empathetic campus counselor who also knows SafeSphere features.

```
Kamu adalah SafeBot, asisten AI konseling untuk mahasiswa SafeSphere.

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
- Respons maksimal 3-4 kalimat agar tidak overwhelming
```

## [S4] Node.js Server

### Files

- `server.js` — Express server
- `.env` — API key (gitignored)
- `package.json` — dependencies (express, dotenv, node-fetch or built-in fetch)

### server.js behavior

1. Load `.env` via dotenv
2. Serve static files from project root
3. `POST /api/chat` endpoint:
   - Accept `{ message: string, history: Array<{role: string, content: string}> }`
   - Validate message is non-empty string
   - Build messages array: system prompt + history + user message
   - Call MiMo API: `POST https://api.xiaomimimo.com/v1/chat/completions`
     - Headers: `Authorization: Bearer <API_KEY>`, `Content-Type: application/json`
     - Body: `{ model: "mimo-v2.5", messages: [...], max_tokens: 500, temperature: 0.7 }`
   - Return `{ reply: string }` or `{ error: string }`
4. Port: 3000 (configurable via PORT env var)

### .env format

```
MIMO_API_KEY=sk-xxxxx
PORT=3000
```

### package.json

```json
{
  "name": "safesphere",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "dotenv": "^16.0.0"
  }
}
```

Note: Node.js 18+ has built-in `fetch`, so no need for node-fetch.

## [S5] Frontend Chat UI

### HTML changes (index.html `#page-chat`)

Replace current placeholder content with:

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

### CSS additions (style.css)

```css
/* Chat UI */
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

### JS changes (js/chat.js — new module)

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

## [S6] Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Create `.env` with API key | `.env` |
| 2 | Create `package.json` | `package.json` |
| 3 | Create `server.js` — Express server with `/api/chat` | `server.js` |
| 4 | Create `js/chat.js` — chat UI logic | `js/chat.js` |
| 5 | Update `index.html` — replace chat page content, add script tag | `index.html` |
| 6 | Update `style.css` — add chat UI styles | `style.css` |
| 7 | Update `.gitignore` — add `.env` | `.gitignore` |
| 8 | Test manually | — |

## [S7] Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| MiMo API rate limit | Add simple in-memory rate limit (10 req/min per IP) |
| API key leaked to client | Key only in server.js, never sent to browser |
| Long response time | 30s timeout, show typing indicator |
| Model hallucination about safety | System prompt emphasizes redirect to real services |

## [S8] Success Criteria

- [ ] Node.js server starts on port 3000
- [ ] `GET /` serves index.html
- [ ] `POST /api/chat` returns MiMo LLM response
- [ ] Chat UI renders messages correctly
- [ ] Enter sends message, Shift+Enter newline
- [ ] Typing indicator shows while waiting
- [ ] Error messages display on failure
- [ ] API key not exposed to client
- [ ] `.env` gitignored
