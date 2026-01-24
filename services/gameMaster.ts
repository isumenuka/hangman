import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GameMasterResponse } from "../types";

// API Key provided by user
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Lazy initialization wrapper to prevent crash on load if key is missing
const getModel = () => {
    if (!API_KEY) {
        console.warn("VITE_GEMINI_API_KEY is missing. Game Master features will fail.");
        return null;
    }
    const genAI = new GoogleGenerativeAI(API_KEY);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
};

export const consultGameMaster = async (
    context: {
        word: string,
        guessedLetters: string[],
        wrongGuesses: number,
        playerNames: string[],
        recentAction: string, // e.g., "Player X missed letter Z"
        streak: number
    }
): Promise<GameMasterResponse> => {

    // Add randomness to prompt
    const moodSeed = Math.random();

    const prompt = `
      You are the Cursed Spirit (Game Master) of a Hangman game.
      
      CONTEXT:
      - Word is: "${context.word}"
      - Guessed: [${context.guessedLetters.join(', ')}]
      - Wrong Guesses: ${context.wrongGuesses}/6
      - Players: ${context.playerNames.join(', ')}
      - Recent Event: "${context.recentAction}"
      - Streak: ${context.streak}

      OBJECTIVE:
      1. Analyze the state. Are they winning easily? Struggling?
      2. Generate a SHORT, creepy, or mocking narrative sentence (max 15 words).
      3. Decide if you want to change the rules to make it harder or more chaotic.
      
      PERSONALITY:
      - If streak > 3: Be angry, try to stop them.
      - If wrongGuesses > 4: Be excited for the kill, taunt them.
      - If random seed (${moodSeed}) > 0.8: Be chaotic.
      
      RULES TO CHOOSE FROM:
      - "NONE": Do nothing.
      - "VOWELS_DISABLED": Punish them, maybe if they are spamming vowels.
      - "Invert_Controls": Only if they are doing very well.
      - "Double_Damage": If they have few misses, make the next one hurt more.
      - "SILENCE": If 'Chat_Frequency' is HIGH. Penalize talking.
      
      ATMOSPHERE:
      - "RED_FOG": Anger/Danger.
      - "GLITCH": Confusion.
      - "DARKNESS": Despair.

      OUTPUT JSON ONLY.
    `;

    const schema = {
        type: SchemaType.OBJECT,
        properties: {
            narrative: { type: SchemaType.STRING },
            attitude: { type: SchemaType.STRING, enum: ['Sadistic', 'Helpful', 'Cryptic', 'Bored'] },
            rule_change: { type: SchemaType.STRING, enum: ['NONE', 'VOWELS_DISABLED', 'Invert_Controls', 'Double_Damage', 'SILENCE'] },
            atmosphere: { type: SchemaType.STRING, enum: ['NONE', 'RED_FOG', 'GLITCH', 'DARKNESS'] }
        },
        required: ["narrative", "attitude"]
    };

    try {
        const model = getModel();
        if (!model) throw new Error("API Key Missing");

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.8,
            }
        });

        const text = result.response.text();
        if (!text) throw new Error("No response from GM");

        const data = JSON.parse(text);
        console.log("GM Spoke:", data);
        return data as GameMasterResponse;

    } catch (error) {
        console.error("GM Error:", error);
        // Fallback if AI fails
        return {
            narrative: "The spirit sends a chill down your spine...",
            attitude: 'Cryptic',
            rule_change: 'NONE',
            atmosphere: 'NONE'
        };
    }
};
