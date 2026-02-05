// ====================
// MAIN SCRIPT - CHAT MODULE LOADER
// ====================
console.log('🚀 RelayTalk Chat Application Starting...');

// This is the main entry point that imports both modules
import './chat-core.js';
import './img-handler.js';

// Global initialization and coordination between modules
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ All chat modules imported successfully!');
    
    // Verify all critical elements are present
    const criticalElements = [
        'messagesContainer',
        'messageInput',
        'sendBtn',
        'attachBtn',
        'customAlert',
        'customToast'
    ];
    
    let allElementsFound = true;
    criticalElements.forEach(id => {
        if (!document.getElementById(id)) {
            console.warn(`⚠️ Critical element not found: ${id}`);
            allElementsFound = false;
        }
    });
    
    if (allElementsFound) {
        console.log('🎉 Chat application ready for use!');
        
        // Setup click outside handler for image picker
        setupImagePickerClickHandler();
        
        // Setup global error handlers
        setupGlobalErrorHandlers();
        
        // Add debug helper
        window.debugChatState = debugChatState;
    } else {
        console.error('❌ Some critical elements are missing from the DOM');
    }
});

// ====================
// FIX: IMAGE PICKER CLICK OUTSIDE HANDLER
// ====================
function setupImagePickerClickHandler() {
    // This fixes the issue where image picker closes immediately
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('imagePickerOverlay');
        const attachBtn = document.getElementById('attachBtn');
        
        // Check if image picker is open
        const isPickerOpen = picker && picker.style.display === 'flex';
        
        if (isPickerOpen && !picker.contains(e.target) && e.target !== attachBtn) {
            // Don't close if clicking on file inputs or preview elements
            if (e.target.id !== 'cameraInput' && 
                e.target.id !== 'galleryInput' &&
                !e.target.closest('#imagePreviewOverlay')) {
                // Use the closeImagePicker function from img-handler.js
                if (typeof closeImagePicker === 'function') {
                    closeImagePicker();
                }
            }
        }
    });
    
    // Also handle touch events for mobile
    document.addEventListener('touchstart', (e) => {
        const picker = document.getElementById('imagePickerOverlay');
        const attachBtn = document.getElementById('attachBtn');
        
        if (picker && picker.style.display === 'flex' && 
            !picker.contains(e.target) && e.target !== attachBtn) {
            e.preventDefault();
        }
    }, { passive: false });
}

// ====================
// COORDINATION FUNCTIONS BETWEEN MODULES
// ====================

// Function to ensure image messages display properly
function setupImageMessageDisplay() {
    // Override the showMessages function in chat-core to handle images
    if (typeof showMessages === 'function') {
        const originalShowMessages = showMessages;
        
        window.showMessages = function(messages) {
            const container = document.getElementById('messagesContainer');
            if (!container) return;

            if (!messages || messages.length === 0) {
                container.innerHTML = `
                    <div class="empty-chat">
                        <svg class="empty-chat-icon" viewBox="0 0 24 24">
                            <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z"/>
                        </svg>
                        <h3>No messages yet</h3>
                        <p style="margin-top: 10px;">Say hello to start the conversation!</p>
                    </div>
                `;
                return;
            }

            let html = '';
            let lastDate = '';

            messages.forEach(msg => {
                const isSent = msg.sender_id === window.currentUser?.id;
                const time = new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const date = new Date(msg.created_at).toLocaleDateString();

                if (date !== lastDate) {
                    html += `<div class="date-separator"><span>${date}</span></div>`;
                    lastDate = date;
                }

                // Get color from database
                const color = msg.color || null;
                const colorAttr = color ? `data-color="${color}"` : '';

                // Check if message has image
                if (msg.image_url && typeof createImageMessageHTML === 'function') {
                    // Use the image message HTML creator from img-handler.js
                    html += createImageMessageHTML(msg, isSent, colorAttr, time);
                } else {
                    // Use text message HTML
                    html += `
                        <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}" ${colorAttr}>
                            <div class="message-content">${msg.content || ''}</div>
                            <div class="message-time">${time}</div>
                        </div>
                    `;
                }
            });

            html += `<div style="height: 30px; opacity: 0;"></div>`;
            container.innerHTML = html;

            setTimeout(() => {
                if (typeof forceScrollToBottom === 'function') {
                    forceScrollToBottom();
                }
            }, 100);
        };
    }
}

// Function to ensure real-time messages with images display properly
function setupRealtimeImageHandling() {
    // Override addMessageToUI to handle image messages
    if (typeof addMessageToUI === 'function') {
        const originalAddMessageToUI = addMessageToUI;
        
        window.addMessageToUI = function(message, isFromRealtime = false) {
            const container = document.getElementById('messagesContainer');
            if (!container || !message) return;

            if (container.querySelector('.empty-chat')) {
                container.innerHTML = '';
            }

            const isSent = message.sender_id === window.currentUser?.id;
            const time = new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            const color = message.color || null;
            const colorAttr = color ? `data-color="${color}"` : '';

            let messageHTML;

            if (message.image_url && typeof createImageMessageHTML === 'function') {
                messageHTML = createImageMessageHTML(message, isSent, colorAttr, time);
            } else {
                messageHTML = `
                    <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message.id}" ${colorAttr}>
                        <div class="message-content">${message.content || ''}</div>
                        <div class="message-time">${time}</div>
                    </div>
                `;
            }

            container.insertAdjacentHTML('beforeend', messageHTML);

            // Check if message already exists
            const isDuplicate = document.querySelector(`[data-message-id="${message.id}"]`);
            if (isDuplicate && isDuplicate !== container.lastElementChild) {
                container.removeChild(container.lastElementChild);
                return;
            }

            // Add to messages array if it exists
            if (window.currentMessages && !window.currentMessages.some(msg => msg.id === message.id)) {
                window.currentMessages.push(message);
            }

            // Animate new message
            const newMessage = container.lastElementChild;
            if (newMessage && isFromRealtime) {
                newMessage.style.opacity = '0';
                newMessage.style.transform = 'translateY(10px)';

                setTimeout(() => {
                    newMessage.style.transition = 'all 0.3s ease';
                    newMessage.style.opacity = '1';
                    newMessage.style.transform = 'translateY(0)';
                }, 10);
            }

            setTimeout(() => {
                if (typeof forceScrollToBottom === 'function') {
                    forceScrollToBottom();
                }
            }, 10);

            if (message.sender_id === window.chatFriend?.id) {
                if (typeof playReceivedSound === 'function') {
                    playReceivedSound();
                }
                if (!document.hasFocus()) {
                    const originalTitle = document.title;
                    document.title = '📸 ' + (window.chatFriend?.username || 'Friend');
                    setTimeout(() => document.title = originalTitle, 1000);
                }
            }
        };
    }
}

// ====================
// GLOBAL ERROR HANDLERS
// ====================
function setupGlobalErrorHandlers() {
    // Global error handler
    window.addEventListener('error', function(e) {
        console.error('Global error caught:', e.error);
        
        const errorMessage = e.error ? e.error.message : 'An unexpected error occurred';
        
        if (typeof showCustomAlert === 'function') {
            showCustomAlert(`Error: ${errorMessage}. Please refresh the page.`, '❌', 'Application Error');
        } else {
            alert(`Error: ${errorMessage}. Please refresh the page.`);
        }
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        
        if (typeof showToast === 'function') {
            showToast('An error occurred. Please try again.', '⚠️');
        }
    });
}

// ====================
// DEBUG HELPER
// ====================
function debugChatState() {
    console.log('=== CHAT DEBUG INFO ===');
    console.log('Current User:', window.currentUser);
    console.log('Chat Friend:', window.chatFriend);
    console.log('Current Messages:', window.currentMessages ? window.currentMessages.length : 0);
    console.log('Is Sending:', window.isSending);
    console.log('Is Typing:', window.isTyping);
    console.log('Selected Color:', window.selectedColor);
    console.log('Image Preview URL:', window.imagePreviewUrl);
    console.log('=====================');
}

// ====================
// INITIALIZATION AFTER MODULES LOAD
// ====================
// Wait a bit for modules to load, then set up coordination
setTimeout(() => {
    console.log('🔧 Setting up module coordination...');
    
    // Setup image message display handling
    setupImageMessageDisplay();
    
    // Setup real-time image handling
    setupRealtimeImageHandling();
    
    console.log('✅ Module coordination complete!');
}, 500);

// Export additional helper functions
window.refreshChat = function() {
    console.log('Refreshing chat...');
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friendId');
    
    if (friendId && typeof loadOldMessages === 'function') {
        loadOldMessages(friendId);
        if (typeof showToast === 'function') {
            showToast('Chat refreshed', '🔄');
        }
    }
};

window.reconnectRealtime = function() {
    console.log('Reconnecting real-time...');
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friendId');
    
    if (friendId && typeof setupRealtime === 'function') {
        // Clean up existing channels
        if (window.chatChannel && typeof supabase !== 'undefined') {
            supabase.removeChannel(window.chatChannel);
        }
        if (window.statusChannel && typeof supabase !== 'undefined') {
            supabase.removeChannel(window.statusChannel);
        }
        
        // Reconnect
        setupRealtime(friendId);
        if (typeof showToast === 'function') {
            showToast('Reconnected', '🔗');
        }
    }
};

console.log('✅ Main script loaded - ready to import modules!');