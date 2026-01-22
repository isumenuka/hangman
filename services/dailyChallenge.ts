import { supabase, DailyChallenge, DailyAttempt } from '../utils/supabase';
import { generateWord } from './wordGenerator';

export const getDailyWord = async (): Promise<string | null> => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Check if word exists for today
        const { data, error } = await supabase
            .from('daily_challenges')
            .select('word')
            .eq('date', today)
            .maybeSingle();

        if (error) {
            console.error("Error checking daily word:", error);
            return null;
        }

        if (data) {
            // Found existing word
            return data.word;
        }

        // 2. If no word, Generate one (Client-side generation logic)
        // Race condition handled by DB uniqueness constraint on 'date'
        console.log("No daily word found, attempting to generate...");

        // Generate strictly 10+ letter word
        // We can reuse generateWord but maybe need a 'Hard' preset or custom prompt?
        // Let's use 'Hard' and filter for length or just ask specifically.
        // Actually, generateWord returns an object including hints. Daily challenge needs hints too?
        // Schema only stored 'word'. Hints might be good to store but for now let's regenerate hints locally or store whole JSON?
        // Plan says: `daily_challenges` has `word` (TEXT).
        // If we only store word, we must regenerate hints on the fly or rely on wordGenerator to give hints for a specific word?
        // `generateWord` creates a NEW word.
        // Let's modify `getDailyWord` to return just the string, and the UI will call `generateHintsFor(word)` if needed (not implemented)
        // OR simpler: Use `generateWord` logic here but specifically ask for 10+ chars.

        // For now, let's call the standard 'Hard' generator which usually gives long words, 
        // but to be safe/specific let's just use it and if it's short, retry?
        // Better: Just assume Hard is good enough or call the API directly here.

        // Let's reuse generateWord for now. If it's short, so be it, or loop?
        // Actually, let's just try to insert it.
        const wordData = await generateWord(['Hard']); // Helper uses array of difficulties or single?
        // Checking `generateWord` signature... it takes difficulty string.
        // Wait, `generateWord` was imported from `wordGenerator`.

        let word = wordData.word.toUpperCase();

        // Ensure 10+ letters (Simple Retry logic)
        let attempts = 0;
        while (word.length < 10 && attempts < 3) {
            const retry = await generateWord('Hard');
            word = retry.word.toUpperCase();
            attempts++;
        }

        // Insert into DB
        const { error: insertError } = await supabase
            .from('daily_challenges')
            .insert({ date: today, word: word });

        if (insertError) {
            // If duplicate key error, it means someone else inserted it just now.
            // Fetch again.
            if (insertError.code === '23505') { // Unique violation
                const { data: retryData } = await supabase
                    .from('daily_challenges')
                    .select('word')
                    .eq('date', today)
                    .single();
                return retryData?.word || word;
            }
            console.error("Error inserting daily word:", insertError);
            return null;
        }

        return word;

    } catch (e) {
        console.error("Daily Service Failed:", e);
        return null; // Fallback?
    }
};

export const submitDailyAttempt = async (userId: string, timeTaken: number) => {
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
        .from('daily_attempts')
        .insert({
            challenge_date: today,
            user_id: userId,
            time_taken: timeTaken
        });

    if (error) console.error("Failed to submit attempt:", error);
};

export const getDailyLeaderboard = async (): Promise<DailyAttempt[]> => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('daily_attempts')
        .select('*')
        .eq('challenge_date', today)
        .order('time_taken', { ascending: true }) // Lowest time is best
        .limit(10);

    if (error) {
        console.error("Error fetching daily leaderboard:", error);
        return [];
    }
    return data || [];
};
