// Control Center on your phone — Mailroom.
// The pages only hold your phone login. Everything that touches Gmail and Outlook happens in
// the "mail" function on Supabase, which keeps the email sign-ins private.
'use strict';

const VERSION = '1.0.0';
const SUPA_URL = 'https://vzbxtbipabwyuvqvjoxx.supabase.co';
const SUPA_KEY = 'sb_publishable_i5hsg3cHLaoecoMKWhdGaQ_JsudO1QF'; // public by design (like a site address)
const FN = `${SUPA_URL}/functions/v1/mail`;

const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cc-phone-auth' },
});

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } },
};

const FOLDERS = [
  ['inbox', 'Inbox', '📥'], ['starred', 'Starred', '★'], ['sent', 'Sent', '📤'], ['drafts', 'Drafts', '📝'],
  ['archive', 'Archive', '🗄'], ['spam', 'Spam', '⚠'], ['trash', 'Trash', '🗑'],
];

const S = {
  view: 'login',
  accounts: [],
  folder: 'inbox',
  q: '',
  filter: store.get('cc-filter') || null, // one account, or all
  messages: [],
  next: {},
  errors: {},
  unread: {},
  draftThreads: {},
  loading: false,
  lastLoad: 0,
  thread: null,
  compose: null,
};

// ---------- talking to the mail function ----------

class ReconnectError extends Error {}

async function api(op, body = {}, { raw = false } = {}) {
  const { data } = await sb.auth.getSession();
  const session = data?.session;
  if (!session) { showLogin(); throw new Error('Please log in.'); }
  let res;
  try {
    res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: SUPA_KEY },
      body: JSON.stringify({ op, ...body }),
    });
  } catch {
    throw new Error('No connection. Check your internet and try again.');
  }
  if (res.status === 401) {
    const j = await res.json().catch(() => ({}));
    await sb.auth.signOut().catch(() => {});
    showLogin(j.error === 'Please log in again.' ? 'This login isn’t allowed to open Control Center, or it expired. Log in again.' : j.error);
    throw new Error('Please log in.');
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    if (j.reconnect) throw new ReconnectError(j.error);
    throw new Error(j.error || `Something went wrong (${res.status}).`);
  }
  return raw ? res : res.json();
}

// ---------- small helpers ----------

const acct = (id) => S.accounts.find((a) => a.id === id);
const myAddresses = () => new Set(S.accounts.map((a) => a.email.toLowerCase()));
const formatAddr = (p) => (p?.name ? `${p.name} <${p.email}>` : p?.email || '');
const shortName = (p) => p?.name || p?.email || '(no sender)';
const acctLabel = (a) => a ? a.email : '';

function shortDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
}
const longDate = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n || 0} B`);
const linkify = (escaped) => escaped.replace(/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g, (u) => `<a href="${u}">${u}</a>`);
const initial = (p) => (shortName(p).replace(/[^\p{L}\p{N}]/gu, '')[0] || '?').toUpperCase();

let toastTimer;
function toast(text, { action, onAction, timeout = 3500 } = {}) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(text)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  t.hidden = false;
  if (action) $('button', t).onclick = () => { t.hidden = true; onAction(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, timeout);
}

function sheet(items) {
  const el = $('#sheet');
  el.innerHTML = items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${esc(it.label)}</button>`).join('') + '<button data-i="-1">Cancel</button>';
  el.hidden = false; $('#sheetBg').hidden = false;
  const close = () => { el.hidden = true; $('#sheetBg').hidden = true; };
  $('#sheetBg').onclick = close;
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    close();
    const it = items[Number(b.dataset.i)];
    if (it) it.run();
  };
}

// ---------- screens and the phone's Back button ----------

function show(view) {
  S.view = view;
  for (const id of ['login', 'list', 'thread', 'compose']) $(`#${id}`).hidden = id !== view;
  window.scrollTo(0, view === 'list' ? (S.listScroll || 0) : 0);
}
function go(view) {
  if (S.view === 'list') S.listScroll = window.scrollY;
  history.pushState({ v: view }, '');
  show(view);
}
window.addEventListener('popstate', async (e) => {
  const v = e.state?.v || 'list';
  if (S.view === 'compose' && v !== 'compose') await leaveCompose();
  if (S.view === 'login') return;
  show(v === 'thread' && !S.thread ? 'list' : v);
});
const back = () => history.back();

// ---------- login ----------

let signupMode = false;
function showLogin(message) {
  S.view = 'login';
  for (const id of ['list', 'thread', 'compose']) $(`#${id}`).hidden = true;
  $('#login').hidden = false;
  const err = $('#loginError');
  err.hidden = !message; err.textContent = message || '';
}

$('#toggleSignup').onclick = () => {
  signupMode = !signupMode;
  $('#loginBtn').textContent = signupMode ? 'Create my login' : 'Log in';
  $('#toggleSignup').textContent = signupMode ? 'I already have a login' : 'First time? Create your login';
  $('#loginHint').textContent = signupMode ? 'Use your own email and a password of at least 8 characters. Only you can get in.' : 'Log in once on this phone. You’ll stay logged in.';
  $('#loginForm [name=password]').autocomplete = signupMode ? 'new-password' : 'current-password';
};

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = $('#loginBtn');
  const err = $('#loginError');
  err.hidden = true; btn.disabled = true;
  const email = f.email.value.trim(), password = f.password.value;
  try {
    if (signupMode) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        err.hidden = false;
        err.style.color = 'var(--ink)';
        err.textContent = 'Login created. Check your email for a confirmation link, then come back and log in.';
        $('#toggleSignup').click();
        return;
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    f.password.value = '';
    start();
  } catch (ex) {
    err.style.color = '';
    err.hidden = false;
    err.textContent = /invalid login/i.test(ex.message) ? 'That email or password isn’t right.' : /not confirmed/i.test(ex.message) ? 'Confirm your email first (check your inbox for the link).' : ex.message;
  } finally {
    btn.disabled = false;
  }
};

$('#logoutBtn').onclick = async () => {
  closeDrawer();
  if (!confirm('Log out of Control Center on this phone?')) return;
  await sb.auth.signOut().catch(() => {});
  try { localStorage.removeItem('cc-cache'); } catch { /* */ }
  showLogin();
};

// ---------- the message list ----------

function folderName() { return FOLDERS.find((f) => f[0] === S.folder)?.[1] || 'Inbox'; }

function renderChips() {
  const total = Object.values(S.unread).reduce((n, x) => n + (Number(x) || 0), 0);
  const chip = (id, label, color, n, warn) =>
    `<button class="chip ${S.filter === id ? 'on' : ''} ${warn ? 'warn' : ''}" data-id="${id ?? ''}">${color ? `<span class="dot" style="background:${esc(color)}"></span>` : ''}${esc(label)}${n ? ` <span class="n">${n > 999 ? '999+' : n}</span>` : ''}${warn ? ' ⚠' : ''}</button>`;
  $('#chips').innerHTML = chip(null, 'All', null, S.folder === 'inbox' ? total : 0)
    + S.accounts.map((a) => chip(a.id, a.name || a.email, a.color, S.folder === 'inbox' ? S.unread[a.id] : 0, a.needsReconnect)).join('');
}
$('#chips').onclick = (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  const id = b.dataset.id || null;
  S.filter = S.filter === id ? null : id;
  store.set('cc-filter', S.filter);
  renderChips();
  b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  loadList();
};

function hasDraft(m) { return S.draftThreads[m.accountId]?.includes(m.threadId); }

function rowHtml(m) {
  const a = acct(m.accountId);
  const outgoing = S.folder === 'sent' || S.folder === 'drafts' || m.draft;
  const who = outgoing ? `To: ${(m.to || []).map(shortName).join(', ') || '(no recipient)'}` : shortName(m.from);
  return `<li class="msg ${m.unread ? 'unread' : ''}" data-key="${esc(m.accountId)}|${esc(m.id)}">
    <span class="bar-color" style="background:${esc(a?.color || '#ccc')}"></span>
    <div class="main">
      <div class="top"><span class="who">${esc(who)}</span><span class="date">${shortDate(m.date)}</span></div>
      <div class="subj">${esc(m.subject || '(no subject)')}</div>
      <div class="snip">${esc(m.snippet || '')}</div>
      <div class="meta">${m.draft || (S.folder !== 'drafts' && hasDraft(m)) ? '<span class="tag-draft">Draft</span>' : ''}${m.starred ? '<span class="star">★</span>' : ''}${m.hasAttachments ? '<span>📎</span>' : ''}<span class="acct">${esc(acctLabel(a))}</span></div>
    </div></li>`;
}

function visibleMessages() {
  return S.messages.filter((m) => !S.filter || m.accountId === S.filter);
}

function renderList() {
  $('#folderTitle').textContent = S.q ? `Search: ${S.q}` : folderName();
  const list = visibleMessages();
  const ul = $('#messages');
  if (!list.length) {
    ul.innerHTML = S.loading ? '<div class="skeleton"></div>'.repeat(8) : `<li class="empty">${S.q ? 'Nothing matched your search.' : 'Nothing here.'}</li>`;
  } else {
    ul.innerHTML = list.map(rowHtml).join('');
  }
  $('#moreBtn').hidden = !Object.keys(S.next).length || S.loading;
  const bad = Object.entries(S.errors);
  const notice = $('#listNotice');
  const needs = S.accounts.filter((a) => a.needsReconnect && (!S.filter || a.id === S.filter));
  const lines = [];
  if (needs.length) lines.push(`Needs to be signed in again on the computer: ${needs.map((a) => a.email).join(', ')}`);
  if (bad.length) lines.push(`Couldn’t load: ${bad.map(([id, why]) => `${acct(id)?.email || id}${why === 'reconnect' ? ' (sign-in needed)' : ''}`).join(', ')}`);
  notice.hidden = !lines.length;
  notice.innerHTML = lines.map(esc).join('<br>');
}

let listSeq = 0;
async function loadList({ more = false, quiet = false } = {}) {
  const seq = ++listSeq;
  S.loading = true;
  if (!more && !quiet) { S.messages = S.messages.filter(() => false); S.next = {}; }
  if (!quiet || !S.messages.length) renderList();
  $('#refreshBtn').classList.add('spin');
  try {
    const r = await api('list', {
      folder: S.folder, q: S.q, sort: S.q ? 'best' : 'newest',
      accountIds: S.filter ? [S.filter] : null,
      more, pageTokens: more ? S.next : {},
    });
    if (seq !== listSeq) return;
    const merged = more ? [...S.messages, ...r.messages] : r.messages;
    const seen = new Set();
    S.messages = merged.filter((m) => { const k = `${m.accountId}|${m.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => b.date.localeCompare(a.date));
    S.next = r.next || {};
    S.errors = r.errors || {};
    S.lastLoad = Date.now();
    if (S.folder === 'inbox' && !S.q && !S.filter && !more) store.set('cc-cache', { accounts: S.accounts, messages: S.messages.slice(0, 200), unread: S.unread, at: Date.now() });
  } catch (e) {
    if (seq === listSeq && e.message !== 'Please log in.') toast(e.message);
  } finally {
    if (seq === listSeq) { S.loading = false; renderList(); $('#refreshBtn').classList.remove('spin'); }
  }
}

async function loadSide() {
  const [u, d] = await Promise.allSettled([api('unread'), api('draftThreads')]);
  if (u.status === 'fulfilled') S.unread = u.value;
  if (d.status === 'fulfilled') S.draftThreads = d.value;
  renderChips();
  if (S.view === 'list') renderList();
}

async function refreshAll({ quiet = false } = {}) {
  await Promise.all([loadList({ quiet }), loadSide()]);
}

$('#refreshBtn').onclick = () => refreshAll({ quiet: true });
$('#moreBtn').onclick = () => loadList({ more: true });

$('#searchBtn').onclick = () => {
  $('#searchForm').hidden = false;
  const i = $('#searchForm [name=q]'); i.value = S.q; i.focus();
};
$('#searchClose').onclick = () => {
  $('#searchForm').hidden = true;
  if (S.q) { S.q = ''; loadList(); }
};
$('#searchForm').onsubmit = (e) => {
  e.preventDefault();
  S.q = e.target.q.value.trim();
  e.target.q.blur();
  loadList();
};

$('#messages').onclick = (e) => {
  const li = e.target.closest('.msg'); if (!li) return;
  const [accountId, id] = li.dataset.key.split('|');
  const m = S.messages.find((x) => x.accountId === accountId && x.id === id);
  if (!m) return;
  if (m.draft && S.folder === 'drafts') openDraft(accountId, id);
  else openThread(m);
};

// ---------- folder drawer ----------

function renderFolders() {
  $('#folders').innerHTML = FOLDERS.map(([id, name, ic]) =>
    `<button class="drawer-item ${S.folder === id ? 'on' : ''}" data-f="${id}"><span class="ic">${ic}</span>${name}</button>`).join('');
}
function closeDrawer() { $('#drawer').hidden = true; $('#drawerBg').hidden = true; }
$('#menuBtn').onclick = () => { renderFolders(); $('#drawer').hidden = false; $('#drawerBg').hidden = false; };
$('#drawerBg').onclick = closeDrawer;
$('#folders').onclick = (e) => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  closeDrawer();
  S.folder = b.dataset.f;
  S.q = ''; $('#searchForm').hidden = true;
  renderChips();
  loadList();
};

// ---------- reading a conversation ----------

const EMAIL_CSS = `
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; font: 15px/1.5 -apple-system, Helvetica, Arial, sans-serif; color: #1c1c1c; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  pre.mr-plain { white-space: pre-wrap; font: inherit; margin: 0; }
  blockquote { margin: 0 0 0 .8ex; border-left: 2px solid #ccc; padding-left: 1ex; }
  a { color: #1a5c94; }`;

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

// Hides the earlier messages quoted at the bottom of a reply (shown again with "Show quoted text").
function trimQuote(doc) {
  let cut = false;
  for (const q of $$('.gmail_quote', doc)) { if (!q.parentElement?.closest('.gmail_quote')) { q.remove(); cut = true; } }
  for (const sel of ['#divRplyFwdMsg', '#appendonsend', 'div[style*="border-top:solid #E1E1E1"]', 'div[style*="border-top: solid #E1E1E1"]']) {
    const start = $(sel, doc);
    if (!start) continue;
    let n = start;
    // Outlook puts the quote after a marker: remove it and everything after it at that level.
    const top = n.parentElement && n.parentElement !== doc.body && !n.previousElementSibling ? n.parentElement : n;
    n = top;
    const prev = n.previousElementSibling;
    if (prev?.tagName === 'HR') prev.remove();
    while (n) { const nx = n.nextSibling; n.remove(); n = nx; }
    cut = true;
    break;
  }
  return cut;
}

function emailSrcdoc(m, full) {
  let head = '', body = '', trimmed = false;
  if (m.html) {
    const doc = cleanEmail(m.html);
    if (!full) trimmed = trimQuote(doc);
    head = $$('style', doc).map((s) => s.outerHTML).join('');
    $$('style', doc.body).forEach((s) => s.remove());
    body = doc.body.innerHTML;
  } else {
    body = `<pre class="mr-plain">${linkify(esc(m.text || ''))}</pre>`;
  }
  const csp = "default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline' https:; font-src data: https:";
  return {
    trimmed,
    html: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>${EMAIL_CSS}</style>${head}</head><body>${body}</body></html>`,
  };
}

function mountEmail(container, m, full = false) {
  const { html, trimmed } = emailSrcdoc(m, full);
  container.innerHTML = '';
  const f = document.createElement('iframe');
  f.className = 'email-frame';
  f.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  f.setAttribute('referrerpolicy', 'no-referrer');
  f.srcdoc = html;
  container.append(f);
  const fit = () => {
    const d = f.contentDocument;
    if (!d?.body) return;
    d.body.style.zoom = '';
    const w = f.clientWidth;
    const sw = d.documentElement.scrollWidth;
    if (w && sw > w + 2) d.body.style.zoom = String(Math.max(0.35, w / sw));
    f.style.height = `${Math.ceil(d.documentElement.scrollHeight * 1) + 4}px`;
  };
  f.addEventListener('load', () => {
    fit();
    try { for (const img of f.contentDocument.images) img.addEventListener('load', fit); } catch { /* */ }
    [300, 1000, 2500, 5000].forEach((t) => setTimeout(fit, t));
  });
  if (trimmed) {
    const b = document.createElement('button');
    b.className = 'link'; b.textContent = '••• Show quoted text';
    b.onclick = () => mountEmail(container, m, true);
    container.append(b);
  }
}

function attsHtml(m) {
  if (!m.attachments?.length) return '';
  return `<div class="atts">${m.attachments.map((a, i) =>
    `<button class="att" data-i="${i}"><span>📄</span><span class="nm">${esc(a.name)}</span><span class="sz">${size(a.size)}</span></button>`).join('')}</div>`;
}

async function downloadAttachment(accountId, messageId, a) {
  toast(`Opening ${a.name}…`, { timeout: 8000 });
  try {
    const res = await api('attachment', { accountId, id: messageId, attId: a.id, name: a.name, type: a.mimeType }, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(new Blob([blob], { type: a.mimeType || blob.type }));
    const link = document.createElement('a');
    link.href = url; link.download = a.name; link.target = '_blank'; link.rel = 'noopener';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    $('#toast').hidden = true;
  } catch (e) { toast(e.message); }
}

function draftCardHtml(m) {
  const to = (m.to || []).map(shortName).join(', ');
  return `<div class="draft-card" data-id="${esc(m.id)}"><b>Draft</b>${to ? ` to ${esc(to)}` : ''}<div class="muted small">${esc(m.snippet || '')}</div>
    <div class="row-btns"><button class="btn" data-edit>Keep writing</button><button class="btn" data-discard>Discard</button></div></div>`;
}

function messageHtml(m, i, open) {
  const a = acct(m.accountId);
  const to = [...(m.to || []), ...(m.cc || [])].map(shortName).join(', ');
  return `<article class="tm ${open ? '' : 'collapsed'}" data-i="${i}">
    <div class="tm-head"><span class="avatar" style="background:${esc(a?.color || '#888')}">${esc(initial(m.from))}</span>
      <div class="who"><div class="name">${esc(shortName(m.from))}</div><div class="to">to ${esc(to || 'me')}</div><div class="snip">${esc(m.snippet || '')}</div></div>
      <span class="date">${shortDate(m.date)}</span></div>
    <div class="tm-body"><div class="details">${esc(formatAddr(m.from))}<br>${esc(longDate(m.date))}${m.cc?.length ? `<br>Cc: ${esc(m.cc.map(formatAddr).join(', '))}` : ''}<br>In: ${esc(acctLabel(a))}</div>
      <div class="content"></div>${attsHtml(m)}</div></article>`;
}

async function openThread(m) {
  S.thread = { accountId: m.accountId, id: m.id, threadId: m.threadId, msgs: null, subject: m.subject };
  const box = $('#threadMsgs');
  $('#thread .subject').textContent = m.subject || '(no subject)';
  $('#thread .bar-title').textContent = acct(m.accountId)?.email || '';
  box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  go('thread');
  await loadThread();
}

async function loadThread() {
  const t = S.thread;
  const box = $('#threadMsgs');
  try {
    const msgs = await api('thread', { accountId: t.accountId, id: t.id });
    if (S.thread !== t) return;
    t.msgs = msgs;
    const real = msgs.filter((x) => !x.draft);
    const lastReal = real[real.length - 1];
    box.innerHTML = msgs.map((x, i) => (x.draft ? draftCardHtml(x) : messageHtml(x, i, x === lastReal || x.unread || x.id === t.id))).join('');
    for (const art of $$('.tm:not(.collapsed)', box)) mountEmail($('.content', art), msgs[Number(art.dataset.i)]);
    const art = $(`.tm[data-i="${msgs.indexOf(lastReal)}"]`, box);
    if (art && real.length > 1) art.scrollIntoView({ block: 'start' });
    // Mark as read.
    const unreadIds = real.filter((x) => x.unread).map((x) => x.id);
    if (unreadIds.length) {
      api('action', { accountId: t.accountId, ids: unreadIds, act: 'read' }).then(() => {
        for (const x of S.messages) if (x.accountId === t.accountId && unreadIds.includes(x.id)) x.unread = false;
        if (S.unread[t.accountId]) S.unread[t.accountId] = Math.max(0, S.unread[t.accountId] - unreadIds.length);
        renderChips();
      }).catch(() => {});
    }
  } catch (e) {
    box.innerHTML = `<p class="empty">${esc(e instanceof ReconnectError ? 'This email account needs to be signed in again (on the computer).' : e.message)}</p>`;
  }
}

$('#threadMsgs').onclick = async (e) => {
  const t = S.thread; if (!t?.msgs) return;
  const head = e.target.closest('.tm-head');
  if (head) {
    const art = head.parentElement;
    const m = t.msgs[Number(art.dataset.i)];
    art.classList.toggle('collapsed');
    const c = $('.content', art);
    if (!art.classList.contains('collapsed') && !c.firstChild) mountEmail(c, m);
    return;
  }
  const att = e.target.closest('.att');
  if (att) {
    const m = t.msgs[Number(att.closest('.tm').dataset.i)];
    downloadAttachment(t.accountId, m.id, m.attachments[Number(att.dataset.i)]);
    return;
  }
  const card = e.target.closest('.draft-card');
  if (card && e.target.closest('[data-edit]')) openDraft(t.accountId, card.dataset.id);
  if (card && e.target.closest('[data-discard]')) {
    try {
      await api('deleteDraft', { accountId: t.accountId, messageId: card.dataset.id, draftId: acct(t.accountId)?.provider === 'outlook' ? card.dataset.id : undefined });
      card.remove();
      forgetDraftMark(t.accountId, t.threadId);
      toast('Draft discarded');
    } catch (ex) { toast(ex.message); }
  }
};

$('#thread [data-back]').onclick = back;

const realIds = () => (S.thread?.msgs || []).filter((x) => !x.draft).map((x) => x.id);

async function threadAction(act) {
  const t = S.thread; if (!t) return;
  const ids = t.msgs ? realIds() : [t.id];
  const moves = ['archive', 'trash', 'spam', 'inbox'].includes(act);
  try {
    const r = await api('action', { accountId: t.accountId, ids, act });
    if (r.failed?.length && !r.done?.length) throw new Error('That didn’t work. Try again.');
    const words = { archive: 'Archived', trash: 'Moved to Trash', spam: 'Reported as spam', inbox: 'Moved to Inbox', unread: 'Marked unread', star: 'Starred', unstar: 'Star removed' };
    if (moves) {
      const leavesFolder = S.folder !== act && !(S.folder === 'starred' && act !== 'trash' && act !== 'spam');
      if (leavesFolder || S.folder === 'starred') S.messages = S.messages.filter((x) => !(x.accountId === t.accountId && x.threadId === t.threadId));
      renderList();
      back();
      const undo = { archive: 'inbox', trash: 'inbox', spam: 'inbox' }[act];
      const movedIds = (r.done || []).map((id) => r.moved?.[id] || id);
      toast(words[act], undo ? {
        action: 'Undo', timeout: 6000,
        onAction: async () => {
          try { await api('action', { accountId: t.accountId, ids: movedIds, act: undo }); toast('Undone'); loadList({ quiet: true }); }
          catch (ex) { toast(ex.message); }
        },
      } : {});
    } else {
      for (const x of S.messages) if (x.accountId === t.accountId && ids.includes(x.id)) {
        if (act === 'unread') x.unread = true;
        if (act === 'star') x.starred = true;
        if (act === 'unstar') x.starred = false;
      }
      if (act === 'unread') { renderList(); back(); }
      toast(words[act] || 'Done');
    }
  } catch (e) { toast(e instanceof ReconnectError ? 'This email account needs to be signed in again.' : e.message); }
}

$$('#thread [data-act]').forEach((b) => { b.onclick = () => threadAction(b.dataset.act); });
$('#threadMore').onclick = () => {
  const t = S.thread; if (!t) return;
  const starred = (t.msgs || []).some((x) => x.starred);
  const items = [
    { label: 'Mark as unread', run: () => threadAction('unread') },
    { label: starred ? 'Remove star' : 'Star', run: () => threadAction(starred ? 'unstar' : 'star') },
  ];
  if (['spam', 'trash', 'archive'].includes(S.folder)) items.push({ label: 'Move to Inbox', run: () => threadAction('inbox') });
  if (S.folder !== 'spam') items.push({ label: 'Report spam', danger: true, run: () => threadAction('spam') });
  sheet(items);
};

$$('#thread [data-reply]').forEach((b) => {
  b.onclick = () => {
    const t = S.thread; if (!t?.msgs) return;
    const real = t.msgs.filter((x) => !x.draft);
    const src = real[real.length - 1];
    if (!src) return;
    // A draft reply already in this conversation: keep writing that one (like Gmail).
    const existing = t.msgs.find((x) => x.draft);
    if (existing && b.dataset.reply !== 'forward') { openDraft(t.accountId, existing.id); return; }
    openCompose({ mode: b.dataset.reply, src, accountId: t.accountId });
  };
});

function forgetDraftMark(accountId, threadId) {
  if (S.draftThreads[accountId]) S.draftThreads[accountId] = S.draftThreads[accountId].filter((x) => x !== threadId);
}

// ---------- writing ----------

function dedupe(list) {
  const seen = new Set();
  return list.filter((p) => { const k = (p.email || '').toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}
function recipientsFor(mode, src) {
  const me = myAddresses();
  const notMe = (p) => !me.has((p.email || '').toLowerCase());
  const fromMe = me.has((src.from.email || '').toLowerCase());
  const primary = fromMe ? src.to : (src.replyTo?.length ? src.replyTo : [src.from]);
  if (mode === 'reply') return { to: primary, cc: [] };
  if (mode === 'replyAll') {
    let to = dedupe([...primary, ...(fromMe ? [] : src.to)].filter(notMe));
    if (!to.length) to = primary;
    const toSet = new Set(to.map((p) => p.email.toLowerCase()));
    return { to, cc: dedupe((src.cc || []).filter(notMe).filter((p) => !toSet.has(p.email.toLowerCase()))) };
  }
  return { to: [], cc: [] };
}
function subjectFor(mode, subject = '') {
  if (mode === 'forward') return /^\s*(fwd?|fw):/i.test(subject) ? subject : `Fwd: ${subject}`;
  return /^\s*re:/i.test(subject) ? subject : `Re: ${subject}`;
}
function originalBodyHtml(src) {
  if (!src.html) return `<div style="white-space:pre-wrap">${linkify(esc(src.text || ''))}</div>`;
  const d = cleanEmail(src.html);
  $$('style', d).forEach((s) => s.remove());
  return d.body.innerHTML;
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
const signatureBlock = (a) => (a?.signature ? `<div><br></div><div data-signature contenteditable="false">${a.signature}</div>` : '');

function fillFrom(selected) {
  const sel = $('#fromSel');
  sel.innerHTML = S.accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === selected ? 'selected' : ''} ${a.needsReconnect ? 'disabled' : ''}>${esc(a.name ? `${a.name} <${a.email}>` : a.email)}</option>`).join('');
}

function openCompose({ mode = 'new', src = null, accountId = null, resume = null } = {}) {
  const f = $('#composeForm');
  const from = accountId || S.filter || S.accounts.find((a) => !a.needsReconnect)?.id;
  fillFrom(from);
  const r = src ? recipientsFor(mode, src) : { to: [], cc: [] };
  const list = (x) => (x || []).map(formatAddr).join(', ');
  f.to.value = resume ? list(resume.to) : list(r.to);
  f.cc.value = resume ? list(resume.cc) : list(r.cc);
  f.bcc.value = resume ? list(resume.bcc) : '';
  f.subject.value = resume ? resume.subject : src ? subjectFor(mode, src.subject) : '';
  $$('.compose-form .cc').forEach((el) => { el.hidden = !(f.cc.value || f.bcc.value); });
  const ed = $('#editor');
  ed.innerHTML = resume ? originalBodyHtml(resume) : `<div><br></div>${signatureBlock(acct(from))}`;
  $('#quoteOpts').hidden = !src;
  f.includeQuote.checked = true;
  $('#origAttsOpt').hidden = !(mode === 'forward' && src?.attachments?.length);
  f.includeOriginalAttachments.checked = true;
  S.compose = {
    mode: resume ? 'draft' : mode, quoteMode: mode, src, from,
    attachments: resume ? resume.attachments.map((a) => ({ name: a.name, type: a.mimeType, size: a.size, serverId: a.serverId, data: a.data })) : [],
    removed: [],
    draftId: resume?.draftId || null,
    resume: resume ? { threadId: resume.threadId, inReplyTo: resume.inReplyTo, references: resume.references } : null,
    threadId: src?.threadId || resume?.threadId || null,
    savedKey: null,
    saving: null,
  };
  S.compose.savedKey = payloadKey(payload()); // nothing to save until you change something
  $('#composeTitle').textContent = { new: 'New message', reply: 'Reply', replyAll: 'Reply all', forward: 'Forward', draft: 'Draft' }[S.compose.mode];
  $('#draftStatus').textContent = resume ? 'Draft' : '';
  renderComposeAtts();
  go('compose');
  setTimeout(() => {
    if (f.to.value) { caretToStart(ed); S.compose.touched = true; } else f.to.focus();
  }, 50);
}

async function openDraft(accountId, messageId) {
  toast('Opening draft…', { timeout: 8000 });
  try {
    const d = await api('getDraft', { accountId, messageId });
    // Gmail needs the files themselves to keep them on the draft.
    for (const a of d.attachments || []) {
      if (a.serverId) continue;
      const res = await api('attachment', { accountId, id: messageId, attId: a.id, name: a.name, type: a.mimeType }, { raw: true });
      a.data = await blobToBase64(await res.blob());
    }
    $('#toast').hidden = true;
    openCompose({ accountId, resume: d });
  } catch (e) { toast(e.message); }
}

function caretToStart(ed) {
  ed.focus();
  const first = ed.firstElementChild && !ed.firstElementChild.hasAttribute('data-signature') ? ed.firstElementChild : ed;
  const r = document.createRange();
  r.setStart(first, 0); r.collapse(true);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
}
// Keeps the cursor where you can type: not inside the signature and not after it
// (tapping the empty space under the signature would otherwise lose what you type).
function fixCaret() {
  const ed = $('#editor');
  const sig = ed.querySelector('[data-signature]');
  if (!sig || !S.compose) return;
  const sel = getSelection();
  const n = sel.anchorNode;
  const kids = [...ed.childNodes];
  const bad = !n || !ed.contains(n) || sig.contains(n) || (n === ed && sel.anchorOffset > kids.indexOf(sig));
  const untouched = !S.compose.touched && ed.innerText.replace(/\s+/g, '') === sig.innerText.replace(/\s+/g, '');
  S.compose.touched = true;
  if (untouched) { caretToStart(ed); return; }
  if (!bad) return;
  // End of your text: the last line before the blank line above the signature.
  let target = sig.previousElementSibling;
  if (target && target.previousElementSibling && !target.textContent.trim()) target = target.previousElementSibling;
  target = target || ed;
  const r = document.createRange();
  r.selectNodeContents(target); r.collapse(false);
  sel.removeAllRanges(); sel.addRange(r);
}
$('#editor').addEventListener('click', fixCaret);
$('#editor').addEventListener('keydown', fixCaret);

function renderComposeAtts() {
  const c = S.compose;
  $('#composeAtts').innerHTML = c.attachments.map((a, i) =>
    `<span class="att"><span>📄</span><span class="nm">${esc(a.name)}</span><span class="sz">${size(a.size)}</span><button type="button" class="x" data-rm="${i}" aria-label="Remove">✕</button></span>`).join('');
}
$('#composeAtts').onclick = (e) => {
  const b = e.target.closest('[data-rm]'); if (!b) return;
  const c = S.compose;
  const [gone] = c.attachments.splice(Number(b.dataset.rm), 1);
  if (gone?.serverId) c.removed.push(gone.serverId);
  renderComposeAtts();
  scheduleSave();
};

const blobToBase64 = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => fail(new Error('Couldn’t read that file.'));
  r.readAsDataURL(blob);
});

$('#attachBtn').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = async (e) => {
  const c = S.compose;
  const files = [...e.target.files];
  e.target.value = '';
  const total = c.attachments.reduce((n, a) => n + (a.size || 0), 0) + files.reduce((n, f) => n + f.size, 0);
  if (total > 18 * 1024 * 1024) { toast('Attachments can be up to about 18 MB in total from the phone.'); return; }
  for (const file of files) c.attachments.push({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: await blobToBase64(file) });
  renderComposeAtts();
  scheduleSave();
};

$('#ccToggle').onclick = () => $$('.compose-form .cc').forEach((el) => { el.hidden = !el.hidden; });

$('#fromSel').onchange = (e) => {
  const c = S.compose;
  const old = acct(c.from), now = acct(e.target.value);
  const sig = $('#editor [data-signature]');
  if (sig) { if (now?.signature) sig.innerHTML = now.signature; else { sig.previousElementSibling?.remove(); sig.remove(); } }
  else if (now?.signature) $('#editor').insertAdjacentHTML('beforeend', signatureBlock(now));
  // A draft lives in one account: moving to another starts a fresh draft there.
  if (old?.id !== now?.id && c.draftId) {
    const oldId = c.draftId, oldAcct = old.id;
    c.draftId = null;
    c.attachments = c.attachments.filter((a) => a.data);
    api('deleteDraft', { accountId: oldAcct, draftId: oldId }).catch(() => {});
  }
  c.from = e.target.value;
  // Replying from a different account: it goes out as a new message (with the original quoted).
  if (c.src) c.mode = c.from === c.src.accountId ? c.quoteMode : 'new';
  scheduleSave();
};

function payload() {
  const f = $('#composeForm');
  const c = S.compose;
  const ed = $('#editor');
  const includeQuote = !!c.src && f.includeQuote.checked;
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${ed.innerHTML.replace(/ data-signature=""/g, '').replace(/ contenteditable="false"/g, '')}</div>`;
  return {
    accountId: c.from,
    mode: c.mode,
    sourceId: c.src && c.src.accountId === c.from ? c.src.id : undefined,
    to: f.to.value, cc: f.cc.value, bcc: f.bcc.value,
    subject: f.subject.value,
    html: bodyHtml + (includeQuote ? quoteHtml(c.quoteMode, c.src) : ''),
    text: ed.innerText + (includeQuote ? quoteText(c.quoteMode, c.src) : ''),
    attachments: c.attachments.map(({ name, type, data, serverId }) => ({ name, type, ...(data ? { data } : {}), ...(serverId ? { serverId } : {}) })),
    includeOriginalAttachments: f.includeOriginalAttachments.checked,
    draftId: c.draftId || undefined,
    threadId: c.resume?.threadId || undefined,
    inReplyTo: c.resume?.inReplyTo || undefined,
    references: c.resume?.references || undefined,
    removedAttachmentIds: c.removed,
  };
}
const payloadKey = (p) => JSON.stringify({ ...p, text: undefined, draftId: undefined, removedAttachmentIds: undefined, attachments: p.attachments.map((a) => [a.name, a.serverId || (a.data || '').length]) });

let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDraft(), 5000);
}
$('#composeForm').addEventListener('input', scheduleSave);

async function saveDraft() {
  const c = S.compose; if (!c) return true;
  clearTimeout(saveTimer);
  if (c.saving) await c.saving.catch(() => {});
  const p = payload();
  const key = payloadKey(p);
  if (key === c.savedKey) return true;
  $('#draftStatus').textContent = 'Saving…';
  c.saving = (async () => {
    const r = await api('saveDraft', p);
    c.draftId = r.draftId;
    if (r.files) {
      // Outlook: files now on the draft get their ids, so they aren't uploaded again.
      const left = [...r.files];
      for (const a of c.attachments) {
        const i = left.findIndex((x) => x.name === a.name);
        if (i >= 0) { a.serverId = left[i].serverId; delete a.data; left.splice(i, 1); }
      }
    }
    c.removed = [];
    c.savedKey = key;
    if (c.threadId && !(S.draftThreads[c.from] || []).includes(c.threadId)) (S.draftThreads[c.from] ||= []).push(c.threadId);
  })();
  try {
    await c.saving;
    if (S.compose === c) $('#draftStatus').textContent = 'Saved';
    return true;
  } catch (e) {
    if (S.compose === c) $('#draftStatus').textContent = 'Not saved';
    return false;
  } finally {
    c.saving = null;
  }
}

function isEmpty() {
  const f = $('#composeForm');
  const text = $('#editor').innerText.replace(/\s+/g, '');
  const sigText = ($('#editor [data-signature]')?.innerText || '').replace(/\s+/g, '');
  return !f.to.value && !f.cc.value && !f.bcc.value && !f.subject.value.trim() && (!text || text === sigText) && !S.compose.attachments.length;
}

// Leaving the message saves it to Drafts (like Gmail).
async function leaveCompose() {
  const c = S.compose; if (!c) return;
  clearTimeout(saveTimer);
  if (isEmpty() && !c.draftId) { S.compose = null; return; }
  const changed = payloadKey(payload()) !== c.savedKey;
  const ok = changed ? await saveDraft() : true;
  S.compose = null;
  if (!ok) { toast('Couldn’t save the draft. Check your connection.'); return; }
  if (!changed) return;
  toast('Saved to Drafts', {
    action: 'Discard', timeout: 6000,
    onAction: async () => {
      try { await api('deleteDraft', { accountId: c.from, draftId: c.draftId }); forgetDraftMark(c.from, c.threadId); toast('Draft discarded'); if (S.folder === 'drafts') loadList({ quiet: true }); }
      catch (e) { toast(e.message); }
    },
  });
  if (S.folder === 'drafts') loadList({ quiet: true });
  if (S.thread && S.view !== 'list') loadThread();
}

$('#composeClose').onclick = back;

$('#sendBtn').onclick = async () => {
  const c = S.compose; if (!c) return;
  const p = payload();
  if (!p.to.trim() && !p.cc.trim() && !p.bcc.trim()) { toast('Add at least one recipient.'); $('#composeForm').to.focus(); return; }
  if (!p.subject.trim() && !confirm('Send without a subject?')) return;
  const btn = $('#sendBtn');
  btn.disabled = true; btn.textContent = 'Sending…';
  clearTimeout(saveTimer);
  if (c.saving) await c.saving.catch(() => {});
  try {
    await api('send', { ...payload(), draftId: c.draftId || undefined });
    forgetDraftMark(c.from, c.threadId);
    S.compose = null;
    back();
    toast('Sent');
    if (S.thread && c.src) setTimeout(() => { if (S.view === 'thread') loadThread(); }, 1500);
    if (S.folder === 'sent' || S.folder === 'drafts') loadList({ quiet: true });
  } catch (e) {
    toast(e instanceof ReconnectError ? 'This email account needs to be signed in again.' : e.message, { timeout: 6000 });
  } finally {
    btn.disabled = false; btn.textContent = 'Send';
  }
};

$('#composeBtn').onclick = () => openCompose({ mode: 'new' });

// ---------- starting up ----------

async function start() {
  S.view = 'list';
  history.replaceState({ v: 'list' }, '');
  show('list');
  $('#versionLine').textContent = `Phone version ${VERSION}`;
  const cache = store.get('cc-cache');
  if (cache?.accounts?.length) {
    S.accounts = cache.accounts;
    S.unread = cache.unread || {};
    if (S.folder === 'inbox' && !S.q) S.messages = cache.messages || [];
    renderChips(); renderList();
  }
  try {
    S.accounts = await api('accounts');
  } catch (e) {
    if (e.message !== 'Please log in.') toast(e.message);
    return;
  }
  if (S.filter && !acct(S.filter)) S.filter = null;
  renderChips();
  refreshAll({ quiet: !!S.messages.length });
}

// Fresh mail when you come back to the app, and every 2 minutes while it's open on the list.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.view !== 'login' && Date.now() - S.lastLoad > 60_000) {
    if (S.view === 'list') refreshAll({ quiet: true }); else loadSide();
  }
});
setInterval(() => {
  if (document.visibilityState === 'visible' && S.view === 'list' && !S.loading && window.scrollY < 200 && Date.now() - S.lastLoad > 110_000) refreshAll({ quiet: true });
}, 30_000);

// Save a draft if the app is closed while writing.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && S.compose && !isEmpty()) saveDraft();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

(async () => {
  const { data } = await sb.auth.getSession();
  if (data?.session) start(); else showLogin();
})();
