
import React, { useEffect, useState } from 'react';
import { supabase, getStats, PlayerStats } from '../utils/supabase';
import { User } from '@supabase/supabase-js';
import { Trophy, LogOut, Mail, Lock, Loader2, AlertCircle, User as UserIcon, Clock, Skull, Zap } from 'lucide-react';
import clsx from 'clsx';

export const Auth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Login Form State
    const [isOpen, setIsOpen] = useState(false); // Used for Login Modal OR Profile Modal
    const [viewMode, setViewMode] = useState<'LOGIN' | 'PROFILE'>('LOGIN');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // NEW: Username state
    const [isSignUp, setIsSignUp] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
            if (session?.user) fetchStats(session.user.id);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchStats(session.user.id);
            if (session?.user && viewMode === 'LOGIN') setIsOpen(false);
        });

        return () => subscription.unsubscribe();
    }, [viewMode]);

    const fetchStats = async (userId: string) => {
        const data = await getStats(userId);
        setStats(data);
    };

    // ... (Custom Auth removed/minimized for brevity, relying on Supabase)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError(null);

        try {
            if (isSignUp) {
                // VALIDATION
                if (!username.trim()) throw new Error("Username is required, mortal.");
                if (username.length < 3) throw new Error("Username too short.");

                // 1. PUBLIC SIGN UP with Supabase Auth
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username // Save to auth.users metadata too
                        }
                    }
                });

                if (error) throw error;
                if (!data.user) throw new Error("Registration failed.");

                // 2. EXPLICITLY SAVE TO player_stats TABLE (As requested)
                console.log("Saving user to player_stats:", data.user.id, username, email);

                const { error: dbError } = await supabase
                    .from('player_stats')
                    .insert({
                        id: data.user.id,
                        username: username,
                        email: email, // NEW: Saving email explicitly
                        wins: 0,
                        games_played: 0,
                        total_scares: 0,
                        created_at: new Date().toISOString()
                    });

                if (dbError) {
                    console.error("Failed to save stats:", dbError);
                    // Non-blocking error, but good to know.
                }

                setAuthError("✅ Account created! Please check your email to confirm your account.");
                setIsSignUp(false);
            } else {
                // LOGIN logic...

                // 1. Try Supabase Auth first (for public users who signed up)
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (authData.user) {
                    // Supabase Auth success
                    setUser(authData.user);
                    fetchStats(authData.user.id);
                    setIsOpen(false);
                    return;
                }

                // 2. If Supabase Auth failed, try Custom Table (for admin-created accounts)
                const { data: customUser } = await supabase
                    .from('custom_users')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle();

                if (customUser) {
                    // Custom Auth Found
                    const isValid = await verifyPassword(password, customUser.password_hash);
                    if (isValid) {
                        const fakeUser: User = {
                            id: customUser.id,
                            aud: 'authenticated',
                            role: 'authenticated',
                            email: customUser.email,
                            app_metadata: {},
                            user_metadata: {},
                            created_at: customUser.created_at,
                            updated_at: new Date().toISOString()
                        } as any;

                        setUser(fakeUser);
                        fetchStats(customUser.id);
                        setIsOpen(false);
                        return;
                    }
                }

                // Both failed
                throw new Error("Invalid email or password.");
            }
        } catch (err: any) {
            setAuthError(err.message || "Authentication failed");
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        // Clear Supabase session if any
        await supabase.auth.signOut();
        // Clear local state
        setUser(null);
        setStats(null);
        setIsOpen(false);
    };

    const formatTime = (ms: number | null) => {
        if (!ms) return "N/A";
        return (ms / 1000).toFixed(2) + "s";
    };

    const calculateTitle = (wins: number) => {
        if (wins >= 50) return { text: "Cursed Legend", color: "text-red-500" };
        if (wins >= 20) return { text: "High Priest", color: "text-purple-400" };
        if (wins >= 10) return { text: "Dark Acolyte", color: "text-blue-400" };
        if (wins >= 5) return { text: "Cultist", color: "text-green-400" };
        return { text: "Sacrifice", color: "text-slate-400" };
    };

    if (loading) return null;

    // --- BUTTONS (Always Visible) ---
    if (!isOpen) {
        if (user) {
            return (
                <button
                    onClick={() => { setViewMode('PROFILE'); setIsOpen(true); }}
                    className="flex items-center gap-3 bg-slate-900/80 hover:bg-slate-800 p-2 pr-4 rounded border border-slate-700 transition-all group"
                >
                    <div className="bg-slate-800 p-2 rounded">
                        <UserIcon size={16} className="text-slate-400 group-hover:text-white" />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PROFILE</span>
                        <span className="text-sm font-bold text-slate-200 truncate max-w-[100px]">{user.email?.split('@')[0]}</span>
                    </div>

                </button>
            );
        } else {
            return (
                <button
                    onClick={() => { setViewMode('LOGIN'); setIsOpen(true); }}
                    className="flex items-center gap-2 px-4 py-3 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded border border-slate-600 transition-colors shadow-lg"
                >
                    <Trophy size={18} className="text-yellow-500" />
                    <span className="font-bold">Save Progress</span>
                </button>
            );
        }
    }

    // --- MODALS ---

    // 1. PROFILE MODAL
    if (viewMode === 'PROFILE' && user) {
        const title = calculateTitle(stats?.wins || 0);

        return (

            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-slate-950 border border-slate-800 p-6 rounded-lg shadow-2xl w-full max-w-sm relative">
                    <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><LogOut size={16} /></button>

                    <div className="text-center mb-6">
                        <div className="inline-block p-3 rounded-full bg-slate-900 border-2 border-slate-800 mb-2">
                            <UserIcon size={32} className="text-slate-200" />
                        </div>
                        <h3 className="text-xl font-bold text-white truncate px-4">{user.email?.split('@')[0]}</h3>
                        <p className={clsx("text-sm font-bold uppercase tracking-widest mt-1", title.color)}>{title.text}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex flex-col items-center">
                            <Trophy size={20} className="text-yellow-500 mb-1" />
                            <span className="text-2xl font-bold text-yellow-400">{stats?.wins || 0}</span>
                            <span className="text-[10px] text-slate-500 uppercase">Total Wins</span>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex flex-col items-center">
                            <Zap size={20} className="text-blue-500 mb-1" />
                            <span className="text-2xl font-bold text-blue-400">{stats?.games_played || 0}</span>
                            <span className="text-[10px] text-slate-500 uppercase">Games Played</span>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex flex-col items-center">
                            <Clock size={20} className="text-green-500 mb-1" />
                            <span className="text-lg font-bold text-green-400">{formatTime(stats?.best_time_ms || null)}</span>
                            <span className="text-[10px] text-slate-500 uppercase">Best Time</span>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex flex-col items-center">
                            <Skull size={20} className="text-red-500 mb-1" />
                            <span className="text-2xl font-bold text-red-400">{stats?.total_scares || 0}</span>
                            <span className="text-[10px] text-slate-500 uppercase">Victims Scared</span>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded border border-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </div>
        );

    }

    // 2. LOGIN MODAL
    return (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-xl text-left w-full max-w-sm relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl text-slate-200 font-bold">{isSignUp ? 'New Member Registration' : 'Member Login'}</h3>
                    <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white"><LogOut size={20} /></button>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {/* Username Field (Only for Sign Up) */}
                    {isSignUp && (
                        <div>
                            <input
                                type="text"
                                placeholder="Choose a Username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 text-base focus:border-red-500 outline-none placeholder:text-slate-600"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 text-base focus:border-red-500 outline-none placeholder:text-slate-600"
                            required
                        />
                    </div>


                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 text-base focus:border-red-500 outline-none placeholder:text-slate-600"
                            required
                            minLength={6}
                        />
                    </div>

                    {authError && (
                        <div className="text-sm text-red-400 bg-red-950/30 p-3 rounded flex gap-2 items-start">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{authError}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold text-base transition-colors flex justify-center items-center shadow-lg shadow-red-900/20"
                    >
                        {authLoading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? 'Create Account' : 'Log In')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }}
                        className="text-slate-400 hover:text-white underline font-medium"
                    >
                        {isSignUp ? 'Back to Login' : 'Sign Up'}
                    </button>
                </div>
            </div >
        </div >
    );
};
