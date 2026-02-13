import { createCallRoom } from '/utils/daily.js';
import { auth } from '/utils/auth.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const isIncoming = urlParams.get('incoming') === 'true';
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;

// Initialize call page
async function initCallPage() {
    console.log('📞 Initializing call page...');
    
    // Show loading
    document.getElementById('callLoading').style.display = 'flex';

    // Check auth
    try {
        const { success, user } = await auth.getCurrentUser();
        if (!success) {
            console.log('Not logged in, redirecting...');
            window.location.href = '/';
            return;
        }
        console.log('✅ User authenticated:', user?.email);
    } catch (error) {
        console.error('Auth error:', error);
    }

    // Load Daily.co script
    const scriptLoaded = await loadDailyScript();
    
    if (!scriptLoaded) {
        showError('Failed to load call service. Please check your internet connection.');
        return;
    }

    if (roomUrl) {
        await joinCall(roomUrl);
    } else {
        await startNewCall();
    }
}

// Load Daily.co iframe library
function loadDailyScript() {
    return new Promise((resolve) => {
        if (window.DailyIframe) {
            console.log('✅ Daily already loaded');
            resolve(true);
            return;
        }

        console.log('📥 Loading Daily script...');
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;
        
        script.onload = () => {
            console.log('✅ Daily script loaded');
            let attempts = 0;
            const checkDaily = setInterval(() => {
                if (window.DailyIframe) {
                    clearInterval(checkDaily);
                    resolve(true);
                }
                attempts++;
                if (attempts > 20) {
                    clearInterval(checkDaily);
                    resolve(false);
                }
            }, 100);
        };
        
        script.onerror = (e) => {
            console.error('❌ Failed to load Daily script:', e);
            resolve(false);
        };
        
        document.head.appendChild(script);
    });
}

// Start a new call
async function startNewCall() {
    try {
        console.log('Creating new call...');
        const result = await createCallRoom();
        
        if (!result || !result.success) {
            showError('Failed to create call room');
            return;
        }

        currentRoom = result;
        console.log('✅ Room created:', result.url);
        
        await joinCall(result.url);
        
    } catch (error) {
        console.error('Start call error:', error);
        showError(error.message || 'Failed to start call');
    }
}

// Join an existing call
async function joinCall(url) {
    try {
        console.log('Joining call:', url);
        
        if (!window.DailyIframe) {
            showError('Call service not available');
            return;
        }

        const iframe = document.getElementById('dailyFrame');
        if (!iframe) {
            showError('Call interface not found');
            return;
        }
        
        callFrame = window.DailyIframe.createFrame(iframe, {
            showLeaveButton: false,
            showFullscreenButton: true,
            showParticipantsBar: false,
            iframeStyle: {
                width: '100%',
                height: '100vh',
                border: '0',
                position: 'fixed',
                top: '0',
                left: '0'
            }
        });

        callFrame.join({
            url: url,
            showLeaveButton: false,
            startVideoOff: true,
            startAudioOff: false
        });

        callFrame.on('joined-meeting', () => {
            console.log('✅ Joined call successfully');
            document.getElementById('callLoading').style.display = 'none';
            document.getElementById('callContainer').style.display = 'block';
        });

        // 🔥 FIXED: NO AUTO REDIRECT - Just log the event
        callFrame.on('left-meeting', () => {
            console.log('👋 Call ended - staying on call page');
            // Show "Call ended" message instead of redirecting
            showCallEndedMessage();
        });

        callFrame.on('error', (e) => {
            console.error('Call error:', e);
            showError('Call connection failed');
        });

        setupCallControls();
        
    } catch (error) {
        console.error('Join error:', error);
        showError('Failed to join call: ' + error.message);
    }
}

// 🔥 NEW: Show call ended message (NO REDIRECT)
function showCallEndedMessage() {
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = 'Call ended';
    
    // Change the button text
    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
            window.close(); // Try to close tab, or stay on page
        };
    }
}

// Setup call controls
function setupCallControls() {
    let isMuted = false;
    let isVideoOff = true;

    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endBtn = document.getElementById('endCallBtn');

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (callFrame) {
                callFrame.setLocalAudio(!isMuted);
            }
            muteBtn.innerHTML = isMuted 
                ? '<i class="fas fa-microphone-slash"></i>' 
                : '<i class="fas fa-microphone"></i>';
        });
    }

    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            isVideoOff = !isVideoOff;
            if (callFrame) {
                callFrame.setLocalVideo(!isVideoOff);
            }
            videoBtn.innerHTML = isVideoOff 
                ? '<i class="fas fa-video"></i>' 
                : '<i class="fas fa-video-slash"></i>';
        });
    }

    // 🔥 FIXED: End button - NO AUTO REDIRECT
    if (endBtn) {
        endBtn.addEventListener('click', () => {
            if (callFrame) {
                callFrame.leave();
            }
            // Show ended message instead of redirect
            showCallEndedMessage();
        });
    }
}

// Show error
function showError(message) {
    console.error('Call error:', message);
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
}

// Initialize
document.addEventListener('DOMContentLoaded', initCallPage);