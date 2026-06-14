const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions?/i,
  /you\s+are\s+now\s+/i,
  /\bsystem\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /<\s*script\b/i,
  /javascript\s*:/i
];

function redactPII(text) {
  if (!text) return text;

  let redacted = String(text);

  redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  redacted = redacted.replace(/(\+?62[\s-]?|0)8[\d\s-]{8,13}/g, '[PHONE]');
  redacted = redacted.replace(/\(\d{2,4}\)[\s-]?\d{3,4}[\s-]?\d{3,4}/g, '[PHONE]');
  redacted = redacted.replace(/\b(20[12]\d{7,10})\b/g, '[NIM]');
  redacted = redacted.replace(/\b\d{16}\b/g, '[NIK]');
  redacted = redacted.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD]');
  redacted = redacted.replace(/\b\d{10,16}\b/g, '[NUMBER]');
  redacted = redacted.replace(
    /\b(?:jalan|jl\.?|jln\.?)\s+[a-z0-9\s.,/-]{3,80}\b/gi,
    '[ALAMAT]'
  );
  redacted = redacted.replace(/\b(?:rt|rw)\s*\.?\s*\d{1,3}\s*[/,]\s*\d{1,3}\b/gi, '[ALAMAT]');

  const namePatterns = [
    /(?:nama\s+(?:saya|aku|ku)\s+(?:adalah\s+)?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/gi,
    /(?:saya|aku)\s+(?:bernama|dipanggil)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/gi,
    /(?:teman\s+saya\s+(?:bernama|adalah)\s+)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/gi
  ];

  for (const pattern of namePatterns) {
    redacted = redacted.replace(pattern, (match, name) => match.replace(name, '[NAMA]'));
  }

  return redacted;
}

function sanitizePromptInjection(text) {
  const normalized = String(text || '');
  const flagged = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!flagged) return normalized;
  return `[FILTERED] ${normalized}`;
}

function prepareMessageForLLM(text) {
  const trimmed = String(text || '').trim();
  const sanitized = sanitizePromptInjection(trimmed);
  return redactPII(sanitized);
}

module.exports = {
  redactPII,
  sanitizePromptInjection,
  prepareMessageForLLM,
  PROMPT_INJECTION_PATTERNS
};