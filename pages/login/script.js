// login/script.js - COMPLETE VERSION with minor SEO enhancements
console.log('✨ RelayTalk Login Page Loaded - Secure Messaging Platform');

// Wait for Supabase
async function ensureSupabase() {
    console.log('⏳ Ensuring Supabase is loaded for RelayTalk...');
    
    if (window.supabase) {
        console.log('✅ Supabase already loaded');
        return true;
    }
    
    try {
        // Load Supabase module
        const modulePath = '../../utils/supabase.js';
        await import(modulePath);
        
        // Wait for initialization
        let attempts = 0;
        while (!window.supabase && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 150));
            attempts++;
        }
        
        if (window.supabase) {
            console.log('✅ Supabase loaded successfully');
            return true;
        } else {
            console.error('❌ Supabase failed to load');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error loading Supabase:', error);
        return false;
    }
}

// Simple login function
async function loginUser(username, password) {
    try {
        if (!window.supabase?.auth) {
            throw new Error('RelayTalk authentication service not ready');
        }
        
        const email = `${username}@relaytalk.test`;
        console.log('Logging in to RelayTalk with:', email);
        
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('RelayTalk login error:', error.message);
            
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Invalid RelayTalk username or password');
            }
            
            throw new Error('RelayTalk login failed. Please try again.');
        }
        
        console.log('✅ RelayTalk Login successful!');
        console.log('User:', data.user.email);
        
        // Verify session is saved
        await window.supabase.auth.getSession();
        
        // SEO: Track successful login (analytics placeholder)
        trackLoginEvent('success', username);
        
        return {
            success: true,
            user: data.user
        };
        
    } catch (error) {
        console.error('RelayTalk login failed:', error);
        
        // SEO: Track failed login (analytics placeholder)
        trackLoginEvent('failed', username);
        
        return {
            success: false,
            message: error.message
        };
    }
}

// SEO Tracking function (placeholder for analytics)
function trackLoginEvent(status, username) {
    try {
        // This is where you would integrate with Google Analytics, etc.
        console.log(`🔍 SEO Tracking: Login ${status} for user: ${username}`);
        
        // Example of tracking events for SEO
        if (window.gtag) {
            window.gtag('event', 'login', {
                'event_category': 'authentication',
                'event_label': status,
                'value': 1
            });
        }
        
        // Send data to your analytics endpoint
        const analyticsData = {
            event: 'login_attempt',
            status: status,
            username: username.substring(0, 3) + '***', // Partial for privacy
            timestamp: new Date().toISOString(),
            platform: 'relaytalk_web',
            page_url: window.location.href
        };
        
        // Uncomment to send to your analytics
        // fetch('https://relaytalk.vercel.app/api/analytics', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(analyticsData)
        // });
        
    } catch (error) {
        console.error('SEO tracking error:', error);
    }
}

// Check if already logged in
async function checkExistingLogin() {
    try {
        if (!window.supabase?.auth) return false;
        
        const { data } = await window.supabase.auth.getSession();
        const isLoggedIn = !!data?.session;
        
        console.log('RelayTalk existing login check:', isLoggedIn ? 'Logged in' : 'Not logged in');
        
        return isLoggedIn;
        
    } catch (error) {
        console.error('RelayTalk login check error:', error);
        return false;
    }
}

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');
const loadingOverlay = document.getElementById('loadingOverlay');

// Toggle password visibility
if (passwordToggle) {
    passwordToggle.addEventListener('click', function() {
        if (loginPassword.type === 'password') {
            loginPassword.type = 'text';
            this.textContent = '🙈';
            this.setAttribute('aria-label', 'Hide password');
        } else {
            loginPassword.type = 'password';
            this.textContent = '👁️';
            this.setAttribute('aria-label', 'Show password');
        }
    });
    
    // Add keyboard support for accessibility (SEO benefit)
    passwordToggle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });
}

// Show error
function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
    
    // Add shake animation
    element.parentElement.classList.add('shake');
    setTimeout(() => {
        element.parentElement.classList.remove('shake');
    }, 500);
    
    // SEO: Track form errors
    if (element.id === 'usernameError') {
        console.log('SEO: Username validation error');
    } else if (element.id === 'passwordError') {
        console.log('SEO: Password validation error');
    }
}

// Hide error
function hideError(element) {
    if (!element) return;
    element.style.display = 'none';
}

// Validate form
function validateForm() {
    let isValid = true;
    
    // Username validation
    if (!loginUsername.value.trim()) {
        showError(usernameError, 'Please enter your RelayTalk username');
        isValid = false;
    } else if (loginUsername.value.trim().length < 3) {
        showError(usernameError, 'Username must be at least 3 characters');
        isValid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(loginUsername.value.trim())) {
        showError(usernameError, 'Username can only contain letters, numbers, and underscores');
        isValid = false;
    } else {
        hideError(usernameError);
    }
    
    // Password validation
    if (!loginPassword.value) {
        showError(passwordError, 'Please enter your password');
        isValid = false;
    } else if (loginPassword.value.length < 6) {
        showError(passwordError, 'Password must be at least 6 characters for security');
        isValid = false;
    } else {
        hideError(passwordError);
    }
    
    return isValid;
}

// Handle form submission
async function handleLogin(event) {
    event.preventDefault();
    
    // SEO: Track form submission attempt
    console.log('🔍 SEO: Login form submission initiated');
    
    if (!validateForm()) return;
    
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    
    // Get login button
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;
    
    // Show loading
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Securely logging in to RelayTalk...';
    loginBtn.disabled = true;
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    try {
        // Ensure Supabase is ready
        const supabaseReady = await ensureSupabase();
        if (!supabaseReady) {
            showError(passwordError, 'Cannot connect to RelayTalk server');
            resetButton(loginBtn, originalText);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            return;
        }
        
        // Attempt login
        const result = await loginUser(username, password);
        
        if (result.success) {
            console.log('✅ RelayTalk Login successful, redirecting to home...');
            
            // Show success message
            const successMessage = document.getElementById('successMessage');
            if (successMessage) {
                successMessage.style.display = 'block';
                successMessage.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">🎉</div>
                        <h3 style="color: #28a745; margin-bottom: 10px;">RelayTalk Login Successful!</h3>
                        <p style="color: #c0c0e0;">Welcome back! Redirecting to your secure messaging dashboard...</p>
                        <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 15px; overflow: hidden;">
                            <div style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); animation: progress 2s linear forwards;"></div>
                        </div>
                    </div>
                `;
            }
            
            // SEO: Update page title for successful login
            document.title = 'RelayTalk - Login Successful | Redirecting...';
            
            // Redirect after delay
            setTimeout(() => {
                window.location.href = '../home/index.html';
            }, 1500);
            
        } else {
            showError(passwordError, result.message || 'RelayTalk login failed');
            resetButton(loginBtn, originalText);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            
            // SEO: Update title for failed login attempt
            document.title = 'RelayTalk - Login Failed | Try Again';
        }
        
    } catch (error) {
        console.error('RelayTalk login handler error:', error);
        showError(passwordError, 'Something went wrong with RelayTalk. Please try again.');
        resetButton(loginBtn, originalText);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        
        // SEO: Update title for error
        document.title = 'RelayTalk - Login Error | Secure Messaging';
    }
}

// Reset button state
function resetButton(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
}

// Initialize login page
async function initLoginPage() {
    console.log('Initializing RelayTalk login page...');
    
    // SEO: Update page title for better user experience
    document.title = 'RelayTalk - Sign In | Secure Messaging Platform';
    
    // Ensure Supabase is loaded
    await ensureSupabase();
    
    // Check if already logged in
    const isLoggedIn = await checkExistingLogin();
    if (isLoggedIn) {
        console.log('✅ User already logged in to RelayTalk, redirecting to home...');
        
        // Show redirect message
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.style.display = 'block';
            successMessage.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">👋</div>
                    <h3 style="color: #667eea; margin-bottom: 10px;">Already Logged In to RelayTalk!</h3>
                    <p style="color: #c0c0e0;">Taking you to your secure messaging dashboard...</p>
                </div>
            `;
        }
        
        // SEO: Update title
        document.title = 'RelayTalk - Already Signed In | Redirecting...';
        
        // Redirect
        setTimeout(() => {
            window.location.href = '../home/index.html';
        }, 1000);
        return;
    }
    
    console.log('User not logged in, showing RelayTalk login form');
    
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
    
    // Auto-focus username field with accessibility
    if (loginUsername) {
        setTimeout(() => {
            loginUsername.focus();
            // SEO: Track field focus
            console.log('🔍 SEO: Username field auto-focused');
        }, 300);
    }
    
    // Hide loading overlay if shown
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    // Add keyboard shortcut for accessibility (SEO benefit)
    document.addEventListener('keydown', function(e) {
        // Alt + L focuses login form
        if (e.altKey && e.key === 'l') {
            e.preventDefault();
            if (loginUsername) loginUsername.focus();
        }
        
        // Escape clears form
        if (e.key === 'Escape') {
            if (loginForm) loginForm.reset();
            hideError(usernameError);
            hideError(passwordError);
        }
    });
}

// Global functions
window.togglePassword = function() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleBtn = document.querySelector('#passwordToggle');
    
    if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
            toggleBtn.setAttribute('aria-label', 'Hide password');
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
            toggleBtn.setAttribute('aria-label', 'Show password');
        }
    }
};

window.handleLogin = handleLogin;

// SEO: Add page load time tracking
window.addEventListener('load', function() {
    const loadTime = window.performance.timing.domContentLoadedEventEnd - 
                     window.performance.timing.navigationStart;
    console.log(`🔍 SEO: Page load time: ${loadTime}ms`);
    
    // Send load time to analytics (placeholder)
    if (loadTime < 2000) {
        console.log('✅ SEO: Excellent page load performance');
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', initLoginPage);

// SEO: Handle page visibility for better user engagement tracking
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        console.log('🔍 SEO: Page became visible - user engaged');
    } else {
        console.log('🔍 SEO: Page hidden - user may have switched tabs');
    }
});