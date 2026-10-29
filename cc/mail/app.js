// Mailroom: the page you see in your browser (inside Control Center, at /mail/).
// It talks only to the small Control Center server running on this computer.

// Must match MAILROOM_VERSION in apps/mailroom/index.js. When they differ, the black
// Control Center window is still running an older copy of the program and needs restarting.
const APP_VERSION = '2.17.0';

// ---------- tiny helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const keyOf = (m) => `${m.accountId}|${m.id}`;
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`mailroom.${k}`)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`mailroom.${k}`, JSON.stringify(v)); } catch { /* storage off */ } },
};

const ICONS = {
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  draft: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
  spam: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  reply: '<path d="M10 8L5 12l5 4"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>',
  replyAll: '<path d="M8 8l-5 4 5 4"/><path d="M12 8l-5 4 5 4"/><path d="M7 12h8a5 5 0 0 1 5 5v1"/>',
  forward: '<path d="M14 8l5 4-5 4"/><path d="M19 12h-9a5 5 0 0 0-5 5v1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  mailOpen: '<path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 10l9 6 9-6"/>',
  clip: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.4 17.3a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 21v-5h-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  folderOpen: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"/><path d="M3 7v11a2 2 0 0 0 2 2h13.5a2 2 0 0 0 1.9-1.4L22 12H7.5a2 2 0 0 0-1.9 1.4L3 20"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
  ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  ol: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5h1.5v4M4 9h3"/><path d="M4 14.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3"/>',
  quote: '<path d="M6 17c3-1 4-3 4-6V7H5v5h5"/><path d="M15 17c3-1 4-3 4-6V7h-5v5h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  clear: '<path d="M5 6h10M10 6v12"/><path d="M15 14l5 5M20 14l-5 5"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  sortDown: '<path d="M8 4v16M4 16l4 4 4-4"/><path d="M14 6h6M14 11h4M14 16h2"/>',
  sortUp: '<path d="M8 20V4M4 8l4-4 4 4"/><path d="M14 6h2M14 11h4M14 16h6"/>',
  alarm: '<path d="M12 3v2"/><path d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6l1.5 2h-14z"/><path d="M10 21h4"/><path d="M3.5 8.5A9 9 0 0 1 6 4.5M20.5 8.5A9 9 0 0 0 18 4.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  bellOff: '<path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H8"/><path d="M10 20a2 2 0 0 0 4 0"/><path d="M4 4l16 16"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  marker: '<path d="M15 4l5 5-8.5 8.5H6.5v-5z"/><path d="M4 21h16"/>',
  alignL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  alignR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  indent: '<path d="M11 6h9M11 10h9M11 14h9M4 18h16"/><path d="M4 8l3 2-3 2"/>',
  outdent: '<path d="M11 6h9M11 10h9M11 14h9M4 18h16"/><path d="M7 8l-3 2 3 2"/>',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: 'inbox' },
  { id: 'starred', label: 'Starred', icon: 'star' },
  { id: 'sent', label: 'Sent', icon: 'send' },
  { id: 'drafts', label: 'Drafts', icon: 'draft' },
  { id: 'archive', label: 'Archive', icon: 'archive' },
  { id: 'spam', label: 'Spam', icon: 'spam' },
  { id: 'trash', label: 'Trash', icon: 'trash' },
];
const OUTLOOK_NAMES = { starred: 'Flagged', spam: 'Junk email', trash: 'Deleted items' };
const KIND_LABEL = { gmail: 'Gmail', outlook: 'Outlook', demo: 'Demo' };

// ---------- state ----------
const S = {
  accounts: [],
  status: null,
  scope: 'all', // 'all' or an account id
  folder: 'inbox',
  q: '',
  checked: new Set(), // conversations ticked for doing something to all of them at once
  msgs: [],
  next: {}, // accountId -> page token
  pages: 1,
  sel: null, // selected message key
  cur: null, // the open message (full)
  view: 'empty', // empty | message | compose | settings | welcome
  compose: null,
  draftThreads: new Set(), // "accountId|threadId" of conversations with a draft in them
  unread: {},
  loading: false,
  trustedSenders: new Set(store.get('trustedSenders', [])),
  soundOn: true,
  // 'oldest' = oldest at the top, newest at the bottom. 'newest' = the other way round.
  order: store.get('order', 'newest'),
  searchSort: store.get('searchSort', 'best'), // search results: 'best' match (like Gmail) or 'newest'
  scrollIntent: null, // how to place the list after it's redrawn
  thread: [], // every message in the open conversation, oldest first
  expanded: new Set(), // messages in the conversation shown in full
  showQuoted: new Set(), // messages whose quoted earlier text you chose to see
  showImages: false, // pictures shown for the open conversation
  blinking: new Set(), // accounts with new mail you haven't looked at yet
  // These come from the Mailroom program, which checks for new mail even when this tab is hidden.
  alerts: [], // important-sender alerts still on
  importantSenders: ['ncshp.gov'],
  blockedSenders: [],
  notifySeq: null, // the last new-mail happening this page has seen
  serverSound: false, // true when the program plays the sounds itself
  popups: store.get('popups', false), // Windows pop-up notifications
  addressBook: new Map(),
};
let listRequest = 0;

const app = $('#app');
const listEl = $('#list');
const reader = $('#reader');

const acct = (id) => S.accounts.find((a) => a.id === id);
const usable = () => S.accounts.filter((a) => !a.needsReconnect);
const scopeAccounts = () => (S.scope === 'all' ? usable() : usable().filter((a) => a.id === S.scope));
const myAddresses = () => new Set(S.accounts.map((a) => a.email.toLowerCase()));
const isOutlookOnly = () => {
  const list = S.scope === 'all' ? S.accounts : S.accounts.filter((a) => a.id === S.scope);
  return list.length > 0 && list.every((a) => a.kind === 'outlook');
};
const folderLabel = (id) => (isOutlookOnly() && OUTLOOK_NAMES[id]) || FOLDERS.find((f) => f.id === id).label;
const starWord = (m) => (acct(m.accountId)?.kind === 'outlook' ? 'Flag' : 'Star');

// ---------- talking to the server ----------
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'X-Mailroom': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status}).`);
    err.reconnect = !!data?.reconnect;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- toasts ----------
function toast(message, { error = false, action, actions, timeout = 6000 } = {}) {
  const list = actions || (action ? [action] : []);
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}${list.length > 1 ? ' multi' : ''}`;
  el.innerHTML = `<span>${esc(message)}</span>${list.map((a) => `<button type="button">${esc(a.label)}</button>`).join('')}<button type="button" aria-label="Dismiss">${icon('close')}</button>`;
  const remove = () => el.remove();
  const btns = $$('button', el);
  list.forEach((a, i) => { btns[i].onclick = () => { remove(); a.fn(); }; });
  btns.at(-1).onclick = remove;
  $('#toasts').append(el);
  if ($$('.toast').length > 3) $('.toast').remove();
  setTimeout(remove, timeout);
  return el;
}

function reportError(e, account) {
  if (e.reconnect && account) {
    account.needsReconnect = true;
    renderSidebar();
    toast(`${account.email} needs to be reconnected.`, { error: true, action: { label: 'Reconnect', fn: () => reconnect(account) } });
  } else {
    toast(account ? `${account.email}: ${e.message}` : e.message, { error: true });
  }
}

function reconnect(a) {
  window.top.location.href = `../connect.html?p=${a.provider === 'gmail' ? 'google' : 'microsoft'}/start`;
}

// ---------- dates & sizes ----------
function shortDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  if (now - d < 6 * 864e5 && d < now) return d.toLocaleDateString([], { weekday: 'short' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}
const longDate = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
function size(n) {
  if (!n) return '';
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
const personLabel = (p) => (p?.name ? p.name : p?.email || '');
const formatAddr = (p) => (p.name ? `${p.name.includes(',') ? `"${p.name}"` : p.name} <${p.email}>` : p.email);

// ---------- sidebar ----------
function renderSidebar() {
  const total = Object.entries(S.unread)
    .filter(([id]) => S.scope === 'all' || id === S.scope)
    .reduce((n, [, c]) => n + c, 0);
  $('#folders').innerHTML = FOLDERS.map((f) => `
    <li><button class="nav-item${S.folder === f.id && S.view !== 'settings' ? ' active' : ''}" data-folder="${f.id}" type="button">
      ${icon(f.icon)}<span class="label">${esc(folderLabel(f.id))}</span>
      ${f.id === 'inbox' && total ? `<span class="count">${total}</span>` : ''}
    </button></li>`).join('');

  const colors = S.accounts.map((a) => a.color);
  $('#accountList').innerHTML = S.accounts.length
    ? `<li><button class="nav-item${S.scope === 'all' ? ' active' : ''}" data-scope="all" type="button">
         <span class="dot all" style="--c1:${colors[0] || '#888'};--c2:${colors[1] || colors[0] || '#888'}"></span><span class="label">All accounts</span>
       </button></li>` +
      S.accounts.map((a) => `
       <li class="acct-li${S.alerts.some((x) => x.accountId === a.id) ? ' alarm' : S.blinking.has(a.id) ? ' blink' : ''}" draggable="true" data-acct="${a.id}" style="--acct:${a.color}"><button class="nav-item${S.scope === a.id ? ' active' : ''}" data-scope="${a.id}" type="button"
         title="${esc(a.email)}${S.accounts.length > 1 ? ' (drag to reorder, or Alt+Up/Down)' : ''}">
         <span class="dot" style="--acct:${a.color}"></span>
         <span class="label">${esc(a.email)}</span>
         <span class="mute-btn${a.muted ? ' on' : ''}" role="button" data-mute="${a.id}"
           title="${a.muted ? 'Muted. Click to turn this account’s sound back on' : 'Click to mute this account'}"
           aria-label="${a.muted ? `Unmute ${esc(a.email)}` : `Mute ${esc(a.email)}`}">${icon(a.muted ? 'bellOff' : 'bell')}</span>
         ${a.needsReconnect ? '<span class="warn" title="Needs to be reconnected">!</span>' : S.unread[a.id] ? `<span class="count">${S.unread[a.id]}</span>` : ''}
       </button></li>`).join('')
    : '<li class="muted" style="padding:4px 10px;font-size:14px">None connected yet</li>';

  $('#soundBtn').innerHTML = `${icon(S.soundOn ? 'bell' : 'bellOff')}<span class="label">${S.soundOn ? 'Sound on' : 'Sound off'}</span>`;
  $('#soundBtn').setAttribute('aria-pressed', String(!S.soundOn));
  $('#soundBtn').title = S.soundOn ? 'Click to silence the new-mail sound' : 'Click to turn the new-mail sound back on';
  $('#settingsBtn').innerHTML = `${icon('settings')}<span class="label">Settings and accounts</span>`;
  $('#settingsBtn').classList.toggle('active', S.view === 'settings');
  const n = Object.values(S.unread).reduce((a, b) => a + b, 0);
  document.title = n ? `(${n}) Mailroom` : 'Mailroom';
}

$('#folders').addEventListener('click', (e) => {
  const b = e.target.closest('[data-folder]');
  if (!b) return;
  S.folder = b.dataset.folder;
  closeNav();
  afterScopeChange();
});
// The bell next to each account mutes just that account's new-mail sound.
async function setMuted(id, muted) {
  const a = acct(id);
  if (!a) return;
  a.muted = muted;
  renderSidebar();
  try {
    const saved = await api('PATCH', `/mail/api/accounts/${id}`, { muted });
    if (saved.muted !== muted) throw new Error('Mailroom couldn’t save this. Close the black Control Center window and start it again, then try once more.');
    toast(muted ? `${a.email} is muted. Its new mail won’t make a sound.` : `${a.email} will make a sound for new mail again.`, { timeout: 3500 });
  } catch (err) {
    a.muted = !muted;
    renderSidebar();
    toast(err.message, { error: true });
  }
  const box = $(`.card[data-id="${CSS.escape(id)}"] [name="acctSound"]`, reader);
  if (box) box.checked = !a.muted;
}

$('#accountList').addEventListener('keydown', (e) => {
  const m = e.target.closest('[data-mute]');
  if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); setMuted(m.dataset.mute, !acct(m.dataset.mute)?.muted); }
});

$('#accountList').addEventListener('click', (e) => {
  const mute = e.target.closest('[data-mute]');
  if (mute) { e.stopPropagation(); setMuted(mute.dataset.mute, !acct(mute.dataset.mute)?.muted); return; }
  const b = e.target.closest('[data-scope]');
  if (!b) return;
  const a = acct(b.dataset.scope);
  if (a?.needsReconnect) return reconnect(a);
  ackAccount(b.dataset.scope);
  S.scope = b.dataset.scope;
  closeNav();
  afterScopeChange();
});

// Control Center's home screen: you clicked an account there, so show that account's inbox.
function showAccountByEmail(email) {
  const a = S.accounts.find((x) => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!a) return;
  if (a.needsReconnect) { reconnect(a); return; }
  ackAccount(a.id);
  S.folder = 'inbox';
  S.scope = a.id;
  S.q = '';
  $('#search').value = '';
  closeNav();
  if (S.view !== 'compose') showEmptyReader();
  afterScopeChange();
}
// ---------- putting accounts in your own order ----------
async function saveAccountOrder(ids) {
  const before = S.accounts;
  const rank = new Map(ids.map((id, i) => [id, i]));
  S.accounts = [...S.accounts].sort((a, b) => rank.get(a.id) - rank.get(b.id));
  renderSidebar();
  // In Settings, move the cards themselves so anything you're typing there is kept.
  if (S.view === 'settings') {
    const first = $('.page .card[data-id]', reader);
    if (first) {
      const parent = first.parentNode;
      const anchor = $$('.page .card[data-id]', reader).at(-1).nextSibling;
      ids.forEach((id) => { const c = $(`.card[data-id="${CSS.escape(id)}"]`, reader); if (c) parent.insertBefore(c, anchor); });
      updateMoveButtons();
    }
  }
  try {
    S.accounts = await api('POST', '/mail/api/accounts/order', { ids });
  } catch (e) {
    S.accounts = before;
    renderSidebar();
    toast(`The new order couldn’t be saved: ${e.message}`, { error: true });
  }
}

function moveAccount(id, delta) {
  const ids = S.accounts.map((a) => a.id);
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return false;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  saveAccountOrder(ids);
  return true;
}

let dragId = null;
const accountListEl = $('#accountList');
accountListEl.addEventListener('dragstart', (e) => {
  const li = e.target.closest('.acct-li');
  if (!li) return;
  dragId = li.dataset.acct;
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
});
accountListEl.addEventListener('dragover', (e) => {
  if (!dragId) return;
  const li = e.target.closest('.acct-li');
  if (!li || li.dataset.acct === dragId) return;
  e.preventDefault();
  const r = li.getBoundingClientRect();
  const after = e.clientY > r.top + r.height / 2;
  $$('.acct-li', accountListEl).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
  li.classList.add(after ? 'drop-after' : 'drop-before');
});
accountListEl.addEventListener('drop', (e) => {
  if (!dragId) return;
  e.preventDefault();
  const li = e.target.closest('.acct-li');
  const target = $('.acct-li.drop-before, .acct-li.drop-after', accountListEl);
  if (li && target) {
    const ids = S.accounts.map((a) => a.id).filter((id) => id !== dragId);
    let at = ids.indexOf(target.dataset.acct);
    if (target.classList.contains('drop-after')) at++;
    ids.splice(at, 0, dragId);
    saveAccountOrder(ids);
  }
  dragEnd();
});
accountListEl.addEventListener('dragend', dragEnd);
function dragEnd() {
  dragId = null;
  $$('.acct-li', accountListEl).forEach((x) => x.classList.remove('dragging', 'drop-before', 'drop-after'));
}
accountListEl.addEventListener('keydown', (e) => {
  const li = e.target.closest('.acct-li');
  if (!li || !e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const id = li.dataset.acct;
  if (moveAccount(id, e.key === 'ArrowUp' ? -1 : 1)) {
    requestAnimationFrame(() => $(`[data-acct="${CSS.escape(id)}"] button`, accountListEl)?.focus());
  }
});

$('#settingsBtn').addEventListener('click', () => { closeNav(); openSettings(); });
$('#composeBtn').addEventListener('click', () => { closeNav(); openCompose('new'); });
$('#menuBtn').innerHTML = icon('menu');
$('#menuBtn').addEventListener('click', () => app.classList.add('nav-open'));
$('#scrim').addEventListener('click', closeNav);
function closeNav() { app.classList.remove('nav-open'); }

function afterScopeChange() {
  if (S.view === 'settings' || S.view === 'welcome') showEmptyReader();
  renderSidebar();
  loadList();
}

// ---------- message list ----------
// One row per conversation, like Gmail. S.msgs is every loaded message, newest first;
// a conversation's row shows its newest message and counts the rest.
const threadKeyOf = (m) => `${m.accountId}|${m.threadId || m.id}`;
function groups() {
  const map = new Map();
  for (const m of S.msgs) {
    const k = threadKeyOf(m);
    if (!map.has(k)) map.set(k, { key: k, latest: m, members: [] });
    map.get(k).members.push(m);
  }
  return [...map.values()];
}
const groupOf = (m) => groups().find((g) => g.members.some((x) => keyOf(x) === keyOf(m)));
// When several accounts are shown together, each has only its newest mail loaded so far.
// Anything older than the point where one account's loaded mail stops is held back,
// so a quieter account's old mail never jumps ahead of a busier account's unloaded mail.
function frontier() {
  if (bestMatch()) return null; // best-match results aren't in date order, so show all loaded
  let edge = null;
  for (const id of Object.keys(S.next)) {
    let oldest = null;
    for (const m of S.msgs) if (m.accountId === id && (!oldest || m.date < oldest)) oldest = m.date;
    if (oldest && (!edge || oldest > edge)) edge = oldest;
  }
  return edge;
}
// The order you see on screen.
function shownGroups() {
  const edge = frontier();
  const list = groups().filter((g) => !edge || g.latest.date >= edge);
  return S.order === 'oldest' && !bestMatch() ? list.reverse() : list;
}
const bestMatch = () => !!S.q && S.searchSort === 'best';
// Best match: the searched words in the subject first, then the rest; newest first within each.
function searchTier(m) {
  if (m.match === 'subject') return 0;
  const subject = (m.subject || '').toLowerCase();
  const words = S.q.toLowerCase().split(/\s+/).filter((w) => w && !w.includes(':'));
  return words.length && words.every((w) => subject.includes(w.replace(/^"|"$/g, ''))) ? 0 : 1;
}
function sortMsgs(list) {
  return list.sort((a, b) => (bestMatch() ? searchTier(a) - searchTier(b) : 0) || b.date.localeCompare(a.date));
}
const hasMore = () => Object.keys(S.next).length > 0;

function renderOrderBtn() {
  const b = $('#orderBtn');
  if (S.q) {
    const best = S.searchSort === 'best';
    b.innerHTML = `${icon('sortUp')}<span>${best ? 'Best match' : 'Newest first'}</span>`;
    b.title = best ? 'Showing emails with your words in the subject first. Click to show the newest first.' : 'Showing the newest first. Click to show the best matches first.';
    return;
  }
  const oldest = S.order === 'oldest';
  b.innerHTML = `${icon(oldest ? 'sortDown' : 'sortUp')}<span>${oldest ? 'Newest at bottom' : 'Newest at top'}</span>`;
  b.title = oldest ? 'Click to show the newest mail at the top' : 'Click to show the newest mail at the bottom';
}
$('#orderBtn').addEventListener('click', () => {
  if (S.q) {
    S.searchSort = S.searchSort === 'best' ? 'newest' : 'best';
    store.set('searchSort', S.searchSort);
    renderOrderBtn();
    loadList();
    return;
  }
  S.order = S.order === 'oldest' ? 'newest' : 'oldest';
  store.set('order', S.order);
  renderOrderBtn();
  S.scrollIntent = 'newest';
  renderList();
});
renderOrderBtn();

async function loadList({ more = false, keep = false } = {}) {
  if (more && (S.loadingMore || !hasMore())) return;
  const req = ++listRequest;
  const accounts = scopeAccounts();
  // Checking for new mail after you've scrolled far down adds the new mail without
  // throwing away the older mail you've already loaded.
  const deep = keep && !more && S.pages > 1;
  $('#listTitle').textContent = S.q ? 'Search results' : folderLabel(S.folder);
  renderOrderBtn();
  if (!accounts.length) {
    S.msgs = [];
    S.next = {};
    renderList();
    return;
  }
  let targets = accounts;
  if (more) {
    // Load the accounts that are holding the list back first.
    const edge = frontier();
    const oldestOf = (id) => S.msgs.filter((m) => m.accountId === id).reduce((o, m) => (!o || m.date < o ? m.date : o), null);
    targets = accounts.filter((a) => S.next[a.id] && (!edge || oldestOf(a.id) >= edge));
    if (!targets.length) targets = accounts.filter((a) => S.next[a.id]);
  }
  if (!more) {
    S.loading = true;
    if (!deep) S.pages = 1;
    if (!keep) { S.msgs = []; S.next = {}; S.checked.clear(); renderBulkBar(); }
    S.scrollIntent = keep ? 'stay' : 'newest';
    if (!keep) renderList();
  } else {
    S.loadingMore = true;
    S.scrollIntent = 'older';
    S.pages++;
    const btn = $('.load-more');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading older messages…'; }
  }

  const results = await Promise.allSettled(targets.map((a) => {
    const q = new URLSearchParams({ folder: S.folder, q: S.q });
    if (S.q) q.set('sort', S.searchSort);
    if (more) q.set('pageToken', S.next[a.id]);
    return api('GET', `/mail/api/accounts/${a.id}/messages?${q}`);
  }));
  if (more) S.loadingMore = false;
  if (req !== listRequest) return;

  const next = more || deep ? { ...S.next } : {};
  const fresh = [];
  results.forEach((r, i) => {
    const a = targets[i];
    if (r.status === 'fulfilled') {
      fresh.push(...r.value.messages);
      if (deep) { /* keep the page tokens for the older mail already loaded */ }
      else if (r.value.nextPageToken) next[a.id] = r.value.nextPageToken;
      else delete next[a.id];
    } else {
      if (!deep) delete next[a.id];
      reportError(r.reason, a);
    }
  });
  const map = new Map((more || deep ? S.msgs : []).map((m) => [keyOf(m), m]));
  fresh.forEach((m) => map.set(keyOf(m), m));
  S.msgs = sortMsgs([...map.values()]);
  S.next = next;
  S.loading = false;
  learnAddresses(S.msgs);
  renderList();
  fillList();
  loadDraftMarks(accounts);
}

// Which conversations have a draft of yours in them, per account (asked at most once a minute
// per account, or right after you save, send or discard a draft).
const draftMarkCache = new Map(); // account id -> { at, threads }
function forgetDraftMarks(accountId) { draftMarkCache.delete(accountId); loadDraftMarks(scopeAccounts()); }
async function loadDraftMarks(accounts) {
  if (S.folder === 'drafts') return;
  const now = Date.now();
  await Promise.all(accounts.map(async (a) => {
    const c = draftMarkCache.get(a.id);
    if (c && now - c.at < 60_000) return;
    try {
      const threads = await api('GET', `/mail/api/accounts/${a.id}/draft-threads`);
      draftMarkCache.set(a.id, { at: Date.now(), threads });
    } catch { /* keep the old marks */ }
  }));
  const set = new Set();
  for (const [id, c] of draftMarkCache) for (const t of c.threads) set.add(`${id}|${t}`);
  const changed = set.size !== S.draftThreads.size || [...set].some((k) => !S.draftThreads.has(k));
  S.draftThreads = set;
  if (changed) renderList();
}

// Keep loading older mail while the end of the list is in view.
function nearListEnd() {
  const gap = 400;
  if (S.order === 'oldest') return listEl.scrollTop < gap;
  return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < gap;
}
function fillList() {
  if (!hasMore() || S.loading || S.loadingMore || !S.msgs.length) return;
  if (nearListEnd()) loadList({ more: true });
}
listEl.addEventListener('scroll', () => fillList(), { passive: true });

function rowHtml(g) {
  const m = g.latest;
  const a = acct(m.accountId);
  const mine = myAddresses();
  const outgoing = S.folder === 'sent' || S.folder === 'drafts' || mine.has(m.from.email.toLowerCase());
  let who;
  if (outgoing && m.to.length && g.members.length === 1) who = `To: ${m.to.map(personLabel).join(', ')}`;
  else {
    // Everyone who wrote in this conversation, oldest first, "Me" for you.
    const names = [];
    for (const x of [...g.members].reverse()) {
      const n = mine.has(x.from.email.toLowerCase()) ? 'Me' : (personLabel(x.from) || '(unknown sender)');
      if (!names.includes(n)) names.push(n);
    }
    who = names.join(', ');
  }
  const unread = g.members.some((x) => x.unread);
  const starred = g.members.some((x) => x.starred);
  const clip = g.members.some((x) => x.hasAttachments);
  const selected = g.members.some((x) => keyOf(x) === S.sel);
  const count = g.members.length;
  const hasDraft = !m.draft && S.draftThreads.has(`${m.accountId}|${m.threadId || m.id}`);
  if (hasDraft) who = `${who}, <span class="draft-tag">Draft</span>`;
  else who = esc(who);
  return `
    <div class="row${unread ? ' unread' : ''}${selected ? ' selected' : ''}${S.checked.has(g.key) ? ' checked' : ''}" role="option" aria-selected="${selected}"
         data-key="${esc(keyOf(m))}" data-group="${esc(g.key)}" style="--acct:${a?.color || 'transparent'}" title="${esc(a ? `${a.email}` : '')}">
      <span class="pick" data-pick role="checkbox" aria-checked="${S.checked.has(g.key)}" aria-label="Select this email" title="Select (Ctrl+click or Shift+click also work)"></span>
      <span class="sender">${m.draft ? '<span class="draft-tag">Draft </span>' : ''}${who}${count > 1 ? ` <span class="count-tag" title="${count} messages in this conversation">${count}</span>` : ''}</span>
      <time datetime="${m.date}">${esc(shortDate(m.date))}</time>
      <span class="subject">${esc(m.subject || '(no subject)')}</span>
      <span class="snippet">${esc(m.snippet)}</span>
      <span class="flags">
        ${clip ? `<span title="Has attachments">${icon('clip')}</span>` : ''}
        ${starred ? `<span class="star" title="${starWord(m) === 'Flag' ? 'Flagged' : 'Starred'}">${icon('star')}</span>` : ''}
      </span>
    </div>`;
}

const unreadConversations = () => groups().filter((g) => g.members.some((x) => x.unread)).length;

function renderList() {
  listEl.classList.toggle('picking', S.checked.size > 0);
  const unreadHere = unreadConversations();
  $('#listMeta').textContent = S.msgs.length && !S.loading ? (unreadHere ? `${unreadHere} unread` : '') : '';
  if (!S.accounts.length) {
    listEl.innerHTML = `<div class="list-empty"><p>Connect an account to see your mail here.</p><button class="btn primary" type="button" data-go="settings">Add an account</button></div>`;
    return;
  }
  if (!usable().length) {
    listEl.innerHTML = `<div class="list-empty"><p>Your accounts need to be reconnected.</p><button class="btn primary" type="button" data-go="settings">Open settings</button></div>`;
    return;
  }
  if (S.loading && !S.msgs.length) {
    listEl.innerHTML = Array.from({ length: 7 }, () => '<div class="skeleton"><i></i><i></i><i></i></div>').join('');
    return;
  }
  if (!S.msgs.length) {
    listEl.innerHTML = `<div class="list-empty"><p>${S.q ? `No messages match “${esc(S.q)}”.` : `Nothing in ${esc(folderLabel(S.folder))}.`}</p>
      ${S.q ? '<button class="btn" type="button" data-go="clear-search">Clear search</button>' : ''}</div>`;
    return;
  }
  const more = hasMore() ? `<button class="btn load-more" type="button"${S.loadingMore ? ' disabled' : ''}>${S.loadingMore ? 'Loading older messages…' : 'Load older messages'}</button>` : '';
  const oldest = S.order === 'oldest';
  const before = { height: listEl.scrollHeight, top: listEl.scrollTop };
  const nearBottom = before.height - before.top - listEl.clientHeight < 80;
  const nearTop = before.top < 80;
  listEl.innerHTML = oldest ? more + shownGroups().map(rowHtml).join('') : shownGroups().map(rowHtml).join('') + more;

  // Keep the newest mail in view, and keep your place when older mail loads above it.
  const intent = S.scrollIntent;
  S.scrollIntent = null;
  if (intent === 'newest') listEl.scrollTop = oldest ? listEl.scrollHeight : 0;
  else if (intent === 'older' && oldest) listEl.scrollTop = listEl.scrollHeight - before.height + before.top;
  else if (intent === 'stay') {
    if (oldest && nearBottom) listEl.scrollTop = listEl.scrollHeight;
    else if (!oldest && nearTop) listEl.scrollTop = 0;
    else listEl.scrollTop = before.top;
  } else listEl.scrollTop = before.top;
}

function updateRow(m) {
  const g = groupOf(m);
  const el = g && listEl.querySelector(`[data-group="${CSS.escape(g.key)}"]`);
  if (el) el.outerHTML = rowHtml(g);
  const unreadHere = unreadConversations();
  $('#listMeta').textContent = unreadHere ? `${unreadHere} unread` : '';
}

// Shift+click picks a range of emails; don't let it highlight the text too.
listEl.addEventListener('mousedown', (e) => { if (e.shiftKey && e.target.closest('.row')) e.preventDefault(); });
listEl.addEventListener('click', (e) => {
  if (e.target.closest('.load-more')) return loadList({ more: true });
  const go = e.target.closest('[data-go]');
  if (go) {
    if (go.dataset.go === 'settings') openSettings();
    if (go.dataset.go === 'clear-search') clearSearch();
    return;
  }
  const row = e.target.closest('.row');
  if (!row) return;
  // Tick boxes: the checkbox, Ctrl+click, or Shift+click (selects everything in between).
  if (e.target.closest('[data-pick]') || e.ctrlKey || e.metaKey || e.shiftKey || S.checked.size) {
    if (e.shiftKey && lastPicked) pickRange(lastPicked, row.dataset.group);
    else togglePick(row.dataset.group);
    lastPicked = row.dataset.group;
    return;
  }
  openMessage(row.dataset.key);
});

$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  S.q = $('#search').value.trim();
  loadList();
});
$('#search').addEventListener('search', () => { if (!$('#search').value && S.q) clearSearch(); });
function clearSearch() {
  $('#search').value = '';
  S.q = '';
  loadList();
}

$('#refreshBtn').innerHTML = icon('refresh');
$('#refreshBtn').addEventListener('click', () => { refreshUnread(); pollNotify({ checkNow: true }); loadList({ keep: true }); });

function learnAddresses(msgs) {
  const mine = myAddresses();
  for (const m of msgs) {
    for (const p of [m.from, ...(m.to || [])]) {
      if (!p?.email || mine.has(p.email.toLowerCase())) continue;
      const k = p.email.toLowerCase();
      if (!S.addressBook.has(k) || (!S.addressBook.get(k).name && p.name)) S.addressBook.set(k, p);
    }
  }
}

// ---------- reading a message ----------
function showEmptyReader() {
  S.view = 'empty';
  S.cur = null;
  app.classList.remove('reading');
  reader.innerHTML = `<div class="reader-empty"><p>${S.msgs.length ? 'Choose a message to read it.' : ''}</p></div>`;
  renderSidebar();
}

async function openMessage(key) {
  const m = S.msgs.find((x) => keyOf(x) === key);
  if (!m) return;
  if (!(await confirmLeaveCompose())) return;
  if (m.draft) { await openDraft(m); return; }
  S.compose = null;
  S.sel = key;
  if (S.blinking.has(m.accountId)) ackAccount(m.accountId);
  $$('.row.selected', listEl).forEach((r) => { r.classList.remove('selected'); r.setAttribute('aria-selected', 'false'); });
  const row = listEl.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (row) { row.classList.add('selected'); row.setAttribute('aria-selected', 'true'); row.scrollIntoView({ block: 'nearest' }); }
  app.classList.add('reading');
  S.view = 'message';
  reader.innerHTML = `<div class="reader-bar"><button class="icon-btn back-btn" data-act="back" aria-label="Back to list">${icon('back')}</button></div>
    <div class="message"><h1 class="msg-subject">${esc(m.subject || '(no subject)')}</h1><p class="muted">Opening…</p></div>`;
  try {
    const base = `/mail/api/accounts/${m.accountId}/messages/${encodeURIComponent(m.id)}`;
    let thread = await api('GET', `${base}/thread`).catch(() => null);
    if (!thread?.length) thread = [await api('GET', base)];
    if (S.sel !== key) return;
    const full = thread.find((t) => t.id === m.id) || thread.at(-1);
    S.cur = full;
    S.thread = thread;
    S.expanded = new Set([thread.at(-1).id, full.id, ...thread.filter((t) => t.unread).map((t) => t.id)]);
    S.showQuoted = new Set();
    S.showImages = false;
    learnAddresses(thread);
    // Opening a conversation marks every unread message in it as read.
    const wasUnread = thread.filter((x) => x.unread);
    wasUnread.forEach((t) => { t.unread = false; });
    renderMessage(full, { scrollTo: full.id });
    for (const t of wasUnread) {
      const row = S.msgs.find((x) => x.accountId === t.accountId && x.id === t.id);
      if (row) { row.unread = false; updateRow(row); }
      runAction(t, 'read', { quiet: true });
    }
    if (m.unread) { m.unread = false; updateRow(m); }
  } catch (e) {
    if (S.sel !== key) return;
    reader.innerHTML = `<div class="reader-bar"><button class="icon-btn back-btn" data-act="back" aria-label="Back to list">${icon('back')}</button></div>
      <div class="message"><h1 class="msg-subject">${esc(m.subject || '(no subject)')}</h1><p>This message couldn’t be opened: ${esc(e.message)}</p>
      <button class="btn" type="button" data-act="retry">Try again</button></div>`;
    if (e.reconnect) reportError(e, acct(m.accountId));
  }
}

function hasRemoteImages(html) {
  return /<img[^>]+src\s*=\s*["']?\s*https?:|url\(\s*["']?\s*https?:|background\s*=\s*["']?\s*https?:/i.test(html || '');
}

function cleanEmail(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  $$('script, iframe, frame, frameset, object, embed, applet, meta, base, link:not([rel~="stylesheet"]), noscript', doc).forEach((n) => n.remove());
  $$('form', doc).forEach((f) => f.replaceWith(...f.childNodes));
  for (const el of $$('*', doc)) {
    for (const at of [...el.attributes]) {
      const n = at.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(at.name);
      else if (['href', 'src', 'action', 'formaction', 'xlink:href', 'background'].includes(n) && /^\s*(javascript|vbscript|data:text\/html)/i.test(at.value)) el.removeAttribute(at.name);
    }
  }
  return doc;
}

const linkify = (escaped) => escaped.replace(/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g, (u) => `<a href="${u}">${u}</a>`);

const EMAIL_CSS = `
  html { overflow-x: auto; }
  body { margin: 0; font: 15px/1.5 Arial, Helvetica, sans-serif; color: #1c1c1c; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  .mr-plain { white-space: pre-wrap; font: inherit; margin: 0; }
  blockquote { margin: 0 0 0 .8ex; border-left: 2px solid #ccc; padding-left: 1ex; }
  a { color: #1a5c94; }`;

function emailDocument(m, showImages) {
  const origin = location.origin;
  const imgSrc = showImages ? `data: ${origin} https: http:` : `data: ${origin}`;
  const csp = `default-src 'none'; img-src ${imgSrc}; style-src 'unsafe-inline'${showImages ? ' https:' : ''}; font-src data:${showImages ? ' https:' : ''}`;
  let head = '';
  let body;
  if (m.html) {
    const doc = cleanEmail(m.html);
    head = $$('style, link[rel~="stylesheet"]', doc.head).map((n) => n.outerHTML).join('');
    body = doc.body.innerHTML;
  } else {
    body = `<pre class="mr-plain">${linkify(esc(m.text || ''))}</pre>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>${EMAIL_CSS}</style>${head}</head><body>${body}</body></html>`;
}

// Emails are shown in a locked-down frame: no scripts, no forms, links open in a new tab.
function mountEmail(frame, m, showImages) {
  frame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  frame.srcdoc = emailDocument(m, showImages);
  frame.onload = () => {
    const d = frame.contentDocument;
    if (!d) return;
    // Size the frame to the message itself, so short messages don't leave an empty box.
    const fit = () => {
      const h = Math.max(d.body.scrollHeight, d.body.offsetHeight, ...[...d.body.children].map((c) => c.getBoundingClientRect().bottom));
      frame.style.height = `${Math.max(24, Math.ceil(h) + 2)}px`;
    };
    fit();
    try { new ResizeObserver(fit).observe(d.body); } catch { /* old browser */ }
    $$('img', d).forEach((img) => img.addEventListener('load', fit));
  };
}

// ---------- hiding the quoted copy of earlier messages ----------
// In a conversation every reply repeats the messages before it. Those are already
// shown above, so the repeat is folded away behind "Show quoted text".
const QUOTE_SELECTORS = [
  '.gmail_quote_container', '.gmail_quote', 'blockquote[type="cite"]', '#appendonsend', '#divRplyFwdMsg',
  '.yahoo_quoted', '[data-marker="__QUOTED_TEXT__"]', '.moz-cite-prefix', '#mail-editor-reference-message-container',
];

function cutFrom(node, body) {
  let level = node;
  while (level && level !== body) {
    while (level.nextSibling) level.nextSibling.remove();
    level = level.parentNode;
  }
  node.remove();
  // Tidy up blank lines left at the end.
  let last = body.lastChild;
  while (last && ((last.nodeType === 3 && !last.textContent.trim()) || (last.nodeType === 1 && !last.textContent.trim() && !last.querySelector?.('img') && last.tagName !== 'IMG'))) {
    last.remove();
    last = body.lastChild;
  }
}

function trimQuotedHtml(html) {
  const doc = cleanEmail(html);
  const body = doc.body;
  const candidates = [...body.querySelectorAll(QUOTE_SELECTORS.join(','))];
  // Outlook desktop: a block with a top border that starts "From: … Sent: …"
  for (const el of body.querySelectorAll('div[style*="border-top"], hr')) {
    const holder = el.tagName === 'HR' ? el.nextElementSibling : el;
    const t = holder?.textContent || '';
    if (/From:/.test(t) && /(Sent|Date):/.test(t)) candidates.push(el);
  }
  // Any "On <date>, <person> wrote:" line followed by a quote.
  for (const el of body.querySelectorAll('div, p, span')) {
    if (el.children.length > 3) continue;
    if (/^\s*On .{5,300}wrote:\s*$/s.test(el.textContent) && (el.nextElementSibling?.tagName === 'BLOCKQUOTE' || el.querySelector('blockquote') == null)) {
      const next = el.nextElementSibling;
      if (next && next.tagName === 'BLOCKQUOTE') candidates.push(el);
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  let first = candidates[0];
  // Take the divider line that sits just above Outlook's header too.
  if (first.id === 'divRplyFwdMsg' && first.previousElementSibling?.tagName === 'HR') first = first.previousElementSibling;
  cutFrom(first, body);
  if (!body.textContent.trim() && !body.querySelector('img')) return null;
  return `<html><head>${doc.head.innerHTML}</head><body>${body.innerHTML}</body></html>`;
}

function trimQuotedText(text) {
  const lines = String(text || '').split(/\r?\n/);
  let cut = -1;
  for (let i = 0; i < lines.length && cut < 0; i++) {
    const l = lines[i].trim();
    if (/^On .{5,300}wrote:$/.test(l) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(l)) cut = i;
    else if (/^From: /.test(l) && lines.slice(i + 1, i + 4).some((x) => /^(Sent|Date): /.test(x.trim()))) cut = i;
    else if (l.startsWith('>') && lines.slice(i).filter((x) => x.trim()).every((x) => x.trim().startsWith('>'))) cut = i;
  }
  if (cut <= 0) return null;
  const kept = lines.slice(0, cut).join('\n').replace(/\s+$/, '');
  return kept.trim() ? kept : null;
}

// What to show for one message in the conversation: trimmed unless you asked for everything.
function displayVersion(m) {
  const forwarded = /^\s*(fwd?|fw):/i.test(m.subject || '');
  if (S.thread.length < 2 || forwarded || S.showQuoted.has(m.id)) return { msg: m, trimmed: false, canTrim: !forwarded && S.thread.length > 1 && hasQuote(m) };
  if (m.html) {
    const html = trimQuotedHtml(m.html);
    return html ? { msg: { ...m, html }, trimmed: true, canTrim: true } : { msg: m, trimmed: false, canTrim: false };
  }
  const text = trimQuotedText(m.text);
  return text ? { msg: { ...m, text }, trimmed: true, canTrim: true } : { msg: m, trimmed: false, canTrim: false };
}
const hasQuote = (m) => (m.html ? trimQuotedHtml(m.html) !== null : trimQuotedText(m.text) !== null);

// ---------- showing a conversation ----------
const replyTarget = () => S.thread.filter((t) => !t.draft).at(-1) || S.cur;
// Your newest unsent reply in this conversation (Gmail-style: Reply opens it again).
const threadDraft = () => S.thread.filter((t) => t.draft).at(-1) || null;
const imagesAllowed = (m) => S.showImages || !m.html || !hasRemoteImages(m.html) || S.trustedSenders.has((m.from?.email || '').toLowerCase());
const findInThread = (id) => S.thread.find((t) => t.id === id);

function draftCardHtml(m) {
  // While you're writing it under the conversation, the saved copy isn't shown twice.
  if (S.view === 'compose' && S.compose?.inline) return '';
  return `<section class="tmsg draft-card" data-mid="${esc(m.id)}">
    <div class="draft-line">
      <span class="avatar small" aria-hidden="true">${icon('draft')}</span>
      <span class="draft-label">Draft</span>
      <span class="tl-snippet">${esc(m.snippet || '(empty)')}</span>
      <time datetime="${m.date}">${esc(shortDate(m.date))}</time>
    </div>
    <div class="draft-acts">
      <button class="btn small primary" type="button" data-act="editDraft" data-mid="${esc(m.id)}">Continue writing</button>
      <button class="btn small ghost danger" type="button" data-act="discardDraft" data-mid="${esc(m.id)}">Discard draft</button>
    </div>
  </section>`;
}

function cardHtml(m) {
  if (m.draft) return draftCardHtml(m);
  const a = acct(m.accountId);
  const sender = m.from || {};
  const color = a?.color || 'var(--muted)';
  const initial = esc((personLabel(sender)[0] || '?').toUpperCase());
  if (!S.expanded.has(m.id)) {
    return `<section class="tmsg collapsed" data-mid="${esc(m.id)}" style="--acct:${color}">
      <button class="tmsg-line" type="button" data-act="toggleMsg" data-mid="${esc(m.id)}" aria-expanded="false">
        <span class="avatar small" aria-hidden="true">${initial}</span>
        <span class="tl-name">${esc(personLabel(sender) || sender.email)}</span>
        <span class="tl-snippet">${esc(m.snippet || '')}</span>
        ${m.attachments?.length ? `<span class="tl-clip" title="Has attachments">${icon('clip')}</span>` : ''}
        <time datetime="${m.date}">${esc(shortDate(m.date))}</time>
        <span class="tl-chev" aria-hidden="true">${icon('down')}</span>
      </button>
    </section>`;
  }
  const recips = (label, list) => (list?.length ? `<div class="recips">${label} ${esc(list.map(formatAddr).join(', '))}</div>` : '');
  const v = displayVersion(m);
  const many = (m.cc?.length || 0) + (m.to?.length || 0) > 1;
  return `<section class="tmsg expanded" data-mid="${esc(m.id)}" style="--acct:${color}">
    <div class="msg-meta${S.thread.length > 1 ? ' foldable' : ''}" ${S.thread.length > 1 ? `data-act="toggleMsg" data-mid="${esc(m.id)}" title="Click to fold this message"` : ''}>
      <span class="avatar" aria-hidden="true">${initial}</span>
      <div class="who">
        <div><span class="name">${esc(sender.name || sender.email)}</span> ${sender.name ? `<span class="addr">&lt;${esc(sender.email)}&gt;</span>` : ''}</div>
        ${recips('To:', m.to)}${recips('Cc:', m.cc)}${recips('Bcc:', m.bcc)}
        ${m.replyTo?.length && m.replyTo[0].email !== sender.email ? recips('Reply to:', m.replyTo) : ''}
      </div>
      <div class="when"><time datetime="${m.date}">${esc(longDate(m.date))}</time>
        <div class="card-acts">
          <button class="icon-btn" type="button" data-act="reply" data-mid="${esc(m.id)}" title="Reply to this message" aria-label="Reply to this message">${icon('reply')}</button>
          ${many ? `<button class="icon-btn" type="button" data-act="replyAll" data-mid="${esc(m.id)}" title="Reply all to this message" aria-label="Reply all to this message">${icon('replyAll')}</button>` : ''}
          <button class="icon-btn" type="button" data-act="forward" data-mid="${esc(m.id)}" title="Forward this message" aria-label="Forward this message">${icon('forward')}</button>
          ${S.thread.length > 1 ? `<button class="icon-btn" type="button" data-act="toggleMsg" data-mid="${esc(m.id)}" aria-expanded="true" title="Fold this message" aria-label="Fold this message">${icon('up')}</button>` : ''}
        </div>
      </div>
    </div>
    <div class="frame-wrap"><iframe class="msg-frame" title="Message from ${esc(personLabel(sender))}"></iframe></div>
    ${v.canTrim ? `<button class="quote-toggle" type="button" data-act="toggleQuoted" data-mid="${esc(m.id)}">${v.trimmed ? 'Show quoted text' : 'Hide quoted text'}</button>` : ''}
    ${m.attachments?.length ? `<ul class="atts" aria-label="Attachments">${m.attachments.map(attachmentHtml).join('')}</ul>
      ${saveToHtml(m)}` : ''}
  </section>`;
}

function mountCard(section) {
  const m = findInThread(section.dataset.mid);
  const frame = $('.msg-frame', section);
  if (m && frame) mountEmail(frame, displayVersion(m).msg, imagesAllowed(m));
}

function redrawCard(id) {
  const old = reader.querySelector(`.tmsg[data-mid="${CSS.escape(id)}"]`);
  const m = findInThread(id);
  if (!old || !m) return;
  old.outerHTML = cardHtml(m);
  const fresh = reader.querySelector(`.tmsg[data-mid="${CSS.escape(id)}"]`);
  mountCard(fresh);
  return fresh;
}

function imageNoticeHtml() {
  const blocked = S.thread.filter((t) => !imagesAllowed(t));
  if (!blocked.length) return '';
  const senders = [...new Set(blocked.map((t) => (t.from?.email || '').toLowerCase()).filter(Boolean))];
  return `<div class="notice" id="imgNotice">${icon('image')}<span class="grow">Pictures from the web are hidden to protect your privacy.</span>
    <button class="btn small" type="button" data-act="showImages">Show pictures</button>
    <button class="btn small ghost" type="button" data-act="trustSender">Always show from ${senders.length === 1 ? esc(senders[0]) : 'these senders'}</button></div>`;
}

// Draws the whole conversation, oldest at the top and newest at the bottom.
function renderMessage(m, { scrollTo } = {}) {
  // If you're writing a reply under this conversation, keep it while the conversation is redrawn.
  const keepCompose = S.view === 'compose' && S.compose?.inline ? $('.inline-compose', reader) : null;
  if (keepCompose) keepCompose.remove();
  const a = acct(m.accountId);
  const outlook = a?.kind === 'outlook';
  const f = S.folder;
  if (!S.thread.length || !findInThread(m.id)) { S.thread = [m]; S.expanded = new Set([m.id]); }
  const tool = (act, ic, label, extra = '') => `<button class="tool${extra}" type="button" data-act="${act}" title="${esc(label)}">${icon(ic)}<span class="t-label">${esc(label)}</span></button>`;
  const latest = replyTarget();
  const many = (latest.cc?.length || 0) + (latest.to?.length || 0) > 1;
  const keepScroll = !scrollTo && reader.querySelector('.thread') ? reader.scrollTop : null;
  const n = S.thread.length;

  reader.innerHTML = `
    <div class="reader-bar" role="toolbar" aria-label="Message actions">
      <button class="icon-btn back-btn" data-act="back" aria-label="Back to list">${icon('back')}</button>
      ${tool('reply', 'reply', 'Reply')}
      ${tool('replyAll', 'replyAll', 'Reply all')}
      ${tool('forward', 'forward', 'Forward')}
      <span class="sep"></span>
      ${['archive', 'spam', 'trash'].includes(f) ? tool('inbox', 'inbox', 'Move to inbox') : tool('archive', 'archive', 'Archive')}
      ${f !== 'spam' ? tool('spam', 'spam', outlook ? 'Report junk' : 'Report spam') : ''}
      ${f !== 'trash' ? tool('trash', 'trash', 'Delete') : ''}
      ${tool(m.unread ? 'read' : 'unread', m.unread ? 'mailOpen' : 'mail', m.unread ? 'Mark read' : 'Mark unread')}
      ${tool(m.starred ? 'unstar' : 'star', 'star', m.starred ? `Remove ${starWord(m).toLowerCase()}` : starWord(m), m.starred ? ' on' : '')}
    </div>
    <article class="message">
      <h1 class="msg-subject">${esc(m.subject || '(no subject)')}</h1>
      <div class="thread-meta">
        <span class="acct-chip" style="--acct:${a?.color || 'var(--muted)'}" title="Received in this account">${esc(a?.email || '')}</span>
        ${n > 1 ? `<span class="muted">${n} messages, oldest first</span>
          <button class="btn small ghost" type="button" data-act="expandAll">${S.expanded.size === n ? 'Fold older messages' : 'Open all'}</button>` : ''}
      </div>
      ${imageNoticeHtml()}
      <div class="thread">${S.thread.map(cardHtml).join('')}</div>
      <div class="quick-reply">
        <button class="btn" type="button" data-act="reply">${icon('reply')}Reply</button>
        ${many ? `<button class="btn" type="button" data-act="replyAll">${icon('replyAll')}Reply all</button>` : ''}
        <button class="btn" type="button" data-act="forward">${icon('forward')}Forward</button>
      </div>
    </article>`;
  $$('.tmsg.expanded', reader).forEach(mountCard);
  if (keepCompose) {
    $('.message .quick-reply', reader)?.replaceWith(keepCompose);
    const prev = $('.quoted .msg-frame', keepCompose);
    if (prev && S.compose?.src) mountEmail(prev, { html: quoteHtml(S.compose.mode, S.compose.src) }, true);
  }
  if (scrollTo && n > 1) {
    const target = reader.querySelector(`.tmsg[data-mid="${CSS.escape(scrollTo)}"]`);
    const bar = $('.reader-bar', reader);
    if (target) requestAnimationFrame(() => { reader.scrollTop = Math.max(0, target.offsetTop - (bar?.offsetHeight || 0) - 12); });
  } else if (scrollTo) {
    reader.scrollTop = 0;
  } else if (keepScroll !== null) {
    reader.scrollTop = keepScroll;
  }
  renderSidebar();
}

const VIEWABLE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
function attachmentHtml(a) {
  const viewable = VIEWABLE.includes((a.mimeType || '').toLowerCase());
  return `<li class="att" draggable="true" data-url="${esc(a.url)}" data-name="${esc(a.name)}" data-type="${esc(a.mimeType || 'application/octet-stream')}" data-size="${Number(a.size) || 0}" title="Drag into a folder to save it there">${icon((a.mimeType || '').startsWith('image/') ? 'image' : 'file')}
    <div class="meta"><div class="att-name" title="${esc(a.name)}">${esc(a.name)}</div><div class="att-size">${esc(size(a.size))}</div></div>
    ${viewable ? `<a class="icon-btn" href="${esc(a.url)}" target="_blank" rel="noopener" title="Open ${esc(a.name)}" aria-label="Open ${esc(a.name)}">${icon('open')}</a>` : ''}
    <a class="icon-btn" href="${esc(a.url)}&download=1" download="${esc(a.name)}" data-save-att title="Save ${esc(a.name)} to a folder you choose" aria-label="Save ${esc(a.name)}">${icon('download')}</a>
  </li>`;
}

// ---------- saving attachments where you want them ----------
const attDownloadUrl = (url) => new URL(`${url}&download=1`, location.href).href;
const safeFileName = (name) => String(name || 'attachment').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'attachment';

// Drag an attachment out of Mailroom and drop it in any folder on your computer (Chrome and Edge).
// Windows blocks files the browser downloads from this computer's own address (localhost),
// but allows files that are already inside the page. So each attachment is loaded into the
// page as soon as the email opens, and the drag hands over that copy.
const PRELOAD_MAX = 40 * 1024 * 1024; // bigger attachments load when you point at them
const preloaded = new Map(); // attachment url -> { url: blob url } once loaded, or { loading: promise }

function preload(li) {
  const key = li.dataset.url;
  if (preloaded.has(key)) return preloaded.get(key).loading;
  const entry = {};
  entry.loading = fetch(attDownloadUrl(key))
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
    .then((b) => { entry.url = URL.createObjectURL(new Blob([b], { type: li.dataset.type || b.type })); })
    .catch(() => preloaded.delete(key));
  preloaded.set(key, entry);
  return entry.loading;
}

// Load the attachments of whatever email is open, and let go of ones no longer shown.
new MutationObserver(() => {
  const shown = new Set($$('.att[data-url]', reader).map((li) => li.dataset.url));
  for (const [key, entry] of preloaded) {
    if (!shown.has(key)) { if (entry.url) URL.revokeObjectURL(entry.url); preloaded.delete(key); }
  }
  // Online: attachments load when you point at them or open them (saves data).
}).observe(reader, { childList: true, subtree: true });
reader.addEventListener('pointerover', (e) => { const li = e.target.closest?.('.att[data-url]'); if (li) preload(li); });

reader.addEventListener('dragstart', (e) => {
  const li = e.target.closest?.('.att[data-url]');
  if (!li) return;
  e.dataTransfer.effectAllowed = 'copy';
  const ready = preloaded.get(li.dataset.url)?.url;
  if (ready) e.dataTransfer.setData('DownloadURL', `${li.dataset.type}:${safeFileName(li.dataset.name)}:${ready}`);
  else { e.dataTransfer.setData('text/plain', li.dataset.name); toast('This attachment is still loading. Drop it on a “Save to” folder, or try again in a moment.'); }
});

async function attachmentBlob(url) {
  const res = await fetch(attDownloadUrl(url));
  if (!res.ok) throw new Error(`Couldn’t get the attachment (${res.status}).`);
  return res.blob();
}

// The download button asks where to save (and remembers the last folder you picked).
reader.addEventListener('click', async (e) => {
  const link = e.target.closest('a[data-save-att]');
  if (!link || !('showSaveFilePicker' in window)) return; // otherwise a normal download
  e.preventDefault();
  const li = link.closest('.att');
  try {
    const handle = await window.showSaveFilePicker({ suggestedName: safeFileName(li.dataset.name), id: 'mailroom-attachments', startIn: 'downloads' });
    const blob = await attachmentBlob(li.dataset.url);
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
    toast(`Saved ${handle.name}`);
  } catch (err) {
    if (err.name !== 'AbortError') toast(err.message || 'Couldn’t save the attachment.', { error: true });
  }
});

// ---------- "Save to" folders: drag an attachment onto one and Control Center saves it there ----------
S.folders = [];
async function loadFolders() {
  try { S.folders = await api('GET', '/mail/api/folders'); } catch { /* keep */ }
}
loadFolders();

function saveToHtml(m) {
  const many = m.attachments.length > 1;
  const chips = S.folders.map((f) => `<span class="folder-chip${f.missing ? ' missing' : ''}" role="button" tabindex="0" data-folder="${esc(f.path)}" data-mid="${esc(m.id)}"
      title="${esc(f.path)}${f.missing ? ' (this folder no longer exists)' : `\nDrop an attachment here to save it, or click to save ${many ? 'all attachments' : 'the attachment'} here`}">${icon('folderOpen')}<span class="fc-name">${esc(f.name)}</span><button class="fc-x" type="button" data-remove-folder="${esc(f.path)}" aria-label="Remove ${esc(f.name)} from this list" title="Remove from this list">${icon('close')}</button></span>`).join('');
  return `<div class="save-to" data-mid="${esc(m.id)}"><span class="save-label">Save to</span>${chips}<button class="folder-chip add" type="button" data-add-folder>${icon('plus')}Add folder</button></div>
    <p class="att-hint">Drag an attachment into any folder on your computer, or onto one of these${many ? ' (click one to save them all there)' : ''}.</p>`;
}

function refreshSaveTo() {
  $$('.save-to', reader).forEach((el) => {
    const m = findInThread(el.dataset.mid);
    if (m) { el.nextElementSibling?.remove(); el.outerHTML = saveToHtml(m); }
  });
}

async function saveToFolder(att, folder) {
  try {
    const r = await api('POST', `${att.url.split('?')[0]}/save`, { folder, name: att.name });
    S.folders = r.folders;
    refreshSaveTo();
    toast(`Saved ${r.name} to ${folderName(folder)}`, { action: { label: 'Show in folder', fn: () => api('POST', '/mail/api/folders/reveal', { file: r.file }).catch((e) => toast(e.message, { error: true })) } });
  } catch (err) {
    toast(`${att.name}: ${err.message}`, { error: true });
  }
}
const folderName = (p) => S.folders.find((f) => f.path === p)?.name || p;

async function addFolder() {
  try {
    const r = await api('POST', '/mail/api/folders/pick');
    if (!r.picked) return; // cancelled
    S.folders = r.folders;
    refreshSaveTo();
  } catch {
    // No folder window on this computer: ask for the location instead.
    const p = window.prompt('Paste the location of the folder (for example C:\\Users\\you\\Documents\\Invoices):');
    if (!p) return;
    try { S.folders = await api('POST', '/mail/api/folders', { path: p }); refreshSaveTo(); } catch (e) { toast(e.message, { error: true }); }
  }
}

let dragAtt = null; // the attachment being dragged
reader.addEventListener('dragstart', (e) => {
  const li = e.target.closest?.('.att[data-url]');
  dragAtt = li ? { url: li.dataset.url, name: li.dataset.name } : null;
  if (li) reader.classList.add('dragging-att');
});
reader.addEventListener('dragend', () => { dragAtt = null; reader.classList.remove('dragging-att'); $$('.folder-chip.over', reader).forEach((c) => c.classList.remove('over')); });
reader.addEventListener('dragover', (e) => {
  const chip = e.target.closest?.('.folder-chip[data-folder]');
  if (!chip || !dragAtt) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  chip.classList.add('over');
});
reader.addEventListener('dragleave', (e) => {
  const chip = e.target.closest?.('.folder-chip[data-folder]');
  if (chip && !chip.contains(e.relatedTarget)) chip.classList.remove('over');
});
reader.addEventListener('drop', (e) => {
  const chip = e.target.closest?.('.folder-chip[data-folder]');
  if (!chip || !dragAtt) return;
  e.preventDefault();
  chip.classList.remove('over');
  saveToFolder(dragAtt, chip.dataset.folder);
  dragAtt = null;
});

reader.addEventListener('click', async (e) => {
  const x = e.target.closest('[data-remove-folder]');
  if (x) {
    e.stopPropagation();
    try { S.folders = await api('POST', '/mail/api/folders/remove', { path: x.dataset.removeFolder }); refreshSaveTo(); } catch (err) { toast(err.message, { error: true }); }
    return;
  }
  if (e.target.closest('[data-add-folder]')) { addFolder(); return; }
  const chip = e.target.closest('.folder-chip[data-folder]');
  if (chip) {
    const m = findInThread(chip.dataset.mid);
    for (const a of m?.attachments || []) await saveToFolder(a, chip.dataset.folder);
  }
});
reader.addEventListener('keydown', (e) => {
  const chip = e.target.closest?.('.folder-chip[data-folder]');
  if (chip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); chip.click(); }
});

reader.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  const m = S.cur;
  const card = b.dataset.mid ? findInThread(b.dataset.mid) : null;
  switch (act) {
    case 'back': app.classList.remove('reading'); break;
    case 'retry': if (S.sel) openMessage(S.sel); break;
    case 'reply': case 'replyAll': case 'forward': {
      // Like Gmail: if you already started a reply here, Reply opens it again instead of a second one.
      const d = act !== 'forward' && !card ? threadDraft() : null;
      if (d) { openDraft(d, { inline: true }); break; }
      // The buttons on a message answer that message; the others answer the newest one.
      const target = card || replyTarget();
      if (target) openCompose(act, target);
      break;
    }
    case 'editDraft': {
      const d = findInThread(b.dataset.mid);
      if (d) openDraft(d, { inline: true });
      break;
    }
    case 'discardDraft': {
      const d = findInThread(b.dataset.mid);
      if (!d || !window.confirm('Discard this draft?')) break;
      b.disabled = true;
      api('DELETE', `/mail/api/accounts/${d.accountId}/drafts/by-message/${encodeURIComponent(d.id)}`)
        .then(() => {
          toast('Draft discarded');
          S.thread = S.thread.filter((t) => t.id !== d.id);
          forgetDraftMarks(d.accountId);
          if (S.cur) renderMessage(S.cur);
        })
        .catch((err) => { b.disabled = false; reportError(err); });
      break;
    }
    case 'toggleMsg': {
      if (!card || S.thread.length < 2) break;
      // Selecting text or clicking a link in the header shouldn't fold the message.
      if (b.classList.contains('msg-meta') && (getSelection().toString() || e.target.closest('a'))) break;
      const opening = !S.expanded.has(card.id);
      if (opening) S.expanded.add(card.id); else S.expanded.delete(card.id);
      const fresh = redrawCard(card.id);
      // Keep keyboard focus on the same message's fold/open control.
      const ctl = fresh && $(opening ? '.card-acts [data-act="toggleMsg"]' : '.tmsg-line', fresh);
      if (ctl && e.detail === 0) ctl.focus();
    }
      { const btn = $('[data-act="expandAll"]', reader); if (btn) btn.textContent = S.expanded.size === S.thread.length ? 'Fold older messages' : 'Open all'; }
      break;
    case 'expandAll': {
      const all = S.expanded.size === S.thread.length;
      S.expanded = all ? new Set([replyTarget().id]) : new Set(S.thread.map((t) => t.id));
      renderMessage(m);
      break;
    }
    case 'toggleQuoted':
      if (!card) break;
      if (S.showQuoted.has(card.id)) S.showQuoted.delete(card.id); else S.showQuoted.add(card.id);
      redrawCard(card.id);
      break;
    case 'showImages':
      S.showImages = true;
      $('#imgNotice')?.remove();
      $$('.tmsg.expanded', reader).forEach(mountCard);
      break;
    case 'trustSender':
      S.thread.filter((t) => !imagesAllowed(t)).forEach((t) => S.trustedSenders.add(t.from.email.toLowerCase()));
      store.set('trustedSenders', [...S.trustedSenders]);
      $('#imgNotice')?.remove();
      $$('.tmsg.expanded', reader).forEach(mountCard);
      break;
    default:
      if (m) messageAction(act);
  }
});

// ---------- archive, delete, star... ----------
const LEAVES_FOLDER = {
  archive: (f) => f !== 'archive',
  trash: (f) => f !== 'trash',
  spam: (f) => f !== 'spam',
  inbox: (f) => f !== 'inbox',
};
const DONE = { archive: 'Archived', trash: 'Moved to trash', spam: 'Marked as spam', inbox: 'Moved to inbox' };

async function messageAction(act, m = S.cur && S.msgs.find((x) => keyOf(x) === keyOf(S.cur))) {
  const target = m || S.cur;
  if (!target) return;
  const group = groupOf(target);
  // Archive, delete, spam and "move to inbox" act on the whole conversation in this list.
  const members = group ? group.members : [target];

  if (['read', 'unread', 'star', 'unstar'].includes(act)) {
    const field = act.endsWith('read') ? 'unread' : 'starred';
    const value = act === 'unread' || act === 'star';
    // Mark read covers the whole conversation; unread and star the message you're on.
    const affected = act === 'read' ? members : (m ? [m] : []);
    affected.forEach((x) => { x[field] = value; });
    if (m || affected.length) updateRow(m || affected[0]);
    if (S.cur && keyOf(S.cur) === keyOf(target)) { S.cur[field] = value; renderMessage(S.cur); }
    if (act === 'unread' && m) {
      // Marking unread usually means "deal with it later": go back to the list.
      S.sel = null; updateRow(m); showEmptyReader();
    }
    (act === 'read' ? members : [target]).forEach((x) => runAction(x, act, { quiet: x !== target }));
    return;
  }

  const leaving = LEAVES_FOLDER[act]?.(S.folder) && !(S.folder === 'starred' && act === 'archive');
  const fromFolder = S.folder;
  if (leaving && group) {
    const order = shownGroups();
    const pos = order.findIndex((g) => g.key === group.key);
    const keys = new Set(members.map(keyOf));
    S.msgs = S.msgs.filter((x) => !keys.has(keyOf(x)));
    // Open the conversation that's now next on screen (below it, or above if it was last).
    const next = order[pos + 1] || order[pos - 1];
    renderList();
    if (next && window.innerWidth > 860) openMessage(keyOf(next.latest));
    else { S.sel = null; showEmptyReader(); }
  }
  const results = await Promise.all(members.map((x) => runAction(x, act, { quiet: x !== target })));
  if (results.some((r) => !r)) {
    loadList({ keep: true });
    if (!results.some(Boolean)) return;
  }
  const undoable = fromFolder === 'inbox' && ['archive', 'trash', 'spam'].includes(act);
  // Reporting junk also sends everything from that sender to junk from now on (no need to ask).
  const toBlock = act === 'spam' ? blockable([target.from?.email]) : [];
  const blocking = autoBlock(toBlock);
  const actions = [];
  if (undoable) {
    actions.push({
      label: 'Undo',
      fn: async () => {
        await unblockQuietly(await blocking);
        const back = await Promise.all(members.map((x, i) => (results[i] ? runAction({ ...x, id: results[i].id || x.id }, 'inbox') : null)));
        if (back.some(Boolean)) { toast('Moved back to inbox'); loadList({ keep: true }); }
      },
    });
  }
  let done = DONE[act] || 'Done';
  if (act === 'inbox' && results.some((r) => r?.reported)) done = 'Marked as not junk and moved to Inbox';
  if (act === 'spam') {
    const outlook = acct(target.accountId)?.kind === 'outlook';
    const reported = results.some((r) => r?.reported);
    done = reported
      ? (outlook ? 'Reported as junk to Microsoft and moved to Junk' : 'Reported as spam to Google and moved to Spam')
      : (outlook ? 'Moved to Junk (Microsoft’s report wasn’t available just now)' : 'Moved to Spam');
    if (toBlock.length) done += `. Future mail from ${toBlock[0]} goes straight to junk`;
  }
  toast(done, { actions, timeout: act === 'spam' ? 12000 : 6000 });
}

// Senders that reporting junk should block: not you, not an important sender, not already blocked.
function blockable(emails) {
  const mine = myAddresses();
  const important = (e) => S.importantSenders.some((rule) => {
    const r = String(rule).toLowerCase().trim().replace(/^@/, '');
    return r && (r.includes('@') ? e === r : e.endsWith(`@${r}`) || e.endsWith(`.${r}`));
  });
  return [...new Set(emails.map((e) => String(e || '').toLowerCase().trim()))]
    .filter((e) => e && !mine.has(e) && !important(e) && !S.blockedSenders.includes(e));
}

// Adds senders to the blocked list without asking. Mailroom then also moves their other
// inbox emails to junk. Returns the senders that were added (so Undo can take them off).
async function autoBlock(senders) {
  if (!senders.length) return [];
  try {
    const st = await api('POST', '/mail/api/notify/blocked', { add: senders });
    S.blockedSenders = st.blockedSenders;
    if (st.moved) loadList({ keep: true });
    if (S.view === 'settings') renderBlockedList();
    return senders;
  } catch (e) { toast(e.message, { error: true }); return []; }
}

async function unblockQuietly(senders) {
  for (const s of senders) {
    try { S.blockedSenders = (await api('POST', '/mail/api/notify/blocked', { remove: s })).blockedSenders; } catch { /* stays blocked */ }
  }
  if (S.view === 'settings') renderBlockedList();
}

async function blockSender(rule) {
  try {
    const st = await api('POST', '/mail/api/notify/blocked', { add: rule });
    S.blockedSenders = st.blockedSenders;
    toast(st.moved ? `Blocked ${rule}. Moved ${st.moved} more of their emails to junk.` : `Blocked ${rule}. Their future emails go straight to junk.`, { timeout: 7000 });
    if (st.moved) loadList({ keep: true });
    if (S.view === 'settings') renderBlockedList();
  } catch (e) { toast(e.message, { error: true }); }
}

async function unblockSender(rule) {
  try {
    const st = await api('POST', '/mail/api/notify/blocked', { remove: rule });
    S.blockedSenders = st.blockedSenders;
    toast(`${rule} is no longer blocked. Emails already in junk stay there.`, { timeout: 6000 });
    renderBlockedList();
  } catch (e) { toast(e.message, { error: true }); }
}

function renderBlockedList() {
  const ul = $('#blockedList', reader);
  if (!ul) return;
  ul.innerHTML = S.blockedSenders.length
    ? S.blockedSenders.map((r) => `<li><span>${esc(r)}</span><button class="btn small ghost" type="button" data-unblock="${esc(r)}">Unblock</button></li>`).join('')
    : '<li class="muted">No blocked senders.</li>';
}

async function runAction(m, act, { quiet = false } = {}) {
  try {
    const r = await api('POST', `/mail/api/accounts/${m.accountId}/messages/${encodeURIComponent(m.id)}/action`, { action: act });
    refreshUnread();
    return r || {};
  } catch (e) {
    if (!quiet || e.reconnect) reportError(e, acct(m.accountId));
    return null;
  }
}

// detect: true only for the regular check. After your own actions (like marking
// something unread) the count changes too, and that shouldn't sound like new mail.
async function refreshUnread() {
  const results = await Promise.allSettled(usable().map((a) => api('GET', `/mail/api/accounts/${a.id}/unread`).then((r) => [a.id, r.unread])));
  for (const r of results) if (r.status === 'fulfilled') S.unread[r.value[0]] = r.value[1];
  renderSidebar();
}

// ---------- noticing new mail ----------
// The Mailroom program checks every account every 15 seconds and plays the sounds.
// This page asks it what happened, every 15 seconds, and shows it.
function applyNotify(st, { events = true } = {}) {
  S.alerts = st.alerts || [];
  S.blinking = new Set(st.blinking || []);
  S.soundOn = st.soundOn !== false;
  S.importantSenders = st.importantSenders || [];
  S.blockedSenders = st.blockedSenders || [];
  S.serverSound = !!st.serverSound;
  const fresh = events && S.notifySeq !== null ? (st.events || []) : [];
  S.notifySeq = st.seq;
  renderAlerts();
  if (!fresh.length) return;
  const important = fresh.filter((e) => e.type === 'important');
  const normal = fresh.filter((e) => e.type === 'new' && e.unread);
  // The program plays the sound; only play it here if it can't (not Windows or Mac).
  if (!S.serverSound && S.soundOn) {
    if (important.length) playAlarm();
    else if (normal.some((e) => !acct(e.accountId)?.muted)) playChime();
  }
  showPopups(important, normal.filter((e) => !acct(e.accountId)?.muted));
  refreshUnread();
  if (!S.loading) loadList({ keep: true });
}

let notifyBusy = false;
async function pollNotify({ checkNow = false } = {}) {
  if (notifyBusy) return;
  notifyBusy = true;
  try {
    const after = S.notifySeq ?? -1;
    const st = checkNow
      ? await api('POST', '/mail/api/notify/check', { after })
      : await api('GET', `/mail/api/notify?after=${after}`);
    applyNotify(st);
  } catch { /* Mailroom program not reachable; try again next time */ } finally {
    notifyBusy = false;
  }
}

// You looked at an account: tell the program to stop its blinking.
function ackAccount(id) {
  if (!S.blinking.delete(id) && id !== 'all') return;
  if (id === 'all') S.blinking.clear();
  api('POST', '/mail/api/notify/ack', { accountId: id }).catch(() => {});
  renderSidebar();
}

// ---------- Windows pop-up notifications ----------
function showPopups(important, normal) {
  if (!S.popups || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!document.hidden && document.hasFocus()) return; // you're already looking at Mailroom
  const pop = (title, body, tag, urgent) => {
    try {
      const n = new Notification(title, { body, tag, icon: 'icon.svg', requireInteraction: urgent, silent: true });
      n.onclick = () => { window.focus(); window.parent.postMessage({ cc: 'show', app: 'mail' }, location.origin); n.close(); };
    } catch { /* not allowed */ }
  };
  for (const e of important) {
    pop(`Important: ${personLabel(e.from) || e.from?.email}`, `${e.subject || '(no subject)'}\nto ${acct(e.accountId)?.email || ''}`, `imp-${e.id}`, true);
  }
  if (normal.length === 1) {
    const e = normal[0];
    pop(personLabel(e.from) || e.from?.email || 'New mail', `${e.subject || '(no subject)'}\nto ${acct(e.accountId)?.email || ''}`, `new-${e.id}`, false);
  } else if (normal.length > 1) {
    pop(`${normal.length} new emails`, [...new Set(normal.map((e) => acct(e.accountId)?.email))].join(', '), 'new-batch', false);
  }
}

async function setPopups(on) {
  if (on) {
    if (!('Notification' in window)) { toast('This browser can’t show pop-up notifications.', { error: true }); on = false; }
    else if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { toast('Pop-ups are blocked. Allow notifications for localhost:4777 in the browser’s site settings.', { error: true, timeout: 9000 }); on = false; }
    }
  }
  S.popups = on;
  store.set('popups', on);
  const box = $('#popupSetting');
  if (box) box.checked = on;
  if (on) toast('Pop-ups are on. They appear when you’re not looking at Mailroom.');
}

// ---------- the tab title ----------
// While an important alert is on, the tab title flashes so you notice it from another tab.
let titleFlip = false;
setInterval(() => {
  const n = Object.values(S.unread).reduce((a, b) => a + b, 0);
  const normal = n ? `(${n}) Mailroom` : 'Mailroom';
  if (S.alerts.length) {
    titleFlip = !titleFlip;
    document.title = titleFlip ? `🔴 IMPORTANT EMAIL (${S.alerts.length})` : normal;
  } else if (document.title !== normal) {
    document.title = normal;
  }
}, 1000);

// ---------- the new-mail sound ----------
let audio = null;
function audioContext() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
  return audio;
}
// Browsers only allow sound after you've clicked or typed on the page once.
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (S.soundOn) audioContext(); }, { once: true, capture: true }));

function playChime({ test = false } = {}) {
  if (!S.soundOn && !test) return;
  if (S.serverSound) { api('POST', '/mail/api/sound/chime').catch(() => {}); return; }
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;
  [[880, 0], [1318.5, 0.14]].forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.25, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.65);
  });
}

// The important-sender sound: three sharp rising beeps, twice. Clearly different from the chime.
function playAlarm({ test = false } = {}) {
  if (!S.soundOn && !test) return;
  if (S.serverSound) { api('POST', '/mail/api/sound/alarm').catch(() => {}); return; }
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;
  const notes = [988, 1319, 1760];
  [0, 0.75].forEach((rep) => notes.forEach((freq, i) => {
    const t = now + rep + i * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.setValueAtTime(0.12, t + 0.1);
    gain.gain.linearRampToValueAtTime(0, t + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }));
}

// The red bar at the top of the message list, one line per important email.
function renderAlerts() {
  const bar = $('#alertBar');
  S.alerts = S.alerts.filter((x) => acct(x.accountId));
  const sig = JSON.stringify(S.alerts.map((x) => [x.accountId, x.id]));
  if (bar.dataset.sig === sig && !bar.hidden === !!S.alerts.length) { renderSidebar(); return; }
  bar.dataset.sig = sig;
  if (!S.alerts.length) { bar.hidden = true; bar.innerHTML = ''; renderSidebar(); return; }
  bar.hidden = false;
  bar.innerHTML = `
    ${S.alerts.map((x, i) => {
      const a = acct(x.accountId);
      return `<div class="alert-item" style="--acct:${a?.color || 'var(--danger)'}">
        ${icon('alarm')}
        <div class="alert-text">
          <div><b>${esc(personLabel(x.from) || x.from?.email || '')}</b> <span class="alert-addr">${esc(x.from?.email || '')}</span></div>
          <div class="alert-sub">${esc(x.subject || '(no subject)')}</div>
          <div class="alert-acct">to ${esc(a?.email || '')} · ${esc(shortDate(x.date))}</div>
        </div>
        <div class="alert-btns">
          <button class="btn small" type="button" data-alert="open" data-i="${i}">Open</button>
          <button class="btn small alert-off" type="button" data-alert="off" data-i="${i}">Turn off</button>
        </div>
      </div>`;
    }).join('')}
    ${S.alerts.length > 1 ? '<button class="btn small alert-off all" type="button" data-alert="all">Turn off all alerts</button>' : ''}`;
  renderSidebar();
}

$('#alertBar').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-alert]');
  if (!b) return;
  const x = S.alerts[Number(b.dataset.i)];
  if (b.dataset.alert === 'all' || (b.dataset.alert === 'off' && x)) {
    b.disabled = true;
    try {
      const st = await api('POST', '/mail/api/notify/alerts/off', b.dataset.alert === 'all' ? { all: true } : { accountId: x.accountId, id: x.id });
      applyNotify({ ...st, serverSound: S.serverSound }, { events: false });
    } catch (err) { toast(err.message, { error: true }); b.disabled = false; }
    return;
  }
  if (b.dataset.alert === 'open' && x) {
    // Show that account's inbox and open the email. The alert stays on until you turn it off.
    S.scope = x.accountId;
    S.folder = 'inbox';
    S.q = '';
    $('#search').value = '';
    renderSidebar();
    await loadList();
    const key = `${x.accountId}|${x.id}`;
    if (!S.msgs.some((m) => keyOf(m) === key)) {
      // Not among the newest in the list (or the list couldn't load): fetch that one email directly.
      try {
        const full = await api('GET', `/mail/api/accounts/${x.accountId}/messages/${encodeURIComponent(x.id)}`);
        S.msgs.unshift({ ...full, accountId: x.accountId });
        renderList();
      } catch (err) {
        toast(err.status === 404 ? 'That email was deleted or moved out of the inbox.' : `Couldn’t open that email: ${err.message}`, { error: err.status !== 404 });
        return;
      }
    }
    openMessage(key);
  }
});

function setSound(on) {
  S.soundOn = on;
  api('POST', '/mail/api/notify/settings', { soundOn: on }).catch((e) => toast(e.message, { error: true }));
  renderSidebar();
  const box = $('#soundSetting');
  if (box) box.checked = on;
  if (on) playChime();
  toast(on ? 'New-mail sound is on' : 'New-mail sound is off', { timeout: 2500 });
}

// ---------- writing messages ----------
function dedupe(list) {
  const seen = new Set();
  return list.filter((p) => {
    const k = p.email.toLowerCase();
    if (!p.email || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function recipientsFor(mode, src) {
  const me = myAddresses();
  const notMe = (p) => !me.has(p.email.toLowerCase());
  const fromMe = me.has((src.from.email || '').toLowerCase());
  const primary = fromMe ? src.to : (src.replyTo?.length ? src.replyTo : [src.from]);
  if (mode === 'reply') return { to: primary, cc: [] };
  if (mode === 'replyAll') {
    let to = dedupe([...primary, ...(fromMe ? [] : src.to)].filter(notMe));
    if (!to.length) to = primary;
    const toSet = new Set(to.map((p) => p.email.toLowerCase()));
    const cc = dedupe((src.cc || []).filter(notMe).filter((p) => !toSet.has(p.email.toLowerCase())));
    return { to, cc };
  }
  return { to: [], cc: [] };
}

function subjectFor(mode, subject = '') {
  if (mode === 'forward') return /^\s*(fwd?|fw):/i.test(subject) ? subject : `Fwd: ${subject}`;
  return /^\s*re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function originalBodyHtml(src) {
  if (!src.html) return `<div style="white-space:pre-wrap">${linkify(esc(src.text || ''))}</div>`;
  return cleanEmail(src.html).body.innerHTML;
}

function quoteHtml(mode, src) {
  const body = originalBodyHtml(src);
  if (mode === 'forward') {
    const line = (k, v) => (v ? `${k}: ${esc(v)}<br>` : '');
    return `<br><div>---------- Forwarded message ---------<br>${line('From', formatAddr(src.from))}${line('Date', longDate(src.date))}${line('Subject', src.subject)}${line('To', src.to.map(formatAddr).join(', '))}${line('Cc', (src.cc || []).map(formatAddr).join(', '))}</div><br>${body}`;
  }
  return `<br><div>On ${esc(longDate(src.date))}, ${esc(formatAddr(src.from))} wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${body}</blockquote>`;
}

function quoteText(mode, src) {
  const text = src.text || new DOMParser().parseFromString(src.html || '', 'text/html').body.innerText || '';
  if (mode === 'forward') return `\n\n---------- Forwarded message ---------\nFrom: ${formatAddr(src.from)}\nDate: ${longDate(src.date)}\nSubject: ${src.subject}\nTo: ${src.to.map(formatAddr).join(', ')}\n\n${text}`;
  return `\n\nOn ${longDate(src.date)}, ${formatAddr(src.from)} wrote:\n${text.split('\n').map((l) => `> ${l}`).join('\n')}`;
}

const signatureBlock = (a) => (a?.signature ? `<div><br></div><div data-signature>${a.signature}</div>` : '');

// Leaving the message you're writing saves it to Drafts (like Gmail) instead of asking.
async function confirmLeaveCompose() {
  if (S.view !== 'compose' || !S.compose) return true;
  if (!composeIsDirty() && !S.compose.draft) return true;
  const ok = await saveDraft({ leaving: true });
  if (ok) return true;
  return window.confirm('This message couldn’t be saved to Drafts. Leave and lose it?');
}

// ---------- drafts ----------
// Drafts are saved in the account itself (Gmail's or Outlook's Drafts folder), so they also
// show up on the Gmail/Outlook website and phone app. Mailroom saves a few seconds after you
// stop typing, and right away when you leave the message.

function composePayload(form, c) {
  const editor = $('.editor', form);
  // Pictures without a set size would arrive at full size: give them the size you see here.
  editor.querySelectorAll('img:not([width])').forEach((img) => {
    const w = Math.round(img.getBoundingClientRect().width);
    if (w > 0) { img.setAttribute('width', String(w)); img.style.width = `${w}px`; img.style.maxWidth = '100%'; img.style.height = 'auto'; }
  });
  const includeQuote = !!c.src && (form.includeQuote ? form.includeQuote.checked : false);
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${editor.innerHTML.replace(/ data-signature=""/g, '').replace(/\u200B/g, '')}</div>`;
  return {
    mode: c.mode,
    sourceId: c.src?.id,
    to: form.to.value,
    cc: form.cc.value,
    bcc: form.bcc.value,
    subject: form.subject.value,
    html: bodyHtml + (includeQuote ? quoteHtml(c.mode, c.src) : ''),
    text: editor.innerText + (includeQuote ? quoteText(c.mode, c.src) : ''),
    attachments: c.attachments.map(({ name, type, data, serverId }) => ({ name, type, ...(data ? { data } : {}), ...(serverId ? { serverId } : {}) })),
    includeOriginalAttachments: form.includeOriginalAttachments ? form.includeOriginalAttachments.checked : true,
    draftId: c.draft?.id,
    threadId: c.resume?.threadId,
    inReplyTo: c.resume?.inReplyTo,
    references: c.resume?.references,
    removedAttachmentIds: c.removedServerIds || [],
  };
}

// A fingerprint of what's in the box, to know whether anything changed since the last save.
const payloadKey = (p) => JSON.stringify({ ...p, attachments: p.attachments.map((a) => [a.name, a.serverId || (a.data || '').length]), removedAttachmentIds: undefined });

function setDraftStatus(text) {
  const el = $('#composeForm .draft-status');
  if (el) el.textContent = text;
}

function scheduleDraftSave() {
  const c = S.compose;
  if (!c || c.sending) return;
  clearTimeout(c.saveTimer);
  c.saveTimer = setTimeout(() => saveDraft(), 3000);
}

async function saveDraft({ leaving = false } = {}) {
  const c = S.compose;
  const form = $('#composeForm');
  if (!c || !form || c.sending) return true;
  clearTimeout(c.saveTimer);
  if (c.saving) await c.saving.catch(() => {}); // one save at a time
  if (S.compose !== c) return true;
  if (!c.draft && !composeIsDirty()) return true; // nothing written yet
  const payload = composePayload(form, c);
  const key = payloadKey(payload);
  if (c.draft && key === c.savedKey && !payload.removedAttachmentIds.length) {
    if (leaving) toast('Saved to Drafts');
    return true;
  }
  const a = acct(c.from);
  setDraftStatus('Saving…');
  const run = (async () => {
    const r = await api('POST', `/mail/api/accounts/${c.from}/drafts`, payload);
    if (S.compose !== c && !leaving) return r;
    c.draft = { id: r.draftId, messageId: r.messageId };
    c.savedKey = key;
    c.removedServerIds = [];
    // Outlook keeps the files on the draft, so they don't need sending again next time.
    if (Array.isArray(r.files)) {
      const free = [...r.files];
      for (const att of c.attachments) {
        if (att.serverId) { const i = free.findIndex((f) => f.serverId === att.serverId); if (i >= 0) free.splice(i, 1); continue; }
        const i = free.findIndex((f) => f.name === att.name && Math.abs(f.size - att.size) < 64 * 1024);
        if (i >= 0) { att.serverId = free[i].serverId; delete att.data; free.splice(i, 1); }
      }
    }
    return r;
  })();
  c.saving = run;
  try {
    await run;
    setDraftStatus(`Saved to Drafts ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    if (leaving) toast('Saved to Drafts');
    if (S.folder === 'drafts' && S.view !== 'compose') loadList({ keep: true });
    if (leaving) forgetDraftMarks(c.from);
    return true;
  } catch (e) {
    setDraftStatus('Not saved');
    if (leaving || e.reconnect) reportError(e, e.reconnect ? a : null);
    return false;
  } finally {
    if (c.saving === run) c.saving = null;
  }
}

async function discardDraft() {
  const c = S.compose;
  if (!c) return;
  clearTimeout(c.saveTimer);
  c.sending = true; // stops any more saving
  if (c.saving) await c.saving.catch(() => {});
  const id = c.draft?.id;
  closeCompose();
  if (id) {
    try {
      await api('DELETE', `/mail/api/accounts/${c.from}/drafts/${encodeURIComponent(id)}`);
      toast('Draft discarded');
      forgetDraftMarks(c.from);
    } catch (e) {
      reportError(e);
    }
    if (S.folder === 'drafts') loadList({ keep: true });
  }
}

// Opening something in the Drafts folder picks up writing where you left off.
async function openDraft(m, { inline = false } = {}) {
  const a = acct(m.accountId);
  if (!a || a.needsReconnect) { reportError({ reconnect: true, message: '' }, a); return; }
  let d;
  try {
    d = await api('GET', `/mail/api/accounts/${m.accountId}/drafts/by-message/${encodeURIComponent(m.id)}`);
  } catch (e) {
    reportError(e, e.reconnect ? a : null);
    if (e.status === 404) loadList({ keep: true });
    return;
  }
  // Files on a Gmail draft are rebuilt into the message on every save, so fetch them now.
  // Outlook keeps them on the draft, so they're just listed.
  const attachments = [];
  for (const x of d.attachments || []) {
    const item = { name: x.name, type: x.mimeType || 'application/octet-stream', size: x.size || 0 };
    if (a.provider === 'outlook') item.serverId = x.serverId || x.id;
    else {
      try {
        const blob = await fetch(x.url, { headers: { 'X-Mailroom': '1' } }).then((r) => (r.ok ? r.blob() : Promise.reject()));
        item.data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(blob); });
        item.size = blob.size;
      } catch { toast(`Couldn’t load ${x.name} from the draft.`, { error: true }); continue; }
    }
    attachments.push(item);
  }
  // Take off the outer wrapper Mailroom adds when saving, so it doesn't pile up.
  let body = d.html ? cleanEmail(d.html).body.innerHTML : `<div style="white-space:pre-wrap">${linkify(esc(d.text || ''))}</div>`;
  const wrap = new DOMParser().parseFromString(body, 'text/html').body;
  const only = wrap.children.length === 1 ? wrap.firstElementChild : null;
  if (only && only.tagName === 'DIV' && /font-family:\s*Arial/i.test(only.getAttribute('style') || '') && /line-height:\s*1\.5/.test(only.getAttribute('style') || '')) body = only.innerHTML;
  await openCompose('draft', null, {
    from: m.accountId,
    to: d.to || [], cc: d.cc || [], bcc: d.bcc || [],
    subject: d.subject || '',
    body,
    attachments,
    draft: { id: d.draftId, messageId: d.id },
    resume: { threadId: d.threadId, inReplyTo: d.inReplyTo || '', references: d.references || '' },
    inline,
  });
}

function composeIsDirty() {
  const c = S.compose;
  if (!c) return false;
  const form = $('#composeForm');
  if (!form) return false;
  const editorText = $('.editor', form).innerText.replace(/\s+/g, ' ').trim();
  const sigText = (new DOMParser().parseFromString(acct(c.from)?.signature || '', 'text/html').body.innerText || '').replace(/\s+/g, ' ').trim();
  return c.attachments.length > 0 || (editorText && editorText !== sigText) || (c.mode === 'new' && (form.to.value.trim() || form.subject.value.trim()));
}

async function openCompose(mode, src = null, resumed = null) {
  if (!(await confirmLeaveCompose())) return;
  const accounts = usable();
  if (!accounts.length) {
    toast('Connect an account before writing a message.');
    openSettings();
    return;
  }
  const from = resumed ? resumed.from : src ? src.accountId : (S.scope !== 'all' && acct(S.scope) && !acct(S.scope).needsReconnect ? S.scope : accounts[0].id);
  const fromAcct = acct(from);
  if (!fromAcct || fromAcct.needsReconnect) {
    reportError({ reconnect: true, message: '' }, fromAcct);
    return;
  }
  const { to, cc } = resumed ? resumed : src ? recipientsFor(mode, src) : { to: [], cc: [] };
  const bcc = resumed?.bcc || [];
  // Replies and forwards open under the conversation, so you can still read it while you write.
  const inline = (!!src && S.view === 'message' && !!findInThread(src.id) && !!$('.message .thread', reader))
    || (!!resumed?.inline && S.view === 'message' && !!$('.message .thread', reader));
  S.compose = {
    mode, src, from, attachments: resumed?.attachments || [], includeQuote: !!src, includeOriginalAttachments: true, inline,
    draft: resumed?.draft || null, resume: resumed?.resume || null, removedServerIds: [],
  };
  S.view = 'compose';
  app.classList.add('reading');

  const title = { new: 'New message', reply: 'Reply', replyAll: 'Reply all', forward: 'Forward', draft: 'Draft' }[mode];
  const srcAtts = mode === 'forward' ? (src?.attachments || []) : [];
  const html = `
    <form class="compose${inline ? ' inline' : ''}" id="composeForm" novalidate autocomplete="off">
      <div class="reader-bar${inline ? ' compose-head' : ''}">
        <button class="icon-btn back-btn" type="button" data-c="close" aria-label="Close">${icon('back')}</button>
        <h2 class="bar-title">${title}</h2><span class="spacer"></span>
        <button class="icon-btn" type="button" data-c="close" aria-label="Close without sending" title="Close">${icon('close')}</button>
      </div>
      <div class="fields">
        <label class="field"><span>From</span>
          <select name="from" ${src ? 'disabled title="Replies are sent from the account that received the message"' : resumed ? 'disabled title="A draft is sent from the account it’s saved in"' : ''}>
            ${accounts.map((a) => `<option value="${a.id}"${a.id === from ? ' selected' : ''}>${esc(a.name ? `${a.name} <${a.email}>` : a.email)}</option>`).join('')}
          </select></label>
        <label class="field"><span>To</span><input name="to" value="${esc(to.map(formatAddr).join(', '))}${to.length ? ', ' : ''}" spellcheck="false">
          <span class="cc-toggles"><button type="button" data-c="cc"${cc.length ? ' hidden' : ''}>Cc</button><button type="button" data-c="bcc"${bcc.length ? ' hidden' : ''}>Bcc</button></span></label>
        <label class="field" data-f="cc"${cc.length ? '' : ' hidden'}><span>Cc</span><input name="cc" value="${esc(cc.map(formatAddr).join(', '))}" spellcheck="false"></label>
        <label class="field" data-f="bcc"${bcc.length ? '' : ' hidden'}><span>Bcc</span><input name="bcc" value="${esc(bcc.map(formatAddr).join(', '))}" spellcheck="false"></label>
        <label class="field"><span>Subject</span><input name="subject" value="${esc(resumed ? resumed.subject : src ? subjectFor(mode, src.subject) : '')}"></label>
      </div>
      ${fmtBarHtml()}
      <div class="editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Message">${resumed ? (resumed.body || '<div><br></div>') : `<div><br></div>${signatureBlock(fromAcct)}`}</div>
      ${src ? `
      <div class="quoted">
        <div class="quoted-head">
          <label><input type="checkbox" name="includeQuote" checked> Include the original message</label>
          <button class="btn small ghost" type="button" data-c="toggleQuote">Show</button>
        </div>
        <div class="frame-wrap" hidden><iframe class="msg-frame" title="Original message"></iframe></div>
      </div>` : ''}
      ${srcAtts.length ? `<div class="quoted"><div class="quoted-head"><label><input type="checkbox" name="includeOriginalAttachments" checked>
        Include the original attachments (${srcAtts.map((a) => esc(a.name)).join(', ')})</label></div></div>` : ''}
      <ul class="c-atts" aria-label="Attached files"></ul>
      <div class="compose-foot">
        <button class="btn primary" type="submit">${icon('send')}Send</button>
        <label class="btn ghost" title="Attach files">${icon('clip')}Attach files<input type="file" multiple hidden name="files"></label>
        <span class="hint">Ctrl+Enter sends. You can also drop files here.</span>
        <span class="draft-status" aria-live="polite">${resumed ? 'Saved in Drafts' : ''}</span>
        <button class="btn ghost danger" type="button" data-c="discard">${icon('trash')}Discard</button>
      </div>
    </form>`;
  if (inline) {
    // The saved draft's card is replaced by the writing box itself.
    $$('.message .draft-card', reader).forEach((x) => x.remove());
    // Swap the Reply/Forward buttons under the conversation for the writing box.
    const spot = $('.message .quick-reply', reader);
    const wrap = document.createElement('div');
    wrap.className = 'inline-compose';
    wrap.innerHTML = html;
    if (spot) spot.replaceWith(wrap); else $('.message', reader).append(wrap);
  } else {
    reader.innerHTML = html;
  }

  const form = $('#composeForm');
  const editor = $('.editor', form);
  if (src) {
    const preview = $('.quoted .msg-frame', form);
    if (preview) mountEmail(preview, { html: quoteHtml(mode, src) }, true);
  }
  // Put the cursor where you'd start typing.
  if (mode === 'new') form.to.focus();
  else if (mode === 'forward') form.to.focus();
  else if (mode === 'draft') {
    if (!form.to.value.trim()) form.to.focus();
    else editor.focus();
  }
  else {
    editor.focus();
    const r = document.createRange();
    r.setStart(editor.firstChild, 0);
    r.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  }
  ['to', 'cc', 'bcc'].forEach((n) => attachAutocomplete(form[n]));
  if (S.compose.attachments.length) renderComposeAttachments();
  if (resumed) S.compose.savedKey = payloadKey(composePayload(form, S.compose));
  if (inline) {
    // Show the end of the message you're answering just above the writing box.
    const top = form.closest('.inline-compose').offsetTop;
    reader.scrollTop = Math.max(0, top - Math.min(220, reader.clientHeight * 0.3));
  }
  renderSidebar();
}

function renderComposeAttachments() {
  const list = $('#composeForm .c-atts');
  if (!list) return;
  list.innerHTML = S.compose.attachments.map((a, i) => `
    <li>${icon('file')}<span>${esc(a.name)} <span class="muted">${esc(size(a.size))}</span></span>
      <button class="icon-btn" type="button" data-c="removeAtt" data-i="${i}" aria-label="Remove ${esc(a.name)}">${icon('close')}</button></li>`).join('');
}

async function addFiles(files) {
  for (const file of files) {
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    }).catch(() => null);
    if (data === null) { toast(`Couldn’t read ${file.name}.`, { error: true }); continue; }
    S.compose.attachments.push({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data });
  }
  renderComposeAttachments();
}

// ---------- pictures in the message: click one to resize or remove it ----------
const picTools = document.createElement('div');
picTools.className = 'pic-tools';
picTools.hidden = true;
picTools.innerHTML = `
  <div class="pic-frame"><span class="pic-handle" title="Drag to resize"></span></div>
  <div class="pic-bar" role="toolbar" aria-label="Picture">
    <button type="button" data-pic="200">Small</button>
    <button type="button" data-pic="400">Medium</button>
    <button type="button" data-pic="600">Large</button>
    <button type="button" data-pic="fit">Fit width</button>
    <button type="button" data-pic="remove" class="danger">Remove</button>
  </div>`;
document.body.append(picTools);
let picSel = null;

function setPicWidth(img, w) {
  const editor = img.closest('.editor');
  const max = editor ? editor.clientWidth - 48 : 800;
  w = Math.round(Math.max(40, Math.min(w, max)));
  img.setAttribute('width', String(w));
  img.removeAttribute('height');
  img.style.width = `${w}px`;
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  scheduleDraftSave();
  placePicTools();
}

function placePicTools() {
  if (!picSel || !picSel.isConnected) { picTools.hidden = true; picSel = null; return; }
  const r = picSel.getBoundingClientRect();
  const frame = $('.pic-frame', picTools);
  Object.assign(frame.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const bar = $('.pic-bar', picTools);
  const below = r.bottom + 44 < window.innerHeight;
  Object.assign(bar.style, { left: `${Math.max(8, r.left)}px`, top: `${below ? r.bottom + 6 : Math.max(8, r.top - 40)}px` });
}

function selectPic(img) {
  picSel = img;
  picTools.hidden = !img;
  if (img) {
    // Put the cursor just after the picture (selecting the picture itself tints it blue).
    // Delete/Backspace removes it (handled below).
    const range = document.createRange();
    range.setStartAfter(img);
    range.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    placePicTools();
  }
}

reader.addEventListener('click', (e) => {
  const img = e.target.closest?.('#composeForm .editor img');
  if (img) selectPic(img);
  else if (picSel && !e.target.closest('.pic-tools')) selectPic(null);
}, true);
picTools.addEventListener('mousedown', (e) => e.preventDefault()); // keep the picture selected
picTools.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pic]');
  if (!b || !picSel) return;
  const editor = picSel.closest('.editor');
  if (b.dataset.pic === 'remove') {
    picSel.remove();
    selectPic(null);
    scheduleDraftSave();
    editor?.focus();
  } else if (b.dataset.pic === 'fit') {
    setPicWidth(picSel, editor.clientWidth - 48);
  } else {
    setPicWidth(picSel, Math.min(Number(b.dataset.pic), picSel.naturalWidth || 9999));
  }
});
// Drag the corner to resize (keeps the shape).
$('.pic-handle', picTools).addEventListener('pointerdown', (e) => {
  if (!picSel) return;
  e.preventDefault();
  const img = picSel;
  const startX = e.clientX;
  const startW = img.getBoundingClientRect().width;
  const move = (ev) => setPicWidth(img, startW + (ev.clientX - startX));
  const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
});
document.addEventListener('keydown', (e) => {
  if (!picSel || !(e.key === 'Delete' || e.key === 'Backspace')) return;
  if (!e.target.closest?.('#composeForm .editor')) return;
  e.preventDefault();
  picSel.remove();
  selectPic(null);
  scheduleDraftSave();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picSel) selectPic(null); });
reader.addEventListener('scroll', placePicTools, true);
window.addEventListener('resize', placePicTools);
reader.addEventListener('input', () => { if (picSel) requestAnimationFrame(placePicTools); });

// ---------- formatting toolbar ----------
// The fonts and sizes are ones every email program shows the same way.
const FONTS = [
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['Calibri, Carlito, sans-serif', 'Calibri'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'],
  ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['"Courier New", Courier, monospace', 'Courier New'],
];
const SIZES = [['10px', 'Small'], ['14px', 'Normal'], ['18px', 'Large'], ['24px', 'Huge']];
const COLORS = [
  '#000000', '#444444', '#888888', '#CCCCCC', '#FFFFFF',
  '#C0392B', '#E67E22', '#F1C40F', '#27AE60', '#16A085',
  '#2980B9', '#1E5A86', '#8E44AD', '#D63384', '#7B3F00',
];
const MARKS = ['#FFF59D', '#FFE0B2', '#C8E6C9', '#B3E5FC', '#E1BEE7', '#FFCDD2', '#E0E0E0'];

function fmtBarHtml() {
  const swatches = (list, kind) => list.map((c) =>
    `<button type="button" class="swatch" data-${kind}="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('');
  return `
      <div class="fmt-bar" role="toolbar" aria-label="Formatting">
        <select class="fmt-select" data-fmt="font" title="Font" aria-label="Font">
          <option value="" selected hidden>Font</option>
          ${FONTS.map(([v, l]) => `<option value='${v}' style='font-family:${v}'>${l}</option>`).join('')}
        </select>
        <select class="fmt-select small" data-fmt="size" title="Text size" aria-label="Text size">
          <option value="" selected hidden>Size</option>
          ${SIZES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
        <span class="sep"></span>
        <button class="icon-btn" type="button" data-cmd="bold" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button>
        <button class="icon-btn" type="button" data-cmd="italic" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button>
        <button class="icon-btn" type="button" data-cmd="underline" title="Underline (Ctrl+U)" aria-label="Underline"><u>U</u></button>
        <button class="icon-btn" type="button" data-cmd="strikeThrough" title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
        <span class="pop-wrap">
          <button class="icon-btn" type="button" data-pop="color" title="Text color" aria-label="Text color" aria-haspopup="true">
            <span class="tc">A<span class="bar" data-last="color"></span></span></button>
          <div class="fmt-pop" data-popfor="color" hidden>
            <div class="pop-title">Text color</div>
            <div class="swatches">${swatches(COLORS, 'color')}</div>
          </div>
        </span>
        <span class="pop-wrap">
          <button class="icon-btn" type="button" data-pop="mark" title="Highlight" aria-label="Highlight" aria-haspopup="true">${icon('marker')}</button>
          <div class="fmt-pop" data-popfor="mark" hidden>
            <div class="pop-title">Highlight</div>
            <div class="swatches">${swatches(MARKS, 'mark')}</div>
            <button type="button" class="btn small ghost" data-mark="none">No highlight</button>
          </div>
        </span>
        <span class="sep"></span>
        <button class="icon-btn" type="button" data-cmd="justifyLeft" title="Align left" aria-label="Align left">${icon('alignL')}</button>
        <button class="icon-btn" type="button" data-cmd="justifyCenter" title="Center" aria-label="Center">${icon('alignC')}</button>
        <button class="icon-btn" type="button" data-cmd="justifyRight" title="Align right" aria-label="Align right">${icon('alignR')}</button>
        <span class="sep"></span>
        <button class="icon-btn" type="button" data-cmd="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">${icon('ul')}</button>
        <button class="icon-btn" type="button" data-cmd="insertOrderedList" title="Numbered list" aria-label="Numbered list">${icon('ol')}</button>
        <button class="icon-btn" type="button" data-cmd="outdent" title="Decrease indent" aria-label="Decrease indent">${icon('outdent')}</button>
        <button class="icon-btn" type="button" data-cmd="indent" title="Increase indent" aria-label="Increase indent">${icon('indent')}</button>
        <button class="icon-btn" type="button" data-cmd="quote" title="Quote" aria-label="Quote">${icon('quote')}</button>
        <button class="icon-btn" type="button" data-cmd="link" title="Add link" aria-label="Add link">${icon('link')}</button>
        <span class="sep"></span>
        <button class="icon-btn" type="button" data-cmd="removeFormat" title="Clear formatting" aria-label="Clear formatting">${icon('clear')}</button>
      </div>`;
}

// Picking from a menu moves focus away from the message, so remember where the cursor was.
let savedRange = null;
document.addEventListener('selectionchange', () => {
  const sel = getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  const ed = r.commonAncestorContainer?.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer?.parentElement;
  if (ed?.closest?.('#composeForm .editor')) savedRange = r.cloneRange();
});
function restoreSel(editor) {
  editor.focus();
  if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

// Wraps the selected text in a span with the given style (font, size).
function styleSelection(editor, prop, value) {
  restoreSel(editor);
  const sel = getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    // Nothing selected: start a styled spot so what you type next uses it.
    const span = document.createElement('span');
    span.style[prop] = value;
    span.textContent = '​';
    range.insertNode(span);
    const r = document.createRange();
    r.setStart(span.firstChild, 1);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    return;
  }
  // Let the browser split the selection into runs, then turn those into styled spans.
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontName', false, '__mr_pick__');
  const spans = [];
  editor.querySelectorAll('font[face="__mr_pick__"]').forEach((f) => {
    const span = document.createElement('span');
    span.style[prop] = value;
    // Inner text with its own setting for the same thing would win, so clear it.
    f.querySelectorAll('*').forEach((n) => { n.style?.removeProperty(prop === 'fontFamily' ? 'font-family' : 'font-size'); if (n.tagName === 'FONT') n.removeAttribute(prop === 'fontFamily' ? 'face' : 'size'); });
    span.append(...f.childNodes);
    f.replaceWith(span);
    spans.push(span);
  });
  // Keep the same text selected so you can keep formatting it.
  if (spans.length) {
    const r = document.createRange();
    r.setStartBefore(spans[0]);
    r.setEndAfter(spans[spans.length - 1]);
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange = r.cloneRange();
  }
}

function closePops(except) {
  $$('#composeForm .fmt-pop').forEach((p) => { if (p !== except) p.hidden = true; });
}

reader.addEventListener('mousedown', (e) => {
  // Keep the text selection in the editor when a formatting button is pressed.
  if (e.target.closest('[data-cmd], [data-pop], .swatch, [data-mark]')) e.preventDefault();
});

reader.addEventListener('change', (e) => {
  const sel = e.target.closest('#composeForm [data-fmt]');
  if (!sel || !sel.value) return;
  const editor = $('#composeForm .editor');
  if (sel.dataset.fmt === 'font') styleSelection(editor, 'fontFamily', sel.value);
  if (sel.dataset.fmt === 'size') styleSelection(editor, 'fontSize', sel.value);
  sel.value = '';
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.pop-wrap')) closePops();
});

reader.addEventListener('click', async (e) => {
  const form = $('#composeForm');
  if (!form) return;
  const editor = $('.editor', form);
  const popBtn = e.target.closest('[data-pop]');
  if (popBtn) {
    const pop = $(`.fmt-pop[data-popfor="${popBtn.dataset.pop}"]`, form);
    closePops(pop);
    pop.hidden = !pop.hidden;
    return;
  }
  const sw = e.target.closest('[data-color], [data-mark]');
  if (sw) {
    restoreSel(editor);
    document.execCommand('styleWithCSS', false, true);
    if (sw.dataset.color) {
      document.execCommand('foreColor', false, sw.dataset.color);
      const bar = $('[data-last="color"]', form);
      if (bar) bar.style.background = sw.dataset.color;
    } else {
      document.execCommand('hiliteColor', false, sw.dataset.mark === 'none' ? 'transparent' : sw.dataset.mark);
    }
    document.execCommand('styleWithCSS', false, false);
    closePops();
    return;
  }
  const cmdBtn = e.target.closest('[data-cmd]');
  if (cmdBtn) {
    const cmd = cmdBtn.dataset.cmd;
    restoreSel(editor);
    if (cmd === 'link') {
      const url = window.prompt('Link address (for example https://example.com)');
      restoreSel(editor);
      if (url) {
        const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
        if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(url)}</a>`);
        else document.execCommand('createLink', false, href);
      }
    } else if (cmd === 'quote') {
      document.execCommand('formatBlock', false, 'blockquote');
    } else if (cmd === 'removeFormat') {
      document.execCommand('removeFormat', false, null);
      document.execCommand('unlink', false, null);
    } else {
      document.execCommand(cmd, false, null);
    }
    return;
  }
  const b = e.target.closest('[data-c]');
  if (!b) return;
  switch (b.dataset.c) {
    case 'cc': case 'bcc':
      $(`[data-f="${b.dataset.c}"]`, form).hidden = false;
      b.hidden = true;
      form[b.dataset.c].focus();
      break;
    case 'toggleQuote': {
      const wrap = $('.quoted .frame-wrap', form);
      wrap.hidden = !wrap.hidden;
      b.textContent = wrap.hidden ? 'Show' : 'Hide';
      break;
    }
    case 'removeAtt': {
      const [gone] = S.compose.attachments.splice(Number(b.dataset.i), 1);
      if (gone?.serverId) S.compose.removedServerIds.push(gone.serverId);
      renderComposeAttachments();
      scheduleDraftSave();
      break;
    }
    case 'close':
      // Closing keeps what you wrote in Drafts.
      if (await confirmLeaveCompose()) closeCompose();
      break;
    case 'discard':
      if ((composeIsDirty() || S.compose.draft) && !window.confirm('Discard this draft?')) return;
      discardDraft();
      break;
    default:
  }
});

reader.addEventListener('input', (e) => {
  if (e.target.closest?.('#composeForm')) scheduleDraftSave();
});

reader.addEventListener('change', (e) => {
  const form = $('#composeForm');
  if (!form) return;
  if (e.target.closest('#composeForm')) scheduleDraftSave();
  if (e.target.name === 'files') {
    addFiles([...e.target.files]);
    e.target.value = '';
  }
  if (e.target.name === 'from') {
    const c = S.compose;
    if (c.attachments.some((x) => !x.data)) {
      e.target.value = c.from;
      toast('Files already saved in this draft stay with its account. Remove them first to switch accounts.', { error: true });
      return;
    }
    // The draft lives in the old account's Drafts folder: move it by starting a new one.
    if (c.draft) {
      const old = { from: c.from, id: c.draft.id };
      c.draft = null;
      c.savedKey = null;
      (c.saving || Promise.resolve()).catch(() => {}).then(() =>
        api('DELETE', `/mail/api/accounts/${old.from}/drafts/${encodeURIComponent(old.id)}`).catch(() => {}));
    }
    S.compose.from = e.target.value;
    const editor = $('.editor', form);
    const sig = $('[data-signature]', editor);
    const a = acct(S.compose.from);
    if (sig) {
      if (a?.signature) sig.innerHTML = a.signature;
      else { sig.previousElementSibling?.remove(); sig.remove(); }
    } else if (a?.signature) {
      editor.insertAdjacentHTML('beforeend', signatureBlock(a));
    }
  }
});

reader.addEventListener('dragover', (e) => {
  const form = $('#composeForm');
  if (!form || !e.dataTransfer?.types?.includes('Files')) return;
  e.preventDefault();
  form.classList.add('dragging');
});
reader.addEventListener('dragleave', (e) => {
  if (!reader.contains(e.relatedTarget)) $('#composeForm')?.classList.remove('dragging');
});
// Pasting: keep bold, links, sizes and colors, but drop colors that came from a
// dark screen (light text, dark backgrounds) so pasted text is always readable.
function lum(c) {
  const m = String(c).match(/rgba?\(([^)]+)\)/);
  let r, g, b, a = 1;
  if (m) [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  else {
    const h = String(c).trim().replace('#', '');
    if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(h)) return null;
    const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
  }
  if (a === 0) return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function cleanPasted(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, meta, link, title, iframe, object, embed, form, input, button, select, textarea').forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((n) => {
    for (const at of [...n.attributes]) {
      if (/^on|^class$|^id$|^data-|^contenteditable$|^tabindex$|^role$|^aria-/i.test(at.name)) n.removeAttribute(at.name);
    }
    if (n.hasAttribute('bgcolor') && (lum(n.getAttribute('bgcolor')) ?? 1) < 0.5) n.removeAttribute('bgcolor');
    if (n.tagName === 'FONT' && n.hasAttribute('color') && (lum(n.getAttribute('color')) ?? 0) > 0.8) n.removeAttribute('color');
    const st = n.style;
    if (!st) return;
    const bg = st.backgroundColor;
    if (bg && (lum(bg) ?? 1) < 0.5) st.removeProperty('background-color');
    if (st.background && !st.backgroundColor) st.removeProperty('background');
    const fg = st.color;
    if (fg && (lum(fg) ?? 0) > 0.8) st.removeProperty('color');
    ['position', 'top', 'left', 'right', 'bottom', 'z-index', 'white-space', 'caret-color'].forEach((k) => st.removeProperty(k));
    if (n.tagName === 'IMG') { st.maxWidth = '100%'; st.height = 'auto'; n.removeAttribute('height'); }
    if (!n.getAttribute('style')?.trim()) n.removeAttribute('style');
  });
  return doc.body.innerHTML;
}

// A picture is inserted no wider than the message box (and at most 600 pixels, which reads
// well in every email program). Click it afterwards to make it bigger or smaller.
function fitWidth(editor, natural) {
  const room = Math.max(120, editor.clientWidth - 48);
  return Math.round(Math.min(natural || room, room, 600));
}

function insertPictureFiles(editor, files) {
  for (const file of files) {
    const r = new FileReader();
    r.onload = () => {
      const probe = new Image();
      probe.onload = () => {
        const w = fitWidth(editor, probe.naturalWidth);
        restoreSel(editor);
        document.execCommand('insertHTML', false, `<img src="${r.result}" width="${w}" style="width:${w}px;max-width:100%;height:auto" alt="">`);
        scheduleDraftSave();
      };
      probe.src = r.result;
    };
    r.readAsDataURL(file);
  }
}

reader.addEventListener('paste', (e) => {
  const editor = e.target.closest?.('#composeForm .editor');
  if (!editor) return;
  // A screenshot or copied picture.
  const pics = [...(e.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
  if (pics.length && !e.clipboardData.getData('text/html')) {
    e.preventDefault();
    insertPictureFiles(editor, pics);
    return;
  }
  const html = e.clipboardData?.getData('text/html');
  if (!html) return; // plain text pastes fine on its own
  e.preventDefault();
  document.execCommand('insertHTML', false, cleanPasted(html));
});

reader.addEventListener('drop', (e) => {
  const form = $('#composeForm');
  if (!form || !e.dataTransfer?.files?.length) return;
  e.preventDefault();
  form.classList.remove('dragging');
  addFiles([...e.dataTransfer.files]);
});

reader.addEventListener('submit', (e) => {
  if (e.target.id !== 'composeForm') return;
  e.preventDefault();
  sendCompose();
});

function splitRecipients(value) {
  const out = [];
  let cur = '';
  let quoted = false;
  let angle = 0;
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '<') angle++;
    if (!quoted && ch === '>') angle = Math.max(0, angle - 1);
    if ((ch === ',' || ch === ';') && !quoted && !angle) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const validAddress = (s) => /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/.test((s.match(/<([^>]+)>\s*$/)?.[1] || s).trim());

const LIMITS = { gmail: 24 * 1024 * 1024, demo: 24 * 1024 * 1024, outlook: 140 * 1024 * 1024 };

// Asks "Send from <address>?" with the address in big letters, so you never send from the wrong account.
function confirmSend(a, { to, cc, bcc, subject, files }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'send-confirm';
    dlg.style.setProperty('--acct', a.color);
    const line = (label, list) => (list.length ? `<div class="sc-row"><span>${label}</span><span>${esc(list.join(', '))}</span></div>` : '');
    dlg.innerHTML = `
      <form method="dialog">
        <p class="sc-ask">Are you sure you want to send this email from</p>
        <div class="sc-from">
          <span class="sc-address">${esc(a.email)}</span>
          ${a.name ? `<span class="sc-name">${esc(a.name)}</span>` : ''}
        </div>
        <div class="sc-details">
          ${line('To', to)}${line('Cc', cc)}${line('Bcc', bcc)}
          <div class="sc-row"><span>Subject</span><span>${subject ? esc(subject) : '<b class="sc-warn">No subject</b>'}</span></div>
          ${files ? `<div class="sc-row"><span>Files</span><span>${files} attached</span></div>` : ''}
        </div>
        <div class="sc-actions">
          <button class="btn" value="no" type="submit">Go back</button>
          <button class="btn primary" value="yes" type="submit">${icon('send')}Send from ${esc(a.email)}</button>
        </div>
      </form>`;
    $$('.suggest').forEach((x) => x.remove()); // close any address suggestions
    document.body.append(dlg);
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'yes');
      dlg.remove();
    }, { once: true });
    // Clicking outside the box counts as "Go back".
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('no'); });
    dlg.showModal();
    $('button[value="yes"]', dlg).focus();
  });
}

async function sendCompose() {
  const form = $('#composeForm');
  const c = S.compose;
  if (!form || !c || c.sending || c.confirming) return;
  const a = acct(c.from);
  const fields = { to: splitRecipients(form.to.value), cc: splitRecipients(form.cc.value), bcc: splitRecipients(form.bcc.value) };
  const all = [...fields.to, ...fields.cc, ...fields.bcc];
  if (!all.length) { toast('Add at least one recipient.', { error: true }); form.to.focus(); return; }
  const bad = all.find((r) => !validAddress(r));
  if (bad) { toast(`“${bad}” isn’t a valid email address.`, { error: true }); return; }
  const total = c.attachments.reduce((n, x) => n + x.size, 0);
  if (total > (LIMITS[a.provider] || LIMITS.gmail)) {
    toast(`Attachments are too large for ${KIND_LABEL[a.kind] || 'this account'} (${size(total)}). ${a.provider === 'outlook' ? 'The limit is 140 MB.' : 'Gmail allows 25 MB per message; share large files with a link instead.'}`, { error: true, timeout: 9000 });
    return;
  }
  c.confirming = true;
  const ok = await confirmSend(a, { to: fields.to, cc: fields.cc, bcc: fields.bcc, subject: form.subject.value.trim(), files: c.attachments.length });
  c.confirming = false;
  if (!ok) return;

  clearTimeout(c.saveTimer);
  c.sending = true;
  if (c.saving) await c.saving.catch(() => {}); // let a save in progress finish, so its draft id is known
  const btn = $('button[type=submit]', form);
  btn.disabled = true;
  btn.innerHTML = `${icon('send')}Sending…`;
  try {
    await api('POST', `/mail/api/accounts/${c.from}/send`, {
      ...composePayload(form, c),
      to: fields.to.join(', '),
      cc: fields.cc.join(', '),
      bcc: fields.bcc.join(', '),
    });
    toast('Message sent');
    for (const r of all) {
      const m = r.match(/^(.*?)<([^>]+)>\s*$/);
      const p = m ? { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() } : { name: '', email: r };
      if (!S.addressBook.has(p.email.toLowerCase())) S.addressBook.set(p.email.toLowerCase(), p);
    }
    closeCompose({ sent: true });
    if (S.folder === 'sent' || S.folder === 'drafts') loadList({ keep: true });
  } catch (e) {
    c.sending = false;
    btn.disabled = false;
    btn.innerHTML = `${icon('send')}Send`;
    reportError(e, e.reconnect ? a : null);
  }
}

function closeCompose({ sent = false } = {}) {
  selectPic(null);
  const c = S.compose;
  const back = c?.src || (c?.inline ? S.cur : null);
  const hadDraft = !!c?.draft;
  S.compose = null;
  if (c?.from && (hadDraft || sent)) forgetDraftMarks(c.from);
  if (back && S.cur && (keyOf(S.cur) === keyOf(back) || findInThread(back.id))) {
    S.view = 'message';
    const keep = reader.scrollTop;
    renderMessage(S.cur);
    reader.scrollTop = keep;
    // Show your reply (if sent) or the saved draft at the bottom of the conversation.
    if (sent || hadDraft) reloadThread();
  } else {
    showEmptyReader();
  }
}

// After you reply, fetch the conversation again so your reply shows at the bottom.
async function reloadThread() {
  const cur = S.cur;
  if (!cur) return;
  await new Promise((r) => setTimeout(r, 1500)); // give Gmail/Outlook a moment to file it
  if (S.cur !== cur || S.view !== 'message') return;
  const thread = await api('GET', `/mail/api/accounts/${cur.accountId}/messages/${encodeURIComponent(cur.id)}/thread`).catch(() => null);
  if (!thread?.length || S.cur !== cur || S.view !== 'message') return;
  const known = new Set(S.thread.map((t) => t.id));
  S.thread = thread;
  thread.filter((t) => !known.has(t.id)).forEach((t) => S.expanded.add(t.id));
  renderMessage(cur, { scrollTo: thread.at(-1).id });
}

// Suggest people you've emailed with as you type in To, Cc and Bcc.
function attachAutocomplete(input) {
  let box = null;
  let items = [];
  let active = 0;
  const close = () => { box?.remove(); box = null; };
  const current = () => {
    const parts = input.value.split(/[,;]/);
    return parts[parts.length - 1].trim().toLowerCase();
  };
  const choose = (p) => {
    const parts = input.value.split(/([,;])/);
    parts[parts.length - 1] = ` ${formatAddr(p)}`;
    input.value = `${parts.join('').replace(/^\s+/, '')}, `;
    close();
    input.focus();
  };
  input.addEventListener('input', () => {
    const q = current();
    close();
    if (q.length < 2) return;
    items = [...S.addressBook.values()]
      .filter((p) => p.email.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q))
      .slice(0, 6);
    if (!items.length) return;
    active = 0;
    box = document.createElement('div');
    box.className = 'suggest';
    box.setAttribute('role', 'listbox');
    box.innerHTML = items.map((p, i) => `<div role="option" class="${i === 0 ? 'on' : ''}" data-i="${i}">${esc(p.name || p.email)}${p.name ? ` <span class="muted">${esc(p.email)}</span>` : ''}</div>`).join('');
    box.addEventListener('mousedown', (e) => {
      const o = e.target.closest('[data-i]');
      if (o) { e.preventDefault(); choose(items[Number(o.dataset.i)]); }
    });
    input.closest('.field').append(box);
  });
  input.addEventListener('keydown', (e) => {
    if (!box) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      $$('[data-i]', box).forEach((o, i) => o.classList.toggle('on', i === active));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
}

// ---------- settings ----------
function updateMoveButtons() {
  const cards = $$('.page .card[data-id]', reader);
  cards.forEach((c, i) => {
    const up = $('[data-s="up"]', c);
    const down = $('[data-s="down"]', c);
    if (up) up.disabled = i === 0;
    if (down) down.disabled = i === cards.length - 1;
  });
}

async function openSettings({ focus } = {}) {
  if (!(await confirmLeaveCompose())) return;
  S.compose = null;
  S.view = 'settings';
  app.classList.add('reading');
  try { S.status = await api('GET', '/mail/api/status'); } catch { /* keep old */ }
  const st = S.status || { google: {}, microsoft: {} };
  const hasDemo = S.accounts.some((a) => a.provider === 'demo');

  const keyForm = (p, label, guideId) => `
    <form class="key-form" data-p="${p}">
      <p>${label} needs a one-time setup so Mailroom is allowed to use it. It takes about 10 minutes.
        <a href="setup.html#${guideId}" target="_blank" rel="noopener">Open the step-by-step guide</a></p>
      <div class="stack"><span>Redirect URI (you’ll paste this into ${p === 'google' ? 'Google' : 'Microsoft'})</span>
        <div class="copy-row"><code>${esc(st[p].redirectUri || '')}</code><button class="btn small" type="button" data-copy="${esc(st[p].redirectUri || '')}">Copy</button></div></div>
      <label class="stack"><span>Client ID</span><input class="input" name="clientId" value="${esc(st[p].clientId || '')}" spellcheck="false" required></label>
      <label class="stack"><span>Client secret</span><input class="input" name="clientSecret" type="password" spellcheck="false" required></label>
      <div class="row-actions"><button class="btn primary" type="submit">Save keys</button></div>
    </form>`;

  const connectBlock = (p, label, guideId, blurb) => `
    <div class="card connect" id="connect-${p}">
      <h3>${label}</h3>
      <p>${blurb}</p>
      ${st[p].configured ? `
        <a class="btn primary" href="../connect.html?p=${p}/start" target="_top">${icon('plus')}Connect ${p === 'google' ? 'a Gmail' : 'an Outlook'} account</a>
        <details class="change-keys"><summary>Change keys</summary>${keyForm(p, label, guideId)}</details>` : keyForm(p, label, guideId)}
    </div>`;

  reader.innerHTML = `
    <div class="reader-bar"><button class="icon-btn back-btn" data-s="back" aria-label="Back">${icon('back')}</button><h2 class="bar-title">Settings and accounts</h2></div>
    <div class="page">
      <h2>Your accounts</h2>
      ${S.accounts.length ? S.accounts.map((a) => `
        <div class="card" data-id="${a.id}">
          <div class="acct-top">
            <input type="color" name="color" value="${a.color}" aria-label="Color for ${esc(a.email)}" title="Color used to mark this account’s messages">
            <div class="meta"><strong>${esc(a.email)}</strong><span class="muted">${KIND_LABEL[a.kind] || ''}${a.provider === 'demo' ? ' sample account. Nothing is really sent.' : ''}</span>
              ${a.needsReconnect ? '<div class="warn">Signed out. Reconnect to keep using this account.</div>' : ''}</div>
            ${a.needsReconnect ? '<button class="btn primary small" type="button" data-s="reconnect">Reconnect</button>' : ''}
            ${S.accounts.length > 1 ? `<span class="order-btns">
              <button class="icon-btn" type="button" data-s="up" aria-label="Move ${esc(a.email)} up" title="Move up">${icon('up')}</button>
              <button class="icon-btn" type="button" data-s="down" aria-label="Move ${esc(a.email)} down" title="Move down">${icon('down')}</button></span>` : ''}
            <button class="btn ghost danger small" type="button" data-s="remove">Remove</button>
          </div>
          <label class="check-row" style="margin-top:12px;font-weight:400"><input type="checkbox" name="acctSound"${a.muted ? '' : ' checked'}> Play the new-mail sound for this account</label>
          ${a.provider !== 'outlook' ? `<label class="stack"><span>Your name, as recipients see it</span><input class="input" name="name" value="${esc(a.name)}"></label>` : ''}
          <div class="stack"><span class="sig-label"><span id="sig-${a.id}">Signature</span>${a.kind === 'gmail' ? `<button class="btn small ghost" type="button" data-s="gmailSig" title="Copy the signature set in this account’s Gmail settings">Get signature from Gmail</button>` : ''}</span><div class="sig-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="sig-${a.id}">${a.signature}</div></div>
          <div class="row-actions"><button class="btn small" type="button" data-s="save">Save changes</button></div>
        </div>`).join('') : '<p class="muted">No accounts connected yet. Add one below.</p>'}

      <h2>Add an account</h2>
      <div class="connect-grid">
        ${connectBlock('google', 'Gmail', 'google', 'Personal Gmail and Google Workspace accounts.')}
        ${connectBlock('microsoft', 'Outlook', 'microsoft', 'Outlook.com, Hotmail, Live and Microsoft 365 work accounts.')}
      </div>
      <p>${hasDemo ? 'The demo accounts are listed above. Remove them whenever you like.' : `Want to look around first? <button class="btn small" type="button" data-s="demo">Add demo accounts</button>`}</p>

      <h2>New mail</h2>
      <div class="card">
        <label class="check-row"><input type="checkbox" id="soundSetting"${S.soundOn ? ' checked' : ''}> Play a sound when new mail arrives</label>
        <p class="muted" style="margin:8px 0 12px;font-size:14px">${S.serverSound
          ? 'Mailroom checks every 15 seconds and plays the sound itself, so you hear it even when this tab is in the background or the browser is closed, as long as the black Control Center window is open.'
          : 'Mailroom checks every minute. The sound plays while Mailroom is open in a browser tab.'}
          The account with new mail also blinks on the left until you open it. To silence one account, click the bell next to it on the left, or untick it below.</p>
        <button class="btn small" type="button" data-s="testSound">${icon('bell')}Play the sound</button>
        <label class="check-row" style="margin-top:16px"><input type="checkbox" id="popupSetting"${S.popups && 'Notification' in window && Notification.permission === 'granted' ? ' checked' : ''}> Show Windows pop-ups for new mail</label>
        <p class="muted" style="margin:6px 0 0;font-size:14px">A small pop-up in the corner of your screen when mail arrives while you’re in another tab or app. Mailroom needs to be open in a browser tab for these.</p>
      </div>
      <div class="card">
        <label class="stack" style="margin-top:0"><span>Important senders</span>
          <input class="input" id="importantSenders" value="${esc(S.importantSenders.join(', '))}" spellcheck="false" placeholder="ncshp.gov, boss@company.com"></label>
        <p class="muted" style="margin:8px 0 12px;font-size:14px">New mail from these gets a different, louder sound, a red blinking account and an alert bar that stays until you click <b>Turn off</b>. Enter a domain (like <b>ncshp.gov</b>, which covers every address ending in @ncshp.gov) or a full address, separated by commas.</p>
        <div class="row-actions" style="margin-top:0">
          <button class="btn small" type="button" data-s="saveImportant">Save</button>
          <button class="btn small" type="button" data-s="testAlarm">${icon('alarm')}Play the important sound</button>
          ${S.accounts.some((a) => a.provider === 'demo') ? '<button class="btn small ghost" type="button" data-s="demoAlert">Send a sample important email to a demo account</button>' : ''}
        </div>
      </div>

      <div class="card">
        <div class="stack" style="margin-top:0"><span>Blocked senders</span></div>
        <p class="muted" style="margin:6px 0 10px;font-size:14px">Email from these goes straight to Junk/Spam in every account, without a sound. Mailroom also clears any that arrived while it was closed. Enter an address, or a domain to block a whole company. Important senders are never blocked.</p>
        <ul class="blocked-list" id="blockedList"></ul>
        <form class="row-actions" id="blockForm" style="margin-top:10px">
          <input class="input" id="blockInput" placeholder="someone@example.com or example.com" spellcheck="false" style="flex:1;min-width:220px">
          <button class="btn small" type="submit">Block</button>
        </form>
      </div>

      <h2>Keyboard shortcuts</h2>
      <dl class="keys">
        <dt><kbd>j</kbd> <kbd>k</kbd></dt><dd>Next and previous message</dd>
        <dt><kbd>r</kbd></dt><dd>Reply</dd>
        <dt><kbd>a</kbd></dt><dd>Reply all</dd>
        <dt><kbd>f</kbd></dt><dd>Forward</dd>
        <dt><kbd>c</kbd></dt><dd>Write a message</dd>
        <dt><kbd>e</kbd></dt><dd>Archive</dd>
        <dt><kbd>#</kbd></dt><dd>Delete</dd>
        <dt><kbd>s</kbd></dt><dd>Star or flag</dd>
        <dt><kbd>u</kbd></dt><dd>Mark unread</dd>
        <dt><kbd>/</kbd></dt><dd>Search</dd>
        <dt><kbd>Ctrl</kbd> <kbd>Enter</kbd></dt><dd>Send</dd>
      </dl>
    </div>`;
  renderSidebar();
  updateMoveButtons();
  renderBlockedList();
  if (focus) $(`#connect-${focus}`)?.scrollIntoView({ block: 'start' });
}

reader.addEventListener('click', async (e) => {
  if (S.view !== 'settings') return;
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.copy); toast('Copied'); } catch { toast('Select the address and copy it manually.'); }
    return;
  }
  const b = e.target.closest('[data-s]');
  if (!b) return;
  const card = b.closest('[data-id]');
  const a = card && acct(card.dataset.id);
  switch (b.dataset.s) {
    case 'back': app.classList.remove('reading'); break;
    case 'demo':
      S.accounts = await api('POST', '/mail/api/demo');
      afterAccountsChange();
      toast('Demo accounts added. Have a look at the inbox.');
      openSettings();
      break;
    case 'reconnect': reconnect(a); break;
    case 'testSound': playChime({ test: true }); break;
    case 'testAlarm': playAlarm({ test: true }); break;
    case 'saveImportant': {
      const list = $('#importantSenders', reader).value.split(/[,;\s]+/).map((x) => x.trim().replace(/^@/, '')).filter(Boolean);
      try {
        const st = await api('POST', '/mail/api/notify/settings', { importantSenders: [...new Set(list)] });
        S.importantSenders = st.importantSenders;
      } catch (err) { toast(err.message, { error: true }); break; }
      $('#importantSenders', reader).value = S.importantSenders.join(', ');
      toast(S.importantSenders.length ? `Important senders saved: ${S.importantSenders.join(', ')}` : 'No important senders. All new mail gets the normal sound.');
      break;
    }
    case 'demoAlert': {
      const d = S.accounts.find((x) => x.provider === 'demo');
      await api('POST', `/mail/api/accounts/${d.id}/demo-deliver`, { name: 'Gorham, Roderick E.', email: 'roderick.gorham@ncshp.gov', subject: 'Safety audit appointment', text: 'Good morning,\n\nI can come by Tuesday at 10 AM for the audit. Please confirm.\n\nGorham' });
      toast('Sample sent. Checking now…');
      setTimeout(() => pollNotify({ checkNow: true }), 800);
      break;
    }
    case 'up':
    case 'down':
      if (moveAccount(a.id, b.dataset.s === 'up' ? -1 : 1)) requestAnimationFrame(() => {
        const again = $(`.card[data-id="${CSS.escape(a.id)}"] [data-s="${b.dataset.s}"]`, reader);
        (again && !again.disabled ? again : $(`.card[data-id="${CSS.escape(a.id)}"] [data-s="${b.dataset.s === 'up' ? 'down' : 'up'}"]`, reader))?.focus();
      });
      break;
    case 'remove':
      if (!window.confirm(`Remove ${a.email} from Mailroom? Your mail stays in your ${KIND_LABEL[a.kind] || ''} account; Mailroom just stops showing it.`)) return;
      await api('DELETE', `/mail/api/accounts/${a.id}`).catch((err) => toast(err.message, { error: true }));
      S.accounts = S.accounts.filter((x) => x.id !== a.id);
      delete S.unread[a.id];
      if (S.scope === a.id) S.scope = 'all';
      afterAccountsChange();
      openSettings();
      break;
    case 'gmailSig': {
      b.disabled = true;
      try {
        const { signature } = await api('GET', `/mail/api/accounts/${a.id}/gmail-signature`);
        if (!signature.trim()) { toast(`${a.email} has no signature set in Gmail.`); break; }
        const box = $('.sig-editor', card);
        const current = box.innerHTML.trim();
        if (current && current !== '<br>' && current !== signature.trim() && !window.confirm('Replace the signature in Mailroom with the one from Gmail?')) break;
        box.innerHTML = signature;
        const updated = await api('PATCH', `/mail/api/accounts/${a.id}`, { signature });
        Object.assign(a, updated);
        toast(`Signature copied from Gmail for ${a.email}`);
      } catch (err) {
        reportError(err, err.reconnect ? a : null);
      } finally {
        b.disabled = false;
      }
      break;
    }
    case 'save': {
      const body = {
        color: $('[name=color]', card).value,
        signature: $('.sig-editor', card).innerHTML.trim() === '<br>' ? '' : $('.sig-editor', card).innerHTML.trim(),
      };
      if ($('[name=name]', card)) body.name = $('[name=name]', card).value;
      try {
        const updated = await api('PATCH', `/mail/api/accounts/${a.id}`, body);
        Object.assign(a, updated);
        toast('Changes saved');
        renderSidebar();
        renderList();
      } catch (err) { toast(err.message, { error: true }); }
      break;
    }
    default:
  }
});

reader.addEventListener('change', (e) => {
  if (e.target.id === 'soundSetting') setSound(e.target.checked);
  if (e.target.id === 'popupSetting') setPopups(e.target.checked);
  if (e.target.name === 'acctSound') {
    const card = e.target.closest('[data-id]');
    if (card) setMuted(card.dataset.id, !e.target.checked);
  }
});

reader.addEventListener('submit', (e) => {
  if (e.target.id !== 'blockForm') return;
  e.preventDefault();
  const v = $('#blockInput', reader).value.trim();
  if (v) { blockSender(v); $('#blockInput', reader).value = ''; }
});
reader.addEventListener('click', (e) => {
  const b = e.target.closest('[data-unblock]');
  if (b && window.confirm(`Unblock ${b.dataset.unblock}? Their new emails will arrive in your inbox again.`)) unblockSender(b.dataset.unblock);
});

reader.addEventListener('submit', async (e) => {
  const f = e.target.closest('.key-form');
  if (!f) return;
  e.preventDefault();
  try {
    await api('POST', `/mail/api/config/${f.dataset.p}`, { clientId: f.clientId.value, clientSecret: f.clientSecret.value });
    toast('Keys saved. Now connect your account.');
    openSettings({ focus: f.dataset.p });
  } catch (err) {
    toast(err.message, { error: true });
  }
});

function afterAccountsChange() {
  if (S.scope !== 'all' && !acct(S.scope)) S.scope = 'all';
  renderSidebar();
  refreshUnread();
  pollNotify();
  loadList();
}

// ---------- welcome ----------
async function showWelcome() {
  S.view = 'welcome';
  try { S.status = await api('GET', '/mail/api/status'); } catch { /* ignore */ }
  const st = S.status || { google: {}, microsoft: {} };
  const btn = (p, label) => (st[p]?.configured
    ? `<a class="btn primary" href="../connect.html?p=${p}/start" target="_top">Connect ${label}</a>`
    : `<button class="btn primary" type="button" data-w="${p}">Set up ${label}</button>`);
  reader.innerHTML = `
    <div class="welcome">
      <h1>Your Gmail and Outlook in one inbox</h1>
      <p>Mailroom runs on your own computer. Your messages go straight between this computer and Google or Microsoft, and nowhere else.</p>
      <div class="actions">
        ${btn('google', 'Gmail')}
        ${btn('microsoft', 'Outlook')}
        <button class="btn" type="button" data-w="demo">Try it with demo accounts</button>
      </div>
      <small>Connecting an account for the first time takes a one-time setup of about 10 minutes. The guide walks you through it.</small>
    </div>`;
  renderSidebar();
}

reader.addEventListener('click', async (e) => {
  if (S.view !== 'welcome') return;
  const b = e.target.closest('[data-w]');
  if (!b) return;
  if (b.dataset.w === 'demo') {
    S.accounts = await api('POST', '/mail/api/demo');
    afterAccountsChange();
    showEmptyReader();
    toast('Demo accounts added. Messages are samples and nothing is really sent.');
  } else {
    openSettings({ focus: b.dataset.w });
  }
});

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return; // the box handles its own keys
  const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && S.view === 'compose') {
    e.preventDefault();
    sendCompose();
    return;
  }
  if (e.key === 'Escape') {
    if (app.classList.contains('nav-open')) return closeNav();
    if (S.checked.size && !typing) { clearPicks(); return; }
    if (typing && e.target.id === 'search') { e.target.blur(); return; }
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const m = S.cur;
  const move = (d) => {
    const list = shownGroups().map((g) => g.latest);
    const cur = S.msgs.find((x) => keyOf(x) === S.sel);
    const i = cur ? list.findIndex((x) => threadKeyOf(x) === threadKeyOf(cur)) : -1;
    const n = list[i === -1 ? (S.order === 'oldest' ? list.length - 1 : 0) : Math.min(list.length - 1, Math.max(0, i + d))];
    if (n && keyOf(n) !== S.sel) openMessage(keyOf(n));
  };
  const keys = {
    j: () => move(1), ArrowDown: () => move(1),
    k: () => move(-1), ArrowUp: () => move(-1),
    c: () => openCompose('new'),
    '/': () => $('#search').focus(),
  };
  if (S.view === 'message' && m) {
    Object.assign(keys, {
      r: () => openCompose('reply', replyTarget()),
      a: () => openCompose('replyAll', replyTarget()),
      f: () => openCompose('forward', replyTarget()),
      e: () => messageAction(['archive', 'spam', 'trash'].includes(S.folder) ? 'inbox' : 'archive'),
      '#': () => messageAction('trash'),
      Delete: () => messageAction('trash'),
      s: () => messageAction(m.starred ? 'unstar' : 'star'),
      u: () => messageAction('unread'),
    });
  }
  const fn = keys[e.key];
  if (fn) {
    if (e.key.startsWith('Arrow') && document.activeElement !== listEl) return;
    e.preventDefault();
    fn();
  }
});

window.addEventListener('beforeunload', (e) => {
  // Only ask if there are changes that haven't reached Drafts yet (and start saving them).
  const c = S.compose;
  const form = $('#composeForm');
  if (S.view === 'compose' && c && form && composeIsDirty() && (c.saving || payloadKey(composePayload(form, c)) !== c.savedKey)) {
    saveDraft();
    e.preventDefault();
  }
});

// ---------- start up ----------
// Older Mailroom kept the sound setting, important senders and alerts in the browser.
// Move them into the Mailroom program once, so they work with the tab closed.
async function migrateOldSettings() {
  if (store.get('notifyMoved', false)) return;
  const body = {};
  const sound = store.get('soundOn', null);
  if (typeof sound === 'boolean') body.soundOn = sound;
  const senders = store.get('importantSenders', null);
  if (Array.isArray(senders)) body.importantSenders = senders;
  const alerts = store.get('alerts', null);
  if (Array.isArray(alerts) && alerts.length) body.alerts = alerts;
  try {
    if (Object.keys(body).length) await api('POST', '/mail/api/notify/import', body);
    store.set('notifyMoved', true);
  } catch { /* try again next time */ }
}

// After an update, the page is new but the black window may still run the old program.
async function checkVersion() {
  try {
    const st = await api('GET', '/mail/api/status');
    S.status = st;
    if (st.version === APP_VERSION) return;
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = `<b>Mailroom was updated, but Control Center is still running the old version.</b>
      <button class="btn small primary" type="button">Restart Control Center now</button>`;
    $('button', bar).onclick = async () => {
      $('button', bar).disabled = true;
      $('button', bar).textContent = 'Restarting…';
      await window.ccBeforeReload?.();
      // The page reloads by itself once Control Center is back.
      await fetch('/hub/api/restart', { method: 'POST', headers: { 'X-Control-Center': '1' } }).catch(() => {});
    };
    document.body.prepend(bar);
  } catch { /* not reachable; init shows its own message */ }
}

async function init() {
  const params = new URLSearchParams(location.search);
  const startAccount = params.get('account'); // opened from an account on Control Center's home screen
  if (params.get('connected')) toast(`Connected ${params.get('connected')}`);
  if (params.get('authError')) toast(params.get('authError'), { error: true, timeout: 12000 });
  if (params.size) history.replaceState(null, '', location.pathname);

  try {
    S.accounts = await api('GET', '/mail/api/accounts');
  } catch {
    reader.innerHTML = '<div class="reader-empty"><p>Mailroom isn’t running. Start it again with the start file, then reload this page.</p></div>';
    return;
  }
  renderSidebar();
  if (!S.accounts.length) {
    renderList();
    showWelcome();
    return;
  }
  showEmptyReader();
  if (startAccount) showAccountByEmail(startAccount); else loadList();
  refreshUnread();
  checkVersion();
  await migrateOldSettings();
  pollNotify(); // alerts and blinking from while this page was closed
  if (S.accounts.some((a) => a.needsReconnect)) {
    const a = S.accounts.find((x) => x.needsReconnect);
    toast(`${a.email} needs to be reconnected.`, { error: true, action: { label: 'Reconnect', fn: () => reconnect(a) }, timeout: 12000 });
  }
}

// Pick up what the Mailroom program noticed (it checks every 15 seconds). Control Center
// also says so right away when it finds mail; this is the backup.
// Only asks Control Center on this computer (not Google), so it can be quick.
setInterval(() => { if (S.accounts.length) pollNotify(); }, 5_000);
setInterval(() => { if (usable().length) refreshUnread(); }, 120_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && usable().length) {
    pollNotify();
    refreshUnread();
    if (!S.loading) loadList({ keep: true });
  }
});
$('#soundBtn').addEventListener('click', () => setSound(!S.soundOn));

// ---------- live updates from Control Center ----------
// Control Center tells this page when the Mailroom program found new mail (so it shows up
// right away), and when the page is shown again after using another app.
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.cc !== 'event') return;
  if (e.data.type === 'account') { showAccountByEmail(e.data.data?.email); return; }
  if (!usable().length) return;
  if (e.data.type === 'mail') pollNotify();
  if (e.data.type === 'shown') {
    pollNotify();
    refreshUnread();
    if (!S.loading && S.view !== 'compose') loadList({ keep: true });
  }
});
// Before Control Center reloads this page (after an update or restart), keep what you're writing.
window.ccBeforeReload = async () => {
  if (S.view === 'compose' && S.compose && (composeIsDirty() || S.compose.draft)) await saveDraft();
  return true;
};

// ---------- selecting several emails at once ----------
let lastPicked = null;

function syncPicks() {
  // Forget ticks on conversations that are no longer in the list.
  const present = new Set(groups().map((g) => g.key));
  for (const k of S.checked) if (!present.has(k)) S.checked.delete(k);
  listEl.querySelectorAll('.row').forEach((r) => {
    const on = S.checked.has(r.dataset.group);
    r.classList.toggle('checked', on);
    r.querySelector('[data-pick]')?.setAttribute('aria-checked', String(on));
  });
  listEl.classList.toggle('picking', S.checked.size > 0);
  renderBulkBar();
}
function togglePick(key) {
  if (S.checked.has(key)) S.checked.delete(key); else S.checked.add(key);
  syncPicks();
}
function pickRange(fromKey, toKey) {
  const keys = shownGroups().map((g) => g.key);
  const a = keys.indexOf(fromKey);
  const b = keys.indexOf(toKey);
  if (a === -1 || b === -1) return togglePick(toKey);
  for (const k of keys.slice(Math.min(a, b), Math.max(a, b) + 1)) S.checked.add(k);
  syncPicks();
}
function clearPicks() { S.checked.clear(); lastPicked = null; syncPicks(); }

function renderBulkBar() {
  const bar = $('#bulkBar');
  const n = S.checked.size;
  bar.hidden = !n;
  if (!n) { bar.innerHTML = ''; return; }
  const shown = shownGroups();
  const all = shown.length && shown.every((g) => S.checked.has(g.key));
  const f = S.folder;
  const outlook = isOutlookOnly();
  const anyUnread = shown.some((g) => S.checked.has(g.key) && g.members.some((x) => x.unread));
  const b = (act, ic, label) => `<button class="tool" type="button" data-bulk="${act}" title="${esc(label)}">${icon(ic)}<span class="t-label">${esc(label)}</span></button>`;
  bar.innerHTML = `
    <span class="pick${all ? ' all' : ''}" data-bulk="all" role="checkbox" aria-checked="${all}" title="${all ? 'Clear the selection' : 'Select all shown'}"></span>
    <b class="bulk-count">${n} selected</b>
    ${['archive', 'spam', 'trash'].includes(f) ? b('inbox', 'inbox', 'Move to inbox') : b('archive', 'archive', 'Archive')}
    ${f !== 'spam' ? b('spam', 'spam', outlook ? 'Report junk' : 'Report spam') : ''}
    ${f !== 'trash' ? b('trash', 'trash', 'Delete') : ''}
    ${anyUnread ? b('read', 'mailOpen', 'Mark read') : b('unread', 'mail', 'Mark unread')}
    <button class="icon-btn bulk-x" type="button" data-bulk="clear" title="Clear the selection (Esc)" aria-label="Clear the selection">${icon('close')}</button>`;
}

$('#bulkBar').addEventListener('click', (e) => {
  const act = e.target.closest('[data-bulk]')?.dataset.bulk;
  if (!act) return;
  if (act === 'clear') return clearPicks();
  if (act === 'all') {
    const shown = shownGroups();
    if (shown.every((g) => S.checked.has(g.key))) clearPicks();
    else { shown.forEach((g) => S.checked.add(g.key)); syncPicks(); }
    return;
  }
  bulkAction(act);
});

// Runs at most a few at a time, so a big selection doesn't hit Google's/Microsoft's limits.
async function inBatches(items, fn, size = 4) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

async function bulkAction(act) {
  const picked = groups().filter((g) => S.checked.has(g.key));
  if (!picked.length) return;
  const members = picked.flatMap((g) => g.members);
  const n = picked.length;
  const word = n === 1 ? 'conversation' : 'conversations';
  const fromFolder = S.folder;

  if (act === 'read' || act === 'unread') {
    const value = act === 'unread';
    const affected = act === 'read' ? members : picked.map((g) => g.latest);
    affected.forEach((x) => { x.unread = value; });
    clearPicks();
    renderList();
    await inBatches(affected, (x) => runAction(x, act, { quiet: true }));
    toast(act === 'read' ? `Marked ${n} ${word} as read` : `Marked ${n} ${word} as unread`);
    return;
  }

  // Take them off the list right away; the server does the work in the background.
  const keys = new Set(members.map(keyOf));
  if (LEAVES_FOLDER[act]?.(fromFolder)) {
    S.msgs = S.msgs.filter((x) => !keys.has(keyOf(x)));
    if (S.cur && keys.has(keyOf(S.cur))) { S.sel = null; showEmptyReader(); }
  }
  clearPicks();
  renderList();
  const busy = toast(`Working on ${n} ${word}…`, { timeout: 60000 });
  const results = await inBatches(members, (x) => runAction(x, act, { quiet: true }));
  busy?.remove?.();
  const failed = results.filter((r) => !r).length;
  if (failed) loadList({ keep: true });

  // Reporting junk also sends everything from those senders to junk from now on (no need to ask).
  const toBlock = act === 'spam' ? blockable(members.filter((x, i) => results[i]).map((x) => x.from?.email)) : [];
  const blocking = autoBlock(toBlock);
  const actions = [];
  if (fromFolder === 'inbox' && ['archive', 'trash', 'spam'].includes(act)) {
    actions.push({
      label: 'Undo',
      fn: async () => {
        await unblockQuietly(await blocking);
        await inBatches(members, (x, i) => (results[i] ? runAction({ ...x, id: results[i].id || x.id }, 'inbox', { quiet: true }) : null));
        toast('Moved back to inbox');
        loadList({ keep: true });
      },
    });
  }
  const verb = { archive: 'Archived', trash: 'Deleted', spam: isOutlookOnly() ? 'Reported as junk' : 'Reported as spam', inbox: 'Moved to inbox' }[act] || 'Done';
  let msg = failed ? `${verb} ${n - Math.min(n, failed)} of ${n} ${word}. Some couldn’t be changed; the list was refreshed.` : `${verb} ${n} ${word}`;
  if (toBlock.length) msg += `. Future mail from ${toBlock.length === 1 ? toBlock[0] : `these ${toBlock.length} senders`} goes straight to junk`;
  toast(msg, { actions, error: !!failed && failed >= members.length, timeout: act === 'spam' || actions.length ? 12000 : 6000 });
}

// ---------- resizing the columns ----------
// Drag the line on the right of the folder list or the message list. Double-click resets it.
const COLS = { side: ['--side-w', 160, 420, '#sidebar'], list: ['--list-w', 260, 760, '.list-pane'] };
function applyCols() {
  for (const [key, [cssVar]] of Object.entries(COLS)) {
    const w = store.get(`col.${key}`, null);
    if (w) app.style.setProperty(cssVar, `${w}px`); else app.style.removeProperty(cssVar);
  }
}
for (const [key, [cssVar, min, max, sel]] of Object.entries(COLS)) {
  const pane = $(sel);
  const h = document.createElement('div');
  h.className = 'col-resize';
  h.title = 'Drag to resize · double-click to reset';
  h.setAttribute('role', 'separator');
  h.setAttribute('aria-orientation', 'vertical');
  pane.append(h);
  h.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    h.setPointerCapture(e.pointerId); // keeps working when the pointer passes over an email
    h.classList.add('dragging');
    app.classList.add('resizing');
    const left = pane.getBoundingClientRect().left;
    const move = (ev) => app.style.setProperty(cssVar, `${Math.round(Math.min(max, Math.max(min, ev.clientX - left)))}px`);
    const up = (ev) => {
      h.releasePointerCapture(ev.pointerId);
      h.removeEventListener('pointermove', move);
      h.removeEventListener('pointerup', up);
      h.classList.remove('dragging');
      app.classList.remove('resizing');
      store.set(`col.${key}`, Math.round(pane.getBoundingClientRect().width));
    };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
  });
  h.addEventListener('dblclick', () => { store.set(`col.${key}`, null); applyCols(); });
}
applyCols();

init();
