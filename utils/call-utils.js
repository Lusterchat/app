// utils/call-utils.js - STANDALONE utilities for call page
// NO Supabase dependencies!

// Get user directly from localStorage (works everywhere)
export function getUserFromStorage() {
    try {
        const sessionStr = localStorage.getItem('supabase.auth.token');
        if (!sessionStr) return null;

        const session = JSON.parse(sessionStr);
        const user = session?.user || 
                     session?.currentSession?.user || 
                     session?.currentUser;

        if (user) {
            console.log('✅ Got user from localStorage:', user.email);
            return user;
        }
        return null;
    } catch (error) {
        console.error('❌ Error getting user from storage:', error);
        return null;
    }
}

// Get user display name
export function getDisplayName(user) {
    if (!user) return 'You';
    return user.email?.split('@')[0] || 'User';
}

// Validate room URL
export function isValidRoomUrl(url) {
    if (!url) return false;
    try {
        new URL(url);
        return url.includes('daily.co') || url.includes('dly');
    } catch {
        return false;
    }
}

// Get room from URL or sessionStorage
export function getRoomFromParams() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomUrl = urlParams.get('room');

    if (!roomUrl) {
        try {
            const stored = sessionStorage.getItem('currentCall');
            if (stored) {
                const data = JSON.parse(stored);
                roomUrl = data.roomUrl;
                console.log('📦 Recovered room from sessionStorage');
            }
        } catch (e) {
            console.log('No stored room found');
        }
    }

    return roomUrl;
}