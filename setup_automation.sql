-- ===================================================
-- AUTOMATED DAILY CHALLENGE GENERATOR
-- ===================================================
-- This script sets up a system to automatically create a new
-- daily challenge word every day at midnight (UTC).
-- ===================================================

-- 1. Enable the pg_cron extension (Required for scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create a Word Bank table (Source of words)
CREATE TABLE IF NOT EXISTS word_bank (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    word TEXT UNIQUE NOT NULL,
    hints JSONB,
    difficulty TEXT DEFAULT 'Hard',
    category TEXT DEFAULT 'General',
    used BOOLEAN DEFAULT FALSE
);

-- 3. Populate Word Bank with some initial words (You can add more later)
INSERT INTO word_bank (word, hints, difficulty) VALUES
('PHANTASMAGORIA', '["A sequence of real or imaginary images like those seen in a dream.", "Often associated with ghost shows.", "Starts with P.", "Ends with A.", "14 letters."]', 'Expert'),
('NECROMANCER', '["One who communicates with the dead.", "A type of dark wizard.", "Often raises skeletons.", "Starts with N.", "11 letters."]', 'Hard'),
('LOVECRAFTIAN', '["Relating to a specific author of cosmic horror.", "Involves Cthulhu.", "Unknowable terror.", "Starts with L.", "12 letters."]', 'Hard'),
('PARANORMAL', '["Beyond the scope of normal scientific understanding.", "Ghosts and UFOs fall here.", "Starts with P.", "Ends with L.", "10 letters."]', 'Medium'),
('ZEITGEIST', '["The defining spirit or mood of a particular period of history.", "German origin.", "Spirit of the times.", "Starts with Z.", "9 letters."]', 'Hard'),
('QUINTESSENTIAL', '["Representing the most perfect or typical example of a quality or class.", "The fifth element.", "Starts with Q.", "14 letters.", "Totally essential."]', 'Expert'),
('LABYRINTHINE', '["Like a maze.", "Complicated and tortuous.", "Starts with L.", "Related to minotaurs.", "12 letters."]', 'Hard'),
('CACOPHONY', '["A harsh, discordant mixture of sounds.", "Opposite of harmony.", "Starts with C.", "Ends with Y.", "9 letters."]', 'Medium'),
('EPHEMERAL', '["Lasting for a very short time.", "Fleeing.", "Transient.", "Starts with E.", "9 letters."]', 'Medium'),
('SERENDIPITY', '["The occurrence and development of events by chance in a happy or beneficial way.", "Happy accident.", "Starts with S.", "11 letters.", "Movie with John Cusack."]', 'Medium')
ON CONFLICT (word) DO NOTHING;

-- 4. Create the function to generate the daily challenge
CREATE OR REPLACE FUNCTION generate_daily_challenge() RETURNS void AS $$
DECLARE
    selected_word RECORD;
    today DATE := CURRENT_DATE;
BEGIN
    -- Check if a challenge already exists for today
    IF EXISTS (SELECT 1 FROM daily_challenges WHERE date = today) THEN
        RETURN; -- Do nothing if already exists
    END IF;

    -- Select a random unused word
    SELECT * INTO selected_word 
    FROM word_bank 
    WHERE used = FALSE 
    ORDER BY random() 
    LIMIT 1;

    -- If we ran out of unused words, recycle used ones (Fail-safe)
    IF selected_word IS NULL THEN
        UPDATE word_bank SET used = FALSE;
        
        SELECT * INTO selected_word 
        FROM word_bank 
        WHERE used = FALSE 
        ORDER BY random() 
        LIMIT 1;
    END IF;

    -- Insert the new challenge
    INSERT INTO daily_challenges (date, word, hints, difficulty)
    VALUES (
        today, 
        selected_word.word, 
        selected_word.hints, 
        selected_word.difficulty
    );

    -- Mark word as used
    UPDATE word_bank SET used = TRUE WHERE id = selected_word.id;

END;
$$ LANGUAGE plpgsql;

-- 5. Schedule the job to run every day at Midnight (00:00 UTC)
-- Note: '0 0 * * *' is Cron syntax for "At minute 0 past hour 0"
SELECT cron.schedule(
    'generate-daily-challenge', -- Unique job name
    '0 0 * * *',                -- Schedule (Every midnight)
    $$SELECT generate_daily_challenge()$$
);

-- 6. OPTIONAL: Run it immediately for today if missing!
SELECT generate_daily_challenge();
