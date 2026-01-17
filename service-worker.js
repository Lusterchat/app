// RelayTalk Service Worker v2.5
// Handles offline/404 errors with unified error page

const CACHE_NAME = 'relaytalk-cache-v2.5';
const OFFLINE_URL = '/offline.html';
const APP_VERSION = '2.5.0';

// Files to cache immediately
const PRECACHE_FILES = [
  // Core app files
  '/',
  '/index.html',
  '/style.css',
  '/opening.css',
  '/relay.png',
  '/manifest.json',
  
  // Error page (MUST be cached)
  '/offline.html',
  
  // SEO files
  '/robots.txt',
  '/sitemap.xml',
  '/_config.yml',
  '/.nojekyll',
  
  // Utils
  '/utils/auth.js',
  '/utils/supabase.js',
  
  // Auth pages
  '/pages/auth/index.html',
  '/pages/auth/style.css',
  '/pages/auth/script.js',
  
  // Login pages
  '/pages/login/index.html',
  '/pages/login/style.css',
  '/pages/login/script.js',
  
  // Home pages
  '/pages/home/index.html',
  '/pages/home/style.css',
  '/pages/home/script.js',
  
  // Friends pages
  '/pages/home/friends/index.html',
  '/pages/home/friends/style.css',
  '/pages/home/friends/script.js',
  
  // Chat pages
  '/pages/chats/index.html',
  '/pages/chats/style.css',
  '/pages/chats/script.js',
  '/pages/chats/chat-responsive.css',
  '/pages/chats/sent.mp3',
  '/pages/chats/recieve.mp3'
];

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Service Worker installing v' + APP_VERSION);
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Pre-caching ' + PRECACHE_FILES.length + ' files');
        
        // Cache critical files first
        const criticalFiles = PRECACHE_FILES.slice(0, 10);
        cache.addAll(criticalFiles)
          .then(() => {
            console.log('✅ Critical files cached');
            // Cache remaining files in background
            return cache.addAll(PRECACHE_FILES.slice(10));
          })
          .then(() => {
            console.log('✅ All files pre-cached');
          })
          .catch(error => {
            console.warn('⚠️ Some files failed to cache:', error);
          });
        
        return Promise.resolve();
      })
      .catch(error => {
        console.error('❌ Cache installation failed:', error);
      })
  );
});

// ====== ACTIVATE EVENT ======
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      
      // Take control immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated and ready');
      
      // Send message to all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// ====== FETCH EVENT ======
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Supabase requests
  if (event.request.url.includes('supabase.co')) {
    return;
  }
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  const requestUrl = new URL(event.request.url);
  
  // Handle different types of requests
  if (requestUrl.pathname.endsWith('.html') || 
      requestUrl.pathname === '/' ||
      !requestUrl.pathname.includes('.')) {
    // HTML pages: Network first, then cache, then offline page
    handleHtmlRequest(event);
  } else {
    // Static assets: Cache first, then network
    handleAssetRequest(event);
  }
});

// Handle HTML page requests
function handleHtmlRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the fresh response
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          console.log('📄 Serving HTML from cache:', event.request.url);
          return cachedResponse;
        }
        
        // Not in cache either, check if it's a 404
        console.log('❌ Page not found:', event.request.url);
        
        // Serve offline page with 404 context
        const offlineResponse = await caches.match(OFFLINE_URL);
        if (offlineResponse) {
          const modifiedResponse = new Response(offlineResponse.body, {
            status: 404,
            statusText: 'Not Found',
            headers: offlineResponse.headers
          });
          return modifiedResponse;
        }
        
        // Last resort: basic offline response
        return new Response(
          '<h1>Page Not Found</h1><p>Please check your connection.</p>',
          {
            status: 404,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      })
  );
}

// Handle static asset requests
function handleAssetRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Update cache in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {
              // Network failed, keep cached version
            });
          
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse.ok) {
              throw new Error('Network response not ok');
            }
            
            // Cache successful responses
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
            
            return networkResponse;
          })
          .catch(error => {
            console.log('❌ Asset fetch failed:', event.request.url, error);
            
            // Return appropriate fallback
            if (event.request.destination === 'image') {
              return caches.match('/relay.png');
            }
            
            if (event.request.url.endsWith('.css')) {
              return new Response('/* Fallback CSS */', {
                headers: { 'Content-Type': 'text/css' }
              });
            }
            
            if (event.request.url.endsWith('.js')) {
              return new Response('// Fallback JS', {
                headers: { 'Content-Type': 'text/javascript' }
              });
            }
            
            return new Response('Resource not available', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
}

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  console.log('📩 Message from client:', event.data);
  
  switch (event.data.type) {
    case 'GET_CACHED_PAGE':
      caches.match(event.data.url)
        .then(response => {
          event.ports[0].postMessage({
            success: !!response,
            url: event.data.url
          });
        });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(success => {
          event.ports[0].postMessage({
            success: success,
            message: 'Cache cleared'
          });
        });
      break;
      
    case 'GET_CACHE_INFO':
      caches.has(CACHE_NAME)
        .then(hasCache => {
          caches.open(CACHE_NAME)
            .then(cache => cache.keys())
            .then(keys => {
              event.ports[0].postMessage({
                version: APP_VERSION,
                hasCache: hasCache,
                cachedItems: keys.length,
                cacheName: CACHE_NAME
              });
            });
        });
      break;
      
    case 'UPDATE_NOW':
      self.skipWaiting();
      self.registration.update();
      event.ports[0].postMessage({ updating: true });
      break;
      
    case 'PING':
      event.ports[0].postMessage({ pong: true, version: APP_VERSION });
      break;
  }
});

// ====== BACKGROUND SYNC ======
self.addEventListener('sync', event => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncOfflineMessages());
  }
});

async function syncOfflineMessages() {
  try {
    const cache = await caches.open('offline-messages');
    const requests = await cache.keys();
    
    console.log(`📨 Syncing ${requests.length} offline messages`);
    
    for (const request of requests) {
      try {
        const response = await cache.match(request);
        const message = await response.json();
        
        // Try to send message
        const sendResponse = await fetch(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
        
        if (sendResponse.ok) {
          await cache.delete(request);
          console.log('✅ Message sent:', message);
        }
      } catch (error) {
        console.log('❌ Failed to send message:', error);
      }
    }
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

// ====== PUSH NOTIFICATIONS ======
self.addEventListener('push', event => {
  console.log('📱 Push received');
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'RelayTalk', body: 'New message' };
  }
  
  const options = {
    body: data.body || 'You have a new message',
    icon: '/relay.png',
    badge: '/relay.png',
    tag: 'relaytalk-message',
    data: { url: data.url || '/' },
    actions: [
      {
        action: 'open',
        title: 'Open Chat'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'RelayTalk', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window
        for (const client of clientList) {
          if (client.url.includes('relaytalk') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
  );
});

// ====== PERIODIC SYNC ======
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    console.log('🔄 Periodic cache update');
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Update critical files
    const criticalFiles = [
      '/',
      '/index.html',
      '/offline.html',
      '/manifest.json'
    ];
    
    for (const url of criticalFiles) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          await cache.put(url, response);
          console.log('✅ Updated:', url);
        }
      } catch (error) {
        console.log('⚠️ Failed to update:', url);
      }
    }
  } catch (error) {
    console.error('❌ Cache update failed:', error);
  }
}

// ====== ERROR HANDLING ======
self.addEventListener('error', event => {
  console.error('💥 Service Worker error:', event.error);
  event.preventDefault();
});

// ====== SERVICE WORKER STARTUP ======
console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');