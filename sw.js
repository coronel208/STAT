/* Service worker mínimo para poder "instalar" STAT como app — no reemplaza
   la sincronización en vivo con Firebase (eso ya lo maneja app.html con su
   propio respaldo local). Esto solo cachea el cascarón (HTML/CSS/JS propio)
   para que abra rápido y funcione si el celular se queda sin señal.
   Estrategia: red primero, caché como respaldo — así nunca te quedas
   pegado en una versión vieja mientras haya internet. */
const CACHE_NAME = 'stat-shell-v1';
const SHELL_FILES = ['app.html', 'admin.html', 'index.html', 'manifest.json', 'images/icon_stat.png', 'images/logo_stat.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Firebase y demás APIs externas siempre en vivo, nunca desde caché.
  if (!req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
