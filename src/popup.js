import { getApiKey, credits, SITE_URL, PRICING_URL } from './api.js';

const $ = (id) => document.getElementById(id);
const LABEL = { making: 'Making', ready: 'Ready', failed: 'Failed', timeout: 'Taking long' };

function renderJobs(jobs) {
  const ul = $('jobs');
  ul.textContent = '';
  $('empty').hidden = jobs.length > 0;
  $('clear').hidden = !jobs.some((j) => j.status !== 'making');
  for (const j of jobs) {
    const li = document.createElement('li');
    const p = Object.assign(document.createElement('div'), { className: 'p', textContent: j.prompt, title: j.prompt });
    const meta = Object.assign(document.createElement('div'), { className: 'meta' });
    meta.append(Object.assign(document.createElement('span'), { className: `chip ${j.status}`, textContent: LABEL[j.status] || j.status }));
    meta.append(Object.assign(document.createElement('span'), { className: 'spacer' }));
    if (j.status === 'ready' && j.url) {
      meta.append(Object.assign(document.createElement('a'), { className: 'btn small', href: j.url, target: '_blank', rel: 'noopener', textContent: 'Open GIF' }));
    } else if (j.status === 'timeout' || j.status === 'failed') {
      const b = Object.assign(document.createElement('button'), { className: 'btn ghost small', textContent: 'Check again' });
      b.onclick = () => chrome.runtime.sendMessage({ type: 'recheck', id: j.id });
      meta.append(b);
    }
    li.append(p, meta);
    if (j.status === 'ready' && j.url) li.append(Object.assign(document.createElement('img'), { src: j.url, alt: j.prompt }));
    if (j.error) li.append(Object.assign(document.createElement('div'), { className: 'err', textContent: j.error }));
    ul.append(li);
  }
}

async function init() {
  const key = await getApiKey();
  $('nokey').hidden = !!key;
  $('go').disabled = !key;
  if (key) {
    credits(key)
      .then((n) => { $('credits').textContent = ''; $('credits').append('Credits', document.createElement('br'), Object.assign(document.createElement('b'), { textContent: String(n) })); })
      .catch((e) => { $('credits').textContent = e.kind === 'auth' ? 'Key not valid' : ''; });
  }
  const { jobs = [] } = await chrome.storage.local.get('jobs');
  renderJobs(jobs);
}

$('go').addEventListener('click', async () => {
  const prompt = $('prompt').value.trim();
  const msg = $('msg');
  if (!prompt) { msg.className = 'msg bad'; msg.textContent = 'Write what the GIF should show first.'; return; }
  $('go').disabled = true;
  msg.className = 'msg';
  msg.textContent = 'Sending…';
  const r = await chrome.runtime.sendMessage({ type: 'generate', prompt });
  $('go').disabled = false;
  if (r && r.ok) { msg.className = 'msg ok'; msg.textContent = 'Started. Usually about a minute; you will get a notification.'; $('prompt').value = ''; }
  else { msg.className = 'msg bad'; msg.textContent = (r && r.error) || 'Could not reach aigifmaker.ai.'; }
});
$('clear').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'clear' }));
$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('settings').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
$('site').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: SITE_URL }); });
$('pricing').addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: PRICING_URL }); });
chrome.storage.onChanged.addListener((c) => { if (c.jobs) renderJobs(c.jobs.newValue || []); });
init();
