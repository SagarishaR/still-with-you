import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateEmbedding(text) {
  if (!text || !text.trim()) {
    throw new Error("Cannot generate an embedding for empty text.");
  }

  const result = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  const embedding = result.embeddings?.[0]?.values;

  if (!embedding || embedding.length !== 768) {
    throw new Error(
      `Invalid embedding returned. Expected 768 dimensions, got ${
        embedding?.length ?? 0
      }.`
    );
  }

  return embedding;
}
