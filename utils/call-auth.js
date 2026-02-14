// utils/call-auth.js - SPECIAL VERSION FOR CALL PAGE ONLY
// This version NEVER redirects, just returns status
// Does NOT import or use auth.js at all

import { initializeSupabase } from './supabase.js';

let supabaseInstance = null;

// Lightweight auth check for call page - NEVER redirects
export async function getCallUser() {
    try {
        console.log('🔍 Call page: checking auth (no redirects)');
        
        // Initialize Supabase if needed
        if (!supabaseInstance) {
            console.log('Call page: Initializing Supabase...');
            supabaseInstance = await initializeSupabase();
        }
        
        if (!supabaseInstance || !supabaseInstance.auth) {
            console.log('⚠️ Call page: Auth not available');
            return { success: false, user: null, session: null };
        }
        
        // First try to get session (more reliable)
        console.log('Call page: Checking session...');
        const { data: sessionData, error: sessionError } = await supabaseInstance.auth.getSession();
        
        if (sessionError) {
            console.log('⚠️ Call page: Session error:', sessionError.message);
        }
        
        if (sessionData?.session?.user) {
            console.log('✅ Call page: Found user via session:', sessionData.session.user.email);
            return { 
                success: true, 
                user: sessionData.session.user,
                session: sessionData.session 
            };
        }
        
        // If no session, try getUser as fallback
        console.log('Call page: No session, trying getUser...');
        const { data: userData, error: userError } = await supabaseInstance.auth.getUser();
        
        if (userError) {
            console.log('⚠️ Call page: GetUser error:', userError.message);
        }
        
        if (userData?.user) {
            console.log('✅ Call page: Found user via getUser:', userData.user.email);
            return { 
                success: true, 
                user: userData.user,
                session: null 
            };
        }
        
        console.log('ℹ️ Call page: No authenticated user found - continuing as guest');
        return { success: false, user: null, session: null };
        
    } catch (error) {
        console.log('⚠️ Call page: Auth exception (non-fatal):', error.message);
        return { success: false, user: null, session: null };
    }
}

// Check if we have a valid session without throwing
export async function hasValidSession() {
    try {
        if (!supabaseInstance) {
            supabaseInstance = await initializeSupabase();
        }
        
        const { data } = await supabaseInstance.auth.getSession();
        return !!data.session;
    } catch {
        return false;
    }
}

// Get current user ID if available
export async function getCurrentUserId() {
    try {
        const result = await getCallUser();
        return result.success ? result.user.id : null;
    } catch {
        return null;
    }
}