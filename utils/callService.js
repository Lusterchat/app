// /app/utils/callService.js
import { supabase } from './supabase.js';

class CallService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.isCaller = false;
        this.callType = 'voice';
        this.userId = null;
        
        // State
        this.callState = 'idle';
        this.callStartTime = null;
        this.callTimer = null;
        this.dataChannel = null;
        
        // ICE servers
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
        ];
        
        // Callbacks
        this.onCallStateChange = null;
        this.onRemoteStream = null;
        this.onCallEvent = null;
        
        console.log("✅ Call Service initialized");
    }

    // ==================== INITIALIZATION ====================
    async initialize(userId) {
        this.userId = userId;
        console.log("✅ Call Service ready for:", userId);
        return true;
    }

    // ==================== WEBRTC CORE ====================
    async createPeerConnection() {
        try {
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers
            });

            // Setup event handlers
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.currentCall) {
                    this.sendIceCandidate(event.candidate);
                }
            };

            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }
            };

            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                console.log("📡 Connection state:", state);
                
                if (state === 'connected') {
                    this.updateCallState('active');
                    this.startCallTimer();
                } else if (state === 'disconnected' || state === 'failed') {
                    this.endCall();
                }
            };

            return this.peerConnection;
        } catch (error) {
            console.error("❌ Failed to create peer connection:", error);
            throw error;
        }
    }

    async getLocalMedia(video = false) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: video ? { facingMode: 'user' } : false
            });
            return this.localStream;
        } catch (error) {
            console.error("❌ Failed to get media:", error);
            throw error;
        }
    }

    async addLocalTracks() {
        if (!this.localStream || !this.peerConnection) return;
        
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
    }

    // ==================== CALL FLOW ====================
    async initiateCall(friendId, type = 'voice') {
        try {
            this.callType = type;
            this.isCaller = true;

            // 1. Create call record
            this.currentCall = await this.createCallRecord(friendId, type);
            if (!this.currentCall) throw new Error("Failed to create call");

            // 2. Setup WebRTC
            await this.createPeerConnection();
            await this.getLocalMedia(type === 'video');
            await this.addLocalTracks();

            // 3. Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // 4. Save offer to DB
            await this.saveSDP('offer', offer);

            // 5. Subscribe to call updates
            this.subscribeToCallUpdates();

            // 6. Update UI
            this.updateCallState('ringing');

            return this.currentCall;
        } catch (error) {
            console.error("❌ Initiate call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    async answerCall(callId) {
        try {
            this.isCaller = false;
            
            // 1. Get call data
            this.currentCall = await this.getCallData(callId);
            if (!this.currentCall) throw new Error("Call not found");
            
            this.callType = this.currentCall.call_type || 'voice';

            // 2. Setup WebRTC
            await this.createPeerConnection();
            await this.getLocalMedia(this.callType === 'video');
            await this.addLocalTracks();

            // 3. Set remote offer
            const offer = JSON.parse(this.currentCall.sdp_offer);
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            );

            // 4. Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.saveSDP('answer', answer);

            // 5. Update call status
            await this.updateCallStatus('active');

            // 6. Subscribe to updates
            this.subscribeToCallUpdates();

            // 7. Update UI
            this.updateCallState('active');
            this.startCallTimer();

            return true;
        } catch (error) {
            console.error("❌ Answer call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    // ==================== DATABASE OPERATIONS ====================
    async createCallRecord(friendId, type) {
        try {
            const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const { data: call, error } = await supabase
                .from('calls')
                .insert({
                    room_id: roomId,
                    caller_id: this.userId,
                    receiver_id: friendId,
                    call_type: type,
                    status: 'ringing',
                    initiated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            return call;
        } catch (error) {
            console.error("❌ Create call record failed:", error);
            return null;
        }
    }

    async getCallData(callId) {
        const { data: call, error } = await supabase
            .from('calls')
            .select('*')
            .eq('id', callId)
            .single();
        
        if (error) throw error;
        return call;
    }

    async saveSDP(type, sdp) {
        await supabase
            .from('calls')
            .update({ 
                [`sdp_${type}`]: JSON.stringify(sdp),
                updated_at: new Date().toISOString()
            })
            .eq('id', this.currentCall.id);
    }

    async sendIceCandidate(candidate) {
        if (!this.currentCall) return;

        const receiverId = this.isCaller ? 
            this.currentCall.receiver_id : 
            this.currentCall.caller_id;

        // Save to DB
        await supabase
            .from('call_logs')
            .insert({
                call_id: this.currentCall.id,
                user_id: this.userId,
                event_type: 'ice_candidate',
                event_data: { candidate: candidate.toJSON() }
            });

        // Send via realtime
        await supabase
            .channel(`call-${this.currentCall.room_id}`)
            .send({
                type: 'broadcast',
                event: 'ice-candidate',
                payload: {
                    callId: this.currentCall.id,
                    candidate: candidate.toJSON(),
                    senderId: this.userId,
                    receiverId: receiverId
                }
            });
    }

    // ==================== CALL MANAGEMENT ====================
    async endCall() {
        if (!this.currentCall) return;

        try {
            // Update DB
            await this.updateCallStatus('ended');

            // Cleanup WebRTC
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            // Stop media
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Stop timer
            this.stopCallTimer();

            // Update UI
            this.updateCallState('idle');

            // Reset
            this.currentCall = null;
            this.isCaller = false;

            console.log("✅ Call ended");
        } catch (error) {
            console.error("❌ End call failed:", error);
        }
    }

    async toggleMute() {
        if (!this.localStream) return;
        
        const audioTracks = this.localStream.getAudioTracks();
        const isMuted = audioTracks[0]?.enabled === false;
        const newState = !isMuted;
        
        audioTracks.forEach(track => {
            track.enabled = newState;
        });
        
        return newState; // true = unmuted, false = muted
    }

    async toggleVideo() {
        if (!this.localStream || this.callType !== 'video') return;
        
        const videoTracks = this.localStream.getVideoTracks();
        const isEnabled = videoTracks[0]?.enabled === true;
        const newState = !isEnabled;
        
        videoTracks.forEach(track => {
            track.enabled = newState;
        });
        
        return newState;
    }

    // ==================== SIGNALING LISTENERS ====================
    subscribeToCallUpdates() {
        if (!this.currentCall) return;

        // Listen for answers (for caller)
        supabase
            .channel(`call-${this.currentCall.room_id}`)
            .on('broadcast', { event: 'ice-candidate' }, (payload) => {
                const { candidate, senderId } = payload.payload;
                if (senderId !== this.userId && this.peerConnection) {
                    this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'calls',
                filter: `id=eq.${this.currentCall.id}`
            }, (payload) => {
                const call = payload.new;
                
                // Handle answer if we're caller
                if (this.isCaller && call.sdp_answer) {
                    const answer = JSON.parse(call.sdp_answer);
                    this.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(answer)
                    );
                }
                
                // Handle call ended
                if (call.status === 'ended' || call.status === 'rejected') {
                    this.endCall();
                }
            })
            .subscribe();
    }

    // ==================== UI HELPERS ====================
    updateCallState(state) {
        this.callState = state;
        console.log("🔄 Call state:", state);
        
        if (this.onCallStateChange) {
            this.onCallStateChange(state);
        }
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            if (this.onCallEvent) {
                const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
                this.onCallEvent('duration_update', { duration });
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    async updateCallStatus(status) {
        if (!this.currentCall) return;

        await supabase
            .from('calls')
            .update({
                status: status,
                updated_at: new Date().toISOString(),
                ...(status === 'ended' && {
                    ended_at: new Date().toISOString(),
                    duration: this.callStartTime ? 
                        Math.floor((Date.now() - this.callStartTime) / 1000) : 0
                })
            })
            .eq('id', this.currentCall.id);
    }

    cleanup() {
        this.stopCallTimer();
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.currentCall = null;
        this.callState = 'idle';
    }

    // ==================== GETTERS ====================
    getCallState() { return this.callState; }
    getCurrentCall() { return this.currentCall; }
    getLocalStream() { return this.localStream; }
    getRemoteStream() { return this.remoteStream; }
    isInCall() { return this.callState === 'active'; }

    // ==================== SETTERS ====================
    setOnCallStateChange(callback) { this.onCallStateChange = callback; }
    setOnRemoteStream(callback) { this.onRemoteStream = callback; }
    setOnCallEvent(callback) { this.onCallEvent = callback; }
}

// Export singleton
const callService = new CallService();
export default callService;