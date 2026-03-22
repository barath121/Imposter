
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateWordsForCategory(topic: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a list of 15 unique, well-known items or names related to the topic: "${topic}". The items should be simple enough for a word guessing game.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          words: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of words related to the topic."
          }
        },
        required: ["words"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text);
    return data.words;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return [];
  }
}
