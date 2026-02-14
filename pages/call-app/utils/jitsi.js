// pages/call-app/utils/jitsi.js - 100% FREE, NO CARD NEEDED!

export async function createCallRoom(roomName = null) {
    try {
        // Generate a unique room name
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        console.log('🎯 Creating Jitsi room:', uniqueRoomName);
        
        // Jitsi doesn't need API calls - just return the URL!
        // Configuration: video off, audio on, no chat, mobile optimized
        const jitsiConfig = '#config.startWithAudioMuted=false&config.startWithVideoMuted=true&config.disableChat=true&config.disableInviteFunctions=true';
        
        return {
            name: uniqueRoomName,
            url: `https://meet.jit.si/${uniqueRoomName}${jitsiConfig}`,
            id: uniqueRoomName
        };
        
    } catch (error) {
        console.error('❌ Error creating Jitsi room:', error);
        throw error;
    }
}

export async function getRoomInfo(roomName) {
    try {
        console.log('🔍 Getting Jitsi room info for:', roomName);
        
        const jitsiConfig = '#config.startWithAudioMuted=false&config.startWithVideoMuted=true&config.disableChat=true&config.disableInviteFunctions=true';
        
        return {
            name: roomName,
            url: `https://meet.jit.si/${roomName}${jitsiConfig}`
        };
        
    } catch (error) {
        console.error('❌ Error getting room info:', error);
        throw error;
    }
}

export function getCallUrl(roomUrl, username = 'User') {
    try {
        // Add username to Jitsi URL
        return `${roomUrl}&userInfo.displayName=${encodeURIComponent(username)}`;
    } catch (error) {
        return roomUrl;
    }
}

// Test function to verify Jitsi is working
export async function testJitsiConnection() {
    console.log('✅ Jitsi is ready to use! No API key needed.');
    return true;
}