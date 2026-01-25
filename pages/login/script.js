// login/script.js - COMPLETE FIXED VERSION
console.log('✨ Login Page Loaded');

// Wait for Supabase
async function waitForSupabase() {
    console.log('⏳ Waiting for Supabase...');
    
    if (window.supabase) {
        console.log('✅ Supabase already loaded');
        return true;
    }
    
    try {
        await import('../../utils/supabase.js');
        
        let attempts = 0;
        while (!window.supabase && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (window.supabase) {
            console.log('✅ Supabase loaded for login page');
            return true;
        } else {
            console.error('❌ Supabase failed to load');
            return false;
        }
    } catch (error) {
        console.error('❌ Supabase import error:', error);
        return false;
    }
}

// Simple auth functions for login page
const auth = {
    async signIn(username, password) {
        if (!window.supabase?.auth) {
            return { success: false, message: 'Connecting to server...' };
        }
        
        try {
            const email = `${username}@luster.test`;
            console.log('Attempting login with:', email);
            
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                console.error('Login error:', error.message);
                
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, message: 'Invalid username or password' };
                }
                
                return { success: false, message: error.message || 'Login failed' };
            }
            
            console.log('✅ Login successful!');
            console.log('User:', data.user?.email);
            console.log('Session active:', !!data.session);
            
            // Force session refresh
            await window.supabase.auth.getSession();
            
            return { success: true, user: data.user, session: data.session };
            
        } catch (error) {
            console.error('Login exception:', error);
            return { success: false, message: 'Connection error. Please try again.' };
        }
    },
    
    async getCurrentUser() {
        if (!window.supabase?.auth) {
            return { success: false };
        }
        
        try {
            const { data, error } = await window.supabase.auth.getUser();
            
            if (error) {
                console.log('Get user error:', error.message);
                return { success: false, error: error.message };
            }
            
            if (data.user) {
                console.log('User found:', data.user.email);
                return { success: true, user: data.user };
            } else {
                console.log('No user found');
                return { success: false, error: 'No user' };
            }
            
        } catch (error) {
            console.error('Get user exception:', error);
            return { success: false, error: error.message };
        }
    }
};

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');

if (passwordToggle) {
    passwordToggle.addEventListener('click', function() {
        if (loginPassword.type === 'password') {
            loginPassword.type = 'text';
            this.textContent = '🙈';
        } else {
            loginPassword.type = 'password';
            this.textContent = '👁️';
        }
    });
}

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.style.color = '#ff6b8b';
    }
}

function hideError(element) {
    if (element) {
        element.style.display = 'none';
    }
}

function validateLogin() {
    let isValid = true;
    
    if (!loginUsername || !loginUsername.value.trim()) {
        showError(usernameError, 'Please enter username');
        isValid = false;
    } else {
        hideError(usernameError);
    }
    
    if (!loginPassword || !loginPassword.value) {
        showError(passwordError, 'Please enter password');
        isValid = false;
    } else {
        hideError(passwordError);
    }
    
    return isValid;
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    
    if (!validateLogin()) return;
    
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;
    
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;
    
    try {
        // Ensure Supabase is ready
        const supabaseReady = await waitForSupabase();
        if (!supabaseReady) {
            showError(passwordError, 'Cannot connect to server');
            loginBtn.textContent = originalText;
            loginBtn.disabled = false;
            return;
        }
        
        const result = await auth.signIn(username, password);
        
        if (result.success) {
            console.log('✅ Login successful, redirecting...');
            
            // Add small delay to ensure session is saved
            await new Promise(resolve => setTimeout(resolve, 500));
            
            window.location.href = '../home/index.html';
        } else {
            showError(passwordError, result.message || 'Login failed');
            loginBtn.textContent = originalText;
            loginBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('Login handler error:', error);
        showError(passwordError, 'Something went wrong. Please try again.');
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

async function initLoginPage() {
    console.log('Initializing login page...');
    
    // Wait for Supabase
    const supabaseReady = await waitForSupabase();
    if (!supabaseReady) {
        showError(passwordError, 'Cannot connect to authentication service');
        return;
    }
    
    // Check if already logged in
    console.log('Checking if user is already logged in...');
    const { success, user } = await auth.getCurrentUser();
    
    console.log('Login page auth check:', { success, user: user?.email });
    
    if (success && user) {
        console.log('✅ User already logged in, redirecting to home...');
        
        // Small delay to show user they're being redirected
        setTimeout(() => {
            window.location.href = '../home/index.html';
        }, 500);
        return;
    }
    
    console.log('User not logged in, showing login form');
    
    // Set up event listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (loginUsername) {
        loginUsername.addEventListener('input', function() {
            if (this.value.trim()) {
                hideError(usernameError);
            }
        });
    }
    
    if (loginPassword) {
        loginPassword.addEventListener('input', function() {
            if (this.value) {
                hideError(passwordError);
            }
        });
    }
    
    // Auto-focus username field
    if (loginUsername) {
        setTimeout(() => loginUsername.focus(), 300);
    }
}

window.togglePassword = function() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleBtn = document.querySelector('#passwordToggle');
    
    if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
        }
    }
};

window.handleLogin = handleLogin;

document.addEventListener('DOMContentLoaded', initLoginPage);