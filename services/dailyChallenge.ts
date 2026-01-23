import { supabase, DailyChallenge, DailyAttempt } from '../utils/supabase';
import { generateWord } from './wordGenerator';

export const getDailyWord = async (): Promise<{ word: string; hints: string[]; difficulty: 'Easy' | 'Medium' | 'Hard'; visual_hint_css?: string; prophecy?: string } | null> => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Check if word exists for today
        const { data, error } = await supabase
            .from('daily_challenges')
            .select('*') // Select all columns
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
                hints: Array.isArray(data.hints) ? data.hints : [],
                difficulty: data.difficulty || 'Hard',
                visual_hint_css: data.meta?.visual_hint_css,
                prophecy: data.meta?.prophecy
            };
        }

        // 2. If no word, Generate one (Client-side generation logic - Legacy Fallback)
        // Ideally we want server-side generation via the seed script, but if we must generate here:
        // We will stick to the basic generation or update this to use the same logic if we wanted.
        // For now, let's keep the fallback logic but assume the seed script is primary.

        try {
            // ... (keeping existing fallback logic but stripping it down or ensuring it conforms to new return type)
            // Actually, for simplicity, if we are automating, we should rely on the DB.
            // But if we MUST generate on the fly:

            // Generate a new unique word with hints
            let word = '';
            let hints: string[] = [];
            let retryData: any = null;

            // Fetch all previously used words to ensure uniqueness
            const { data: previousChallenges } = await supabase
                .from('daily_challenges')
                .select('word')
                .order('date', { ascending: false });

            const usedWords = previousChallenges?.map(c => c.word.toUpperCase()) || [];

            let attempts = 0;
            while (word.length < 10 && attempts < 3) {
                const retry = await generateWord(['Hard']); // uses wordGenerator
                if (!usedWords.includes(retry.word.toUpperCase())) {
                    word = retry.word.toUpperCase();
                    hints = retry.hints || [];
                    retryData = retry;
                    break;
                }
                attempts++;
            }

            if (!word) throw new Error("Could not generate unique word");

            if (hints.length < 5) {
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
                .insert({
                    date: today,
                    word: word,
                    hints: hints,
                    difficulty: 'Hard',
                    meta: {
                        visual_hint_css: retryData?.visual_hint_css,
                        prophecy: "The stars differ today... a dynamically summoned challenge."
                    }
                });

            // ... error handling ...

            return {
                word,
                hints,
                difficulty: 'Hard',
                visual_hint_css: retryData?.visual_hint_css,
                prophecy: "The stars differ today... a dynamically summoned challenge."
            };

        } catch (e) {
            console.error("Daily Service Failed:", e);
            // Absolute fallback
            return {
                word: 'SUPERNATURAL',
                hints: ['Fallback Hint 1', 'Fallback Hint 2', 'Fallback Hint 3', 'Fallback Hint 4', 'S_P_R_N_T_R_L'],
                difficulty: 'Medium'
            };
        }
    } catch (error) {
        console.error("Error in getDailyWord:", error);
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
