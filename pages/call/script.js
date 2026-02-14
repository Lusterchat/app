// pages/call/script.js - Fixed version that waits for Supabase
import { initializeSupabase } from '/utils/supabase.js';
import { createCallRoom } from '/utils/daily.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;
let supabaseInstance = null;

// Initialize call page
async function initCallPage() {
    console.log('📞 Initializing call page...');

    // Show loading immediately
    document.getElementById('callLoading').style.display = 'flex';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'none';

    // STEP 1: Initialize Supabase and wait for it
    console.log('⏳ Waiting for Supabase to initialize...');
    try {
        supabaseInstance = await initializeSupabase();
        console.log('✅ Supabase initialized successfully');
    } catch (error) {
        console.log('⚠️ Supabase initialization warning:', error.message);
        // Continue anyway - call might still work
    }

    // STEP 2: Check auth but NEVER redirect
    try {
        if (supabaseInstance?.auth) {
            const { data: { session } } = await supabaseInstance.auth.getSession();
            
            if (session?.user) {
                console.log('✅ User authenticated:', session.user.email);
            } else {
                console.log('ℹ️ No active session - continuing as guest');
            }
        } else {
            console.log('ℹ️ Auth not available - continuing as guest');
        }
    } catch (error) {
        console.log('ℹ️ Auth check failed - continuing as guest:', error.message);
    }

    // STEP 3: Load Daily.co script
    console.log('Loading Daily.co script...');
    const scriptLoaded = await loadDailyScript();

    if (!scriptLoaded) {
        showError('Failed to load call service');
        return;
    }

    // STEP 4: Join or start call
    if (roomUrl) {
        console.log('📞 Joining existing call:', roomUrl);
        await joinCall(roomUrl);
    } else {
        console.log('📞 Starting new call');
        await startNewCall();
    }
}

// Load Daily.co iframe library
function loadDailyScript() {
    return new Promise((resolve) => {
        if (window.DailyIframe) {
            console.log('✅ Daily.co already loaded');
            resolve(true);
            return;
        }

        console.log('📥 Loading Daily.co script from CDN...');
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;

        script.onload = () => {
            console.log('✅ Daily.co script loaded successfully');
            // Wait for DailyIframe
            let attempts = 0;
            const checkDaily = setInterval(() => {
                if (window.DailyIframe) {
                    console.log('✅ DailyIframe available');
                    clearInterval(checkDaily);
                    resolve(true);
                }
                if (attempts++ > 20) {
                    clearInterval(checkDaily);
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

// Start a new call
async function startNewCall() {
    try {
        const result = await createCallRoom();
        if (!result?.success) {
            showError('Failed to create call: ' + (result?.error || 'Unknown error'));
            return;
        }
        currentRoom = result;
        await joinCall(result.url);
    } catch (error) {
        console.error('❌ Error starting new call:', error);
        showError(error.message);
    }
}

// Join an existing call
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

        console.log('🔧 Creating Daily iframe...');
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

        console.log('🔌 Joining call with URL:', url);
        
        callFrame.join({
            url: url,
            startVideoOff: true,
            startAudioOff: false
        });

        // Successfully joined
        callFrame.on('joined-meeting', (event) => {
            console.log('✅ Successfully joined call:', event);
            document.getElementById('callLoading').style.display = 'none';
            document.getElementById('callContainer').style.display = 'block';
            document.getElementById('callError').style.display = 'none';
        });

        // 🔥 CRITICAL: NO AUTO REDIRECT - Just show ended message
        callFrame.on('left-meeting', (event) => {
            console.log('👋 Call ended - showing end screen', event);
            showCallEnded();
        });

        // Handle errors
        callFrame.on('error', (error) => {
            console.error('❌ Call error:', error);
            showError('Connection failed: ' + (error.errorMsg || 'Unknown error'));
        });

        // Handle participant events
        callFrame.on('participant-left', (event) => {
            console.log('👤 Participant left:', event);
            if (event && event.participant && event.participant.user_name) {
                showTemporaryMessage(`${event.participant.user_name} left the call`);
            }
        });

        callFrame.on('participant-joined', (event) => {
            console.log('👤 Participant joined:', event);
            if (event && event.participant && event.participant.user_name) {
                showTemporaryMessage(`${event.participant.user_name} joined the call`);
            }
        });

        callFrame.on('participant-updated', (event) => {
            console.log('👤 Participant updated:', event);
        });

        setupCallControls();

    } catch (error) {
        console.error('❌ Failed to join call:', error);
        showError('Failed to join call: ' + error.message);
    }
}

// 🔥 SHOW CALL ENDED - NO AUTO REDIRECT
function showCallEnded() {
    console.log('📱 Showing call ended screen - NO AUTO REDIRECT');
    
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = 'Call ended';
    
    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
            console.log('👆 User manually clicked close button');
            window.location.href = '/pages/home/friends/index.html';
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
            console.log('👆 User clicked end call button');
            if (callFrame) {
                callFrame.leave();
            } else {
                showCallEnded();
            }
        });
    }
}

// Show error
function showError(message) {
    console.error('❌ Error:', message);
    
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
    
    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            console.log('👆 User manually clicked close from error');
            window.location.href = '/pages/home/friends/index.html';
        };
    }
}

// Show temporary message
function showTemporaryMessage(message) {
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 0.9rem;
        z-index: 2000;
        animation: fadeInOut 3s ease;
    `;
    msg.textContent = message;
    document.body.appendChild(msg);
    
    setTimeout(() => {
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 3000);
    }, 3000);
}

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -20px); }
        10% { opacity: 1; transform: translate(-50%, 0); }
        90% { opacity: 1; transform: translate(-50%, 0); }
        100% { opacity: 0; transform: translate(-50%, -20px); }
    }
`;
document.head.appendChild(style);

// Block any automatic redirects
window.addEventListener('beforeunload', (e) => {
    console.log('⚠️ Page is unloading - this should only happen on manual navigation');
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initCallPage);