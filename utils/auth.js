// utils/auth.js - COMPLETE WORKING VERSION
export const auth = {
    async signIn(username, password) {
        try {
            console.log('🔐 Login attempt:', username);
            
            if (!window.supabase) {
                console.log('Waiting for Supabase...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (!window.supabase?.auth) {
                return {
                    success: false,
                    message: 'Service unavailable. Try again later.'
                };
            }
            
            const email = `${username}@luster.test`;
            console.log('Attempting login with email:', email);
            
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                console.error('Login error:', error.message);
                
                if (error.message.includes('Invalid')) {
                    return {
                        success: false,
                        message: 'Invalid username or password'
                    };
                }
                
                return {
                    success: false,
                    message: 'Login failed. Please try again.'
                };
            }
            
            console.log('✅ Login successful:', data.user?.email);
            return {
                success: true,
                user: data.user,
                message: 'Login successful!'
            };
            
        } catch (error) {
            console.error('Login exception:', error);
            return {
                success: false,
                message: 'Something went wrong. Please try again.'
            };
        }
    },
    
    async signOut() {
        try {
            if (window.supabase?.auth) {
                await window.supabase.auth.signOut();
            }
            return { success: true, message: 'Logged out' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async getCurrentUser() {
        try {
            if (!window.supabase?.auth) {
                return { success: false, error: 'Auth not ready' };
            }
            
            const { data, error } = await window.supabase.auth.getUser();
            
            if (error) {
                console.log('Get user error:', error.message);
                return { success: false, error: error.message };
            }
            
            if (!data.user) {
                return { success: false, error: 'No user found' };
            }
            
            console.log('Current user:', data.user.email);
            return {
                success: true,
                user: data.user,
                profile: null
            };
            
        } catch (error) {
            console.error('Get user exception:', error);
            return { success: false, error: error.message };
        }
    },
    
    async isLoggedIn() {
        try {
            if (!window.supabase?.auth) return false;
            const { data } = await window.supabase.auth.getSession();
            return !!data?.session;
        } catch (error) {
            return false;
        }
    },
    
    getErrorMessage(error) {
        const msg = error?.message?.toLowerCase() || '';
        if (msg.includes('invalid')) return 'Invalid credentials';
        if (msg.includes('password')) return 'Password is incorrect';
        if (msg.includes('user')) return 'User not found';
        return 'Something went wrong';
    }
};