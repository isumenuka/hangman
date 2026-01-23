
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// 1. Load Env Vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Encryption Helper (Standard Node PBKDF2)
const hashPassword = (password: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
};

// 3. Main Script
const createUser = async () => {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: npx tsx scripts/create_user.ts <email> <password>");
        process.exit(1);
    }

    const [email, password] = args;

    try {
        console.log(`🔐 Securing password for: ${email}...`);
        const passwordHash = await hashPassword(password);

        console.log(`👤 Inserting into custom_users table...`);
        const { data, error } = await supabase
            .from('custom_users')
            .insert({
                email: email,
                password_hash: passwordHash,
                is_confirmed: true // Admin created users are auto-confirmed
            })
            .select()
            .single();

        if (error) {
            console.error("❌ Failed to create user:", error.message);
        } else {
            console.log("✅ SUCCESS! User created.");
            console.log(`   ID: ${data.id}`);
            console.log(`   Email: ${data.email}`);
        }

    } catch (e) {
        console.error("❌ Error:", e);
    }
};

createUser();
