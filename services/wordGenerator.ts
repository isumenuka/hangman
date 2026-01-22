import { WordData, TournamentData } from "../types";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// API Key provided by user
const API_KEY = "AIzaSyDoEXwejPFRzS7xFRbXM_pstd72Y9EOSR0";

// --- Infinite Difficulty Analysis ---
// Ideally this would come from a database, but we will pass a simple summary object
interface PlayerHistory {
  winRate: number; // 0.0 to 1.0
  weakestPhonemes?: string[]; // e.g. ['TH', 'QU', 'Z'] - Optional advanced feature
  mostMissedLetters?: string[]; // e.g. ['Z', 'X', 'Q']
}

export const generateTournamentBatch = async (banList: string[] = [], history?: PlayerHistory): Promise<TournamentData> => {
  if (!API_KEY) throw new Error("API_KEY_MISSING");

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

  // Adaptive Difficulty Prompting
  let difficultyContext = "Mix of Easy, Medium, Hard words.";
  if (history) {
    if (history.winRate > 0.8) {
      difficultyContext = "Player is ELITE. Generate OBSCURE, LONG, and PHONETICALLY COMPLEX words (e.g., lots of consonants, tricky vowels). Focus on letters like: " + (history.mostMissedLetters?.join(',') || 'J, Z, Q, X');
    } else if (history.winRate < 0.3) {
      difficultyContext = "Player is Struggling. Generate Simple, Common words. Avoid complex clusters.";
    }
  }

  const prompt = `
      Act as the "Cursed Game Master".
      Generate a TOURNAMENT BATCH of 5 unique words for a Hangman game session.
      
      CONTEXT:
      - Ban List (Do not use): ${banList.slice(-50).join(', ')}
      - Player Skill Profile: ${difficultyContext}
      
      REQUIREMENTS:
      1. Generate 5 Words.
      2. Word 1 should be Easy, Word 5 should be Nightmare (or adapted to profile).
      3. For EACH word, provide:
         - The Word (Single noun, no spaces).
         - 5 Progressive Hints.
         - Difficulty Rating.
         - A "Visual Hint CSS" (Abstract art style).
      4. Generate a "PROPHECY": A 4-line rhyming poem that vaguely hints at the themes/meanings of these 5 words without naming them. 
         - It should sound like an ancient curse.
      
      OUTPUT JSON ONLY (TournamentData schema).
    `;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      words: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            word: { type: SchemaType.STRING },
            hint: { type: SchemaType.STRING },
            difficulty: { type: SchemaType.STRING, enum: ["Easy", "Medium", "Hard"] },
            hints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            visual_hint_css: { type: SchemaType.STRING }
          },
          required: ["word", "hint", "difficulty", "hints", "visual_hint_css"]
        }
      },
      prophecy: { type: SchemaType.STRING }
    },
    required: ["words", "prophecy"]
  };

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 1.0,
      }
    });

    const text = result.response.text();
    if (!text) throw new Error("No response");

    const data = JSON.parse(text) as TournamentData;

    // Sanitize
    data.words = data.words.map(w => ({
      ...w,
      word: w.word.toUpperCase().replace(/[^A-Z]/g, ''),
      id: Math.random().toString(36).substring(7)
    }));

    return data;

  } catch (e) {
    console.error("Batch Gen Error", e);
    throw e;
  }
};

// Legacy support if needed, or simple wrapper
export const generateWord = async (banList: string[] = []): Promise<WordData> => {
  const batch = await generateTournamentBatch(banList);
  return batch.words[0];
};
