
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDoEXwejPFRzS7xFRbXM_pstd72Y9EOSR0"; // Using same key as imposter.ts for consistency
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

export const generateShader = async (mood: string): Promise<string> => {
  const prompt = `
    Write a GLSL fragment shader for a background effect.
    MOOD: ${mood}
    
    Requirements:
    - Use 'uniform float time;' for animation.
    - Use 'uniform vec2 resolution;' for coordinates.
    - Output 'gl_FragColor'.
    - The code should be visually interesting, abstract, and match the mood.
    - Keep it relatively performant.
    - DO NOT include vertex shader code.
    - DO NOT use undefined uniforms.
    - ONLY return the raw GLSL code, no markdown backticks, no explanations.
    - Start directly with 'void main() {' or helper functions.
    - Ensure #ifdef GL_ES precision mediump float; #endif is at the top.
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.1, // High creativity
        topP: 0.95,
      }
    });

    let code = result.response.text();
    // Clean up if Gemini adds markdown
    code = code.replace(/```glsl/g, '').replace(/```/g, '').trim();
    return code;

  } catch (error) {
    console.error("Shader Generation Failed:", error);
    // Fallback shader (simple gradient)
    return `
      #ifdef GL_ES
      precision mediump float;
      #endif
      uniform float time;
      uniform vec2 resolution;
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        gl_FragColor = vec4(0.5 + 0.5*cos(time+uv.xyx+vec3(0,2,4)), 1.0);
      }
    `;
  }
};
