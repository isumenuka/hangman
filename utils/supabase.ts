
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key missing. Stats will not be saved.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// --- Types ---
export interface PlayerStats {
    id: string;
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
        if (error.code === 'PGRST116') return { id: userId, wins: 0, games_played: 0, best_time_ms: null, total_scares: 0 }; // Default
        console.error('Error fetching stats:', error);
        return null;
    }
    return data;
};

export const updateGameStats = async (isWin: boolean, timeTaken: number, scaresUsed: number) => {
    // 1. Get Current User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Call RPC function (safe atomic update)
    const { error: rpcError } = await supabase.rpc('update_game_stats', {
        p_user_id: user.id,
        p_is_win: isWin,
        p_time_taken: timeTaken,
        p_scares_used: scaresUsed
    });

    if (rpcError) {
        console.warn("RPC Failed (update_game_stats), checking fallback...", rpcError);
        // Fallback or retry logic could go here, but usually RPC is safest.
        // If RPC fails (e.g. function doesn't exist yet), we might just log it.
        console.error("Make sure to run the update_stats_schema.sql script in Supabase!");
    }
}
