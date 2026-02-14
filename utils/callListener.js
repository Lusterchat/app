// utils/callListener.js - DEBUG VERSION

import { initializeSupabase, supabase as supabaseClient } from './supabase.js';

let supabase = null;
let currentUser = null;
let callSubscription = null;

// Initialize call listener
export async function initCallListener() {
    console.log('🔍 DEBUG: initCallListener STARTED');
    
    try {
        console.log('🔍 DEBUG: Getting Supabase instance...');
        supabase = await initializeSupabase();
        console.log('🔍 DEBUG: Supabase initialized:', supabase ? 'YES' : 'NO');
        
        console.log('🔍 DEBUG: Getting session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('🔍 DEBUG: Session error:', error);
            return;
        }
        
        if (!session) {
            console.log('🔍 DEBUG: No session found');
            return;
        }
        
        currentUser = session.user;
        console.log('🔍 DEBUG: Current user:', currentUser.email);
        console.log('🔍 DEBUG: User ID:', currentUser.id);
        
        // TEST: Try to query the calls table
        console.log('🔍 DEBUG: Testing calls table access...');
        const { data: testData, error: testError } = await supabase
            .from('calls')
            .select('count')
            .limit(1);
            
        if (testError) {
            console.error('🔍 DEBUG: Calls table access ERROR:', testError);
        } else {
            console.log('🔍 DEBUG: Calls table accessible ✅');
        }
        
        // Set up the listener
        console.log('🔍 DEBUG: Setting up call listener for receiver_id =', currentUser.id);
        setupIncomingCallListener();
        
    } catch (error) {
        console.error('🔍 DEBUG: Fatal error in initCallListener:', error);
    }
}

// Setup incoming call listener
function setupIncomingCallListener() {
    console.log('🔍 DEBUG: setupIncomingCallListener called');
    
    if (!supabase) {
        console.error('🔍 DEBUG: No supabase instance');
        return;
    }
    
    if (!currentUser) {
        console.error('🔍 DEBUG: No current user');
        return;
    }
    
    console.log('🔍 DEBUG: Creating channel subscription...');
    
    // Subscribe to new calls
    callSubscription = supabase
        .channel('incoming-calls-debug')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('🔍 DEBUG: 🔔🔔🔔 INCOMING CALL DETECTED! 🔔🔔🔔');
            console.log('🔍 DEBUG: Full payload:', payload);
            console.log('🔍 DEBUG: Call data:', payload.new);
            
            // Show alert for testing
            alert(`INCOMING CALL FROM USER ID: ${payload.new.caller_id}`);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'calls'
        }, (payload) => {
            console.log('🔍 DEBUG: Any call event:', payload.eventType, payload.new);
        })
        .subscribe((status) => {
            console.log('🔍 DEBUG: Subscription status:', status);
        });
    
    console.log('🔍 DEBUG: Subscription created');
}

// Clean up
export function cleanupCallListener() {
    if (callSubscription) {
        callSubscription.unsubscribe();
    }
}