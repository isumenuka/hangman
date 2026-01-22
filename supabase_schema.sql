-- Create Daily Challenges Table
CREATE TABLE IF NOT EXISTS daily_challenges (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    word TEXT NOT NULL CHECK (length(word) >= 10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy: Anyone can read, Authenticated (or anon) can insert (race condition handled by PK)
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Daily" ON daily_challenges FOR SELECT USING (true);
CREATE POLICY "Insert Daily" ON daily_challenges FOR INSERT WITH CHECK (true);

-- Create Daily Attempts Table (Leaderboard)
CREATE TABLE IF NOT EXISTS daily_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_date DATE REFERENCES daily_challenges(date),
    user_id TEXT NOT NULL, -- Storing Username or UUID
    time_taken INTEGER NOT NULL, -- Milliseconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy: Everyone can read leaderboard, Everyone can insert their own score
ALTER TABLE daily_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read Leaderboard" ON daily_attempts FOR SELECT USING (true);
CREATE POLICY "Submit Score" ON daily_attempts FOR INSERT WITH CHECK (true);

-- Create General Game History Table
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

-- Policy: Public Insert, Maybe private read? Let's make it public for "Global Stats" later
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read History" ON game_history FOR SELECT USING (true);
CREATE POLICY "Log Game" ON game_history FOR INSERT WITH CHECK (true);
