// utils/callListener.js - FINAL PRODUCTION VERSION

import { initializeSupabase, supabase as supabaseClient } from './supabase.js';

let supabase = null;
let currentUser = null;
let callSubscription = null;
let audioPlayer = null;

// Initialize call listener
export async function initCallListener() {
    console.log('📞 Initializing call listener...');
    
    try {
        supabase = await initializeSupabase();
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            console.log('No session found');
            return;
        }
        
        currentUser = session.user;
        console.log('📞 Call listener initialized for:', currentUser.email);
        
        setupRingtone();
        setupIncomingCallListener();
        
    } catch (error) {
        console.error('Call listener error:', error);
    }
}

// Setup ringtone
function setupRingtone() {
    try {
        audioPlayer = new Audio();
        audioPlayer.loop = true;
        audioPlayer.volume = 0.5;
        audioPlayer.src = 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAA8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PA==';
    } catch (e) {
        console.log('Ringtone setup failed:', e);
    }
}

// Play ringtone
function playRingtone() {
    if (audioPlayer) {
        audioPlayer.play().catch(e => console.log('Audio play failed:', e));
    }
}

// Stop ringtone
function stopRingtone() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
}

// Setup incoming call listener
function setupIncomingCallListener() {
    callSubscription = supabase
        .channel('incoming-calls')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 Incoming call detected!');
            handleIncomingCall(payload.new);
        })
        .subscribe();
}

// Handle incoming call
async function handleIncomingCall(call) {
    if (window.location.pathname.includes('/call/')) {
        return;
    }
    
    const caller = await getCallerInfo(call.caller_id);
    showIncomingCallNotification(call, caller);
    playRingtone();
    
    sessionStorage.setItem('incomingCall', JSON.stringify({
        id: call.id,
        roomName: call.room_name,
        callerId: call.caller_id,
        callerName: caller?.username || 'Unknown'
    }));
}

// Get caller info
async function getCallerInfo(callerId) {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();
        return data || { username: 'Unknown', avatar_url: null };
    } catch (error) {
        return { username: 'Unknown', avatar_url: null };
    }
}

// Show incoming call notification
function showIncomingCallNotification(call, caller) {
    hideIncomingCallNotification();
    
    const notification = document.createElement('div');
    notification.id = 'incomingCallNotification';
    notification.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #1a1a1a, #000);
        color: white;
        padding: 16px 20px;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 3px solid #007acc;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const style = document.createElement('style');
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
    `;
    document.head.appendChild(style);
    
    const avatar = caller?.avatar_url 
        ? `<img src="${caller.avatar_url}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #007acc;">`
        : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #007acc; display: flex; align-items: center; justify-content: center; font-size: 24px;">📞</div>`;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
            ${avatar}
            <div>
                <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">${caller?.username || 'Incoming Call'}</div>
                <div style="color: #999; font-size: 0.9rem;">🔊 Incoming voice call...</div>
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="acceptCallBtn" style="background: #28a745; border: none; color: white; width: 48px; height: 48px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;">
                <i class="fas fa-phone-alt"></i>
            </button>
            <button id="declineCallBtn" style="background: #dc3545; border: none; color: white; width: 48px; height: 48px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-phone-slash"></i>
            </button>
        </div>
    `;
    
    document.body.prepend(notification);
    
    document.getElementById('acceptCallBtn').addEventListener('click', async () => {
        stopRingtone();
        hideIncomingCallNotification();
        
        await supabase
            .from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', call.id);
        
        window.location.href = `/pages/call/index.html?incoming=true&room=${call.room_name}&callerId=${call.caller_id}&callId=${call.id}`;
    });
    
    document.getElementById('declineCallBtn').addEventListener('click', async () => {
        stopRingtone();
        hideIncomingCallNotification();
        
        await supabase
            .from('calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', call.id);
        
        sessionStorage.removeItem('incomingCall');
    });
}

// Hide notification
function hideIncomingCallNotification() {
    const existing = document.getElementById('incomingCallNotification');
    if (existing) existing.remove();
}

// Clean up
export function cleanupCallListener() {
    stopRingtone();
    if (callSubscription) {
        callSubscription.unsubscribe();
    }
    hideIncomingCallNotification();
}

// Auto-initialize
if (!window.location.pathname.includes('/call/')) {
    document.addEventListener('DOMContentLoaded', () => {
        initCallListener();
    });
}