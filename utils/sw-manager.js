// Service Worker Manager v2.0 - Enhanced with Video Debugging
class ServiceWorkerManager {
    constructor() {
        this.sw = null;
        this.isOnline = navigator.onLine;
        this.registration = null;
        this.cacheInfo = null;
        
        // Video URLs for debugging
        this.OFFLINE_VIDEOS = [
            '/offline/videos/vid1.mp4',
            '/offline/videos/vid2.mp4',
            '/offline/videos/vid3.mp4',
            '/offline/videos/vid4.mp4',
            '/offline/videos/vid5.mp4'
        ];
        
        this.init();
    }
    
    async init() {
        console.log('🔄 Service Worker Manager v2.0 initializing...');
        
        // Listen for online/offline changes
        window.addEventListener('online', () => this.updateStatus('online'));
        window.addEventListener('offline', () => this.updateStatus('offline'));
        
        // Fix any broken paths in current page
        this.fixBrokenPaths();
        
        // Register service worker if supported
        if ('serviceWorker' in navigator) {
            try {
                this.registration = await navigator.serviceWorker.register('/service-worker.js', {
                    scope: '/'
                });
                
                console.log('✅ Service Worker registered:', this.registration);
                
                // Wait for service worker to be ready
                if (this.registration.installing) {
                    this.registration.installing.addEventListener('statechange', () => {
                        if (this.registration.active) {
                            this.sw = this.registration.active;
                            this.setupSW();
                        }
                    });
                } else if (this.registration.active) {
                    this.sw = this.registration.active;
                    this.setupSW();
                }
                
                // Listen for service worker updates
                this.registration.addEventListener('updatefound', () => {
                    console.log('🔄 New service worker found!');
                    const newWorker = this.registration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // New update available
                                this.showUpdateNotification();
                            } else {
                                console.log('✅ Service Worker installed for first time');
                            }
                        }
                    });
                });
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
                this.showNotification('Service Worker registration failed', 'error');
            }
        } else {
            console.warn('⚠️ Service Workers not supported');
            this.showNotification('Service Workers not supported in this browser', 'warning');
        }
        
        // Initial cache check
        setTimeout(() => this.checkCache(), 2000);
        
        // Auto-check if offline and show instructions
        if (!this.isOnline) {
            setTimeout(() => this.showOfflineInstructions(), 3000);
        }
    }
    
    setupSW() {
        console.log('🔗 Service Worker connected');
        
        // Send initial status
        this.sendMessage({ type: 'STATUS', status: this.isOnline ? 'online' : 'offline' });
        
        // Check cache status
        this.sendMessage({ type: 'CHECK_CACHE' }, (response) => {
            this.cacheInfo = response;
            console.log('📦 Cache status:', response);
            
            if (!response.offlinePageCached) {
                console.warn('⚠️ Offline page not cached!');
                this.precacheOfflineContent();
            }
            
            if (response.videos < response.totalVideos) {
                console.warn(`⚠️ Videos not fully cached: ${response.videos}/${response.totalVideos}`);
                this.showNotification(`Caching videos... (${response.videos}/${response.totalVideos})`, 'info');
                
                // Auto-cache missing videos
                if (this.isOnline) {
                    setTimeout(() => this.cacheVideosNow(), 5000);
                }
            }
        });
        
        // Listen for messages FROM service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('📩 Message from SW:', event.data);
            
            switch (event.data.type) {
                case 'SW_ACTIVATED':
                    console.log('✅ SW ready v' + event.data.version);
                    this.sendMessage({ type: 'GET_STATUS' });
                    break;
                    
                case 'SW_READY':
                    console.log('🚀 SW loaded v' + event.data.version);
                    break;
            }
        });
    }
    
    // Fix broken paths in current page
    fixBrokenPaths() {
        const currentPath = window.location.pathname;
        
        // Check if we're on a broken section path
        if ((currentPath.includes('/section1/') || currentPath.includes('/section2/')) && 
            !currentPath.startsWith('/offline/')) {
            
            console.log('🔄 Fixing broken section path:', currentPath);
            
            // Extract the section filename
            const sectionMatch = currentPath.match(/\/(section[12]\/[^\/]+)$/);
            if (sectionMatch) {
                const fixedPath = '/offline/' + sectionMatch[1];
                console.log('✅ Redirecting to:', fixedPath);
                
                // Show redirect notification
                this.showNotification(`Redirecting to correct path...`, 'info');
                
                // Redirect to correct path
                setTimeout(() => {
                    window.location.replace(fixedPath);
                }, 1000);
                return true;
            }
        }
        return false;
    }
    
    // Send message to service worker
    sendMessage(message, callback) {
        if (!this.sw) {
            console.warn('No service worker connected');
            if (callback) callback({ error: 'No service worker' });
            return Promise.resolve({ error: 'No service worker' });
        }
        
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            
            channel.port1.onmessage = (event) => {
                if (callback) callback(event.data);
                resolve(event.data);
                channel.port1.close();
            };
            
            try {
                this.sw.postMessage(message, [channel.port2]);
            } catch (error) {
                console.error('❌ Failed to send message:', error);
                if (callback) callback({ error: error.message });
                resolve({ error: error.message });
            }
        });
    }
    
    // Update online/offline status
    updateStatus(status) {
        this.isOnline = status === 'online';
        console.log('📡 Network status:', status);
        
        // Notify service worker
        this.sendMessage({ type: 'STATUS', status: status });
        
        // Show notification
        if (status === 'offline') {
            this.showOfflineNotification();
            this.showOfflineInstructions();
        } else {
            this.hideOfflineNotification();
            this.showNotification('Back online! ✅', 'success');
            
            // When coming back online, check cache and auto-cache missing videos
            setTimeout(() => {
                this.checkCache();
                if (this.cacheInfo && this.cacheInfo.videos < this.cacheInfo.totalVideos) {
                    this.cacheVideosNow();
                }
            }, 2000);
        }
    }
    
    // Check cache status periodically
    checkCache() {
        if (!this.sw) return;
        
        this.sendMessage({ type: 'GET_STATUS' }, (response) => {
            this.cacheInfo = response;
            console.log('🔄 Cache check:', response);
            
            // Update cache status in UI if element exists
            const cacheElement = document.getElementById('cache-status');
            if (cacheElement) {
                cacheElement.textContent = `${response.videosCached}/${response.totalVideos} videos cached`;
                cacheElement.style.color = response.videosCached ? '#4caf50' : '#ff5252';
            }
            
            // Show cache status if offline
            if (!this.isOnline && response.videosCached) {
                this.showNotification(`🎬 ${response.videosCached} videos available offline`, 'success');
            }
            
            // Check every 30 seconds if online
            if (this.isOnline) {
                setTimeout(() => this.checkCache(), 30000);
            }
        });
    }
    
    // Force cache offline content
    precacheOfflineContent() {
        console.log('📦 Precaching offline content...');
        this.showNotification('Precaching offline content...', 'info');
        
        // List of offline files that MUST be cached
        const offlineFiles = [
            '/offline/index.html',
            '/offline/section1/main.html',
            '/offline/section1/main.css',
            '/offline/section1/main.js',
            '/offline/section1/shayari-data.js',
            '/offline/section2/main.html',
            '/offline/section2/main.css',
            '/offline/section2/main.js',
            '/relay.png'
        ];
        
        // Cache each file
        let completed = 0;
        offlineFiles.forEach(url => {
            fetch(url)
                .then(response => {
                    if (response.ok) {
                        return caches.open('relaytalk-cache-v3-6')
                            .then(cache => cache.put(url, response))
                            .then(() => {
                                completed++;
                                console.log(`✅ (${completed}/${offlineFiles.length}) Cached: ${url}`);
                                
                                // Update progress
                                const progress = Math.round((completed / offlineFiles.length) * 100);
                                this.showNotification(`Precaching: ${progress}%`, 'info', 1000);
                            });
                    }
                })
                .catch(() => {
                    console.warn('Failed to cache:', url);
                    completed++;
                });
        });
    }
    
    // Show update notification
    showUpdateNotification() {
        // Create update notification
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.2);
                z-index: 9999;
                cursor: pointer;
                font-family: Arial, sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideInRight 0.4s ease;
                border: 2px solid rgba(255,255,255,0.1);
            ">
                <span style="font-size: 20px;">🔄</span>
                <div>
                    <div style="font-weight: bold; margin-bottom: 4px;">Update Available!</div>
                    <div style="font-size: 12px; opacity: 0.9;">Click to reload and update</div>
                </div>
                <button style="
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-left: 10px;
                ">UPDATE</button>
            </div>
            <style>
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            </style>
        `;
        
        const updateBtn = notification.querySelector('button');
        const notificationDiv = notification.querySelector('div');
        
        updateBtn.onclick = () => {
            this.sendMessage({ type: 'UPDATE_NOW' });
            notificationDiv.style.animation = 'slideOutRight 0.4s ease';
            setTimeout(() => {
                window.location.reload();
            }, 500);
        };
        
        notificationDiv.onclick = () => {
            this.sendMessage({ type: 'UPDATE_NOW' });
            notificationDiv.style.animation = 'slideOutRight 0.4s ease';
            setTimeout(() => {
                window.location.reload();
            }, 500);
        };
        
        document.body.appendChild(notification);
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notificationDiv.style.animation = 'slideOutRight 0.4s ease';
                setTimeout(() => notification.remove(), 400);
            }
        }, 15000);
    }
    
    // Show offline notification
    showOfflineNotification() {
        if (document.querySelector('.offline-notification')) return;
        
        const notification = document.createElement('div');
        notification.className = 'offline-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
                color: white;
                padding: 14px 24px;
                border-radius: 10px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.2);
                z-index: 9999;
                font-family: Arial, sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideDown 0.4s ease;
                border: 2px solid rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
            ">
                <span style="font-size: 18px;">📡</span>
                <div>
                    <div style="font-weight: bold;">You are offline</div>
                    <div style="font-size: 12px; opacity: 0.9;">Using cached content</div>
                </div>
                <button style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    margin-left: 10px;
                " onclick="window.SWManager?.checkOfflineContent()">CHECK</button>
            </div>
            <style>
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-30px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(0); opacity: 1; }
                    to { transform: translateX(-50%) translateY(-30px); opacity: 0; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            const notif = document.querySelector('.offline-notification');
            if (notif) {
                notif.querySelector('div').style.animation = 'slideUp 0.4s ease';
                setTimeout(() => notif.remove(), 400);
            }
        }, 8000);
    }
    
    hideOfflineNotification() {
        const notification = document.querySelector('.offline-notification');
        if (notification) {
            notification.querySelector('div').style.animation = 'slideUp 0.4s ease';
            setTimeout(() => notification.remove(), 400);
        }
    }
    
    // Show offline instructions
    showOfflineInstructions() {
        // Don't show on offline pages
        if (window.location.pathname.includes('/offline/')) return;
        
        // Check if we have offline content
        this.getCacheInfo().then(info => {
            if (info.videosCached > 0) {
                setTimeout(() => {
                    this.showNotification(
                        `You have ${info.videosCached} videos available offline! Go to Entertainment Hub.`,
                        'info',
                        5000
                    );
                }, 2000);
            }
        });
    }
    
    // Check offline content
    checkOfflineContent() {
        console.log('🔍 Checking offline content...');
        
        this.getCacheInfo().then(info => {
            const message = `
                📦 Cache Status:
                • Total cached: ${info.total} files
                • Videos: ${info.videos}/${info.totalVideos}
                • App files: ${info.appFiles}
                • Offline files: ${info.offlineFiles}
                • Offline page: ${info.offlinePageCached ? '✅' : '❌'}
            `;
            
            this.showNotification(message, 'info', 6000);
            
            // If videos are missing, offer to cache them
            if (this.isOnline && info.videos < info.totalVideos) {
                setTimeout(() => {
                    if (confirm(`You have ${info.videos}/${info.totalVideos} videos cached. Cache missing videos now?`)) {
                        this.cacheVideosNow();
                    }
                }, 1000);
            }
        });
    }
    
    // Show custom notification
    showNotification(message, type = 'info', duration = 3000) {
        const colors = {
            success: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
            error: 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)',
            info: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)',
            warning: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)'
        };
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        // Remove any existing notification of same type
        const existing = document.querySelector(`.sw-notification-${type}`);
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `sw-notification sw-notification-${type}`;
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type]};
                color: white;
                padding: 16px 20px;
                border-radius: 10px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.2);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideIn 0.4s ease;
                max-width: 350px;
                border: 2px solid rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
            ">
                <span style="font-size: 18px;">${icons[type]}</span>
                <div>${message}</div>
            </div>
            <style>
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.querySelector('div').style.animation = 'slideOut 0.4s ease';
                setTimeout(() => notification.remove(), 400);
            }
        }, duration);
    }
    
    // ====== VIDEO DEBUGGING METHODS ======
    
    // Cache videos manually
    cacheVideosNow() {
        if (!this.isOnline) {
            this.showNotification('Cannot cache videos while offline', 'error');
            return;
        }
        
        this.showNotification('🎬 Starting video cache...', 'info');
        
        return this.sendMessage({ type: 'CACHE_VIDEOS' }, (response) => {
            if (response.success) {
                console.log('✅ Videos cached successfully:', response.message);
                this.showNotification(response.message, 'success', 4000);
                this.checkCache();
                
                // Test video playback
                setTimeout(() => this.testVideoPlayback(), 2000);
            } else {
                console.error('❌ Video caching failed:', response.message);
                this.showNotification('Video caching failed: ' + response.message, 'error');
            }
        });
    }
    
    // Debug video cache
    debugVideos() {
        console.log('🔍 Debugging video cache...');
        
        this.getCacheInfo().then(info => {
            console.log('Video cache info:', info);
            
            // Test each video URL
            this.OFFLINE_VIDEOS.forEach((url, index) => {
                caches.open('relaytalk-cache-v3-6')
                    .then(cache => cache.match(url))
                    .then(response => {
                        if (response) {
                            const size = response.headers.get('content-length');
                            const type = response.headers.get('content-type');
                            console.log(`✅ Video ${index + 1}: ${url} - ${type}, ${size} bytes`);
                            
                            // Test if video can be played
                            this.testSingleVideo(url);
                        } else {
                            console.log(`❌ Video ${index + 1}: ${url} - Not cached`);
                        }
                    })
                    .catch(error => {
                        console.log(`⚠️ Video ${index + 1}: ${url} - Error:`, error);
                    });
            });
        });
        
        this.showNotification('Checking video cache... check console', 'info');
    }
    
    // Test single video
    testSingleVideo(url) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadeddata = () => {
                console.log(`🎬 ${url}: Loaded successfully, duration: ${video.duration}s`);
                resolve({ success: true, duration: video.duration });
            };
            video.onerror = (e) => {
                console.log(`❌ ${url}: Failed to load`, e);
                resolve({ success: false, error: e });
            };
            video.src = url;
            video.load();
        });
    }
    
    // Test all video playback
    testVideoPlayback() {
        console.log('🎬 Testing video playback...');
        
        let successCount = 0;
        const promises = this.OFFLINE_VIDEOS.map(url => this.testSingleVideo(url));
        
        Promise.all(promises).then(results => {
            successCount = results.filter(r => r.success).length;
            console.log(`📊 Video test results: ${successCount}/${this.OFFLINE_VIDEOS.length} videos playable`);
            
            if (successCount === this.OFFLINE_VIDEOS.length) {
                this.showNotification(`✅ All ${successCount} videos play correctly!`, 'success');
            } else {
                this.showNotification(`⚠️ ${successCount}/${this.OFFLINE_VIDEOS.length} videos playable`, 'warning');
            }
        });
    }
    
    // Open video test page
    openVideoTestPage() {
        const testPage = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Video Playback Test</title>
                <style>
                    body { font-family: Arial; padding: 20px; }
                    .video-container { margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 10px; }
                    video { width: 400px; max-width: 100%; border-radius: 8px; }
                    .status { margin: 10px 0; padding: 10px; border-radius: 5px; }
                    .success { background: #d4edda; color: #155724; }
                    .error { background: #f8d7da; color: #721c24; }
                </style>
            </head>
            <body>
                <h1>🎬 Offline Video Playback Test</h1>
                <p>Testing ${this.OFFLINE_VIDEOS.length} cached videos</p>
                
                ${this.OFFLINE_VIDEOS.map((url, i) => `
                    <div class="video-container" id="video-${i}">
                        <h3>Video ${i+1}: ${url.split('/').pop()}</h3>
                        <video controls preload="metadata" src="${url}"></video>
                        <div class="status" id="status-${i}">Testing...</div>
                        <button onclick="testVideo(${i})">Test</button>
                    </div>
                `).join('')}
                
                <script>
                    function testVideo(index) {
                        const video = document.querySelector('#video-' + index + ' video');
                        const status = document.getElementById('status-' + index);
                        
                        status.textContent = 'Loading...';
                        status.className = 'status';
                        
                        video.onloadeddata = () => {
                            status.textContent = '✅ Loaded! Duration: ' + video.duration.toFixed(2) + 's';
                            status.className = 'status success';
                        };
                        
                        video.onerror = (e) => {
                            status.textContent = '❌ Error: ' + video.error?.code || 'Unknown error';
                            status.className = 'status error';
                            console.error('Video error:', e);
                        };
                        
                        video.load();
                    }
                    
                    // Test all videos on load
                    setTimeout(() => {
                        ${this.OFFLINE_VIDEOS.map((_, i) => `testVideo(${i});`).join('\n                        ')}
                    }, 1000);
                </script>
            </body>
            </html>
        `;
        
        const win = window.open();
        win.document.write(testPage);
    }
    
    // ====== PUBLIC METHODS ======
    
    getStatus() {
        return this.sendMessage({ type: 'GET_STATUS' });
    }
    
    getCacheInfo() {
        return this.sendMessage({ type: 'CHECK_CACHE' });
    }
    
    clearCache() {
        if (confirm('Are you sure you want to clear all cached content? This will remove offline videos.')) {
            this.showNotification('Clearing cache...', 'info');
            return this.sendMessage({ type: 'CLEAR_CACHE' }, (response) => {
                if (response.success) {
                    this.showNotification('Cache cleared successfully', 'success');
                    this.cacheInfo = null;
                } else {
                    this.showNotification('Failed to clear cache', 'error');
                }
            });
        }
    }
    
    updateNow() {
        this.showNotification('Updating service worker...', 'info');
        return this.sendMessage({ type: 'UPDATE_NOW' }, () => {
            setTimeout(() => window.location.reload(), 1000);
        });
    }
    
    // Check if offline mode should be activated
    checkOfflineMode() {
        return new Promise((resolve) => {
            if (!navigator.onLine) {
                console.log('📴 Device is offline');
                this.showNotification('You are offline. Redirecting to entertainment...', 'info');
                
                // Check if we have offline content
                this.getCacheInfo().then(info => {
                    if (info.videosCached > 0) {
                        setTimeout(() => {
                            window.location.href = '/offline/index.html';
                        }, 1500);
                    }
                });
                
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }
    
    // Quick status check
    quickStatus() {
        const status = {
            online: this.isOnline,
            swRegistered: !!this.sw,
            cacheReady: !!this.cacheInfo,
            videos: this.cacheInfo?.videos || 0,
            totalVideos: this.OFFLINE_VIDEOS.length
        };
        
        console.log('⚡ Quick Status:', status);
        return status;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not already initialized
    if (!window.SWManager) {
        window.SWManager = new ServiceWorkerManager();
    }
});

// Make available globally
window.ServiceWorkerManager = ServiceWorkerManager;

// Add global helper functions
window.RelaySW = {
    // Check cache status
    checkCache: () => window.SWManager?.getCacheInfo(),
    
    // Cache videos
    cacheVideos: () => window.SWManager?.cacheVideosNow(),
    
    // Debug videos
    debugVideos: () => window.SWManager?.debugVideos(),
    
    // Test video playback
    testVideos: () => window.SWManager?.openVideoTestPage(),
    
    // Check offline mode
    checkOffline: () => window.SWManager?.checkOfflineMode(),
    
    // Clear cache
    clearCache: () => window.SWManager?.clearCache(),
    
    // Get quick status
    status: () => window.SWManager?.quickStatus()
};

console.log('⚡ Service Worker Manager v2.0 loaded');
console.log('🎬 Video debugging available: window.RelaySW.debugVideos()');