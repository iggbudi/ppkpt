const SENSITIVE_KEYS = new Set([
  'message',
  'password',
  'token',
  'authorization',
  'session',
  'description',
  'content',
  'apikey',
  'secret'
]);

function redactValue(key, value) {
  if (value == null) return value;
  const normalizedKey = String(key).toLowerCase();
  if (SENSITIVE_KEYS.has(normalizedKey)) return '[REDACTED]';
  if (typeof value === 'string' && value.length > 500) return `[REDACTED:${value.length}chars]`;
  return value;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const output = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = sanitizeMeta(value);
    } else if (Array.isArray(value)) {
      output[key] = value.map((item, index) => redactValue(`${key}.${index}`, item));
    } else {
      output[key] = redactValue(key, value);
    }
  }
  return output;
}

function log(level, event, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitizeMeta(meta)
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  log,
  sanitizeMeta,
  redactValue
};