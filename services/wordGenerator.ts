import { WordData } from "../types";
import { Mistral } from "@mistralai/mistralai";

const API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;

export const generateWord = async (banList: string[] = []): Promise<WordData> => {
  if (!API_KEY) {
    console.warn("Mistral Service: No API Key found.");
    throw new Error("API_KEY_MISSING");
  }

  try {
    const mistral = new Mistral({ apiKey: API_KEY });

    // Add randomness to prompt effectively breaking cache
    const randomSeed = Math.random().toString(36).substring(7);

    const prompt = `
      Generate a UNIQUE and RANDOM "Curse Word" for a Hangman game.
      Random Seed: ${randomSeed}
      EXCLUDE THESE WORDS (ALREADY PLAYED): ${banList.join(', ')}
      
      THEME: Sri Lankan Culture (Food, Locations, History, Myth, Items).
      
      CRITICAL CONSTRAINTS:
      - Word must be STRICTLY 6 letters or longer.
      - DO NOT USE "KOTTU" (Too short/common).
      - DO NOT USE "RICE" or "CURRY" (Too simple).
      - Word must be SINGLE WORD (or joined with underscores), NO SPACES.
      - Generated "hints" array must contain EXACTLY 5 simple English sentences progressively getting easier.
      
      Format (JSON ONLY, no markdown):
      {
        "word": "STRING",
        "hint": "Cryptic main clue", 
        "difficulty": "Easy" | "Medium" | "Hard",
        "hints": ["Hint 1", "Hint 2", "Hint 3", "Hint 4", "Hint 5"] 
      }
    `;

    const response = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          content: prompt,
          role: "user",
        },
      ],
      responseFormat: {
        type: "json_object"
      },
      temperature: 0.9, // High creativity/randomness
    });

    const text = response.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text);
    console.log("Mistral Generated:", data);

    return {
      word: data.word.toUpperCase().replace(/\s+/g, '_'),
      hint: data.hint,
      difficulty: data.difficulty || "Medium",
      hints: data.hints || []
    };

  } catch (error: any) {
    console.error("Mistral Service Error:", error);
    // Check for rate limit errors
    if (error.message?.includes('429') || error.statusCode === 429) {
      throw new Error("API_LIMIT_EXCEEDED");
    }
    throw error;
  }
};
