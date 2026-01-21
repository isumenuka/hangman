import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDoEXwejPFRzS7xFRbXM_pstd72Y9EOSR0";

async function listModels() {
    const genAI = new GoogleGenerativeAI(API_KEY);
    try {
        // Note: older SDKs might not have listModels directly on genAI, checking usage.
        // It seems typically not directly exposed on the instance in some versions, but let's check.
        // Actually typically it is via a ModelManager or similar, but for simple checking:
        // We can try to just use a known working model like 'gemini-1.5-flash' first?
        // But listing is better.
        // I made a mistake in previous thought, listModels is not on genAI instance directly usually.
        // It's in the client.
        // Actually, checking docs (simulated): existing SDK usually requires a separate call or specific usage.
        // Let's just try to change the model to 'gemini-2.0-flash-exp' which is likely what they mean or 'gemini-1.5-pro'.

        // Instead of listing (which might be complex to guess the API), I'll try a fallback list of models.
        const modelsToTry = ["gemini-2.0-flash-exp", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-pro"];

        for (const m of modelsToTry) {
            console.log(`Trying model: ${m}`);
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("Hello");
                console.log(`Success with ${m}:`, result.response.text());
                return;
            } catch (e) {
                console.log(`Failed ${m}:`, e.message);
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
