// Auth page script - UPDATED FOR SUPABASE
import { auth } from '../../utils/auth.js'

console.log("✨ Luster Auth Page Loaded (Supabase Version)");

// Show error message
function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

// Hide error message
function hideError(elementId) {
    const errorEl = document.getElementById(elementId);
    errorEl.style.display = 'none';
}

// Validate username
function validateUsername(username) {
    if (username.length < 3) {
        showError('usernameError', 'Username must be at least 3 characters');
        return false;
    }
    if (username.length > 20) {
        showError('usernameError', 'Username must be less than 20 characters');
        return false;
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
        showError('usernameError', 'Only letters, numbers, underscore, and dot allowed');
        return false;
    }
    hideError('usernameError');
    return true;
}

// Validate password
function validatePassword(password) {
    if (password.length < 6) {
        showError('passwordError', 'Password must be at least 6 characters');
        return false;
    }
    hideError('passwordError');
    return true;
}

// Validate password confirmation
function validateConfirmPassword(password, confirmPassword) {
    if (password !== confirmPassword) {
        showError('confirmError', 'Passwords do not match');
        return false;
    }
    hideError('confirmError');
    return true;
}

// Handle form submission with SUPABASE
async function handleSignup(event) {
    event.preventDefault();

    // Get form values
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate inputs
    const isUsernameValid = validateUsername(username);
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirmPassword(password, confirmPassword);

    if (!isUsernameValid || !isPasswordValid || !isConfirmValid) {
        return;
    }

    if (!document.getElementById('terms').checked) {
        alert('Please agree to Terms & Conditions');
        return;
    }

    // Show loading
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;

    try {
        // Use Supabase auth (from utils/auth.js)
        const result = await auth.signUp(username, password, username);
        
        if (result.success) {
            // Show success
            showSuccessMessage(result.user.user_metadata.username);
        } else {
            showError('usernameError', result.message || 'Signup failed');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('usernameError', error.message || 'Something went wrong');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Show success message
function showSuccessMessage(username) {
    // Hide form
    document.getElementById('signupForm').style.display = 'none';

    // Show success message
    const successContainer = document.getElementById('successContainer');
    successContainer.style.display = 'block';
    successContainer.innerHTML = `
        <span class="success-icon">✨</span>
        <h2 style="color: white; margin-bottom: 15px;">Welcome to Luster, ${username}!</h2>
        <p style="color: #a0a0c0; margin-bottom: 25px;">
            Your account has been created successfully!
        </p>
        <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
        </div>
        <p style="color: #a0a0c0; margin-top: 10px; font-size: 0.9rem;">
            Redirecting to home page...
        </p>
    `;
    
    // Animate progress bar
    let width = 0;
    const interval = setInterval(() => {
        width += 2;
        document.getElementById('progressFill').style.width = width + '%';
        if (width >= 100) {
            clearInterval(interval);
            window.location.href = '../home/index.html';
        }
    }, 50);
}

// Initialize auth page
async function initAuthPage() {
    console.log("Auth page initialized with Supabase");
    
    // Check if user is already logged in
    const { success } = await auth.getCurrentUser();
    if (success) {
        // Redirect to home page
        window.location.href = '../home/index.html';
        return;
    }
    
    // Real-time validation
    document.getElementById('username').addEventListener('input', function() {
        validateUsername(this.value);
    });

    document.getElementById('password').addEventListener('input', function() {
        validatePassword(this.value);
    });

    document.getElementById('confirmPassword').addEventListener('input', function() {
        const password = document.getElementById('password').value;
        validateConfirmPassword(password, this.value);
    });
}

// Run when page loads
document.addEventListener('DOMContentLoaded', initAuthPage);