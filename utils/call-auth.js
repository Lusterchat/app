// utils/call-auth.js - Dedicated auth for call page with recovery
import { initCallSupabase } from './call-supabase.js';

let supabaseInstance = null;

export async function getCallUser() {
    console.log('🔍 Call page: Checking authentication...');

    try {
        // Initialize Supabase
        supabaseInstance = await initCallSupabase();

        if (!supabaseInstance || !supabaseInstance.auth) {
            console.log('⚠️ Call page: Auth not available');
            return { success: false, user: null };
        }

        // Try to get user from auth
        const { data: userData, error: userError } = await supabaseInstance.auth.getUser();

        if (userError) {
            console.log('⚠️ Call page: GetUser error:', userError.message);

            // Try session as fallback
            const { data: sessionData } = await supabaseInstance.auth.getSession();
            if (sessionData.session?.user) {
                console.log('✅ Call page: Found user via session:', sessionData.session.user.email);
                return {
                    success: true,
                    user: sessionData.session.user,
                    session: sessionData.session
                };
            }

            // Try to recover from localStorage like home page
            try {
                const sessionStr = localStorage.getItem('supabase.auth.token');
                if (sessionStr) {
                    const session = JSON.parse(sessionStr);
                    if (session?.user) {
                        console.log('✅ Call page: Recovered user from localStorage');
                        return {
                            success: true,
                            user: session.user,
                            session: session
                        };
                    }
                }
            } catch (e) {}

            return { success: false, user: null };
        }

        if (userData.user) {
            console.log('✅ Call page: User found:', userData.user.email);
            return {
                success: true,
                user: userData.user
            };
        }

        console.log('ℹ️ Call page: No user found - continuing as guest');
        return { success: false, user: null };

    } catch (error) {
        console.log('⚠️ Call page: Auth check failed:', error.message);
        return { success: false, user: null };
    }
}