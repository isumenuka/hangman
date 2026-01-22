
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Load Env Vars manually (since no dotenv)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

console.log(`Loading env from: ${envPath}`);

let SUPABASE_URL = '';
let SUPABASE_KEY = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split(/\r?\n/).forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) {
            if (key.trim() === 'VITE_SUPABASE_URL') SUPABASE_URL = val.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY' || key.trim() === 'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY') SUPABASE_KEY = val.trim();
        }
    });
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

// 2. Init Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const seed = async () => {
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📅 Seeding Daily Ritual for: ${today}`);

    // 3. Delete existing
    const { error: delError } = await supabase
        .from('daily_challenges')
        .delete()
        .eq('date', today);

    if (delError) console.warn("⚠️  Could not delete existing (might not exist):", delError.message);
    else console.log("✅ Cleared existing record.");

    // 4. Insert Test Data
    const testWord = 'SUPERNATURAL';
    const testHints = [
        "First Hint: Beyond the laws of physics.",
        "Second Hint: Ghosts and spirits.",
        "Third Hint: A popular TV show about brothers.",
        "Fourth Hint: Not of this world.",
        "Fifth Hint: S_P_R_A_U_A_"
    ];

    const { error: insError } = await supabase
        .from('daily_challenges')
        .insert({
            date: today,
            word: testWord,
            hints: testHints // JSONB array
        });

    if (insError) {
        console.error("❌ Failed to insert test data:", insError);
    } else {
        console.log("\n✨ SUCCESS! Daily Ritual set to:");
        console.log(`   Word: ${testWord}`);
        console.log(`   Hints: ${JSON.stringify(testHints, null, 2)}`);
        console.log("\n👉 You can now refresh the game to see usage.");
    }
};

seed();
