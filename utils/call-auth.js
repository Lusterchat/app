// utils/call-auth.js - Uses call-supabase for lightweight auth
import { initCallSupabase, getCallSession, getCallUser } from './call-supabase.js';

let supabaseInstance = null;

// Lightweight auth check for call page - NEVER redirects
export async function getCallUser() {
    try {
        console.log('🔍 Call page: checking auth with lightweight client');
        
        // Initialize call-specific Supabase
        supabaseInstance = await initCallSupabase();
        
        // Try to get session
        const session = await getCallSession();
        
        if (session?.user) {
            console.log('✅ Call page: Found user via session:', session.user.email);
            return { 
                success: true, 
                user: session.user,
                session: session 
            };
        }
        
        // Try getUser as fallback
        const user = await getCallUser();
        
        if (user) {
            console.log('✅ Call page: Found user via getUser:', user.email);
            return { 
                success: true, 
                user: user,
                session: null 
            };
        }
        
        console.log('ℹ️ Call page: No authenticated user - continuing as guest');
        return { success: false, user: null, session: null };
        
    } catch (error) {
        console.log('⚠️ Call page: Auth check failed (non-fatal):', error?.message || 'unknown error');
        return { success: false, user: null, session: null };
    }
}

// Check if we have a valid session
export async function hasValidSession() {
    try {
        const session = await getCallSession();
        return !!session;
    } catch {
        return false;
    }
}

// Get current user ID if available
export async function getCurrentUserId() {
    try {
        const user = await getCallUser();
        return user?.id || null;
    } catch {
        return null;
    }
}