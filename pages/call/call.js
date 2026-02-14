// pages/call/call.js - COMPLETE FIXED VERSION

import { initializeSupabase } from '../../utils/supabase.js';
import { createCallRoom, getRoomInfo } from '../../utils/daily.js';
import { cleanupCallListener } from '../../utils/callListener.js';

let supabase = null;
let currentUser = null;
let currentCall = null;
let dailyIframe = null;
let callRoom = null;
let callType = 'outgoing';
let callerInfo = null;
let callSubscription = null;

// Initialize call page
async function initCallPage() {
    console.log('Initializing call page...');

    cleanupCallListener();

    try {
        supabase = await initializeSupabase();

        if (!supabase || !supabase.auth) {
            throw new Error('Supabase not initialized');
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session) {
            window.location.href = '../../pages/login/index.html';
            return;
        }

        currentUser = session.user;
        console.log('✅ User:', currentUser.email);

        // Get call parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');
        const roomName = urlParams.get('room');
        const incoming = urlParams.get('incoming');
        const callerId = urlParams.get('callerId');
        const callId = urlParams.get('callId');

        console.log('URL Parameters:', { friendId, roomName, incoming, callerId, callId });

        if (incoming === 'true' && roomName && callerId && callId) {
            // Incoming call
            callType = 'incoming';
            await handleIncomingCall(roomName, callerId, callId);
        } else if (friendId) {
            // Outgoing call
            callType = 'outgoing';
            await startOutgoingCall(friendId);
        } else {
            // Check sessionStorage for backup
            const storedCall = sessionStorage.getItem('currentCall');
            if (storedCall) {
                const data = JSON.parse(storedCall);
                console.log('Found stored call:', data);
                if (data.friendId) {
                    await startOutgoingCall(data.friendId);
                    return;
                }
            }
            showError('No call information provided');
        }

    } catch (error) {
        console.error('Init error:', error);
        showError('Failed to initialize call: ' + error.message);
    }
}

// Start an outgoing call
async function startOutgoingCall(friendId) {
    try {
        document.getElementById('loadingText').textContent = 'Calling...';

        // Get friend info
        const { data: friend, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', friendId)
            .single();

        if (error || !friend) {
            throw new Error('Could not find friend');
        }

        callerInfo = friend;

        // Create Daily.co room
        console.log('1️⃣ Creating Daily.co room...');
        callRoom = await createCallRoom();
        console.log('2️⃣ Room created:', callRoom);

        // Insert call into database
        console.log('3️⃣ Inserting call into Supabase...');

        const callData = {
            caller_id: currentUser.id,
            receiver_id: friendId,
            room_name: callRoom.name,
            room_url: callRoom.url,
            status: 'ringing',
            created_at: new Date().toISOString()
        };

        const { data: call, error: callError } = await supabase
            .from('calls')
            .insert([callData])
            .select()
            .single();

        if (callError) {
            console.error('❌ Failed to insert call:', callError);
            throw new Error('Failed to create call: ' + callError.message);
        }

        console.log('4️⃣ ✅ Call inserted:', call);

        currentCall = call;

        // Store in sessionStorage
        sessionStorage.setItem('currentCall', JSON.stringify({
            id: call.id,
            roomName: call.room_name,
            friendId: friendId
        }));

        // Hide loading, show calling UI
        document.getElementById('loadingScreen').style.display = 'none';
        showOutgoingUI(friend);
        setupCallListener(call.id);

    } catch (error) {
        console.error('Call start error:', error);
        showError(error.message);
    }
}

// Handle incoming call
async function handleIncomingCall(roomName, callerId, callId) {
    try {
        document.getElementById('loadingText').textContent = 'Connecting...';

        const { data: caller, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', callerId)
            .single();

        if (error || !caller) {
            throw new Error('Could not find caller');
        }

        callerInfo = caller;
        currentCall = { id: callId, room_name: roomName };

        // Update call status to active
        const { error: updateError } = await supabase
            .from('calls')
            .update({ 
                status: 'active',
                answered_at: new Date().toISOString()
            })
            .eq('id', callId);

        if (updateError) {
            console.error('Failed to update call:', updateError);
        }

        document.getElementById('loadingScreen').style.display = 'none';
        
        // Show incoming UI briefly
        showIncomingUI(caller);
        
        // Auto-join after 1 second
        setTimeout(() => {
            joinCall();
        }, 1000);

    } catch (error) {
        console.error('Incoming call error:', error);
        showError('Failed to handle incoming call: ' + error.message);
    }
}

// Show incoming UI
function showIncomingUI(caller) {
    const incomingScreen = document.getElementById('incomingCallScreen');
    if (incomingScreen) {
        document.getElementById('callerName').textContent = caller.username || 'Unknown';
        
        const avatarEl = document.getElementById('callerAvatar');
        if (caller.avatar_url) {
            avatarEl.innerHTML = `<img src="${caller.avatar_url}" alt="${caller.username}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border: 3px solid #007acc;">`;
        } else {
            avatarEl.innerHTML = '<i class="fas fa-user-circle"></i>';
        }
        
        incomingScreen.style.display = 'flex';
    }
}

// Show outgoing UI
function showOutgoingUI(friend) {
    const outgoingScreen = document.createElement('div');
    outgoingScreen.className = 'incoming-call-screen';
    outgoingScreen.id = 'outgoingCallScreen';
    outgoingScreen.innerHTML = `
        <div class="incoming-call-content">
            <div class="caller-avatar">
                ${friend.avatar_url 
                    ? `<img src="${friend.avatar_url}" alt="${friend.username}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border: 3px solid #007acc;">`
                    : `<i class="fas fa-user-circle" style="font-size:120px; color:#007acc;"></i>`
                }
            </div>
            <div class="caller-info">
                <h2>${friend.username}</h2>
                <p id="callStatusText">Calling...</p>
            </div>
            <div class="call-actions">
                <button class="call-btn decline-btn" onclick="cancelCall()">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(outgoingScreen);
}

// Setup call listener
function setupCallListener(callId) {
    console.log('Setting up call listener for call ID:', callId);

    callSubscription = supabase
        .channel(`call-${callId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${callId}`
        }, (payload) => {
            console.log('Call update received:', payload);

            if (payload.new.status === 'active' && !dailyIframe) {
                document.getElementById('callStatusText').textContent = 'Connecting...';
                joinCall();
            } else if (payload.new.status === 'rejected') {
                showCallEnded('Call was rejected');
            } else if (payload.new.status === 'ended') {
                if (dailyIframe) {
                    window.location.href = '../../pages/home/index.html';
                }
            } else if (payload.new.status === 'cancelled') {
                showCallEnded('Call was cancelled');
            }
        })
        .subscribe();

    window.callSubscription = callSubscription;
    checkCallStatus(callId);
}

// Check call status
async function checkCallStatus(callId) {
    const { data: call, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

    if (error) {
        console.error('Error checking call status:', error);
        return;
    }

    console.log('Current call status:', call);

    if (call && call.status === 'active') {
        joinCall();
    }
}

// Accept incoming call
window.acceptCall = async function() {
    try {
        document.getElementById('incomingCallScreen').style.display = 'none';
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('loadingText').textContent = 'Connecting...';

        const { error } = await supabase
            .from('calls')
            .update({ 
                status: 'active',
                answered_at: new Date().toISOString()
            })
            .eq('id', currentCall.id);

        if (error) throw error;

        await joinCall();

    } catch (error) {
        console.error('Accept error:', error);
        showError('Failed to accept call');
    }
};

// Decline incoming call
window.declineCall = async function() {
    try {
        await supabase
            .from('calls')
            .update({ 
                status: 'rejected',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentCall.id);

        window.location.href = '../../pages/home/index.html';

    } catch (error) {
        console.error('Decline error:', error);
        window.location.href = '../../pages/home/index.html';
    }
};

// Cancel outgoing call
window.cancelCall = async function() {
    try {
        await supabase
            .from('calls')
            .update({ 
                status: 'cancelled',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentCall.id);

        window.location.href = '../../pages/home/index.html';

    } catch (error) {
        console.error('Cancel error:', error);
        window.location.href = '../../pages/home/index.html';
    }
};

// Join the call
async function joinCall() {
    try {
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('loadingText').textContent = 'Joining call...';

        document.getElementById('incomingCallScreen')?.style.display = 'none';
        document.getElementById('outgoingCallScreen')?.remove();

        const roomName = currentCall.room_name;
        console.log('Joining room:', roomName);

        const roomInfo = await getRoomInfo(roomName);
        if (!roomInfo) {
            throw new Error('Could not find call room');
        }

        console.log('Room info:', roomInfo);

        const container = document.getElementById('dailyContainer');

        const iframe = document.createElement('iframe');
        iframe.allow = 'microphone; autoplay; playinline';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.background = '#000';

        const dailyUrl = new URL(roomInfo.url);
        dailyUrl.searchParams.set('t', '');
        dailyUrl.searchParams.set('dn', currentUser.user_metadata?.username || 'User');
        dailyUrl.searchParams.set('video', '0');
        dailyUrl.searchParams.set('audio', '1');
        dailyUrl.searchParams.set('chrome', '0');
        dailyUrl.searchParams.set('embed', '1');

        iframe.src = dailyUrl.toString();
        console.log('Daily URL:', dailyUrl.toString());

        container.innerHTML = '';
        container.appendChild(iframe);
        dailyIframe = iframe;

        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('activeCallScreen').style.display = 'block';

        setupAudioHandling();

    } catch (error) {
        console.error('Join error:', error);
        showError('Failed to join call: ' + error.message);
    }
}

// Setup audio handling
function setupAudioHandling() {
    let isMuted = false;
    let isSpeakerOn = true;

    window.toggleMute = function() {
        isMuted = !isMuted;
        const muteBtn = document.getElementById('muteBtn');

        if (isMuted) {
            muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            muteBtn.classList.add('muted');
        } else {
            muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            muteBtn.classList.remove('muted');
        }
    };

    window.toggleSpeaker = function() {
        isSpeakerOn = !isSpeakerOn;
        const speakerBtn = document.getElementById('speakerBtn');

        if (!isSpeakerOn) {
            speakerBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            speakerBtn.classList.add('speaker-off');
        } else {
            speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            speakerBtn.classList.remove('speaker-off');
        }
    };

    window.endCall = async function() {
        try {
            await supabase
                .from('calls')
                .update({ 
                    status: 'ended',
                    ended_at: new Date().toISOString()
                })
                .eq('id', currentCall.id);

            window.location.href = '../../pages/home/index.html';

        } catch (error) {
            console.error('End call error:', error);
            window.location.href = '../../pages/home/index.html';
        }
    };
}

// Show call ended
function showCallEnded(message) {
    document.getElementById('outgoingCallScreen')?.remove();

    const endedScreen = document.createElement('div');
    endedScreen.className = 'incoming-call-screen';
    endedScreen.innerHTML = `
        <div class="incoming-call-content">
            <div class="caller-avatar">
                <i class="fas fa-phone-slash" style="font-size:120px; color:#dc3545;"></i>
            </div>
            <div class="caller-info">
                <h2>Call Ended</h2>
                <p style="color: #999; margin-bottom: 30px;">${message}</p>
            </div>
            <button class="back-home-btn" onclick="window.location.href='../../pages/home/index.html'" style="background: #007acc; color: white; border: none; padding: 15px 30px; border-radius: 30px; font-size: 1.1rem; display: inline-flex; align-items: center; gap: 10px; cursor: pointer;">
                <i class="fas fa-arrow-left"></i> Go Back
            </button>
        </div>
    `;
    document.body.appendChild(endedScreen);
}

// Show error
function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
}

// Go back
window.goBack = function() {
    window.location.href = '../../pages/home/index.html';
};

// Clean up
window.addEventListener('beforeunload', () => {
    if (window.callSubscription) {
        window.callSubscription.unsubscribe();
    }
});

// Start
document.addEventListener('DOMContentLoaded', initCallPage);