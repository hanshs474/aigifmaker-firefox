import { getApiKey, credits, KEYS_URL, BASE } from './api.js';

const $ = (id) => document.getElementById(id);
const utm = '?utm_source=chrome&utm_medium=extension';

async function checkKey(key) {
  const m = $('keymsg');
  if (!key) { m.className = 'msg bad'; m.textContent = 'Paste a key first.'; return; }
  m.className = 'msg';
  m.textContent = 'Checking…';
  try {
    const n = await credits(key);
    m.className = 'msg ok';
    m.textContent = `Connected. ${n} credits left on this account.`;
  } catch (e) {
    m.className = 'msg bad';
    m.textContent = e.message;
  }
}

async function init() {
  const key = await getApiKey();
  $('key').value = key;
  $('getkey').href = KEYS_URL;
  if (key) checkKey(key);
}

$('save').addEventListener('click', async () => {
  const key = $('key').value.trim();
  await chrome.storage.local.set({ apiKey: key });
  checkKey(key);
});
$('toggle').addEventListener('click', () => {
  const k = $('key');
  k.type = k.type === 'password' ? 'text' : 'password';
  $('toggle').textContent = k.type === 'password' ? 'Show' : 'Hide';
});
const open = (path) => (e) => { e.preventDefault(); chrome.tabs.create({ url: BASE + path + utm }); };
$('site').addEventListener('click', open('/'));
$('pricing').addEventListener('click', open('/pricing'));
$('privacy').addEventListener('click', open('/privacy-policy'));
init();
