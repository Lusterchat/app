// File: utils/auth.js - SIMPLE VERSION (no real emails needed)
import { supabase } from './supabase.js'

export const auth = {
  // Sign up new user
  async signUp(username, password, fullName = null) {
    try {
      console.log("🔐 Signup for:", username);
      
      // Use .local domain (always valid for local/testing)
      const email = `${username}@luster.local`;
      
      // Check if username exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();
      
      if (existingUser) {
        throw new Error('Username already taken');
      }
      
      // Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: username, full_name: fullName || username },
          emailRedirectTo: `${window.location.origin}/pages/home/index.html`
        }
      });
      
      if (authError) throw authError;
      
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: username,
          full_name: fullName || username,
          avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
          status: 'online'
        });
      
      if (profileError) throw profileError;
      
      // Auto-login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (loginError) {
        console.warn("Auto-login failed:", loginError);
        // User can login manually
      }
      
      return {
        success: true,
        user: loginData?.user || authData.user,
        message: 'Account created!'
      };
      
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        error: error.message,
        message: error.message.includes('already') ? 
          'Username taken' : 'Signup failed'
      };
    }
  },
  
  // Sign in existing user - SIMPLE
  async signIn(username, password) {
    try {
      // Try .local domain (what we use for signup)
      const email = `${username}@luster.local`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (error) throw error;
      
      return {
        success: true,
        user: data.user,
        message: 'Login successful!'
      };
      
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Invalid username or password'
      };
    }
  },
  
  // Sign out
  async signOut() {
    try {
      await supabase.auth.signOut();
      return { success: true, message: 'Logged out' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Get current user
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Check if logged in
  async isLoggedIn() {
    const result = await this.getCurrentUser();
    return result.success;
  }
};