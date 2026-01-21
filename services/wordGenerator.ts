import { WordData } from "../types";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// API Key provided by user
const API_KEY = "AIzaSyDoEXwejPFRzS7xFRbXM_pstd72Y9EOSR0";

export const generateWord = async (banList: string[] = []): Promise<WordData> => {
  if (!API_KEY) {
    console.warn("Gemini Service: No API Key found.");
    throw new Error("API_KEY_MISSING");
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp"
    });

    // Add randomness to prompt effectively breaking cache
    const randomSeed = Math.random().toString(36).substring(7);

    const prompt = `
      Generate a UNIQUE and RANDOM "Curse Word" for a Hangman game.
      Random Seed: ${randomSeed}
      EXCLUDE THESE WORDS (ALREADY PLAYED): ${banList.join(', ')}
      
      THEME: Simple, Common English Words for Children (Grade 1 - Grade 5 Level).
      OBJECTIVE: Pick a word that is completely different from previous ones.
      
      CRITICAL CONSTRAINTS:
      - Word must be STRICTLY 6 letters or longer.
      - MUST BE Valid Standard English Dictionary Words.
      - ABSOLUTELY NO Transliterated words (No Singlish).
      - ABSOLUTELY NO Slang or Local Dialects.
      - NO Proper Nouns (Names of people or specific places).
      - Word must be SINGLE WORD (or joined with underscores), NO SPACES.
      - Word must be a SINGULAR NOUN (Absolute NO PLURALS like 'Cats', 'Houses', 'Trees').
      - Generated "hints" array must contain EXACTLY 5 simple English sentences progressively getting easier.
      
      Output JSON only.
    `;

    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        word: { type: SchemaType.STRING },
        hint: { type: SchemaType.STRING },
        difficulty: { type: SchemaType.STRING, enum: ["Easy", "Medium", "Hard"] },
        hints: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ["word", "hint", "difficulty", "hints"]
    };

    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.9 + (attempts * 0.05), // Increase randomness on retry
        }
      });

      const responseText = result.response.text();
      if (!responseText) throw new Error("No response from AI");

      const data = JSON.parse(responseText);

      const candidateWord = data.word.toUpperCase().replace(/\s+/g, '_');

      // Strict Client-Side Filter
      if (banList.map(w => w.toUpperCase()).includes(candidateWord)) {
        console.warn(`[WordGenerator] Duplicate word generated: ${candidateWord}. Retrying (${attempts}/${MAX_ATTEMPTS})...`);
        continue;
      }

      console.log("Gemini Generated:", data);

      return {
        word: candidateWord,
        hint: data.hint,
        difficulty: data.difficulty || "Medium",
        hints: data.hints || []
      };
    }

    throw new Error("FAILED_TO_GENERATE_UNIQUE_WORD");

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    if (error.message?.includes('429') || error.status === 429) {
      throw new Error("API_LIMIT_EXCEEDED");
    }
    throw error;
  }
};
