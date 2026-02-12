// login/script.js - COMPLETE FIXED VERSION

console.log('✨ Login Page Loaded');

// ✅ IMMEDIATE REDIRECT CHECK - ONLY IF LOGGED IN
(function() {
    try {
        const hasSession = localStorage.getItem('supabase.auth.token') || 
                          sessionStorage.getItem('supabase.auth.token');
        
        // ONLY redirect if ALREADY LOGGED IN
        if (hasSession) {
            console.log('✅ Already logged in - redirecting to home');
            window.location.replace('/pages/home/index.html');
            return;
        }
    } catch (e) {
        console.log('Session check error:', e);
    }
})();

// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://blxtldgnssvasuinpyit.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw';

// ============================================
// ENSURE SUPABASE IS INITIALIZED
// ============================================
async function ensureSupabase() {
    console.log('⏳ Checking Supabase...');
    
    if (window.supabase) {
        console.log('✅ Supabase already loaded');
        return true;
    }
    
    try {
        // Wait for Supabase UMD to load
        if (typeof supabase === 'undefined') {
            console.log('⏳ Waiting for Supabase library...');
            let attempts = 0;
            while (typeof supabase === 'undefined' && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
        }
        
        if (typeof supabase !== 'undefined') {
            window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase initialized successfully');
            return true;
        } else {
            console.error('❌ Supabase library not loaded');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Supabase initialization error:', error);
        return false;
    }
}

// ============================================
// LOGIN USER
// ============================================
async function loginUser(username, password) {
    try {
        if (!window.supabase?.auth) {
            throw new Error('Authentication service not ready');
        }

        // Convert username to email format if needed
        const email = username.includes('@') ? username : `${username}@relaytalk.app`;
        console.log('Logging in with:', email);

        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('Login error:', error.message);
            
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Invalid username or password');
            }
            if (error.message.includes('Email not confirmed')) {
                throw new Error('Please verify your email first');
            }
            throw new Error('Login failed. Please try again.');
        }

        console.log('✅ Login successful!');
        return {
            success: true,
            user: data.user
        };

    } catch (error) {
        console.error('Login failed:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// ============================================
// CHECK EXISTING LOGIN
// ============================================
async function checkExistingLogin() {
    try {
        if (!window.supabase?.auth) return false;

        const { data } = await window.supabase.auth.getSession();
        const hasSession = !!data?.session;
        
        if (hasSession) {
            console.log('✅ Already logged in - redirecting to home');
            window.location.replace('/pages/home/index.html');
            return true;
        }
        
        return false;

    } catch (error) {
        console.error('Login check error:', error);
        return false;
    }
}

// ============================================
// DOM ELEMENTS
// ============================================
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');
const loadingOverlay = document.getElementById('loadingOverlay');
const loginBtn = document.getElementById('loginBtn');

// ============================================
// TOGGLE PASSWORD VISIBILITY
// ============================================
if (passwordToggle && loginPassword) {
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

// ============================================
// SHOW ERROR
// ============================================
function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
    
    // Add shake animation
    const parent = element.parentElement;
    if (parent) {
        parent.classList.add('shake');
        setTimeout(() => {
            parent.classList.remove('shake');
        }, 500);
    }
}

// ============================================
// HIDE ERROR
// ============================================
function hideError(element) {
    if (!element) return;
    element.style.display = 'none';
}

// ============================================
// VALIDATE FORM
// ============================================
function validateForm() {
    let isValid = true;

    if (!loginUsername.value.trim()) {
        showError(usernameError, 'Please enter username or email');
        isValid = false;
    } else if (loginUsername.value.trim().length < 3) {
        showError(usernameError, 'Username must be at least 3 characters');
        isValid = false;
    } else {
        hideError(usernameError);
    }

    if (!loginPassword.value) {
        showError(passwordError, 'Please enter password');
        isValid = false;
    } else if (loginPassword.value.length < 6) {
        showError(passwordError, 'Password must be at least 6 characters');
        isValid = false;
    } else {
        hideError(passwordError);
    }

    return isValid;
}

// ============================================
// RESET BUTTON
// ============================================
function resetButton(button, originalText) {
    if (button) {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// ============================================
// SHOW SUCCESS MESSAGE
// ============================================
function showSuccessMessage(message) {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.style.display = 'block';
        successMessage.innerHTML = `
            <div style="text-align: center; padding: 15px;">
                <div style="font-size: 2rem; margin-bottom: 10px;">🎉</div>
                <h3 style="color: #28a745; margin-bottom: 5px;">Success!</h3>
                <p style="color: #666;">${message}</p>
            </div>
        `;
    }
}

// ============================================
// HANDLE LOGIN
// ============================================
async function handleLogin(event) {
    event.preventDefault();

    if (!validateForm()) return;

    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    const originalText = loginBtn ? loginBtn.textContent : 'Sign In';
    
    if (loginBtn) {
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
    }

    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }

    try {
        // Ensure Supabase is ready
        const supabaseReady = await ensureSupabase();
        if (!supabaseReady) {
            showError(passwordError, 'Cannot connect to server. Please check your internet.');
            resetButton(loginBtn, originalText);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            return;
        }

        // Attempt login
        const result = await loginUser(username, password);

        if (result.success) {
            console.log('✅ Login successful, redirecting to home...');
            
            // Show success message
            showSuccessMessage('Login successful! Redirecting...');
            
            // Clear any existing errors
            hideError(usernameError);
            hideError(passwordError);
            
            // Store session flags
            const rememberMe = document.getElementById('rememberMe')?.checked || false;
            
            if (rememberMe) {
                // Session will persist via Supabase
                console.log('✅ Remember me enabled - session will persist');
            }
            
            // ✅ REDIRECT TO HOME PAGE, NOT ROOT
            setTimeout(() => {
                window.location.href = '/pages/home/index.html';
            }, 1000);

        } else {
            // Show error message
            if (result.message.includes('Invalid')) {
                showError(passwordError, result.message);
                // Clear password field
                if (loginPassword) loginPassword.value = '';
            } else {
                showError(passwordError, result.message || 'Login failed');
            }
            
            resetButton(loginBtn, originalText);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            
            // Focus on username or password
            if (result.message.includes('password')) {
                loginPassword?.focus();
            } else {
                loginUsername?.focus();
            }
        }

    } catch (error) {
        console.error('Login handler error:', error);
        showError(passwordError, 'Something went wrong. Please try again.');
        resetButton(loginBtn, originalText);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// ============================================
// INITIALIZE LOGIN PAGE
// ============================================
async function initLoginPage() {
    console.log('Initializing login page...');

    // Check if already logged in (double check)
    const hasSession = localStorage.getItem('supabase.auth.token') || 
                      sessionStorage.getItem('supabase.auth.token');
    
    if (hasSession) {
        console.log('✅ Session found - redirecting to home');
        window.location.replace('/pages/home/index.html');
        return;
    }

    // Initialize Supabase
    await ensureSupabase();
    
    // Check existing login via API
    await checkExistingLogin();

    console.log('User not logged in, showing login form');

    // Setup event listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Clear errors on input
    if (loginUsername) {
        loginUsername.addEventListener('input', function() {
            if (this.value.trim()) hideError(usernameError);
        });
    }

    if (loginPassword) {
        loginPassword.addEventListener('input', function() {
            if (this.value) hideError(passwordError);
        });
    }

    // Auto-focus username field
    if (loginUsername) {
        setTimeout(() => loginUsername.focus(), 300);
    }

    // Hide loading overlay
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', initLoginPage);

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ============================================
window.handleLogin = handleLogin;
