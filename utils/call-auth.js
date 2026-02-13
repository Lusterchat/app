// utils/call-auth.js - SPECIAL VERSION FOR CALL PAGE ONLY
// This version NEVER redirects, just returns status

import { initializeSupabase } from './supabase.js';

let supabaseInstance = null;

// Lightweight auth check for call page - NEVER redirects
export async function getCallUser() {
    try {
        console.log('🔍 Call page: checking auth (no redirects)');
        
        // Initialize Supabase if needed
        if (!supabaseInstance) {
            supabaseInstance = await initializeSupabase();
        }
        
        if (!supabaseInstance?.auth) {
            console.log('⚠️ Call page: Auth not available');
            return { success: false, user: null };
        }
        
        // Try to get user
        const { data: { user }, error } = await supabaseInstance.auth.getUser();
        
        if (error) {
            console.log('⚠️ Call page: Auth error:', error.message);
            
            // Try session as fallback
            const { data: sessionData } = await supabaseInstance.auth.getSession();
            if (sessionData.session?.user) {
                console.log('✅ Call page: Found user via session');
                return { 
                    success: true, 
                    user: sessionData.session.user,
                    session: sessionData.session 
                };
            }
            
            return { success: false, user: null };
        }
        
        if (user) {
            console.log('✅ Call page: User found:', user.email);
            return { success: true, user };
        }
        
        console.log('⚠️ Call page: No user found');
        return { success: false, user: null };
        
    } catch (error) {
        console.log('⚠️ Call page: Auth exception:', error.message);
        return { success: false, user: null };
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