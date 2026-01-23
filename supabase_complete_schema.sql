-- ==========================================
-- COMPLETE SUPABASE SCHEMA FOR HANGMAN GAME
-- ==========================================
-- Run this entire script in Supabase SQL Editor
-- ==========================================

-- 1. DROP EXISTING TABLES (if you want a fresh start)
-- Uncomment these if you want to reset everything
-- DROP TABLE IF EXISTS player_stats CASCADE;
-- DROP TABLE IF EXISTS daily_challenges CASCADE;
-- DROP TABLE IF EXISTS daily_attempts CASCADE;
-- DROP TABLE IF EXISTS game_history CASCADE;
-- DROP TABLE IF EXISTS custom_users CASCADE;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- Player Stats Table
CREATE TABLE IF NOT EXISTS player_stats (
    id UUID PRIMARY KEY,
    username TEXT,
    wins INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    best_time_ms INTEGER,
    total_scares INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Challenges Table
CREATE TABLE IF NOT EXISTS daily_challenges (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    word TEXT NOT NULL CHECK (length(word) >= 10),
    hints JSONB,
    difficulty TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Attempts Table (Leaderboard)
CREATE TABLE IF NOT EXISTS daily_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_date DATE REFERENCES daily_challenges(date),
    user_id TEXT NOT NULL,
    time_taken INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game History Table
CREATE TABLE IF NOT EXISTS game_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    word TEXT NOT NULL,
    difficulty TEXT,
    result TEXT CHECK (result IN ('WON', 'LOST')),
    time_taken INTEGER,
    scares_used INTEGER DEFAULT 0,
    user_id TEXT,
    played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Users Table (for admin-created accounts)
CREATE TABLE IF NOT EXISTS custom_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_users ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. DROP EXISTING POLICIES (to avoid conflicts)
-- ==========================================

DROP POLICY IF EXISTS "Public Read Stats" ON player_stats;
DROP POLICY IF EXISTS "Users Update Own Stats" ON player_stats;
DROP POLICY IF EXISTS "Users Insert Own Stats" ON player_stats;

DROP POLICY IF EXISTS "Public Read Daily" ON daily_challenges;
DROP POLICY IF EXISTS "Insert Daily" ON daily_challenges;

DROP POLICY IF EXISTS "Read Leaderboard" ON daily_attempts;
DROP POLICY IF EXISTS "Submit Score" ON daily_attempts;

DROP POLICY IF EXISTS "Read History" ON game_history;
DROP POLICY IF EXISTS "Log Game" ON game_history;

DROP POLICY IF EXISTS "Public Read Users" ON custom_users;
DROP POLICY IF EXISTS "Admin Insert Users" ON custom_users;

-- ==========================================
-- 5. CREATE POLICIES
-- ==========================================

-- Player Stats Policies
CREATE POLICY "Public Read Stats" ON player_stats
    FOR SELECT USING (true);

CREATE POLICY "Users Update Own Stats" ON player_stats
    FOR UPDATE USING (true);

CREATE POLICY "Users Insert Own Stats" ON player_stats
    FOR INSERT WITH CHECK (true);

-- Daily Challenges Policies
CREATE POLICY "Public Read Daily" ON daily_challenges
    FOR SELECT USING (true);

CREATE POLICY "Insert Daily" ON daily_challenges
    FOR INSERT WITH CHECK (true);

-- Daily Attempts Policies
CREATE POLICY "Read Leaderboard" ON daily_attempts
    FOR SELECT USING (true);

CREATE POLICY "Submit Score" ON daily_attempts
    FOR INSERT WITH CHECK (true);

-- Game History Policies
CREATE POLICY "Read History" ON game_history
    FOR SELECT USING (true);

CREATE POLICY "Log Game" ON game_history
    FOR INSERT WITH CHECK (true);

-- Custom Users Policies
CREATE POLICY "Public Read Users" ON custom_users
    FOR SELECT USING (true);

CREATE POLICY "Admin Insert Users" ON custom_users
    FOR INSERT WITH CHECK (true);

-- ==========================================
-- 6. CREATE RPC FUNCTION FOR STATS UPDATES
-- ==========================================

CREATE OR REPLACE FUNCTION update_game_stats(
    p_user_id UUID,
    p_is_win BOOLEAN,
    p_time_taken INTEGER,
    p_scares_used INTEGER,
    p_username TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO player_stats (id, username, wins, games_played, best_time_ms, total_scares)
    VALUES (
        p_user_id,
        p_username,
        CASE WHEN p_is_win THEN 1 ELSE 0 END,
        1,
        CASE WHEN p_is_win THEN p_time_taken ELSE NULL END,
        p_scares_used
    )
    ON CONFLICT (id) DO UPDATE SET
        wins = player_stats.wins + CASE WHEN p_is_win THEN 1 ELSE 0 END,
        games_played = player_stats.games_played + 1,
        best_time_ms = CASE 
            WHEN p_is_win AND (player_stats.best_time_ms IS NULL OR p_time_taken < player_stats.best_time_ms)
            THEN p_time_taken
            ELSE player_stats.best_time_ms
        END,
        total_scares = player_stats.total_scares + p_scares_used,
        username = COALESCE(player_stats.username, p_username);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- DONE! All tables and policies created.
-- ==========================================
