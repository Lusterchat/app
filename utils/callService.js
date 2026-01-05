import { supabase } from './supabase.js';

class CallService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.userId = null;
        this.speakerMode = false;
        this.isInCall = false;
        this.callStartTime = null;
        this.iceCandidates = [];
        this.signalingManager = null;
        this.isAnswering = false;
        this.pendingIceCandidates = [];
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
    }

    async initialize(userId) {
        this.userId = userId;
        console.log("📞 CallService initialized for:", userId);
        return true;
    }

    async setupSignaling() {
        try {
            const module = await import('./signaling.js');
            this.signalingManager = module.default;
            await this.signalingManager.initialize(this.userId);
            console.log("✅ Signaling manager initialized");
            return this.signalingManager;
        } catch (error) {
            console.error("❌ Signaling setup failed:", error);
            return null;
        }
    }

    async initiateCall(friendId, type = 'voice') {
        console.log("🎯 INITIATE CALL to:", friendId);
        
        try {
            // 1. Get microphone stream
            await this.getLocalMedia();
            console.log("✅ Microphone access granted");

            // 2. Create unique call ID
            const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log("📱 Generated call ID:", callId);

            // 3. Create call record
            const callData = {
                room_id: callId,
                caller_id: this.userId,
                receiver_id: friendId,
                call_type: type,
                status: 'ringing',
                audio_mode: 'mic',
                initiated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log("💾 Inserting call to database:", callData);

            const { data: call, error } = await supabase
                .from('calls')
                .insert([callData])
                .select()
                .single();

            if (error) {
                console.error("❌ Database insert error:", error);
                throw new Error(`Database error: ${error.message}`);
            }

            this.currentCall = call;
            console.log("✅ Call created in database. ID:", call.id);

            // 4. Create WebRTC connection
            await this.createPeerConnection();

            // 5. Add local tracks
            this.addLocalTracks();

            // 6. Create and send offer
            await this.createAndSendOffer();

            // 7. Setup signaling and ICE exchange
            if (!this.signalingManager) {
                await this.setupSignaling();
            }

            if (this.signalingManager) {
                await this.signalingManager.subscribeToCall(call.id, {
                    onAnswer: async (answer, senderId) => {
                        console.log("📥 Received answer from receiver");
                        if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
                            try {
                                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                                console.log("✅ Remote description set from answer");
                            } catch (error) {
                                console.error("❌ Failed to set remote description:", error);
                            }
                        }
                    },
                    onIceCandidate: async (candidate, senderId) => {
                        console.log("🧊 Received ICE candidate from receiver");
                        await this.addIceCandidate(candidate);
                    },
                    onCallEnded: (callData) => {
                        console.log("📞 Receiver ended the call");
                        this.endCall();
                    }
                });
            }

            // 8. Setup ICE candidate handler
            this.setupIceCandidateHandler(call.id, friendId);

            this.isInCall = true;
            console.log("🚀 Call initiated successfully");

            return {
                id: call.id,
                room_id: call.room_id,
                audio_mode: call.audio_mode,
                status: call.status
            };

        } catch (error) {
            console.error("❌ Initiate call FAILED:", error);
            this.cleanup();
            throw error;
        }
    }

    async createPeerConnection() {
        console.log("🔗 Creating peer connection...");
        
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

        this.peerConnection = new RTCPeerConnection(config);
        console.log("✅ Peer connection created");

        // Handle incoming tracks
        this.peerConnection.ontrack = (event) => {
            console.log("🎧 Received remote stream with tracks:", event.streams[0].getTracks().length);
            this.remoteStream = event.streams[0];
            
            // Process any pending ICE candidates
            this.processPendingIceCandidates();
            
            if (this.onRemoteStream) {
                this.onRemoteStream(this.remoteStream);
            }
        };

        // Handle connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("🔌 Connection state changed:", state);
            
            if (this.onCallStateChange) {
                this.onCallStateChange(state);
            }
            
            if (state === 'connected') {
                console.log("✅ WebRTC connection established!");
                this.connectionAttempts = 0;
            } else if (state === 'failed' || state === 'disconnected') {
                console.error("❌ WebRTC connection failed");
                this.connectionAttempts++;
                
                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    console.log("🔄 Attempting to reconnect...");
                    setTimeout(() => this.reconnect(), 1000);
                }
            }
        };

        // Handle ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log("❄️ ICE connection state:", this.peerConnection.iceConnectionState);
        };

        // Handle ICE gathering state
        this.peerConnection.onicegatheringstatechange = () => {
            console.log("❄️ ICE gathering state:", this.peerConnection.iceGatheringState);
        };

        return this.peerConnection;
    }

    addLocalTracks() {
        if (!this.localStream || !this.peerConnection) {
            console.error("❌ Cannot add local tracks: no stream or connection");
            return;
        }

        console.log("🎤 Adding local audio tracks...");
        this.localStream.getTracks().forEach(track => {
            console.log("📡 Adding track:", track.kind, track.id);
            this.peerConnection.addTrack(track, this.localStream);
        });
        console.log("✅ Local tracks added");
    }

    async createAndSendOffer() {
        try {
            console.log("📤 Creating offer...");
            const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
                voiceActivityDetection: true,
                iceRestart: false
            };
            
            const offer = await this.peerConnection.createOffer(offerOptions);
            console.log("✅ Offer created");
            
            await this.peerConnection.setLocalDescription(offer);
            console.log("✅ Local description set");

            // Save offer to database
            await this.updateCallInDatabase({
                sdp_offer: JSON.stringify(offer),
                updated_at: new Date().toISOString()
            });

            console.log("📨 Offer saved to database");

        } catch (error) {
            console.error("❌ Failed to create/send offer:", error);
            throw error;
        }
    }

    async answerCall(callId) {
        console.log("📲 ANSWERING CALL:", callId);
        this.isAnswering = true;
        
        try {
            // 1. Get call from database
            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) {
                console.error("❌ Database fetch error:", error);
                throw new Error(`Call not found: ${error.message}`);
            }

            this.currentCall = call;
            console.log("✅ Call found:", {
                id: call.id,
                status: call.status,
                hasOffer: !!call.sdp_offer
            });

            // 2. Get microphone
            await this.getLocalMedia();

            // 3. Create peer connection
            await this.createPeerConnection();

            // 4. Add local tracks
            this.addLocalTracks();

            // 5. Set remote description from offer (CRITICAL!)
            if (call.sdp_offer) {
                try {
                    const offer = JSON.parse(call.sdp_offer);
                    console.log("📥 Setting remote description from offer...");
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                    console.log("✅ Remote description set");
                } catch (offerError) {
                    console.error("❌ Failed to parse/set offer:", offerError);
                    throw offerError;
                }
            } else {
                console.error("❌ No SDP offer found in call!");
                throw new Error("No offer received from caller");
            }

            // 6. Create and send answer
            console.log("📤 Creating answer...");
            const answerOptions = {
                voiceActivityDetection: true
            };
            
            const answer = await this.peerConnection.createAnswer(answerOptions);
            await this.peerConnection.setLocalDescription(answer);
            console.log("✅ Answer created and local description set");

            // 7. Update database with answer
            await this.updateCallInDatabase({
                sdp_answer: JSON.stringify(answer),
                status: 'active',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            console.log("✅ Answer saved to database");

            // 8. Setup signaling and ICE exchange
            if (!this.signalingManager) {
                await this.setupSignaling();
            }

            if (this.signalingManager) {
                await this.signalingManager.subscribeToCall(callId, {
                    onOffer: async (offer, senderId) => {
                        console.log("📥 Received updated offer from caller");
                        // Handle renegotiation if needed
                    },
                    onIceCandidate: async (candidate, senderId) => {
                        console.log("🧊 Received ICE candidate from caller");
                        await this.addIceCandidate(candidate);
                    },
                    onCallEnded: (callData) => {
                        console.log("📞 Caller ended the call");
                        this.endCall();
                    }
                });

                // Send answer via signaling
                await this.signalingManager.sendAnswer(callId, answer, call.caller_id);
            }

            // 9. Setup ICE candidate handler
            this.setupIceCandidateHandler(callId, call.caller_id);

            this.isInCall = true;
            this.callStartTime = Date.now();
            
            // 10. Notify UI
            if (this.onCallStateChange) {
                this.onCallStateChange('active');
            }
            
            console.log("✅ Call answered successfully");

            return true;

        } catch (error) {
            console.error("❌ Answer call FAILED:", error);
            this.isAnswering = false;
            this.cleanup();
            throw error;
        }
    }

    setupIceCandidateHandler(callId, receiverId) {
        if (!this.peerConnection) return;
        
        console.log("🧊 Setting up ICE candidate handler for call:", callId);
        
        // Handle outgoing ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("🧊 Generated ICE candidate:", event.candidate.candidate.substring(0, 50));
                
                // Send via signaling if available
                if (this.signalingManager) {
                    this.signalingManager.sendIceCandidate(
                        callId,
                        event.candidate,
                        receiverId
                    ).catch(error => {
                        console.log("⚠️ Could not send ICE candidate:", error.message);
                    });
                }
                
                // Also save locally
                this.iceCandidates.push(event.candidate);
            } else {
                console.log("✅ ICE gathering complete");
                if (this.peerConnection.iceGatheringState === 'complete') {
                    console.log("🎯 All ICE candidates gathered");
                }
            }
        };
        
        // Handle ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log("❄️ ICE connection state:", this.peerConnection.iceConnectionState);
            
            if (this.peerConnection.iceConnectionState === 'connected' ||
                this.peerConnection.iceConnectionState === 'completed') {
                console.log("✅ ICE connection established!");
            }
        };
    }

    async addIceCandidate(candidate) {
        if (!this.peerConnection) {
            console.log("📦 Queueing ICE candidate (no peer connection yet)");
            this.pendingIceCandidates.push(candidate);
            return;
        }

        try {
            console.log("🧊 Adding ICE candidate...");
            await this.peerConnection.addIceCandidate(candidate);
            console.log("✅ ICE candidate added successfully");
        } catch (error) {
            console.error("❌ Failed to add ICE candidate:", error);
        }
    }

    processPendingIceCandidates() {
        if (this.pendingIceCandidates.length === 0 || !this.peerConnection) return;
        
        console.log(`🔄 Processing ${this.pendingIceCandidates.length} pending ICE candidates...`);
        
        this.pendingIceCandidates.forEach(async (candidate) => {
            await this.addIceCandidate(candidate);
        });
        
        this.pendingIceCandidates = [];
    }

    async getLocalMedia() {
        console.log("🎤 Requesting microphone access...");
        
        try {
            // Stop existing stream if any
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000,
                    sampleSize: 16,
                    latency: 0.01
                },
                video: false
            });

            console.log("✅ Microphone stream obtained");
            return this.localStream;

        } catch (error) {
            console.error("❌ Microphone access denied:", error);
            throw new Error(`Microphone permission required: ${error.message}`);
        }
    }

    async toggleSpeakerMode() {
        console.log("🔊 TOGGLE SPEAKER MODE called");
        
        if (!this.currentCall) {
            console.error("❌ CANNOT TOGGLE: No current call");
            return this.speakerMode;
        }

        console.log("📊 Before toggle:", {
            speakerMode: this.speakerMode,
            callId: this.currentCall.id,
            currentAudioMode: this.currentCall.audio_mode
        });

        // Toggle the mode
        this.speakerMode = !this.speakerMode;
        const newAudioMode = this.speakerMode ? 'speaker' : 'mic';
        
        console.log("🔄 Changing to:", newAudioMode);

        try {
            // 1. Update database FIRST
            console.log("💾 Updating database...");
            const updateSuccess = await this.updateCallInDatabase({
                audio_mode: newAudioMode,
                updated_at: new Date().toISOString()
            });

            if (!updateSuccess) {
                throw new Error("Database update failed");
            }

            // 2. Update local object
            if (this.currentCall) {
                this.currentCall.audio_mode = newAudioMode;
            }

            console.log("✅ Database updated successfully");

            // 3. Notify UI
            if (this.onSpeakerModeChange) {
                console.log("📢 Notifying UI of speaker change");
                this.onSpeakerModeChange(this.speakerMode);
            }

            // 4. Apply audio routing
            this.applyAudioRouting();

            return this.speakerMode;

        } catch (error) {
            console.error("❌ Speaker toggle failed:", error);
            // Revert on error
            this.speakerMode = !this.speakerMode;
            return this.speakerMode;
        }
    }

    applyAudioRouting() {
        console.log("🎧 Applying audio routing. Speaker mode:", this.speakerMode);
        
        if (!this.remoteStream) {
            console.log("⚠️ No remote stream to route");
            return;
        }

        // Find audio element with our stream
        const audioElements = document.querySelectorAll('audio');
        
        audioElements.forEach((audio, index) => {
            if (audio.srcObject === this.remoteStream || 
                (audio.srcObject && audio.srcObject.id === this.remoteStream.id)) {
                
                console.log(`🔊 Audio element ${index + 1}:`, {
                    hasStream: !!audio.srcObject,
                    paused: audio.paused,
                    volume: audio.volume,
                    currentMode: audio.getAttribute('playsinline') ? 'earpiece' : 'speaker'
                });

                if (this.speakerMode) {
                    // SPEAKER MODE - loudspeaker
                    audio.removeAttribute('playsinline');
                    audio.setAttribute('playsinline', 'false');
                    
                    // Try to force speaker output on mobile
                    if (audio.setSinkId) {
                        audio.setSinkId('').catch(e => {
                            console.log("⚠️ Cannot set audio sink:", e.message);
                        });
                    }
                    
                    console.log("🔈 Set to LOUDSPEAKER mode");
                } else {
                    // MIC MODE - earpiece
                    audio.setAttribute('playsinline', 'true');
                    
                    console.log("🎧 Set to EARPIECE mode");
                }

                // Force audio context resume
                if (audio.paused) {
                    audio.play().catch(e => {
                        console.log("⚠️ Audio play error:", e.name);
                    });
                }
            }
        });
    }

    async updateCallInDatabase(updates) {
        if (!this.currentCall || !this.currentCall.id) {
            console.error("❌ Cannot update: No call ID");
            return false;
        }

        console.log("💾 Updating call in database:", {
            callId: this.currentCall.id,
            updates: updates
        });

        try {
            const { data, error } = await supabase
                .from('calls')
                .update(updates)
                .eq('id', this.currentCall.id)
                .select()
                .single();

            if (error) {
                console.error("❌ Database update error:", error);
                return false;
            }

            console.log("✅ Database update successful");
            return true;

        } catch (error) {
            console.error("❌ Update call failed:", error);
            return false;
        }
    }

    async toggleMute() {
        if (!this.localStream) {
            console.error("❌ No local stream to mute");
            return false;
        }

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.error("❌ No audio tracks found");
            return false;
        }

        const currentTrack = audioTracks[0];
        const newState = !currentTrack.enabled;
        
        console.log("🎤 Mute toggle:", {
            currentlyEnabled: currentTrack.enabled,
            newState: newState,
            isMuted: !newState
        });

        audioTracks.forEach(track => {
            track.enabled = newState;
        });

        return !newState; // Return true if now muted
    }

    async endCall() {
        console.log("📞 ENDING CALL");
        
        if (this.currentCall) {
            // Calculate duration
            const duration = this.callStartTime ? 
                Math.floor((Date.now() - this.callStartTime) / 1000) : 0;
            
            console.log("⏱️ Call duration:", duration, "seconds");

            // Update database
            await this.updateCallInDatabase({
                status: 'ended',
                ended_at: new Date().toISOString(),
                duration: duration,
                updated_at: new Date().toISOString()
            });

            // Notify listeners
            if (this.onCallEvent) {
                this.onCallEvent('call_ended', { duration });
            }
        }

        this.cleanup();
        console.log("✅ Call ended cleanly");
    }

    async reconnect() {
        console.log("🔄 Attempting to reconnect...");
        
        if (!this.currentCall || this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error("❌ Cannot reconnect: max attempts reached or no call");
            this.endCall();
            return;
        }

        try {
            // Create new peer connection
            await this.createPeerConnection();
            
            // Add local tracks
            this.addLocalTracks();
            
            // Restart ICE
            const offer = await this.peerConnection.createOffer({ iceRestart: true });
            await this.peerConnection.setLocalDescription(offer);
            
            // Update database with new offer
            await this.updateCallInDatabase({
                sdp_offer: JSON.stringify(offer),
                updated_at: new Date().toISOString()
            });
            
            console.log("✅ Reconnection attempt complete");
        } catch (error) {
            console.error("❌ Reconnection failed:", error);
        }
    }

    cleanup() {
        console.log("🧹 Cleaning up call service...");

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            console.log("🔌 Peer connection closed");
        }

        // Stop media streams
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
            console.log("🎤 Local stream stopped");
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
            console.log("🔊 Remote stream stopped");
        }

        // Cleanup signaling
        if (this.signalingManager && this.currentCall) {
            this.signalingManager.unsubscribeFromCall(this.currentCall.id).catch(() => {});
        }

        // Reset state
        this.currentCall = null;
        this.isInCall = false;
        this.speakerMode = false;
        this.callStartTime = null;
        this.iceCandidates = [];
        this.pendingIceCandidates = [];
        this.connectionAttempts = 0;
        this.isAnswering = false;

        console.log("✅ Cleanup complete");
    }

    // ==================== GETTERS ====================
    getSpeakerMode() {
        return this.speakerMode;
    }

    getMuteState() {
        if (!this.localStream) return false;
        const audioTracks = this.localStream.getAudioTracks();
        return audioTracks.length > 0 ? !audioTracks[0].enabled : false;
    }

    getCurrentCall() {
        return this.currentCall;
    }

    getConnectionState() {
        if (!this.peerConnection) return 'no-connection';
        return this.peerConnection.connectionState;
    }

    // ==================== SETTERS ====================
    setOnCallStateChange(callback) { 
        this.onCallStateChange = callback; 
        console.log("✅ Set onCallStateChange callback");
    }
    
    setOnRemoteStream(callback) { 
        this.onRemoteStream = callback; 
        console.log("✅ Set onRemoteStream callback");
    }
    
    setOnCallEvent(callback) { 
        this.onCallEvent = callback; 
        console.log("✅ Set onCallEvent callback");
    }
    
    setOnSpeakerModeChange(callback) { 
        this.onSpeakerModeChange = callback; 
        console.log("✅ Set onSpeakerModeChange callback");
    }
}

const callService = new CallService();
export default callService;