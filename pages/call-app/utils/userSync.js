// pages/call-app/utils/userSync.js - Get user from old RelayTalk

// Get user from old RelayTalk's localStorage
export function getRelayTalkUser() {
    try {
        // Try multiple possible storage keys
        const possibleKeys = [
            'supabase.auth.token',
            'sb-auth-token',
            'sb-refresh-token'
        ]
        
        let authData = null
        for (const key of possibleKeys) {
            const data = localStorage.getItem(key)
            if (data) {
                authData = data
                console.log(`✅ Found auth in: ${key}`)
                break
            }
        }
        
        if (!authData) {
            console.log('No auth data found in localStorage')
            return null
        }
        
        // Parse the auth data
        const parsed = JSON.parse(authData)
        
        // Handle different possible structures
        let session = null
        
        if (parsed.currentSession) {
            session = parsed.currentSession
        } else if (parsed.user) {
            session = parsed
        } else if (parsed.access_token) {
            session = { user: parsed.user || parsed }
        } else if (Array.isArray(parsed) && parsed[0]?.user) {
            session = parsed[0]
        }
        
        if (!session?.user) {
            console.log('No user in session')
            return null
        }
        
        const user = session.user
        
        return {
            id: user.id,
            email: user.email || '',
            username: user.user_metadata?.username || 
                     user.email?.split('@')[0] || 
                     'User',
            avatar_url: user.user_metadata?.avatar_url || null
        }
        
    } catch (e) {
        console.error('Error getting user from RelayTalk:', e)
        return null
    }
}

// Sync user to CallApp database
export async function syncUserToDatabase(supabase, user) {
    try {
        console.log('🔄 Syncing user to CallApp DB:', user.email)
        
        // Check if user exists
        const { data: existing, error: checkError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
        
        if (checkError) {
            console.error('Error checking user:', checkError)
            throw checkError
        }
        
        if (existing) {
            console.log('✅ User already exists, updating status')
            
            // Update status and last_seen
            const { data: updated, error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    status: 'online',
                    last_seen: new Date().toISOString(),
                    username: existing.username || user.username
                })
                .eq('id', user.id)
                .select()
                .single()
            
            if (updateError) {
                console.error('Error updating user:', updateError)
                return existing
            }
            
            return updated || existing
        }
        
        // Create new user
        console.log('📝 Creating new user in CallApp DB')
        
        const newUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
            status: 'online',
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString()
        }
        
        const { data: created, error: insertError } = await supabase
            .from('profiles')
            .insert([newUser])
            .select()
            .single()
        
        if (insertError) {
            console.error('Error creating user:', insertError)
            throw insertError
        }
        
        console.log('✅ User created in CallApp DB:', created.username)
        return created
        
    } catch (error) {
        console.error('❌ Sync failed:', error)
        throw error
    }
}

// Check if user has access
export function checkAccess() {
    const user = getRelayTalkUser()
    if (!user) {
        window.location.href = '/'
        return null
    }
    return user
}

// Update user status (online/offline)
export async function updateUserStatus(supabase, userId, status) {
    try {
        await supabase
            .from('profiles')
            .update({ 
                status: status,
                last_seen: new Date().toISOString()
            })
            .eq('id', userId)
    } catch (error) {
        console.error('Error updating status:', error)
    }
}