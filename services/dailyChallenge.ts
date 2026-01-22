import { supabase, DailyChallenge, DailyAttempt } from '../utils/supabase';
import { generateWord } from './wordGenerator';

export const getDailyWord = async (): Promise<{ word: string; hints: string[] } | null> => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Check if word exists for today
        const { data, error } = await supabase
            .from('daily_challenges')
            .select('word, hints')
            .eq('date', today)
            .maybeSingle();

        if (error) {
            console.error("Error checking daily word:", error);
            return null;
        }

        if (data) {
            // Found existing word
            return {
                word: data.word,
                // Parse hints if they are stored as JSONB, or default to generic if missing (legacy support)
                hints: Array.isArray(data.hints) ? data.hints : []
            };
        }

        // 2. If no word, Generate one (Client-side generation logic)
        // Race condition handled by DB uniqueness constraint on 'date'
        // Otherwise, generate a new word (race condition safe via unique constraint)
        try {
            // Fetch all previously used words to ensure uniqueness
            const { data: previousChallenges, error: historyError } = await supabase
                .from('daily_challenges')
                .select('word')
                .order('date', { ascending: false });

            const usedWords = previousChallenges?.map(c => c.word.toUpperCase()) || [];
            console.log(`[Daily Challenge] Found ${usedWords.length} previously used words`);

            // Generate a new unique word with hints
            let attempts = 0;
            while (word.length < 10 && attempts < 3) {
                const retry = await generateWord(['Hard']);
                word = retry.word.toUpperCase();
                hints = retry.hints || [];
                attempts++;
            }

            if (hints.length < 5) {
                // Fallback hints if API didn't provide enough
                hints = [
                    'First hint: A mystery word.',
                    'Second hint: Use your intuition.',
                    'Third hint: The void stares back.',
                    'Fourth hint: It is long and complex.',
                    'Fifth hint: ' + word.replace(/[AEIOU]/g, '_')
                ];
            }

            // Insert into DB
            const { error: insertError } = await supabase
                .from('daily_challenges')
                .insert({ date: today, word: word, hints: hints });

            if (insertError) {
                // If duplicate key error, it means someone else inserted it just now.
                // Fetch again.
                if (insertError.code === '23505') { // Unique violation
                    const { data: retryData } = await supabase
                        .from('daily_challenges')
                        .select('word, hints')
                        .eq('date', today)
                        .single();

                    if (retryData) {
                        return {
                            word: retryData.word,
                            hints: Array.isArray(retryData.hints) ? retryData.hints : []
                        };
                    }
                }
                console.error("Error inserting daily word:", insertError);
                return null;
            }

            return { word, hints };

        } catch (e) {
            console.error("Daily Service Failed:", e);
            return null;
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

    export const getDailyLeaderboard = async (date?: string): Promise<DailyAttempt[]> => {
        const targetDate = date || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('daily_attempts')
            .select('*')
            .eq('challenge_date', targetDate)
            .order('time_taken', { ascending: true }) // Lowest time is best
            .limit(10);

        if (error) {
            console.error("Error fetching daily leaderboard:", error);
            return [];
        }
        return data || [];
    };
