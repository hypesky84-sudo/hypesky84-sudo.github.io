// Control Center: the side menu, the home screen, and switching between apps.
// Each app opens in its own frame and keeps running when you switch away,
// so Mailroom's new-mail sounds and alerts keep working while you use another app.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-6h4v6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l3 3.5V16h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4"/><path d="M14.5 10h4M14.5 13.5h3"/>',
  app: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.app}</svg>`;

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'X-Control-Center': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}

let APPS = [];
const frames = new Map(); // app id -> iframe
let current = 'home';
const counts = { mail: { n: 0, urgent: 0 }, compliance: { n: 0 } };

// ---------- side menu ----------

function renderNav() {
  $('#nav').innerHTML = [{ id: 'home', name: 'Home', icon: 'home' }, ...APPS].map((a) => `
    <li><a href="#${a.id}" data-app="${a.id}"><span class="tile">${icon(a.icon)}</span><span class="label">${esc(a.name)}</span><span class="count" id="count-${a.id}" hidden></span></a></li>`).join('');
  markCurrent();
}

function markCurrent() {
  document.querySelectorAll('.nav a[data-app]').forEach((a) => {
    if (a.dataset.app === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function setCount(id, n, kind = '') {
  const el = $(`#count-${id}`);
  if (!el) return;
  el.hidden = !n;
  el.textContent = n > 99 ? '99+' : String(n || '');
  el.className = `count${kind ? ` ${kind}` : ''}`;
}

// ---------- switching apps ----------

function frameFor(a, search = '') {
  let f = frames.get(a.id);
  if (!f) {
    f = document.createElement('iframe');
    f.title = a.name;
    f.src = a.path + search;
    f.hidden = true;
    $('#stage').append(f);
    frames.set(a.id, f);
  } else if (search) {
    f.src = a.path + search;
  }
  return f;
}

function show(id, search = '') {
  const a = APPS.find((x) => x.id === id);
  const before = current;
  current = a ? id : 'home';
  $('#home').hidden = current !== 'home';
  for (const [fid, f] of frames) f.hidden = fid !== current;
  if (a) {
    const f = frameFor(a, search);
    f.hidden = false;
    try { f.contentWindow.focus(); } catch { /* not loaded yet */ }
    // Coming back to an app: let it bring itself up to date.
    if (before !== current) tell(f, 'shown');
  } else {
    loadSummaries();
  }
  if (location.hash.slice(1) !== current) history.replaceState(null, '', `${location.pathname}#${current}`);
  markCurrent();
  updateTitle();
}

window.addEventListener('hashchange', () => show(location.hash.slice(1) || 'home'));
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-app]');
  if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  show(link.dataset.app, link.dataset.search || '');
});
// An email account on the home screen: open Mailroom showing that account's inbox.
function openAccount(email) {
  const f = frames.get('mail');
  let ready = false;
  try { ready = f?.contentDocument?.readyState === 'complete'; } catch { /* not ready */ }
  if (ready) {
    show('mail');
    tell(f, 'account', { email });
  } else {
    // After "#", so the address never leaves this device (it isn't sent to any server).
    show('mail', `#account=${encodeURIComponent(email)}`);
  }
}
document.addEventListener('click', (e) => {
  const row = e.target.closest('#home [data-account]');
  if (row) openAccount(row.dataset.account);
});
document.addEventListener('keydown', (e) => {
  const row = e.target.closest?.('#home [data-account]');
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAccount(row.dataset.account); }
});
// An app can ask to be shown (for example when you click a Mailroom pop-up).
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.cc !== 'show') return;
  window.focus();
  show(e.data.app);
});

// ---------- the browser tab title and Mailroom's badge ----------
// Mailroom already puts the unread count (and important-email warnings) in its own title.

function readMailTitle() {
  const f = frames.get('mail');
  let t = '';
  try { t = f?.contentDocument?.title || ''; } catch { /* not ready */ }
  const urgent = t.match(/IMPORTANT EMAIL \((\d+)\)/);
  if (urgent) counts.mail.urgent = Number(urgent[1]);
  else if (/^\(\d+\) Mailroom$|^Mailroom$/.test(t)) {
    counts.mail.urgent = 0;
    counts.mail.n = Number((t.match(/^\((\d+)\)/) || [])[1] || 0);
  }
  if (counts.mail.urgent) setCount('mail', counts.mail.urgent, 'urgent');
  else setCount('mail', counts.mail.n);
  updateTitle();
}

let flip = false;
function updateTitle() {
  const name = current === 'home' ? 'Control Center' : `${APPS.find((a) => a.id === current)?.name} · Control Center`;
  if (counts.mail.urgent) {
    flip = !flip;
    document.title = flip ? `🔴 IMPORTANT EMAIL (${counts.mail.urgent})` : name;
  } else {
    document.title = counts.mail.n ? `(${counts.mail.n}) ${name}` : name;
  }
}

// ---------- home screen ----------

function greet() {
  const h = new Date().getHours();
  $('#homeTitle').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#today').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function cardShell(a, inner, foot = '') {
  return `<article class="card" id="card-${a.id}">
    <div class="card-head">
      <div class="card-icon">${icon(a.icon)}</div>
      <div class="grow"><h2>${esc(a.name)}</h2><p>${esc(a.description || '')}</p></div>
    </div>
    <div class="card-body">${inner}</div>
    <div class="card-foot"><a class="btn primary" href="#${a.id}" data-app="${a.id}">Open ${esc(a.name)}</a>${foot}</div>
  </article>`;
}

const RENDER = {
  mail(a, s) {
    if (!s.connected) {
      return cardShell(a, '<p class="empty">No email accounts connected yet. Open Mailroom to connect Gmail or Outlook.</p>');
    }
    counts.mail.n = s.unread;
    const important = s.important.length ? `<div class="callout bad"><b>Important email (${s.important.length})</b><ul>${s.important.slice(0, 5).map((x) =>
      `<li><span class="who">${esc(x.from)}</span> — ${esc(x.subject)}</li>`).join('')}</ul></div>` : '';
    const reconnect = s.reconnect.length ? `<div class="callout warn"><b>Needs to be reconnected</b>${s.reconnect.map(esc).join(', ')}</div>` : '';
    // Each account opens Mailroom on that account's inbox.
    const rows = s.accounts.map((x) => `<li class="link" role="link" tabindex="0" data-account="${esc(x.email)}" title="Open ${esc(x.email)} in Mailroom"><span class="dot" style="background:${esc(x.color || '#888')}"></span>
      <span class="who">${esc(x.name || x.email)}${x.name ? `<span class="sub">${esc(x.email)}</span>` : ''}</span>
      <span class="num${x.unread ? '' : ' zero'}">${x.error ? '—' : x.unread ? `${x.unread} unread` : 'All read'}</span></li>`).join('');
    return cardShell(a, `${important}${reconnect}
      <div class="big"><b>${s.unread}</b><span>unread in your inbox${s.accounts.length > 1 ? 'es' : ''}</span></div>
      <ul class="rows">${rows}</ul>`);
  },

  compliance(a, s) {
    const check = `<button class="btn" type="button" data-action="compliance:check"${s.running ? ' disabled' : ''}>${s.running ? 'Checking…' : 'Check now'}</button>`;
    const err = s.error ? `<div class="callout warn">${esc(s.error)}</div>` : '';
    if (!s.checkedAt) {
      return cardShell(a, `${err}<p class="empty">${s.running ? `Checking ${s.total} carriers with FMCSA… this takes about a minute.` : `${s.total} carriers saved. They haven’t been checked yet.`}</p>`, check);
    }
    counts.compliance.n = s.issues.length;
    const good = !s.issues.length;
    const issues = s.issues.length ? `<ul class="rows">${s.issues.map((x) => `<li><span class="who">${esc(x.name)}
      <span class="chips">${x.problems.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</span></span></li>`).join('')}</ul>` : '';
    const soon = s.cancelSoon.length ? `<div class="callout warn"><b>Insurance cancelling within 30 days</b><ul>${s.cancelSoon.map((x) =>
      `<li><span class="who">${esc(x.name)}</span> — ${esc(x.date)} (${x.days} days)</li>`).join('')}</ul></div>` : '';
    return cardShell(a, `
      <div class="big ${good ? 'ok' : 'bad'}"><b>${good ? s.ok : s.issues.length}</b><span>${good ? `of ${s.total} carriers all clear` : `of ${s.total} carriers need attention`}</span></div>
      ${err}${soon}${issues}
      <p class="muted small">Last checked ${esc(ago(s.checkedAt))} · checks by itself twice a day</p>`, check);
  },

  mvr(a, s) {
    if (!s.ready) return cardShell(a, '<p class="empty">One-time setup needed: open Driver MVRs and add your Anthropic API key.</p>');
    if (!s.drivers) return cardShell(a, '<p class="empty">No MVRs yet. Open Driver MVRs and drop a driver’s MVR in to get a summary.</p>');
    const rows = s.recent.map((r) => {
      const bad = r.statusOk === false || r.high;
      const what = r.statusOk === false ? `License ${r.status || 'not valid'}` : r.high ? `${r.high} serious item${r.high === 1 ? '' : 's'}` : r.medium ? `${r.medium} to review` : 'Clean';
      return `<li><a class="who" href="#mvr" data-app="mvr" data-search="?driver=${encodeURIComponent(r.folder)}" style="color:inherit;text-decoration:none">${esc(r.name || r.folder)}<span class="sub">${esc(new Date(r.uploadedAt).toLocaleDateString())}</span></a>
        <span class="chip${bad ? '' : ' warn'}" style="${bad ? '' : r.medium ? '' : 'background:var(--ok-soft);color:var(--ok)'}">${esc(what)}</span></li>`;
    }).join('');
    return cardShell(a, `<div class="big"><b>${s.drivers}</b><span>driver${s.drivers === 1 ? '' : 's'} on file</span></div><ul class="rows">${rows}</ul>`);
  },
};

// Any app added later gets a simple card until it has its own.
function renderGeneric(a, s) {
  return cardShell(a, s?.headline ? `<p class="empty">${esc(s.headline)}</p>` : '');
}

async function loadSummary(a) {
  const el = $(`#card-${a.id}`);
  try {
    const s = await api('GET', `/hub/api/summary/${a.id}`);
    const html = (RENDER[a.id] || renderGeneric)(a, s);
    if (el) el.outerHTML = html; else $('#cards').insertAdjacentHTML('beforeend', html);
    if (a.id === 'compliance') setCount('compliance', counts.compliance.n, counts.compliance.n ? 'alert' : '');
    if (a.id === 'mail' && !frames.get('mail')?.contentDocument?.title) setCount('mail', counts.mail.n);
    if (a.id === 'compliance' && s.running) setTimeout(() => loadSummary(a), 5000);
  } catch (e) {
    const html = cardShell(a, `<p class="empty">Couldn’t load: ${esc(e.message)}</p>`);
    if (el) el.outerHTML = html; else $('#cards').insertAdjacentHTML('beforeend', html);
  }
}

function loadSummaries() {
  greet();
  if (!$('#cards').children.length) {
    $('#cards').innerHTML = APPS.map((a) => cardShell(a, '<p class="loading">Loading…</p>')).join('');
  }
  APPS.forEach(loadSummary);
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const [id, action] = b.dataset.action.split(':');
  b.disabled = true;
  b.textContent = 'Checking…';
  // Show "Checking…" on the card while it runs, then the results.
  const a = APPS.find((x) => x.id === id);
  api('POST', `/hub/api/action/${id}/${action}`).catch(() => {}).finally(() => {
    loadSummary(a);
    const f = frames.get(id); // the open app shows the new results too
    if (f) f.src = f.src;
  });
  setTimeout(() => loadSummary(a), 800);
});

$('#refreshAll').addEventListener('click', loadSummaries);

// ---------- making the menu smaller, or resizing it ----------
// Remembered in this browser (per computer).
const pref = {
  get: (k, d) => { try { const v = localStorage.getItem(`cc.${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`cc.${k}`, JSON.stringify(v)); } catch { /* private window */ } },
};
const shell = $('.shell');
const RAIL_MIN = 170;
const RAIL_MAX = 380;

function applyRail() {
  const w = pref.get('railWidth', null);
  if (w) shell.style.setProperty('--rail-w', `${w}px`); else shell.style.removeProperty('--rail-w');
  const small = pref.get('railCollapsed', false);
  shell.classList.toggle('collapsed', small);
  const btn = $('#collapseBtn');
  const label = small ? 'Show labels' : 'Hide labels';
  btn.title = small ? 'Make the menu bigger' : 'Make the menu smaller';
  btn.setAttribute('aria-label', btn.title);
  btn.querySelector('.label').textContent = label;
  document.querySelectorAll('.nav a[data-app]').forEach((a) => { a.title = small ? a.querySelector('.label')?.textContent || '' : ''; });
}

$('#collapseBtn').addEventListener('click', () => { pref.set('railCollapsed', !pref.get('railCollapsed', false)); applyRail(); });

const handle = $('#railResize');
handle.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handle.setPointerCapture(e.pointerId); // keeps the drag working even over an app's page
  handle.classList.add('dragging');
  shell.classList.add('resizing');
  const move = (ev) => {
    const w = Math.round(Math.min(RAIL_MAX, Math.max(RAIL_MIN, ev.clientX)));
    shell.style.setProperty('--rail-w', `${w}px`);
  };
  const up = (ev) => {
    handle.releasePointerCapture(ev.pointerId);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.classList.remove('dragging');
    shell.classList.remove('resizing');
    pref.set('railWidth', parseInt(getComputedStyle(shell).getPropertyValue('--rail-w'), 10) || null);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
});
handle.addEventListener('dblclick', () => { pref.set('railWidth', null); applyRail(); });

// ---------- live updates ----------
// One connection to Control Center brings news ("compliance check finished", "new mail",
// "Control Center restarted"). The home screen updates itself and passes the news on to
// the apps, so nothing waits for you to refresh the browser.

function tell(frame, type, data = {}) {
  try { frame.contentWindow.postMessage({ cc: 'event', type, data }, location.origin); } catch { /* not loaded */ }
}
const tellAll = (type, data) => { for (const f of frames.values()) tell(f, type, data); };

function banner(id, html, kind = '') {
  let el = document.getElementById(id);
  if (!html) { el?.remove(); return null; }
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = `cc-banner ${kind}`;
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.innerHTML = html;
  return el;
}

// Reloads everything, first letting Mailroom save a message you're writing to Drafts.
async function reloadAll() {
  for (const f of frames.values()) {
    try { await Promise.race([f.contentWindow.ccBeforeReload?.(), new Promise((r) => setTimeout(r, 4000))]); } catch { /* fine */ }
  }
  location.reload();
}

async function restartNow(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Restarting…'; }
  for (const f of frames.values()) {
    try { await Promise.race([f.contentWindow.ccBeforeReload?.(), new Promise((r) => setTimeout(r, 4000))]); } catch { /* fine */ }
  }
  try { await api('POST', '/hub/api/restart'); } catch { /* it may already be going down */ }
  // The page reloads by itself when Control Center is back (see "hello" below).
}

let bootId = null;
let pagesVersion = null;
let downSince = 0;
function connectEvents() {
  const es = new EventSource('/hub/api/events');
  es.addEventListener('hello', (e) => {
    const d = JSON.parse(e.data);
    if (downSince) { downSince = 0; banner('cc-down', null); }
    // Control Center was restarted (maybe with an update): reload to get the newest pages.
    if (bootId && d.bootId !== bootId) { reloadAll(); return; }
    bootId = d.bootId;
    pagesVersion = d.pagesVersion;
    if (d.restartNeeded) showRestartNeeded();
  });
  es.addEventListener('restart-needed', showRestartNeeded);
  es.addEventListener('pages-updated', (e) => {
    const d = JSON.parse(e.data);
    if (d.pagesVersion === pagesVersion) return;
    pagesVersion = d.pagesVersion;
    const b = banner('cc-update', 'Control Center’s pages were updated. <button type="button" class="btn small primary">Reload now</button>', 'info');
    b.querySelector('button').onclick = reloadAll;
  });
  es.addEventListener('compliance', (e) => {
    const d = JSON.parse(e.data);
    const c = APPS.find((a) => a.id === 'compliance');
    if (c) loadSummary(c);
    tellAll('compliance', d);
  });
  es.addEventListener('mail', (e) => {
    tell(frames.get('mail'), 'mail', JSON.parse(e.data));
    const m = APPS.find((a) => a.id === 'mail');
    if (m && current === 'home') loadSummary(m);
  });
  es.addEventListener('mvr', (e) => {
    tell(frames.get('mvr'), 'mvr', JSON.parse(e.data));
    const v = APPS.find((a) => a.id === 'mvr');
    if (v) loadSummary(v);
  });
  es.onerror = () => {
    // The browser keeps trying to reconnect by itself every few seconds.
    if (!downSince) downSince = Date.now();
    setTimeout(() => {
      if (downSince && Date.now() - downSince > 8000) {
        banner('cc-down', '<b>Control Center isn’t running.</b> Start it with <b>Open Control Center.vbs</b>. This page reconnects by itself.', 'bad');
      }
    }, 9000);
  };
}

function showRestartNeeded() {
  const b = banner('cc-restart', 'An update for Control Center is ready. <button type="button" class="btn small primary">Restart now</button>', 'info');
  b.querySelector('button').onclick = (e) => restartNow(e.currentTarget);
}

// ---------- start ----------

async function init() {
  try {
    APPS = await api('GET', '/hub/api/apps');
  } catch {
    $('#cards').innerHTML = '<p class="empty">Couldn’t reach Control Center online. Check the internet connection, then reload this page.</p>';
    return;
  }
  renderNav();
  applyRail();

  // Coming back from signing in to Google or Microsoft: /?app=mail&connected=...
  const params = new URLSearchParams(location.search);
  const fromSignIn = params.get('app');
  params.delete('app');
  const rest = params.toString();
  if (location.search) history.replaceState(null, '', location.pathname);

  // Mailroom always loads in the background so new-mail sounds and alerts work everywhere.
  const mail = APPS.find((a) => a.id === 'mail');
  if (mail) frameFor(mail, fromSignIn === 'mail' && rest ? `?${rest}` : '');

  show(fromSignIn || location.hash.slice(1) || 'home');

  window.ccPoll?.(loadSummary, () => APPS);
  setInterval(readMailTitle, 1000);
  setInterval(() => { if (current === 'home') loadSummaries(); }, 3 * 60_000);
  setInterval(() => { const c = APPS.find((a) => a.id === 'compliance'); if (c && current !== 'home') loadSummary(c); }, 15 * 60_000);
  // Coming back to the browser tab after a while: bring the screen up to date.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (current === 'home') loadSummaries();
    else { const f = frames.get(current); if (f) tell(f, 'shown'); }
  });
  if (current !== 'home') APPS.forEach(loadSummary); // fill the badges
}

window.ccAuthReady.then(init);
