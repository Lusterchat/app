// ===== RELAYTALK HOME PAGE - MIDNIGHT AURORA =====
// Using your existing database logic with new UI

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);

async function initHomePage() {
    console.log("✨ RelayTalk Home Page Initializing...");
    
    try {
        // Hide app, show loading
        document.getElementById('appContainer').style.display = 'none';
        
        // Check if user is logged in using your existing auth system
        const { success, user } = await auth.getCurrentUser();  
        
        if (!success || !user) {  
            alert("Please login first!");  
            window.location.href = '../auth/index.html';  
            return;  
        }  

        currentUser = user;  
        console.log("✅ User authenticated:", currentUser.email);  

        // Get user profile using your existing function
        await loadUserProfile();  

        // Update UI  
        updateWelcomeMessage();  
        await loadFriends();  
        await updateNotificationsBadge();  

        // Set up event listeners  
        setupEventListeners();  

        console.log("✅ Home page initialized for:", currentProfile?.username);

        // Hide loading indicator
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
        showError("Failed to load. Please refresh.");
    }
}

// === YOUR EXISTING DATABASE FUNCTIONS ===
// I'm keeping all your database logic exactly as it is!

let currentUser = null;
let currentProfile = null;

async function loadUserProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;  

        currentProfile = profile;  
        console.log("✅ Profile loaded:", profile.username);  

    } catch (error) {  
        console.error("❌ Error loading profile:", error);  
        currentProfile = {  
            username: currentUser.user_metadata?.username || 'User',  
            full_name: currentUser.user_metadata?.full_name || 'User',  
            avatar_url: currentUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=User&background=random`  
        };  
    }
}

function updateWelcomeMessage() {
    if (!currentProfile) return;

    const welcomeElement = document.getElementById('welcomeTitle');  
    if (welcomeElement) {  
        welcomeElement.textContent = `Welcome, ${currentProfile.username}!`;  
    }  
}

async function loadFriends() {
    if (!currentUser) return;

    console.log("Loading friends for user:", currentUser.id);  

    const container = document.getElementById('chatsList');  
    if (!container) {  
        console.error("Chats list container not found!");  
        return;  
    }  

    try {  
        // Get friend IDs  
        const { data: friends, error } = await supabase  
            .from('friends')  
            .select('friend_id')  
            .eq('user_id', currentUser.id);  

        if (error) {  
            console.log("Error loading friends:", error.message);  
            showEmptyFriends(container);  
            return;  
        }  

        console.log("Found friend IDs:", friends?.length || 0);  

        if (!friends || friends.length === 0) {  
            showEmptyFriends(container);  
            return;  
        }  

        // Get profiles for each friend  
        const friendIds = friends.map(f => f.friend_id);  
        const { data: profiles, error: profilesError } = await supabase  
            .from('profiles')  
            .select('id, username, status, last_seen')  
            .in('id', friendIds);  

        if (profilesError) {  
            console.error("Error loading profiles:", profilesError);  
            showEmptyFriends(container);  
            return;  
        }  

        let html = '';  
        profiles.forEach(profile => {  
            const isOnline = profile.status === 'online';  
            const lastSeen = profile.last_seen ? new Date(profile.last_seen) : new Date();  
            const timeAgo = getTimeAgo(lastSeen);  
            const firstLetter = profile.username ? profile.username.charAt(0).toUpperCase() : '?';  
            const avatarColor = generateColorFromName(profile.username);

            html += `  
                <div class="chat-item" onclick="openChat('${profile.id}', '${profile.username}')">  
                    <div class="chat-avatar">  
                        <div class="avatar-img" style="background: linear-gradient(135deg, ${avatarColor}, ${adjustColor(avatarColor, -20)})">  
                            ${firstLetter}  
                        </div>  
                        <div class="online-status ${isOnline ? '' : 'offline'}"></div>  
                    </div>  
                    <div class="chat-content">  
                        <div class="chat-header">  
                            <div class="chat-name">${profile.username || 'Unknown User'}</div>  
                            <div class="chat-time">${isOnline ? 'Online' : timeAgo}</div>  
                        </div>  
                        <div class="chat-preview">  
                            <div class="chat-message">  
                                ${isOnline ? 'Available to chat' : 'Last seen ' + timeAgo}  
                            </div>  
                        </div>  
                    </div>  
                </div>  
            `;  
        });  

        container.innerHTML = html;  
        document.getElementById('emptyState').style.display = 'none';

    } catch (error) {  
        console.error("Error loading friends:", error);  
        showEmptyFriends(container);  
    }
}

function showEmptyFriends(container) {
    document.getElementById('emptyState').style.display = 'block';
    if (container) container.innerHTML = '';
}

// Helper functions from your original code
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

// === NEW UI FUNCTIONS ===
async function updateNotificationsBadge() {
    try {
        const { data: notifications, error } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) {  
            console.log("Friend requests error:", error.message);  
            hideNotificationBadge();  
            return;  
        }  

        const unreadCount = notifications?.length || 0;  
        updateBadgeDisplay(unreadCount);  

    } catch (error) {  
        console.error("Error loading notifications:", error);  
        hideNotificationBadge();  
    }
}

function updateBadgeDisplay(count) {
    const badge = document.getElementById('notificationBadge');
    const navBadge = document.getElementById('navNotificationBadge');
    
    [badge, navBadge].forEach(b => {
        if (b) {
            if (count > 0) {
                b.textContent = count > 9 ? '9+' : count;
                b.style.display = 'flex';
            } else {
                b.style.display = 'none';
            }
        }
    });
}

function hideNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const navBadge = document.getElementById('navNotificationBadge');
    
    if (badge) badge.style.display = 'none';
    if (navBadge) navBadge.style.display = 'none';
}

function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Search button
    document.getElementById('searchBtn')?.addEventListener('click', () => {
        window.location.href = 'subpages/search.html';
    });
    
    // Notifications button
    document.getElementById('notificationsBtn')?.addEventListener('click', () => {
        window.location.href = 'subpages/notifications.html';
    });
    
    // Search input in modal
    const friendSearch = document.getElementById('friendSearch');
    if (friendSearch) {
        friendSearch.addEventListener('input', async (e) => {
            await loadFriendsForModal(e.target.value);
        });
    }
}

async function openNewChatModal() {
    try {
        await loadFriendsForModal();
        document.getElementById('newChatModal').style.display = 'flex';
    } catch (error) {
        console.error('Error opening new chat modal:', error);
    }
}

async function loadFriendsForModal(searchTerm = '') {
    if (!currentUser) return;

    const container = document.getElementById('friendsListModal');
    if (!container) return;

    try {
        // Get friend IDs
        const { data: friends, error } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        if (!friends || friends.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No friends yet</p>
                    <button class="btn-secondary" onclick="window.location.href='subpages/search.html'">
                        Find Friends
                    </button>
                </div>
            `;
            return;
        }

        const friendIds = friends.map(f => f.friend_id);
        
        // Get profiles
        let query = supabase
            .from('profiles')
            .select('id, username, avatar_color')
            .in('id', friendIds);

        if (searchTerm) {
            query = query.ilike('username', `%${searchTerm}%`);
        }

        const { data: profiles, error: profilesError } = await query;

        if (profilesError) throw profilesError;

        if (!profiles || profiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No friends found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = profiles.map(profile => {
            const initial = profile.username.charAt(0).toUpperCase();
            const avatarColor = profile.avatar_color || generateColorFromName(profile.username);

            return `
                <div class="friend-item" onclick="openChat('${profile.id}', '${profile.username}')">
                    <div class="friend-avatar" style="background: linear-gradient(135deg, ${avatarColor}, ${adjustColor(avatarColor, -20)})">
                        ${initial}
                    </div>
                    <div class="friend-name">${profile.username}</div>
                    <i class="fas fa-chevron-right"></i>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading friends for modal:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p>Error loading friends</p>
            </div>
        `;
    }
}

function openChat(friendId, friendUsername = 'Friend') {
    console.log("Opening chat with:", friendId, friendUsername);

    // Store friend info in session storage for chat page  
    sessionStorage.setItem('currentChatFriend', JSON.stringify({  
        id: friendId,  
        username: friendUsername  
    }));  

    // Redirect to chat page  
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

function closeModal() {
    document.getElementById('newChatModal').style.display = 'none';
}

function refreshChats() {
    loadFriends();
    showRefreshFeedback();
}

function showRefreshFeedback() {
    const feedback = document.createElement('div');
    feedback.className = 'refresh-feedback';
    feedback.innerHTML = '<i class="fas fa-check-circle"></i> Refreshed!';
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #00d4ff, #8a2be2);
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

// Add CSS for refresh feedback animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { top: -50px; opacity: 0; }
        to { top: 20px; opacity: 1; }
    }
    @keyframes slideUp {
        from { top: 20px; opacity: 1; }
        to { top: -50px; opacity: 0; }
    }
`;
document.head.appendChild(style);

// Make functions available globally
window.openChat = openChat;
window.closeModal = closeModal;
window.openNewChatModal = openNewChatModal;
window.refreshChats = refreshChats;