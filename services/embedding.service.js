const axios = require("axios");

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;

// Example endpoint (provider-agnostic pattern)
const EMBEDDING_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

// We isolate ALL embedding logic here
const embeddingClient = axios.create({
  baseURL: EMBEDDING_API_URL,
  headers: {
    "x-goog-api-key": EMBEDDING_API_KEY,
    "Content-Type": "application/json",
  },
});

/**
 * Convert text into a vector embedding
 * @param {string} text
 * @returns {number[]} vector
 */
const generateEmbedding = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error("Text is required for embedding");
  }

  try {
    const response = await embeddingClient.post("", {
        "model":"models/gemini-embedding-001",
        "content": {
            "parts":[{
            "text": text}]
        },
        "output_dimensionality": 1536
    });

    return response?.data?.embedding?.values || [];
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(`Error generating embedding: ${error.message}`);
  }
};

module.exports = {
  generateEmbedding,
};
