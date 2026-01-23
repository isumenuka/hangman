
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// 1. Load Env Vars manually (since no dotenv)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

console.log(`Loading env from: ${envPath}`);

let SUPABASE_URL = '';
let SUPABASE_KEY = '';
let GEMINI_API_KEY = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split(/\r?\n/).forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) {
            if (key.trim() === 'VITE_SUPABASE_URL') SUPABASE_URL = val.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY' || key.trim() === 'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY') SUPABASE_KEY = val.trim();
            if (key.trim() === 'VITE_GEMINI_API_KEY') GEMINI_API_KEY = val.trim();
        }
    });
}

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error("❌ Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or VITE_GEMINI_API_KEY in .env");
    process.exit(1);
}

// 2. Init Clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const generateDailyWord = async () => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const schema = {
        type: SchemaType.OBJECT,
        properties: {
            word: { type: SchemaType.STRING },
            hints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            difficulty: { type: SchemaType.STRING, enum: ["Easy", "Medium", "Hard"] },
            visual_hint_css: { type: SchemaType.STRING },
            prophecy: { type: SchemaType.STRING }
        },
        required: ["word", "hints", "difficulty", "visual_hint_css", "prophecy"]
    };

    const prompt = `
      Act as the "Daily Ritual Master".
      Generate a SINGLE unique word for the Daily Challenge.
      
      REQUIREMENTS:
      1. Word must be at least 10 letters long.
      2. Complex, obscure, or thematic (Mystical, Horror, Ancient).
      3. Provide 5 progressive hints.
      4. Provide a "Visual Hint CSS" string (abstract background art using gradients/filters).
      5. Provide a short "Prophecy" (flavor text).
      
      OUTPUT JSON ONLY.
    `;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 1.0,
        }
    });

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text);
};

const seed = async () => {
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📅 Seeding Daily Ritual for: ${today}`);

    try {
        // 3. Generate Word
        console.log("🔮 Summoning word from Gemini...");
        const data = await generateDailyWord();
        const word = data.word.toUpperCase().replace(/[^A-Z]/g, '');

        console.log(`   Word Sighted: ${word}`);

        // 4. Delete existing
        const { error: delError } = await supabase
            .from('daily_challenges')
            .delete()
            .eq('date', today);

        if (delError) console.warn("⚠️  Could not delete existing (might not exist):", delError.message);

        // 5. Insert New Data
        const { error: insError } = await supabase
            .from('daily_challenges')
            .insert({
                date: today,
                word: word,
                hints: data.hints,
                difficulty: data.difficulty,
                meta: {
                    visual_hint_css: data.visual_hint_css,
                    prophecy: data.prophecy
                }
            });

        if (insError) {
            console.error("❌ Failed to insert data:", insError);
        } else {
            console.log("\n✨ SUCCESS! Daily Ritual set.");
            console.log(`   Difficulty: ${data.difficulty}`);
            console.log(`   Prophecy: ${data.prophecy}`);
            console.log("\n👉 You can now refresh the game.");
        }

    } catch (e) {
        console.error("❌ Seeding Failed:", e);
    }
};

seed();
