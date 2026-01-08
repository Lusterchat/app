// Service Worker for RelayTalk - Caches Everything
const CACHE_NAME = 'relaytalk-cache-v22'; 
const APP_VERSION = '1.0.2';

const FOLDERS_TO_CACHE = [
  // Root files
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/opening.css',
  '/relay.png',
  '/manifest.json',
  '/service-worker.js',
  
  // Utils
  '/utils/auth.js',
  '/utils/supabase.js',
  
  // Auth folder
  '/pages/auth/index.html',
  '/pages/auth/style.css',
  '/pages/auth/script.js',
  
  // Login folder
  '/pages/login/index.html',
  '/pages/login/style.css',
  '/pages/login/script.js',
  
  // Home & Friends folder
  '/pages/home/index.html',
  '/pages/home/style.css',
  '/pages/home/script.js',
  '/pages/home/friends/index.html',
  '/pages/home/friends/style.css',
  '/pages/home/friends/script.js',
  
  // Chats folder & Audio
  '/pages/chats/index.html',
  '/pages/chats/style.css',
  '/pages/chats/script.js',
  '/pages/chats/chat-responsive.css',
  '/pages/chats/sent.mp3',
  '/pages/chats/recieve.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(FOLDERS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
