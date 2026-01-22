import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = "AIzaSyDoEXwejPFRzS7xFRbXM_pstd72Y9EOSR0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

export interface BotAction {
    type: 'CHAT' | 'GUESS' | 'WAIT';
    content: string; // Message or Letter
}

export const getBotAction = async (
    context: {
        botName: string;
        wordLength: number;
        guessedLetters: string[]; // Global guesses (if available) or known
        chatHistory: string[];
        gameState: 'PLAYING' | 'LOBBY' | 'WON' | 'LOST';
        difficulty: string;
    }
): Promise<BotAction> => {

    // Randomize persona slightly
    const isSaboteur = Math.random() > 0.7;

    const prompt = `
      You are playing a Hangman game. You are an AI Bot named "${context.botName}".
      
      CONTEXT:
      - Game State: ${context.gameState}
      - Word Length: ${context.wordLength} dots
      - Guessed Letters: [${context.guessedLetters.join(', ')}]
      - Chat History: ${JSON.stringify(context.chatHistory.slice(-5))}
      
      PERSONA: ${isSaboteur ? "Secret Saboteur (Try to mislead slightly, but act friendly)" : "Helpful Teammate (Enthusiastic but makes mistakes)"}
      
      OBJECTIVE:
      - Choose ONE action:
        1. 'GUESS': Pick a SINGLE letter (A-Z) that hasn't been guessed.
        2. 'CHAT': Say something short (max 10 words) relevant to the game or chat.
        3. 'WAIT': Do nothing (idling).
      
      CONSTRAINTS:
      - Do NOT guess a letter that is already in Guessed Letters.
      - If 'GUESS', content must be a SINGLE UPPERCASE LETTER.
      - If 'CHAT', content is the text.
      
      Output JSON only.
    `;

    const schema = {
        type: SchemaType.OBJECT,
        properties: {
            type: { type: SchemaType.STRING, enum: ['CHAT', 'GUESS', 'WAIT'] },
            content: { type: SchemaType.STRING }
        },
        required: ["type", "content"]
    };

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.9,
            }
        });

        const text = result.response.text();
        if (!text) return { type: 'WAIT', content: '' };

        return JSON.parse(text) as BotAction;

    } catch (error) {
        console.warn("Bot Brain Freeze:", error);
        return { type: 'WAIT', content: '' };
    }
};
