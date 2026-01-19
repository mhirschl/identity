import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import {
    Plus,
    Flame,
    Calendar,
    Settings,
    Check,
    Trash2,
    X,
    Cloud,
    CloudOff,
    LogOut,
    ChevronRight,
    UserCircle
} from 'lucide-react';

/**
 * IDENTITY V2 - THE RELIABILITY STACK
 */

// Supabase Configuration
const SUPABASE_URL = localStorage.getItem('id_v2_sb_url') || '';
const SUPABASE_KEY = localStorage.getItem('id_v2_sb_key') || '';
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- App Component ---

function IdentityApp() {
    const [habits, setHabits] = useState([]);
    const [user, setUser] = useState(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(!supabase);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('today');
    const [newHabit, setNewHabit] = useState({ name: '', identity: '', anchor: '' });

    // 1. Auth Listener
    useEffect(() => {
        if (!supabase) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChanged((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Real-time Subscription
    useEffect(() => {
        if (!supabase || !user) {
            // Load local fallback if not logged in
            const localHabits = JSON.parse(localStorage.getItem('id_v2_habits') || '[]');
            setHabits(localHabits);
            return;
        }

        const fetchHabits = async () => {
            const { data, error } = await supabase
                .from('habits')
                .select('*')
                .order('created_at', { ascending: true });
            if (data) setHabits(data);
        };

        fetchHabits();

        const channel = supabase
            .channel('habits_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, payload => {
                fetchHabits();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [user]);

    // 3. Actions
    const addHabit = async (e) => {
        e.preventDefault();
        const habitData = {
            ...newHabit,
            user_id: user?.id,
            history: {},
            created_at: new Date().toISOString()
        };

        if (user && supabase) {
            await supabase.from('habits').insert([habitData]);
        } else {
            const updated = [...habits, { ...habitData, id: Math.random().toString(36).substr(2, 9) }];
            setHabits(updated);
            localStorage.setItem('id_v2_habits', JSON.stringify(updated));
        }

        setNewHabit({ name: '', identity: '', anchor: '' });
        setIsAddModalOpen(false);
    };

    const toggleHabit = async (id, date) => {
        const habit = habits.find(h => h.id === id);
        if (!habit) return;

        const newHistory = { ...habit.history };
        if (newHistory[date]) {
            delete newHistory[date];
        } else {
            newHistory[date] = 'completed';
        }

        if (user && supabase) {
            await supabase.from('habits').update({ history: newHistory }).eq('id', id);
        } else {
            const updated = habits.map(h => h.id === id ? { ...h, history: newHistory } : h);
            setHabits(updated);
            localStorage.setItem('id_v2_habits', JSON.stringify(updated));
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="max-w-md mx-auto px-4 pt-8 pb-24 min-h-screen">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Identity</h1>
                    <p className="text-gray-400 text-sm">Become who you want to be.</p>
                </div>
                <button
                    onClick={() => setIsConfigModalOpen(true)}
                    className="p-2 rounded-full glass-card hover:bg-white/10 transition-colors"
                >
                    {supabase ? <Cloud className="w-5 h-5 text-indigo-400" /> : <CloudOff className="w-5 h-5 text-gray-500" />}
                </button>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 glass-card p-1 rounded-2xl">
                <button
                    onClick={() => setActiveTab('today')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'today' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400'}`}
                >
                    Today
                </button>
                <button
                    onClick={() => setActiveTab('journey')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'journey' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400'}`}
                >
                    Journey
                </button>
            </div>

            {/* List */}
            {activeTab === 'today' && (
                <div className="space-y-4">
                    {habits.length === 0 ? (
                        <div className="text-center py-20">
                            <Plus className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">No habits yet. Tap + to start.</p>
                        </div>
                    ) : (
                        habits.map(habit => (
                            <div
                                key={habit.id}
                                className={`habit-item p-4 rounded-3xl glass-card transition-all flex items-center gap-4 ${habit.history[today] ? 'completed ring-1 ring-emerald-500/30' : ''}`}
                            >
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg leading-tight flex items-center gap-2">
                                        {habit.name}
                                        <StreakCounter habit={habit} />
                                    </h3>
                                    <p className="text-gray-400 text-sm leading-snug">
                                        {habit.identity} <span className="opacity-30 mx-1">•</span> {habit.anchor}
                                    </p>
                                </div>
                                <button
                                    onClick={() => toggleHabit(habit.id, today)}
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${habit.history[today] ? 'bg-emerald-500 text-white scale-95' : 'bg-white/5 border border-white/10 text-transparent hover:border-emerald-500/50 hover:text-emerald-500/50'}`}
                                >
                                    <Check className="w-6 h-6" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'journey' && (
                <div className="glass-card rounded-3xl p-6 text-center py-20">
                    <Calendar className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Your Journey</h3>
                    <p className="text-gray-400">Detailed visualizations coming soon.</p>
                </div>
            )}

            {/* FAB */}
            <button
                onClick={() => setIsAddModalOpen(true)}
                className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-full shadow-lg shadow-indigo-500/20 flex items-center justify-center text-white active:scale-95 transition-transform z-40"
            >
                <Plus className="w-8 h-8" />
            </button>

            {/* Modal: Config */}
            {isConfigModalOpen && <ConfigModal onClose={() => setIsConfigModalOpen(false)} user={user} />}

            {/* Modal: Add Habit */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-sm rounded-3xl p-8 animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">New Habit</h2>
                            <button onClick={() => setIsAddModalOpen(false)}><X className="text-gray-500" /></button>
                        </div>
                        <form onSubmit={addHabit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Who do you want to become?</label>
                                <input
                                    required
                                    placeholder="e.g. A focused reader"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:border-indigo-500 outline-none transition-all"
                                    value={newHabit.identity}
                                    onChange={e => setNewHabit({ ...newHabit, identity: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">The Tiny Action</label>
                                <input
                                    required
                                    placeholder="e.g. Read 1 page"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:border-indigo-500 outline-none transition-all"
                                    value={newHabit.name}
                                    onChange={e => setNewHabit({ ...newHabit, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">The Anchor Trigger</label>
                                <input
                                    required
                                    placeholder="e.g. After I pour my coffee"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:border-indigo-500 outline-none transition-all"
                                    value={newHabit.anchor}
                                    onChange={e => setNewHabit({ ...newHabit, anchor: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                                Save Habit
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Helper Components ---

function StreakCounter({ habit }) {
    const streak = useMemo(() => {
        let count = 0;
        let d = new Date();
        while (count < 365) {
            const dateStr = d.toISOString().split('T')[0];
            if (habit.history[dateStr] === 'completed') {
                count++;
                d.setDate(d.getDate() - 1);
            } else if (dateStr === new Date().toISOString().split('T')[0]) {
                d.setDate(d.getDate() - 1); // Ignore today if not done yet
            } else {
                break;
            }
        }
        return count;
    }, [habit.history]);

    if (streak === 0) return null;
    return (
        <span className="flex items-center gap-1 text-orange-400 text-sm font-bold bg-orange-400/10 px-2 py-0.5 rounded-full">
            <Flame className="w-3.5 h-3.5 fill-current" />
            {streak}
        </span>
    );
}

function ConfigModal({ onClose, user }) {
    const [url, setUrl] = useState(localStorage.getItem('id_v2_sb_url') || '');
    const [key, setKey] = useState(localStorage.getItem('id_v2_sb_key') || '');

    const save = () => {
        localStorage.setItem('id_v2_sb_url', url);
        localStorage.setItem('id_v2_sb_key', key);
        location.reload();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-sm rounded-[40px] p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Cloud Sync</h2>
                    <button onClick={onClose}><X className="text-gray-500" /></button>
                </div>

                {user ? (
                    <div className="text-center py-6">
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-10 h-10 text-emerald-500" />
                        </div>
                        <p className="font-bold text-lg mb-1">Authenticated</p>
                        <p className="text-gray-500 text-sm mb-6">{user.email}</p>
                        <button
                            onClick={() => supabase.auth.signOut().then(() => location.reload())}
                            className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-red-400 font-bold hover:bg-red-400/10 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-gray-400 text-sm">Provide your Supabase credentials to enable cross-device synchronization.</p>
                        <div className="space-y-4">
                            <input
                                placeholder="Supabase URL"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Supabase Anon Key"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none"
                                value={key}
                                onChange={e => setKey(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={save}
                            className="w-full bg-white text-black font-bold py-4 rounded-2xl active:scale-95 transition-all"
                        >
                            Connect & Reload
                        </button>

                        {supabase && (
                            <button
                                onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all font-semibold"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" />
                                Login with Google
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Boot
const root = createRoot(document.getElementById('root'));
root.render(<IdentityApp />);
