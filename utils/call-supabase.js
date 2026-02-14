// utils/supabase.js - ONE INSTANCE TO RULE THEM ALL
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm';

const supabaseUrl = 'https://blxtldgnssvasuinpyit.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw';

// SINGLE INSTANCE - created once
let supabaseInstance = null;

export async function initializeSupabase() {
    if (supabaseInstance) {
        console.log('✅ Using existing Supabase instance');
        return supabaseInstance;
    }

    console.log('🆕 Creating new Supabase instance');
    
    try {
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                storage: window.localStorage
            }
        });

        // Make it globally available for non-module scripts
        window.supabase = supabaseInstance;
        
        console.log('✅ Supabase initialized');
        return supabaseInstance;
    } catch (error) {
        console.error('❌ Supabase init failed:', error);
        throw error;
    }
}

// Get current user - works anywhere
export async function getCurrentUser() {
    try {
        const supabase = await initializeSupabase();
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        return { success: true, user };
    } catch (error) {
        console.log('No user logged in:', error.message);
        return { success: false, user: null };
    }
}

// Get session
export async function getSession() {
    try {
        const supabase = await initializeSupabase();
        const { data: { session }, error } = await supabase.auth.getSession();
        return { success: !error, session, error };
    } catch (error) {
        return { success: false, session: null, error };
    }
}