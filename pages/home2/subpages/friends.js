// ===== FRIENDS PAGE - MIDNIGHT AURORA =====

// Get auth and supabase from global window object
const auth = window.auth;
const supabase = window.supabase;

let currentUser = null;
let currentProfile = null;
let friendsData = [];
let friendToRemove = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initFriendsPage);

async function initFriendsPage() {
    console.log("✨ Friends Page Initializing...");
    
    try {
        // Check if user is logged in
        const { success, user } = await auth.getCurrentUser();  
        
        if (!success || !user) {  
            alert("Please login first!");  
            window.location.href = '../../auth/index.html';  
            return;  
        }  

        currentUser = user;  
        
        // Get user profile
        await loadUserProfile();  
        
        // Load all friends
        await loadAllFriends();
        
        // Update stats
        updateFriendsStats();
        
        // Setup event listeners
        setupEventListeners();
        
        // Show app
        setTimeout(() => {
            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) {
                loadingIndicator.style.opacity = '0';
                setTimeout(() => {
                    loadingIndicator.style.display = 'none';
                    document.getElementById('appContainer').style.display = 'block';
                }, 300);
            }
        }, 500);
        
    } catch (error) {
        console.error("❌ Initialization error:", error);
        showError("Failed to load friends.");
    }
}

async function loadUserProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;  
        currentProfile = profile;  

    } catch (error) {  
        console.error("Error loading profile:", error);  
        currentProfile = {  
            username: currentUser.user_metadata?.username || 'User',  
            full_name: currentUser.user_metadata?.full_name || 'User'  
        };  
    }
}

async function loadAllFriends() {
    try {
        // Get friend IDs
        const { data: friends, error } = await supabase  
            .from('friends')  
            .select('friend_id, created_at')  
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {  
            console.log("Error loading friends:", error.message);  
            showEmptyState('allFriendsList', 'No friends yet', 'Start by adding friends!');
            return;  
        }  

        if (!friends || friends.length === 0) {  
            showEmptyState('allFriendsList', 'No friends yet', 'Start by adding friends!');
            friendsData = [];
            return;  
        }  

        const friendIds = friends.map(f => f.friend_id);  
        
        // Get profiles for each friend  
        const { data: profiles, error: profilesError } = await supabase  
            .from('profiles')  
            .select('id, username, status, last_seen, avatar_color')  
            .in('id', friendIds);  

        if (profilesError) {  
            console.error("Error loading profiles:", profilesError);  
            showEmptyState('allFriendsList', 'Error loading friends', 'Please try again');
            return;  
        }  

        // Map friend data with join date
        friendsData = profiles.map(profile => {
            const friend = friends.find(f => f.friend_id === profile.id);
            return {
                ...profile,
                added_at: friend ? friend.created_at : new Date().toISOString()
            };
        });

        renderAllFriends();
        renderOnlineFriends();
        renderRecentFriends();
        
    } catch (error) {  
        console.error("Error loading friends:", error);  
        showEmptyState('allFriendsList', 'Error loading friends', 'Please try again');
    }
}

function renderAllFriends() {
    const container = document.getElementById('allFriendsList');
    if (!container) return;
    
    if (!friendsData || friendsData.length === 0) {
        showEmptyState('allFriendsList', 'No friends yet', 'Start by adding friends!');
        return;
    }
    
    container.innerHTML = friendsData.map(friend => createFriendCard(friend)).join('');
}

function renderOnlineFriends() {
    const container = document.getElementById('onlineFriendsList');
    if (!container) return;
    
    const onlineFriends = friendsData.filter(f => f.status === 'online');
    
    if (onlineFriends.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-wifi"></i>
                </div>
                <h3>No one online</h3>
                <p>Check back later!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = onlineFriends.map(friend => createFriendCard(friend)).join('');
}

function renderRecentFriends() {
    const container = document.getElementById('recentFriendsList');
    if (!container) return;
    
    // Sort by last seen (most recent first)
    const recentFriends = [...friendsData].sort((a, b) => {
        const timeA = new Date(a.last_seen || 0);
        const timeB = new Date(b.last_seen || 0);
        return timeB - timeA;
    }).slice(0, 10);
    
    if (recentFriends.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-history"></i>
                </div>
                <h3>No recent activity</h3>
                <p>Start chatting with friends!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentFriends.map(friend => createFriendCard(friend)).join('');
}

function createFriendCard(friend) {
    const isOnline = friend.status === 'online';
    const lastSeen = friend.last_seen ? new Date(friend.last_seen) : new Date();
    const timeAgo = getTimeAgo(lastSeen);
    const firstLetter = friend.username ? friend.username.charAt(0).toUpperCase() : '?';
    const avatarColor = friend.avatar_color || generateColorFromName(friend.username);
    const addedDate = new Date(friend.added_at).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });

    return `
        <div class="friend-card">
            <div class="chat-avatar">
                <div class="avatar-img" style="background: linear-gradient(135deg, ${avatarColor}, ${adjustColor(avatarColor, -20)})">
                    ${firstLetter}
                </div>
                <div class="online-status ${isOnline ? '' : 'offline'}"></div>
            </div>
            <div class="chat-content">
                <div class="chat-header">
                    <div class="chat-name">${friend.username || 'Unknown User'}</div>
                    <div class="chat-time">${isOnline ? 'Online' : timeAgo}</div>
                </div>
                <div class="chat-preview">
                    <div class="chat-message">
                        Friend since ${addedDate}
                    </div>
                </div>
            </div>
            <div class="friend-actions">
                <button class="action-btn message-btn" onclick="openChat('${friend.id}', '${friend.username}')">
                    <i class="fas fa-comment"></i>
                    Message
                </button>
                <button class="action-btn remove-btn" onclick="showRemoveModal('${friend.id}', '${friend.username}')">
                    <i class="fas fa-user-minus"></i>
                    Remove
                </button>
            </div>
        </div>
    `;
}

function updateFriendsStats() {
    const totalFriends = friendsData.length;
    const onlineFriends = friendsData.filter(f => f.status === 'online').length;
    
    document.getElementById('totalFriends').textContent = totalFriends;
    document.getElementById('onlineFriends').textContent = onlineFriends;
}

function switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(tabName.charAt(0).toUpperCase() + tabName.slice(1))) {
            btn.classList.add('active');
        }
    });
    
    // Show active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(`${tabName}FriendsTab`).classList.add('active');
}

function showRemoveModal(friendId, friendName) {
    friendToRemove = { id: friendId, name: friendName };
    
    document.getElementById('removeMessage').textContent = 
        `Are you sure you want to remove ${friendName} from your friends?`;
    
    document.getElementById('removeModal').style.display = 'flex';
    
    // Set up confirm button
    const confirmBtn = document.getElementById('confirmRemove');
    confirmBtn.onclick = () => removeFriend(friendId);
}

async function removeFriend(friendId) {
    try {
        // Remove from friends table (both directions)
        const { error: error1 } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('friend_id', friendId);
        
        const { error: error2 } = await supabase
            .from('friends')
            .delete()
            .eq('user_id', friendId)
            .eq('friend_id', currentUser.id);
        
        if (error1 || error2) {
            throw new Error(error1?.message || error2?.message);
        }
        
        // Update UI
        friendsData = friendsData.filter(f => f.id !== friendId);
        renderAllFriends();
        renderOnlineFriends();
        renderRecentFriends();
        updateFriendsStats();
        
        // Close modal
        closeModal();
        
        // Show success message
        showFeedback(`${friendToRemove.name} removed from friends`, 'success');
        
    } catch (error) {
        console.error('Error removing friend:', error);
        showFeedback('Failed to remove friend', 'error');
    }
}

function refreshFriends() {
    loadAllFriends();
    showFeedback('Friends list refreshed', 'success');
}

function setupEventListeners() {
    // Back button in header
    document.querySelector('.fa-arrow-left')?.addEventListener('click', () => {
        window.location.href = '../index.html';
    });
}

function closeModal() {
    document.getElementById('removeModal').style.display = 'none';
    friendToRemove = null;
}

function showEmptyState(containerId, title, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-user-friends"></i>
                </div>
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

function showFeedback(message, type) {
    const feedback = document.createElement('div');
    feedback.className = 'refresh-feedback';
    feedback.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    
    const bgColor = type === 'success' 
        ? 'linear-gradient(135deg, #00d4ff, #8a2be2)' 
        : 'linear-gradient(135deg, #ff6b8b, #ff2e63)';
    
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1000;
        animation: slideDown 0.3s ease, slideUp 0.3s ease 1.5s;
        font-weight: 600;
        box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.remove();
    }, 1800);
}

function showError(message) {
    const loadingScreen = document.getElementById('loadingIndicator');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="loading-content">
                <div class="logo-circle" style="background: linear-gradient(135deg, #ff6b8b, #ff2e63)">
                    <i class="fas fa-exclamation"></i>
                </div>
                <h1 class="app-title">Oops!</h1>
                <p class="loading-text">${message}</p>
                <button class="btn-primary" onclick="location.reload()" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i>
                    Try Again
                </button>
            </div>
        `;
    }
}

// Helper functions
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
    if (diffDays < 30) return `${Math.floor(diffDays/7)}w ago`;  
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function generateColorFromName(name) {
    const colors = [
        '#00d4ff', '#8a2be2', '#ff00ff', '#00ffaa', '#ffaa00',
        '#ff6b8b', '#6b8bff', '#8bff6b', '#ff8b6b', '#6bff8b'
    ];
    if (!name) return colors[0];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

function adjustColor(color, amount) {
    let usePound = false;
    if (color[0] === "#") {
        color = color.slice(1);
        usePound = true;
    }
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amount;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amount;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function openChat(friendId, friendUsername = 'Friend') {
    sessionStorage.setItem('currentChatFriend', JSON.stringify({  
        id: friendId,  
        username: friendUsername  
    }));  
    window.location.href = `../../chats/index.html?friendId=${friendId}`;
}

// Make functions available globally
window.switchTab = switchTab;
window.showRemoveModal = showRemoveModal;
window.closeModal = closeModal;
window.openChat = openChat;
window.refreshFriends = refreshFriends;