import { config } from "./config.js";

/**
 * Voyage AI rerank endpoint. Returns items sorted by relevance_score (desc).
 * Each item: { index, relevance_score, document }
 */
export async function rerank(query, documents, topK = config.voyage.rerankTopK) {
  if (!config.voyage.apiKey) throw new Error("VOYAGE_API_KEY is not set.");
  const url = `${config.voyage.baseUrl}/rerank`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.voyage.apiKey}`,
    },
    body: JSON.stringify({
      query,
      documents,
      model: config.voyage.rerankModel,
      top_k: topK,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voyage rerank failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.data ?? [];
}
