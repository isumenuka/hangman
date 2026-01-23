const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL; // Using VITE_ prefix to match frontend .env if shared, but usually server uses distinct names. We'll stick to what might be in root .env
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // NEEDS SERVICE ROLE KEY for writing to daily_challenges table if RLS is strict
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

// Initialize Clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function generateDailyChallenge() {
    console.log('[DailyGenerator] 🔮 Summoning new daily ritual...');

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const prompt = `
            Act as the "Cursed Game Master".
            Generate a SINGLE chaotic, cursed daily challenge word for Hangman.
            
            REQUIREMENTS:
            1. Word must be between 8-15 letters.
            2. Theme: Eldritch, Cosmic Horror, Mystery, Psychological, Dark.
            3. Provide 5 progressive hints.
            4. Provide a "Prophecy" (a cryptic, rhyming couplet about the word).
            5. Provide a "Visual Hint CSS" string (abstract CSS background).
            
            OUTPUT JSON ONLY:
            {
                "word": "STRING (UPPERCASE)",
                "difficulty": "Hard" | "Expert" | "Nightmare",
                "hints": ["hint1", "hint2", ...],
                "prophecy": "STRING",
                "visual_hint_css": "STRING"
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // clean json
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanedText);

        const today = new Date().toISOString().split('T')[0];

        // Insert into Supabase
        const { error } = await supabase
            .from('daily_challenges')
            .upsert({
                date: today,
                word: data.word.toUpperCase(),
                hints: data.hints,
                difficulty: data.difficulty,
                prophecy: data.prophecy, // Ensure this column exists or add it to table
                visual_hint_css: data.visual_hint_css, // Ensure this column exists
                created_at: new Date().toISOString()
            }, { onConflict: 'date' });

        if (error) throw error;

        console.log(`[DailyGenerator] ✅ Daily Ritual successfully summoned for ${today}: ${data.word}`);

    } catch (error) {
        console.error('[DailyGenerator] ❌ Ritual Failed:', error);
    }
}

// Schedule: Runs every day at Midnight (00:00)
// '0 0 * * *' = Minute 0, Hour 0
const task = cron.schedule('0 0 * * *', () => {
    generateDailyChallenge();
}, {
    scheduled: true,
    timezone: "UTC"
});

console.log('[DailyGenerator] 🕰️ Cron Job Scheduled (UTC Midnight)');

// Export for manual triggering if needed
module.exports = { generateDailyChallenge, task };
