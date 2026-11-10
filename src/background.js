// Service worker: context menu -> submit to AI GIF Maker -> poll -> notify with the GIF link.
// Jobs live in chrome.storage.local so a restarted worker (MV3 kills idle workers) picks them up again;
// a 30-second alarm wakes the worker while anything is still being made.

import { getApiKey, submit, status, POLL_MS, TIMEOUT_MS, SITE_URL } from './api.js';

const ALARM = 'aigif-poll';
const MAX_JOBS = 20;
const ICON = 'icons/icon128.png';

let lock = Promise.resolve();
function withJobs(fn) {
  const run = lock.then(async () => {
    const { jobs = [] } = await chrome.storage.local.get('jobs');
    const out = await fn(jobs);
    await chrome.storage.local.set({ jobs: jobs.slice(0, MAX_JOBS) });
    return out;
  });
  lock = run.catch(() => {});
  return run;
}
const readJobs = async () => (await chrome.storage.local.get('jobs')).jobs || [];
const patchJob = (id, patch) => withJobs((jobs) => { const j = jobs.find((x) => x.id === id); if (j) Object.assign(j, patch); });

async function updateBadge() {
  const n = (await readJobs()).filter((j) => j.status === 'making').length;
  await chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
}

const notify = (id, title, message) =>
  chrome.notifications.create(id, { type: 'basic', iconUrl: ICON, title, message, priority: 1 });
const short = (s, n = 60) => (s.length > n ? s.slice(0, n) + '…' : s);

async function startJob(prompt) {
  prompt = String(prompt || '').trim();
  if (!prompt) return { ok: false, error: 'Write what the GIF should show first.' };
  const apiKey = await getApiKey();
  if (!apiKey) {
    notify('aigif-nokey', 'AI GIF Maker needs your API key', 'Paste it on the settings page to start making GIFs.');
    chrome.runtime.openOptionsPage();
    return { ok: false, error: 'Set your API key first.', kind: 'auth' };
  }
  try {
    const id = await submit(apiKey, prompt);
    await withJobs((jobs) => { jobs.unshift({ id, prompt, status: 'making', url: null, error: null, createdAt: Date.now() }); });
    notify(`aigif-start-${id}`, 'Making your GIF', short(prompt));
    await updateBadge();
    ensurePolling();
    return { ok: true, id };
  } catch (e) {
    notify(`aigif-err-${Date.now()}`, 'GIF not made', e.message);
    if (e.kind === 'auth') chrome.runtime.openOptionsPage();
    return { ok: false, error: e.message, kind: e.kind };
  }
}

let loop = null;
function ensurePolling() {
  if (!loop) loop = pollLoop().finally(() => { loop = null; });
  return loop;
}

async function checkOne(job, apiKey) {
  if (Date.now() - job.createdAt > TIMEOUT_MS) {
    await patchJob(job.id, { status: 'timeout' });
    notify(`aigif-timeout-${job.id}`, 'Still not finished', 'It may still land in your history on aigifmaker.ai.');
    return;
  }
  let s;
  try {
    s = await status(apiKey, job.id);
  } catch (e) {
    if (e.kind === 'network' || e.kind === 'server') return; // a dropped poll is not a failed GIF
    await patchJob(job.id, { status: 'failed', error: e.message });
    notify(`aigif-err-${job.id}`, 'GIF not made', e.message);
    return;
  }
  if (s.status === 'success' && s.images && s.images[0]) {
    await patchJob(job.id, { status: 'ready', url: s.images[0] });
    notify(`aigif-done-${job.id}`, 'Your GIF is ready', `Click to open: ${short(job.prompt, 40)}`);
  } else if (s.status === 'failed' || s.status === 'canceled') {
    const msg = s.errorMessage || `the GIF ${s.status}`;
    await patchJob(job.id, { status: 'failed', error: msg });
    notify(`aigif-fail-${job.id}`, 'GIF not made', msg);
  }
}

async function pollLoop() {
  await chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
  for (;;) {
    const pending = (await readJobs()).filter((j) => j.status === 'making');
    if (!pending.length) break;
    const apiKey = await getApiKey();
    for (const job of pending) await checkOne(job, apiKey);
    await updateBadge();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await chrome.alarms.clear(ALARM);
  await updateBadge();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'gen', title: 'Make a GIF of "%s"', contexts: ['selection'] });
  });
  if (details.reason === 'install' && !(await getApiKey())) chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'gen') startJob(info.selectionText);
});

chrome.notifications.onClicked.addListener(async (nid) => {
  chrome.notifications.clear(nid);
  if (nid === 'aigif-nokey') return chrome.runtime.openOptionsPage();
  const m = nid.match(/^aigif-(?:done|start|fail|timeout|err)-(.+)$/);
  const job = m && (await readJobs()).find((j) => j.id === m[1]);
  if (job && job.url) chrome.tabs.create({ url: job.url });
  else if (!job) chrome.tabs.create({ url: SITE_URL });
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) ensurePolling(); });
chrome.runtime.onStartup.addListener(() => { ensurePolling(); });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'generate') { startJob(msg.prompt).then(sendResponse); return true; }
  if (msg && msg.type === 'recheck') {
    patchJob(msg.id, { status: 'making', error: null, createdAt: Date.now() })
      .then(updateBadge).then(() => { ensurePolling(); sendResponse({ ok: true }); });
    return true;
  }
  if (msg && msg.type === 'clear') {
    withJobs((jobs) => { jobs.splice(0, jobs.length, ...jobs.filter((j) => j.status === 'making')); })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
