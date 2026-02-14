// pages/call-app/utils/callListener.js - Listen for incoming calls

let supabase = null
let currentUser = null
let callSubscription = null
let audioPlayer = null
let notificationShowing = false

// Initialize call listener
export function initCallListener(supabaseClient, user) {
    supabase = supabaseClient
    currentUser = user
    
    console.log('📞 Initializing call listener for:', user.username)
    
    setupRingtone()
    setupIncomingCallListener()
    checkForExistingCalls()
}

// Setup simple ringtone
function setupRingtone() {
    try {
        audioPlayer = new Audio()
        audioPlayer.loop = true
        audioPlayer.volume = 0.5
        // Simple beep sound (base64 encoded minimal WAV)
        audioPlayer.src = 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAA8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PA=='
    } catch (e) {
        console.log('Ringtone setup failed:', e)
    }
}

// Play ringtone
function playRingtone() {
    if (audioPlayer) {
        audioPlayer.play().catch(e => console.log('Audio play failed:', e))
    }
}

// Stop ringtone
function stopRingtone() {
    if (audioPlayer) {
        audioPlayer.pause()
        audioPlayer.currentTime = 0
    }
}

// Setup realtime listener for incoming calls
function setupIncomingCallListener() {
    if (!supabase || !currentUser) return
    
    console.log('Setting up call listener for user:', currentUser.id)
    
    callSubscription = supabase
        .channel(`calls:${currentUser.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 Incoming call detected!', payload.new)
            
            if (payload.new.status === 'ringing') {
                handleIncomingCall(payload.new)
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('Call updated:', payload.new.status)
            
            if (payload.new.status === 'cancelled' || payload.new.status === 'ended') {
                hideIncomingCallNotification()
                stopRingtone()
            }
        })
        .subscribe((status) => {
            console.log('Call listener status:', status)
        })
}

// Check for existing ringing calls
async function checkForExistingCalls() {
    try {
        const { data: calls } = await supabase
            .from('calls')
            .select('*')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'ringing')
            .order('created_at', { ascending: false })
            .limit(1)
        
        if (calls && calls.length > 0) {
            console.log('Found existing ringing call')
            handleIncomingCall(calls[0])
        }
    } catch (error) {
        console.error('Error checking existing calls:', error)
    }
}

// Handle incoming call
async function handleIncomingCall(call) {
    // Don't show if already on call page
    if (window.location.pathname.includes('/call/')) {
        return
    }
    
    // Don't show duplicate notifications
    if (notificationShowing) return
    
    // Get caller info
    const caller = await getCallerInfo(call.caller_id)
    
    showIncomingCallNotification(call, caller)
    playRingtone()
    
    // Store in session storage
    sessionStorage.setItem('incomingCall', JSON.stringify({
        id: call.id,
        roomName: call.room_name,
        callerId: call.caller_id,
        callerName: caller?.username || 'Unknown'
    }))
}

// Get caller information
async function getCallerInfo(callerId) {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single()
        
        return data || { username: 'Unknown', avatar_url: null }
    } catch (error) {
        return { username: 'Unknown', avatar_url: null }
    }
}

// Show incoming call notification
function showIncomingCallNotification(call, caller) {
    hideIncomingCallNotification()
    notificationShowing = true
    
    const notification = document.createElement('div')
    notification.id = 'incomingCallNotification'
    notification.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #0066cc;
        color: white;
        padding: 16px 20px;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `
    
    // Add animation
    const style = document.createElement('style')
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
    `
    document.head.appendChild(style)
    
    const avatar = caller?.avatar_url 
        ? `<img src="${caller.avatar_url}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid white;">`
        : `<div style="width: 44px; height: 44px; border-radius: 50%; background: white; color: #0066cc; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold;">${caller?.username?.charAt(0).toUpperCase() || '?'}</div>`
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
            ${avatar}
            <div>
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">${caller?.username || 'Incoming Call'}</div>
                <div style="font-size: 13px; opacity: 0.9;">🔊 Incoming voice call...</div>
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="acceptCallBtn" style="background: white; border: none; color: #28a745; width: 44px; height: 44px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;">
                <i class="fas fa-phone-alt"></i>
            </button>
            <button id="declineCallBtn" style="background: white; border: none; color: #dc3545; width: 44px; height: 44px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-phone-slash"></i>
            </button>
        </div>
    `
    
    document.body.prepend(notification)
    
    // Add event listeners
    document.getElementById('acceptCallBtn').addEventListener('click', async () => {
        stopRingtone()
        hideIncomingCallNotification()
        
        // Update call status
        await supabase
            .from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', call.id)
        
        // Navigate to call page
        window.location.href = `pages/call/index.html?incoming=true&room=${call.room_name}&callerId=${call.caller_id}&callId=${call.id}`
    })
    
    document.getElementById('declineCallBtn').addEventListener('click', async () => {
        stopRingtone()
        hideIncomingCallNotification()
        
        await supabase
            .from('calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', call.id)
        
        sessionStorage.removeItem('incomingCall')
    })
}

// Hide notification
function hideIncomingCallNotification() {
    const existing = document.getElementById('incomingCallNotification')
    if (existing) {
        existing.remove()
        notificationShowing = false
    }
}

// Clean up
export function cleanupCallListener() {
    stopRingtone()
    if (callSubscription) {
        callSubscription.unsubscribe()
    }
    hideIncomingCallNotification()
}