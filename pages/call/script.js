// pages/call/script.js - ULTRA SIMPLE VERSION
// NO AUTH - NO REDIRECTS - JUST CALLS

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;

// Initialize - NO AUTH, NO COMPLICATED STUFF
async function initCall() {
    console.log('📞 Call page initializing...');
    console.log('Room URL:', roomUrl);
    console.log('Friend:', friendName);

    // Show loading
    showLoading();

    // Check if we have a room URL
    if (!roomUrl) {
        showError('No call room specified. Please start a call from the friends page.');
        return;
    }

    // Load Daily.co script
    const scriptLoaded = await loadDailyScript();

    if (!scriptLoaded) {
        showError('Failed to load call service. Please check your internet connection and refresh.');
        return;
    }

    // Join the call
    await joinCall(roomUrl);
}

// Load Daily.co script
function loadDailyScript() {
    return new Promise((resolve) => {
        // Check if already loaded
        if (window.DailyIframe) {
            console.log('✅ Daily.co already loaded');
            resolve(true);
            return;
        }

        console.log('📥 Loading Daily.co script...');
        
        // Create script element
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;
        script.crossOrigin = 'anonymous';

        script.onload = () => {
            console.log('✅ Daily.co script loaded');
            
            // Wait for DailyIframe to be available
            let attempts = 0;
            const checkInterval = setInterval(() => {
                if (window.DailyIframe) {
                    clearInterval(checkInterval);
                    console.log('✅ DailyIframe is ready');
                    resolve(true);
                }
                
                attempts++;
                if (attempts > 50) { // 5 seconds timeout
                    clearInterval(checkInterval);
                    console.error('❌ DailyIframe not available after loading');
                    resolve(false);
                }
            }, 100);
        };

        script.onerror = (error) => {
            console.error('❌ Failed to load Daily.co script:', error);
            resolve(false);
        };

        document.head.appendChild(script);
    });
}

// Join call
async function joinCall(url) {
    try {
        console.log('🔧 Creating Daily iframe...');
        
        // Get the iframe container
        const container = document.getElementById('dailyFrame');
        if (!container) {
            showError('Call interface not found. Please refresh.');
            return;
        }

        // Clear container
        container.innerHTML = '';

        // Make sure DailyIframe is available
        if (!window.DailyIframe) {
            showError('Daily.co not loaded properly. Please refresh.');
            return;
        }

        // Create Daily iframe
        callFrame = window.DailyIframe.createFrame(container, {
            showLeaveButton: false,
            iframeStyle: {
                width: '100%',
                height: '100%',
                border: '0',
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0'
            },
            showFullscreenButton: true,
            showParticipantsBar: true,
            dailyConfig: {
                experimentalChromeVideoMuteLightOff: true,
                hideVideoTrackWhenOff: true
            }
        });

        console.log('✅ Daily iframe created');

        // Set up event listeners
        callFrame
            .on('joining-meeting', () => {
                console.log('⏳ Joining meeting...');
            })
            .on('joined-meeting', (event) => {
                console.log('✅ Successfully joined call', event);
                hideLoading();
                showCallContainer();
                
                // Start with video off
                setTimeout(() => {
                    if (callFrame) {
                        callFrame.setLocalVideo(false);
                    }
                }, 1000);
            })
            .on('left-meeting', (event) => {
                console.log('👋 Left meeting', event);
                showEndScreen();
            })
            .on('error', (error) => {
                console.error('❌ Call error:', error);
                showError('Connection failed. Please try again.');
            })
            .on('camera-error', (error) => {
                console.warn('⚠️ Camera error:', error);
            })
            .on('microphone-error', (error) => {
                console.warn('⚠️ Microphone error:', error);
            })
            .on('participant-joined', (event) => {
                console.log('👤 Participant joined:', event);
            })
            .on('participant-left', (event) => {
                console.log('👤 Participant left:', event);
            });

        // Join the meeting
        console.log('🔌 Joining call:', url);
        await callFrame.join({
            url: url,
            userName: 'You',
            videoSource: false, // Start with video off
            audioSource: true   // Start with audio on
        });

        // Setup controls
        setupControls();

    } catch (error) {
        console.error('❌ Failed to join call:', error);
        showError('Failed to join call: ' + (error.message || 'Unknown error'));
    }
}

// Setup call controls
function setupControls() {
    console.log('🔧 Setting up controls');
    
    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endBtn = document.getElementById('endCallBtn');

    // Mute button
    if (muteBtn) {
        muteBtn.onclick = () => {
            if (!callFrame) return;
            
            const isActive = muteBtn.classList.contains('active');
            const icon = muteBtn.querySelector('i');
            
            try {
                callFrame.setLocalAudio(isActive); // If active (muted), unmute
                muteBtn.classList.toggle('active');
                
                if (icon) {
                    icon.className = isActive ? 'fas fa-microphone' : 'fas fa-microphone-slash';
                }
                
                console.log('🎤 Audio:', isActive ? 'Unmuted' : 'Muted');
            } catch (e) {
                console.error('Error toggling audio:', e);
            }
        };
    }

    // Video button
    if (videoBtn) {
        videoBtn.onclick = () => {
            if (!callFrame) return;
            
            const isActive = videoBtn.classList.contains('active');
            const icon = videoBtn.querySelector('i');
            
            try {
                callFrame.setLocalVideo(isActive); // If active (off), turn on
                videoBtn.classList.toggle('active');
                
                if (icon) {
                    icon.className = isActive ? 'fas fa-video-slash' : 'fas fa-video';
                }
                
                console.log('📹 Video:', isActive ? 'Turned On' : 'Turned Off');
            } catch (e) {
                console.error('Error toggling video:', e);
            }
        };
    }

    // End call button
    if (endBtn) {
        endBtn.onclick = () => {
            console.log('👋 Ending call...');
            if (callFrame) {
                try {
                    callFrame.leave();
                } catch (e) {
                    console.error('Error leaving call:', e);
                    showEndScreen();
                }
            } else {
                showEndScreen();
            }
        };
    }
}

// UI Helper Functions
function showLoading() {
    const loading = document.getElementById('callLoading');
    const container = document.getElementById('callContainer');
    const error = document.getElementById('callError');
    
    if (loading) loading.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (error) error.style.display = 'none';
}

function hideLoading() {
    const loading = document.getElementById('callLoading');
    if (loading) loading.style.display = 'none';
}

function showCallContainer() {
    const loading = document.getElementById('callLoading');
    const container = document.getElementById('callContainer');
    const error = document.getElementById('callError');
    
    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'block';
    if (error) error.style.display = 'none';
}

function showError(message) {
    console.error('❌ Error:', message);
    
    const loading = document.getElementById('callLoading');
    const container = document.getElementById('callContainer');
    const error = document.getElementById('callError');
    const errorMsg = document.getElementById('errorMessage');
    
    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = message;
}

function showEndScreen() {
    console.log('📱 Showing end screen');
    
    const container = document.getElementById('callContainer');
    const loading = document.getElementById('callLoading');
    const error = document.getElementById('callError');
    const errorMsg = document.getElementById('errorMessage');
    const backBtn = document.getElementById('backButton');
    
    if (container) container.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = 'Call ended';
    
    // Update back button
    if (backBtn) {
        backBtn.textContent = 'Back to Friends';
        backBtn.onclick = () => {
            console.log('👆 User clicked back button');
            window.location.href = '/pages/home/friends/index.html';
        };
    }
}

// Add back button handler for error screen
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded');
    
    // Add click handler to back button
    const backBtn = document.getElementById('backButton');
    if (backBtn) {
        backBtn.onclick = () => {
            console.log('👆 User clicked back button');
            window.location.href = '/pages/home/friends/index.html';
        };
    }
    
    // Initialize call
    initCall();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    console.log('👋 Page unloading');
    if (callFrame) {
        try {
            callFrame.leave();
            callFrame.destroy();
        } catch (e) {
            console.error('Error during cleanup:', e);
        }
    }
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('🔇 Tab hidden');
    } else {
        console.log('🔊 Tab visible');
    }
});