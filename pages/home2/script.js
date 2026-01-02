// Initialize Supabase
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let currentUser = null;
let currentProfile = null;
let realtimeSubscription = null;
let heartbeatInterval = null;

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const appContainer = document.getElementById('appContainer');
const chatsList = document.getElementById('chatsList');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const notificationBadge = document.getElementById('notificationBadge');
const navNotificationBadge = document.getElementById('navNotificationBadge');
const newChatFab = document.getElementById('newChatFab');
const newChatModal = document.getElementById('newChatModal');

// Initialize Home Page
async function initHomePage() {
    console.log('✨ RelayTalk Home Initializing...');
    
    try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            throw new Error(`Session error: ${sessionError.message}`);
        }
        
        if (!session) {
            redirectToLogin();
            return;
        }
        
        currentUser = session.user;
        console.log('✅ User authenticated:', currentUser.email);
        
        // Load user profile
        await loadUserProfile();
        
        // Setup real-time updates
        setupRealtimeUpdates();
        
        // Setup heartbeat
        startHeartbeat();
        
        // Load chats
        await loadChats();
        
        // Update notifications
        await updateNotificationsBadge();
        
        // Setup event listeners
        setupEventListeners();
        
        // Show app
        showApp();
        
        console.log('✅ Home page initialized successfully');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showError('Failed to load app. Please refresh.');
    }
}

// Redirect to login
function redirectToLogin() {
    window.location.href = '../auth/index.html';
}

// Load user profile
async function loadUserProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) throw error;
        
        currentProfile = profile;
        updateUserAvatar(profile);
        
    } catch (error) {
        console.error('Error loading profile:', error);
        currentProfile = {
            username: currentUser.email?.split('@')[0] || 'User',
            avatar_color: '#667eea'
        };
    }
}

// Update user avatar
function updateUserAvatar(profile) {
    const avatar = document.getElementById('userAvatar');
    if (!avatar) return;
    
    if (profile.avatar_url) {
        avatar.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username}">`;
    } else {
        const initial = profile.username ? profile.username.charAt(0).toUpperCase() : 'U';
        avatar.innerHTML = initial;
        avatar.style.background = `linear-gradient(135deg, ${profile.avatar_color || '#667eea'}, ${profile.avatar_color ? adjustColor(profile.avatar_color, -20) : '#764ba2'})`;
    }
}

// Load chats
async function loadChats(searchTerm = '') {
    try {
        showLoading(true);
        
        // Get user's friends
        const { data: friends, error: friendsError } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (friendsError) throw friendsError;
        
        if (!friends || friends.length === 0) {
            showEmptyState();
            return;
        }
        
        const friendIds = friends.map(f => f.friend_id);
        
        // Get profiles of friends
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, status, last_seen, avatar_url, avatar_color')
            .in('id', friendIds);
        
        if (profilesError) throw profilesError;
        
        // Get last messages for each friend
        const chatsData = await Promise.all(
            profiles.map(async (profile) => {
                const { data: messages, error: messagesError } = await supabase
                    .from('direct_messages')
                    .select('*')
                    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                    .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                
                if (messagesError && messagesError.code !== 'PGRST116') {
                    console.error('Error fetching messages:', messagesError);
                }
                
                // Get unread count
                const { count: unreadCount } = await supabase
                    .from('direct_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('sender_id', profile.id)
                    .eq('receiver_id', currentUser.id)
                    .eq('read', false);
                
                return {
                    profile,
                    lastMessage: messages || null,
                    unreadCount: unreadCount || 0
                };
            })
        );
        
        // Filter by search term if provided
        let filteredChats = chatsData;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredChats = chatsData.filter(chat => 
                chat.profile.username.toLowerCase().includes(term) ||
                (chat.lastMessage && chat.lastMessage.content.toLowerCase().includes(term))
            );
        }
        
        // Sort by last message time or online status
        filteredChats.sort((a, b) => {
            // Online users first
            if (a.profile.status === 'online' && b.profile.status !== 'online') return -1;
            if (a.profile.status !== 'online' && b.profile.status === 'online') return 1;
            
            // Then by last message time
            const timeA = a.lastMessage ? new Date(a.lastMessage.created_at) : new Date(0);
            const timeB = b.lastMessage ? new Date(b.lastMessage.created_at) : new Date(0);
            return timeB - timeA;
        });
        
        renderChats(filteredChats);
        
    } catch (error) {
        console.error('Error loading chats:', error);
        showError('Failed to load chats.');
    } finally {
        showLoading(false);
    }
}

// Render chats
function renderChats(chats) {
    if (!chats || chats.length === 0) {
        showEmptyState();
        return;
    }
    
    emptyState.style.display = 'none';
    chatsList.innerHTML = '';
    
    chats.forEach(chat => {
        const chatElement = createChatElement(chat);
        chatsList.appendChild(chatElement);
    });
}

// Create chat element
function createChatElement(chat) {
    const { profile, lastMessage, unreadCount } = chat;
    
    const chatItem = document.createElement('div');
    chatItem.className = `chat-item ${unreadCount > 0 ? 'unread' : ''}`;
    chatItem.onclick = () => openChat(profile.id);
    
    // Avatar with initial
    const initial = profile.username ? profile.username.charAt(0).toUpperCase() : '?';
    const avatarColor = profile.avatar_color || '#667eea';
    
    // Time ago
    const lastMessageTime = lastMessage ? formatTimeAgo(lastMessage.created_at) : 'No messages yet';
    
    // Message preview
    let messagePreview = 'Start a conversation!';
    if (lastMessage) {
        const isSender = lastMessage.sender_id === currentUser.id;
        messagePreview = `${isSender ? 'You: ' : ''}${truncateText(lastMessage.content, 30)}`;
    }
    
    chatItem.innerHTML = `
        <div class="chat-avatar">
            <div class="avatar-img" style="background: linear-gradient(135deg, ${avatarColor}, ${adjustColor(avatarColor, -20)})">
                ${initial}
            </div>
            <div class="online-status ${profile.status === 'online' ? '' : 'offline'}"></div>
        </div>
        <div class="chat-content">
            <div class="chat-header">
                <div class="chat-name">${profile.username || 'Unknown User'}</div>
                <div class="chat-time">${lastMessageTime}</div>
            </div>
            <div class="chat-preview">
                <div class="chat-message ${unreadCount > 0 ? 'unread' : ''}">
                    ${messagePreview}
                </div>
                ${unreadCount > 0 ? `
                    <div class="unread-badge">
                        ${unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return chatItem;
}

// Format time ago
function formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays/7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Truncate text
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Adjust color brightness
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

// Setup real-time updates
function setupRealtimeUpdates() {
    if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
    }
    
    // Subscribe to direct_messages changes
    realtimeSubscription = supabase
        .channel('public:direct_messages')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'direct_messages',
                filter: `receiver_id=eq.${currentUser.id}`
            }, 
            (payload) => {
                console.log('New message real-time update:', payload);
                loadChats(searchInput.value.trim());
            }
        )
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=neq.${currentUser.id}`
            },
            (payload) => {
                console.log('Profile status update:', payload);
                loadChats(searchInput.value.trim());
            }
        )
        .subscribe();
}

// Start heartbeat for online status
function startHeartbeat() {
    // Send initial heartbeat
    sendHeartbeat();
    
    // Set up interval for heartbeat (every 30 seconds)
    heartbeatInterval = setInterval(sendHeartbeat, 30000);
    
    // Send heartbeat on visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            sendHeartbeat();
        }
    });
}

// Send heartbeat to update online status
async function sendHeartbeat() {
    try {
        await supabase
            .from('profiles')
            .update({ 
                status: 'online',
                last_seen: new Date().toISOString()
            })
            .eq('id', currentUser.id);
    } catch (error) {
        console.error('Heartbeat error:', error);
    }
}

// Update notifications badge
async function updateNotificationsBadge() {
    try {
        const { count, error } = await supabase
            .from('friend_requests')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');
        
        if (error) throw error;
        
        const unreadCount = count || 0;
        
        // Update both badges
        [notificationBadge, navNotificationBadge].forEach(badge => {
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        });
        
    } catch (error) {
        console.error('Error updating notifications badge:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search input
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadChats(e.target.value.trim());
        }, 300);
        
        // Show/hide clear button
        clearSearch.classList.toggle('visible', e.target.value.length > 0);
    });
    
    // Clear search
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.classList.remove('visible');
        loadChats();
    });
    
    // New chat FAB
    newChatFab.addEventListener('click', openNewChatModal);
    
    // Notifications button
    document.getElementById('notificationsBtn')?.addEventListener('click', () => {
        window.location.href = 'notifications.html';
    });
    
    // Pull to refresh
    let startY = 0;
    let currentY = 0;
    let pulling = false;
    
    document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].pageY;
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && e.touches[0].pageY > startY) {
            currentY = e.touches[0].pageY;
            pulling = true;
        }
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
        if (pulling && currentY - startY > 100) {
            loadChats(searchInput.value.trim());
            showPullToRefreshFeedback();
        }
        pulling = false;
        startY = 0;
        currentY = 0;
    }, { passive: true });
}

// Open new chat modal
async function openNewChatModal() {
    try {
        // Get user's friends
        const { data: friends, error } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        if (!friends || friends.length === 0) {
            alert('Add friends first to start a chat!');
            window.location.href = 'search.html';
            return;
        }
        
        const friendIds = friends.map(f => f.friend_id);
        
        // Get profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_color')
            .in('id', friendIds)
            .order('username');
        
        if (profilesError) throw profilesError;
        
        const modalList = document.getElementById('friendsListModal');
        if (!modalList) return;
        
        if (!profiles || profiles.length === 0) {
            modalList.innerHTML = `
                <div class="empty-state">
                    <p>No friends yet</p>
                    <button class="btn-secondary" onclick="window.location.href='search.html'">
                        Find Friends
                    </button>
                </div>
            `;
        } else {
            modalList.innerHTML = profiles.map(profile => {
                const initial = profile.username.charAt(0).toUpperCase();
                const avatarColor = profile.avatar_color || '#667eea';
                
                return `
                    <div class="friend-item" onclick="openChat('${profile.id}')">
                        <div class="friend-avatar" style="background: linear-gradient(135deg, ${avatarColor}, ${adjustColor(avatarColor, -20)})">
                            ${initial}
                        </div>
                        <div class="friend-name">${profile.username}</div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                `;
            }).join('');
        }
        
        newChatModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error opening new chat modal:', error);
        alert('Failed to load friends.');
    }
}

// Open chat
function openChat(friendId) {
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

// Close modal
function closeModal() {
    newChatModal.style.display = 'none';
}

// Show empty state
function showEmptyState() {
    emptyState.style.display = 'block';
    chatsList.innerHTML = '';
}

// Show loading
function showLoading(show) {
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

// Show app
function showApp() {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        appContainer.style.display = 'block';
    }, 500);
}

// Show error
function showError(message) {
    loadingScreen.innerHTML = `
        <div class="loading-content">
            <div class="logo-circle" style="background: var(--danger)">
                <i class="fas fa-exclamation"></i>
            </div>
            <h1>Oops!</h1>
            <p>${message}</p>
            <button class="btn-primary" onclick="location.reload()">
                <i class="fas fa-redo"></i>
                Try Again
            </button>
        </div>
    `;
}

// Show pull to refresh feedback
function showPullToRefreshFeedback() {
    const feedback = document.createElement('div');
    feedback.className = 'refresh-feedback';
    feedback.innerHTML = '<i class="fas fa-check-circle"></i> Refreshed!';
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--success);
        color: white;
        padding: 10px 20px;
        border-radius: 25px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1000;
        animation: slideDown 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => feedback.remove(), 300);
    }, 1500);
}

// Add CSS for animations
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
    .friend-item {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px;
        background: var(--glass-bg);
        border-radius: 15px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: var(--transition);
    }
    .friend-item:hover {
        background: var(--light-surface);
        transform: translateX(5px);
    }
    .friend-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
    }
    .friend-name {
        flex: 1;
        font-weight: 500;
    }
`;
document.head.appendChild(style);

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
    }
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
});

// Make functions available globally
window.openChat = openChat;
window.closeModal = closeModal;