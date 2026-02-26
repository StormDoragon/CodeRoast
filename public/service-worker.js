const CACHE_NAME = 'coderoast-v1';
const WASM_CACHE = 'coderoast-wasm-v1';
const MODEL_CACHE = 'coderoast-models-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map((url) => {
          return cache.add(url).catch((err) => {
            console.log(`[SW] Failed to cache ${url}:`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && !cacheName.includes('-v1')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache WASM files aggressively (tree-sitter modules)
  if (url.pathname.endsWith('.wasm')) {
    event.respondWith(
      caches.open(WASM_CACHE).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) return response;
          return fetch(request).then((res) => {
            if (res.ok) {
              cache.put(request, res.clone());
            }
            return res;
          });
        });
      })
    );
    return;
  }

  // Cache GitHub raw content (user's code fetch)
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) return response;
          return fetch(request).then((res) => {
            if (res.ok) {
              cache.put(request, res.clone());
            }
            return res;
          });
        });
      })
    );
    return;
  }

  // Network-first for everything else (API calls, assets)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

// Message handler for cache clearing from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }).then(() => {
        event.ports[0]?.postMessage({ success: true });
      })
    );
  }
});
