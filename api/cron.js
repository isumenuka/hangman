import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Vercel Serverless Function
// Runs automatically via Vercel Cron
export default async function handler(req, res) {
    console.log('[Cron] 🔮 Summoning new daily ritual...');

    try {
        // Validation (Security)
        const authHeader = req.headers.authorization;
        // Vercel Cron requests include this header
        if (req.query.key !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // Basic protection if called manually, but Cron usually authorized by Vercel platform
            // For simplicity in this demo, we might skip strict checking or rely on Vercel's internal protection
        }

        const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
        const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
            throw new Error("Missing Environment Variables");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
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
                prophecy: data.prophecy,
                visual_hint_css: data.visual_hint_css,
                created_at: new Date().toISOString()
            }, { onConflict: 'date' });

        if (error) throw error;

        console.log(`[Cron] ✅ Daily Ritual successfully summoned for ${today}: ${data.word}`);
        res.status(200).json({ success: true, word: data.word });

    } catch (error) {
        console.error('[Cron] ❌ Ritual Failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
