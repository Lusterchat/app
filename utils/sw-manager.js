// Service Worker Manager v3.0 - With Cache Button
class ServiceWorkerManager {
    constructor() {
        this.sw = null;
        this.isOnline = navigator.onLine;
        this.registration = null;
        this.cacheInfo = null;
        this.cacheProgress = {
            percentage: 0,
            isCaching: false,
            currentFile: ''
        };
        
        this.init();
    }
    
    async init() {
        console.log('⚡ SW Manager v3.0 initializing...');
        
        // Listen for online/offline changes
        window.addEventListener('online', () => this.updateStatus('online'));
        window.addEventListener('offline', () => this.updateStatus('offline'));
        
        // Register service worker
        await this.registerSW();
        
        // Add cache button to TV section
        this.addCacheButton();
    }
    
    async registerSW() {
        if (!('serviceWorker' in navigator)) {
            console.warn('⚠️ Service Workers not supported');
            return;
        }
        
        try {
            this.registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });
            
            console.log('✅ Service Worker registered');
            
            // Setup service worker
            this.setupSW();
            
        } catch (error) {
            console.error('❌ SW registration failed:', error);
        }
    }
    
    setupSW() {
        if (this.registration.active) {
            this.sw = this.registration.active;
            this.setupMessageHandler();
            this.checkCacheStatus();
        }
    }
    
    setupMessageHandler() {
        navigator.serviceWorker.addEventListener('message', event => {
            const { type, progress } = event.data;
            
            switch (type) {
                case 'CACHE_PROGRESS':
                    this.cacheProgress = progress;
                    this.updateProgressUI();
                    break;
                    
                case 'SW_READY':
                    console.log('🚀 SW ready:', event.data.version);
                    break;
            }
        });
    }
    
    // Add cache button to TV section
    addCacheButton() {
        // Check if we're in the TV section
        if (!window.location.pathname.includes('/offline/section2/')) {
            return;
        }
        
        // Add button after a short delay to ensure DOM is ready
        setTimeout(() => {
            const cacheButton = this.createCacheButton();
            const remote = document.querySelector('.tv-remote');
            
            if (remote) {
                remote.appendChild(cacheButton);
                
                // Add progress overlay
                this.createProgressOverlay();
            }
        }, 1000);
    }
    
    createCacheButton() {
        const button = document.createElement('button');
        button.className = 'cache-now-btn';
        button.innerHTML = `
            <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Cache Now</span>
        `;
        
        button.onclick = () => this.startCaching();
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .cache-now-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 20px;
                width: 100%;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            
            .cache-now-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            
            .cache-now-btn:active {
                transform: translateY(0);
            }
            
            .cache-now-btn.caching {
                background: linear-gradient(135deg, #4caf50, #2e7d32);
                animation: pulse 1.5s infinite;
            }
            
            .cache-icon {
                animation: spin 2s linear infinite;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .cache-progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(10px);
                z-index: 9999;
                display: none;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                color: white;
                font-family: Arial, sans-serif;
            }
            
            .cache-progress-overlay.active {
                display: flex;
                animation: fadeIn 0.3s ease;
            }
            
            .progress-container {
                background: rgba(30, 41, 59, 0.9);
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 500px;
                width: 90%;
                border: 1px solid rgba(102, 126, 234, 0.3);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            
            .progress-title {
                font-size: 24px;
                margin-bottom: 20px;
                color: #667eea;
            }
            
            .progress-bar {
                width: 100%;
                height: 20px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                overflow: hidden;
                margin: 20px 0;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 10px;
                transition: width 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, 
                    transparent 0%, 
                    rgba(255, 255, 255, 0.2) 50%, 
                    transparent 100%);
                animation: shimmer 2s infinite;
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            .progress-text {
                font-size: 18px;
                margin-bottom: 10px;
            }
            
            .progress-file {
                font-size: 14px;
                color: #94a3b8;
                margin-top: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .progress-stats {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
                font-size: 14px;
                color: #cbd5e1;
            }
            
            .cache-complete {
                text-align: center;
                animation: celebrate 0.5s ease;
            }
            
            @keyframes celebrate {
                0% { transform: scale(0.5); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            .complete-icon {
                font-size: 60px;
                color: #4caf50;
                margin-bottom: 20px;
                animation: bounce 1s ease infinite;
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            .close-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 20px;
                transition: background 0.3s ease;
            }
            
            .close-btn:hover {
                background: #764ba2;
            }
        `;
        document.head.appendChild(style);
        
        return button;
    }
    
    createProgressOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'cache-progress-overlay';
        overlay.innerHTML = `
            <div class="progress-container">
                <div class="progress-title">📦 Caching Files</div>
                <div class="progress-text" id="progress-percent">0%</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-file" id="progress-file">Preparing...</div>
                <div class="progress-stats">
                    <div id="progress-stats">0/0 files • 0/0 videos</div>
                    <div id="cache-speed">-</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.progressOverlay = overlay;
    }
    
    updateProgressUI() {
        const { percentage, currentFile, isCaching, completed, total, videosCached, totalVideos } = this.cacheProgress;
        
        // Update button
        const button = document.querySelector('.cache-now-btn');
        if (button) {
            if (isCaching) {
                button.classList.add('caching');
                button.innerHTML = `
                    <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    <span>Caching... ${percentage}%</span>
                `;
            } else {
                button.classList.remove('caching');
                button.innerHTML = `
                    <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>Cache Now</span>
                `;
            }
        }
        
        // Update overlay
        if (this.progressOverlay) {
            const percentEl = this.progressOverlay.querySelector('#progress-percent');
            const fillEl = this.progressOverlay.querySelector('#progress-fill');
            const fileEl = this.progressOverlay.querySelector('#progress-file');
            const statsEl = this.progressOverlay.querySelector('#progress-stats');
            
            if (percentEl) percentEl.textContent = `${percentage}%`;
            if (fillEl) fillEl.style.width = `${percentage}%`;
            
            if (fileEl) {
                const fileName = currentFile.split('/').pop();
                fileEl.textContent = fileName ? `Caching: ${fileName}` : 'Preparing...';
            }
            
            if (statsEl) {
                statsEl.textContent = `${completed}/${total} files • ${videosCached}/${totalVideos} videos`;
            }
            
            // Show/hide overlay
            if (isCaching) {
                this.progressOverlay.classList.add('active');
            } else if (percentage === 100) {
                // Show completion message
                setTimeout(() => {
                    this.showCompletionMessage();
                }, 500);
            }
        }
    }
    
    showCompletionMessage() {
        if (!this.progressOverlay) return;
        
        const container = this.progressOverlay.querySelector('.progress-container');
        container.innerHTML = `
            <div class="cache-complete">
                <div class="complete-icon">🎉</div>
                <h2>Caching Complete!</h2>
                <p>All files are now cached and ready for offline use.</p>
                <p>You can now enjoy all content without internet connection.</p>
                <button class="close-btn" onclick="window.SWManager?.hideProgressOverlay()">Close</button>
            </div>
        `;
    }
    
    hideProgressOverlay() {
        if (this.progressOverlay) {
            this.progressOverlay.classList.remove('active');
            
            // Reset button
            const button = document.querySelector('.cache-now-btn');
            if (button) {
                button.classList.remove('caching');
                button.innerHTML = `
                    <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>Cache Now</span>
                `;
            }
        }
    }
    
    async startCaching() {
        if (!this.isOnline) {
            this.showNotification('Cannot cache while offline', 'error');
            return;
        }
        
        if (this.cacheProgress.isCaching) {
            this.showNotification('Cache already in progress', 'info');
            return;
        }
        
        console.log('🚀 Starting cache process...');
        
        try {
            const result = await this.sendMessage({ type: 'CACHE_ALL' });
            
            if (result.success) {
                console.log('✅ Cache completed:', result.message);
                // Progress updates come via messages
            } else {
                this.showNotification('Cache failed: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('❌ Cache error:', error);
            this.showNotification('Cache failed', 'error');
        }
    }
    
    updateStatus(status) {
        this.isOnline = status === 'online';
        this.sendMessage({ type: 'STATUS', status: status });
        
        if (status === 'offline') {
            this.showNotification('📡 You are offline', 'warning', 3000);
        } else {
            this.showNotification('✅ Back online', 'success', 2000);
        }
    }
    
    async checkCacheStatus() {
        try {
            const status = await this.sendMessage({ type: 'GET_STATUS' });
            this.cacheInfo = status;
            
            // Update cache button if exists
            const button = document.querySelector('.cache-now-btn');
            if (button && status.totalCached > 0) {
                button.innerHTML = `
                    <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 12l2 2 4-4"/>
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    </svg>
                    <span>${status.totalCached}/${status.totalFiles} cached</span>
                `;
            }
        } catch (error) {
            console.warn('Cache check failed:', error);
        }
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${this.getColor(type)};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9998;
                animation: slideIn 0.3s ease;
            ">
                ${message}
            </div>
            <style>
                @keyframes slideIn {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    getColor(type) {
        const colors = {
            success: '#4caf50',
            error: '#f44336',
            info: '#2196f3',
            warning: '#ff9800'
        };
        return colors[type] || colors.info;
    }
    
    sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (!this.sw) {
                reject(new Error('No service worker'));
                return;
            }
            
            const channel = new MessageChannel();
            
            channel.port1.onmessage = (event) => {
                resolve(event.data);
                channel.port1.close();
            };
            
            this.sw.postMessage(message, [channel.port2]);
        });
    }
    
    // Public methods
    async getStatus() {
        return this.sendMessage({ type: 'GET_STATUS' });
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
    cacheAll: () => window.SWManager?.startCaching(),
    getStatus: () => window.SWManager?.getStatus(),
    hideProgress: () => window.SWManager?.hideProgressOverlay()
};

console.log('⚡ Service Worker Manager v3.0 loaded');