const CACHE = 'gestion-os-v1';

// Al instalar, toma control inmediato sin esperar
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Borra todos los cachés anteriores
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // No interceptar Firebase, EmailJS ni fuentes externas
  const url = e.request.url;
  if (!url.startsWith(self.location.origin)) return;

  // Para el index.html: siempre red primero, caché como respaldo
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Si la respuesta es válida, guarda copia fresca en caché
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Sin internet: sirve desde caché
        return caches.match(e.request);
      })
  );
});
