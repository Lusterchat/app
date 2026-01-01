// Home Page Script - FIXED CORE FUNCTIONALITY
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Home Page Loaded");

let currentUser = null;
let currentProfile = null;
let requestsChannel = null;

// ====== FIX 1: Define functions BEFORE they're called ======
function goToHome() {
    console.log("Already on home page");
}

function openSettings() {
    alert("Settings page coming soon!");
}

function openSearch() {
    console.log("Opening search modal");
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Clear search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        
        loadSearchResults();
        
        // Close on outside click
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC key to close
        document.addEventListener('keydown', handleEscKey);
    }
}

function openNotifications() {
    console.log("Opening notifications modal");
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadNotifications();
        
        // Close on outside click
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC key to close
        document.addEventListener('keydown', handleEscKey);
    }
}

function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
}

function closeModal() {
    console.log("Closing modal");
    const searchModal = document.getElementById('searchModal');
    const notificationsModal = document.getElementById('notificationsModal');

    if (searchModal) {
        searchModal.style.display = 'none';
        searchModal.onclick = null;
    }
    if (notificationsModal) {
        notificationsModal.style.display = 'none';
        notificationsModal.onclick = null;
    }
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleEscKey);
}

// ====== FIX 2: Attach to window IMMEDIATELY ======
window.openSearch = openSearch;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.goToHome = goToHome;
window.openSettings = openSettings;

// ====== NOW the rest of your code ======
// Initialize home page - FIXED: Better error handling
async function initHomePage() {
    console.log("Initializing home page...");

    // Show loading indicator
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    try {
        // Check if user is logged in - WITH RETRY
        let authCheckAttempts = 0;
        let authSuccess = false;
        let user = null;
        
        while (authCheckAttempts < 3 && !authSuccess) {
            authCheckAttempts++;
            
            try {
                const { success, user: authUser, error } = await auth.getCurrentUser();
                
                if (success && authUser) {
                    authSuccess = true;
                    user = authUser;
                    console.log("✅ Auth successful on attempt", authCheckAttempts);
                } else if (error) {
                    console.log("Auth attempt", authCheckAttempts, "failed:", error.message);
                    
                    // Wait a bit before retrying
                    if (authCheckAttempts < 3) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } catch (authError) {
                console.log("Auth error on attempt", authCheckAttempts, ":", authError.message);
            }
        }

        if (!authSuccess || !user) {
            console.error("❌ Could not authenticate after 3 attempts");
            
            // Check if there's a session in localStorage/sessionStorage as fallback
            const storedUser = localStorage.getItem('supabase.auth.token') || 
                              sessionStorage.getItem('supabase.auth.token');
            
            if (!storedUser) {
                alert("Please login first!");
                window.location.href = '../auth/index.html';
                return;
            } else {
                console.log("Found stored auth token, but auth.getCurrentUser() failed");
                // Try one more time with delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { success: finalAttempt, user: finalUser } = await auth.getCurrentUser();
                
                if (!finalAttempt || !finalUser) {
                    alert("Session expired. Please login again!");
                    window.location.href = '../auth/index.html';
                    return;
                }
                
                user = finalUser;
            }
        }

        currentUser = user;  
        console.log("Logged in as:", currentUser.email);  

        // Get user profile  
        await loadUserProfile();  

        // Update UI  
        updateWelcomeMessage();  
        await loadFriends();  
        await updateNotificationsBadge();  

        // Setup realtime for new friend requests
        setupRealtime();

        // Set up event listeners  
        setupEventListeners();  

        console.log("Home page initialized for:", currentProfile?.username);

    } catch (error) {
        console.error("❌ Critical init error:", error);
        alert("Error loading home page: " + error.message);
        
        // Try to redirect to auth page
        setTimeout(() => {
            window.location.href = '../auth/index.html';
        }, 2000);
        
        return;
    } finally {
        // Always hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 300);
        }
    }
}

// [REST OF THE CODE REMAINS EXACTLY THE SAME AS BEFORE...]
// Home Page Script - FIXED CORE FUNCTIONALITY
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Home Page Loaded");

let currentUser = null;
let currentProfile = null;
let requestsChannel = null;

// ====== FIXED: Function defined BEFORE use ======
function goToHome() {
    console.log("Already on home page");
    // No action needed - we're already on home page
}

// ====== FIXED: Also define other functions that might be called early ======
function openSettings() {
    alert("Settings page coming soon!");
}

// Initialize home page
async function initHomePage() {
    console.log("Initializing home page...");

    // Check if user is logged in  
    const { success, user } = await auth.getCurrentUser();  

    if (!success || !user) {  
        alert("Please login first!");  
        window.location.href = '../auth/index.html';  
        return;  
    }  

    currentUser = user;  
    console.log("Logged in as:", currentUser.email);  

    // Get user profile  
    await loadUserProfile();  

    // Update UI  
    updateWelcomeMessage();  
    await loadFriends();  
    await updateNotificationsBadge();  

    // Setup realtime for new friend requests
    setupRealtime();

    // Set up event listeners  
    setupEventListeners();  

    console.log("Home page initialized for:", currentProfile?.username);

    // Hide loading indicator
    setTimeout(() => {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 300);
        }
    }, 100);
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
        console.log("Profile loaded:", profile.username);  

    } catch (error) {  
        console.error("Error loading profile:", error);  
        currentProfile = {  
            username: currentUser.user_metadata?.username || 'User',  
            full_name: currentUser.user_metadata?.full_name || 'User'  
        };  
    }
}

// Update welcome message
function updateWelcomeMessage() {
    if (!currentProfile) return;

    const welcomeElement = document.getElementById('welcomeTitle');  
    if (welcomeElement) {  
        welcomeElement.textContent = `Welcome, ${currentProfile.username}!`;  
    }  
}

// Load friends list - FIXED: Check your actual table name
async function loadFriends() {
    if (!currentUser) return;

    console.log("Loading friends for user:", currentUser.id);  

    const container = document.getElementById('friendsList');  
    if (!container) {  
        console.error("Friends list container not found!");  
        return;  
    }  

    try {  
        // FIXED: Try common table names for friends
        let friends = [];
        
        // Try 'friends' table first (most common)
        const result1 = await supabase  
            .from('friends')  
            .select('friend_id')  
            .eq('user_id', currentUser.id);
            
        if (!result1.error && result1.data && result1.data.length > 0) {
            friends = result1.data;
        } else {
            // Try 'friendships' table
            const result2 = await supabase
                .from('friendships')
                .select('user2_id as friend_id')
                .eq('user1_id', currentUser.id);
                
            if (!result2.error && result2.data) {
                friends = result2.data;
            } else {
                // Try reverse
                const result3 = await supabase
                    .from('friendships')
                    .select('user1_id as friend_id')
                    .eq('user2_id', currentUser.id);
                    
                if (!result3.error && result3.data) {
                    friends = result3.data;
                }
            }
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

            html += `  
                <div class="friend-card" onclick="openChat('${profile.id}')">  
                    <div class="friend-avatar">  
                        ${firstLetter}  
                    </div>  
                    <div class="friend-info">  
                        <div class="friend-name">${profile.username || 'Unknown User'}</div>  
                        <div class="friend-status">  
                            <span class="status-dot ${isOnline ? '' : 'offline'}"></span>  
                            ${isOnline ? 'Online' : 'Last seen ' + timeAgo}  
                        </div>  
                    </div>  
                </div>  
            `;  
        });  

        container.innerHTML = html;  

    } catch (error) {  
        console.error("Error loading friends:", error);  
        showEmptyFriends(container);  
    }
}

function showEmptyFriends(container) {
    container.innerHTML = `  
        <div class="empty-state">  
            <div class="empty-icon">👥</div>  
            <p>No friends yet</p>  
            <p style="font-size: 0.9rem; margin-top: 10px;">Search for users to add friends</p>  
        </div>  
    `;
}

// Get time ago string - FIXED: Better time handling
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
    return past.toLocaleDateString();
}

// Open chat with friend - FIXED: Simple redirect
async function openChat(friendId) {
    console.log("Opening chat with:", friendId);
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

// Setup realtime for new friend requests
function setupRealtime() {
    if (!currentUser) return;
    
    // Remove old channel if exists
    if (requestsChannel) {
        supabase.removeChannel(requestsChannel);
    }
    
    // Subscribe to new friend requests
    requestsChannel = supabase.channel('friend-requests-' + currentUser.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${currentUser.id}`
        }, async () => {
            // Update badge when new request arrives
            await updateNotificationsBadge();
            
            // Reload notifications if modal is open
            const modal = document.getElementById('notificationsModal');
            if (modal && modal.style.display === 'flex') {
                await loadNotifications();
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${currentUser.id}`
        }, async () => {
            await updateNotificationsBadge();
            
            const modal = document.getElementById('notificationsModal');
            if (modal && modal.style.display === 'flex') {
                await loadNotifications();
            }
        })
        .subscribe();
}

// Update notifications badge
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
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'block';
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

// Open search modal - FIXED: Clear input on open
function openSearch() {
    console.log("Opening search modal");
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Clear search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        
        loadSearchResults();
        
        // Close on outside click
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC key to close
        document.addEventListener('keydown', handleEscKey);
    }
}

// Open notifications modal
function openNotifications() {
    console.log("Opening notifications modal");
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadNotifications();
        
        // Close on outside click
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC key to close
        document.addEventListener('keydown', handleEscKey);
    }
}

// Handle ESC key
function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
}

// Close modal - FIXED: Proper cleanup
function closeModal() {
    console.log("Closing modal");
    const searchModal = document.getElementById('searchModal');
    const notificationsModal = document.getElementById('notificationsModal');

    if (searchModal) {
        searchModal.style.display = 'none';
        searchModal.onclick = null;
    }
    if (notificationsModal) {
        notificationsModal.style.display = 'none';
        notificationsModal.onclick = null;
    }
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleEscKey);
}

// Load search results - FIXED: Server-side search
async function loadSearchResults(searchTerm = '') {
    const container = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchInput');

    if (!container) {  
        console.error("Search results container not found!");  
        return;  
    }  

    try {  
        let query = supabase  
            .from('profiles')  
            .select('id, username, full_name')  
            .neq('id', currentUser.id);

        // Server-side search if term provided
        if (searchTerm.trim()) {
            query = query.ilike('username', `%${searchTerm}%`);
        } else {
            container.innerHTML = `  
                <div class="empty-state">  
                    <div class="empty-icon">🔍</div>  
                    <p>Type to search for users</p>  
                </div>  
            `;  
            return;  
        }

        const { data: users, error } = await query.limit(20);

        if (error) throw error;  

        await displaySearchResults(users);  

        if (searchInput) {  
            searchInput.oninput = async function() {  
                const term = this.value.toLowerCase().trim();  
                if (term === '') {  
                    container.innerHTML = `  
                        <div class="empty-state">  
                            <div class="empty-icon">🔍</div>  
                            <p>Type to search for users</p>  
                        </div>  
                    `;  
                    return;  
                }  

                const { data: filteredUsers, error: searchError } = await supabase  
                    .from('profiles')  
                    .select('id, username, full_name')  
                    .neq('id', currentUser.id)  
                    .ilike('username', `%${term}%`)  
                    .limit(20);

                if (!searchError) {  
                    await displaySearchResults(filteredUsers || []);  
                }  
            };  
        }  

    } catch (error) {  
        console.error("Error loading users:", error);  
        container.innerHTML = `  
            <div class="empty-state">  
                <div class="empty-icon">⚠️</div>  
                <p>Error loading users</p>  
            </div>  
        `;  
    }
}

// Display search results - FIXED: Better friend checking
async function displaySearchResults(users) {
    const container = document.getElementById('searchResults');

    if (!container) {  
        console.error("Search results container not found!");  
        return;  
    }  

    if (!users || users.length === 0) {  
        container.innerHTML = `  
            <div class="empty-state">  
                <div class="empty-icon">🔍</div>  
                <p>No users found</p>  
            </div>  
        `;  
        return;  
    }  

    try {  
        // Get current friends
        const { data: friends } = await supabase  
            .from('friends')  
            .select('friend_id')  
            .eq('user_id', currentUser.id);

        const friendIds = friends?.map(f => f.friend_id) || [];

        // Get pending requests
        const { data: pendingRequests } = await supabase  
            .from('friend_requests')  
            .select('receiver_id, status')  
            .eq('sender_id', currentUser.id);

        const pendingIds = pendingRequests?.map(r => r.receiver_id) || [];

        let html = '';  
        users.forEach(user => {  
            const isFriend = friendIds.includes(user.id);  
            const requestSent = pendingIds.includes(user.id);  
            const firstLetter = user.username.charAt(0).toUpperCase();  

            html += `  
                <div class="search-result">  
                    <div class="search-avatar">  
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
                        <button class="send-request-btn" onclick="sendFriendRequest('${user.id}', '${user.username}')">  
                            Add Friend  
                        </button>  
                    `}  
                </div>  
            `;  
        });  

        container.innerHTML = html;  

    } catch (error) {  
        console.error("Error displaying results:", error);  
    }
}

// Send friend request - FIXED: Better error handling
async function sendFriendRequest(toUserId, toUsername) {
    if (!currentUser) return;

    try {  
        // Check if request already exists  
        const { data: existingRequest, error: checkError } = await supabase  
            .from('friend_requests')  
            .select('id')  
            .eq('sender_id', currentUser.id)  
            .eq('receiver_id', toUserId)  
            .eq('status', 'pending')  
            .maybeSingle();  

        if (existingRequest) {  
            alert(`Friend request already sent to ${toUsername}!`);  
            return;  
        }  

        // Create friend request  
        const { error } = await supabase  
            .from('friend_requests')  
            .insert({  
                sender_id: currentUser.id,  
                receiver_id: toUserId,  
                status: 'pending',  
                created_at: new Date().toISOString()  
            });  

        if (error) {  
            console.error("Error sending request:", error);  
            alert("Could not send friend request.");  
            return;  
        }  

        // Update UI  
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value : '';
        await loadSearchResults(searchTerm);
        await updateNotificationsBadge();  

        alert(`Friend request sent to ${toUsername}!`);  

    } catch (error) {  
        console.error("Error sending friend request:", error);  
        alert("Could not send friend request. Please try again.");  
    }
}

// Load notifications - FIXED: Simple query without complex join
async function loadNotifications() {
    const container = document.getElementById('notificationsList');

    if (!container) {  
        console.error("Notifications container not found!");  
        return;  
    }  

    try {  
        // Get notifications  
        const { data: notifications, error } = await supabase  
            .from('friend_requests')  
            .select('id, sender_id, created_at')  
            .eq('receiver_id', currentUser.id)  
            .eq('status', 'pending')  
            .order('created_at', { ascending: false });  

        if (error) {  
            console.log("Notifications error:", error.message);  
            showEmptyNotifications(container);  
            return;  
        }  

        if (!notifications || notifications.length === 0) {  
            showEmptyNotifications(container);  
            return;  
        }  

        // Get usernames for each sender  
        const senderIds = notifications.map(n => n.sender_id);  
        const { data: profiles, error: profilesError } = await supabase  
            .from('profiles')  
            .select('id, username')  
            .in('id', senderIds);  

        const profileMap = {};  
        if (!profilesError && profiles) {  
            profiles.forEach(p => profileMap[p.id] = p.username);  
        }  

        let html = '';  
        notifications.forEach(notification => {  
            const timeAgo = getTimeAgo(notification.created_at);  
            const senderName = profileMap[notification.sender_id] || 'Unknown User';  
            const firstLetter = senderName.charAt(0).toUpperCase();  

            html += `  
                <div class="notification-item">  
                    <div class="notification-avatar" style="background: linear-gradient(45deg, #667eea, #764ba2);">  
                        ${firstLetter}  
                    </div>  
                    <div class="notification-content">  
                        <strong>${senderName}</strong> wants to be friends  
                        <small>${timeAgo}</small>  
                    </div>  
                    <div class="notification-actions">  
                        <button class="accept-btn" onclick="acceptFriendRequest('${notification.id}', '${notification.sender_id}', '${senderName}')">  
                            ✓  
                        </button>  
                        <button class="decline-btn" onclick="declineFriendRequest('${notification.id}')">  
                            ✗  
                        </button>  
                    </div>  
                </div>  
            `;  
        });  

        container.innerHTML = html;  

    } catch (error) {  
        console.error("Error loading notifications:", error);  
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

// Accept friend request with transaction
async function acceptFriendRequest(requestId, senderId, senderName = 'User') {
    console.log("Accepting request:", requestId, "from:", senderId);

    try {  
        // 1. Update friend request status  
        const { error: updateError } = await supabase  
            .from('friend_requests')  
            .update({ status: 'accepted' })  
            .eq('id', requestId);  

        if (updateError) throw updateError;  

        // 2. Add to friends table (both directions)  
        const { error: friendError1 } = await supabase  
            .from('friends')  
            .insert({   
                user_id: currentUser.id,   
                friend_id: senderId,  
                created_at: new Date().toISOString()  
            });  

        const { error: friendError2 } = await supabase  
            .from('friends')  
            .insert({   
                user_id: senderId,   
                friend_id: currentUser.id,  
                created_at: new Date().toISOString()  
            });  

        if (friendError1 || friendError2) {  
            console.log("Friend insertion errors (might already exist):", friendError1?.message, friendError2?.message);  
            // Continue anyway - might already exist  
        }  

        // 3. Update UI  
        await loadNotifications();  
        await loadFriends();  
        await updateNotificationsBadge();  

        alert(`You are now friends with ${senderName}!`);  

    } catch (error) {  
        console.error("Error accepting friend request:", error);  
        alert("Could not accept friend request.");  
    }
}

// Decline friend request
async function declineFriendRequest(requestId) {
    try {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (error) throw error;  

        await loadNotifications();  
        await updateNotificationsBadge();  

        alert(`Friend request declined.`);  

    } catch (error) {  
        console.error("Error declining friend request:", error);  
        alert("Could not decline friend request.");  
    }
}

// Set up event listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (requestsChannel) {
            supabase.removeChannel(requestsChannel);
        }
    });
}

// Make functions available globally
window.openSearch = openSearch;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.goToHome = goToHome;
window.openSettings = openSettings;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);



// Load user profile, loadFriends, etc. - all the same functions
// ... 

// ====== FIX 3: Attach remaining functions to window ======
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);