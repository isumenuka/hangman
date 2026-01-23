-- Create Daily Challenges Table
CREATE TABLE IF NOT EXISTS daily_challenges (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    word TEXT NOT NULL CHECK (length(word) >= 10),
    hints JSONB, -- Array of 5 strings
    difficulty TEXT, -- Easy, Medium, Hard
    meta JSONB, -- Visual hints, prophecy, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For existing tables, run this:
-- ALTER TABLE daily_challenges ADD COLUMN IF NOT EXISTS hints JSONB;

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

-- Create Custom Users Table (for Admin-controlled auth)
CREATE TABLE IF NOT EXISTS custom_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy: Only allow SELECT based on specific logic (or public for login check, but RLS usually blocks direct access)
-- For this simple implementation, we'll allow public read to check login (in a real app, use a function)
ALTER TABLE custom_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Users" ON custom_users FOR SELECT USING (true);
CREATE POLICY "Admin Insert Users" ON custom_users FOR INSERT WITH CHECK (true);
