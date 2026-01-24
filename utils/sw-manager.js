// Service Worker Manager v4.4 - Redirect to Offline Page Always
class ServiceWorkerManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.autoRedirectEnabled = true;
        this.lastRedirectTime = 0;
        this.init();
    }

    async init() {
        console.log('⚡ SW Manager v4.4 - Always Redirect to Offline Page');

        // Check current page
        this.checkCurrentPage();

        // Listen for network changes
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Check every 5 seconds if we should redirect
        setInterval(() => this.checkAndRedirect(), 5000);

        // Initial check
        setTimeout(() => this.checkAndRedirect(), 2000);
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
        if (now - this.lastRedirectTime < 3000) return;

        this.isOnline = navigator.onLine;

        // ====== CRITICAL CHANGE ======
        // ALWAYS redirect to offline page when offline
        if (!this.isOnline && this.isAppPage && this.autoRedirectEnabled) {
            console.log('📴 Offline detected - Redirecting to Offline Page');
            this.redirectToOffline();
            this.lastRedirectTime = now;
            return;
        }

        // If user is on game page and goes offline, redirect to offline page
        if (!this.isOnline && this.isGamePage && this.autoRedirectEnabled) {
            console.log('📴 Offline on game page - Redirecting to Offline Page');
            this.redirectToOffline();
            this.lastRedirectTime = now;
            return;
        }
    }

    // REMOVED checkGameCache function
    // We don't need to check cache anymore

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
        }, 800);
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
        console.log('📴 Went offline - Will redirect to offline page');

        // Immediate redirect (faster response)
        setTimeout(() => this.checkAndRedirect(), 500);

        // Show notification
        this.showOfflineNotification('📶 You are offline - Redirecting...');
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
                    Redirecting to offline page...
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 2 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);

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

            setTimeout(() => {
                reject(new Error('Service Worker timeout'));
            }, 2000);
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
    
    forceRedirectToOffline() {
        this.redirectToOffline();
    }
}

// Auto-initialize with smart detection
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize on offline page (to prevent loops)
    const path = window.location.pathname;
    const isOfflinePage = path.includes('/offline/index.html') || 
                         path === '/offline/' || 
                         path === '/offline';

    if (!isOfflinePage) {
        if (!window.SWManager) {
            window.SWManager = new ServiceWorkerManager();
        }
    } else {
        console.log('⚡ SW Manager: Skipping auto-redirect on offline page');
        
        // But still initialize for notifications
        if (!window.SWManager) {
            window.SWManager = new ServiceWorkerManager();
            window.SWManager.autoRedirectEnabled = false;
        }
    }
});

// Global helper with emergency functions
window.RelaySW = {
    // Redirect functions
    goToOffline: () => window.SWManager?.forceRedirectToOffline(),

    // Control functions
    enableRedirect: () => window.SWManager?.enableAutoRedirect(),
    disableRedirect: () => window.SWManager?.disableAutoRedirect(),

    // Status functions
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

console.log('⚡ Service Worker Manager v4.4 loaded - Always Redirect to Offline Page');