// friends/script.js - SIMPLIFIED VERSION
console.log('✨ Friends Page Script Loaded');

// Simple toast function
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '💬';
    switch(type) {
        case 'success': icon = '✨'; break;
        case 'error': icon = '❌'; break;
        case 'warning': icon = '⚠️'; break;
    }
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

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
    showToast('Cannot connect to server', 'error');
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

let currentUser = null;

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
            
            showToast('Please login to view friends', 'info');
            
            setTimeout(() => {
                window.location.href = '../../login/index.html';
            }, 1500);
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }
        
        // Step 3: Set current user
        currentUser = authResult.user;
        console.log('✅ Current user:', currentUser.email);
        
        // Hide loading
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Step 4: Load friends
        await loadFriendsList();
        
        console.log('✅ Friends page ready');
        
        setTimeout(() => {
            showToast('Friends loaded successfully!', 'success');
        }, 500);
        
    } catch (error) {
        console.error('❌ Friends page init failed:', error);
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        showToast('Failed to load friends', 'error');
        
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

// Load friends list
async function loadFriendsList(searchTerm = '') {
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
            updateStats([]);
            return;
        }
        
        // Get profiles for each friend
        const friendIds = friends.map(f => f.friend_id);
        const { data: profiles, error: profilesError } = await window.supabase
            .from('profiles')
            .select('id, username, status, last_seen')
            .in('id', friendIds);
        
        if (profilesError) {
            console.error('Profiles load error:', profilesError);
            showEmptyFriends();
            return;
        }
        
        // Filter by search term
        let filteredFriends = profiles || [];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredFriends = filteredFriends.filter(friend => 
                friend.username.toLowerCase().includes(term)
            );
        }
        
        // Update stats
        updateStats(filteredFriends);
        
        // Display friends
        if (filteredFriends.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3 class="empty-title">No Friends Found</h3>
                    <p class="empty-desc">Try a different search term</p>
                </div>
            `;
            return;
        }
        
        displayFriends(filteredFriends);
        
    } catch (error) {
        console.error('❌ Error loading friends:', error);
        showErrorState(error.message);
    }
}

// Display friends
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
            <div class="friend-item-clean" onclick="openChat('${friend.id}', '${friend.username}')">
                <div class="friend-avatar-clean" style="background: #667eea;">
                    ${firstLetter}
                    <span class="status-indicator-clean ${isOnline ? 'online' : 'offline'}"></span>
                </div>
                <div class="friend-info-clean">
                    <div class="friend-name-status">
                        <div class="friend-name-clean">${friend.username}</div>
                        <div class="friend-status-clean">
                            ${isOnline ? 'Online' : 'Last seen ' + timeAgo}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Show empty friends state
function showEmptyFriends() {
    const container = document.getElementById('friendsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3 class="empty-title">No Friends Yet</h3>
            <p class="empty-desc">Add friends to start chatting</p>
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

// Update stats
function updateStats(friends) {
    const totalFriends = document.getElementById('totalFriends');
    const onlineFriends = document.getElementById('onlineFriends');
    
    if (totalFriends) {
        totalFriends.textContent = friends.length;
    }
    
    if (onlineFriends) {
        const onlineCount = friends.filter(f => f.status === 'online').length;
        onlineFriends.textContent = onlineCount;
    }
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

// Search friends
function searchFriends() {
    const searchInput = document.getElementById('searchFriendsInput');
    if (!searchInput) return;
    
    loadFriendsList(searchInput.value.trim());
}

// Open chat
async function openChat(friendId, friendUsername = 'Friend') {
    console.log('Opening chat with:', friendId);
    
    showToast(`Opening chat with ${friendUsername}...`, 'info');
    
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
            .select('id, username')
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
        
        // Display users
        let html = '';
        users.forEach(user => {
            const firstLetter = user.username.charAt(0).toUpperCase();
            
            html += `
                <div class="search-result">
                    <div class="search-avatar" style="background: #667eea;">${firstLetter}</div>
                    <div class="search-info">
                        <div class="search-name">${user.username}</div>
                    </div>
                    <button class="send-request-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">
                        Add Friend
                    </button>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
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

// Send friend request
async function sendFriendRequest(toUserId, toUsername, button) {
    if (!currentUser || !window.supabase) {
        showToast("Cannot send request", 'error');
        return;
    }
    
    if (button) {
        button.textContent = 'Sending...';
        button.disabled = true;
    }
    
    try {
        const { error } = await window.supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: toUserId,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        
        if (error) {
            console.error('Request error:', error);
            showToast("Could not send request", 'error');
            if (button) {
                button.textContent = 'Add Friend';
                button.disabled = false;
            }
            return;
        }
        
        showToast(`Friend request sent to ${toUsername}`, 'success');
        
        if (button) {
            button.textContent = '✓ Sent';
            button.classList.add('sent');
        }
        
    } catch (error) {
        console.error('❌ Request error:', error);
        showToast("Could not send request", 'error');
        if (button) {
            button.textContent = 'Add Friend';
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
        // You can implement notifications loading here
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
window.goToHome = function() {
    window.location.href = '../../home/index.html';
};
window.goToFriends = function() {
    console.log('Already on friends page');
};
window.searchFriends = searchFriends;
window.filterSearchResults = filterSearchResults;

// Initialize on load
document.addEventListener('DOMContentLoaded', initFriendsPage);