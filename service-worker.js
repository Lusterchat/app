// RelayTalk Service Worker v3.5
// Enhanced video caching + Fixed path handling

const CACHE_NAME = 'relaytalk-cache-v3-5';
const OFFLINE_URL = '/offline/index.html';
const APP_VERSION = '3.5.0';

// Videos that MUST be cached
const OFFLINE_VIDEOS = [
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4'
];

// Core app files + offline entertainment
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
  '/pages/chats/recieve.mp3',

  // === VIDEOS WILL BE CACHED SEPARATELY ===
  ...OFFLINE_VIDEOS
];

// Track if we're online
let isOnline = true;
let videosCached = false;

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
            console.log('✅ Offline pages cached');
            
            // Cache videos with special handling
            return cacheVideos(cache);
          })
          .then(() => {
            // Cache remaining files in background
            const remaining = PRECACHE_FILES.filter(f => 
              !offlineFirst.includes(f) && !OFFLINE_VIDEOS.includes(f)
            );
            
            const promises = remaining.map(url => {
              return fetch(url, { cache: 'reload' })
                .then(response => {
                  if (response.ok) {
                    console.log('✅ Cached:', url);
                    return cache.put(url, response);
                  }
                  throw new Error('Bad response');
                })
                .catch(error => {
                  console.warn('⚠️ Failed to cache:', url, error);
                  // Try from network without cache busting
                  return fetch(url)
                    .then(response => {
                      if (response.ok) return cache.put(url, response);
                    })
                    .catch(() => {
                      console.error('❌ Completely failed:', url);
                    });
                });
            });
            
            return Promise.all(promises);
          });
      })
      .then(() => {
        console.log('✅ All files cached successfully');
        videosCached = true;
        return self.skipWaiting();
      })
  );
});

// Special function to cache videos with progress
function cacheVideos(cache) {
  console.log('🎬 Caching ' + OFFLINE_VIDEOS.length + ' videos...');
  
  const videoPromises = OFFLINE_VIDEOS.map((videoUrl, index) => {
    return new Promise((resolve, reject) => {
      fetch(videoUrl)
        .then(response => {
          if (!response.ok) throw new Error('Video not found');
          
          // Clone response for caching
          const clone = response.clone();
          
          // Put in cache
          cache.put(videoUrl, clone)
            .then(() => {
              console.log(`✅ Video ${index + 1}/${OFFLINE_VIDEOS.length} cached: ${videoUrl.split('/').pop()}`);
              resolve();
            })
            .catch(reject);
          
          // Also keep the original for response
          return response;
        })
        .catch(error => {
          console.warn(`⚠️ Failed to cache video ${videoUrl}:`, error);
          resolve(); // Don't reject, just skip
        });
    });
  });
  
  return Promise.all(videoPromises)
    .then(() => {
      console.log('🎉 All videos cached!');
      videosCached = true;
    });
}

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
      
      // Check video cache status
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const cachedVideos = keys.filter(k => 
            k.url.endsWith('.mp4') && ONDLINE_VIDEOS.some(v => k.url.includes(v))
          ).length;
          
          console.log(`📊 Video cache: ${cachedVideos}/${OFFLINE_VIDEOS.length} videos`);
          
          if (cachedVideos < OFFLINE_VIDEOS.length) {
            console.log('🔄 Re-caching missing videos...');
            return caches.open(CACHE_NAME)
              .then(cache => cacheVideos(cache));
          }
        }),
      
      // Take control immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated');
      
      // Notify all pages about cache status
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION,
            videosCached: videosCached
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
  
  // === FIX: Handle broken section paths ===
  // If someone tries to access section1/section2 from wrong location
  if ((path.includes('/section1/') || path.includes('/section2/')) && !path.startsWith('/offline/')) {
    console.log('🔄 Fixing broken section path:', path);
    
    // Extract the section filename
    const sectionMatch = path.match(/\/(section[12]\/[^\/]+)$/);
    if (sectionMatch) {
      const fixedPath = '/offline/' + sectionMatch[1];
      console.log('✅ Redirecting to:', fixedPath);
      
      event.respondWith(
        caches.match(fixedPath)
          .then(cached => {
            if (cached) return cached;
            return fetch(fixedPath);
          })
          .catch(() => {
            // If not found, redirect to offline index
            return caches.match(OFFLINE_URL)
              .then(offlinePage => {
                return new Response(offlinePage.body, {
                  status: 200,
                  headers: offlinePage.headers
                });
              });
          })
      );
      return;
    }
  }
  
  // Handle videos specially - ALWAYS cache first
  if (OFFLINE_VIDEOS.includes(path)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          // If video is in cache, serve it
          if (cached) {
            console.log('🎬 Serving video from cache:', path.split('/').pop());
            return cached;
          }
          
          // If not in cache, fetch and cache it
          return fetch(event.request)
            .then(response => {
              if (response.ok) {
                // Cache for next time
                const clone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, clone));
              }
              return response;
            })
            .catch(() => {
              // Video not available
              return new Response('Video not available offline', {
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
    return;
  }
  
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
  
  // === FOR ALL OTHER REQUESTS (App pages) ===
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
        
        console.log('📴 Offline detected on:', path);
        
        // Check if it's a PAGE request
        const accept = event.request.headers.get('Accept') || '';
        const isPageRequest = accept.includes('text/html') || 
                             path.endsWith('.html') ||
                             path === '/' ||
                             !path.includes('.');
        
        if (isPageRequest) {
          // === CRITICAL: ALWAYS REDIRECT TO OFFLINE PAGE WHEN OFFLINE ===
          console.log('🔄 Redirecting to offline entertainment');
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
                `<html>
                  <head><title>Offline Entertainment</title></head>
                  <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>🎬 RelayTalk Offline Mode</h1>
                    <p>Enjoy offline entertainment while you're disconnected!</p>
                    <div style="margin: 30px;">
                      <a href="/offline/index.html" 
                         style="background: #667eea; color: white; padding: 12px 24px; 
                                border-radius: 6px; text-decoration: none; display: inline-block;">
                        Open Entertainment Hub
                      </a>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                      Videos cached: ${videosCached ? '✅' : '⏳'}
                    </p>
                  </body>
                </html>`,
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

// ====== AUTO-CACHE ON VISIT ======
// Cache pages as user visits them
self.addEventListener('fetch', event => {
  // Only cache GET requests for same-origin HTML pages
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  const path = url.pathname;
  
  // Don't auto-cache offline pages (they're already cached)
  if (path.startsWith('/offline/')) return;
  
  const accept = event.request.headers.get('Accept') || '';
  const isPageRequest = accept.includes('text/html') || 
                       path.endsWith('.html') ||
                       path === '/';
  
  if (isPageRequest && isOnline) {
    // Cache this page in background when online
    event.waitUntil(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            return caches.open(CACHE_NAME)
              .then(cache => {
                console.log('💾 Auto-caching page:', path);
                return cache.put(event.request, response);
              });
          }
        })
        .catch(() => {
          // Silent fail
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
          const videoCount = keys.filter(k => ONDLINE_VIDEOS.some(v => k.url.includes(v))).length;
          
          event.ports[0].postMessage({
            version: APP_VERSION,
            online: isOnline,
            cacheName: CACHE_NAME,
            totalCached: keys.length,
            videosCached: videoCount,
            totalVideos: OFFLINE_VIDEOS.length,
            offlineCached: keys.some(k => k.url.includes(OFFLINE_URL))
          });
        });
      break;
      
    case 'CHECK_CACHE':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const appFiles = keys.filter(k => !k.url.includes('/offline/')).length;
          const offlineFiles = keys.filter(k => k.url.includes('/offline/') && !k.url.endsWith('.mp4')).length;
          const videos = keys.filter(k => k.url.endsWith('.mp4')).length;
          
          event.ports[0].postMessage({
            total: keys.length,
            appFiles: appFiles,
            offlineFiles: offlineFiles,
            videos: videos,
            totalVideos: OFFLINE_VIDEOS.length,
            offlinePageCached: keys.some(k => k.url.includes(OFFLINE_URL)),
            videosCached: videos >= OFFLINE_VIDEOS.length
          });
        });
      break;
      
    case 'CACHE_VIDEOS':
      console.log('🔄 Manually caching videos...');
      caches.open(CACHE_NAME)
        .then(cache => {
          return cacheVideos(cache);
        })
        .then(() => {
          event.ports[0].postMessage({
            success: true,
            message: 'Videos cached successfully'
          });
        })
        .catch(error => {
          event.ports[0].postMessage({
            success: false,
            message: 'Video caching failed: ' + error.message
          });
        });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(success => {
          // Also reset video cache flag
          videosCached = false;
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
        online: isOnline,
        videosCached: videosCached
      });
      break;
      
    // Track online/offline status from client
    case 'STATUS':
      if (event.data.status === 'online') isOnline = true;
      if (event.data.status === 'offline') isOnline = false;
      break;
  }
});

console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');
console.log('🎬 Video caching enabled for ' + OFFLINE_VIDEOS.length + ' videos');