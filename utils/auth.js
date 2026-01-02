// File: utils/auth.js - WITH HEARTBEAT SYSTEM
import { supabase } from './supabase.js'

let heartbeatInterval = null;
let currentUserId = null;

// HEARTBEAT SYSTEM ⏱️
const heartbeat = {
  async start(userId) {
    if (!userId) return;
    
    currentUserId = userId;
    
    // Set initial online status
    await this.updateStatus('online');
    
    // Send heartbeat every 30 seconds
    heartbeatInterval = setInterval(() => {
      this.updateStatus('online');
    }, 30000);
    
    // Update on tab focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateStatus('online');
      }
    });
    
    // Set offline when tab closes
    window.addEventListener('beforeunload', () => {
      this.setOffline();
    });
    
    console.log("❤️ Heartbeat started for user:", userId);
  },
  
  async updateStatus(status) {
    if (!currentUserId) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          status: status,
          last_seen: new Date().toISOString()
        })
        .eq('id', currentUserId);
      console.log("❤️ Status updated to:", status);
    } catch (error) {
      console.log("Heartbeat error:", error);
    }
  },
  
  async setOffline() {
    await this.updateStatus('offline');
  },
  
  stop() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    currentUserId = null;
    console.log("💔 Heartbeat stopped");
  }
};

export const auth = {
  // Sign in existing user - UPDATED WITH HEARTBEAT
  async signIn(username, password) {
    try {
      console.log("🔐 Login attempt:", username);
      
      const internalEmail = `${username}@luster.test`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: password
      });
      
      if (error) throw error;
      
      // START HEARTBEAT AFTER LOGIN
      if (data.user) {
        heartbeat.start(data.user.id);
      }
      
      console.log("✅ Login successful:", username);
      return {
        success: true,
        user: data.user,
        message: 'Login successful!'
      };
      
    } catch (error) {
      console.error('❌ Login error:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Invalid username or password'
      };
    }
  },

  // Sign out - UPDATED WITH HEARTBEAT
  async signOut() {
    try {
      // Set offline before signing out
      await heartbeat.setOffline();
      heartbeat.stop();
      
      await supabase.auth.signOut();
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get current user - UPDATED WITH HEARTBEAT
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (data.user) {
        // START HEARTBEAT IF USER EXISTS (app reloaded)
        heartbeat.start(data.user.id);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
          
        return { 
          success: true, 
          user: data.user,
          profile: profile
        };
      }
      
      return { success: false, error: 'No user found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Check if logged in
  async isLoggedIn() {
    try {
      const { data } = await supabase.auth.getSession();
      return !!data.session;
    } catch (error) {
      return false;
    }
  },

  // NEW: Force offline status (for cleanup)
  async forceOffline() {
    await heartbeat.setOffline();
    heartbeat.stop();
  },

  // NEW: Check if someone is online
  static async isUserOnline(userId) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_seen, status')
        .eq('id', userId)
        .maybeSingle();
        
      if (!profile || !profile.last_seen) return false;
      
      const lastSeen = new Date(profile.last_seen);
      const now = new Date();
      const secondsAgo = (now - last_seen) / 1000;
      
      // Online if seen in last 60 seconds AND status is 'online'
      return secondsAgo < 60 && profile.status === 'online';
    } catch (error) {
      return false;
    }
  },

  // Simple error messages
  getErrorMessage(error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('already') || msg.includes('exists')) {
      return 'Username already taken';
    }
    if (msg.includes('invalid') || msg.includes('incorrect')) {
      return 'Invalid username or password';
    }
    if (msg.includes('password')) {
      return 'Password must be at least 6 characters';
    }
    
    return 'Something went wrong. Please try again.';
  }
};

// Auto-cleanup if module unloads
window.addEventListener('beforeunload', () => {
  if (heartbeatInterval) {
    heartbeat.setOffline();
  }
});

// Export heartbeat for direct access if needed
export { heartbeat };