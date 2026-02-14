// pages/call-app/utils/jitsi.js - COMPLETE FINAL VERSION

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        console.log('🎯 Creating Jitsi room:', uniqueRoomName);
        
        // COMPLETE CONFIG - NO PHONE, NO MODERATOR MESSAGES, AUTO-JOIN
        const jitsiConfig = '#' +
            // ===== CRITICAL: Disable phone numbers =====
            'config.dialInConfCode.enabled=false' +
            '&config.dialInNumbersUrl=""' +
            '&config.dialOutAuthUrl=""' +
            '&config.dialOutEnabled=false' +
            '&config.enableDialIn=false' +
            '&config.phoneEnabled=false' +
            
            // ===== Disable moderator messages =====
            '&config.disableModeratorIndicator=true' +
            '&config.hideModeratorMessage=true' +
            '&config.notificationTimeouts.moderator=1' +
            
            // ===== AUTO-JOIN (MOST IMPORTANT) =====
            '&config.prejoinPageEnabled=false' +
            '&config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.enableWelcomePage=false' +
            
            // ===== Hide everything =====
            '&config.disableChat=true' +
            '&config.disableInviteFunctions=true' +
            '&config.disableRecording=true' +
            '&config.disableLiveStreaming=true' +
            '&config.hideConferenceTimer=true' +
            '&config.hideParticipantsStats=true' +
            '&config.hideLogo=true' +
            '&config.hideWatermark=true' +
            '&config.hideBrandWatermark=true' +
            '&config.hideHelpButton=true' +
            '&config.hideShareButton=true' +
            '&config.hideVideoQualityLabel=true' +
            '&config.hideAddPersonButton=true' +
            '&config.hideMeetingName=true' +
            '&config.hideSubject=true' +
            
            // ===== Only show essential buttons =====
            '&config.toolbarButtons=["microphone","camera","hangup"]' +
            '&config.toolbarAlwaysVisible=true' +
            
            // ===== Audio settings =====
            '&config.disableAudioLevel=false' +
            '&config.enableNoAudioDetection=true' +
            '&config.enableNoisyMicDetection=true' +
            '&config.channelLastN=2' +
            
            // ===== Disable reactions and raise hand =====
            '&config.disableReactions=true' +
            '&config.disableRaiseHand=true' +
            
            // ===== Interface tweaks =====
            '&config.disableFilmstripAutoHide=false' +
            '&config.disableTileView=true' +
            '&config.disableShortcuts=true' +
            '&config.disableSelfViewSettings=true';
        
        return {
            name: uniqueRoomName,
            url: `https://meet.jit.si/${uniqueRoomName}${jitsiConfig}`,
            id: uniqueRoomName
        };
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        throw error;
    }
}

export async function getRoomInfo(roomName) {
    try {
        const jitsiConfig = '#' +
            'config.dialInConfCode.enabled=false' +
            '&config.dialOutEnabled=false' +
            '&config.enableDialIn=false' +
            '&config.phoneEnabled=false' +
            '&config.disableModeratorIndicator=true' +
            '&config.hideModeratorMessage=true' +
            '&config.prejoinPageEnabled=false' +
            '&config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.enableWelcomePage=false' +
            '&config.toolbarButtons=["microphone","camera","hangup"]' +
            '&config.disableChat=true' +
            '&config.disableInviteFunctions=true' +
            '&config.disableReactions=true' +
            '&config.disableRaiseHand=true';
        
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
        return `${roomUrl}&userInfo.displayName=${encodeURIComponent(username)}`;
    } catch (error) {
        return roomUrl;
    }
}