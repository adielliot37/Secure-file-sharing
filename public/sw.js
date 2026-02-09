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
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
      .catch(() => {})
  )
})

