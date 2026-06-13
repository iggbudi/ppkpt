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
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimit[ip]) {
    rateLimit[ip] = [];
  }
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

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (Array.isArray(history)) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(msg => {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    });
  }

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
      signal: AbortSignal.timeout(30000)
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
