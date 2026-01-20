// RelayTalk Service Worker v3.9 - Fixed Auto Caching
const CACHE_NAME = 'relaytalk-cache-v3-9';
const OFFLINE_URL = '/offline/index.html';
const APP_VERSION = '3.9.0';

// ONLY CACHE THESE FILES (5 videos + essential files)
const FILES_TO_CACHE = [
  // Essential offline files
  '/offline/index.html',
  '/offline/section1/main.html',
  '/offline/section1/main.css',
  '/offline/section1/main.js',
  '/offline/section1/shayari-data.js',
  '/offline/section2/main.html',
  '/offline/section2/main.css',
  '/offline/section2/main.js',
  
  // Videos (ONLY 5)
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4',
  
  // App core files
  '/',
  '/index.html',
  '/relay.png',
  '/style.css'
];

// Track caching progress
let cacheProgress = {
  total: FILES_TO_CACHE.length, // Should be 5 videos + other files = around 15 total
  completed: 0,
  currentFile: '',
  isCaching: false
};

let isOnline = true;

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Installing Service Worker v' + APP_VERSION);
  self.skipWaiting();
  
  // Auto-cache only essential files on install
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        const essentialFiles = [
          '/',
          '/index.html',
          '/offline/index.html',
          '/relay.png'
        ];
        
        return cache.addAll(essentialFiles)
          .then(() => {
            console.log('✅ Essential files cached on install');
          });
      })
  );
});

// ====== ACTIVATE EVENT ======
self.addEventListener('activate', event => {
  console.log('🔄 Activating Service Worker v' + APP_VERSION);
  
  event.waitUntil(
    Promise.all([
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
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker ready');
      
      // Auto-check and cache videos if missing
      setTimeout(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CHECK_VIDEOS' });
          });
        });
      }, 2000);
    })
  );
});

// ====== CACHE ALL FILES FUNCTION ======
async function cacheAllFilesWithProgress() {
  if (cacheProgress.isCaching) {
    console.log('⚠️ Cache already in progress');
    return { success: false, message: 'Cache already in progress' };
  }
  
  cacheProgress.isCaching = true;
  cacheProgress.completed = 0;
  cacheProgress.total = FILES_TO_CACHE.length;
  
  console.log(`🚀 Starting to cache ${FILES_TO_CACHE.length} files...`);
  console.log('Files to cache:', FILES_TO_CACHE);
  
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Cache files one by one for better control
    for (let i = 0; i < FILES_TO_CACHE.length; i++) {
      const url = FILES_TO_CACHE[i];
      cacheProgress.currentFile = url;
      cacheProgress.completed = i;
      
      // Broadcast progress
      broadcastProgress();
      
      try {
        const response = await fetch(url, {
          headers: url.endsWith('.mp4') ? {
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
          } : {}
        });
        
        if (response.ok) {
          await cache.put(url, response);
          console.log(`✅ (${i + 1}/${FILES_TO_CACHE.length}) Cached: ${url}`);
        } else {
          console.warn(`⚠️ Bad response for ${url}: ${response.status}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to cache ${url}:`, error);
      }
      
      // Small delay between files
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final update
    cacheProgress.completed = FILES_TO_CACHE.length;
    cacheProgress.isCaching = false;
    cacheProgress.currentFile = 'Complete!';
    
    console.log(`🎉 Caching complete! ${FILES_TO_CACHE.length} files cached`);
    
    // Get actual cached count
    const keys = await caches.open(CACHE_NAME).then(cache => cache.keys());
    const videosCached = keys.filter(k => k.url.endsWith('.mp4')).length;
    
    broadcastProgress();
    
    return {
      success: true,
      message: `Cached ${keys.length} files (${videosCached} videos)`,
      totalCached: keys.length,
      videosCached: videosCached,
      totalVideos: 5
    };
    
  } catch (error) {
    cacheProgress.isCaching = false;
    console.error('❌ Cache failed:', error);
    return { success: false, message: error.message };
  }
}

// Broadcast progress to all clients
function broadcastProgress() {
  const percentage = Math.round((cacheProgress.completed / cacheProgress.total) * 100);
  
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_PROGRESS',
        progress: {
          total: cacheProgress.total,
          completed: cacheProgress.completed,
          percentage: percentage,
          currentFile: cacheProgress.currentFile,
          isCaching: cacheProgress.isCaching
        }
      });
    });
  });
}

// ====== AUTO-CACHE VIDEOS ======
async function autoCacheMissingVideos() {
  if (!isOnline) return;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const cachedVideos = keys.filter(k => k.url.endsWith('.mp4')).length;
    
    if (cachedVideos < 5) {
      console.log(`🔄 Auto-caching missing videos (${cachedVideos}/5 cached)`);
      
      const videosToCache = [
        '/offline/videos/vid1.mp4',
        '/offline/videos/vid2.mp4',
        '/offline/videos/vid3.mp4',
        '/offline/videos/vid4.mp4',
        '/offline/videos/vid5.mp4'
      ];
      
      for (const videoUrl of videosToCache) {
        const cached = await cache.match(videoUrl);
        if (!cached) {
          try {
            const response = await fetch(videoUrl, {
              headers: { 'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8' }
            });
            if (response.ok) {
              await cache.put(videoUrl, response);
              console.log(`✅ Auto-cached: ${videoUrl}`);
            }
          } catch (error) {
            console.warn(`⚠️ Auto-cache failed for ${videoUrl}:`, error);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  } catch (error) {
    console.warn('Auto-cache error:', error);
  }
}

// ====== FETCH EVENT ======
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  const path = url.pathname;
  
  // Handle broken section paths
  if ((path.includes('/section1/') || path.includes('/section2/')) && !path.startsWith('/offline/')) {
    const sectionMatch = path.match(/\/(section[12]\/[^\/]+)$/);
    if (sectionMatch) {
      const fixedPath = '/offline/' + sectionMatch[1];
      event.respondWith(
        caches.match(fixedPath)
          .then(cached => cached || fetch(fixedPath))
          .catch(() => caches.match(OFFLINE_URL))
      );
      return;
    }
  }
  
  // Handle video range requests
  if (path.startsWith('/offline/videos/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            const range = event.request.headers.get('range');
            if (range) {
              return handleRangeRequest(cached, range);
            }
            return cached;
          }
          return fetch(event.request);
        })
    );
    return;
  }
  
  // Serve from cache first for offline files
  if (path.startsWith('/offline/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
    return;
  }
  
  // Network first for app pages
  event.respondWith(
    fetch(event.request)
      .then(response => {
        isOnline = true;
        // Only cache essential app files
        if (FILES_TO_CACHE.includes(path)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        isOnline = false;
        const accept = event.request.headers.get('Accept') || '';
        const isPageRequest = accept.includes('text/html') || 
                             path.endsWith('.html') ||
                             path === '/';
        
        if (isPageRequest) {
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) {
            return new Response(offlinePage.body, {
              status: 200,
              headers: offlinePage.headers
            });
          }
        }
        
        const cached = await caches.match(event.request);
        if (cached) return cached;
        
        return new Response('', { status: 404 });
      })
  );
});

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  const { type } = event.data;
  
  switch (type) {
    case 'CACHE_ALL':
      console.log('🔄 Received cache all command');
      cacheAllFilesWithProgress()
        .then(result => {
          event.ports[0].postMessage(result);
        });
      break;
      
    case 'GET_PROGRESS':
      event.ports[0].postMessage({
        type: 'PROGRESS_UPDATE',
        progress: {
          total: cacheProgress.total,
          completed: cacheProgress.completed,
          percentage: Math.round((cacheProgress.completed / cacheProgress.total) * 100),
          currentFile: cacheProgress.currentFile,
          isCaching: cacheProgress.isCaching
        }
      });
      break;
      
    case 'GET_STATUS':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const videos = keys.filter(k => k.url.endsWith('.mp4')).length;
          event.ports[0].postMessage({
            version: APP_VERSION,
            online: isOnline,
            totalCached: keys.length,
            videosCached: videos,
            totalVideos: 5,
            totalFiles: FILES_TO_CACHE.length,
            isCaching: cacheProgress.isCaching
          });
        });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(success => {
          cacheProgress.completed = 0;
          cacheProgress.isCaching = false;
          event.ports[0].postMessage({ success });
        });
      break;
      
    case 'AUTO_CACHE_VIDEOS':
      autoCacheMissingVideos();
      break;
      
    case 'PING':
      event.ports[0].postMessage({ pong: true, version: APP_VERSION });
      break;
  }
});

// Helper function for video range requests
async function handleRangeRequest(cachedResponse, range) {
  try {
    const buffer = await cachedResponse.arrayBuffer();
    const bytes = /^bytes=(\d+)-(\d+)?$/g.exec(range);
    
    if (bytes) {
      const start = parseInt(bytes[1]);
      const end = bytes[2] ? parseInt(bytes[2]) : buffer.byteLength - 1;
      const sliced = buffer.slice(start, end + 1);
      
      return new Response(sliced, {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': (end - start + 1).toString(),
          'Content-Range': `bytes ${start}-${end}/${buffer.byteLength}`,
          'Accept-Ranges': 'bytes'
        }
      });
    }
  } catch (error) {
    console.warn('Range request error:', error);
  }
  
  return cachedResponse;
}

// Auto-cache videos when going online
self.addEventListener('online', () => {
  isOnline = true;
  console.log('🌐 Online - checking cache...');
  autoCacheMissingVideos();
});

console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');
console.log(`📦 Will cache ${FILES_TO_CACHE.length} files (5 videos)`);