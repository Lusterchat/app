// RelayTalk Service Worker v3.0
// Working version with video caching
const CACHE_NAME = 'relaytalk-v3-0';
const APP_VERSION = '3.0.0';

// Files to cache (offline entertainment)
const PRECACHE_FILES = [
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
  
  // Video files (MUST be in this location)
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4'
];

// ====== INSTALL ======
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  // Cache all files
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching offline files...');
        
        // Cache critical files first
        const criticalFiles = [
          '/offline/index.html',
          '/offline/section1/main.html',
          '/offline/section2/main.html'
        ];
        
        return cache.addAll(criticalFiles)
          .then(() => {
            console.log('Critical files cached');
            
            // Cache other files one by one (videos can be large)
            const otherFiles = PRECACHE_FILES.filter(file => !criticalFiles.includes(file));
            const cachePromises = otherFiles.map(url => {
              return fetch(url, { mode: 'no-cors' })
                .then(response => {
                  if (response.ok || response.type === 'opaque') {
                    return cache.put(url, response);
                  }
                  console.warn('Failed to cache:', url);
                  return Promise.resolve();
                })
                .catch(error => {
                  console.warn('Could not cache:', url, error);
                  return Promise.resolve();
                });
            });
            
            return Promise.all(cachePromises);
          });
      })
      .then(() => {
        console.log('All files cached (or attempted)');
        self.skipWaiting();
      })
  );
});

// ====== ACTIVATE ======
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        );
      }),
      
      // Take control
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker ready');
      
      // Verify what's cached
      caches.open(CACHE_NAME).then(cache => {
        return cache.keys().then(keys => {
          console.log('Total cached files:', keys.length);
          console.log('Cached:', keys.map(k => new URL(k.url).pathname));
        });
      });
    })
  );
});

// ====== FETCH ======
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET and external requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  
  const path = url.pathname;
  
  // Handle offline entertainment files
  if (path.startsWith('/offline/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          // If in cache, return it
          if (cached) {
            return cached;
          }
          
          // If not in cache, try network and cache it
          return fetch(event.request)
            .then(response => {
              // Don't cache if not successful
              if (!response.ok) return response;
              
              // Cache the response
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
              
              return response;
            })
            .catch(() => {
              // If network fails and not in cache
              if (path.endsWith('.mp4')) {
                return new Response(
                  'Video not available offline. Please check if video file exists.',
                  { headers: { 'Content-Type': 'text/plain' } }
                );
              }
              return new Response('Resource not available', { status: 404 });
            });
        })
    );
  }
  // Handle app files (network only)
  else {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If offline and it's a page request, show offline page
          const accept = event.request.headers.get('Accept') || '';
          const isPage = accept.includes('text/html') || 
                        path.endsWith('.html') ||
                        path === '/' ||
                        !path.includes('.');
          
          if (isPage) {
            return caches.match('/offline/index.html');
          }
          
          throw new Error('Offline');
        })
    );
  }
});

// ====== MESSAGES ======
self.addEventListener('message', event => {
  if (event.data.type === 'GET_CACHE_INFO') {
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        event.ports[0].postMessage({
          version: APP_VERSION,
          total: keys.length,
          files: keys.map(k => new URL(k.url).pathname),
          videos: keys.filter(k => k.url.endsWith('.mp4')).length
        });
      });
  }
});

console.log('Service Worker loaded');