// section2/main.js - FIXED VERSION with correct video paths
document.addEventListener('DOMContentLoaded', function() {
    const tvVideo = document.getElementById('tv-video');
    const channelNumber = document.getElementById('channel-number');
    const remoteChannel = document.getElementById('remote-channel');
    const remoteStatus = document.getElementById('remote-status');
    const retroStatus = document.getElementById('retro-status');
    const staticOverlay = document.getElementById('static-overlay');
    const pixelOverlay = document.getElementById('pixel-overlay');
    const scanlines = document.getElementById('scanlines');
    const powerBtn = document.getElementById('power-btn');
    const prevChannelBtn = document.getElementById('prev-channel');
    const nextChannelBtn = document.getElementById('next-channel');
    const numberButtons = document.querySelectorAll('.num-btn');
    const retroBtn = document.getElementById('retro-btn');
    const aspectInfo = document.getElementById('aspect-info');
    const cacheInfo = document.getElementById('cache-info');

    const totalChannels = 5;
    let currentChannel = 1;
    let isPoweredOn = true;
    let isVideoPlaying = false;
    let isRetroMode = false;

    // === FIXED: Use correct video paths ===
    const videoSources = [
        '/offline/videos/vid1.mp4',
        '/offline/videos/vid2.mp4',
        '/offline/videos/vid3.mp4',
        '/offline/videos/vid4.mp4',
        '/offline/videos/vid5.mp4'
    ];

    // Function to check if video is cached
    async function checkVideoCache(url) {
        try {
            const cache = await caches.open('relaytalk-cache-v3-8');
            const response = await cache.match(url);
            return response ? true : false;
        } catch (error) {
            return false;
        }
    }

    // Function to update TV display
    async function updateTV() {
        if (isPoweredOn) {
            const videoUrl = videoSources[currentChannel - 1];
            
            // Check if video is cached
            const isCached = await checkVideoCache(videoUrl);
            
            if (!isCached) {
                console.warn(`⚠️ Video not cached: ${videoUrl}`);
                showCacheWarning();
            }
            
            tvVideo.src = videoUrl;
            tvVideo.controls = false;
            staticOverlay.style.opacity = '0';
            channelNumber.textContent = currentChannel.toString().padStart(2, '0');
            remoteChannel.textContent = currentChannel.toString().padStart(2, '0');
            remoteStatus.textContent = 'ON';
            remoteStatus.style.color = '#4caf50';
            powerBtn.style.background = 'linear-gradient(to bottom, #4caf50, #2e7d32)';

            updateAspectInfo();

            const playPromise = tvVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    isVideoPlaying = true;
                }).catch((error) => {
                    console.log('Autoplay prevented');
                    tvVideo.controls = true;
                    isVideoPlaying = false;
                });
            }
        } else {
            tvVideo.pause();
            tvVideo.controls = false;
            staticOverlay.style.opacity = '0.8';
            channelNumber.textContent = '--';
            remoteChannel.textContent = '--';
            remoteStatus.textContent = 'OFF';
            remoteStatus.style.color = '#ff5252';
            powerBtn.style.background = 'linear-gradient(to bottom, #ff4444, #cc0000)';
            isVideoPlaying = false;
            aspectInfo.textContent = 'TV OFF';
        }
    }

    function showCacheWarning() {
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 193, 7, 0.9);
            color: #333;
            padding: 8px 16px;
            border-radius: 6px;
            z-index: 20;
            font-size: 14px;
            animation: fadeIn 0.3s ease;
        `;
        warning.innerHTML = `
            ⚠️ Video not cached. <button onclick="window.SWManager?.startCaching()" 
            style="background: #333; color: white; border: none; padding: 4px 8px; 
            border-radius: 4px; margin-left: 8px; cursor: pointer;">
            Cache Now</button>
        `;
        
        const existingWarning = document.querySelector('.cache-warning');
        if (!existingWarning) {
            warning.className = 'cache-warning';
            document.querySelector('.tv-screen').appendChild(warning);
            
            setTimeout(() => {
                if (warning.parentNode) {
                    warning.style.animation = 'fadeOut 0.3s ease';
                    setTimeout(() => warning.remove(), 300);
                }
            }, 5000);
        }
    }

    function updateAspectInfo() {
        if (!isPoweredOn) return;

        tvVideo.addEventListener('loadedmetadata', function onMetadata() {
            const videoWidth = tvVideo.videoWidth;
            const videoHeight = tvVideo.videoHeight;
            const aspectRatio = videoWidth / videoHeight;

            if (Math.abs(aspectRatio - (4/3)) < 0.1) {
                aspectInfo.textContent = '4:3 Native';
            } else if (Math.abs(aspectRatio - (16/9)) < 0.1) {
                aspectInfo.textContent = '16:9 in 4:3 TV';
            } else if (Math.abs(aspectRatio - 1) < 0.1) {
                aspectInfo.textContent = '1:1 Square';
            } else {
                aspectInfo.textContent = `${videoWidth}:${videoHeight}`;
            }

            if (aspectRatio > 1.4) {
                tvVideo.style.objectFit = 'contain';
            } else if (aspectRatio < 1.2) {
                tvVideo.style.objectFit = 'cover';
            } else {
                tvVideo.style.objectFit = 'cover';
            }
            
            tvVideo.removeEventListener('loadedmetadata', onMetadata);
        }, { once: true });
    }

    function toggleRetroMode() {
        isRetroMode = !isRetroMode;

        if (isRetroMode) {
            pixelOverlay.classList.remove('retro-off');
            scanlines.classList.remove('retro-off');
            retroBtn.classList.remove('active');
            retroBtn.style.background = 'linear-gradient(to bottom, #444, #222)';
            retroStatus.textContent = 'RETRO ON';
            retroStatus.style.color = '#ff9800';
        } else {
            pixelOverlay.classList.add('retro-off');
            scanlines.classList.add('retro-off');
            retroBtn.classList.add('active');
            retroBtn.style.background = 'linear-gradient(to bottom, #4caf50, #2e7d32)';
            retroStatus.textContent = 'RETRO OFF';
            retroStatus.style.color = '#4caf50';
        }
    }

    function changeChannel(newChannel) {
        if (!isPoweredOn) return;

        staticOverlay.style.opacity = '0.7';
        tvVideo.pause();
        isVideoPlaying = false;

        setTimeout(() => {
            currentChannel = newChannel;
            updateTV();

            setTimeout(() => {
                staticOverlay.style.opacity = '0';
            }, 300);
        }, 200);
    }

    powerBtn.addEventListener('click', function() {
        isPoweredOn = !isPoweredOn;
        updateTV();
        powerBtn.style.transform = 'scale(0.9)';
        setTimeout(() => powerBtn.style.transform = 'scale(1)', 150);
    });

    prevChannelBtn.addEventListener('click', function() {
        if (!isPoweredOn) return;
        let newChannel = currentChannel - 1;
        if (newChannel < 1) newChannel = totalChannels;
        changeChannel(newChannel);
    });

    nextChannelBtn.addEventListener('click', function() {
        if (!isPoweredOn) return;
        let newChannel = currentChannel + 1;
        if (newChannel > totalChannels) newChannel = 1;
        changeChannel(newChannel);
    });

    numberButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (!isPoweredOn) return;
            const channel = parseInt(this.getAttribute('data-channel'));
            if (channel >= 1 && channel <= totalChannels) {
                changeChannel(channel);
            }
        });
    });

    retroBtn.addEventListener('click', function() {
        toggleRetroMode();
        retroBtn.style.transform = 'scale(0.9)';
        setTimeout(() => retroBtn.style.transform = 'scale(1)', 150);
    });

    document.addEventListener('keydown', function(event) {
        if (!isPoweredOn) return;

        if (event.key >= '1' && event.key <= '5') {
            const channel = parseInt(event.key);
            changeChannel(channel);
        } else if (event.key === 'ArrowLeft') {
            let newChannel = currentChannel - 1;
            if (newChannel < 1) newChannel = totalChannels;
            changeChannel(newChannel);
        } else if (event.key === 'ArrowRight') {
            let newChannel = currentChannel + 1;
            if (newChannel > totalChannels) newChannel = 1;
            changeChannel(newChannel);
        } else if (event.key === ' ') {
            event.preventDefault();
            isPoweredOn = !isPoweredOn;
            updateTV();
        } else if (event.key === 'p' || event.key === 'P') {
            if (isPoweredOn) {
                if (tvVideo.paused) {
                    tvVideo.play();
                    isVideoPlaying = true;
                } else {
                    tvVideo.pause();
                    isVideoPlaying = false;
                }
            }
        } else if (event.key === 'r' || event.key === 'R') {
            toggleRetroMode();
        } else if (event.key === 'c' || event.key === 'C') {
            if (window.SWManager && window.SWManager.startCaching) {
                window.SWManager.startCaching();
            }
        }
    });

    updateTV();
    toggleRetroMode();

    tvVideo.addEventListener('playing', function() {
        isVideoPlaying = true;
        staticOverlay.style.opacity = '0';
    });

    tvVideo.addEventListener('pause', function() {
        isVideoPlaying = false;
    });

    tvVideo.addEventListener('waiting', function() {
        staticOverlay.style.opacity = '0.5';
    });

    tvVideo.addEventListener('loadeddata', function() {
        staticOverlay.style.opacity = '0';
    });

    tvVideo.addEventListener('error', function(e) {
        console.log('Video error:', e);
        staticOverlay.style.opacity = '0.8';
        
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            background: rgba(0,0,0,0.9);
            padding: 20px;
            border-radius: 10px;
            z-index: 10;
            text-align: center;
            max-width: 80%;
            border: 2px solid #f44336;
        `;
        errorMsg.innerHTML = `
            <h3 style="color: #f44336;">⚠️ Video Error</h3>
            <p>Channel ${currentChannel}: ${videoSources[currentChannel - 1]}</p>
            <p style="font-size: 0.9rem; margin: 10px 0;">
                Video may not be cached. Try caching from the button below.
            </p>
            <button onclick="if(window.SWManager) window.SWManager.startCaching()" style="
                background: #f44336;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                margin-top: 10px;
                cursor: pointer;
            ">Cache Videos</button>
        `;

        const existingError = document.querySelector('.video-error');
        if (!existingError) {
            errorMsg.className = 'video-error';
            document.querySelector('.video-container').appendChild(errorMsg);
        }
    });

    tvVideo.addEventListener('click', function() {
        if (isPoweredOn) {
            if (tvVideo.paused) {
                tvVideo.play();
                isVideoPlaying = true;
            } else {
                tvVideo.pause();
                isVideoPlaying = false;
            }
        }
    });

    setInterval(() => {
        if (isPoweredOn && isVideoPlaying && isRetroMode && Math.random() < 0.05) {
            staticOverlay.style.opacity = '0.3';
            setTimeout(() => {
                if (isPoweredOn) staticOverlay.style.opacity = '0';
            }, 100);
        }
    }, 5000);
});