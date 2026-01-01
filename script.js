// Main app script - SMART ROUTER VERSION
console.log("✨ Relay App Loading...");

// Navigation functions
function goToSignup() {
    window.location.href = 'pages/auth/index.html';
}

function goToLogin() {
    window.location.href = 'pages/login/index.html';
}

// Check for existing user - UPDATED
async function checkExistingUser() {
    try {
        // Try Supabase auth first
        const { auth } = await import('./utils/auth.js');
        const { success, user } = await auth.getCurrentUser();
        
        if (success && user) {
            console.log("Supabase user found:", user.email);
            return true;
        }
        
        // Fallback to localStorage
        const localUser = localStorage.getItem('luster_user');
        if (localUser) {
            console.log("LocalStorage user found:", JSON.parse(localUser).username);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("User check error:", error);
        return false;
    }
}

// Initialize app - UPDATED
async function initApp() {
    console.log("App initialized!");
    
    // Check if user is logged in
    const hasUser = await checkExistingUser();
    
    if (hasUser) {
        console.log("User is logged in, redirecting to home...");
        setTimeout(() => {
            window.location.href = 'pages/home/index.html';
        }, 1000);
        return; // Stop here
    }
    
    // Only run landing page effects if user is NOT logged in
    console.log("No user found, showing landing page...");
    
    // Original landing page effects
    setTimeout(() => {
        const title = document.querySelector('.title');
        if (title) {
            title.innerHTML = `Welcome to <span style="color:#667eea">Relay</span>!`;
        }
    }, 4000);

    // Add click effects to buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// Wait for opening animation to complete
setTimeout(() => {
    initApp();
}, 3500);

// Make functions available globally
window.RelayApp = {
    goToSignup,
    goToLogin,
    checkExistingUser
};