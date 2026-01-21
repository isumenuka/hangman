
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

let client;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key missing. Using MOCK client. Auth and Stats will be disabled.');
    // Mock Client to prevent crash
    client = {
        auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            getUser: async () => ({ data: { user: null } }),
            getSession: async () => ({ data: { session: null } }),
            signInWithPassword: async () => ({ error: { message: "Auth disabled in mock mode" } }),
            signUp: async () => ({ error: { message: "Auth disabled in mock mode" } }),
            signOut: async () => ({ error: null })
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: async () => ({ data: null, error: { code: 'PGRST116' } })
                }),
                order: () => ({
                    limit: async () => ({ data: [], error: null })
                })
            })
        }),
        rpc: async () => ({ error: null })
    };
} else {
    client = createClient(supabaseUrl, supabaseKey);
}

export const supabase = client;

// --- Types ---
export interface PlayerStats {
    id: string;
    username: string; // New
    wins: number;
    games_played: number;
    best_time_ms: number | null;
    total_scares: number;
}

// --- Helpers ---

export const getStats = async (userId: string): Promise<PlayerStats | null> => {
    const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return { id: userId, username: 'Anonymous', wins: 0, games_played: 0, best_time_ms: null, total_scares: 0 }; // Default
        console.error('Error fetching stats:', error);
        return null;
    }
    return data;
};

export const getLeaderboard = async (): Promise<PlayerStats[]> => {
    const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .order('wins', { ascending: false })
        .limit(50); // Top 50

    if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
    return data || [];
};

export const updateGameStats = async (isWin: boolean, timeTaken: number, scaresUsed: number, username: string) => {
    // 1. Get Current User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Call RPC function (safe atomic update)
    const { error: rpcError } = await supabase.rpc('update_game_stats', {
        p_user_id: user.id,
        p_is_win: isWin,
        p_time_taken: timeTaken,
        p_scares_used: scaresUsed,
        p_username: username // New Arg
    });

    if (rpcError) {
        console.warn("RPC Failed (update_game_stats), checking fallback...", rpcError);
        console.error("Make sure to run the update_stats_schema.sql script in Supabase!");
    }
}
