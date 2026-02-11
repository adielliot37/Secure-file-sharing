const CACHE_NAME = 'storacha-share-v1'
const urlsToCache = [
  '/',
  '/view',
  '/src/main.jsx',
  '/src/App.jsx'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch(() => {})
  )
})

self.addEventListener('fetch', (event) => {
  // Only cache GET requests for same-origin resources
  if (event.request.method !== 'GET') return
  if (new URL(event.request.url).origin !== self.location.origin) return

  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  )
})



