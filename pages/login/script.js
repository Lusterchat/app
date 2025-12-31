// Login Page Script - FIXED VALIDATION VERSION
import { auth } from '../../utils/auth.js'

console.log("✨ Luster Login Page Loaded (FIXED Version)");

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const loginBtn = document.getElementById('loginBtn');
const successMessage = document.getElementById('successMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');

// Toggle password visibility
if (passwordToggle) {
    passwordToggle.addEventListener('click', function() {
        if (loginPassword.type === 'password') {
            loginPassword.type = 'text';
            this.textContent = '🙈';
            this.title = 'Hide password';
        } else {
            loginPassword.type = 'password';
            this.textContent = '👁️';
            this.title = 'Show password';
        }
    });
}

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 500);
}

// Hide error message
function hideError(element) {
    element.style.display = 'none';
}

// Show loading overlay
function showLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// FIXED VALIDATION - MINIMAL REQUIREMENTS
function validateLogin() {
    let isValid = true;

    // Username validation - MINIMAL (only check if not empty)
    if (!loginUsername.value.trim()) {
        showError(usernameError, 'Please enter username');
        isValid = false;
    } else if (loginUsername.value.trim().length < 1) { // Changed from 3 to 1
        showError(usernameError, 'Username must be at least 1 character');
        isValid = false;
    } else {
        hideError(usernameError);
    }

    // Password validation - MINIMAL (only check if not empty)
    if (!loginPassword.value) {
        showError(passwordError, 'Please enter password');
        isValid = false;
    } else if (loginPassword.value.length < 1) { // Changed from 6 to 1
        showError(passwordError, 'Password must be at least 1 character');
        isValid = false;
    } else {
        hideError(passwordError);
    }

    return isValid;
}

// Handle form submission - SIMPLIFIED
async function handleLogin(event) {
    event.preventDefault();

    // Validate inputs (minimal validation)
    if (!validateLogin()) {
        return;
    }

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    showLoading();
    console.log("Attempting login for:", username);

    try {
        // Use Supabase auth
        const result = await auth.signIn(username, password);

        if (result.success) {
            console.log("✅ Login successful!");
            // Show success
            showLoginSuccess(result.user.user_metadata?.username || username);
        } else {
            console.log("❌ Login failed:", result.message);
            showError(passwordError, result.message || 'Invalid username or password');
            hideLoading();
        }

    } catch (error) {
        console.error('Login error:', error);
        showError(passwordError, 'Login failed. Please try again.');
        hideLoading();
    }
}

// Show login success and redirect
function showLoginSuccess(username) {
    // Hide form
    if (loginForm) loginForm.style.display = 'none';

    // Show success message
    if (successMessage) {
        successMessage.style.display = 'block';
        successMessage.innerHTML = `
            <h3 style="color: #28a745; margin-bottom: 10px;">✅ Login Successful!</h3>
            <p style="color: #c0c0c0; margin-bottom: 15px;">
                Welcome back, <strong style="color: white;">${username}</strong>!
            </p>
            <p style="color: #a0a0c0; font-size: 0.9rem;">
                Redirecting to home page...
            </p>
            <div class="redirect-progress">
                <div class="redirect-progress-fill" id="redirectProgress"></div>
            </div>
        `;

        // Start progress bar and redirect
        let progress = 0;
        const progressFill = document.getElementById('redirectProgress');
        const interval = setInterval(() => {
            progress += 2;
            if (progressFill) progressFill.style.width = progress + '%';

            if (progress >= 100) {
                clearInterval(interval);
                window.location.href = '../home/index.html';
            }
        }, 30);
    } else {
        // Fallback: direct redirect
        setTimeout(() => {
            window.location.href = '../home/index.html';
        }, 1000);
    }
}

// Initialize login page
async function initLoginPage() {
    console.log("✨ Luster Login Page Initialized");

    // Load Supabase directly for testing
    let supabase = null;
    try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        supabase = createClient(
            'https://blxtldgnssvasuinpyit.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'
        );
        console.log("✅ Supabase connected");
    } catch (error) {
        console.error("❌ Supabase error:", error);
    }

    // Check if user is already logged in
    if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            // User is already logged in, redirect to home
            console.log("User already logged in, redirecting...");
            setTimeout(() => {
                window.location.href = '../home/index.html';
            }, 1000);
            return;
        }
    }

    // Event listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Real-time validation - REMOVE STRICT VALIDATION
    if (loginUsername) {
        loginUsername.addEventListener('input', function() {
            // Only hide error if user types something
            if (this.value.trim()) {
                hideError(usernameError);
            }
        });
    }

    if (loginPassword) {
        loginPassword.addEventListener('input', function() {
            // Only hide error if user types something
            if (this.value) {
                hideError(passwordError);
            }
        });
    }

    // Setup any other event listeners for buttons
    setupButtonListeners();
}

// Setup button event listeners
function setupButtonListeners() {
    // If you have other buttons in your login page HTML
    // Add their event listeners here

    // Example: Forgot password button
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', function() {
            alert("Password reset feature coming soon!");
        });
    }

    // Example: Signup link button
    const signupLinkBtn = document.getElementById('signupLinkBtn');
    if (signupLinkBtn) {
        signupLinkBtn.addEventListener('click', function() {
            window.location.href = '../auth/index.html';
        });
    }
}

// ====== MAKE FUNCTIONS AVAILABLE TO HTML ======

// Toggle password function (for HTML onclick)
window.togglePassword = function() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleBtn = document.querySelector('#passwordToggle');

    if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
            toggleBtn.title = 'Hide password';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
            toggleBtn.title = 'Show password';
        }
    }
};

// Modal functions (if your login page has modals)
window.showTerms = function() {
    alert("Terms & Conditions modal would open here");
};

window.showPrivacy = function() {
    alert("Privacy Policy modal would open here");
};

window.closeModal = function() {
    // Close any open modals
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });
};

// Make handleLogin available if HTML form uses onsubmit
window.handleLogin = handleLogin;

// Run when page loads
document.addEventListener('DOMContentLoaded', initLoginPage);