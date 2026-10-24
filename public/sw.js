// ClearPoint service worker.
// It does ONE thing: if a page can't be loaded because the phone is offline, show a friendly offline page.
// It never stores pages, payments, receipts, API or Supabase responses, so nobody can see stale or someone else's data.
const CACHE = 'clearpoint-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.mode !== 'navigate') return // images, scripts and data go straight to the network
  const path = new URL(request.url).pathname
  if (path.startsWith('/auth/') || path.startsWith('/api/')) return // never touch sign-in or API requests
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
})
