// RelayTalk Service Worker v2.7
// Handles offline/404 errors with offline entertainment

const CACHE_NAME = 'relaytalk-cache-v2.7';
const OFFLINE_URL = '/offline/index.html';
const APP_VERSION = '2.7.0';

// Files to cache immediately - ONLY OFFLINE ENTERTAINMENT PAGES
const PRECACHE_FILES = [
  // ===== OFFLINE ENTERTAINMENT PAGES ONLY =====
  // Main offline page
  '/offline/index.html',

  // Shayari Section
  '/offline/section1/main.html',
  '/offline/section1/main.css',
  '/offline/section1/main.js',
  '/offline/section1/shayari-data.js',

  // TV Section
  '/offline/section2/main.html',
  '/offline/section2/main.css',
  '/offline/section2/main.js',

  // Video files for TV section (5 videos)
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4'
];

// Track if we've started caching
let cacheStarted = false;

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Service Worker installing v' + APP_VERSION);

  // Don't pre-cache immediately - wait for first interaction
  console.log('⏸️ Caching paused until first user interaction');
  
  // Skip waiting to activate immediately
  self.skipWaiting();

  event.waitUntil(Promise.resolve());
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
            type: 'SW_READY',
            version: APP_VERSION,
            message: 'Service Worker ready. Click anywhere to start caching offline content.'
          });
        });
      });
    })
  );
});

// ====== START CACHING FUNCTION ======
function startCaching() {
  if (cacheStarted) return;
  
  cacheStarted = true;
  console.log('🚀 Starting offline content caching...');
  
  caches.open(CACHE_NAME)
    .then(cache => {
      console.log('📦 Caching offline entertainment files:', PRECACHE_FILES);
      
      // Cache files one by one to avoid blocking
      const cachePromises = PRECACHE_FILES.map(url => {
        return cache.add(url)
          .then(() => {
            console.log('✅ Cached:', url);
          })
          .catch(error => {
            console.warn('⚠️ Failed to cache:', url, error);
          });
      });
      
      return Promise.all(cachePromises);
    })
    .then(() => {
      console.log('🎉 All offline content cached successfully!');
      
      // Notify all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_COMPLETE',
            message: 'Offline entertainment content is now cached and ready!'
          });
        });
      });
    })
    .catch(error => {
      console.error('❌ Caching failed:', error);
    });
}

// ====== FETCH EVENT ======
self.addEventListener('fetch', event => {
  // Start caching on first fetch (first user interaction)
  if (!cacheStarted) {
    startCaching();
  }

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
  const path = requestUrl.pathname;

  // Check if it's an offline entertainment file
  if (path.startsWith('/offline/')) {
    handleOfflineFileRequest(event);
  } else {
    handleAppFileRequest(event);
  }
});

// Handle offline entertainment file requests (CACHE FIRST)
function handleOfflineFileRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('📦 Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // If not in cache, fetch and cache
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                  console.log('💾 Cached on-demand:', event.request.url);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed
            console.log('❌ Offline file not available:', event.request.url);
            
            // Return appropriate fallback
            if (event.request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ccc"/><text x="50" y="55" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">Image</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            return new Response('Resource unavailable offline', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
}

// Handle app file requests (NETWORK ONLY, NO CACHING)
function handleAppFileRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return response;
      })
      .catch(async (error) => {
        console.log('🌐 Network failed for:', event.request.url);

        // Check if it's a page request
        const request = event.request;
        const acceptHeader = request.headers.get('Accept') || '';
        const isHtmlRequest = acceptHeader.includes('text/html') || 
                             request.url.endsWith('.html') ||
                             !request.url.includes('.') ||
                             request.url.endsWith('/');

        if (isHtmlRequest) {
          console.log('📴 Offline detected, redirecting to entertainment');
          
          // Check if offline page is cached
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }

          // If offline page not cached yet, show loading message
          return new Response(
            `
            <!DOCTYPE html>
            <html>
            <head>
              <title>You're Offline</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  text-align: center;
                  padding: 50px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  min-height: 100vh;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                }
                h1 {
                  font-size: 2.5rem;
                  margin-bottom: 20px;
                }
                p {
                  font-size: 1.1rem;
                  margin-bottom: 30px;
                  max-width: 500px;
                  line-height: 1.6;
                }
                .spinner {
                  border: 4px solid rgba(255, 255, 255, 0.3);
                  border-radius: 50%;
                  border-top: 4px solid white;
                  width: 40px;
                  height: 40px;
                  animation: spin 1s linear infinite;
                  margin: 20px auto;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                a {
                  display: inline-block;
                  padding: 12px 30px;
                  background: white;
                  color: #667eea;
                  text-decoration: none;
                  border-radius: 25px;
                  font-weight: bold;
                  margin: 10px;
                }
              </style>
            </head>
            <body>
              <h1>📴 You're Offline</h1>
              <p>RelayTalk requires an internet connection.</p>
              <p>Loading offline entertainment content...</p>
              <div class="spinner"></div>
              <script>
                // Try to load offline page
                setTimeout(() => {
                  window.location.href = '/offline/index.html';
                }, 3000);
                
                // If still fails after 5 seconds, show manual option
                setTimeout(() => {
                  document.body.innerHTML = `
                    <h1>📴 You're Offline</h1>
                    <p>Offline content is still loading. You can try:</p>
                    <a href="/offline/index.html">Open Entertainment</a>
                    <a href="/" onclick="location.reload()">Retry Main App</a>
                  `;
                }, 5000);
              </script>
            </body>
            </html>
            `,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html' }
            }
          );
        }
        
        // For non-HTML files, return error
        throw error;
      })
  );
}

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  console.log('📩 Message from client:', event.data);

  switch (event.data.type) {
    case 'START_CACHING':
      console.log('🚀 Starting caching from client request');
      startCaching();
      event.ports[0].postMessage({ started: true });
      break;

    case 'GET_CACHE_STATUS':
      caches.has(CACHE_NAME)
        .then(hasCache => {
          if (hasCache) {
            caches.open(CACHE_NAME)
              .then(cache => cache.keys())
              .then(keys => {
                event.ports[0].postMessage({
                  hasCache: true,
                  cachedItems: keys.length,
                  cacheStarted: cacheStarted,
                  offlineReady: keys.some(k => k.url.includes('/offline/index.html'))
                });
              });
          } else {
            event.ports[0].postMessage({
              hasCache: false,
              cacheStarted: cacheStarted,
              offlineReady: false
            });
          }
        });
      break;

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
          cacheStarted = false;
          event.ports[0].postMessage({
            success: success,
            message: 'Cache cleared. Caching will restart on next interaction.'
          });
        });
      break;

    case 'GET_CACHE_INFO':
      caches.has(CACHE_NAME)
        .then(hasCache => {
          if (hasCache) {
            caches.open(CACHE_NAME)
              .then(cache => cache.keys())
              .then(keys => {
                event.ports[0].postMessage({
                  version: APP_VERSION,
                  hasCache: true,
                  cachedItems: keys.length,
                  cacheName: CACHE_NAME,
                  cacheStarted: cacheStarted,
                  cachedFiles: keys.map(k => k.url)
                });
              });
          } else {
            event.ports[0].postMessage({
              version: APP_VERSION,
              hasCache: false,
              cachedItems: 0,
              cacheName: CACHE_NAME,
              cacheStarted: cacheStarted
            });
          }
        });
      break;

    case 'UPDATE_NOW':
      self.skipWaiting();
      self.registration.update();
      event.ports[0].postMessage({ updating: true });
      break;

    case 'PING':
      event.ports[0].postMessage({ 
        pong: true, 
        version: APP_VERSION,
        cacheStarted: cacheStarted
      });
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
        for (const client of clientList) {
          if (client.url.includes('relaytalk') && 'focus' in client) {
            return client.focus();
          }
        }

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
  if (!cacheStarted) return;
  
  try {
    const cache = await caches.open(CACHE_NAME);

    const offlineFiles = [
      '/offline/index.html',
      '/offline/section1/main.html',
      '/offline/section2/main.html'
    ];

    for (const url of offlineFiles) {
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