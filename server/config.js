import "dotenv/config";

const str = (name, fallback = "") => (process.env[name] ?? fallback).trim();
const int = (name, fallback) => {
  const v = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) ? v : fallback;
};
const float = (name, fallback) => {
  const v = parseFloat(process.env[name] ?? "");
  return Number.isFinite(v) ? v : fallback;
};

export const config = {
  mongo: {
    uri: str("MONGODB_URI"),
    db: str("MONGODB_DB", "rag_demo"),
    collection: str("MONGODB_COLLECTION", "knowledge_base"),
    indexName: str("VECTOR_INDEX_NAME", "vector_index"),
  },
  voyage: {
    baseUrl: str("VOYAGE_BASE_URL", "https://api.voyageai.com/v1").replace(/\/+$/, ""),
    apiKey: str("VOYAGE_API_KEY"),
    rerankModel: str("VOYAGE_RERANK_MODEL", "rerank-3"),
    rerankTopK: int("VOYAGE_RERANK_TOP_K", 5),
  },
  llm: {
    baseUrl: str("LLM_BASE_URL", "https://api.deepseek.com").replace(/\/+$/, ""),
    apiKey: str("LLM_API_KEY"),
    model: str("LLM_MODEL", "deepseek-flash"),
    temperature: float("LLM_TEMPERATURE", 0.2),
  },
  port: int("PORT", 3000),
};
