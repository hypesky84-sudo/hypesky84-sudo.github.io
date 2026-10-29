// Lets Control Center open like an app (Add to Home Screen / Install). Always asks the
// internet first, so updates show right away; the saved copy is only used when offline.
const CACHE = 'cc-online-v3';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // "no-cache": always ask GitHub whether there's a newer copy (a quick check when there isn't),
  // so an update shows up right away instead of up to 10 minutes later.
  // (A page load can't be copied with new settings, so it's asked for again by its address.)
  const fresh = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(fresh).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});

// ---------- alerts (iPhone and other devices) ----------
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { title: 'Control Center', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Control Center', {
    body: m.body || '',
    tag: m.tag || undefined,
    renotify: !!m.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    requireInteraction: !!m.urgent,
    data: { url: m.url || './' },
  }));
});

// Tapping an alert opens Control Center on the right app (Mailroom, Compliance).
// Only the main Control Center window is used, never one of the apps inside it (Mailroom etc.):
// sending an app's panel to Control Center loaded Control Center inside itself.
self.ccOpen = async (path) => {
  const url = new URL(path || './', self.registration.scope).href;
  const home = new URL(self.registration.scope).pathname;
  const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const main = open.find((c) => c.frameType !== 'nested' && new URL(c.url).pathname === home);
  if (main) {
    await main.focus().catch(() => {});
    main.postMessage({ cc: 'open', app: new URL(url).hash.slice(1) });
    return 'switched';
  }
  await self.clients.openWindow(url);
  return 'opened';
};
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.ccOpen(e.notification.data?.url));
});
