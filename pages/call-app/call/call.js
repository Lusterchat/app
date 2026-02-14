async function joinCall(roomName) {
    try {
        console.log('7️⃣ Joining Jitsi call room:', roomName)
        
        // Remove outgoing UI
        document.getElementById('outgoingUI')?.remove()
        
        document.getElementById('loadingScreen').style.display = 'flex'
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        // Get room info
        const roomInfo = await getRoomInfo(roomName)
        console.log('8️⃣ Room info:', roomInfo)
        
        // Clear the container
        const container = document.getElementById('dailyContainer')
        container.innerHTML = ''
        
        // Create iframe for Jitsi with minimal UI
        const iframe = document.createElement('iframe')
        iframe.allow = 'microphone; camera; autoplay'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.style.background = '#000'
        
        // Build URL with username
        const url = getCallUrl(roomInfo.url, currentUser.username)
        iframe.src = url
        console.log('9️⃣ Iframe URL:', url)
        
        // Add to container
        container.appendChild(iframe)
        dailyIframe = iframe
        
        // Show call screen
        document.getElementById('loadingScreen').style.display = 'none'
        document.getElementById('activeCallScreen').style.display = 'block'
        
        console.log('✅ Jitsi call connected!')
        
    } catch (error) {
        console.error('❌ Join error:', error)
        showError('Failed to join call: ' + error.message)
    }
}