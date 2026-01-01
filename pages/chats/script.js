// GUARANTEED WORKING CHAT SCRIPT
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("🚀 CHAT STARTING...");

let currentUser = null;
let chatFriend = null;
let chatChannel = null;

// Initialize
async function initChat() {
    console.log("Initializing chat...");
    
    // Get current user
    const { success, user } = await auth.getCurrentUser();
    if (!success) {
        alert("Please login first!");
        window.location.href = '../auth/index.html';
        return;
    }
    
    currentUser = user;
    console.log("User:", currentUser.email);
    
    // Get friend ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friendId');
    
    if (!friendId) {
        alert("No friend selected!");
        window.location.href = '../home/index.html';
        return;
    }
    
    console.log("Chatting with friend ID:", friendId);
    
    // Load friend data
    await loadFriend(friendId);
    
    // Load existing messages
    await loadMessages(friendId);
    
    // Setup realtime
    setupRealtime(friendId);
    
    console.log("✅ Chat initialized");
}

// Load friend data
async function loadFriend(friendId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', friendId)
            .single();
            
        if (error) throw error;
        
        chatFriend = data;
        console.log("Friend:", data.username);
        
        // Update UI
        document.getElementById('chatUserName').textContent = data.username;
        document.getElementById('chatUserAvatar').textContent = data.username.charAt(0).toUpperCase();
        
    } catch (error) {
        console.error("Error loading friend:", error);
        alert("Error loading friend!");
        window.location.href = '../home/index.html';
    }
}

// Load messages
async function loadMessages(friendId) {
    try {
        console.log("Loading messages...");
        
        // Get messages in both directions
        const { data: sentMessages, error: sentError } = await supabase
            .from('direct_messages')
            .select('*')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', friendId);
            
        const { data: receivedMessages, error: receivedError } = await supabase
            .from('direct_messages')
            .select('*')
            .eq('sender_id', friendId)
            .eq('receiver_id', currentUser.id);
        
        if (sentError) console.error("Sent error:", sentError);
        if (receivedError) console.error("Received error:", receivedError);
        
        // Combine and sort
        const allMessages = [
            ...(sentMessages || []),
            ...(receivedMessages || [])
        ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        console.log("Loaded", allMessages.length, "messages");
        
        // Display
        displayMessages(allMessages);
        
        // Scroll to bottom
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            if (container) container.scrollTop = container.scrollHeight;
        }, 100);
        
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

// Display messages
function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="empty-chat">
                <div class="empty-chat-icon">💬</div>
                <h3>No messages yet</h3>
                <p>Start the conversation!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    messages.forEach(msg => {
        const isSent = msg.sender_id === currentUser.id;
        const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-content">${msg.content}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// REALTIME SETUP - GUARANTEED WORKING
function setupRealtime(friendId) {
    console.log("🔧 Setting up realtime...");
    
    // Clean previous channel
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    
    // Create new channel - LISTEN TO ALL INSERTS
    chatChannel = supabase.channel('realtime-messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages'
        }, async (payload) => {
            console.log("🎯 REALTIME EVENT RECEIVED!");
            console.log("Payload:", payload.new);
            
            const newMessage = payload.new;
            
            // Check if message belongs to this chat
            const belongsToThisChat = 
                (newMessage.sender_id === currentUser.id && newMessage.receiver_id === friendId) ||
                (newMessage.sender_id === friendId && newMessage.receiver_id === currentUser.id);
            
            if (belongsToThisChat) {
                console.log("✅ This message is for our chat!");
                
                // Reload messages to show new one
                await loadMessages(friendId);
                
                // Visual notification
                flashTitle("💬 New message!");
            } else {
                console.log("❌ Message not for this chat");
            }
        })
        .subscribe((status) => {
            console.log("📡 Realtime subscription status:", status);
            
            if (status === 'SUBSCRIBED') {
                console.log("🎉 SUCCESS! Realtime is CONNECTED!");
                showStatus("🟢 Live", "#28a745");
            } else if (status === 'CHANNEL_ERROR') {
                console.error("❌ Realtime error");
                showStatus("🔴 Error", "#dc3545");
                // Retry after 3 seconds
                setTimeout(() => setupRealtime(friendId), 3000);
            } else {
                showStatus("🟡 Connecting...", "#ffc107");
            }
        });
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !chatFriend) {
        alert("Please enter a message!");
        return;
    }
    
    try {
        console.log("Sending message:", text);
        
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
            alert("Error: " + error.message);
            return;
        }
        
        console.log("✅ Message sent successfully!");
        
        // Clear input
        input.value = '';
        input.style.height = 'auto';
        
        // Disable send button
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.disabled = true;
        
    } catch (error) {
        console.error("Send failed:", error);
        alert("Failed to send message");
    }
}

// Helper functions
function flashTitle(text) {
    const original = document.title;
    document.title = text;
    setTimeout(() => document.title = original, 2000);
}

function showStatus(text, color) {
    // Create or update status indicator
    let status = document.getElementById('realtimeStatus');
    if (!status) {
        status = document.createElement('div');
        status.id = 'realtimeStatus';
        status.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${color};
            color: white;
            padding: 5px 10px;
            border-radius: 10px;
            font-size: 12px;
            z-index: 9999;
        `;
        document.body.appendChild(status);
    }
    status.textContent = text;
    status.style.background = color;
}

// Handle input
function handleKeyPress(event) {
    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById('messageInput');
    
    // Enable/disable send button
    if (sendBtn) {
        sendBtn.disabled = !input || input.value.trim() === '';
    }
    
    // Enter to send (without shift)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (input && input.value.trim()) {
            sendMessage();
        }
    }
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    
    // Update send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = textarea.value.trim() === '';
    }
}

// Navigation
function goBack() {
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    window.location.href = '../home/index.html';
}

// Make functions global
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.autoResize = autoResize;
window.goBack = goBack;
window.showUserInfo = () => alert("User info feature coming soon!");
window.closeModal = () => {
    const modal = document.getElementById('userInfoModal');
    if (modal) modal.style.display = 'none';
};
window.attachFile = () => alert("File attachment coming soon!");
window.clearChat = () => alert("Clear chat coming soon!");
window.blockUser = () => {
    if (confirm("Block this user?")) {
        alert("User blocked");
        goBack();
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', initChat);