// Chat Page Script
console.log("✨ Luster Chat Page Loaded");

// Current data
let currentUser = null;
let chatFriend = null;
let messages = [];
let isTyping = false;

// Initialize chat page
function initChatPage() {
    console.log("Initializing chat page...");
    
    // Check if user is logged in
    currentUser = JSON.parse(localStorage.getItem('luster_user'));
    
    if (!currentUser) {
        // No user found, redirect to auth
        alert("Please login first!");
        window.location.href = '../auth/index.html';
        return;
    }
    
    // Get friend ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    
    if (!friendId) {
        // No friend specified, go back to home
        alert("No friend selected!");
        window.location.href = '../home/index.html';
        return;
    }
    
    // Load friend data
    loadFriendData(friendId);
    
    // Load messages
    loadMessages(friendId);
    
    // Set up event listeners
    setupEventListeners();
    
    console.log("Chat page initialized");
}

// Load friend data
function loadFriendData(friendId) {
    // Get friends list
    const friends = JSON.parse(localStorage.getItem(`luster_friends_${currentUser.id}`) || '[]');
    chatFriend = friends.find(f => f.id === friendId);
    
    if (!chatFriend) {
        alert("Friend not found!");
        window.location.href = '../home/index.html';
        return;
    }
    
    // Update UI with friend data
    updateChatHeader();
}

// Update chat header
function updateChatHeader() {
    if (!chatFriend) return;
    
    // Update friend name
    document.getElementById('chatUserName').textContent = chatFriend.username;
    
    // Update avatar with first letter
    const firstLetter = chatFriend.username.charAt(0).toUpperCase();
    document.getElementById('chatUserAvatar').textContent = firstLetter;
    
    // Set random color for avatar
    const colors = [
        'linear-gradient(45deg, #667eea, #764ba2)',
        'linear-gradient(45deg, #ff6b8b, #ff8e53)',
        'linear-gradient(45deg, #28a745, #20c997)',
        'linear-gradient(45deg, #17a2b8, #20c997)'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.getElementById('chatUserAvatar').style.background = randomColor;
    
    // Random online status
    const isOnline = Math.random() > 0.3;
    document.getElementById('statusText').textContent = isOnline ? 'Online' : 'Offline';
    document.getElementById('statusDot').className = isOnline ? 'status-dot' : 'status-dot offline';
}

// Load messages
function loadMessages(friendId) {
    // Get messages from localStorage
    const chatId = getChatId(currentUser.id, friendId);
    messages = JSON.parse(localStorage.getItem(`luster_chat_${chatId}`) || '[]');
    
    // Display messages
    displayMessages();
    
    // Scroll to bottom
    setTimeout(() => {
        scrollToBottom();
    }, 100);
}

// Get chat ID (always sorted)
function getChatId(userId1, userId2) {
    const ids = [userId1, userId2].sort();
    return ids.join('_');
}

// Display messages
function displayMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        // Show empty state
        container.innerHTML = `
            <div class="empty-chat">
                <div class="empty-chat-icon">💬</div>
                <h3>No messages yet</h3>
                <p style="margin-top: 10px;">Start the conversation!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    let lastDate = null;
    
    messages.forEach((message, index) => {
        // Check if we need a date separator
        const messageDate = new Date(message.timestamp).toDateString();
        if (messageDate !== lastDate) {
            html += `
                <div class="date-separator">
                    <span>${formatDate(message.timestamp)}</span>
                </div>
            `;
            lastDate = messageDate;
        }
        
        const isSent = message.senderId === currentUser.id;
        const time = formatTime(message.timestamp);
        
        html += `
            <div class="message ${isSent ? 'sent' : 'received'}" 
                 data-message-id="${message.id}"
                 oncontextmenu="showMessageMenu(event, '${message.id}')">
                ${message.text}
                ${message.image ? `
                    <img src="${message.image}" class="message-image" 
                         onclick="viewImage('${message.image}')">
                ` : ''}
                <div class="message-time">
                    ${time}
                    ${isSent ? `
                        <div class="message-status">
                            ${message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Format date for separator
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

// Format time for message
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }).toLowerCase();
}

// Send message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !chatFriend) return;
    
    // Create message object
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        text: text,
        senderId: currentUser.id,
        receiverId: chatFriend.id,
        timestamp: new Date().toISOString(),
        status: 'sent',
        type: 'text'
    };
    
    // Add to messages array
    messages.push(message);
    
    // Save to localStorage
    const chatId = getChatId(currentUser.id, chatFriend.id);
    localStorage.setItem(`luster_chat_${chatId}`, JSON.stringify(messages));
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;
    
    // Display message
    displayMessages();
    
    // Scroll to bottom
    scrollToBottom();
    
    // Simulate typing response after 1-3 seconds
    if (Math.random() > 0.5) {
        setTimeout(() => {
            simulateTyping();
        }, 1000 + Math.random() * 2000);
    }
    
    // Update last seen
    updateLastSeen();
}

// Simulate typing
function simulateTyping() {
    if (!chatFriend || isTyping) return;
    
    isTyping = true;
    document.getElementById('typingIndicator').style.display = 'flex';
    scrollToBottom();
    
    // Send auto-reply after 2-4 seconds
    setTimeout(() => {
        sendAutoReply();
        document.getElementById('typingIndicator').style.display = 'none';
        isTyping = false;
        scrollToBottom();
    }, 2000 + Math.random() * 2000);
}

// Send auto-reply
function sendAutoReply() {
    if (!chatFriend) return;
    
    const replies = [
        "Hey there! 👋",
        "How are you doing?",
        "That's interesting!",
        "Tell me more about that.",
        "I agree with you.",
        "Sounds good to me!",
        "Let's chat more tomorrow.",
        "Have a great day! 😊"
    ];
    
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    
    const message = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        text: randomReply,
        senderId: chatFriend.id,
        receiverId: currentUser.id,
        timestamp: new Date().toISOString(),
        status: 'delivered',
        type: 'text'
    };
    
    // Add to messages array
    messages.push(message);
    
    // Save to localStorage
    const chatId = getChatId(currentUser.id, chatFriend.id);
    localStorage.setItem(`luster_chat_${chatId}`, JSON.stringify(messages));
    
    // Display message
    displayMessages();
}

// Handle key press (Enter to send, Shift+Enter for new line)
function handleKeyPress(event) {
    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById('messageInput');
    
    // Enable/disable send button based on input
    sendBtn.disabled = input.value.trim() === '';
    
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (input.value.trim()) {
            sendMessage();
        }
    }
}

// Auto-resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
    
    // Enable/disable send button
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = textarea.value.trim() === '';
}

// Scroll to bottom of messages
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Go back to home
function goBack() {
    window.location.href = '../home/index.html';
}

// Show user info modal
function showUserInfo() {
    if (!chatFriend) return;
    
    const modal = document.getElementById('userInfoModal');
    const content = document.getElementById('userInfoContent');
    
    // Random online status
    const isOnline = Math.random() > 0.3;
    
    content.innerHTML = `
        <div class="user-info-avatar">
            ${chatFriend.username.charAt(0).toUpperCase()}
        </div>
        
        <div class="user-info-details">
            <h3 class="user-info-name">${chatFriend.username}</h3>
            <p class="user-info-username">${chatFriend.id}</p>
            <div class="user-info-status">
                <span class="status-dot ${isOnline ? '' : 'offline'}"></span>
                ${isOnline ? 'Online' : 'Offline'}
            </div>
        </div>
        
        <div class="user-info-actions">
            <button class="info-action-btn primary" onclick="startVoiceCall()">
                🎤 Voice Call
            </button>
            <button class="info-action-btn secondary" onclick="viewSharedMedia()">
                📷 Shared Media
            </button>
            <button class="info-action-btn danger" onclick="blockUser()">
                🚫 Block User
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// Close modal
function closeModal() {
    document.getElementById('userInfoModal').style.display = 'none';
}

// Attach file (placeholder)
function attachFile() {
    alert("File attachment feature coming soon!\n\nYou'll be able to send:\n• Images\n• Documents\n• Voice messages");
}

// Clear chat
function clearChat() {
    if (!chatFriend || !confirm("Clear all messages in this chat? This cannot be undone.")) {
        return;
    }
    
    const chatId = getChatId(currentUser.id, chatFriend.id);
    localStorage.removeItem(`luster_chat_${chatId}`);
    messages = [];
    displayMessages();
    
    alert("Chat cleared!");
}

// Start voice call (placeholder)
function startVoiceCall() {
    alert("Voice call feature coming soon!");
    closeModal();
}

// View shared media (placeholder)
function viewSharedMedia() {
    alert("Shared media feature coming soon!");
    closeModal();
}

// Block user (placeholder)
function blockUser() {
    if (confirm(`Block ${chatFriend.username}? You won't receive messages from them.`)) {
        alert(`${chatFriend.username} has been blocked.`);
        closeModal();
        goBack();
    }
}

// Show message menu (right-click)
function showMessageMenu(event, messageId) {
    event.preventDefault();
    
    // Remove any existing menu
    const existingMenu = document.querySelector('.message-menu');
    if (existingMenu) existingMenu.remove();
    
    // Create menu
    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    
    menu.innerHTML = `
        <button onclick="copyMessage('${messageId}')">Copy</button>
        <button onclick="deleteMessage('${messageId}')">Delete</button>
        <button onclick="forwardMessage('${messageId}')">Forward</button>
    `;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 10);
}

// Copy message text
function copyMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (message) {
        navigator.clipboard.writeText(message.text)
            .then(() => {
                alert("Message copied!");
            });
    }
}

// Delete message
function deleteMessage(messageId) {
    if (!confirm("Delete this message?")) return;
    
    messages = messages.filter(m => m.id !== messageId);
    
    // Save to localStorage
    const chatId = getChatId(currentUser.id, chatFriend.id);
    localStorage.setItem(`luster_chat_${chatId}`, JSON.stringify(messages));
    
    displayMessages();
}

// Forward message (placeholder)
function forwardMessage(messageId) {
    alert("Forward feature coming soon!");
}

// View image
function viewImage(imageUrl) {
    alert("Image viewer coming soon!\n\nImage URL: " + imageUrl);
}

// Update last seen
function updateLastSeen() {
    if (!chatFriend) return;
    
    // Update friend's last seen in localStorage
    const friends = JSON.parse(localStorage.getItem(`luster_friends_${currentUser.id}`) || '[]');
    const updatedFriends = friends.map(friend => {
        if (friend.id === chatFriend.id) {
            return {
                ...friend,
                lastSeen: new Date().toISOString()
            };
        }
        return friend;
    });
    
    localStorage.setItem(`luster_friends_${currentUser.id}`, JSON.stringify(updatedFriends));
}

// Set up event listeners
function setupEventListeners() {
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('userInfoModal');
        if (event.target === modal) {
            closeModal();
        }
    };
    
    // Escape key closes modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
    
    // Auto-focus on message input
    setTimeout(() => {
        document.getElementById('messageInput').focus();
    }, 500);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initChatPage);