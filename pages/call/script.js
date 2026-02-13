import { createCallRoom, validateRoom } from '../../utils/daily.js';
import { auth } from '../../utils/auth.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const isIncoming = urlParams.get('incoming') === 'true';
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;

// Initialize call page
async function initCallPage() {
    // Check auth
    const { success, user } = await auth.getCurrentUser();
    if (!success) {
        window.location.href = '/';
        return;
    }

    // Show loading
    document.getElementById('callLoading').style.display = 'flex';

    // Load Daily.co script with better error handling
    const scriptLoaded = await loadDailyScript();
    
    if (!scriptLoaded) {
        showError('Failed to load call service. Please check your internet connection.');
        return;
    }

    if (roomUrl) {
        // Joining existing call
        await joinCall(roomUrl);
    } else {
        // Creating new call
        await startNewCall();
    }
}

// Load Daily.co iframe library - FIXED VERSION
function loadDailyScript() {
    return new Promise((resolve) => {
        // Check if already loaded
        if (window.DailyIframe) {
            console.log('✅ Daily already loaded');
            resolve(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js'; // Fixed version
        script.async = true;
        
        script.onload = () => {
            console.log('✅ Daily script loaded');
            // Wait a tiny bit for DailyIframe to be available
            setTimeout(() => {
                resolve(!!window.DailyIframe);
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
        const result = await createCallRoom();
        
        if (!result.success) {
            showError('Failed to create call room');
            return;
        }

        currentRoom = result;
        
        // Update Supabase with call record
        await updateCallRecord(result.url, 'ringing');
        
        // Join the room
        await joinCall(result.url);
        
    } catch (error) {
        showError(error.message);
    }
}

// Join an existing call
async function joinCall(url) {
    try {
        // Double check DailyIframe exists
        if (!window.DailyIframe) {
            showError('Call service not available');
            return;
        }

        const iframe = document.getElementById('dailyFrame');
        
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

        callFrame.on('left-meeting', () => {
            console.log('👋 Left call');
            window.location.href = '/pages/friends/index.html';
        });

        callFrame.on('error', (e) => {
            console.error('Call error:', e);
            showError('Call connection failed');
        });

        // Setup controls
        setupCallControls();
        
    } catch (error) {
        console.error('Join error:', error);
        showError('Failed to join call: ' + error.message);
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
            callFrame.setLocalAudio(!isMuted);
            muteBtn.innerHTML = isMuted 
                ? '<i class="fas fa-microphone-slash"></i>' 
                : '<i class="fas fa-microphone"></i>';
        });
    }

    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            isVideoOff = !isVideoOff;
            callFrame.setLocalVideo(!isVideoOff);
            videoBtn.innerHTML = isVideoOff 
                ? '<i class="fas fa-video"></i>' 
                : '<i class="fas fa-video-slash"></i>';
        });
    }

    if (endBtn) {
        endBtn.addEventListener('click', () => {
            if (callFrame) {
                callFrame.leave();
            }
            window.location.href = '/pages/friends/index.html';
        });
    }
}

// Update call record in Supabase
async function updateCallRecord(roomUrl, status) {
    // Will implement later
    console.log('Call status:', status, roomUrl);
}

// Show error - KEEPS USER ON CALL PAGE
function showError(message) {
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
    
    // DON'T redirect - let user see error and click Close
    console.error('Call error:', message);
}

// Initialize
document.addEventListener('DOMContentLoaded', initCallPage);