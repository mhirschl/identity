const store = window.IdentityStore;

const habitListEl = document.getElementById('habit-list');
const addHabitBtn = document.getElementById('add-habit-btn');
const modalOverlay = document.getElementById('modal-overlay');
const saveHabitBtn = document.getElementById('save-habit-btn');
const deleteHabitBtn = document.getElementById('delete-habit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const modalTitle = document.getElementById('modal-title');
const habitIdInput = document.getElementById('habit-id');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Form inputs
const identityInput = document.getElementById('habit-identity');
const nameInput = document.getElementById('habit-name');
const anchorInput = document.getElementById('habit-anchor');

// Sync UI
const syncStatusBtn = document.getElementById('sync-status');
const syncModal = document.getElementById('sync-modal');
const enableSyncBtn = document.getElementById('enable-sync-btn');
const syncKeyDisplay = document.getElementById('sync-key-display');
const syncKeyInput = document.getElementById('sync-key-input');
const closeSyncBtn = document.getElementById('close-sync-btn');
const copySyncBtn = document.getElementById('copy-sync-btn');
const linkDeviceBtn = document.getElementById('link-device-btn');
const linkKeyInput = document.getElementById('link-key-input');
const googleSyncBtn = document.getElementById('google-sync-btn');
const logoutBtn = document.getElementById('logout-btn');

function init() {
    render();
    store.subscribe(render);
    checkReflection();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'));
    }

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-view`).classList.add('active');
        });
    });

    addHabitBtn.addEventListener('click', () => {
        modalTitle.innerText = "New Habit";
        habitIdInput.value = "";
        deleteHabitBtn.style.display = "none";
        modalOverlay.classList.add('active');
        identityInput.focus();
    });

    cancelBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        clearForm();
    });

    saveHabitBtn.addEventListener('click', () => {
        const id = habitIdInput.value;
        const identity = identityInput.value.trim();
        const name = nameInput.value.trim();
        const anchor = anchorInput.value.trim();

        if (identity && name && anchor) {
            if (id) {
                store.updateHabit(id, { identity, name, anchor });
            } else {
                store.addHabit({ identity, name, anchor });
            }
            modalOverlay.classList.remove('active');
            clearForm();
        }
    });

    deleteHabitBtn.addEventListener('click', () => {
        const id = habitIdInput.value;
        if (id && confirm("Delete this habit and all history?")) {
            store.deleteHabit(id);
            modalOverlay.classList.remove('active');
            clearForm();
        }
    });

    // Reward listener
    window.addEventListener('habit-reward', (e) => {
        showRewardAnimation(e.detail.habitName);
    });

    // Error listener
    window.addEventListener('habit-error', (e) => {
        showErrorToast(e.detail.message);
    });

    // Sync Handlers
    syncStatusBtn.addEventListener('click', () => {
        syncModal.classList.add('active');
        updateSyncUI();
    });

    closeSyncBtn.addEventListener('click', () => {
        syncModal.classList.remove('active');
    });

    googleSyncBtn.addEventListener('click', async () => {
        googleSyncBtn.innerText = "Redirecting to Google...";
        const result = await window.SyncEngine.loginWithGoogle();
        if (result.user) {
            updateSyncUI();
        } else if (result.redirecting) {
            // Browser is redirecting, we don't need to do anything
        } else if (result.error) {
            googleSyncBtn.innerHTML = `
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="G">
                Sign in with Google
            `;
            showErrorToast(result.error);
        }
    });

    enableSyncBtn.addEventListener('click', async () => {
        enableSyncBtn.innerText = "Connecting...";
        const result = await window.SyncEngine.loginAnonymous();
        if (result.user) {
            updateSyncUI();
        } else if (result.error) {
            enableSyncBtn.innerText = "Or use Anonymous Sync (Key-based)";
            showErrorToast(result.error);
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (confirm("Sign out of sync? This will reload the app.")) {
            window.SyncEngine.logout();
        }
    });

    copySyncBtn.addEventListener('click', () => {
        syncKeyInput.select();
        document.execCommand('copy');
        copySyncBtn.innerText = "Copied!";
        setTimeout(() => copySyncBtn.innerText = "Copy", 2000);
    });

    linkDeviceBtn.addEventListener('click', () => {
        const key = linkKeyInput.value.trim();
        if (key) {
            window.SyncEngine.bridgeDevice(key);
        }
    });
}

function render() {
    const habits = store.getHabitsForToday();
    const today = new Date().toISOString().split('T')[0];

    if (habits.length === 0) {
        habitListEl.innerHTML = `
      <div class="habit-placeholder" style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
        <p>Tap + to start becoming who you want to be.</p>
      </div>
    `;
        return;
    }

    habitListEl.innerHTML = habits.map(habit => `
    <div class="habit-item glass-card ${habit.isCompletedToday ? 'completed' : ''} ${habit.isSkippedToday ? 'skipped' : ''}" data-id="${habit.id}">
      <div class="habit-info">
        <h3>${habit.name} ${habit.streak > 0 ? `<span style="font-size: 0.8rem; color: var(--primary-glow); margin-left: 0.5rem;">🔥 ${habit.streak}</span>` : ''}</h3>
        <p>${habit.identity} • ${habit.anchor}</p>
        ${habit.missedYesterday && !habit.isCompletedToday && !habit.isSkippedToday ? `<p style="color: #f87171; font-size: 0.7rem; margin-top: 0.25rem;">⚠️ Never miss twice! Do it today.</p>` : ''}
      </div>
      <div class="habit-actions">
        ${!habit.isCompletedToday && !habit.isSkippedToday && habit.skipsRemaining > 0 && !habit.isPaused ? `
            <button class="action-btn skip-btn" title="Skip (Budget: ${habit.skipsRemaining})">Skip</button>
        ` : ''}
        ${!habit.isPaused ? `
            <button class="action-btn pause-btn" title="Pause habit">Pause</button>
        ` : `<button class="action-btn resume-btn" title="Resume habit">Paused</button>`}
        <button class="action-btn edit-btn" title="Edit habit">•••</button>
        <button class="check-btn" aria-label="Mark completed">
            ${habit.isCompletedToday ? '✓' : ''}
        </button>
      </div>
      ${habit.missedYesterday && !habit.isCompletedToday && !habit.isSkippedToday ? `
          <div class="friction-prompt" style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 12px;">
            <p style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.5rem;">WHAT WAS THE FRICTION YESTERDAY?</p>
            <input type="text" class="friction-input" placeholder="e.g. Too tired, no time..." style="width: 100%; background: none; border: none; border-bottom: 1px solid var(--glass-border); color: white; font-size: 0.8rem;">
          </div>
      ` : ''}
    </div>
  `).join('');

    // Add click listeners
    document.querySelectorAll('.habit-item').forEach(el => {
        const id = el.dataset.id;
        const habit = habits.find(h => h.id === id);

        el.querySelector('.check-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            store.toggleHabit(id, today);
        });

        el.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(habit);
        });

        const skipBtn = el.querySelector('.skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                store.skipHabit(id, today);
            });
        }

        const pauseBtn = el.querySelector('.pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const resumption = prompt("Pause until (YYYY-MM-DD)?", new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
                if (resumption) store.updateHabit(id, { pauseUntil: resumption });
            });
        }

        const resumeBtn = el.querySelector('.resume-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                store.updateHabit(id, { pauseUntil: null });
            });
        }

        const frictionInput = el.querySelector('.friction-input');
        if (frictionInput) {
            frictionInput.addEventListener('change', (e) => {
                const habitClone = JSON.parse(JSON.stringify(habit));
                habitClone.frictionLog[yesterday] = e.target.value;
                store.updateHabit(id, { frictionLog: habitClone.frictionLog });
            });
        }
    });

    renderJourney();
}

function renderJourney() {
    const journeyEl = document.getElementById('journey-view');
    const habits = store.habits;

    if (habits.length === 0) {
        journeyEl.innerHTML = `
            <h2 style="font-size: 0.9rem; color: var(--text-dim); text-transform: uppercase;">Your Journey</h2>
            <div class="glass-card" style="padding: 2rem; text-align: center;">
                <p style="color: var(--text-dim);">Start a habit to see your journey unfold.</p>
            </div>
        `;
        return;
    }

    // Basic heatmap/timeline placeholder
    journeyEl.innerHTML = `
        <h2 style="font-size: 0.9rem; color: var(--text-dim); text-transform: uppercase;">Your Journey</h2>
        <div class="glass-card">
            <h3 style="margin-bottom: 1rem; font-size: 1rem;">Habit Consistency</h3>
            <div class="heatmap" style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${generateHeatmapHTML(habits)}
            </div>
        </div>
    `;
}

function generateHeatmapHTML(habits) {
    // Generate 28 days of history
    let html = '';
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        let status = 'none';
        habits.forEach(h => {
            if (h.history[dateStr] === 'completed') status = 'completed';
            else if (h.history[dateStr] === 'skipped' && status !== 'completed') status = 'skipped';
        });

        const color = status === 'completed' ? 'var(--secondary-glow)' :
            status === 'skipped' ? 'var(--primary-glow)' : 'var(--glass-border)';
        const opacity = status === 'none' ? '0.2' : '1';

        html += `<div style="width: 12px; height: 12px; background: ${color}; border-radius: 2px; opacity: ${opacity};" title="${dateStr}"></div>`;
    }
    return html;
}

function openEditModal(habit) {
    modalTitle.innerText = "Edit Habit";
    habitIdInput.value = habit.id;
    identityInput.value = habit.identity;
    nameInput.value = habit.name;
    anchorInput.value = habit.anchor;
    deleteHabitBtn.style.display = "block";
    modalOverlay.classList.add('active');
}

function clearForm() {
    identityInput.value = '';
    nameInput.value = '';
    anchorInput.value = '';
}

function showRewardAnimation(name) {
    const toast = document.createElement('div');
    toast.className = 'glass-card animate-pop';
    toast.style.position = 'fixed';
    toast.style.top = '2rem';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '1000';
    toast.style.background = 'var(--secondary-glow)';
    toast.style.color = 'var(--bg-dark)';
    toast.style.fontWeight = 'bold';
    toast.style.padding = '1rem 2rem';
    toast.innerHTML = `🌟 Rare Reward Unlocked: ${name} mastery!`;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'glass-card animate-pop error-toast';
    toast.style.position = 'fixed';
    toast.style.top = '2rem';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '1000';
    toast.style.padding = '1rem 2rem';
    toast.innerHTML = `⚠️ ${message}`;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateSyncUI() {
    const key = window.SyncEngine.getSyncKey();
    if (key) {
        googleSyncBtn.style.display = 'none';
        enableSyncBtn.parentElement.style.display = 'none';
        syncKeyDisplay.style.display = 'block';
        syncKeyInput.value = key;
        syncStatusBtn.style.opacity = '1';
        syncStatusBtn.innerHTML = '☁️ Synced';
        logoutBtn.style.display = 'block';

        // Hide link section if already synced to avoid confusion
        document.getElementById('link-device-section').style.display = 'none';
    } else {
        googleSyncBtn.style.display = 'flex';
        enableSyncBtn.parentElement.style.display = 'block';
        syncKeyDisplay.style.display = 'none';
        syncStatusBtn.style.opacity = '0.5';
        syncStatusBtn.innerHTML = '☁️ Sync';
        logoutBtn.style.display = 'none';
        document.getElementById('link-device-section').style.display = 'block';
    }
}

function checkReflection() {
    const today = new Date();
    if (today.getDay() === 0) { // Sunday
        const weekKey = store.getWeekKey(today);
        const lastRef = localStorage.getItem('last_reflection');
        if (lastRef !== weekKey) {
            setTimeout(() => {
                const thought = prompt("Sunday Reflection: Is your current tiny habit still serving the person you want to become?");
                if (thought !== null) {
                    localStorage.setItem('last_reflection', weekKey);
                    showRewardAnimation("Mindful Reflection");
                }
            }, 2000);
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
