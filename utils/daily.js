// Daily.co utility for voice calls
// Mobile-optimized with no SDK dependencies

const DAILY_API_KEY = '909b11ef9f9f9ca6d21f995698e0ce3ce5ce05fde589c12b0fe6664bba974f69';
const DAILY_API_URL = 'https://api.daily.co/v1';

// Create a new Daily.co room
export async function createCallRoom(roomName = null) {
    try {
        // Generate a unique room name if not provided
        const uniqueRoomName = roomName || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: uniqueRoomName,
                privacy: 'private',
                properties: {
                    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
                    enable_chat: false,
                    enable_screenshare: false,
                    start_video_off: true, // Start with video off (voice only)
                    start_audio_off: false, // Start with audio on
                    owner_only_broadcast: false,
                    enable_prejoin_ui: false, // Skip prejoin screen for mobile
                    enable_people_ui: true,
                    enable_pip_ui: false,
                    max_participants: 2,
                    autojoin: true
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create room: ${error}`);
        }

        const room = await response.json();
        
        // Create meeting token for the creator
        const token = await createMeetingToken(room.name);
        
        return {
            room: room,
            url: room.url,
            token: token,
            name: room.name
        };
    } catch (error) {
        console.error('Error creating call room:', error);
        throw error;
    }
}

// Create a meeting token for authentication
export async function createMeetingToken(roomName, isOwner = true) {
    try {
        const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                properties: {
                    room_name: roomName,
                    is_owner: isOwner,
                    enable_prejoin_ui: false,
                    start_video_off: true,
                    start_audio_off: false
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create token');
        }

        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error('Error creating token:', error);
        return null;
    }
}

// Get room info
export async function getRoomInfo(roomName) {
    try {
        const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error('Room not found');
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting room info:', error);
        return null;
    }
}

// Delete room
export async function deleteRoom(roomName) {
    try {
        const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });

        return response.ok;
    } catch (error) {
        console.error('Error deleting room:', error);
        return false;
    }
}

// Generate Daily iframe URL with parameters
export function getCallUrl(roomUrl, token = null, displayName = 'User') {
    const url = new URL(roomUrl);
    
    // Add parameters for mobile
    url.searchParams.set('t', token || '');
    url.searchParams.set('dn', displayName);
    url.searchParams.set('video', '0'); // Start with video off
    url.searchParams.set('audio', '1'); // Start with audio on
    url.searchParams.set('chrome', '0'); // Minimal UI for mobile
    url.searchParams.set('embed', '1'); // Embed mode
    
    return url.toString();
}