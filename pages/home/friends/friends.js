// friends.js - WITH FULL REAL-TIME INCOMING CALL SUPPORT
// WORKS WITH EXISTING AUTH SYSTEM

import { initializeSupabase } from '../../../utils/supabase.js';
import { createCallRoom } from '../../../utils/daily.js';
import { initRealtime, updateCallStatus, checkExistingCalls, cleanupRealtime } from '../../../utils/realtime.js';

let supabaseInstance = null;
let currentUser = null;
let allFriends = [];
let filteredFriends = [];
let currentIncomingCall = null;
let callRingtone = null;
let ringtoneInterval = null;

// Initialize with Supabase wait
async function initFriendsPage() {
    console.log('📱 Loading friends page...');

    try {
        // Initialize Supabase
        supabaseInstance = await initializeSupabase();

        if (!supabaseInstance || !supabaseInstance.auth) {
            throw new Error('Supabase not initialized');
        }

        // Get current session
        const { data: { session }, error } = await supabaseInstance.auth.getSession();

        if (error) throw error;

        if (!session) {
            console.log('No session found, redirecting to login');
            window.location.href = '../../../pages/login/index.html';
            return;
        }

        currentUser = session.user;
        console.log('✅ Logged in as:', currentUser.email);

        // Load friends
        await loadFriends();

        // Create ringtone
        createRingtone();

        // Initialize real-time call listener
        await initRealtime(handleIncomingCall);
        
        // Check for any missed calls that are still ringing
        await checkForMissedCalls();

        // Hide loading indicator
        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.classList.add('hidden');

    } catch (error) {
        console.error('❌ Init error:', error);
        showError('Failed to load friends: ' + error.message);
    }
}

// Create ringtone using Web Audio API
function createRingtone() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const audioCtx = new AudioContext();
            
            // Create oscillator and gain node
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // 440 Hz = A note
            
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start();
            
            // Ringtone pattern: beep, pause, beep, pause
            callRingtone = {
                play: () => {
                    // Resume audio context if suspended
                    if (audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                    
                    let count = 0;
                    ringtoneInterval = setInterval(() => {
                        if (count % 2 === 0) {
                            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                        } else {
                            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                        }
                        count++;
                        
                        // Stop after 30 seconds
                        if (count > 60) {
                            clearInterval(ringtoneInterval);
                            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                        }
                    }, 500);
                },
                pause: () => {
                    if (ringtoneInterval) {
                        clearInterval(ringtoneInterval);
                        ringtoneInterval = null;
                    }
                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                }
            };
        } else {
            // Fallback if Web Audio not supported
            callRingtone = { 
                play: () => console.log('Ringtone would play'), 
                pause: () => console.log('Ringtone would stop') 
            };
        }
    } catch (e) {
        console.log('Ringtone creation failed:', e);
        callRingtone = { play: () => {}, pause: () => {} };
    }
}

// Check for missed calls
async function checkForMissedCalls() {
    const existingCall = await checkExistingCalls();
    if (existingCall) {
        console.log('📞 Found existing ringing call:', existingCall);
        
        // Get caller info
        const { data: caller } = await supabaseInstance
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', existingCall.caller_id)
            .single();
        
        handleIncomingCall({
            ...existingCall,
            caller_name: caller?.username || 'Unknown',
            caller_avatar: caller?.avatar_url
        });
    }
}

// Handle incoming call
async function handleIncomingCall(callData) {
    console.log('📞 INCOMING CALL:', callData);
    
    // Don't show if we're already in a call
    if (currentIncomingCall) {
        console.log('Already have an incoming call, ignoring');
        return;
    }
    
    // Store current call
    currentIncomingCall = callData;
    
    // Play ringtone
    if (callRingtone) {
        try {
            callRingtone.play();
        } catch (e) {
            console.log('Could not play ringtone:', e);
        }
    }
    
    // Show modal
    const modal = document.getElementById('incomingCallModal');
    const callerNameEl = document.getElementById('callerName');
    const callerAvatarEl = document.getElementById('callerAvatar');
    
    if (modal && callerNameEl) {
        callerNameEl.textContent = callData.caller_name || 'Unknown';
        
        // Update avatar if available
        if (callData.caller_avatar && callerAvatarEl) {
            callerAvatarEl.innerHTML = `<img src="${callData.caller_avatar}" alt="caller" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        } else {
            callerAvatarEl.innerHTML = '<i class="fas fa-user"></i>';
        }
        
        modal.style.display = 'flex';
        
        // Auto-decline after 30 seconds
        setTimeout(() => {
            if (modal.style.display === 'flex' && currentIncomingCall) {
                declineCall(true); // true = missed
            }
        }, 30000);
    }
}

// Accept incoming call
window.acceptCall = async function() {
    if (!currentIncomingCall) return;
    
    try {
        console.log('✅ Accepting call:', currentIncomingCall);
        
        // Stop ringtone
        if (callRingtone) {
            callRingtone.pause();
        }
        
        // Update call status
        await updateCallStatus(currentIncomingCall.id, 'accepted');
        
        // Hide modal
        document.getElementById('incomingCallModal').style.display = 'none';
        
        // Show loading toast
        showToast('info', 'Connecting call...');
        
        // Navigate to call page
        window.location.href = `/pages/call/index.html?room=${encodeURIComponent(currentIncomingCall.room_url)}&friend=${encodeURIComponent(currentIncomingCall.caller_name)}`;
        
        // Clear current call
        currentIncomingCall = null;
        
    } catch (error) {
        console.error('❌ Error accepting call:', error);
        showToast('error', 'Failed to accept call');
    }
};

// Decline incoming call
window.declineCall = async function(isMissed = false) {
    if (!currentIncomingCall) return;
    
    try {
        console.log('❌ Declining call:', currentIncomingCall);
        
        // Stop ringtone
        if (callRingtone) {
            callRingtone.pause();
        }
        
        // Update call status
        await updateCallStatus(currentIncomingCall.id, isMissed ? 'missed' : 'declined');
        
        // Hide modal
        document.getElementById('incomingCallModal').style.display = 'none';
        
        // Show toast
        showToast('info', isMissed ? 'Call missed' : 'Call declined');
        
        // Clear current call
        currentIncomingCall = null;
        
    } catch (error) {
        console.error('❌ Error declining call:', error);
    }
};

// Load friends
async function loadFriends() {
    try {
        if (!currentUser || !supabaseInstance) return;

        const { data: friendsData, error: friendsError } = await supabaseInstance
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        if (friendsError) throw friendsError;

        if (!friendsData || friendsData.length === 0) {
            showEmptyState();
            return;
        }

        const friendIds = friendsData.map(f => f.friend_id);

        const { data: profiles, error: profilesError } = await supabaseInstance
            .from('profiles')
            .select('id, username, avatar_url, status, last_seen')
            .in('id', friendIds)
            .order('username');

        if (profilesError) throw profilesError;

        allFriends = profiles || [];
        filteredFriends = [...allFriends];
        renderFriendsList();

    } catch (error) {
        console.error('Load error:', error);
        showEmptyState();
    }
}

// Render friends list
function renderFriendsList() {
    const container = document.getElementById('friendsList');
    if (!container) return;

    if (!filteredFriends || filteredFriends.length === 0) {
        showEmptyState();
        return;
    }

    let html = '';

    filteredFriends.forEach(friend => {
        const initial = friend.username ? friend.username.charAt(0).toUpperCase() : '?';
        const online = friend.status === 'online';
        const lastSeen = friend.last_seen ? formatLastSeen(friend.last_seen) : 'Never';

        html += `
            <div class="friend-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border-radius: 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
                
                <!-- Avatar (click to chat) -->
                <div class="friend-avatar" onclick="openChat('${friend.id}', '${friend.username}')" style="cursor: pointer; width: 50px; height: 50px; background: linear-gradient(45deg, #007acc, #00b4d8); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 600; color: white; position: relative;">
                    ${friend.avatar_url 
                        ? `<img src="${friend.avatar_url}" alt="${friend.username}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                        : `<span style="color:white; font-size:1.2rem; font-weight:600;">${initial}</span>`
                    }
                    <span style="position: absolute; bottom: 3px; right: 3px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; ${online ? 'background: #28a745;' : 'background: #888888;'}"></span>
                </div>
                
                <!-- Friend Info (click to chat) -->
                <div onclick="openChat('${friend.id}', '${friend.username}')" style="flex: 1; cursor: pointer;">
                    <div style="font-size: 1rem; font-weight: 600; color: #1e293b; margin-bottom: 4px;">${friend.username || 'User'}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">
                        ${online ? 'Online' : `Last seen ${lastSeen}`}
                    </div>
                </div>
                
                <!-- CALL BUTTON -->
                <button class="call-friend-btn" onclick="startCall('${friend.id}', '${friend.username}')" style="background: #22c55e; border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(34, 197, 94, 0.3);">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Start a call
window.startCall = async function(friendId, friendName) {
    try {
        console.log('📞 Starting call to:', friendName);

        if (!supabaseInstance) {
            showToast('error', 'Service not ready. Please refresh.');
            return;
        }

        if (!currentUser) {
            showToast('error', 'Please login first');
            return;
        }

        showToast('info', `Calling ${friendName}...`);

        // Create Daily.co room
        const roomResult = await createCallRoom();

        if (!roomResult?.success) {
            showToast('error', 'Failed to create call: ' + (roomResult?.error || 'Unknown error'));
            return;
        }

        console.log('✅ Room created:', roomResult.url);

        // Save to Supabase calls table
        const { data, error } = await supabaseInstance
            .from('calls')
            .insert({
                caller_id: currentUser.id,
                receiver_id: friendId,
                room_url: roomResult.url,
                status: 'ringing',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Database error:', error);
            if (error.code === '42P01') {
                showToast('error', 'Calls table not created in Supabase');
            } else {
                showToast('error', 'Failed to initiate call: ' + error.message);
            }
            return;
        }

        console.log('✅ Call saved to database:', data);
        
        // Store call data in sessionStorage for pre-loading
        sessionStorage.setItem('preload_call', JSON.stringify({
            roomUrl: roomResult.url,
            friendName: friendName,
            timestamp: Date.now()
        }));
        
        // Navigate to call page
        window.location.href = `/pages/call/index.html?room=${encodeURIComponent(roomResult.url)}&friend=${encodeURIComponent(friendName)}`;

    } catch (error) {
        console.error('❌ Call error:', error);
        showToast('error', 'Failed to start call: ' + error.message);
    }
};

// Format last seen
function formatLastSeen(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 60000);

    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
    return time.toLocaleDateString();
}

// Search friends
window.searchFriends = function() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    if (!input) return;

    const term = input.value.toLowerCase().trim();

    if (clearBtn) clearBtn.style.display = term ? 'flex' : 'none';

    filteredFriends = term 
        ? allFriends.filter(f => f.username?.toLowerCase().includes(term))
        : [...allFriends];

    renderFriendsList();
};

// Clear search
window.clearSearch = function() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        window.searchFriends();
    }
};

// Show empty state
function showEmptyState() {
    const container = document.getElementById('friendsList');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3>No friends yet</h3>
            <p>Add friends to start chatting and calling</p>
            <button class="add-friends-btn" onclick="openSearch()">
                <i class="fas fa-user-plus"></i> Add Friends
            </button>
        </div>
    `;
}

// Show error
function showError(message) {
    const container = document.getElementById('friendsList');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">❌</div>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="add-friends-btn" onclick="location.reload()">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;
}

// Open chat
window.openChat = function(friendId, friendName) {
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendName
    }));
    window.location.href = `../../chats/index.html?friendId=${friendId}`;
};

// Search users

window.searchUsers = async function() {
    if (!supabaseInstance || !currentUser) {
        console.log('Waiting for Supabase...');
        return;
    }

    const input = document.getElementById('userSearchInput');
    const container = document.getElementById('searchResults');
    if (!input || !container) return;

    const term = input.value.toLowerCase().trim();

    if (!term) {
        container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-search" style="font-size:2rem;color:#cbd5e1;margin-bottom:10px;"></i><p>Search for friends to add</p></div>`;
        return;
    }

    try {
        const { data: friends } = await supabaseInstance
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        const friendIds = friends?.map(f => f.friend_id) || [];

        const { data: pending } = await supabaseInstance
            .from('friend_requests')
            .select('receiver_id')
            .eq('sender_id', currentUser.id)
            .eq('status', 'pending');

        const pendingIds = pending?.map(r => r.receiver_id) || [];

        const { data: users, error } = await supabaseInstance
            .from('profiles')
            .select('id, username, avatar_url')
            .neq('id', currentUser.id)
            .ilike('username', `%${term}%`)
            .limit(20);

        if (error) throw error;

        if (!users || users.length === 0) {
            container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-user-slash" style="font-size:2rem;color:#cbd5e1;margin-bottom:10px;"></i><p>No users found</p></div>`;
            return;
        }

        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const isPending = pendingIds.includes(user.id);
            const initial = user.username?.charAt(0).toUpperCase() || '?';

            html += `
                <div class="search-result-item">
                    <div class="search-result-avatar" style="background: linear-gradient(45deg, #007acc, #00b4d8);">
                        ${user.avatar_url 
                            ? `<img src="${user.avatar_url}" alt="${user.username}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                            : `<span style="color:white; font-size:1.2rem; font-weight:600;">${initial}</span>`
                        }
                    </div>
                    <div class="search-result-info">
                        <div class="search-result-name">${user.username}</div>
                        <div class="search-result-username">@${user.username}</div>
                    </div>
                    ${isFriend 
                        ? '<button class="add-friend-btn added" disabled>✓ Friends</button>'
                        : isPending
                        ? '<button class="add-friend-btn added" disabled>⏳ Sent</button>'
                        : `<button class="add-friend-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">+ Add</button>`
                    }
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i><p>Error searching users</p></div>`;
    }
};

// Send friend request
window.sendFriendRequest = async function(userId, username, btn) {
    try {
        btn.disabled = true;
        btn.textContent = 'Sending...';

        const { error } = await supabaseInstance
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: userId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        if (error) throw error;

        btn.textContent = '✓ Sent';
        btn.classList.add('added');
        showToast('success', `Friend request sent to ${username}`);

    } catch (error) {
        console.error('Request error:', error);
        btn.disabled = false;
        btn.textContent = '+ Add';
        showToast('error', 'Failed to send request');
    }
};

// Toast
function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = type === 'success' ? 'check-circle' : (type === 'info' ? 'info-circle' : 'exclamation-circle');
    let color = type === 'success' ? '#22c55e' : (type === 'info' ? '#3b82f6' : '#ef4444');

    toast.innerHTML = `
        <i class="fas fa-${icon}" style="color:${color};"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Navigation
window.goToHome = () => window.location.href = '../../home/index.html';
window.openSearch = () => {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('userSearchInput')?.focus(), 100);
    }
};
window.closeModal = () => {
    document.getElementById('searchModal').style.display = 'none';
};
window.logout = async () => {
    if (supabaseInstance) await supabaseInstance.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '../../../pages/login/index.html';
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (callRingtone) {
        callRingtone.pause();
    }
    cleanupRealtime();
});

// Add event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initFriendsPage();
    
    // Add call button handlers
    const acceptBtn = document.getElementById('acceptCallBtn');
    const declineBtn = document.getElementById('declineCallBtn');
    
    if (acceptBtn) {
        acceptBtn.addEventListener('click', acceptCall);
    }
    
    if (declineBtn) {
        declineBtn.addEventListener('click', () => declineCall(false));
    }
});