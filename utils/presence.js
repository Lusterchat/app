// /app/utils/presence.js - FIXED VERSION
import { supabase } from './supabase.js';

class PresenceTracker {
    constructor() {
        this.intervalId = null;
        this.userId = null;
        this.isTracking = false;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async start(userId) {
        this.userId = userId;
        this.isTracking = true;

        console.log("👁️ Presence tracking started for:", userId);

        // Initial online status
        await this.updatePresenceWithFunction('general', 'online');

        // Periodic updates (every 45 seconds)
        this.intervalId = setInterval(() => {
            this.updatePresenceWithFunction(
                'general', 
                document.visibilityState === 'visible' ? 'online' : 'away'
            );
        }, 45000);

        // Visibility changes
        document.addEventListener('visibilitychange', () => {
            this.updatePresenceWithFunction(
                'general',
                document.visibilityState === 'visible' ? 'online' : 'away'
            );
        });

        // Page unload
        window.addEventListener('beforeunload', () => this.stop());

        return true;
    }

    async updatePresenceWithFunction(roomId = 'general', status = 'online') {
        if (!this.userId || !this.isTracking) return;

        try {
            // Get the current user's UUID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error("No user found");
                return false;
            }

            // Call database function with CORRECT 3 PARAMETERS
            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: user.id,        // UUID
                p_room_id: roomId,         // TEXT
                p_status: status           // TEXT
            });

            if (error) {
                console.error("Presence function error:", error);
                
                // Fallback to direct upsert if function fails
                return await this.updatePresenceDirectly(roomId, status);
            }

            console.log(`✅ Presence updated via function: ${status}`);
            this.retryCount = 0;
            return true;

        } catch (error) {
            console.error(`❌ Presence update failed:`, error.message);
            return false;
        }
    }

    async updatePresenceDirectly(roomId = 'general', status = 'online') {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { error } = await supabase
                .from('user_presence')
                .upsert({
                    user_id: user.id,
                    room_id: roomId,
                    status: status,
                    is_online: (status === 'online' || status === 'in-call'),
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id, room_id'
                });

            if (error) {
                console.error("Direct presence update failed:", error);
                return false;
            }

            console.log(`✅ Presence updated directly: ${status}`);
            return true;

        } catch (error) {
            console.error("Direct update error:", error);
            return false;
        }
    }

    async stop() {
        this.isTracking = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Mark as offline on exit
        if (this.userId) {
            try {
                await this.updatePresenceWithFunction('general', 'offline');
            } catch (error) {
                console.log("Note: Could not update offline status on exit");
            }
        }

        console.log("👋 Presence tracking stopped");
    }

    async checkOnlineStatus(userId) {
        try {
            const { data: presence, error } = await supabase
                .from('user_presence')
                .select('is_online, last_seen, status')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error || !presence) {
                return { online: false, lastSeen: null, status: 'offline' };
            }

            if (presence.is_online) {
                return { 
                    online: true, 
                    lastSeen: presence.last_seen, 
                    status: presence.status 
                };
            }

            const lastSeen = new Date(presence.last_seen);
            const now = new Date();
            const minutesAway = (now - lastSeen) / (1000 * 60);

            return { 
                online: minutesAway < 2,
                lastSeen: presence.last_seen,
                status: presence.status
            };

        } catch (error) {
            console.error("Error checking online status:", error);
            return { online: false, lastSeen: null, status: 'offline' };
        }
    }

    // Helper method for updating in specific rooms (like calls)
    async updateCallPresence(roomId, callStatus = 'in-call') {
        return await this.updatePresenceWithFunction(roomId, callStatus);
    }
}

// Export singleton instance
const presenceTracker = new PresenceTracker();
export default presenceTracker;