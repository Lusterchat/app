// /app/utils/signaling.js - FIXED VERSION
import { supabase } from './supabase.js';

class SignalingManager {
    constructor() {
        this.supabase = supabase;
        this.channels = new Map();
        this.callbacks = new Map();
        this.currentUserId = null;
    }

    // ==================== INITIALIZATION ====================

    async initialize(userId) {
        this.currentUserId = userId;
        return true;
    }

    // ==================== CALL SIGNALING ====================

    async sendOffer(callId, offer, receiverId) {
        console.log("📤 Sending offer for call:", callId);

        try {
            // Update call with offer in database
            const { error } = await this.supabase
                .from('calls')
                .update({ 
                    sdp_offer: JSON.stringify(offer),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);

            if (error) throw error;

            console.log("✅ Offer sent to database");
            return true;

        } catch (error) {
            console.error("❌ Failed to send offer:", error);
            return false;
        }
    }

    async sendAnswer(callId, answer, receiverId) {
        console.log("📤 Sending answer for call:", callId);

        try {
            // Update call with answer in database
            const { error } = await this.supabase
                .from('calls')
                .update({ 
                    sdp_answer: JSON.stringify(answer),
                    status: 'active',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);

            if (error) throw error;

            console.log("✅ Answer sent to database");
            return true;

        } catch (error) {
            console.error("❌ Failed to send answer:", error);
            return false;
        }
    }

    async sendIceCandidate(callId, candidate, receiverId) {
        console.log("🧊 Sending ICE candidate for call:", callId);

        try {
            // Convert candidate to JSON before sending
            const candidateJson = candidate.toJSON ? candidate.toJSON() : candidate;
            
            // Send via broadcast channel (not storing in database)
            await this.sendToChannel(`call-${callId}`, 'ice-candidate', {
                callId,
                candidate: candidateJson,
                senderId: this.currentUserId,
                receiverId,
                timestamp: new Date().toISOString()
            });

            console.log("✅ ICE candidate sent via channel");
            return true;

        } catch (error) {
            console.error("❌ Failed to send ICE candidate:", error);
            return false;
        }
    }

    async sendCallEvent(callId, event, data = {}, receiverId) {
        console.log("📨 Sending call event:", event, "for call:", callId);

        try {
            // Skip call_logs table if it doesn't exist
            // Just send via realtime
            await this.sendToChannel(`call-${callId}`, 'call-event', {
                callId,
                event,
                data,
                senderId: this.currentUserId,
                receiverId,
                timestamp: new Date().toISOString()
            });

            console.log("✅ Call event sent:", event);
            return true;

        } catch (error) {
            console.error("❌ Failed to send call event:", error);
            return false;
        }
    }

    // ==================== CHANNEL MANAGEMENT ====================

    async subscribeToCall(callId, callbacks = {}) {
        console.log("🔔 Subscribing to call channel:", callId);

        // Store callbacks
        if (callId) {
            this.callbacks.set(callId, callbacks);
        }

        // Create channel
        const channelName = `call-${callId}`;
        
        // Check if already subscribed
        if (this.channels.has(channelName)) {
            console.log("Already subscribed to channel:", channelName);
            return this.channels.get(channelName);
        }

        const channel = this.supabase.channel(channelName);

        // Listen for ICE candidates
        channel.on('broadcast', { event: 'ice-candidate' }, (payload) => {
            const { candidate, senderId } = payload.payload;
            
            // Don't process our own signals
            if (senderId === this.currentUserId) return;
            
            if (callbacks.onIceCandidate) {
                callbacks.onIceCandidate(candidate, senderId);
            }
        });

        // Listen for call events
        channel.on('broadcast', { event: 'call-event' }, (payload) => {
            const { event, data, senderId } = payload.payload;
            
            if (senderId === this.currentUserId) return;
            
            if (callbacks.onCallEvent) {
                callbacks.onCallEvent(event, data, senderId);
            }
        });

        // Listen for call status updates (from database)
        channel.on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${callId}`
        }, (payload) => {
            const call = payload.new;
            
            if (callbacks.onCallUpdate) {
                callbacks.onCallUpdate(call);
            }
            
            // Special handling for status changes
            if (call.status === 'ended' || call.status === 'rejected') {
                if (callbacks.onCallEnded) {
                    callbacks.onCallEnded(call);
                }
            }
        });

        // Subscribe
        channel.subscribe((status) => {
            console.log(`Channel ${channelName} subscription status:`, status);
        });

        // Store channel
        this.channels.set(channelName, channel);

        return channel;
    }

    async unsubscribeFromCall(callId) {
        console.log("🔕 Unsubscribing from call:", callId);

        const channelName = `call-${callId}`;
        const channel = this.channels.get(channelName);
        
        if (channel) {
            try {
                await this.supabase.removeChannel(channel);
                this.channels.delete(channelName);
            } catch (error) {
                console.log("Error removing channel:", error);
            }
        }

        this.callbacks.delete(callId);
    }

    async sendToChannel(channelName, event, payload) {
        try {
            const channel = this.supabase.channel(channelName);
            
            // Use httpSend() to avoid warnings
            await channel.httpSend({
                type: 'broadcast',
                event: event,
                payload: payload
            });
            
            return true;
        } catch (error) {
            console.error(`Failed to send ${event} to channel ${channelName}:`, error);
            return false;
        }
    }

    // ==================== CALL STATUS UPDATES ====================

    async updateCallStatus(callId, status, metadata = {}) {
        console.log("🔄 Updating call status:", status, "for call:", callId);

        try {
            const updateData = {
                status,
                updated_at: new Date().toISOString()
            };

            // Add duration if call ended
            if (status === 'ended' || status === 'missed' || status === 'rejected') {
                updateData.ended_at = new Date().toISOString();

                // Try to get call data for duration calculation
                try {
                    const { data: call } = await this.supabase
                        .from('calls')
                        .select('started_at, initiated_at')
                        .eq('id', callId)
                        .single();

                    if (call && call.started_at) {
                        const startTime = new Date(call.started_at);
                        const endTime = new Date();
                        const duration = Math.floor((endTime - startTime) / 1000);
                        updateData.duration = duration > 0 ? duration : 0;
                    } else if (call && call.initiated_at) {
                        const startTime = new Date(call.initiated_at);
                        const endTime = new Date();
                        const duration = Math.floor((endTime - startTime) / 1000);
                        updateData.duration = duration > 0 ? duration : 0;
                    }
                } catch (durationError) {
                    console.log("Could not calculate duration:", durationError);
                }
            }

            // Add started_at if call became active
            if (status === 'active') {
                updateData.started_at = new Date().toISOString();
            }

            // Merge metadata
            Object.assign(updateData, metadata);

            const { error } = await this.supabase
                .from('calls')
                .update(updateData)
                .eq('id', callId);

            if (error) throw error;

            console.log("✅ Call status updated:", status);
            return true;

        } catch (error) {
            console.error("❌ Failed to update call status:", error);
            return false;
        }
    }

    async getCallData(callId) {
        try {
            const { data: call, error } = await this.supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) throw error;

            return call;

        } catch (error) {
            console.error("❌ Failed to get call data:", error);
            return null;
        }
    }

    async getIceCandidates(callId) {
        try {
            const { data: call, error } = await this.supabase
                .from('calls')
                .select('ice_candidates')
                .eq('id', callId)
                .single();

            if (error) throw error;

            return call?.ice_candidates || [];

        } catch (error) {
            console.error("❌ Failed to get ICE candidates:", error);
            return [];
        }
    }

    // ==================== PRESENCE SIGNALING ====================

    async subscribeToUserPresence(userId, callback) {
        console.log("👁️ Subscribing to user presence:", userId);

        const channelName = `presence-${userId}`;
        
        if (this.channels.has(channelName)) {
            return this.channels.get(channelName);
        }

        const channel = this.supabase.channel(channelName);

        channel.on('broadcast', { event: 'presence-update' }, (payload) => {
            const { status, data } = payload.payload;
            callback(status, data);
        });

        channel.subscribe();
        this.channels.set(channelName, channel);

        return channel;
    }

    async sendPresenceUpdate(userId, status, data = {}) {
        console.log("📤 Sending presence update:", status, "to user:", userId);

        try {
            await this.sendToChannel(`presence-${userId}`, 'presence-update', {
                userId: this.currentUserId,
                status,
                data,
                timestamp: new Date().toISOString()
            });

            return true;

        } catch (error) {
            console.error("❌ Failed to send presence update:", error);
            return false;
        }
    }

    // ==================== CLEANUP ====================

    async cleanup() {
        console.log("🧹 Cleaning up signaling...");

        // Unsubscribe from all channels
        for (const [channelName, channel] of this.channels) {
            try {
                await this.supabase.removeChannel(channel);
            } catch (error) {
                console.log(`Error removing channel ${channelName}:`, error);
            }
        }

        this.channels.clear();
        this.callbacks.clear();

        console.log("✅ Signaling cleanup complete");
    }

    // ==================== EVENT CALLBACKS ====================

    setCallbacks(callId, callbacks) {
        this.callbacks.set(callId, callbacks);
    }

    removeCallbacks(callId) {
        this.callbacks.delete(callId);
    }
}

// Export singleton instance
const signalingManager = new SignalingManager();
export default signalingManager;