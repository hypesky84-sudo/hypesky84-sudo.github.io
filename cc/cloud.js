// Control Center online: the translator.
// The pages are the same ones Control Center shows on your computer. They ask their server
// for things like "/mail/api/accounts". On the computer that server is Control Center itself;
// here this file sends those same requests to Control Center's online server (on Supabase)
// with your login, and hands the answers back to the page unchanged.
(() => {
  'use strict';
  if (window.__ccCloud) return;
  window.__ccCloud = true;

  const FN = 'https://vzbxtbipabwyuvqvjoxx.supabase.co/functions/v1/cc';
  const KEY = 'sb_publishable_i5hsg3cHLaoecoMKWhdGaQ_JsudO1QF';
  const AUTH_KEY = 'cc-auth'; // where the login page keeps your session (same site, so shared)
  const API = /\/(mail|compliance|mvr|hub)\/api(\/[^?#]*)?(\?[^#]*)?/;
  const realFetch = window.fetch.bind(window);

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  function headers() {
    const h = { 'Content-Type': 'application/json', apikey: KEY };
    const test = read('cc-test-key');
    if (test) h['x-cc-test'] = test;
    let token = null;
    try { token = JSON.parse(read(AUTH_KEY) || 'null')?.access_token || null; } catch { /* none */ }
    // The Control Center window keeps the login fresh; ask it for the newest one.
    try { token = window.top.ccToken?.() || token; } catch { /* other window */ }
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }
  function loggedOut() {
    try { window.top.postMessage({ cc: 'logged-out' }, location.origin); } catch { /* fine */ }
  }

  function toRequest(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const m = (url.pathname + url.search).match(API);
    if (!m) return null;
    const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    let body = init.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* keep text */ } }
    return { method, path: `/${m[1]}/api${m[2] || ''}`, query: (m[3] || '').slice(1), body: body ?? undefined };
  }
  // Files (attachments, MVR documents) come back as the file itself, one at a time.
  const isFile = (r) => r.method === 'GET' && (/\/attachments\/[^/]+$/.test(r.path) || r.path === '/mvr/api/file');

  const jsonResponse = (status, json) => new Response(JSON.stringify(json ?? null), { status, headers: { 'Content-Type': 'application/json' } });

  async function send(body) {
    let res;
    try {
      res = await realFetch(FN, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    } catch {
      throw new TypeError('Can’t reach Control Center online. Check the internet connection.');
    }
    if (res.status === 401) {
      const j = await res.clone().json().catch(() => ({}));
      if (j.error === 'Please log in again.') loggedOut();
    }
    return res;
  }

  // ---------- several requests at once ----------
  // Mailroom asks for each of your 17 accounts separately (lists, unread counts). Those are
  // sent together as one request, which keeps Control Center well inside the free limits.
  let queue = [];
  let timer = null;
  function flushQueue() {
    const items = queue;
    queue = [];
    timer = null;
    for (let i = 0; i < items.length; i += 40) {
      const part = items.slice(i, i + 40);
      send({ batch: part.map((x) => x.req) })
        .then(async (res) => {
          if (!res.ok) {
            const j = await res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
            part.forEach((x) => x.resolve(jsonResponse(res.status, j)));
            return;
          }
          const { batch } = await res.json();
          part.forEach((x, k) => x.resolve(jsonResponse(batch[k]?.status || 500, batch[k]?.json)));
        })
        .catch((e) => part.forEach((x) => x.reject(e)));
    }
  }
  function enqueue(req) {
    return new Promise((resolve, reject) => {
      queue.push({ req, resolve, reject });
      if (queue.length >= 40) { clearTimeout(timer); flushQueue(); }
      else if (!timer) timer = setTimeout(flushQueue, 25);
    });
  }

  // ---------- new-mail checks ----------
  // Mailroom asks "anything new?" every 5 seconds. The online server looks for new mail once a
  // minute, so asking it every 20 seconds is plenty; in between, the last answer is reused.
  let notifyCache = null;
  let notifyAt = 0;
  async function notify(req) {
    const after = Number(new URLSearchParams(req.query).get('after'));
    if (notifyCache && Date.now() - notifyAt < 20_000 && Number.isFinite(after)) {
      const seenAll = after >= notifyCache.seq;
      const events = (notifyCache.events || []).filter((e) => e.seq > after);
      if (seenAll || events.length) return jsonResponse(200, { ...notifyCache, events: after < 0 ? [] : events });
    }
    const res = await enqueue(req);
    if (res.ok) {
      const st = await res.clone().json();
      notifyCache = st;
      notifyAt = Date.now();
    }
    return res;
  }

  async function cloudFetch(req) {
    if (req.method === 'GET' && req.path === '/mail/api/notify') return notify(req);
    if (isFile(req)) return send(req);
    // Reading can be bundled; changes go one by one, in order.
    if (req.method === 'GET') return enqueue(req);
    if (req.path.startsWith('/mail/api/notify')) notifyAt = 0; // ask fresh next time
    const res = await send(req);
    return res;
  }

  window.fetch = function (input, init) {
    const req = toRequest(input, init);
    return req ? cloudFetch(req) : realFetch(input, init);
  };

  // ---------- links to files (open / download an attachment or an MVR) ----------
  document.addEventListener('click', async (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a || e.defaultPrevented) return;
    const href = a.getAttribute('href') || '';
    const req = toRequest(href);
    if (!req) return;
    e.preventDefault();
    e.stopPropagation();
    const download = a.hasAttribute('download') || /[?&]download=1\b/.test(href);
    const win = download ? null : window.open('', '_blank');
    if (win) win.document.write('<p style="font:16px system-ui;padding:20px;color:#555">Opening…</p>');
    try {
      const res = await send(req);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Couldn’t open the file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (download) {
        const name = a.getAttribute('download') || decodeURIComponent(((res.headers.get('content-disposition') || '').match(/filename\*=UTF-8''([^;]+)/) || [])[1] || 'file');
        const link = Object.assign(document.createElement('a'), { href: url, download: name });
        document.body.append(link); link.click(); link.remove();
      } else if (win) win.location.href = url;
      else location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err) {
      if (win) win.close();
      alert(err.message);
    }
  }, true);
})();
