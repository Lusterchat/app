// pages/call/script.js - Following home page pattern
import { getCallUser } from '/utils/call-auth.js';
import { createCallRoom } from '/utils/daily.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;
let currentUser = null;

// Initialize call page
async function initCallPage() {
    console.log('📞 Initializing call page...');

    // Show loading
    document.getElementById('callLoading').style.display = 'flex';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'none';

    // Check auth like home page - but NEVER redirect
    try {
        const authResult = await getCallUser();
        
        if (authResult.success) {
            currentUser = authResult.user;
            console.log('✅ Call page: User authenticated:', currentUser.email);
        } else {
            console.log('⚠️ Call page: Auth check failed - continuing anyway');
            
            // Try to recover from localStorage like home page
            try {
                const sessionStr = localStorage.getItem('supabase.auth.token');
                if (sessionStr) {
                    const session = JSON.parse(sessionStr);
                    currentUser = {
                        id: session?.user?.id,
                        email: session?.user?.email
                    };
                    console.log('✅ Call page: Recovered user from localStorage');
                }
            } catch (e) {}
        }
    } catch (error) {
        console.log('ℹ️ Call page: Auth error - continuing as guest');
    }

    // Load Daily.co script
    const scriptLoaded = await loadDailyScript();

    if (!scriptLoaded) {
        showError('Failed to load call service');
        return;
    }

    // Join or start call
    if (roomUrl) {
        console.log('📞 Joining call:', roomUrl);
        await joinCall(roomUrl);
    } else {
        console.log('📞 Starting new call');
        await startNewCall();
    }
}

// Load Daily.co script
function loadDailyScript() {
    return new Promise((resolve) => {
        if (window.DailyIframe) {
            resolve(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;

        script.onload = () => {
            let attempts = 0;
            const checkDaily = setInterval(() => {
                if (window.DailyIframe) {
                    clearInterval(checkDaily);
                    resolve(true);
                }
                if (attempts++ > 20) {
                    clearInterval(checkDaily);
                    resolve(false);
                }
            }, 100);
        };

        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

// Start new call
async function startNewCall() {
    try {
        const result = await createCallRoom();
        if (!result?.success) {
            showError('Failed to create call');
            return;
        }
        currentRoom = result;
        await joinCall(result.url);
    } catch (error) {
        showError(error.message);
    }
}

// Join call
async function joinCall(url) {
    try {
        if (!window.DailyIframe) {
            showError('Call service unavailable');
            return;
        }

        const iframe = document.getElementById('dailyFrame');
        if (!iframe) {
            showError('Call interface not found');
            return;
        }

        callFrame = window.DailyIframe.createFrame(iframe, {
            showLeaveButton: false,
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
            startVideoOff: true,
            startAudioOff: false
        });

        callFrame.on('joined-meeting', () => {
            document.getElementById('callLoading').style.display = 'none';
            document.getElementById('callContainer').style.display = 'block';
        });

        // 🔥 NO AUTO REDIRECT
        callFrame.on('left-meeting', () => {
            console.log('Call ended');
            showCallEnded();
        });

        callFrame.on('error', () => {
            showError('Connection failed');
        });

        setupCallControls();

    } catch (error) {
        showError('Failed to join call');
    }
}

// Show call ended - NO AUTO REDIRECT
function showCallEnded() {
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = 'Call ended';

    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
            window.location.href = '/pages/home/friends/index.html';  // ONLY on manual click
        };
    }
}

// Setup controls
function setupCallControls() {
    let isMuted = false;
    let isVideoOff = true;

    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endBtn = document.getElementById('endCallBtn');

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (callFrame) callFrame.setLocalAudio(!isMuted);
            muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
        });
    }

    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            isVideoOff = !isVideoOff;
            if (callFrame) callFrame.setLocalVideo(!isVideoOff);
            videoBtn.innerHTML = isVideoOff ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        });
    }

    if (endBtn) {
        endBtn.addEventListener('click', () => {
            if (callFrame) callFrame.leave();
            showCallEnded();
        });
    }
}

// Show error
function showError(message) {
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
}

// Initialize
document.addEventListener('DOMContentLoaded', initCallPage);