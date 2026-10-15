// Service worker: app shell offline. Red primero (siempre lo más nuevo) y caché como respaldo sin conexión.
// build-deploy.sh reemplaza el nombre de la caché por una marca de tiempo en cada publicación: así el navegador detecta la versión nueva.
const CACHE = 'finanzasos-v15';
const SHELL = ['./', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', ...['app', 'ctx', 'derive', 'actions', 'views', 'sheets', 'store', 'dates', 'advice', 'charts', 'fixed', 'debt', 'money', 'xlsx', 'vault', 'vault-ui', 'inputs', 'words', 'mirror', 'alerts', 'ics', 'notify', 'dialog'].map((m) => `js/${m}.js`)];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Red primero (siempre la versión más nueva); si no hay conexión, usa la copia guardada.
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
});

// ---------- Notificaciones locales (agenda guardada por la app en IndexedDB) ----------
const kv = (mode, fn) => new Promise((res, rej) => {
  const o = indexedDB.open('finanzasos-mirror', 1);
  o.onupgradeneeded = () => o.result.createObjectStore('kv');
  o.onerror = () => rej(o.error);
  o.onsuccess = () => {
    const db = o.result, t = db.transaction('kv', mode), r = fn(t.objectStore('kv'));
    t.oncomplete = () => { db.close(); res(r?.result); };
    t.onerror = () => rej(t.error);
  };
});
async function runAgenda() {
  const agenda = await kv('readonly', (s) => s.get('agenda'));
  if (!agenda?.items?.length) return;
  // Si la app está abierta y a la vista, el usuario ya ve las alertas dentro de ella
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (wins.some((w) => w.visibilityState === 'visible')) return;
  const notified = (await kv('readonly', (s) => s.get('notified'))) || {};
  const now = Date.now();
  let changed = false;
  for (const it of agenda.items) {
    if (it.at <= now && now - it.at <= it.maxAge && !notified[it.tag]) {
      await self.registration.showNotification(it.title, { body: it.body, tag: it.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { view: it.view } });
      notified[it.tag] = now; changed = true;
    }
  }
  for (const k of Object.keys(notified)) if (now - notified[k] > 30 * 864e5) { delete notified[k]; changed = true; }
  if (changed) await kv('readwrite', (s) => s.put(notified, 'notified'));
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'finanzasos-agenda') e.waitUntil(runAgenda()); });
self.addEventListener('message', (e) => { if (e.data === 'agenda-check') e.waitUntil(runAgenda()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const view = e.notification.data?.view || 'home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const w = list[0];
    if (w) { w.postMessage({ goto: view }); return w.focus(); }
    return self.clients.openWindow(`./?view=${encodeURIComponent(view)}`);
  }));
});
