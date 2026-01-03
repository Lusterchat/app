import callService from 'app/utils/callService.js';
import { supabase } from 'app/utils/supabase.js';

let currentUser = null;
let incomingCallData = null;

// Initialize
async function init() {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('Please login first');
        window.location.href = '../auth/index.html';
        return;
    }
    
    currentUser = user;
    
    // Initialize call service
    await callService.initialize(user.id);
    
    // Setup callbacks
    callService.setOnCallStateChange((state) => {
        updateCallUI(state);
    });
    
    callService.setOnRemoteStream((stream) => {
        const remoteAudio = document.getElementById('remoteAudio');
        remoteAudio.srcObject = stream;
    });
    
    // Listen for incoming calls
    setupIncomingCallListener();
}

// Start voice call
async function startVoiceCall() {
    const friendId = document.getElementById('friendId').value.trim();
    if (!friendId) {
        alert('Please enter friend ID');
        return;
    }
    
    try {
        showCallUI('ringing');
        await callService.initiateCall(friendId, 'voice');
    } catch (error) {
        console.error('Call failed:', error);
        alert('Call failed: ' + error.message);
        hideCallUI();
    }
}

// Start video call
async function startVideoCall() {
    const friendId = document.getElementById('friendId').value.trim();
    if (!friendId) {
        alert('Please enter friend ID');
        return;
    }
    
    try {
        showCallUI('ringing');
        await callService.initiateCall(friendId, 'video');
    } catch (error) {
        console.error('Video call failed:', error);
        alert('Video call failed: ' + error.message);
        hideCallUI();
    }
}

// Answer incoming call
async function answerCall() {
    if (!incomingCallData) return;
    
    hideIncomingCall();
    showCallUI('connecting');
    
    try {
        await callService.answerCall(incomingCallData.id);
    } catch (error) {
        console.error('Failed to answer:', error);
        alert('Failed to answer call');
        hideCallUI();
    }
}

// Reject incoming call
async function rejectCall() {
    if (!incomingCallData) return;
    
    await supabase
        .from('calls')
        .update({ status: 'rejected' })
        .eq('id', incomingCallData.id);
    
    hideIncomingCall();
}

// End current call
async function endCall() {
    await callService.endCall();
    hideCallUI();
}

// Toggle mute
async function toggleMute() {
    const isMuted = await callService.toggleMute();
    const muteBtn = document.getElementById('muteBtn');
    muteBtn.innerHTML = isMuted ? '🔈' : '🔇';
}

// Toggle video
async function toggleVideo() {
    const isVideoOn = await callService.toggleVideo();
    const videoBtn = document.getElementById('videoBtn');
    videoBtn.innerHTML = isVideoOn ? '📹' : '📷';
}

// UI Functions
function showCallUI(state) {
    document.getElementById('callUI').style.display = 'block';
    document.getElementById('callStatus').textContent = 
        state === 'ringing' ? 'Calling...' :
        state === 'connecting' ? 'Connecting...' :
        state === 'active' ? 'Call Active' : 'Call Ended';
    
    // Start timer if active
    if (state === 'active') {
        startTimer();
    }
}

function hideCallUI() {
    document.getElementById('callUI').style.display = 'none';
    stopTimer();
}

function showIncomingCall(callData) {
    incomingCallData = callData;
    document.getElementById('incomingCall').style.display = 'block';
    
    // Get caller name
    supabase
        .from('users')
        .select('username, full_name')
        .eq('id', callData.caller_id)
        .single()
        .then(({ data }) => {
            document.getElementById('callerName').textContent = 
                data?.full_name || data?.username || 'Unknown';
        });
}

function hideIncomingCall() {
    document.getElementById('incomingCall').style.display = 'none';
    incomingCallData = null;
}

// Timer
let timerInterval;
function startTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('callTimer');
    
    timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerEl.textContent = 
            `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    document.getElementById('callTimer').textContent = '00:00';
}

// Incoming call listener
function setupIncomingCallListener() {
    supabase
        .channel('calls-channel')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            const call = payload.new;
            if (call.status === 'ringing') {
                showIncomingCall(call);
            }
        })
        .subscribe();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);