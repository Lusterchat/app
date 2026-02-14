// pages/call/script.js - GETS USER FROM LOCALSTORAGE
// NO SUPABASE CLIENT NEEDED!

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
let roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;

// ===== GET USER DIRECTLY FROM LOCALSTORAGE =====
function getUserFromStorage() {
    try {
        // Get from localStorage (where Supabase stores it)
        const sessionStr = localStorage.getItem('supabase.auth.token');
        
        if (!sessionStr) {
            console.log('📦 No session in localStorage');
            return null;
        }
        
        // Parse the session
        const session = JSON.parse(sessionStr);
        
        // The user is in the session - different possible structures
        const user = session?.user || 
                     session?.currentSession?.user || 
                     session?.currentUser;
        
        if (user) {
            console.log('✅ Got user from localStorage:', user.email);
            return user;
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error getting user from storage:', error);
        return null;
    }
}

// ===== INITIALIZE CALL PAGE =====
async function initCallPage() {
    console.log('📞 Call page initializing...');
    console.log('🔗 Room URL param:', roomUrl);
    
    // Show loading
    showLoading();

    // ===== GET USER FROM LOCALSTORAGE =====
    const user = getUserFromStorage();
    if (user) {
        console.log('👤 Logged in as:', user.email);
        console.log('🆔 User ID:', user.id);
        
        // You can update UI with user info if needed
        // document.getElementById('userName').textContent = user.email;
    } else {
        console.log('👤 Guest mode - no user logged in');
    }

    // Check for room URL
    if (!roomUrl) {
        // Try sessionStorage as fallback
        try {
            const stored = sessionStorage.getItem('currentCall');
            if (stored) {
                const data = JSON.parse(stored);
                roomUrl = data.roomUrl;
                console.log('📦 Recovered room from sessionStorage:', roomUrl);
            }
        } catch (e) {
            console.log('No stored room found');
        }
    }
    
    if (!roomUrl) {
        showError('No call room specified. Please start a call from the friends page.');
        return;
    }
    
    // Load Daily.co script
    const scriptLoaded = await loadDailyScript();
    if (!scriptLoaded) {
        showError('Failed to load call service. Please check your internet connection.');
        return;
    }
    
    // Join the call
    await joinCall(roomUrl);
}

// ===== LOAD DAILY.CO SCRIPT =====
function loadDailyScript() {
    return new Promise((resolve) => {
        // Check if already loaded
        if (window.DailyIframe) {
            console.log('✅ Daily.co already loaded');
            resolve(true);
            return;
        }

        console.log('📥 Loading Daily.co script...');
        
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
            console.log('✅ Daily.co script loaded');
            
            // Wait for DailyIframe to be ready
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
                    console.error('❌ DailyIframe not available');
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

// ===== JOIN CALL =====
async function joinCall(url) {
    try {
        console.log('🔧 Creating Daily iframe...');
        
        // Get container
        const container = document.getElementById('dailyFrame');
        if (!container) {
            showError('Call interface not found');
            return;
        }

        // Clear container
        container.innerHTML = '';

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
            showParticipantsBar: true
        });

        console.log('✅ Daily iframe created');

        // Set up event listeners
        callFrame
            .on('joining-meeting', () => {
                console.log('⏳ Joining meeting...');
            })
            .on('joined-meeting', (event) => {
                console.log('✅ Successfully joined call');
                hideLoading();
                showCallContainer();
                
                // Start with video off
                setTimeout(() => {
                    if (callFrame) {
                        callFrame.setLocalVideo(false);
                    }
                }, 1000);
            })
            .on('left-meeting', () => {
                console.log('👋 Left meeting');
                showEndScreen();
            })
            .on('error', (error) => {
                console.error('❌ Call error:', error);
                showError('Connection failed. Please try again.');
            });

        // Join the meeting
        console.log('🔌 Joining call:', url);
        await callFrame.join({
            url: url,
            userName: getUserFromStorage()?.email?.split('@')[0] || 'You',
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

// ===== SETUP CONTROLS =====
function setupControls() {
    console.log('🔧 Setting up controls');
    
    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endBtn = document.getElementById('endCallBtn');

    let isMuted = false;
    let isVideoOff = true;

    // Mute button
    if (muteBtn) {
        muteBtn.onclick = () => {
            if (!callFrame) return;
            
            isMuted = !isMuted;
            
            try {
                callFrame.setLocalAudio(!isMuted);
                muteBtn.innerHTML = isMuted ? 
                    '<i class="fas fa-microphone-slash"></i>' : 
                    '<i class="fas fa-microphone"></i>';
                
                console.log('🎤 Audio:', isMuted ? 'Muted' : 'Unmuted');
            } catch (e) {
                console.error('Error toggling audio:', e);
            }
        };
    }

    // Video button
    if (videoBtn) {
        videoBtn.onclick = () => {
            if (!callFrame) return;
            
            isVideoOff = !isVideoOff;
            
            try {
                callFrame.setLocalVideo(!isVideoOff);
                videoBtn.innerHTML = isVideoOff ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
                
                videoBtn.classList.toggle('active', !isVideoOff);
                
                console.log('📹 Video:', isVideoOff ? 'Off' : 'On');
            } catch (e) {
                console.error('Error toggling video:', e);
            }
        };
        
        // Start with video off
        videoBtn.classList.add('active');
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

// ===== UI HELPER FUNCTIONS =====
function showLoading() {
    document.getElementById('callLoading').style.display = 'flex';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'none';
}

function hideLoading() {
    document.getElementById('callLoading').style.display = 'none';
}

function showCallContainer() {
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callContainer').style.display = 'block';
    document.getElementById('callError').style.display = 'none';
}

function showError(message) {
    console.error('❌ Error:', message);
    
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
}

function showEndScreen() {
    console.log('📱 Showing end screen');
    
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = 'Call ended';
    
    // Update back button
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.textContent = 'Back to Friends';
        backBtn.onclick = () => {
            console.log('👆 User clicked back button');
            window.location.href = '/pages/home/friends/index.html';
        };
    }
}

// ===== BACK BUTTON HANDLER =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded');
    
    // Add click handler to back button
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            console.log('👆 User clicked back button');
            window.location.href = '/pages/home/friends/index.html';
        };
    }
    
    // Initialize call
    initCallPage();
});

// ===== CLEANUP =====
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

// Log every 5 seconds to prove no redirect
setInterval(() => {
    console.log('⏱️ Still on call page -', new Date().toLocaleTimeString());
}, 5000);