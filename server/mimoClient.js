const DEFAULT_TIMEOUT_MS = 20000;

const systemPrompt = `Kamu adalah SafeBot, asisten awal SafeSphere untuk isu perundungan di lingkungan kampus.

Aturan:
- Jawab dalam Bahasa Indonesia.
- Nada harus empatik, tenang, dan tidak menghakimi.
- Jangan membuat diagnosis medis, hukum, atau janji penyelesaian.
- Jangan meminta detail eksplisit yang tidak perlu.
- Jika pengguna tampak mengalami perundungan, sarankan menyimpan bukti dan membuat laporan.
- Jika ada ancaman keselamatan, arahkan ke kontak darurat dan laporan resmi.
- Jawaban maksimal 2 paragraf pendek atau 5 bullet ringkas.
- Hindari pembuka panjang dan jangan mengulang disclaimer umum kecuali relevan.`;

function buildEndpoint(baseUrl) {
  const trimmed = String(baseUrl || '').replace(/\/+$/, '');
  if (!trimmed) throw new Error('MIMO_BASE_URL is required');
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

function trimReplyLength(reply, maxLength = 1200) {
  const normalized = String(reply || '').trim();
  if (normalized.length <= maxLength) return normalized;

  const sliced = normalized.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  const safeSlice = lastSpace > Math.floor(maxLength * 0.8) ? sliced.slice(0, lastSpace) : sliced;
  return `${safeSlice.trim()}…`;
}

function extractReply(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return trimReplyLength(content);

  const text = payload?.choices?.[0]?.text;
  if (typeof text === 'string' && text.trim()) return trimReplyLength(text);

  const direct = payload?.reply || payload?.message || payload?.content;
  if (typeof direct === 'string' && direct.trim()) return trimReplyLength(direct);

  throw new Error('MiMo response did not include a text reply');
}

async function callMimoChat({ message, user = null, risk = null }) {
  const apiKey = process.env.MIMO_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL;
  const model = process.env.MIMO_MODEL || 'mimo-v2.5';
  const timeoutMs = Number(process.env.MIMO_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  if (!apiKey) throw new Error('MIMO_API_KEY is required');

  const userContext = user?.name
    ? `Konteks pengguna: nama ${user.name}, role ${user.role || 'tidak diketahui'}.`
    : 'Konteks pengguna: belum login atau anonim.';
  const riskContext = risk?.level === 'medium'
    ? 'Risk classifier mendeteksi risiko sedang. Sarankan pengguna menyimpan bukti dan mempertimbangkan laporan anonim.'
    : `Risk classifier: ${risk?.level || 'low'}.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(buildEndpoint(baseUrl), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'system', content: `${userContext}\n${riskContext}` },
          { role: 'user', content: String(message) }
        ],
        temperature: 0.35,
        max_tokens: 320
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      await response.text().catch(() => '');
      throw new Error(`MiMo API request failed with status ${response.status}`);
    }

    return extractReply(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { callMimoChat };
