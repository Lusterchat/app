console.log("📞 Call Page Loaded - RECEIVER FIXED VERSION");

let supabase;
let callService;
let signalingManager;
let currentCallId = null;
let isSpeakerMode = false;
let isMuted = false;
let isIncomingCall = false;
let friendName = "Caller";
let friendId = null;

// ==================== INITIALIZATION ====================
async function initCallPage() {
    console.log("🚀 INITIALIZING CALL PAGE (Receiver Fix)...");

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    friendId = urlParams.get('friend');
    friendName = urlParams.get('name') || "Caller";
    const callIdParam = urlParams.get('call') || urlParams.get('call_id');
    isIncomingCall = urlParams.get('incoming') === 'true';
    const callType = urlParams.get('type') || 'voice';

    console.log("📊 URL Parameters:", {
        friendId,
        friendName,
        callIdParam,
        isIncomingCall,
        callType
    });

    // Validate we have enough info
    if (!callIdParam && !friendId) {
        showError("No call information provided");
        setTimeout(() => window.history.back(), 3000);
        return;
    }

    // Store globally
    currentCallId = callIdParam;
    window.currentCallId = currentCallId;
    window.friendId = friendId;
    window.isIncomingCall = isIncomingCall;

    // Initialize Supabase
    try {
        const module = await import('/app/utils/supabase.js');
        supabase = module.supabase;
        window.globalSupabase = supabase;
        console.log("✅ Supabase initialized");
    } catch (error) {
        console.error("❌ Supabase init failed:", error);
        showError("Database connection failed");
        return;
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        showError("Please log in to make calls");
        setTimeout(() => window.location.href = '/app/pages/login/index.html', 2000);
        return;
    }

    console.log("👤 Current user:", user.id);

    // Update UI immediately
    updateCallerUI();

    // Initialize services
    await initializeServices(user.id);

    // Setup appropriate call flow
    if (isIncomingCall && currentCallId) {
        console.log("📲 RECEIVER: Incoming call flow");
        await handleIncomingCall();
    } else if (friendId) {
        console.log("📤 CALLER: Outgoing call flow");
        await handleOutgoingCall(friendId, callType);
    } else {
        showError("Cannot start call: missing parameters");
    }
}

async function initializeServices(userId) {
    try {
        // Initialize Call Service
        const callModule = await import('/app/utils/callService.js');
        callService = callModule.default;
        window.globalCallService = callService;
        
        await callService.initialize(userId);
        console.log("✅ Call service initialized");

        // Setup callbacks
        callService.setOnCallStateChange(handleCallStateChange);
        callService.setOnRemoteStream(handleRemoteStream);
        callService.setOnCallEvent(handleCallEvent);
        callService.setOnSpeakerModeChange(handleSpeakerModeChange);

        // Initialize Signaling
        const signalingModule = await import('/app/utils/signaling.js');
        signalingManager = signalingModule.default;
        window.globalSignalingManager = signalingManager;
        
        await signalingManager.initialize(userId);
        console.log("✅ Signaling initialized");

    } catch (error) {
        console.error("❌ Service initialization failed:", error);
        throw error;
    }
}

function updateCallerUI() {
    const callerNameEl = document.getElementById('callerName');
    const callerAvatarEl = document.getElementById('callerAvatar');
    
    if (callerNameEl) {
        callerNameEl.textContent = friendName;
        // Prevent text overflow
        callerNameEl.style.whiteSpace = 'nowrap';
        callerNameEl.style.overflow = 'hidden';
        callerNameEl.style.textOverflow = 'ellipsis';
    }
    
    if (callerAvatarEl) {
        callerAvatarEl.textContent = friendName.charAt(0).toUpperCase();
    }
}

// ==================== INCOMING CALL HANDLER (RECEIVER) ====================
async function handleIncomingCall() {
    console.log("📲 Processing incoming call...");
    
    if (!currentCallId) {
        showError("No call ID provided");
        return;
    }

    // Show incoming call UI
    document.getElementById('callStatus').textContent = 'Incoming call...';
    document.getElementById('callerAvatar').classList.add('ringing-animation');
    
    setupIncomingCallControls();

    try {
        // 1. Fetch call details from database
        console.log("📋 Fetching call details for:", currentCallId);
        const { data: call, error } = await supabase
            .from('calls')
            .select('*')
            .eq('id', currentCallId)
            .single();

        if (error) {
            console.error("❌ Call not found:", error);
            showError("Call not found");
            return;
        }

        console.log("✅ Call found:", {
            id: call.id,
            status: call.status,
            caller_id: call.caller_id,
            audio_mode: call.audio_mode
        });

        // Update friend info if needed
        if (call.caller_id && !friendId) {
            friendId = call.caller_id;
            // You might want to fetch the caller's name here
        }

        // 2. Setup signaling subscription
        await signalingManager.subscribeToCall(currentCallId, {
            onOffer: async (offer, senderId) => {
                console.log("📥 Received SDP offer");
                // Store offer for when user answers
            },
            onIceCandidate: async (candidate, senderId) => {
                console.log("🧊 Received ICE candidate");
                // Will be processed when we answer
            },
            onCallEnded: (call) => {
                console.log("📞 Caller ended the call");
                if (call.status === 'ended' || call.status === 'missed') {
                    showCallEnded("Call ended by other party");
                }
            }
        });

        // 3. Monitor call status changes
        monitorCallStatus();

    } catch (error) {
        console.error("❌ Incoming call setup failed:", error);
        showError("Failed to setup call: " + error.message);
    }
}

function setupIncomingCallControls() {
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn accept-btn" onclick="window.answerIncomingCall()">
            <i class="fas fa-phone"></i>
            <span>Answer</span>
        </button>
        <button class="control-btn decline-btn" onclick="window.declineIncomingCall()">
            <i class="fas fa-phone-slash"></i>
            <span>Decline</span>
        </button>
        <button class="control-btn debug-btn" onclick="window.runDebugChecks()">
            <i class="fas fa-bug"></i>
            <span>Debug</span>
        </button>
    `;
}

// ==================== OUTGOING CALL HANDLER (CALLER) ====================
async function handleOutgoingCall(friendId, callType) {
    console.log("📤 Starting outgoing call to:", friendId);
    
    document.getElementById('callStatus').textContent = 'Calling...';
    
    setupOutgoingCallControls();

    try {
        // Start the call
        const call = await callService.initiateCall(friendId, callType);
        currentCallId = call.id;
        window.currentCallId = currentCallId;
        
        console.log("✅ Outgoing call started:", call);
        
        // Setup signaling for this call
        await signalingManager.subscribeToCall(currentCallId, {
            onAnswer: async (answer, senderId) => {
                console.log("📥 Received answer from receiver");
                // This should be handled by callService
            },
            onIceCandidate: async (candidate, senderId) => {
                console.log("🧊 Received ICE candidate from receiver");
                if (callService && callService.peerConnection) {
                    try {
                        await callService.peerConnection.addIceCandidate(candidate);
                        console.log("✅ Added ICE candidate");
                        updateConnectionStatus('ICE candidate exchanged');
                    } catch (error) {
                        console.error("❌ Failed to add ICE candidate:", error);
                    }
                }
            },
            onCallEnded: (call) => {
                console.log("📞 Receiver ended the call");
                showCallEnded("Call ended by other party");
            }
        });

        showToast('Calling...');

    } catch (error) {
        console.error("❌ Outgoing call failed:", error);
        showError("Call failed: " + error.message);
    }
}

function setupOutgoingCallControls() {
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn speaker-btn" id="speakerBtn" onclick="window.toggleSpeaker()">
            <i class="fas fa-headphones"></i>
            <span>Speaker</span>
        </button>
        <button class="control-btn mute-btn" id="muteBtn" onclick="window.toggleMute()">
            <i class="fas fa-microphone"></i>
            <span>Mute</span>
        </button>
        <button class="control-btn end-btn" onclick="window.endCall()">
            <i class="fas fa-phone-slash"></i>
            <span>End</span>
        </button>
        <button class="control-btn debug-btn" onclick="window.runDebugChecks()">
            <i class="fas fa-bug"></i>
            <span>Debug</span>
        </button>
    `;
}

// ==================== GLOBAL FUNCTIONS ====================
window.answerIncomingCall = async function() {
    console.log("📞 ANSWERING INCOMING CALL...");
    
    if (!callService || !currentCallId) {
        showError("Call service not ready");
        return;
    }

    try {
        // Update UI
        document.getElementById('callStatus').textContent = 'Answering...';
        document.getElementById('callerAvatar').classList.remove('ringing-animation');
        
        // Hide loading message
        const loadingEl = document.getElementById('loadingMessage');
        if (loadingEl) loadingEl.style.display = 'none';
        
        // Answer the call
        await callService.answerCall(currentCallId);
        
        // Switch to active call controls
        setupActiveCallControls();
        
        showToast('Call answered!');
        updateConnectionStatus('Connected');
        
    } catch (error) {
        console.error("❌ Answer call failed:", error);
        showError("Failed to answer: " + error.message);
    }
};

window.declineIncomingCall = async function() {
    console.log("❌ DECLINING INCOMING CALL...");
    
    if (signalingManager && currentCallId) {
        try {
            await signalingManager.updateCallStatus(currentCallId, 'rejected');
            console.log("✅ Call rejected in database");
        } catch (error) {
            console.error("❌ Decline failed:", error);
        }
    }
    
    window.history.back();
};

window.toggleSpeaker = async function() {
    console.log("🔊 TOGGLE SPEAKER clicked");
    
    if (!callService) {
        console.error("❌ No call service");
        showToast('Call service not ready');
        return;
    }

    try {
        const speakerBtn = document.getElementById('speakerBtn');
        if (speakerBtn) speakerBtn.style.opacity = '0.7';
        
        const newMode = await callService.toggleSpeakerMode();
        isSpeakerMode = newMode;
        
        updateSpeakerUI(isSpeakerMode);
        showToast(isSpeakerMode ? '🔊 Speaker ON' : '🎧 Earpiece ON');
        
    } catch (error) {
        console.error("❌ Toggle speaker failed:", error);
        showToast('❌ Failed to toggle speaker');
    } finally {
        const speakerBtn = document.getElementById('speakerBtn');
        if (speakerBtn) speakerBtn.style.opacity = '1';
    }
};

function updateSpeakerUI(speakerOn) {
    const speakerBtn = document.getElementById('speakerBtn');
    if (!speakerBtn) return;

    if (speakerOn) {
        speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i><span>Speaker ON</span>';
        speakerBtn.classList.add('active');
    } else {
        speakerBtn.innerHTML = '<i class="fas fa-headphones"></i><span>Speaker</span>';
        speakerBtn.classList.remove('active');
    }
}

window.toggleMute = async function() {
    if (!callService) {
        console.error("❌ No call service");
        return;
    }

    try {
        const isMuted = await callService.toggleMute();
        const muteBtn = document.getElementById('muteBtn');

        if (muteBtn) {
            if (isMuted) {
                muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Muted</span>';
                muteBtn.style.background = 'linear-gradient(45deg, #ff9500, #ff5e3a)';
                showToast('🔇 Microphone Muted');
            } else {
                muteBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Mute</span>';
                muteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                showToast('🎤 Microphone Unmuted');
            }
        }
    } catch (error) {
        console.error("❌ Toggle mute failed:", error);
        showToast('❌ Failed to toggle mute');
    }
};

window.endCall = async function() {
    console.log("📞 ENDING CALL...");
    
    if (callService) {
        try {
            await callService.endCall();
        } catch (error) {
            console.error("❌ Error ending call:", error);
        }
    }

    showCallEnded("Call ended");
};

function setupActiveCallControls() {
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn speaker-btn" id="speakerBtn" onclick="window.toggleSpeaker()">
            <i class="fas fa-headphones"></i>
            <span>Speaker</span>
        </button>
        <button class="control-btn mute-btn" id="muteBtn" onclick="window.toggleMute()">
            <i class="fas fa-microphone"></i>
            <span>Mute</span>
        </button>
        <button class="control-btn end-btn" onclick="window.endCall()">
            <i class="fas fa-phone-slash"></i>
            <span>End</span>
        </button>
        <button class="control-btn debug-btn" onclick="window.runDebugChecks()">
            <i class="fas fa-bug"></i>
            <span>Debug</span>
        </button>
    `;
}

// ==================== EVENT HANDLERS ====================
function handleCallStateChange(state) {
    console.log("📊 Call state changed:", state);
    
    const statusEl = document.getElementById('callStatus');
    const timerEl = document.getElementById('callTimer');
    const loadingEl = document.getElementById('loadingMessage');

    if (loadingEl) loadingEl.style.display = 'none';

    switch(state) {
        case 'ringing':
            statusEl.textContent = 'Ringing...';
            updateConnectionStatus('Ringing...');
            break;
        case 'connecting':
            statusEl.textContent = 'Connecting...';
            updateConnectionStatus('Establishing connection...');
            break;
        case 'active':
            statusEl.textContent = 'Connected';
            updateConnectionStatus('Connected ✓');
            if (timerEl) {
                timerEl.style.display = 'block';
                startCallTimer();
            }
            showToast('✅ Call connected!');
            break;
        case 'disconnected':
            statusEl.textContent = 'Disconnected';
            updateConnectionStatus('Disconnected ✗', 'error');
            showToast('❌ Connection lost');
            break;
    }
}

function handleRemoteStream(stream) {
    console.log("🔊 Remote stream received");
    
    const audio = document.getElementById('remoteAudio');
    if (!audio) {
        console.error("❌ No remote audio element");
        return;
    }

    console.log("🎧 Setting remote audio stream");
    audio.srcObject = stream;
    audio.volume = 1.0;
    
    // Set initial to earpiece mode
    audio.setAttribute('playsinline', 'true');
    
    // Try to play audio
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log("✅ Audio playing successfully");
                updateConnectionStatus('Audio connected ✓');
            })
            .catch(error => {
                console.log("⚠️ Audio play blocked:", error.name);
                // Show help overlay
                document.getElementById('audioHelpOverlay').style.display = 'flex';
            });
    }
}

function handleSpeakerModeChange(speakerMode) {
    console.log("🔊 Speaker mode changed:", speakerMode);
    isSpeakerMode = speakerMode;
    updateSpeakerUI(speakerMode);
}

function handleCallEvent(event, data) {
    console.log("📞 Call event:", event, data);
    
    if (event === 'call_ended') {
        showCallEnded('Call ended');
    }
}

// ==================== HELPER FUNCTIONS ====================
function updateConnectionStatus(message, type = 'normal') {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = 'connection-status';
    
    if (type === 'error') {
        statusEl.classList.add('error');
    } else if (type === 'warning') {
        statusEl.classList.add('warning');
    }
}

function monitorCallStatus() {
    if (!currentCallId || !supabase) return;
    
    // Monitor call status changes via Supabase realtime
    const channel = supabase.channel(`call-status-${currentCallId}`);
    
    channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${currentCallId}`
    }, (payload) => {
        const call = payload.new;
        console.log("📱 Call status updated:", call.status);
        
        if (call.status === 'ended' || call.status === 'missed') {
            showCallEnded("Call ended");
        }
    });
    
    channel.subscribe();
}

function showCallEnded(message) {
    console.log("📞 Call ended:", message);
    
    document.getElementById('callStatus').textContent = message;
    document.getElementById('callTimer').style.display = 'none';
    
    // Clear any ringing animation
    const avatar = document.getElementById('callerAvatar');
    if (avatar) avatar.classList.remove('ringing-animation');
    
    showToast(message);
    
    setTimeout(() => {
        window.history.back();
    }, 2000);
}

function startCallTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('callTimer');
    if (!timerEl) return;

    window.callTimerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function showToast(message) {
    const existing = document.getElementById('toastNotification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

function showError(message) {
    console.error("❌ ERROR:", message);
    
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }

    document.getElementById('callStatus').textContent = 'Error';
    const loadingEl = document.getElementById('loadingMessage');
    if (loadingEl) loadingEl.style.display = 'none';

    showToast('❌ ' + message);
}

// ==================== DEBUG FUNCTIONS ====================
window.runDebugChecks = async function() {
    console.group("🔍 DEBUG CHECKS");
    
    console.log("📊 Current State:", {
        currentCallId,
        isIncomingCall,
        friendId,
        friendName,
        callService: !!callService,
        signalingManager: !!signalingManager
    });
    
    // Check database
    if (supabase && currentCallId) {
        try {
            const { data: call, error } = await supabase
                .from('calls')
                .select('id, status, audio_mode, caller_id, receiver_id')
                .eq('id', currentCallId)
                .single();
                
            if (error) {
                console.error("❌ Database error:", error);
            } else {
                console.log("✅ Call in database:", call);
                showToast(`DB: ${call.status} | ${call.audio_mode}`);
            }
        } catch (error) {
            console.error("❌ Debug check failed:", error);
        }
    }
    
    // Check audio elements
    const remoteAudio = document.getElementById('remoteAudio');
    const localAudio = document.getElementById('localAudio');
    console.log("🎧 Audio Elements:", {
        remoteAudio: remoteAudio ? {
            hasStream: !!remoteAudio.srcObject,
            paused: remoteAudio.paused,
            readyState: remoteAudio.readyState
        } : 'Not found',
        localAudio: localAudio ? {
            hasStream: !!localAudio.srcObject,
            paused: localAudio.paused
        } : 'Not found'
    });
    
    console.groupEnd();
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', initCallPage);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.callTimerInterval) {
        clearInterval(window.callTimerInterval);
    }
    
    if (callService) {
        callService.endCall();
    }
});

// Global audio enable function
window.enableAudio = function() {
    const audio = document.getElementById('remoteAudio');
    if (audio) {
        audio.play()
            .then(() => {
                console.log("✅ Audio enabled");
                document.getElementById('audioHelpOverlay').style.display = 'none';
            })
            .catch(e => console.log("⚠️ Audio still blocked:", e));
    }
};