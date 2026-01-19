/**
 * Simple State Management for Habit Manager
 */

window.IdentityStore = (function () {
    class HabitStore {
        constructor() {
            this.habits = JSON.parse(localStorage.getItem('habits')) || [];
            this.listeners = [];
        }

        subscribe(listener) {
            this.listeners.push(listener);
            return () => {
                this.listeners = this.listeners.filter(l => l !== listener);
            };
        }

        notify(fromSync = false) {
            if (!fromSync) this.save();
            this.listeners.forEach(l => l(this.habits));
        }

        save() {
            localStorage.setItem('identity_habits', JSON.stringify(this.habits));
        }

        addHabit(habitData) {
            const newHabit = {
                id: crypto.randomUUID(),
                created: new Date().toISOString(),
                history: {}, // { "2026-01-18": "completed" | "skipped" }
                status: 'active',
                skipBudget: 1, // Default skip budget
                skipsUsed: {}, // { "2026-W03": 1 } - week-based tracking
                pauseUntil: null,
                frictionLog: {},
                order: this.habits.length,
                rewards: {
                    probability: 0.2,
                },
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

        reorderHabits(newOrder) {
            // newOrder is an array of habit IDs in the desired order
            const reorderedHabits = newOrder.map(id => this.habits.find(h => h.id === id));
            this.habits = reorderedHabits.filter(Boolean).map((habit, index) => ({
                ...habit,
                order: index
            }));
            this.notify();
        }

        toggleHabit(id, dateString) {
            const habit = this.habits.find(h => h.id === id);
            if (!habit) return;

            if (habit.history[dateString] === 'completed') {
                delete habit.history[dateString];
            } else {
                habit.history[dateString] = 'completed';
                this.checkReward(habit);
            }
            this.notify();
        }

        skipHabit(id, dateString) {
            const habit = this.habits.find(h => h.id === id);
            if (!habit) return;

            const weekKey = this.getWeekKey(new Date(dateString));
            const skipsUsed = habit.skipsUsed[weekKey] || 0;

            if (skipsUsed < habit.skipBudget) {
                habit.history[dateString] = 'skipped';
                habit.skipsUsed[weekKey] = skipsUsed + 1;
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
                // Trigger event for UI to handle
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

            // If not completed or skipped today, start checking from yesterday
            if (todayStatus !== 'completed' && todayStatus !== 'skipped') {
                checkDate.setDate(checkDate.getDate() - 1);
            }

            while (true) {
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
