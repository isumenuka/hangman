import { generateWord } from "./services/wordGenerator";

async function test() {
    try {
        console.log("Testing Gemini generation...");
        const result = await generateWord([]);
        console.log("Success:", result);
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

test();
