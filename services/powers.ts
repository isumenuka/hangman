
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDoEXwejPFRzS7xFRbXM_pstd72Y9EOSR0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// --- 1. The Oracle (Hint) ---
export const getOracleHint = async (word: string): Promise<string> => {
    const prompt = `
    You are a cryptic Oracle in a horror game.
    The secret word is: "${word}".
    
    Generate a short, 4-line rhyming riddle that hints at the word without revealing it directly.
    Tone: Mysterious, slightly creepy, ancient.
    Language: English.
    
    Output nothing but the riddle.
  `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return text.trim();
    } catch (e) {
        console.error("Oracle Failed:", e);
        return "The spirits are silent... (AI Error)";
    }
};

// --- 2. Psychic Damage (Roast) ---
export const generateRoast = async (targetName: string, mistakes: number, score: number): Promise<string> => {
    const prompt = `
    Roast the player named "${targetName}".
    Context: They have ${mistakes} mistakes and a score of ${score}.
    
    Requirement:
    - Generate a savage, short, funny, and slightly mean taunt.
    - Max 15 words.
    - If they have many mistakes, mock their incompetence.
    - If they have few mistakes but low score, mock their slowness.
    - Tone: Like a sassy demon or GlaDOS.
    
    Output text only.
  `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return text.trim();
    } catch (e) {
        console.error("Roast Failed:", e);
        return `${targetName} is ... well, they are trying.`;
    }
};

// --- 3. Reality Glitch (Narrative flavor) ---
export const generateGlitchText = async (): Promise<string> => {
    const prompt = `
    Generate a "glitched" system message for a horror game logic failure.
    
    Requirements:
    - Text should look like the game is realizing it's a game or a demon is breaking through.
    - Use some Zalgo text or corrupted characters if possible (unicode).
    - Max 2 sentences.
    - Example: "D0 not l00k behind y0u... the c0de is bleeding."
    
    Output text only.
  `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return text.trim();
    } catch (e) {
        console.error("Glitch Failed:", e);
        return "SYSTEM FAILURE... 0xDEADBEEF";
    }
};
