/**
 * Identity Sync Engine
 * Handles real-time cloud mobilization via Firebase
 */

const SyncEngine = (() => {
    // Note: These are placeholder keys. In a production environment, 
    // the user would provide their own Firebase config.
    const firebaseConfig = {
        apiKey: "AIzaSyDBNRnKHOJpQMfhOvQOZsvu5ITOMbO6-Fs",
        authDomain: "identity-habits.firebaseapp.com",
        projectId: "identity-habits",
        storageBucket: "identity-habits.firebasestorage.app",
        messagingSenderId: "91092411242",
        appId: "1:91092411242:web:96d01e74e32e9a44ea7b13",
        measurementId: "G-B0ZB2SSJHM"
    };

    let db;
    let auth;
    let currentUser = null;

    function init() {
        if (typeof firebase === 'undefined') {
            console.warn("Firebase not loaded. Working in local-only mode.");
            return;
        }

        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();

            // Check for bridged key
            const bridgedKey = localStorage.getItem('identity_sync_key');
            if (bridgedKey) {
                // In this simple demo, we'll just act as that user
                // For real security, we'd use a shared login or verified link
                currentUser = { uid: bridgedKey };
                console.log("Bridged session active:", bridgedKey);
                startSync();
                return;
            }

            // Try to restore session or start anonymous
            auth.onAuthStateChanged(user => {
                if (user) {
                    currentUser = user;
                    console.log("Synced as:", user.uid);
                    startSync();
                }
            });
        } catch (e) {
            console.error("Firebase init failed:", e);
        }
    }

    async function loginWithGoogle() {
        if (!auth) return { error: "Firebase not initialized. Check your config." };
        if (firebaseConfig.apiKey.includes("MOCK")) {
            return { error: "MOCK KEYS DETECTED: You must replace the keys in sync.js with your own Firebase keys from the Google Console." };
        }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            return { user: result.user };
        } catch (e) {
            console.error("Google Auth failed:", e);
            return { error: e.message };
        }
    }

    async function loginAnonymous() {
        if (!auth) return { error: "Firebase not initialized. Check your config." };
        if (firebaseConfig.apiKey.includes("MOCK")) {
            return { error: "MOCK KEYS DETECTED: You must replace the keys in sync.js with your own Firebase keys from the Google Console." };
        }
        try {
            const result = await auth.signInAnonymously();
            return { user: result.user };
        } catch (e) {
            console.error("Auth failed:", e);
            return { error: e.message };
        }
    }

    async function logout() {
        if (!auth) return;
        await auth.signOut();
        localStorage.removeItem('identity_sync_key');
        location.reload();
    }

    function startSync() {
        if (!currentUser || !db) return;

        // 1. Initial Migration (Local -> Cloud)
        pushLocalToCloud();

        // 2. Subscribe to Local Store Changes
        window.IdentityStore.subscribe(() => {
            pushLocalToCloud();
        });

        // 3. Listen for Cloud Changes (Cloud -> Local)
        db.collection('users').doc(currentUser.uid)
            .collection('habits').onSnapshot(snapshot => {
                const cloudHabits = [];
                snapshot.forEach(doc => cloudHabits.push(doc.data()));

                if (cloudHabits.length > 0) {
                    // Check if we actually need to update to avoid loops
                    const localStr = JSON.stringify(window.IdentityStore.habits);
                    const cloudStr = JSON.stringify(cloudHabits.sort((a, b) => (a.order || 0) - (b.order || 0)));

                    if (localStr !== cloudStr) {
                        console.log("Sync: Updating from cloud...");
                        window.IdentityStore.habits = cloudHabits;
                        window.IdentityStore.notify(true); // true = fromSync
                    }
                }
            });
    }

    function pushLocalToCloud() {
        if (!currentUser || !db) return;
        const habits = window.IdentityStore.habits;
        habits.forEach(habit => {
            db.collection('users').doc(currentUser.uid)
                .collection('habits').doc(habit.id).set(habit, { merge: true });
        });
    }

    async function bridgeDevice(syncKey) {
        // This is a simplified concept. In a real app, we'd use Custom Tokens
        // or a shared account, but for this demo, we'll store the 'activeUID'
        localStorage.setItem('identity_sync_key', syncKey);
        location.reload();
    }

    function getSyncKey() {
        return currentUser ? currentUser.uid : null;
    }

    return {
        init,
        loginAnonymous,
        getSyncKey
    };
})();

window.SyncEngine = SyncEngine;
SyncEngine.init();
