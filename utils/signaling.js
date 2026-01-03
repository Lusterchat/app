// /app/utils/signaling.js

import { supabase } from './supabase.js';

class SignalingManager {
    constructor() {
        this.supabase = supabase;
        this.channels = new Map();
        this.callbacks = new Map();
        this.currentUserId = null;
        
        console.log("✅ Signaling Manager initialized");
    }
    
    // ==================== INITIALIZATION ====================
    
    async initialize(userId) {
        this.currentUserId = userId;
        console.log("🔄 Signaling initialized for user:", userId);
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
            
            // Send via realtime for faster delivery
            await this.sendToChannel(`call-${callId}`, {
                type: 'offer',
                callId,
                offer,
                senderId: this.currentUserId,
                receiverId
            });
            
            console.log("✅ Offer sent");
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
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);
            
            if (error) throw error;
            
            // Send via realtime
            await this.sendToChannel(`call-${callId}`, {
                type: 'answer',
                callId,
                answer,
                senderId: this.currentUserId,
                receiverId
            });
            
            console.log("✅ Answer sent");
            return true;
            
        } catch (error) {
            console.error("❌ Failed to send answer:", error);
            return false;
        }
    }
    
    async sendIceCandidate(callId, candidate, receiverId) {
        console.log("🧊 Sending ICE candidate for call:", callId);
        
        try {
            // Save ICE candidate to database (append to array)
            const { data: call } = await this.supabase
                .from('calls')
                .select('ice_candidates')
                .eq('id', callId)
                .single();
            
            const iceCandidates = call?.ice_candidates || [];
            iceCandidates.push({
                candidate: candidate,
                senderId: this.currentUserId,
                timestamp: new Date().toISOString()
            });
            
            const { error } = await this.supabase
                .from('calls')
                .update({ 
                    ice_candidates: iceCandidates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);
            
            if (error) throw error;
            
            // Send via realtime for faster delivery
            await this.sendToChannel(`call-${callId}`, {
                type: 'ice-candidate',
                callId,
                candidate,
                senderId: this.currentUserId,
                receiverId
            });
            
            console.log("✅ ICE candidate sent");
            return true;
            
        } catch (error) {
            console.error("❌ Failed to send ICE candidate:", error);
            return false;
        }
    }
    
    async sendCallEvent(callId, event, data = {}, receiverId) {
        console.log("📨 Sending call event:", event, "for call:", callId);
        
        try {
            // Save event to call logs
            await this.supabase
                .from('call_logs')
                .insert({
                    call_id: callId,
                    user_id: this.currentUserId,
                    event_type: event,
                    event_data: data,
                    created_at: new Date().toISOString()
                });
            
            // Send via realtime
            await this.sendToChannel(`call-${callId}`, {
                type: 'call-event',
                callId,
                event,
                data,
                senderId: this.currentUserId,
                receiverId
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
        const channel = this.supabase.channel(channelName);
        
        // Listen for signals
        channel.on('broadcast', { event: 'signal' }, (payload) => {
            this.handleSignal(payload.payload);
        });
        
        // Listen for call events
        channel.on('broadcast', { event: 'call-event' }, (payload) => {
            this.handleCallEvent(payload.payload);
        });
        
        // Subscribe
        channel.subscribe((status) => {
            console.log(`Channel ${channelName} status:`, status);
        });
        
        // Store channel
        this.channels.set(callId, channel);
        
        return channel;
    }
    
    async unsubscribeFromCall(callId) {
        console.log("🔕 Unsubscribing from call:", callId);
        
        const channel = this.channels.get(callId);
        if (channel) {
            this.supabase.removeChannel(channel);
            this.channels.delete(callId);
        }
        
        this.callbacks.delete(callId);
    }
    
    async sendToChannel(channelName, payload) {
        try {
            await this.supabase.channel(channelName).send({
                type: 'broadcast',
                event: 'signal',
                payload
            });
            return true;
        } catch (error) {
            console.error("Failed to send to channel:", error);
            return false;
        }
    }
    
    // ==================== SIGNAL HANDLING ====================
    
    handleSignal(signal) {
        const { type, callId, senderId } = signal;
        
        // Don't process our own signals
        if (senderId === this.currentUserId) return;
        
        console.log("📨 Received signal:", type, "for call:", callId);
        
        const callbacks = this.callbacks.get(callId);
        if (!callbacks) {
            console.warn("No callbacks for call:", callId);
            return;
        }
        
        switch(type) {
            case 'offer':
                if (callbacks.onOffer) {
                    callbacks.onOffer(signal.offer, senderId);
                }
                break;
                
            case 'answer':
                if (callbacks.onAnswer) {
                    callbacks.onAnswer(signal.answer, senderId);
                }
                break;
                
            case 'ice-candidate':
                if (callbacks.onIceCandidate) {
                    callbacks.onIceCandidate(signal.candidate, senderId);
                }
                break;
                
            default:
                console.warn("Unknown signal type:", type);
        }
    }
    
    handleCallEvent(event) {
        const { type, callId, event: eventType, data, senderId } = event;
        
        // Don't process our own events
        if (senderId === this.currentUserId) return;
        
        console.log("📨 Received call event:", eventType, "for call:", callId);
        
        const callbacks = this.callbacks.get(callId);
        if (!callbacks || !callbacks.onCallEvent) return;
        
        callbacks.onCallEvent(eventType, data, senderId);
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
                
                // Get call to calculate duration
                const { data: call } = await this.supabase
                    .from('calls')
                    .select('started_at, initiated_at')
                    .eq('id', callId)
                    .single();
                
                if (call) {
                    const startTime = call.started_at || call.initiated_at;
                    const endTime = new Date();
                    const duration = Math.floor((endTime - new Date(startTime)) / 1000);
                    updateData.duration = duration;
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
        const channel = this.supabase.channel(channelName);
        
        channel.on('broadcast', { event: 'presence' }, (payload) => {
            callback(payload.payload);
        });
        
        channel.subscribe();
        this.channels.set(`presence-${userId}`, channel);
        
        return channel;
    }
    
    async sendPresenceUpdate(userId, status, data = {}) {
        console.log("📤 Sending presence update:", status, "to user:", userId);
        
        try {
            await this.supabase.channel(`presence-${userId}`).send({
                type: 'broadcast',
                event: 'presence',
                payload: {
                    userId: this.currentUserId,
                    status,
                    data,
                    timestamp: new Date().toISOString()
                }
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
        for (const [callId, channel] of this.channels) {
            this.supabase.removeChannel(channel);
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