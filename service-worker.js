// RelayTalk Service Worker v3.3
// Unified offline handling - Always redirects to offline page when offline

const CACHE_NAME = 'relaytalk-cache-v3-3';
const OFFLINE_URL = '/offline/index.html';
const APP_VERSION = '3.3.0';

// Files to cache (core files + offline entertainment)
const PRECACHE_FILES = [
  // ===== CORE APP FILES =====
  '/',
  '/index.html',
  '/style.css',
  '/opening.css',
  '/relay.png',
  '/manifest.json',

  // ===== OFFLINE ENTERTAINMENT (MUST BE CACHED) =====
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

  // Videos
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4',

  // ===== APP PAGES =====
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

// Track if we're online
let isOnline = true;

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Installing Service Worker v' + APP_VERSION);
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Pre-caching ' + PRECACHE_FILES.length + ' files');
        
        // Cache OFFLINE PAGE FIRST - Most important!
        const offlineFirst = [
          OFFLINE_URL,
          '/',
          '/index.html',
          '/offline/section1/main.html',
          '/offline/section2/main.html'
        ];
        
        return cache.addAll(offlineFirst)
          .then(() => {
            console.log('✅ Offline page cached');
            // Cache remaining in background
            const remaining = PRECACHE_FILES.filter(f => !offlineFirst.includes(f));
            const promises = remaining.map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok) return cache.put(url, response);
                })
                .catch(() => {
                  console.warn('⚠️ Failed to cache:', url);
                });
            });
            return Promise.all(promises);
          });
      })
      .then(() => {
        console.log('✅ All files cached');
        return self.skipWaiting();
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
      console.log('✅ Service Worker activated');
      
      // Notify all pages
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
  
  // Skip external requests
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  // Skip Supabase requests
  if (event.request.url.includes('supabase.co')) return;
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  const path = url.pathname;
  
  // Check if it's an offline entertainment file
  if (path.startsWith('/offline/')) {
    // Always serve offline files from cache first
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request);
        })
    );
    return;
  }
  
  // === FOR ALL OTHER REQUESTS ===
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Network successful - we're online
        isOnline = true;
        
        // Cache fresh response
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        
        return response;
      })
      .catch(async () => {
        // Network failed - we're offline
        isOnline = false;
        
        // Check if it's a PAGE request
        const accept = event.request.headers.get('Accept') || '';
        const isPageRequest = accept.includes('text/html') || 
                             path.endsWith('.html') ||
                             path === '/' ||
                             !path.includes('.');
        
        if (isPageRequest) {
          // === CRITICAL: ALWAYS REDIRECT TO OFFLINE PAGE WHEN OFFLINE ===
          console.log('📴 Offline - Redirecting to offline entertainment');
          return caches.match(OFFLINE_URL)
            .then(offlinePage => {
              if (offlinePage) {
                // Return the offline page with 200 status
                return new Response(offlinePage.body, {
                  status: 200,
                  statusText: 'OK',
                  headers: offlinePage.headers
                });
              }
              
              // Fallback if offline page not in cache
              return new Response(
                `<h1>Offline Entertainment</h1>
                 <p>Welcome to RelayTalk offline mode!</p>
                 <a href="/offline/index.html">Click here to open</a>`,
                { 
                  headers: { 'Content-Type': 'text/html' },
                  status: 200
                }
              );
            });
        }
        
        // For assets (CSS, JS, images), try cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        
        // Fallback for assets
        if (path.endsWith('.css')) {
          return new Response('/* Offline fallback */', {
            headers: { 'Content-Type': 'text/css' }
          });
        }
        
        if (path.endsWith('.js')) {
          return new Response('// Offline fallback', {
            headers: { 'Content-Type': 'text/javascript' }
          });
        }
        
        if (event.request.destination === 'image') {
          return caches.match('/relay.png');
        }
        
        return new Response('', { status: 404 });
      })
  );
});

// ====== AUTO-CACHE ON NAVIGATION ======
// This caches pages as user visits them
self.addEventListener('fetch', event => {
  // Only cache GET requests for same-origin HTML pages
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  const accept = event.request.headers.get('Accept') || '';
  const isPageRequest = accept.includes('text/html') || 
                       url.pathname.endsWith('.html') ||
                       url.pathname === '/';
  
  if (isPageRequest && isOnline) {
    // Cache this page in background when online
    event.waitUntil(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            return caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, response));
          }
        })
        .catch(() => {
          // Silent fail - network might have dropped
        })
    );
  }
});

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  console.log('📩 Message:', event.data);
  
  switch (event.data.type) {
    case 'GET_STATUS':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          event.ports[0].postMessage({
            version: APP_VERSION,
            online: isOnline,
            cacheName: CACHE_NAME,
            totalCached: keys.length,
            offlineCached: keys.some(k => k.url.includes(OFFLINE_URL))
          });
        });
      break;
      
    case 'CHECK_CACHE':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const appFiles = keys.filter(k => !k.url.includes('/offline/')).length;
          const offlineFiles = keys.filter(k => k.url.includes('/offline/')).length;
          const videos = keys.filter(k => k.url.endsWith('.mp4')).length;
          
          event.ports[0].postMessage({
            total: keys.length,
            appFiles: appFiles,
            offlineFiles: offlineFiles,
            videos: videos,
            offlinePageCached: keys.some(k => k.url.includes(OFFLINE_URL))
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
      
    case 'UPDATE_NOW':
      self.skipWaiting();
      self.registration.update();
      event.ports[0].postMessage({ updating: true });
      break;
      
    case 'PING':
      event.ports[0].postMessage({ 
        pong: true, 
        version: APP_VERSION,
        online: isOnline 
      });
      break;
      
    // Track online/offline status from client
    case 'STATUS':
      if (event.data.status === 'online') isOnline = true;
      if (event.data.status === 'offline') isOnline = false;
      break;
  }
});

// ====== PUSH NOTIFICATIONS (Optional) ======
self.addEventListener('push', event => {
  const options = {
    body: 'RelayTalk - You have new messages',
    icon: '/relay.png',
    badge: '/relay.png',
    data: { url: '/' }
  };
  
  event.waitUntil(
    self.registration.showNotification('RelayTalk', options)
  );
});

// ====== SERVICE WORKER STARTUP ======
console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');