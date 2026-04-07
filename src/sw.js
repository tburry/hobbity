import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

const manifest = self.__WB_MANIFEST;

// Split manifest: precache core assets at install, background-cache images after activation.
const core = [];
const imageUrls = [];
for (const entry of manifest) {
  const url = typeof entry === 'string' ? entry : entry.url;
  if (url.endsWith('.webp')) {
    imageUrls.push(url);
  } else {
    core.push(entry);
  }
}

// Precache HTML, CSS, JS, fonts, etc. during install.
precacheAndRoute(core);
cleanupOutdatedCaches();

const IMAGE_CACHE = 'images';

// After activation, background-fetch all images into a runtime cache.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(IMAGE_CACHE).then(async (cache) => {
      const cached = await cache.keys();
      const cachedSet = new Set(cached.map((r) => r.url));

      for (const url of imageUrls) {
        const absolute = new URL(url, self.location).href;
        if (cachedSet.has(absolute)) continue;
        try {
          const response = await fetch(absolute);
          if (response.ok) await cache.put(absolute, response);
        } catch {
          // Network failure — skip, will retry next activation.
        }
      }
    })
  );
});

// Serve cached images with cache-first strategy.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.destination === 'image' && request.url.endsWith('.webp')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(IMAGE_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }))
    );
  }
});
