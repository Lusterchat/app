// Service Worker Manager v4.3 - Auto Redirect on Offline (Updated Path)
class ServiceWorkerManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.autoRedirectEnabled = true;
        this.lastRedirectTime = 0;
        this.init();
    }

    async init() {
        console.log('⚡ SW Manager v4.3 - Auto Redirect Enabled');

        // Check current page
        this.checkCurrentPage();

        // Listen for network changes
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Check every 10 seconds if we should redirect
        setInterval(() => this.checkAndRedirect(), 10000);

        // Initial check
        setTimeout(() => this.checkAndRedirect(), 3000);
    }

    checkCurrentPage() {
        const path = window.location.pathname;
        this.isAppPage = path === '/' || 
                         path === '/index.html' || 
                         path.includes('/pages/');
        this.isGamePage = path.includes('/cargame');
        this.isOfflinePage = path.includes('/offline/index.html') || 
                             path === '/offline/' || 
                             path === '/offline';

        console.log('📍 Current page:', {
            path: path,
            isAppPage: this.isAppPage,
            isGamePage: this.isGamePage,
            isOfflinePage: this.isOfflinePage
        });
    }

    async checkAndRedirect() {
        // Don't redirect too frequently
        const now = Date.now();
        if (now - this.lastRedirectTime < 5000) return;

        this.isOnline = navigator.onLine;

        if (!this.isOnline && this.isAppPage && this.autoRedirectEnabled) {
            console.log('📴 Offline on app page - checking game cache...');

            try {
                // Check if game is cached
                const gameCached = await this.checkGameCache();

                if (gameCached) {
                    console.log('🎮 Game cached - redirecting...');
                    this.redirectToGame();
                } else {
                    console.log('⚠️ Game not cached - redirecting to offline page');
                    this.redirectToOffline();
                }

                this.lastRedirectTime = now;
            } catch (error) {
                console.warn('Redirect check failed:', error);
            }
        }
    }

    async checkGameCache() {
        try {
            if (!navigator.serviceWorker.controller) return false;

            const status = await this.messageSW({ type: 'GET_GAME_STATUS' });
            return status && status.gameCached;
        } catch (error) {
            return false;
        }
    }

    redirectToGame() {
        // Prevent multiple redirects
        if (window.location.pathname.includes('/cargame')) return;

        console.log('🚀 Redirecting to cached game...');

        // Smooth redirect with notification
        this.showOfflineNotification('🎮 Switching to Car Game...');

        setTimeout(() => {
            window.location.href = '/cargame';
        }, 1000);
    }

    redirectToOffline() {
        // Prevent multiple redirects
        const currentPath = window.location.pathname;
        if (currentPath === '/offline/index.html' || 
            currentPath === '/offline/' || 
            currentPath === '/offline') return;

        console.log('📴 Redirecting to offline page...');

        // Smooth redirect with notification
        this.showOfflineNotification('📱 Going to offline mode...');

        setTimeout(() => {
            window.location.href = '/offline/index.html';
        }, 1000);
    }

    handleOnline() {
        this.isOnline = true;
        console.log('🌐 Back online');
        this.showNotification('✅ Back online', 'success', 2000);
        
        // If on offline page and now online, suggest going back to app
        if (this.isOfflinePage) {
            setTimeout(() => {
                this.showNotification('🔙 Click here to go back to app', 'info', 4000, true);
            }, 1500);
        }
    }

    handleOffline() {
        this.isOnline = false;
        console.log('📴 Went offline');

        // Immediate redirect check
        setTimeout(() => this.checkAndRedirect(), 1000);

        // Show notification
        this.showOfflineNotification('📶 You are offline');
    }

    showOfflineNotification(message) {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
                padding: 15px 25px;
                border-radius: 10px;
                box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
                z-index: 9999;
                animation: slideInRight 0.3s ease;
                font-family: 'Segoe UI', sans-serif;
                font-weight: 600;
                backdrop-filter: blur(10px);
                border: 2px solid rgba(255, 255, 255, 0.2);
                max-width: 300px;
                text-align: center;
            ">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <span style="font-size: 1.5rem;">🚗</span>
                    <span>${message}</span>
                </div>
                <div style="font-size: 0.9rem; opacity: 0.9;">
                    ${this.isOnline ? 'Enjoy!' : 'Auto-redirecting...'}
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        // Add CSS animations if not present
        this.addNotificationStyles();
    }

    showNotification(message, type = 'info', duration = 3000, clickable = false) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };

        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type] || colors.info};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                animation: slideIn 0.3s ease;
                font-family: 'Segoe UI', sans-serif;
                cursor: ${clickable ? 'pointer' : 'default'};
                transition: transform 0.2s ease;
            ">
                ${message}
            </div>
        `;

        if (clickable) {
            notification.querySelector('div').onclick = () => {
                window.location.href = '/';
                notification.remove();
            };
            notification.querySelector('div').onmouseenter = (e) => {
                e.target.style.transform = 'scale(1.05)';
            };
            notification.querySelector('div').onmouseleave = (e) => {
                e.target.style.transform = 'scale(1)';
            };
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    addNotificationStyles() {
        if (document.getElementById('sw-manager-styles')) return;

        const style = document.createElement('style');
        style.id = 'sw-manager-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;

        document.head.appendChild(style);
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

            // Timeout after 3 seconds
            setTimeout(() => {
                reject(new Error('Service Worker timeout'));
            }, 3000);
        });
    }

    // Public methods
    enableAutoRedirect() {
        this.autoRedirectEnabled = true;
        console.log('✅ Auto redirect enabled');
    }

    disableAutoRedirect() {
        this.autoRedirectEnabled = false;
        console.log('⛔ Auto redirect disabled');
    }

    forceRedirectToGame() {
        this.redirectToGame();
    }

    forceRedirectToOffline() {
        this.redirectToOffline();
    }
}

// Auto-initialize with smart detection
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize on game or offline pages
    const path = window.location.pathname;
    const isGamePage = path.includes('/cargame');
    const isOfflinePage = path.includes('/offline/index.html') || 
                         path === '/offline/' || 
                         path === '/offline';

    if (!isGamePage && !isOfflinePage) {
        if (!window.SWManager) {
            window.SWManager = new ServiceWorkerManager();
        }
    } else {
        console.log('⚡ SW Manager: Skipping auto-redirect on game/offline page');
        
        // But still initialize for notifications and cache checking
        if (!window.SWManager && (isGamePage || isOfflinePage)) {
            window.SWManager = new ServiceWorkerManager();
            window.SWManager.autoRedirectEnabled = false; // Disable redirect on these pages
        }
    }
});

// Global helper with emergency functions
window.RelaySW = {
    // Redirect functions
    goToGame: () => window.SWManager?.forceRedirectToGame(),
    goToOffline: () => window.SWManager?.forceRedirectToOffline(),

    // Control functions
    enableRedirect: () => window.SWManager?.enableAutoRedirect(),
    disableRedirect: () => window.SWManager?.disableAutoRedirect(),

    // Status functions
    checkStatus: () => window.SWManager?.checkGameCache(),
    isOnline: () => window.SWManager?.isOnline,

    // Emergency offline test (for debugging)
    testOfflineRedirect: () => {
        console.log('🧪 Testing offline redirect...');
        const manager = window.SWManager || new ServiceWorkerManager();
        manager.isOnline = false;
        manager.checkAndRedirect();
    },
    
    // Go back to main app
    goToHome: () => {
        window.location.href = '/';
    }
};

console.log('⚡ Service Worker Manager v4.3 loaded - Auto Redirect Ready');