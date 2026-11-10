// AI GIF Maker API client shared by the service worker, the popup and the options page.
// Endpoints and error mapping follow aigifmaker-pkgs/SPEC.md §2; nothing else is called.

export const BASE = 'https://aigifmaker.ai';
const UTM = 'utm_source=chrome&utm_medium=extension';
export const KEYS_URL = `${BASE}/settings/apikeys?${UTM}`;
export const SITE_URL = `${BASE}/?${UTM}`;
export const PRICING_URL = `${BASE}/pricing?${UTM}`;
export const POLL_MS = 3000;
export const TIMEOUT_MS = 15 * 60 * 1000;

export async function getApiKey() {
  const s = await chrome.storage.local.get('apiKey');
  return String(s.apiKey || '').trim();
}

/** kind: auth | quota | rejected | failed | network | server | api */
export class AigifmakerError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'AigifmakerError';
    this.kind = kind;
  }
}

// Every answer is HTTP 200; the JSON code says what happened.
export function unwrap(status, body) {
  if (!body || typeof body.code !== 'number') {
    throw new AigifmakerError(status >= 500 ? 'server' : 'api', (body && body.message) || `unexpected answer (HTTP ${status})`);
  }
  if (body.code !== 0) {
    const msg = body.message || `request refused (code ${body.code})`;
    if (/invalid api key|no auth/i.test(msg)) throw new AigifmakerError('auth', msg);
    if (/insufficient credits/i.test(msg)) throw new AigifmakerError('quota', `${msg}. Top up at ${BASE}/pricing`);
    if (body.code !== -1) throw new AigifmakerError('rejected', `${msg}. Reword the prompt and try again.`);
    throw new AigifmakerError('api', msg);
  }
  const data = body.data || {};
  if (data.wall === true) throw new AigifmakerError('auth', `An API key is required. Create one at ${BASE}/settings/apikeys`);
  return data;
}

async function post(apiKey, path, payload) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload || {}),
    });
  } catch {
    throw new AigifmakerError('network', 'Could not reach aigifmaker.ai. Check your connection.');
  }
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return unwrap(res.status, body);
}

export async function submit(apiKey, prompt) {
  const d = await post(apiKey, '/api/ai/generate', {
    provider: 'openlux', mediaType: 'image', model: 'gif-maker-v1', scene: 'text-to-image',
    prompt, options: { output_format: 'gif' },
  });
  if (!d.id) throw new AigifmakerError('api', 'aigifmaker.ai returned no task id');
  return String(d.id);
}

export const status = (apiKey, id) => post(apiKey, '/api/ai/query', { taskId: id });

export async function credits(apiKey) {
  const d = await post(apiKey, '/api/user/get-user-credits', {});
  return Number(d.remainingCredits || 0);
}
