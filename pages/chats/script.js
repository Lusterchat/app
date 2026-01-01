import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Chat Loaded");

let currentUser = null;
let chatFriend = null;
let chatChannel = null;
let statusChannel = null;

// Initialize - NO CHANGES
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { success, user } = await auth.getCurrentUser();
        if (!success || !user) {
            alert("Please login first!");
            window.location.href = '../auth/index.html';
            return;
        }

        currentUser = user;
        console.log("User:", user.email);

        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');

        if (!friendId) {
            alert("No friend selected!");
            window.location.href = '../home/index.html';
            return;
        }

        const { data: friend, error: friendError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', friendId)
            .single();

        if (friendError) throw friendError;

        chatFriend = friend;
        document.getElementById('chatUserName').textContent = friend.username;
        document.getElementById('chatUserAvatar').textContent = friend.username.charAt(0).toUpperCase();

        const isOnline = friend.status === 'online';
        document.getElementById('statusText').textContent = isOnline ? 'Online' : 'Offline';
        document.getElementById('statusDot').className = isOnline ? 'status-dot' : 'status-dot offline';

        await loadOldMessages(friendId);
        setupRealtime(friendId);

        console.log("✅ Chat ready");

    } catch (error) {
        console.error("Init error:", error);
        alert("Error loading chat: " + error.message);
        window.location.href = '../home/index.html';
    }
});

// Load old messages - ONLY FIXED THE FILTER
async function loadOldMessages(friendId) {
    try {
        console.log("Loading messages between:", currentUser.id, "and", friendId);

        // FIXED: Changed OR condition to proper filter
        const { data: messages, error } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Query error:", error);
            throw error;
        }

        // Filter messages to only show messages between these two users
        const filteredMessages = messages?.filter(msg => 
            (msg.sender_id === currentUser.id && msg.receiver_id === friendId) ||
            (msg.sender_id === friendId && msg.receiver_id === currentUser.id)
        ) || [];

        console.log("Loaded", filteredMessages.length, "messages");
        showMessages(filteredMessages);

    } catch (error) {
        console.error("Load error:", error);
        showMessages([]);
    }
}

// Show messages in UI - ONLY FIXED SCROLLING
function showMessages(messages) {
    const container = document.getElementById('messagesContainer');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="empty-chat">
                <div class="empty-chat-icon">💬</div>
                <h3>No messages yet</h3>
                <p style="margin-top: 10px;">Say hello to start the conversation!</p>
            </div>
        `;
        return;
    }

    let html = '';
    let lastDate = '';

    messages.forEach(msg => {
        const isSent = msg.sender_id === currentUser.id;
        const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        const date = new Date(msg.created_at).toLocaleDateString();

        if (date !== lastDate) {
            html += `<div class="date-separator"><span>${date}</span></div>`;
            lastDate = date;
        }

        html += `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-content">${msg.content || ''}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // FIXED: Scroll to bottom after rendering ALL messages
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        // Make sure last message is visible
        const lastMessage = container.lastElementChild;
        if (lastMessage && lastMessage.scrollIntoView) {
            lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, 100);
}

// REAL-TIME - ONLY FIXED THE FILTER
function setupRealtime(friendId) {
    console.log("Setting realtime for friend:", friendId);

    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
    }

    // FIXED: Changed the filter to listen only to relevant messages
    chatChannel = supabase.channel(`dm-${currentUser.id}-${friendId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'direct_messages',
            // FIXED FILTER: Only listen to messages in THIS chat
            filter: `(sender_id=eq.${currentUser.id} and receiver_id=eq.${friendId}) or (sender_id=eq.${friendId} and receiver_id=eq.${currentUser.id})`
        }, async (payload) => {
            console.log("🔥 Database change:", payload.event, payload.new);

            const newMsg = payload.new;
            if (newMsg && 
                ((newMsg.sender_id === currentUser.id && newMsg.receiver_id === friendId) ||
                 (newMsg.sender_id === friendId && newMsg.receiver_id === currentUser.id))) {

                console.log("✅ Relevant message, reloading...");
                await loadOldMessages(friendId);

                const originalTitle = document.title;
                document.title = "💬 New Message!";
                setTimeout(() => {
                    document.title = originalTitle;
                }, 1000);
            }
        })
        .subscribe((status) => {
            console.log("Message channel status:", status);
            updateRealtimeStatus(status);
        });

    statusChannel = supabase.channel(`status-${friendId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${friendId}`
        }, (payload) => {
            console.log("Friend status updated:", payload.new.status);
            chatFriend.status = payload.new.status;

            const isOnline = payload.new.status === 'online';
            document.getElementById('statusText').textContent = isOnline ? 'Online' : 'Offline';
            document.getElementById('statusDot').className = isOnline ? 'status-dot' : 'status-dot offline';
        })
        .subscribe();
}

// Update realtime status indicator
function updateRealtimeStatus(status) {
    let statusEl = document.getElementById('realtimeStatus');
    if (!statusEl) {
        statusEl = createStatus();
    }

    if (status === 'SUBSCRIBED') {
        statusEl.textContent = "🟢 Live";
        statusEl.style.background = '#28a745';
        console.log("🎉 REALTIME WORKING!");
    } else if (status === 'CHANNEL_ERROR') {
        statusEl.textContent = "🔴 Error";
        statusEl.style.background = '#dc3545';
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const friendId = urlParams.get('friendId');
            if (friendId) setupRealtime(friendId);
        }, 3000);
    } else {
        statusEl.textContent = "🟡 Connecting";
        statusEl.style.background = '#ffc107';
    }
}

// Create status indicator
function createStatus() {
    const div = document.createElement('div');
    div.id = 'realtimeStatus';
    div.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ffc107;
        color: white;
        padding: 5px 10px;
        border-radius: 10px;
        font-size: 12px;
        z-index: 9999;
        font-weight: bold;
    `;
    document.body.appendChild(div);
    return div;
}

// Send message - NO CHANGES
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !chatFriend) {
        alert("Please type a message!");
        return;
    }

    try {
        console.log("Sending:", text, "to:", chatFriend.id);

        const { data, error } = await supabase
            .from('direct_messages')
            .insert({
                sender_id: currentUser.id,
                receiver_id: chatFriend.id,
                content: text,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Send error:", error);
            alert("Error sending message: " + error.message);
            return;
        }

        console.log("✅ Message sent:", data);
        input.value = '';
        input.style.height = 'auto';

        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.disabled = true;

        await loadOldMessages(chatFriend.id);

    } catch (error) {
        console.error("Send failed:", error);
        alert("Failed to send message");
    }
}

// Handle Enter key - NO CHANGES
function handleKeyPress(event) {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    if (sendBtn) {
        sendBtn.disabled = !input || input.value.trim() === '';
    }

    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (input && input.value.trim()) {
            sendMessage();
        }
    }
}

// Auto resize textarea - NO CHANGES
function autoResize(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 100);
    textarea.style.height = newHeight + 'px';

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = textarea.value.trim() === '';
    }
}

// Go back - NO CHANGES
function goBack() {
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
    }
    window.location.href = '../home/index.html';
}

// Show user info modal - NO CHANGES
window.showUserInfo = function() {
    if (!chatFriend) {
        alert("User information not available");
        return;
    }

    const modal = document.getElementById('userInfoModal');
    const content = document.getElementById('userInfoContent');
    const isOnline = chatFriend.status === 'online';

    content.innerHTML = `
        <div class="user-info-avatar">
            ${chatFriend.username.charAt(0).toUpperCase()}
        </div>
        <div class="user-info-details">
            <h3 class="user-info-name">${chatFriend.full_name || chatFriend.username}</h3>
            <p class="user-info-username">@${chatFriend.username}</p>
            <div class="user-info-status ${isOnline ? '' : 'offline'}">
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
};

window.closeModal = function() {
    const modal = document.getElementById('userInfoModal');
    if (modal) modal.style.display = 'none';
};

window.startVoiceCall = function() {
    alert("Voice call feature coming soon!");
};

window.viewSharedMedia = function() {
    alert("Shared media feature coming soon!");
};

window.blockUser = function() {
    if (confirm(`Are you sure you want to block ${chatFriend.username}?`)) {
        alert("User blocked!");
        goBack();
    }
};

window.attachFile = function() {
    alert("File attachment feature coming soon!");
};

window.clearChat = async function() {
    if (!confirm("Are you sure you want to clear all messages?")) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');

        const { error } = await supabase
            .from('direct_messages')
            .delete()
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);

        if (error) throw error;

        alert("Chat cleared!");
        await loadOldMessages(friendId);
    } catch (error) {
        console.error("Clear chat error:", error);
        alert("Error clearing chat");
    }
};

// Make functions global - NO CHANGES
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.autoResize = autoResize;
window.goBack = goBack;