import { GoogleGenAI, Type, Schema } from "@google/genai";
import { WordData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const wordSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    word: {
      type: Type.STRING,
      description: "The target word or short phrase (max 12 characters, no special chars except spaces).",
    },
    hint: {
      type: Type.STRING,
      description: "A clever, slightly cryptic hint for the player.",
    },
    difficulty: {
      type: Type.STRING,
      enum: ["Easy", "Medium", "Hard"],
      description: "The estimated difficulty of the word.",
    },
  },
  required: ["word", "hint", "difficulty"],
};

export const generateWord = async (): Promise<WordData> => {
  // TESTING OVERRIDE
  return {
    word: "TESTING",
    hint: "This is a hardcoded value for testing mechanics.",
    difficulty: "Easy"
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a random word or short idiom for a game of Hangman. It should be challenging but common enough to guess. Avoid very obscure words.",
      config: {
        responseMimeType: "application/json",
        responseSchema: wordSchema,
        thinkingConfig: { thinkingBudget: 0 }, // Low latency preferred for simple task
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    const data = JSON.parse(text) as WordData;
    // Normalize word to uppercase
    data.word = data.word.toUpperCase();
    return data;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback in case of error
    return {
      word: "FALLBACK",
      hint: "The API failed, so here is a simple word.",
      difficulty: "Easy",
    };
  }
};
