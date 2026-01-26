// utils/auth.js - COMPLETE VERSION
export const auth = {
    async signIn(username, password) {
        try {
            console.log('🔐 Attempting login for user:', username);
            
            // Ensure Supabase is loaded
            if (!window.supabase) {
                console.log('Waiting for Supabase initialization...');
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            
            if (!window.supabase?.auth) {
                throw new Error('Authentication service not available');
            }
            
            const email = `${username}@luster.test`;
            console.log('Using internal email:', email);
            
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                console.error('❌ Login failed:', error.message);
                
                // User-friendly error messages
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Invalid username or password');
                }
                if (error.message.includes('Email not confirmed')) {
                    throw new Error('Please verify your email first');
                }
                if (error.message.includes('rate limit')) {
                    throw new Error('Too many attempts. Please wait and try again');
                }
                
                throw new Error('Login failed. Please try again.');
            }
            
            console.log('✅ Login successful!');
            console.log('User ID:', data.user.id);
            console.log('Email:', data.user.email);
            console.log('Session created:', !!data.session);
            
            // Verify session is stored
            const { data: sessionCheck } = await window.supabase.auth.getSession();
            console.log('Session verified:', !!sessionCheck.session);
            
            return {
                success: true,
                user: data.user,
                session: data.session,
                message: 'Login successful!'
            };
            
        } catch (error) {
            console.error('❌ Authentication error:', error.message);
            return {
                success: false,
                error: error.message,
                message: error.message
            };
        }
    },
    
    async signOut() {
        try {
            if (window.supabase?.auth) {
                await window.supabase.auth.signOut();
                console.log('✅ Signed out successfully');
            }
            return { success: true, message: 'Logged out successfully' };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async getCurrentUser() {
        try {
            console.log('🔄 Checking current user...');
            
            // Wait for Supabase if needed
            if (!window.supabase) {
                console.log('Supabase not loaded yet, waiting...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (!window.supabase?.auth) {
                console.log('Auth service not available');
                return { 
                    success: false, 
                    error: 'Authentication service unavailable',
                    message: 'Please refresh the page'
                };
            }
            
            // Try to get user
            const { data: userData, error: userError } = await window.supabase.auth.getUser();
            
            if (userError) {
                console.log('Get user error:', userError.message);
                
                // Try session as fallback
                const { data: sessionData } = await window.supabase.auth.getSession();
                if (sessionData.session?.user) {
                    console.log('✅ Found user via session:', sessionData.session.user.email);
                    return {
                        success: true,
                        user: sessionData.session.user,
                        session: sessionData.session,
                        message: 'User authenticated'
                    };
                }
                
                return { 
                    success: false, 
                    error: userError.message,
                    message: 'Not logged in'
                };
            }
            
            if (userData.user) {
                console.log('✅ User found:', userData.user.email);
                return {
                    success: true,
                    user: userData.user,
                    message: 'User authenticated'
                };
            }
            
            console.log('❌ No user found');
            return { 
                success: false, 
                error: 'No user found',
                message: 'Please login to continue'
            };
            
        } catch (error) {
            console.error('❌ Error checking user:', error);
            return { 
                success: false, 
                error: error.message,
                message: 'Authentication error'
            };
        }
    },
    
    async isLoggedIn() {
        try {
            if (!window.supabase?.auth) {
                console.log('Auth not ready');
                return false;
            }
            
            const { data } = await window.supabase.auth.getSession();
            const loggedIn = !!data?.session;
            
            console.log('Login check:', loggedIn ? 'Logged in' : 'Not logged in');
            return loggedIn;
            
        } catch (error) {
            console.error('Login check error:', error);
            return false;
        }
    },
    
    async waitForAuthReady() {
        console.log('⏳ Waiting for auth to be ready...');
        
        let attempts = 0;
        const maxAttempts = 15; // 3 seconds max
        
        while (!window.supabase && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (window.supabase) {
            console.log('✅ Auth ready after', attempts, 'attempts');
            return true;
        }
        
        console.error('❌ Auth not ready after waiting');
        return false;
    }
};