import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
                bpm: { type: SchemaType.NUMBER },
                baseKey: { type: SchemaType.STRING },
                mood: { type: SchemaType.STRING },
                instruments: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            name: { type: SchemaType.STRING, enum: ["bass", "lead", "pad", "noise"] },
                            oscillator: { type: SchemaType.STRING, enum: ["fmsine", "amtriangle", "sawtooth", "square", "pwm"] },
                            envelope: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    attack: { type: SchemaType.NUMBER },
                                    decay: { type: SchemaType.NUMBER },
                                    sustain: { type: SchemaType.NUMBER },
                                    release: { type: SchemaType.NUMBER }
                                },
                                required: ["attack", "decay", "sustain", "release"]
                            },
                            notes: {
                                type: SchemaType.ARRAY,
                                items: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        note: { type: SchemaType.STRING }, // e.g. "C2", "G#5", or null for rest
                                        duration: { type: SchemaType.STRING }, // e.g. "4n", "8n"
                                        time: { type: SchemaType.STRING } // e.g. "0:0:0", "0:0:2"
                                    },
                                    required: ["note", "duration", "time"]
                                }
                            }
                        },
                        required: ["name", "oscillator", "envelope", "notes"]
                    }
                }
            },
            required: ["bpm", "mood", "instruments"]
        }
    }
});

export interface ComposerData {
    bpm: number;
    baseKey: string;
    mood: string;
    instruments: {
        name: "bass" | "lead" | "pad" | "noise";
        oscillator: string;
        envelope: { attack: number, decay: number, sustain: number, release: number };
        notes: { note: string | null, duration: string, time: string }[];
    }[];
}

export const composeTheme = async (word: string, atmosphere: string): Promise<ComposerData> => {
    const prompt = `
    Role: You are a Horror Movie Composer / Avant-Garde Sound Designer.
    Task: Compose a short, looping musical motif (web audio JSON) for a Hangman game.
    
    Context:
    - Current Word: "${word}"
    - Atmosphere: "${atmosphere}"
    
    Instructions:
    1. Analyze the word. Is it industrial? Supernatural? Visceral?
    2. Choose 1-3 instruments (e.g. a deep bass drone, a detuned lead, or white noise bursts).
    3. Generate a sequence of notes.
       - Use DISSONANCE for horror (minor seconds, tritones).
       - Use "null" in notes for rests/silence.
    4. Keep it SPARCE. Do not overfill. Silence is scary.
    
    Output: JSON matching the schema.
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(response.text());
    } catch (error) {
        console.error("Composer Failed:", error);
        // Fallback minimal drone
        return {
            bpm: 60,
            baseKey: "C2",
            mood: "Fallback Drone",
            instruments: [{
                name: "pad",
                oscillator: "fmsine",
                envelope: { attack: 0.5, decay: 0.1, sustain: 0.3, release: 1 },
                notes: [{ note: "C2", duration: "1n", time: "0:0:0" }]
            }]
        };
    }
};
