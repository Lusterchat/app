// pages/call-app/utils/userSync.js - Get user AND friends from old RelayTalk DATABASE

// Configuration for OLD RelayTalk Supabase
const OLD_SUPABASE_URL = 'https://blxtldgnssvasuinpyit.supabase.co'
const OLD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'

let oldSupabase = null

// Initialize old Supabase client
async function getOldSupabase() {
    if (oldSupabase) return oldSupabase
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY)
    return oldSupabase
}

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
                    username: existing.username || user.username,
                    email: user.email,
                    avatar_url: user.avatar_url || existing.avatar_url
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

// NEW: Sync friends from OLD DATABASE directly
export async function syncFriendsFromOldDatabase(userId) {
    try {
        console.log('🔄 Syncing friends from old RelayTalk DATABASE...')
        
        const oldSupabase = await getOldSupabase()
        
        // 1. Get friends from old database
        const { data: friendships, error } = await oldSupabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', userId)
        
        if (error) {
            console.error('Error fetching friends from old DB:', error)
            return []
        }
        
        if (!friendships || friendships.length === 0) {
            console.log('No friends found in old database')
            return []
        }
        
        console.log(`✅ Found ${friendships.length} friends in old database`)
        
        // 2. Get friend details
        const friendIds = friendships.map(f => f.friend_id)
        
        const { data: friendProfiles, error: profileError } = await oldSupabase
            .from('profiles')
            .select('id, username, avatar_url, status, last_seen')
            .in('id', friendIds)
        
        if (profileError) {
            console.error('Error fetching friend profiles:', profileError)
            return []
        }
        
        return friendProfiles || []
        
    } catch (error) {
        console.error('❌ Friend sync failed:', error)
        return []
    }
}

// NEW: Save friends to CallApp database
export async function saveFriendsToCallApp(supabase, userId, friends) {
    try {
        console.log(`📝 Saving ${friends.length} friends to CallApp DB...`)
        
        // First, ensure all friend profiles exist in CallApp DB
        for (const friend of friends) {
            // Check if friend exists in CallApp DB
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', friend.id)
                .maybeSingle()
            
            if (!existing) {
                // Create friend profile in CallApp DB
                await supabase
                    .from('profiles')
                    .insert([{
                        id: friend.id,
                        username: friend.username,
                        avatar_url: friend.avatar_url,
                        status: friend.status || 'offline',
                        last_seen: friend.last_seen || new Date().toISOString(),
                        created_at: new Date().toISOString()
                    }])
            }
            
            // Create friendship relationship
            await supabase
                .from('friends')
                .upsert({
                    user_id: userId,
                    friend_id: friend.id,
                    created_at: new Date().toISOString()
                }, { onConflict: 'user_id,friend_id' })
        }
        
        console.log('✅ Friends saved to CallApp DB')
        
    } catch (error) {
        console.error('❌ Error saving friends:', error)
    }
}

// Get user's friends list from CallApp
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