import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const summarizeContent = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Vytvoř stručné shrnutí následujícího textu v českém jazyce (maximálně 3 odrážky). Text článku: ${text.slice(0, 5000)}`,
    });
    
    return response.text || "Nepodařilo se vygenerovat shrnutí.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Omlouváme se, při generování shrnutí došlo k chybě.";
  }
};