// Service Worker Manager v4.0 - Simplified for Game Caching
class ServiceWorkerManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.init();
    }

    async init() {
        console.log('⚡ SW Manager v4.0 initializing...');

        // Register service worker
        await this.registerSW();

        // Auto-cache game when online
        if (this.isOnline) {
            setTimeout(() => this.autoCacheGame(), 5000);
        }

        // Listen for network changes
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    async registerSW() {
        if (!('serviceWorker' in navigator)) {
            console.warn('⚠️ Service Workers not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/',
                updateViaCache: 'none'
            });

            console.log('✅ Service Worker registered');

            // Listen for messages
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleSWMessage(event.data);
            });

            // Check if game is cached
            setTimeout(() => this.checkGameCache(), 3000);

        } catch (error) {
            console.error('❌ SW registration failed:', error);
        }
    }

    async checkGameCache() {
        try {
            const status = await this.messageSW({ type: 'GET_GAME_STATUS' });
            if (status && !status.gameCached && this.isOnline) {
                console.log('🔄 Game not cached, starting auto-cache...');
                this.autoCacheGame();
            }
        } catch (error) {
            console.warn('Cache check failed:', error);
        }
    }

    async autoCacheGame() {
        if (!this.isOnline) {
            console.log('⚠️ Skipping auto-cache - offline');
            return;
        }

        console.log('🚗 Starting auto-cache of game...');
        
        try {
            const result = await this.messageSW({ type: 'AUTO_CACHE_GAME' });
            if (result && result.success) {
                console.log(`✅ Game cached: ${result.cachedCount} files`);
            }
        } catch (error) {
            console.error('Auto-cache failed:', error);
        }
    }

    handleSWMessage(data) {
        const { type } = data;
        
        switch (type) {
            case 'SW_READY':
                console.log('🚀 SW ready:', data.version);
                break;
                
            case 'GAME_CACHED':
                console.log('🎮 Game cached successfully');
                this.showNotification('✅ Game ready for offline play!', 'success');
                break;
                
            case 'GAME_CACHE_ERROR':
                console.error('❌ Game cache error:', data.error);
                break;
        }
    }

    handleOnline() {
        this.isOnline = true;
        console.log('🌐 Online - triggering auto-cache');
        this.autoCacheGame();
    }

    handleOffline() {
        this.isOnline = false;
        console.log('📴 Offline');
    }

    messageSW(message) {
        return new Promise((resolve, reject) => {
            if (!navigator.serviceWorker.controller) {
                reject(new Error('No Service Worker'));
                return;
            }

            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
                resolve(event.data);
                channel.port1.close();
            };

            navigator.serviceWorker.controller.postMessage(message, [channel.port2]);
        });
    }

    showNotification(message, type = 'info') {
        // Simple notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('RelayTalk', {
                body: message,
                icon: '/relay.png'
            });
        }
        
        // Console fallback
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!window.SWManager) {
        window.SWManager = new ServiceWorkerManager();
    }
});

// Global helper
window.RelaySW = {
    cacheGame: () => window.SWManager?.autoCacheGame(),
    getStatus: () => window.SWManager?.messageSW({ type: 'GET_STATUS' })
};

console.log('⚡ Service Worker Manager v4.0 loaded');