// Ce fichier est généré automatiquement par vite-plugin-pwa
// Il sera remplacé lors du build par workbox

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('offline-cache').then((cache) => {
      const urlsToCache = [
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.ico',
        '/icons/android/android-launchericon-192-192.png',
        '/icons/ios/180.png'
      ];
      
      return Promise.allSettled(
        urlsToCache.map(url => 
          fetch(url)
            .then(response => {
              if (!response.ok) throw new Error(`Failed to fetch ${url}`);
              return cache.put(url, response);
            })
            .catch(error => {
              console.warn(`Failed to cache ${url}:`, error);
            })
        )
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les requêtes non supportées
  if (event.request.url.startsWith('chrome-extension://') ||
      event.request.url.startsWith('chrome://') ||
      event.request.url.startsWith('edge://') ||
      event.request.url.startsWith('about:') ||
      event.request.url.startsWith('data:') ||
      event.request.url.startsWith('blob:') ||
      event.request.url.startsWith('file:')) {
    return;
  }

  // Ne pas intercepter les requêtes de l'API ou de l'authentification
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/auth/') ||
      event.request.url.includes('google')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache uniquement les ressources statiques
        if (event.request.method === 'GET' &&
            (event.request.url.endsWith('.js') ||
             event.request.url.endsWith('.css') ||
             event.request.url.endsWith('.png') ||
             event.request.url.endsWith('.ico') ||
             event.request.url.endsWith('.json'))) {
          const responseToCache = response.clone();
          caches.open('offline-cache')
            .then(cache => {
              cache.put(event.request, responseToCache)
                .catch(error => {
                  console.warn('Failed to cache response:', error);
                });
            })
            .catch(error => {
              console.warn('Failed to open cache:', error);
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            // Si la ressource n'est pas en cache, retourner la page d'accueil
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
            return new Response('', {
              status: 404,
              statusText: 'Not Found'
            });
          });
      })
  );
});
