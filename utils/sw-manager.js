// Service Worker Manager - Enhanced with path fixing
// Add this ONE file to your main HTML pages

class ServiceWorkerManager {
    constructor() {
        this.sw = null;
        this.isOnline = navigator.onLine;
        this.registration = null;
        this.cacheInfo = null;
        
        this.init();
    }
    
    async init() {
        console.log('🔄 Service Worker Manager initializing...');
        
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
            }
        }
        
        // Initial cache check
        setTimeout(() => this.checkCache(), 2000);
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
                
                // Redirect to correct path
                window.location.replace(fixedPath);
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
        
        // Show notification if went offline
        if (status === 'offline') {
            this.showOfflineNotification();
        } else {
            this.hideOfflineNotification();
            // When coming back online, check cache
            setTimeout(() => this.checkCache(), 1000);
        }
    }
    
    // Check cache status periodically
    checkCache() {
        if (!this.sw) return;
        
        this.sendMessage({ type: 'GET_STATUS' }, (response) => {
            this.cacheInfo = response;
            console.log('🔄 Cache check:', response);
            
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
        offlineFiles.forEach(url => {
            fetch(url)
                .then(response => {
                    if (response.ok) {
                        return caches.open('relaytalk-cache-v3-5')
                            .then(cache => cache.put(url, response));
                    }
                })
                .catch(() => {
                    console.warn('Failed to cache:', url);
                });
        });
        
        this.showNotification('📦 Precaching offline content...', 'info');
    }
    
    // Show update notification
    showUpdateNotification() {
        // Create a subtle notification
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #667eea;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                cursor: pointer;
                font-family: Arial, sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                🔄 New version available! Click to update.
            </div>
        `;
        
        notification.onclick = () => {
            this.sendMessage({ type: 'UPDATE_NOW' });
            setTimeout(() => {
                window.location.reload();
            }, 500);
            notification.remove();
        };
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => notification.remove(), 10000);
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
                background: #f56565;
                color: white;
                padding: 10px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                font-family: Arial, sans-serif;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
                animation: slideDown 0.3s ease;
            ">
                📡 You are offline. Using cached content.
            </div>
            <style>
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => notification.remove(), 5000);
    }
    
    hideOfflineNotification() {
        const notification = document.querySelector('.offline-notification');
        if (notification) {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }
    
    // Show custom notification
    showNotification(message, type = 'info') {
        const colors = {
            success: '#48bb78',
            error: '#f56565',
            info: '#4299e1',
            warning: '#ed8936'
        };
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type]};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
                animation: slideIn 0.3s ease;
                max-width: 300px;
            ">
                ${icons[type]} ${message}
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
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.querySelector('div').style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Cache videos manually
    cacheVideosNow() {
        return this.sendMessage({ type: 'CACHE_VIDEOS' }, (response) => {
            if (response.success) {
                console.log('✅ Videos cached successfully');
                this.showNotification('🎬 Videos cached and ready for offline!', 'success');
                this.checkCache();
            } else {
                console.error('❌ Video caching failed:', response.message);
                this.showNotification('⚠️ Video caching failed', 'error');
            }
        });
    }
    
    // Public methods
    getStatus() {
        return this.sendMessage({ type: 'GET_STATUS' });
    }
    
    getCacheInfo() {
        return this.sendMessage({ type: 'CHECK_CACHE' });
    }
    
    clearCache() {
        return this.sendMessage({ type: 'CLEAR_CACHE' });
    }
    
    updateNow() {
        return this.sendMessage({ type: 'UPDATE_NOW' });
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

console.log('⚡ Service Worker Manager loaded');