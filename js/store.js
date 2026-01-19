/**
 * Simple State Management for Habit Manager
 */

window.IdentityStore = (function () {
    class HabitStore {
        constructor() {
            this.habits = JSON.parse(localStorage.getItem('identity_habits')) || [];
            this.listeners = [];
            this.isCloudMode = false;
            this.userId = null;
            this.unsubscribeCloud = null;
        }

        setCloudMode(active, uid = null) {
            this.isCloudMode = active;
            this.userId = uid;

            if (active && uid) {
                this.initCloudListener();
            } else {
                if (this.unsubscribeCloud) this.unsubscribeCloud();
                this.habits = JSON.parse(localStorage.getItem('identity_habits')) || [];
                this.notify();
            }
        }

        initCloudListener() {
            if (this.unsubscribeCloud) this.unsubscribeCloud();

            const db = window.SyncEngine.getDB();
            if (!db || !this.userId) return;

            this.unsubscribeCloud = db.collection('users').doc(this.userId)
                .collection('habits')
                .onSnapshot(snapshot => {
                    const cloudHabits = [];
                    snapshot.forEach(doc => cloudHabits.push(doc.data()));

                    // Sort by order
                    this.habits = cloudHabits.sort((a, b) => (a.order || 0) - (b.order || 0));

                    // Update cache for offline startup
                    localStorage.setItem('identity_habits', JSON.stringify(this.habits));

                    this.notify(true); // true = from sync
                }, err => {
                    console.error("Cloud listener error:", err);
                });
        }

        subscribe(listener) {
            this.listeners.push(listener);
            return () => {
                this.listeners = this.listeners.filter(l => l !== listener);
            };
        }

        notify(fromSync = false) {
            if (!this.isCloudMode && !fromSync) this.save();
            this.listeners.forEach(l => l(this.habits));
        }

        save() {
            localStorage.setItem('identity_habits', JSON.stringify(this.habits));
        }

        async addHabit(habitData) {
            const id = crypto.randomUUID();
            const newHabit = {
                id: id,
                created: new Date().toISOString(),
                history: {},
                status: 'active',
                skipBudget: 1,
                skipsUsed: {},
                pauseUntil: null,
                frictionLog: {},
                order: this.habits.length,
                rewards: { probability: 0.2 },
                ...habitData
            };

            if (this.isCloudMode) {
                const db = window.SyncEngine.getDB();
                await db.collection('users').doc(this.userId).collection('habits').doc(id).set(newHabit);
            } else {
                this.habits.push(newHabit);
                this.notify();
            }
        }

        async updateHabit(id, updateData) {
            if (this.isCloudMode) {
                const db = window.SyncEngine.getDB();
                await db.collection('users').doc(this.userId).collection('habits').doc(id).update(updateData);
            } else {
                const index = this.habits.findIndex(h => h.id === id);
                if (index !== -1) {
                    this.habits[index] = { ...this.habits[index], ...updateData };
                    this.notify();
                }
            }
        }

        async deleteHabit(id) {
            if (this.isCloudMode) {
                const db = window.SyncEngine.getDB();
                await db.collection('users').doc(this.userId).collection('habits').doc(id).delete();
            } else {
                this.habits = this.habits.filter(h => h.id !== id);
                this.notify();
            }
        }

        async toggleHabit(id, dateString) {
            const habit = this.habits.find(h => h.id === id);
            if (!habit) return;

            const newHistory = { ...habit.history };
            if (newHistory[dateString] === 'completed') {
                delete newHistory[dateString];
            } else {
                newHistory[dateString] = 'completed';
                this.checkReward(habit);
            }

            if (this.isCloudMode) {
                const db = window.SyncEngine.getDB();
                await db.collection('users').doc(this.userId).collection('habits').doc(id).update({ history: newHistory });
            } else {
                habit.history = newHistory;
                this.notify();
            }
        }

        async skipHabit(id, dateString) {
            const habit = this.habits.find(h => h.id === id);
            if (!habit) return;

            const weekKey = this.getWeekKey(new Date(dateString));
            const skipsUsed = habit.skipsUsed[weekKey] || 0;

            if (skipsUsed < habit.skipBudget) {
                const newHistory = { ...habit.history, [dateString]: 'skipped' };
                const newSkipsUsed = { ...habit.skipsUsed, [weekKey]: skipsUsed + 1 };

                if (this.isCloudMode) {
                    const db = window.SyncEngine.getDB();
                    await db.collection('users').doc(this.userId).collection('habits').doc(id).update({
                        history: newHistory,
                        skipsUsed: newSkipsUsed
                    });
                } else {
                    habit.history = newHistory;
                    habit.skipsUsed = newSkipsUsed;
                    this.notify();
                }
            } else {
                window.dispatchEvent(new CustomEvent('habit-error', {
                    detail: { message: "Skip budget exhausted for this week!" }
                }));
            }
        }

        getWeekKey(date) {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 4 - (d.getDay() || 7));
            const yearStart = new Date(d.getFullYear(), 0, 1);
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
        }

        checkReward(habit) {
            if (Math.random() < habit.rewards.probability) {
                window.dispatchEvent(new CustomEvent('habit-reward', {
                    detail: { habitName: habit.name }
                }));
            }
        }

        getHabitsForToday() {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const weekKey = this.getWeekKey(new Date());

            return this.habits
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(habit => {
                    const historyValue = habit.history[today];
                    const isCompletedToday = historyValue === 'completed';
                    const isSkippedToday = historyValue === 'skipped';
                    const isPaused = habit.pauseUntil && new Date(habit.pauseUntil) > new Date();
                    const missedYesterday = !habit.history[yesterday] && habit.created.split('T')[0] < yesterday;
                    const skipsRemaining = (habit.skipBudget || 1) - (habit.skipsUsed[weekKey] || 0);

                    return {
                        ...habit,
                        isCompletedToday,
                        isSkippedToday,
                        isPaused,
                        missedYesterday,
                        skipsRemaining,
                        streak: this.calculateStreak(habit)
                    };
                });
        }

        calculateStreak(habit) {
            let streak = 0;
            let checkDate = new Date();
            checkDate.setHours(0, 0, 0, 0);

            const todayStr = checkDate.toISOString().split('T')[0];
            const todayStatus = habit.history[todayStr];

            if (todayStatus !== 'completed' && todayStatus !== 'skipped') {
                checkDate.setDate(checkDate.getDate() - 1);
            }

            while (streak < 1000) { // Safety break
                const dateStr = checkDate.toISOString().split('T')[0];
                const status = habit.history[dateStr];

                if (status === 'completed' || status === 'skipped') {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
            return streak;
        }
    }

    return new HabitStore();
})();
