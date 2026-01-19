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

        setCloudMode(active) {
            this.isCloudMode = active;
            if (!active) {
                this.habits = JSON.parse(localStorage.getItem('identity_habits')) || [];
                this.notify();
            }
        }

        subscribe(listener) {
            this.listeners.push(listener);
            return () => {
                this.listeners = this.listeners.filter(l => l !== listener);
            };
        }

        notify(fromSync = false) {
            this.save();
            this.listeners.forEach(l => l(this.habits));

            // Push to GitHub if connected
            if (!fromSync && window.SyncEngine.isConnected()) {
                window.SyncEngine.saveToGitHub(this.habits);
            }
        }

        save() {
            localStorage.setItem('identity_habits', JSON.stringify(this.habits));
        }

        addHabit(habitData) {
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

            this.habits.push(newHabit);
            this.notify();
        }

        updateHabit(id, updateData) {
            const index = this.habits.findIndex(h => h.id === id);
            if (index !== -1) {
                this.habits[index] = { ...this.habits[index], ...updateData };
                this.notify();
            }
        }

        deleteHabit(id) {
            this.habits = this.habits.filter(h => h.id !== id);
            this.notify();
        }

        toggleHabit(id, dateString) {
            const habit = this.habits.find(h => h.id === id);
            if (!habit) return;

            const newHistory = { ...habit.history };
            if (newHistory[dateString] === 'completed') {
                delete newHistory[dateString];
            } else {
                newHistory[dateString] = 'completed';
                this.checkReward(habit);
            }

            habit.history = newHistory;
            this.notify();
        }

        skipHabit(id, dateString) {
            const habit = this.habits.find(h => h.id === id);
            if (!habit) return;

            const weekKey = this.getWeekKey(new Date(dateString));
            const skipsUsed = habit.skipsUsed[weekKey] || 0;

            if (skipsUsed < habit.skipBudget) {
                habit.history = { ...habit.history, [dateString]: 'skipped' };
                habit.skipsUsed = { ...habit.skipsUsed, [weekKey]: skipsUsed + 1 };
                this.notify();
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
