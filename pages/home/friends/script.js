// friends/script.js - UPDATED WITH NEW FEATURES
console.log('✨ RelayTalk Friends Page Script Loaded');

// Toast Notification System (same as home page)
class ToastNotification {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) this.createToastContainer();
    }

    createToastContainer() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.id = 'toastContainer';
        document.body.prepend(this.container);
    }

    show(options) {
        const { title = '', message = '', type = 'info', duration = 5000 } = options;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = '💬';
        switch(type) {
            case 'success': icon = '✨'; break;
            case 'error': icon = '❌'; break;
            case 'warning': icon = '⚠️'; break;
            case 'info': icon = '💬'; break;
        }

        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">
                    ${title}
                    <span class="toast-time">${time}</span>
                </div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            <div class="toast-progress">
                <div class="toast-progress-bar"></div>
            </div>
        `;

        this.container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    success(title, message = '', duration = 5000) {
        return this.show({ title, message, type: 'success', duration });
    }

    error(title, message = '', duration = 7000) {
        return this.show({ title, message, type: 'error', duration });
    }

    warning(title, message = '', duration = 6000) {
        return this.show({ title, message, type: 'warning', duration });
    }

    info(title, message = '', duration = 4000) {
        return this.show({ title, message, type: 'info', duration });
    }
}

const toast = new ToastNotification();

// Global functions
window.showToast = toast.show.bind(toast);
window.showSuccess = toast.success.bind(toast);
window.showError = toast.error.bind(toast);
window.showWarning = toast.warning.bind(toast);
window.showInfo = toast.info.bind(toast);

let currentUser = null;
let currentProfile = null;

// Wait for Supabase
async function waitForSupabase() {
    console.log('⏳ Waiting for Supabase...');

    if (window.supabase) {
        console.log('✅ Supabase already loaded');
        return true;
    }

    // Wait for it to load from the HTML script
    let attempts = 0;
    while (!window.supabase && attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
    }

    if (window.supabase) {
        console.log('✅ Supabase loaded after', attempts, 'attempts');
        return true;
    }

    console.error('❌ Supabase never loaded');
    toast.error('Cannot connect to server');
    return false;
}

// Check auth
async function checkAuth() {
    try {
        if (!window.supabase?.auth) {
            console.log('Auth not ready');
            return { success: false, message: 'Auth not ready' };
        }

        const { data, error } = await window.supabase.auth.getUser();

        if (error) {
            console.log('Auth error:', error.message);
            return { success: false, message: 'Authentication error' };
        }

        if (data.user) {
            console.log('✅ User authenticated:', data.user.email);
            return { success: true, user: data.user };
        }

        console.log('❌ No user found');
        return { success: false, message: 'Not logged in' };

    } catch (error) {
        console.error('Auth check error:', error);
        return { success: false, message: 'Auth check failed' };
    }
}

// Initialize friends page
async function initFriendsPage() {
    console.log('👥 Initializing friends page...');

    const loadingIndicator = document.getElementById('loadingIndicator');

    try {
        // Step 1: Wait for Supabase
        const supabaseReady = await waitForSupabase();
        if (!supabaseReady) {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }

        // Step 2: Check authentication
        const authResult = await checkAuth();
        if (!authResult.success) {
            console.log('User not authenticated:', authResult.message);

            toast.info('Please login to view friends');

            setTimeout(() => {
                window.location.href = '../../login/index.html';
            }, 1500);

            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }

        // Step 3: Set current user
        currentUser = authResult.user;
        console.log('✅ Current user:', currentUser.email);

        // Step 4: Load current profile
        await loadCurrentProfile();

        // Hide loading
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        // Step 5: Load friends and notifications
        await Promise.all([
            loadFriendsList(),
            updateNotificationsBadge()
        ]);

        console.log('✅ Friends page ready');

        setTimeout(() => {
            toast.success('Friends loaded successfully!');
        }, 500);

    } catch (error) {
        console.error('❌ Friends page init failed:', error);

        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        toast.error('Failed to load friends');

        // Show error state
        const container = document.getElementById('friendsContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3 class="empty-title">Connection Error</h3>
                    <p class="empty-desc">Failed to load friends. Please try again.</p>
                    <button class="search-btn" onclick="initFriendsPage()" style="margin-top: 20px;">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// Load current profile
async function loadCurrentProfile() {
    try {
        if (!currentUser || !window.supabase) {
            console.log('Cannot load profile: No user or Supabase');
            currentProfile = {
                username: currentUser?.user_metadata?.username || 'User',
                full_name: currentUser?.user_metadata?.full_name || 'User'
            };
            return;
        }

        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('Profile load error:', error.message);
            throw error;
        }

        if (profile) {
            currentProfile = profile;
            console.log('✅ Profile loaded:', profile.username);
        } else {
            currentProfile = {
                username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'User',
                full_name: currentUser.user_metadata?.full_name || 'User'
            };
            console.log('⚠️ No profile found, using default:', currentProfile.username);
        }

    } catch (error) {
        console.error('❌ Error loading profile:', error);
        currentProfile = {
            username: currentUser?.user_metadata?.username || 'User',
            full_name: currentUser?.user_metadata?.full_name || 'User'
        };
    }
}

// Load friends list
async function loadFriendsList() {
    if (!currentUser || !window.supabase) {
        showErrorState('Not logged in');
        return;
    }

    const container = document.getElementById('friendsContainer');
    if (!container) return;

    try {
        // Show loading
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⏳</div>
                <h3 class="empty-title">Loading Friends...</h3>
                <p class="empty-desc">Please wait</p>
            </div>
        `;

        // Get friend IDs
        const { data: friends, error } = await window.supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        if (error) {
            console.error('Friends load error:', error);
            showEmptyFriends();
            return;
        }

        if (!friends || friends.length === 0) {
            showEmptyFriends();
            updateTotalFriends(0);
            return;
        }

        // Get profiles for each friend
        const friendIds = friends.map(f => f.friend_id);
        const { data: profiles, error: profilesError } = await window.supabase
            .from('profiles')
            .select('id, username, status, last_seen, avatar_url')
            .in('id', friendIds);

        if (profilesError) {
            console.error('Profiles load error:', profilesError);
            showEmptyFriends();
            return;
        }

        const filteredFriends = profiles || [];
        
        // Update total friends count
        updateTotalFriends(filteredFriends.length);

        // Display friends
        if (filteredFriends.length === 0) {
            showEmptyFriends();
            return;
        }

        displayFriends(filteredFriends);

    } catch (error) {
        console.error('❌ Error loading friends:', error);
        showErrorState(error.message);
    }
}

// Display friends with larger user size
function displayFriends(friends) {
    const container = document.getElementById('friendsContainer');
    if (!container) return;

    // Sort: online first, then by name
    friends.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.username.localeCompare(b.username);
    });

    let html = '';
    friends.forEach(friend => {
        const isOnline = friend.status === 'online';
        const lastSeen = friend.last_seen ? new Date(friend.last_seen) : new Date();
        const timeAgo = getTimeAgo(lastSeen);
        const firstLetter = friend.username ? friend.username.charAt(0).toUpperCase() : '?';

        html += `
            <div class="friend-item" onclick="openChat('${friend.id}', '${friend.username}')">
                <div class="friend-avatar-large">
                    ${firstLetter}
                    <span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.username}</div>
                    <div class="friend-status">
                        ${isOnline ? 
                            '<span class="online-text">Online</span>' : 
                            `<span class="last-seen">Last seen ${timeAgo}</span>`
                        }
                    </div>
                </div>
                <div class="friend-action">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Update total friends count
function updateTotalFriends(count) {
    const totalFriends = document.getElementById('totalFriends');
    if (totalFriends) {
        totalFriends.textContent = count;
    }
}

// Show empty friends state
function showEmptyFriends() {
    const container = document.getElementById('friendsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3 class="empty-title">No Friends Yet</h3>
            <p class="empty-desc">Add friends to start chatting on RelayTalk</p>
            <button class="search-btn" onclick="openSearchModal()" style="margin-top: 20px;">
                <i class="fas fa-user-plus"></i> Find Friends
            </button>
        </div>
    `;
}

// Show error state
function showErrorState(message) {
    const container = document.getElementById('friendsContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3 class="empty-title">Connection Error</h3>
            <p class="empty-desc">${message || 'Could not load friends'}</p>
        </div>
    `;
}

// Get time ago
function getTimeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Open chat
async function openChat(friendId, friendUsername = 'Friend') {
    console.log('Opening chat with:', friendId);

    toast.info(`Opening chat with ${friendUsername}...`);

    // Store friend info
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendUsername
    }));

    // Redirect to chat page
    setTimeout(() => {
        window.location.href = `../../chats/index.html?friendId=${friendId}`;
    }, 800);
}

// Update notifications badge (same as home page)
async function updateNotificationsBadge() {
    try {
        if (!currentUser || !window.supabase) {
            console.log('Cannot update notifications: No user or Supabase');
            hideNotificationBadge();
            return;
        }

        const { data: notifications, error } = await window.supabase
            .from('friend_requests')
            .select('id')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) {
            console.log('Notifications error:', error.message);
            hideNotificationBadge();
            return;
        }

        const unreadCount = notifications?.length || 0;
        console.log('Found', unreadCount, 'notifications');

        updateBadgeDisplay(unreadCount);

    } catch (error) {
        console.error('❌ Error loading notifications:', error);
        hideNotificationBadge();
    }
}

function updateBadgeDisplay(count) {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'block';

            // Show subtle notification toast for first notification
            if (count === 1) {
                setTimeout(() => {
                    toast.info("New Notification", "You have a new friend request");
                }, 1000);
            }
        } else {
            badge.style.display = 'none';
        }
    }
}

function hideNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.style.display = 'none';
    }
}

// Search modal functions
async function loadSearchResults() {
    const container = document.getElementById('searchResults');
    if (!container || !currentUser || !window.supabase) return;

    try {
        container.innerHTML = `
            <div class="empty-state" style="padding: 30px 20px;">
                <div class="empty-icon">⏳</div>
                <p>Loading users...</p>
            </div>
        `;

        // Get all users except current user
        const { data: users, error } = await window.supabase
            .from('profiles')
            .select('id, username, full_name')
            .neq('id', currentUser.id)
            .limit(20);

        if (error) {
            console.error('Search error:', error);
            container.innerHTML = `
                <div class="empty-state" style="padding: 30px 20px;">
                    <div class="empty-icon">⚠️</div>
                    <p>Error loading users</p>
                </div>
            `;
            return;
        }

        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 30px 20px;">
                    <div class="empty-icon">👥</div>
                    <p>No users found</p>
                </div>
            `;
            return;
        }

        await displaySearchResults(users);

    } catch (error) {
        console.error('❌ Search error:', error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 30px 20px;">
                <div class="empty-icon">⚠️</div>
                <p>Search failed</p>
            </div>
        `;
    }
}

async function displaySearchResults(users) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 30px 20px;">
                <div class="empty-icon">🔍</div>
                <p>No users found</p>
            </div>
        `;
        return;
    }

    try {
        // Get current friends
        const { data: friends } = await window.supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        const friendIds = friends?.map(f => f.friend_id) || [];

        // Get pending requests
        const { data: pendingRequests } = await window.supabase
            .from('friend_requests')
            .select('receiver_id')
            .eq('sender_id', currentUser.id)
            .eq('status', 'pending');

        const pendingIds = pendingRequests?.map(r => r.receiver_id) || [];

        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const requestSent = pendingIds.includes(user.id);
            const firstLetter = user.username.charAt(0).toUpperCase();

            html += `
                <div class="search-result">
                    <div class="search-avatar" style="background: linear-gradient(45deg, #007acc, #00b4d8);">
                        ${firstLetter}
                    </div>
                    <div class="search-info">
                        <div class="search-name">${user.username}</div>
                        <div class="search-username">${user.full_name || ''}</div>
                    </div>
                    ${isFriend ? `
                        <button class="send-request-btn sent" disabled>
                            ✓ Friend
                        </button>
                    ` : requestSent ? `
                        <button class="send-request-btn sent" disabled>
                            ✓ Sent
                        </button>
                    ` : `
                        <button class="send-request-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">
                            Add Friend
                        </button>
                    `}
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Display results error:', error);
    }
}

// Send friend request (same as home page)
async function sendFriendRequest(toUserId, toUsername, button) {
    if (!currentUser || !window.supabase) {
        toast.error("Cannot send request");
        return;
    }

    // Show loading state
    if (button) {
        const originalText = button.textContent;
        button.textContent = 'Sending...';
        button.disabled = true;
    }

    try {
        // Check if request already exists
        const { data: existingRequest } = await window.supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', toUserId)
            .eq('status', 'pending')
            .maybeSingle();

        if (existingRequest) {
            toast.info("Already Sent", `You've already sent a friend request to ${toUsername}`);
            if (button) {
                button.textContent = '✓ Sent';
                setTimeout(() => {
                    button.disabled = false;
                }, 1000);
            }
            return;
        }

        // Create friend request
        const { error } = await window.supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: toUserId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error("Error sending request:", error);
            toast.error("Request Failed", "Could not send friend request");
            if (button) {
                button.textContent = 'Add Friend';
                button.disabled = false;
            }
            return;
        }

        // Update notifications badge
        updateNotificationsBadge();

        toast.success("Request Sent", `Your request has been sent to ${toUsername}!`);

        // Update button
        if (button) {
            button.textContent = '✓ Sent';
            button.disabled = true;
            button.classList.add('sent');
        }

    } catch (error) {
        console.error("❌ Friend request error:", error);
        toast.error("Request Failed", "Please check your connection");
        if (button) {
            button.textContent = 'Add Friend';
            button.disabled = false;
        }
    }
}

// Load notifications (same as home page)
async function loadNotifications() {
    const container = document.getElementById('notificationsList');

    if (!container) {
        console.error("Notifications container not found!");
        return;
    }

    try {
        if (!currentUser || !window.supabase) {
            showEmptyNotifications(container);
            return;
        }

        // Get notifications
        const { data: notifications, error } = await window.supabase
            .from('friend_requests')
            .select('id, sender_id, created_at')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Notifications error:", error.message);
            showEmptyNotifications(container);
            return;
        }

        if (!notifications || notifications.length === 0) {
            showEmptyNotifications(container);
            return;
        }

        // Get usernames for each sender
        const senderIds = notifications.map(n => n.sender_id);
        const { data: profiles } = await window.supabase
            .from('profiles')
            .select('id, username')
            .in('id', senderIds);

        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => profileMap[p.id] = p.username);
        }

        let html = '';
        notifications.forEach(notification => {
            const timeAgo = getTimeAgo(notification.created_at);
            const senderName = profileMap[notification.sender_id] || 'Unknown User';
            const firstLetter = senderName.charAt(0).toUpperCase();

            html += `
                <div class="notification-item">
                    <div class="notification-avatar" style="background: linear-gradient(45deg, #007acc, #00b4d8);">
                        ${firstLetter}
                    </div>
                    <div class="notification-content">
                        <strong>${senderName}</strong> wants to be friends
                        <small>${timeAgo}</small>
                    </div>
                    <div class="notification-actions">
                        <button class="btn-small btn-success" onclick="acceptFriendRequest('${notification.id}', '${notification.sender_id}', '${senderName}', this)">
                            ✓
                        </button>
                        <button class="btn-small btn-danger" onclick="declineFriendRequest('${notification.id}', this)">
                            ✗
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("❌ Error loading notifications:", error);
        showEmptyNotifications(container);
    }
}

function showEmptyNotifications(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔔</div>
            <p>No notifications yet</p>
        </div>
    `;
}

// Accept friend request (same as home page)
async function acceptFriendRequest(requestId, senderId, senderName = 'User', button = null) {
    console.log("Accepting request:", requestId, "from:", senderId);

    if (!currentUser || !window.supabase) {
        toast.error("Cannot accept request");
        return;
    }

    // Show loading state on button
    if (button) {
        const originalText = button.textContent;
        button.textContent = '...';
        button.disabled = true;
    }

    try {
        // Update friend request status
        const { error: updateError } = await window.supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // Add to friends table (both directions)
        await window.supabase
            .from('friends')
            .insert({
                user_id: currentUser.id,
                friend_id: senderId,
                created_at: new Date().toISOString()
            });

        await window.supabase
            .from('friends')
            .insert({
                user_id: senderId,
                friend_id: currentUser.id,
                created_at: new Date().toISOString()
            });

        // Update UI
        await loadNotifications();
        await loadFriendsList();
        await updateNotificationsBadge();

        toast.success("New Friend!", `You are now connected with ${senderName}! 🎉`);

        // Update button
        if (button) {
            button.textContent = '✓ Accepted';
            button.style.background = 'rgba(40, 167, 69, 0.3)';
        }

    } catch (error) {
        console.error("❌ Error accepting friend request:", error);
        toast.error("Connection Failed", "Could not accept friend request");

        // Reset button
        if (button) {
            button.textContent = '✓';
            button.disabled = false;
        }
    }
}

// Decline friend request (same as home page)
async function declineFriendRequest(requestId, button = null) {
    if (!currentUser || !window.supabase) {
        toast.error("Cannot decline request");
        return;
    }

    // Show loading state on button
    if (button) {
        const originalText = button.textContent;
        button.textContent = '...';
        button.disabled = true;
    }

    try {
        const { error } = await window.supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (error) throw error;

        await loadNotifications();
        await updateNotificationsBadge();

        toast.info("Request Declined", "Friend request has been declined");

        // Update button
        if (button) {
            button.textContent = '✗ Declined';
            button.style.background = 'rgba(220, 53, 69, 0.3)';
        }

    } catch (error) {
        console.error("❌ Error declining friend request:", error);
        toast.error("Action Failed", "Could not decline friend request");

        // Reset button
        if (button) {
            button.textContent = '✗';
            button.disabled = false;
        }
    }
}

// Filter search results
function filterSearchResults() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    if (!searchInput || !searchResults) return;

    const searchTerm = searchInput.value.toLowerCase();
    const results = searchResults.querySelectorAll('.search-result');

    results.forEach(result => {
        const name = result.querySelector('.search-name').textContent.toLowerCase();
        if (name.includes(searchTerm) || searchTerm === '') {
            result.style.display = 'flex';
        } else {
            result.style.display = 'none';
        }
    });
}

// Global functions
window.openSearchModal = function() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        loadSearchResults();
    }
};

window.openNotifications = function() {
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadNotifications();
    }
};

window.closeModal = function() {
    const searchModal = document.getElementById('searchModal');
    const notificationsModal = document.getElementById('notificationsModal');

    if (searchModal) searchModal.style.display = 'none';
    if (notificationsModal) notificationsModal.style.display = 'none';
};

window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.goToHome = function() {
    window.location.href = '../../home/index.html';
};
window.goToFriends = function() {
    console.log('Already on friends page');
};
window.filterSearchResults = filterSearchResults;

// Initialize on load
document.addEventListener('DOMContentLoaded', initFriendsPage);