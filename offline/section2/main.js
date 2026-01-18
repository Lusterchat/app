// section2/main.js
document.addEventListener('DOMContentLoaded', function() {
    const tvVideo = document.getElementById('tv-video');
    const channelNumber = document.getElementById('channel-number');
    const remoteChannel = document.getElementById('remote-channel');
    const remoteStatus = document.getElementById('remote-status');
    const staticOverlay = document.getElementById('static-overlay');
    const powerBtn = document.getElementById('power-btn');
    const prevChannelBtn = document.getElementById('prev-channel');
    const nextChannelBtn = document.getElementById('next-channel');
    const numberButtons = document.querySelectorAll('.num-btn');
    
    const totalChannels = 5;
    let currentChannel = 1;
    let isPoweredOn = true;
    let isVideoPlaying = false;
    
    // Video sources array (5 channels)
    const videoSources = [];
    for (let i = 1; i <= totalChannels; i++) {
        videoSources.push(`../videos/vid${i}.mp4`);
    }
    
    // Function to update TV display
    function updateTV() {
        if (isPoweredOn) {
            // TV is on - show video
            tvVideo.src = videoSources[currentChannel - 1];
            tvVideo.controls = false;
            staticOverlay.style.opacity = '0';
            channelNumber.textContent = currentChannel.toString().padStart(2, '0');
            remoteChannel.textContent = currentChannel.toString().padStart(2, '0');
            remoteStatus.textContent = 'ON';
            remoteStatus.style.color = '#4caf50';
            powerBtn.style.background = 'linear-gradient(to bottom, #4caf50, #2e7d32)';
            
            // Try to play video
            const playPromise = tvVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Video started playing
                    isVideoPlaying = true;
                }).catch((error) => {
                    console.log('Autoplay prevented:', error);
                    // Show play button or controls
                    tvVideo.controls = true;
                    isVideoPlaying = false;
                });
            }
        } else {
            // TV is off
            tvVideo.pause();
            tvVideo.controls = false;
            staticOverlay.style.opacity = '0.8';
            channelNumber.textContent = '--';
            remoteChannel.textContent = '--';
            remoteStatus.textContent = 'OFF';
            remoteStatus.style.color = '#ff5252';
            powerBtn.style.background = 'linear-gradient(to bottom, #ff4444, #cc0000)';
            isVideoPlaying = false;
        }
    }
    
    // Function to change channel
    function changeChannel(newChannel) {
        if (!isPoweredOn) return;
        
        // Show static effect when changing channels
        staticOverlay.style.opacity = '0.7';
        
        // Pause current video
        tvVideo.pause();
        isVideoPlaying = false;
        
        setTimeout(() => {
            currentChannel = newChannel;
            updateTV();
            
            // Hide static after video loads
            setTimeout(() => {
                staticOverlay.style.opacity = '0';
            }, 300);
        }, 200);
    }
    
    // Power button event
    powerBtn.addEventListener('click', function() {
        isPoweredOn = !isPoweredOn;
        updateTV();
        
        // Animate power button
        powerBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            powerBtn.style.transform = 'scale(1)';
        }, 150);
    });
    
    // Previous channel button
    prevChannelBtn.addEventListener('click', function() {
        if (!isPoweredOn) return;
        
        let newChannel = currentChannel - 1;
        if (newChannel < 1) newChannel = totalChannels;
        changeChannel(newChannel);
    });
    
    // Next channel button
    nextChannelBtn.addEventListener('click', function() {
        if (!isPoweredOn) return;
        
        let newChannel = currentChannel + 1;
        if (newChannel > totalChannels) newChannel = 1;
        changeChannel(newChannel);
    });
    
    // Number pad buttons
    numberButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (!isPoweredOn) return;
            
            const channel = parseInt(this.getAttribute('data-channel'));
            if (channel >= 1 && channel <= totalChannels) {
                changeChannel(channel);
            }
        });
    });
    
    // Keyboard controls
    document.addEventListener('keydown', function(event) {
        if (!isPoweredOn) return;
        
        // Number keys 1-5 for channels
        if (event.key >= '1' && event.key <= '5') {
            const channel = parseInt(event.key);
            changeChannel(channel);
        }
        // Arrow keys for channel navigation
        else if (event.key === 'ArrowLeft') {
            let newChannel = currentChannel - 1;
            if (newChannel < 1) newChannel = totalChannels;
            changeChannel(newChannel);
        } else if (event.key === 'ArrowRight') {
            let newChannel = currentChannel + 1;
            if (newChannel > totalChannels) newChannel = 1;
            changeChannel(newChannel);
        }
        // Space bar for power toggle
        else if (event.key === ' ') {
            isPoweredOn = !isPoweredOn;
            updateTV();
        }
        // P key to play/pause video
        else if (event.key === 'p' || event.key === 'P') {
            if (isPoweredOn) {
                if (tvVideo.paused) {
                    tvVideo.play();
                    isVideoPlaying = true;
                } else {
                    tvVideo.pause();
                    isVideoPlaying = false;
                }
            }
        }
    });
    
    // Initialize TV
    updateTV();
    
    // Video event listeners
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
    
    tvVideo.addEventListener('error', function() {
        console.log('Video loading error for channel', currentChannel);
        staticOverlay.style.opacity = '0.8';
        // Show error message
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            background: rgba(0,0,0,0.7);
            padding: 20px;
            border-radius: 10px;
            z-index: 10;
            text-align: center;
        `;
        errorMsg.innerHTML = `
            <p>Video not available for Channel ${currentChannel}</p>
            <p>Please check if vid${currentChannel}.mp4 exists</p>
        `;
        
        const existingError = document.querySelector('.video-error');
        if (!existingError) {
            errorMsg.className = 'video-error';
            document.querySelector('.video-container').appendChild(errorMsg);
            
            // Remove error after 3 seconds
            setTimeout(() => {
                if (errorMsg.parentNode) {
                    errorMsg.parentNode.removeChild(errorMsg);
                }
            }, 3000);
        }
    });
    
    // Add occasional static effect for realism
    setInterval(() => {
        if (isPoweredOn && isVideoPlaying && Math.random() < 0.05) {
            staticOverlay.style.opacity = '0.3';
            setTimeout(() => {
                if (isPoweredOn) staticOverlay.style.opacity = '0';
            }, 100);
        }
    }, 5000);
    
    // Click on video to play/pause
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
});