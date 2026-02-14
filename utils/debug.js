// utils/debug.js - Add this to catch redirects
(function() {
    console.log('🔍 DEBUG: Redirect catcher installed');
    
    // Store original functions
    const originalAssign = window.location.assign;
    const originalReplace = window.location.replace;
    const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href');
    
    // Override assign
    window.location.assign = function(url) {
        console.error('🚨 REDIRECT DETECTED (assign):', url);
        console.trace('Redirect stack:');
        debugger; // This will pause if dev tools is open
        return originalAssign.call(this, url);
    };
    
    // Override replace
    window.location.replace = function(url) {
        console.error('🚨 REDIRECT DETECTED (replace):', url);
        console.trace('Redirect stack:');
        debugger; // This will pause if dev tools is open
        return originalReplace.call(this, url);
    };
    
    // Override href setter
    try {
        Object.defineProperty(window.location, 'href', {
            set: function(url) {
                console.error('🚨 REDIRECT DETECTED (href set):', url);
                console.trace('Redirect stack:');
                debugger; // This will pause if dev tools is open
                originalHref.set.call(this, url);
            },
            get: function() {
                return originalHref.get.call(this);
            }
        });
    } catch(e) {
        console.log('Could not override href');
    }
    
    // Also check for meta redirects
    const metaTags = document.getElementsByTagName('meta');
    for(let meta of metaTags) {
        if(meta.httpEquiv === 'refresh') {
            console.error('🚨 META REFRESH DETECTED:', meta.content);
        }
    }
})();