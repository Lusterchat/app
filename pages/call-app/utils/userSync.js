// pages/call-app/utils/userSync.js - Get user AND friends from old RelayTalk

// Get user from old RelayTalk's localStorage
export function getRelayTalkUser() {
    try {
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
            console.log('No auth data found')
            return null
        }
        
        const parsed = JSON.parse(authData)
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
        
        if (!session?.user) return null
        
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
        console.error('Error getting user:', e)
        return null
    }
}

// Sync user to CallApp database
export async function syncUserToDatabase(supabase, user) {
    try {
        console.log('🔄 Syncing user to CallApp DB:', user.email)
        
        const { data: existing, error: checkError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()
        
        if (checkError) throw checkError
        
        if (existing) {
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
            
            if (updateError) throw updateError
            return updated || existing
        }
        
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
        
        if (insertError) throw insertError
        
        console.log('✅ User created in CallApp DB')
        return created
        
    } catch (error) {
        console.error('❌ Sync failed:', error)
        throw error
    }
}

// NEW: Sync friends from old RelayTalk to CallApp
export async function syncFriendsFromRelayTalk(supabase, userId) {
    try {
        console.log('🔄 Syncing friends from RelayTalk...')
        
        // Try to get friends from old app's localStorage
        let oldFriends = []
        
        // Look for friends data in various possible keys
        const possibleFriendKeys = [
            'friends',
            'relaytalk-friends',
            'user-friends'
        ]
        
        for (const key of possibleFriendKeys) {
            const data = localStorage.getItem(key)
            if (data) {
                try {
                    oldFriends = JSON.parse(data)
                    console.log(`✅ Found friends in: ${key}`)
                    break
                } catch (e) {}
            }
        }
        
        // If we have old friends, sync them
        if (oldFriends && oldFriends.length > 0) {
            console.log(`📝 Syncing ${oldFriends.length} friends...`)
            
            for (const friend of oldFriends) {
                // Check if friend exists in CallApp DB
                const { data: existingFriend } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', friend.id || friend.friend_id)
                    .maybeSingle()
                
                if (existingFriend) {
                    // Add friend relationship
                    await supabase
                        .from('friends')
                        .upsert({
                            user_id: userId,
                            friend_id: existingFriend.id,
                            created_at: new Date().toISOString()
                        }, { onConflict: 'user_id,friend_id' })
                }
            }
        }
        
        console.log('✅ Friend sync complete')
        
    } catch (error) {
        console.error('❌ Friend sync failed:', error)
    }
}

// NEW: Get user's friends list
export async function getUserFriends(supabase, userId) {
    try {
        const { data: friendships } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', userId)
        
        if (!friendships || friendships.length === 0) {
            return []
        }
        
        const friendIds = friendships.map(f => f.friend_id)
        
        const { data: friends } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, status, last_seen')
            .in('id', friendIds)
            .order('username')
        
        return friends || []
        
    } catch (error) {
        console.error('Error getting friends:', error)
        return []
    }
}

// Update user status
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