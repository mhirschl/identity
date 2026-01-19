/**
 * Identity GitHub Sync Engine
 * Uses GitHub API to store habits.json in the user's repository.
 */

const SyncEngine = (() => {
    const REPO_OWNER = 'mhirschl';
    const REPO_NAME = 'identity';
    const FILE_PATH = 'habits.json';

    let githubToken = localStorage.getItem('identity_github_token');
    let fileSha = null;

    async function init() {
        if (githubToken) {
            console.log("GitHub token found. Initializing sync...");
            const success = await refreshSession();
            if (success) {
                window.IdentityStore.setCloudMode(true);
                if (window.updateSyncUI) window.updateSyncUI();
            }
        }
    }

    async function connect(token) {
        githubToken = token;
        const success = await refreshSession();
        if (success) {
            localStorage.setItem('identity_github_token', token);
            window.IdentityStore.setCloudMode(true);
            return { success: true };
        } else {
            githubToken = localStorage.getItem('identity_github_token');
            return { error: "Invalid GitHub Token or Repository not found." };
        }
    }

    async function logout() {
        localStorage.removeItem('identity_github_token');
        githubToken = null;
        location.reload();
    }

    async function refreshSession() {
        try {
            const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                fileSha = data.sha;
                const content = JSON.parse(atob(data.content));

                // Update local store with cloud data
                window.IdentityStore.habits = content;
                window.IdentityStore.notify(true); // true = fromSync
                return true;
            } else if (response.status === 404) {
                // File doesn't exist yet, we'll create it on first save
                console.log("habits.json not found. Will create on first save.");
                return true;
            }
            return false;
        } catch (e) {
            console.error("GitHub Sync Error:", e);
            return false;
        }
    }

    async function saveToGitHub(habits) {
        if (!githubToken) return;

        try {
            // First, get the latest SHA to avoid conflict
            const getRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (getRes.status === 200) {
                const getData = await getRes.json();
                fileSha = getData.sha;
            }

            const content = btoa(JSON.stringify(habits, null, 2));
            const body = {
                message: 'Update habits from Identity App',
                content: content,
                sha: fileSha
            };

            const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const resData = await response.json();
                fileSha = resData.content.sha;
                console.log("Synced to GitHub successfully.");
            } else {
                console.error("GitHub Save Failed:", await response.text());
            }
        } catch (e) {
            console.error("GitHub Save Error:", e);
        }
    }

    function isConnected() {
        return !!githubToken;
    }

    return {
        init,
        connect,
        logout,
        saveToGitHub,
        isConnected
    };
})();

window.SyncEngine = SyncEngine;
SyncEngine.init();
