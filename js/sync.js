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

    async function init() {
        if (typeof firebase === 'undefined') {
            console.warn("Firebase not loaded. Working in local-only mode.");
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            auth = firebase.auth();

            // 1. Enable Persistence (The "Magic" part for offline sync)
            try {
                await db.enablePersistence({ synchronizeTabs: true });
                console.log("Firestore persistence enabled (multi-tab sync active)");
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
                } else if (err.code === 'unimplemented') {
                    console.warn("The current browser does not support persistence.");
                }
            }

            // 2. Handle Redirect Result (for Google Login)
            auth.getRedirectResult().then(result => {
                if (result.user) {
                    onUserAuthenticated(result.user);
                }
            }).catch(e => {
                console.error("Redirect Auth Error:", e);
            });

            // 3. Listen for Auth State
            auth.onAuthStateChanged(user => {
                if (user) {
                    onUserAuthenticated(user);
                } else {
                    currentUser = null;
                    window.IdentityStore.setCloudMode(false);
                }
            });
        } catch (e) {
            console.error("Firebase init failed:", e);
        }
    }

    async function onUserAuthenticated(user) {
        currentUser = user;
        console.log("Authenticated as:", user.uid);

        // Let the store know we are in cloud mode
        window.IdentityStore.setCloudMode(true, user.uid);

        // One-time migration: If there are local habits and cloud is empty, migrate them
        migrateLocalToCloud(user.uid);

        // Update UI
        if (window.updateSyncUI) window.updateSyncUI();
    }

    async function migrateLocalToCloud(uid) {
        const localHabits = JSON.parse(localStorage.getItem('identity_habits')) || [];
        if (localHabits.length === 0) return;

        // Peak into cloud to see if it's empty
        const snapshot = await db.collection('users').doc(uid).collection('habits').limit(1).get();
        if (snapshot.empty) {
            console.log("Cloud is empty. Migrating local habits...");
            for (const habit of localHabits) {
                await db.collection('users').doc(uid).collection('habits').doc(habit.id).set(habit);
            }
            // Clear local habits to prevent double-migration next time
            localStorage.removeItem('identity_habits');
        }
    }

    async function loginWithGoogle() {
        if (!auth) return { error: "Firebase not initialized." };
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithRedirect(provider);
            return { redirecting: true };
        } catch (e) {
            console.error("Google Auth Error:", e.code, e.message);
            return { error: `Auth Error: ${e.message}` };
        }
    }

    async function loginAnonymous() {
        if (!auth) return { error: "Firebase not initialized." };
        try {
            const result = await auth.signInAnonymously();
            return { user: result.user };
        } catch (e) {
            return { error: e.message };
        }
    }

    async function logout() {
        if (!auth) return;
        await auth.signOut();
        location.reload();
    }

    function getSyncKey() {
        return currentUser ? currentUser.uid : null;
    }

    // Helper for direct Firestore access from store
    function getDB() { return db; }
    function getUser() { return currentUser; }

    return {
        init,
        loginWithGoogle,
        loginAnonymous,
        logout,
        getSyncKey,
        getDB,
        getUser
    };
})();

window.SyncEngine = SyncEngine;
SyncEngine.init();
