// /app/utils/callService.js - COMPLETE WORKING VERSION
import { supabase } from './supabase.js';

class CallService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.isCaller = false;
        this.userId = null;
        this.currentRoomId = null;
        this.callState = 'idle';
        this.callStartTime = null;

        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];

        this.onCallStateChange = null;
        this.onRemoteStream = null;
        this.onCallEvent = null;
    }

    async initialize(userId) {
        this.userId = userId;
        return true;
    }

    async initiateCall(friendId, type = 'voice') {
        try {
            this.isCaller = true;
            const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.currentRoomId = roomId;

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
            this.currentCall = call;

            // Get user media FIRST
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: type === 'video'
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

            // Add local tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Setup event handlers
            this.setupPeerConnection();

            // Create and save offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: type === 'video'
            });
            await this.peerConnection.setLocalDescription(offer);

            await supabase
                .from('calls')
                .update({ 
                    sdp_offer: JSON.stringify(offer),
                    updated_at: new Date().toISOString()
                })
                .eq('id', call.id);

            // Listen for answer
            this.listenForAnswer();
            this.updateState('ringing');

            return call;

        } catch (error) {
            console.error("Initiate call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    async answerCall(callId) {
        try {
            this.isCaller = false;

            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) throw error;
            this.currentCall = call;
            this.currentRoomId = call.room_id;

            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: call.call_type === 'video'
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

            // Add local tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Setup event handlers
            this.setupPeerConnection();

            // Set remote offer
            const offer = JSON.parse(call.sdp_offer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Create and save answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            await supabase
                .from('calls')
                .update({ 
                    sdp_answer: JSON.stringify(answer),
                    status: 'active',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);

            // Listen for ICE candidates
            this.listenForAnswer();
            this.updateState('active');

            return true;

        } catch (error) {
            console.error("Answer call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    setupPeerConnection() {
        // ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                this.sendIceCandidate(event.candidate);
            }
        };

        // REMOTE STREAM - FIXED VERSION
        this.peerConnection.ontrack = (event) => {
            console.log("🎯 Received remote track:", event.track.kind);
            
            // Create new stream or use existing
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }
            
            // Add the track to stream
            this.remoteStream.addTrack(event.track);
            
            // IMPORTANT: Enable the track
            event.track.enabled = true;
            
            console.log("🔊 Audio track added:", {
                enabled: event.track.enabled,
                muted: event.track.muted,
                readyState: event.track.readyState
            });

            // Notify about stream
            if (this.onRemoteStream) {
                // Create a new stream reference to trigger update
                const streamForCallback = new MediaStream();
                this.remoteStream.getTracks().forEach(track => {
                    streamForCallback.addTrack(track);
                });
                
                // Send it after a small delay
                setTimeout(() => {
                    this.onRemoteStream(streamForCallback);
                }, 100);
            }
        };

        // Connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("Connection state:", state);

            if (state === 'connected') {
                this.updateState('active');
                this.callStartTime = Date.now();
            } else if (state === 'disconnected' || state === 'failed') {
                this.endCall();
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            if (state === 'failed') {
                this.endCall();
            }
        };
    }

    async sendIceCandidate(candidate) {
        if (!this.currentCall) return;

        const receiverId = this.isCaller ? 
            this.currentCall.receiver_id : 
            this.currentCall.caller_id;

        try {
            await supabase
                .channel(`call-${this.currentCall.room_id}`)
                .httpSend({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: {
                        callId: this.currentCall.id,
                        candidate: candidate.toJSON(),
                        senderId: this.userId,
                        receiverId: receiverId
                    }
                });
        } catch (error) {
            console.log("Failed to send ICE candidate:", error);
        }
    }

    listenForAnswer() {
        if (!this.currentCall) return;

        const channel = supabase.channel(`call-${this.currentCall.room_id}`);

        channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
            const { candidate, senderId } = payload.payload;
            if (senderId !== this.userId && this.peerConnection) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.log("Failed to add ICE candidate:", error);
                }
            }
        });

        channel.on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${this.currentCall.id}`
        }, async (payload) => {
            const call = payload.new;

            if (this.isCaller && call.sdp_answer) {
                try {
                    const answer = JSON.parse(call.sdp_answer);
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                    this.updateState('active');
                } catch (error) {
                    console.log("Failed to set answer:", error);
                }
            }

            if (call.status === 'ended' || call.status === 'rejected') {
                this.endCall();
            }
        });

        channel.subscribe();
    }

    async endCall() {
        if (this.currentCall) {
            try {
                const duration = this.callStartTime ? 
                    Math.floor((Date.now() - this.callStartTime) / 1000) : 0;

                await supabase
                    .from('calls')
                    .update({
                        status: 'ended',
                        ended_at: new Date().toISOString(),
                        duration: duration,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentCall.id);

                if (this.onCallEvent) {
                    this.onCallEvent('call_ended', { duration });
                }

            } catch (error) {
                console.error("Error ending call:", error);
            }
        }

        this.cleanup();
    }

    async toggleMute() {
        if (!this.localStream) return false;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) return false;
        
        const isMuted = audioTracks[0]?.enabled === false;
        const newState = !isMuted;

        audioTracks.forEach(track => {
            track.enabled = newState;
        });

        return newState;
    }

    updateState(state) {
        this.callState = state;
        if (this.onCallStateChange) {
            this.onCallStateChange(state);
        }
    }

    cleanup() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        this.currentCall = null;
        this.currentRoomId = null;
        this.callState = 'idle';
        this.callStartTime = null;
        this.isCaller = false;
    }

    setOnCallStateChange(callback) { this.onCallStateChange = callback; }
    setOnRemoteStream(callback) { this.onRemoteStream = callback; }
    setOnCallEvent(callback) { this.onCallEvent = callback; }
}

const callService = new CallService();
export default callService;