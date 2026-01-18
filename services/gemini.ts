import { WordData } from "../types";

// import { GoogleGenAI, Type, Schema } from "@google/genai";
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Mock data to prevent crash
export const generateWord = async (): Promise<WordData> => {
  console.log("Gemini Service: Generating mocked word");
  return {
    word: "RITUAL",
    hint: "A ceremony of dark intent.",
    difficulty: "Easy"
  };
};
