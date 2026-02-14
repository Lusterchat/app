// pages/call/script.js - ULTRA SIMPLE version
// NO IMPORTS! NO DEPENDENCIES!

console.log('🚀 CALL PAGE STARTED - ULTRA SIMPLE MODE');
console.log('🔍 URL:', window.location.href);
console.log('🔍 Params:', window.location.search);

// ===== GET ROOM URL =====
function getRoomUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomUrl = urlParams.get('room');
    
    console.log('📦 Room from URL:', roomUrl);
    
    if (!roomUrl) {
        try {
            const stored = sessionStorage.getItem('currentCall');
            if (stored) {
                const data = JSON.parse(stored);
                roomUrl = data.roomUrl;
                console.log('📦 Room from sessionStorage:', roomUrl);
            }
        } catch(e) {
            console.log('No stored room');
        }
    }
    
    return roomUrl;
}

// ===== GET USER =====
function getUserName() {
    try {
        const sessionStr = localStorage.getItem('supabase.auth.token');
        if (!sessionStr) return 'You';
        
        const session = JSON.parse(sessionStr);
        const user = session?.user || session?.currentSession?.user;
        
        if (user && user.email) {
            return user.email.split('@')[0];
        }
        return 'You';
    } catch(e) {
        console.log('Error getting user:', e);
        return 'You';
    }
}

// ===== MAIN =====
const roomUrl = getRoomUrl();
const userName = getUserName();

console.log('🎯 Final room:', roomUrl);
console.log('👤 User:', userName);

// Update UI
const roomInfo = document.getElementById('roomInfo');
const statusDiv = document.getElementById('status');

if (!roomUrl) {
    statusDiv.innerHTML = '❌ ERROR: No room URL!';
    throw new Error('No room URL');
}

statusDiv.innerHTML = '✅ Room found! Loading Daily.co...';

// Load Daily.co
const script = document.createElement('script');
script.src = 'https://unpkg.com/@daily-co/daily-js';
script.onload = function() {
    console.log('✅ Daily.co loaded');
    statusDiv.innerHTML = '✅ Daily loaded! Starting call...';
    startCall();
};
script.onerror = function() {
    console.error('❌ Failed to load Daily.co');
    statusDiv.innerHTML = '❌ Failed to load Daily.co';
};
document.head.appendChild(script);

function startCall() {
    try {
        console.log('🔧 Creating call...');
        
        // Hide status, show video
        document.getElementById('status').style.display = 'none';
        document.getElementById('roomInfo').style.display = 'none';
        document.getElementById('dailyFrame').style.display = 'block';
        
        // Create call
        const callFrame = window.DailyIframe.createFrame(
            document.getElementById('dailyFrame'),
            {
                showLeaveButton: true,
                iframeStyle: {
                    width: '100%',
                    height: '100%',
                    border: '0'
                }
            }
        );
        
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '🔌 Joining call...';
        
        callFrame.join({
            url: roomUrl,
            userName: userName
        });
        
        callFrame.on('joined-meeting', () => {
            console.log('✅ Joined call!');
            statusDiv.style.display = 'none';
        });
        
        callFrame.on('left-meeting', () => {
            console.log('👋 Left call');
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = 'Call ended';
            document.getElementById('roomInfo').style.display = 'block';
        });
        
    } catch(error) {
        console.error('❌ Error:', error);
        statusDiv.innerHTML = '❌ Error: ' + error.message;
    }
}

// Back button
window.goBack = function() {
    console.log('🔙 Going back');
    window.location.href = '/pages/home/friends/index.html';
};

// Keep alive log
setInterval(() => {
    console.log('⏱️ Still on call page -', new Date().toLocaleTimeString());
}, 2000);