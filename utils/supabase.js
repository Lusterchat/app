// utils/supabase.js - COMPLETE WORKING VERSION
const supabaseUrl = 'https://blxtldgnssvasuinpyit.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'

let supabase = null;
let isLoading = false;

async function loadSupabase() {
    if (supabase) return supabase;
    if (isLoading) {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (supabase) {
                    clearInterval(check);
                    resolve(supabase);
                }
            }, 100);
        });
    }
    
    isLoading = true;
    console.log('🔄 Loading Supabase...');
    
    try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm');
        supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        window.supabase = supabase;
        console.log('✅ Supabase loaded');
        
        // Test connection
        const { data } = await supabase.auth.getSession();
        console.log('📡 Connection test:', data.session ? 'User logged in' : 'No user');
        
        isLoading = false;
        return supabase;
    } catch (error) {
        console.error('❌ Supabase load failed:', error);
        
        // Create dummy client for offline
        supabase = {
            auth: {
                signInWithPassword: async () => ({ 
                    data: null, 
                    error: { message: 'Network error' } 
                }),
                signUp: async () => ({ 
                    data: null, 
                    error: { message: 'Network error' } 
                }),
                getUser: async () => ({ 
                    data: { user: null }, 
                    error: null 
                }),
                getSession: async () => ({ 
                    data: { session: null }, 
                    error: null 
                }),
                signOut: async () => ({ error: null })
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        maybeSingle: async () => ({ data: null, error: null })
                    })
                }),
                insert: async () => ({ error: { message: 'Network error' } }),
                update: async () => ({ error: { message: 'Network error' } })
            }),
            channel: () => ({
                on: () => ({ subscribe: () => {} })
            })
        };
        
        window.supabase = supabase;
        isLoading = false;
        return supabase;
    }
}

// Auto-load
loadSupabase();

export { supabase, loadSupabase };