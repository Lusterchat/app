console.log("📞 Call Page Loaded - DEBUG VERSION");

let supabase;
let callService;
let currentCallId = null;
let isSpeakerMode = false;
let isMuted = false;

// ==================== DEBUG UTILITIES ====================
window.debugTools = {
    async checkDatabase() {
        console.group("🔍 DATABASE DEBUG");
        
        if (!supabase) {
            console.error("❌ No supabase client");
            return;
        }

        if (!currentCallId) {
            console.error("❌ No current call ID");
            return;
        }

        try {
            console.log("📋 Fetching call from database...");
            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', currentCallId)
                .single();

            if (error) {
                console.error("❌ Database error:", error);
            } else if (!call) {
                console.error("❌ Call not found in database");
            } else {
                console.log("✅ Call found:", {
                    id: call.id,
                    room_id: call.room_id,
                    status: call.status,
                    audio_mode: call.audio_mode,
                    updated_at: call.updated_at,
                    caller_id: call.caller_id,
                    receiver_id: call.receiver_id
                });
                
                // Show in toast
                showToast(`DB: ${call.audio_mode} | ${call.status}`);
            }
        } catch (error) {
            console.error("❌ Debug check failed:", error);
        }
        
        console.groupEnd();
    },

    checkCallService() {
        console.group("🔍 CALL SERVICE DEBUG");
        
        if (!callService) {
            console.error("❌ No call service");
        } else {
            console.log("✅ Call service exists");
            console.log("📊 Current call:", callService.getCurrentCall());
            console.log("🔊 Speaker mode:", callService.getSpeakerMode());
            console.log("🎤 Mute state:", callService.getMuteState());
        }
        
        console.groupEnd();
    },

    checkAudioElements() {
        console.group("🔍 AUDIO ELEMENTS DEBUG");
        
        const localAudio = document.getElementById('localAudio');
        const remoteAudio = document.getElementById('remoteAudio');
        
        console.log("🎤 Local audio:", {
            exists: !!localAudio,
            hasStream: localAudio?.srcObject ? "YES" : "NO",
            paused: localAudio?.paused,
            volume: localAudio?.volume,
            playsinline: localAudio?.getAttribute('playsinline')
        });
        
        console.log("🔊 Remote audio:", {
            exists: !!remoteAudio,
            hasStream: remoteAudio?.srcObject ? "YES" : "NO",
            paused: remoteAudio?.paused,
            volume: remoteAudio?.volume,
            playsinline: remoteAudio?.getAttribute('playsinline')
        });
        
        console.groupEnd();
    },

    runAllChecks() {
        console.log("🔍 RUNNING ALL DEBUG CHECKS");
        this.checkCallService();
        this.checkAudioElements();
        setTimeout(() => this.checkDatabase(), 500);
    }
};

// ==================== MAIN INITIALIZATION ====================
async function initCallPage() {
    console.log("🚀 INITIALIZING CALL PAGE...");

    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    const friendName = urlParams.get('name');
    const callParam = urlParams.get('call') || urlParams.get('call_id');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callType = urlParams.get('type') || 'voice';

    currentCallId = callParam;
    
    console.log("📊 URL Parameters:", {
        friendId,
        friendName,
        currentCallId,
        isIncoming,
        callType
    });

    // Store globally
    window.friendId = friendId;
    window.isIncoming = isIncoming;
    window.currentCallId = currentCallId;

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

    // Update UI
    updateCallUI(friendName);

    // Initialize call service
    try {
        const module = await import('/app/utils/callService.js');
        callService = module.default;
        window.globalCallService = callService;
        
        await callService.initialize(user.id);
        console.log("✅ Call service initialized");

        // Setup callbacks
        callService.setOnCallStateChange(handleCallStateChange);
        callService.setOnRemoteStream(handleRemoteStream);
        callService.setOnCallEvent(handleCallEvent);
        callService.setOnSpeakerModeChange(handleSpeakerModeChange);

        // Start appropriate call flow
        if (isIncoming && currentCallId) {
            console.log("📲 INCOMING CALL FLOW");
            document.getElementById('callStatus').textContent = 'Incoming call...';
            setupIncomingCallControls();
        } else if (friendId) {
            console.log("📤 OUTGOING CALL FLOW");
            document.getElementById('callStatus').textContent = 'Calling...';
            startOutgoingCall(friendId, callType);
        } else {
            showError("No call information provided");
        }

        // Start debug monitoring
        startDebugMonitor();

    } catch (error) {
        console.error("❌ Call setup failed:", error);
        showError("Call setup failed: " + error.message);
    }
}

function updateCallUI(friendName) {
    if (friendName) {
        document.getElementById('callerName').textContent = friendName;
        document.getElementById('callerAvatar').textContent = friendName.charAt(0).toUpperCase();
    }
}

// ==================== CALL FLOWS ====================
function startOutgoingCall(friendId, type) {
    console.log("📤 Starting outgoing call to:", friendId);
    
    const controls = document.getElementById('callControls');
    controls.innerHTML = createCallControls();
    
    // Add debug button
    const debugBtn = document.createElement('button');
    debugBtn.innerHTML = '<i class="fas fa-bug"></i>';
    debugBtn.className = 'control-btn debug-btn';
    debugBtn.style.background = 'linear-gradient(45deg, #9c27b0, #673ab7)';
    debugBtn.onclick = () => window.debugTools.runAllChecks();
    controls.appendChild(debugBtn);

    // Start the call
    callService.initiateCall(friendId, type)
        .then(call => {
            console.log("✅ Call started successfully:", call);
            window.currentCallId = call.id;
            showToast('Call connected!');
        })
        .catch(error => {
            console.error("❌ Call failed:", error);
            showError("Call failed: " + error.message);
        });
}

function setupIncomingCallControls() {
    console.log("📲 Setting up incoming call controls");
    
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn accept-btn" onclick="window.answerCall()">
            <i class="fas fa-phone"></i>
            <span>Answer</span>
        </button>
        <button class="control-btn decline-btn" onclick="window.declineCall()">
            <i class="fas fa-phone-slash"></i>
            <span>Decline</span>
        </button>
        <button class="control-btn debug-btn" onclick="window.debugTools.runAllChecks()" style="background: linear-gradient(45deg, #9c27b0, #673ab7);">
            <i class="fas fa-bug"></i>
        </button>
    `;
}

function createCallControls() {
    return `
        <button class="control-btn speaker-btn" id="speakerBtn" onclick="window.toggleSpeaker()">
            <i class="fas fa-headphones"></i>
            <span class="speaker-label">Speaker</span>
        </button>
        <button class="control-btn mute-btn" id="muteBtn" onclick="window.toggleMute()">
            <i class="fas fa-microphone"></i>
        </button>
        <button class="control-btn end-btn" onclick="window.endCall()">
            <i class="fas fa-phone-slash"></i>
        </button>
    `;
}

// ==================== GLOBAL FUNCTIONS ====================
window.answerCall = async function() {
    console.log("📞 ANSWER CALL clicked");
    
    if (!callService || !currentCallId) {
        showError("Call service not ready");
        return;
    }

    try {
        document.getElementById('callStatus').textContent = 'Answering...';
        
        await callService.answerCall(currentCallId);
        
        // Switch to active call controls
        const controls = document.getElementById('callControls');
        controls.innerHTML = createCallControls();
        
        showToast('Call answered!');
        
    } catch (error) {
        console.error("❌ Answer call failed:", error);
        showError("Failed to answer: " + error.message);
    }
};

window.declineCall = async function() {
    console.log("❌ DECLINE CALL clicked");
    
    if (supabase && currentCallId) {
        try {
            await supabase
                .from('calls')
                .update({ 
                    status: 'rejected',
                    ended_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentCallId);
            console.log("✅ Call rejected in database");
        } catch (error) {
            console.error("❌ Decline failed:", error);
        }
    }
    
    window.history.back();
};

window.toggleSpeaker = async function() {
    console.log("🔊 TOGGLE SPEAKER button clicked");
    
    if (!callService) {
        console.error("❌ No call service");
        showToast('Call service not ready');
        return;
    }

    // Check current state
    const currentSpeakerMode = callService.getSpeakerMode();
    console.log("📊 Current speaker mode:", currentSpeakerMode);
    
    // Show loading state
    const speakerBtn = document.getElementById('speakerBtn');
    if (speakerBtn) {
        speakerBtn.style.opacity = '0.7';
        speakerBtn.disabled = true;
    }

    try {
        console.log("🔄 Calling toggleSpeakerMode()...");
        const newMode = await callService.toggleSpeakerMode();
        
        console.log("✅ Toggle returned new mode:", newMode);
        
        // Update UI
        updateSpeakerUI(newMode);
        
        // Check database after update
        setTimeout(() => {
            window.debugTools.checkDatabase();
        }, 300);
        
        showToast(newMode ? '🔊 Speaker ON' : '🎧 Earpiece ON');
        
    } catch (error) {
        console.error("❌ Toggle speaker failed:", error);
        showToast('❌ Failed to toggle speaker');
    } finally {
        if (speakerBtn) {
            speakerBtn.style.opacity = '1';
            speakerBtn.disabled = false;
        }
    }
};

function updateSpeakerUI(speakerOn) {
    const speakerBtn = document.getElementById('speakerBtn');
    if (!speakerBtn) return;

    const speakerIcon = speakerBtn.querySelector('i');
    const speakerLabel = speakerBtn.querySelector('.speaker-label');

    if (speakerOn) {
        // Speaker ON - Loudspeaker mode
        speakerIcon.className = 'fas fa-volume-up';
        speakerLabel.textContent = 'Speaker ON';
        speakerBtn.style.background = 'linear-gradient(45deg, #4cd964, #5ac8fa)';
        speakerBtn.style.boxShadow = '0 0 15px rgba(76, 217, 100, 0.4)';
        console.log("🎨 UI: Speaker ON (green)");
    } else {
        // Speaker OFF - Earpiece mode
        speakerIcon.className = 'fas fa-headphones';
        speakerLabel.textContent = 'Speaker';
        speakerBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        speakerBtn.style.boxShadow = 'none';
        console.log("🎨 UI: Speaker OFF (gray)");
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
                muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                muteBtn.style.background = 'linear-gradient(45deg, #ff9500, #ff5e3a)';
                muteBtn.style.boxShadow = '0 0 10px rgba(255, 149, 0, 0.4)';
                showToast('🔇 Microphone Muted');
            } else {
                muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                muteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                muteBtn.style.boxShadow = 'none';
                showToast('🎤 Microphone Unmuted');
            }
        }
    } catch (error) {
        console.error("❌ Toggle mute failed:", error);
        showToast('❌ Failed to toggle mute');
    }
};

window.endCall = async function() {
    console.log("📞 END CALL clicked");
    
    if (callService) {
        try {
            await callService.endCall();
        } catch (error) {
            console.error("❌ Error ending call:", error);
        }
    }

    document.getElementById('callStatus').textContent = 'Call ended';
    showToast('📞 Call ended');

    setTimeout(() => {
        window.history.back();
    }, 1500);
};

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
            break;
        case 'connecting':
            statusEl.textContent = 'Connecting...';
            break;
        case 'active':
            statusEl.textContent = 'Connected';
            if (timerEl) {
                timerEl.style.display = 'block';
                startCallTimer();
            }
            showToast('✅ Call connected!');
            break;
        case 'disconnected':
            statusEl.textContent = 'Disconnected';
            showToast('❌ Connection lost');
            break;
        case 'ending':
            statusEl.textContent = 'Ending...';
            break;
    }
}

function handleRemoteStream(stream) {
    console.log("🔊 Remote stream received event");
    
    const audio = document.getElementById('remoteAudio');
    if (!audio) {
        console.error("❌ No remote audio element");
        return;
    }

    console.log("🎧 Setting remote audio stream");
    audio.srcObject = stream;
    audio.volume = 1.0;
    audio.muted = false;
    
    // Set initial to earpiece mode
    audio.setAttribute('playsinline', 'true');
    
    console.log("▶️ Attempting to play audio...");
    audio.play()
        .then(() => {
            console.log("✅ Audio playing successfully");
            showToast('Audio connected!');
            updateAudioStatus();
        })
        .catch(error => {
            console.log("⚠️ Audio play failed (normal on mobile):", error.name);
            showAudioHelp();
        });
}

function handleSpeakerModeChange(speakerMode) {
    console.log("🔊 Speaker mode changed callback:", speakerMode);
    isSpeakerMode = speakerMode;
    
    // Update UI immediately
    updateSpeakerUI(speakerMode);
    
    console.log("✅ UI updated for speaker mode:", speakerMode);
}

function handleCallEvent(event, data) {
    console.log("📞 Call event:", event, data);
    
    if (event === 'call_ended') {
        document.getElementById('callStatus').textContent = 'Call ended';
        showToast('📞 Call ended');
        
        setTimeout(() => {
            window.history.back();
        }, 1500);
    }
}

// ==================== HELPER FUNCTIONS ====================
function showAudioHelp() {
    console.log("🆘 Showing audio help");
    
    const existing = document.getElementById('audioHelp');
    if (existing) existing.remove();

    const help = document.createElement('div');
    help.id = 'audioHelp';
    help.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 15px;
        border-radius: 15px;
        text-align: center;
        z-index: 9999;
        max-width: 300px;
        border: 2px solid #667eea;
        backdrop-filter: blur(10px);
    `;
    help.innerHTML = `
        <p style="margin: 0 0 10px 0; font-size: 14px;">Tap anywhere to enable audio</p>
        <button onclick="window.enableAudio()" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        ">Enable Audio</button>
    `;

    document.body.appendChild(help);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (help.parentNode) help.remove();
    }, 5000);
}

window.enableAudio = function() {
    console.log("🔊 Enable audio clicked");
    
    const audio = document.getElementById('remoteAudio');
    if (audio) {
        audio.play()
            .then(() => {
                console.log("✅ Audio enabled");
                showToast('Audio enabled!');
            })
            .catch(e => console.log("⚠️ Audio still blocked:", e.name));
    }
    
    const helpEl = document.getElementById('audioHelp');
    if (helpEl) helpEl.remove();
    
    const overlay = document.getElementById('audioHelpOverlay');
    if (overlay) overlay.style.display = 'none';
};

function updateAudioStatus() {
    const audio = document.getElementById('remoteAudio');
    const dot = document.getElementById('audioStatusDot');
    const text = document.getElementById('audioStatusText');
    const indicator = document.getElementById('audioIndicator');

    if (!audio) return;

    if (audio.srcObject) {
        const stream = audio.srcObject;
        const tracks = stream.getAudioTracks();
        
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
            text.textContent = 'Audio: Active';
            dot.style.background = '#4cd964';
            if (indicator) indicator.style.background = '#4cd964';
        } else {
            text.textContent = 'Audio: No stream';
            dot.style.background = '#ff3b30';
            if (indicator) indicator.style.background = '#ff3b30';
        }
    } else {
        text.textContent = 'Audio: Connecting...';
        dot.style.background = '#ff9500';
        if (indicator) indicator.style.background = '#ff9500';
    }
}

function startDebugMonitor() {
    // Update audio status every 2 seconds
    setInterval(updateAudioStatus, 2000);
    
    // Log state every 10 seconds
    setInterval(() => {
        console.log("📊 Periodic state check:", {
            callService: !!callService,
            currentCallId,
            hasRemoteAudio: !!document.getElementById('remoteAudio')?.srcObject,
            speakerMode: callService?.getSpeakerMode()
        });
    }, 10000);
}

let callTimerInterval = null;
function startCallTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('callTimer');
    if (!timerEl) return;

    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
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
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 12px 24px;
        border-radius: 20px;
        z-index: 9999;
        font-size: 13px;
        text-align: center;
        animation: fadeInOut 3s ease-in-out;
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        font-weight: 500;
        max-width: 80%;
        word-wrap: break-word;
    `;
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

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', initCallPage);

window.addEventListener('beforeunload', () => {
    if (callService) {
        callService.endCall();
    }
    
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
    }
});

// Add click handler for audio enabling
document.addEventListener('click', function() {
    const audio = document.getElementById('remoteAudio');
    if (audio && audio.paused && audio.srcObject) {
        audio.play().catch(() => {});
    }
    
    const overlay = document.getElementById('audioHelpOverlay');
    if (overlay) overlay.style.display = 'none';
});