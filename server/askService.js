import { config } from "./config.js";
import { vectorSearch, vectorSearchWithRerank } from "./db.js";
import { chat } from "./llmClient.js";

const NO_RAG_SYSTEM = `You are a helpful assistant. Answer the user's question directly. If you are not certain about product-specific facts (prices, dates, version numbers, or certifications), say so honestly instead of guessing.`;

const RAG_SYSTEM = `You are an assistant for Orbital, a data-observability platform. Answer the user's question using ONLY the context provided below. Cite the source title for each fact you use. If the context does not contain the answer, say so explicitly and do not guess.`;

const MODES = {
  noRag: {
    mode: "no-rag",
    label: "LLM only",
    description: "DeepSeek answers with no access to Orbital's internal knowledge base.",
  },
  vectorSearch: {
    mode: "vector-search",
    label: "Vector Search (Voyage 4)",
    description: "Atlas Vector Search retrieves the top 8 chunks, then DeepSeek answers.",
  },
  rerank: {
    mode: "vector-search-rerank",
    label: "Vector Search + Rerank (Voyage 4 + rerank-3)",
    description:
      "Atlas retrieves 20 candidates, then $rerank (Voyage rerank-3) keeps the top 5 for DeepSeek.",
  },
};

function buildRagSystem(contexts) {
  const blocks = contexts
    .map((c, i) => {
      const heading = c.section ? `${c.title} / ${c.section}` : c.title;
      return `[${i + 1}] (${heading})\n${c.text}`;
    })
    .join("\n\n");
  return `${RAG_SYSTEM}\n\nContext:\n${blocks}`;
}

function toContext(hit) {
  return { title: hit.title, section: hit.section, text: hit.text };
}

async function pipelineNoRag(question) {
  const started = Date.now();
  const { content, usage } = await chat([
    { role: "system", content: NO_RAG_SYSTEM },
    { role: "user", content: question },
  ]);
  return {
    ...MODES.noRag,
    answer: content,
    context: [],
    latencyMs: Date.now() - started,
    usage,
  };
}

async function pipelineVectorSearch(question) {
  const started = Date.now();
  const hits = await vectorSearch(question, { numCandidates: 100, limit: 8 });
  const contexts = hits.map((h) => ({ ...toContext(h), score: h.score }));
  const { content, usage } = await chat([
    { role: "system", content: buildRagSystem(contexts) },
    { role: "user", content: question },
  ]);
  return {
    ...MODES.vectorSearch,
    answer: content,
    context: contexts,
    latencyMs: Date.now() - started,
    usage,
  };
}

async function pipelineRerank(question) {
  const started = Date.now();
  const hits = await vectorSearchWithRerank(question, {
    numCandidates: 200,
    limit: 20,
    rerankLimit: config.rerank.topK,
    model: config.rerank.model,
  });
  const contexts = hits.map((h) => ({
    title: h.title,
    section: h.section,
    text: h.text,
    relevanceScore: h.rerankScore,
    vectorRank: h.vectorRank,
  }));
  const { content, usage } = await chat([
    { role: "system", content: buildRagSystem(contexts) },
    { role: "user", content: question },
  ]);
  return {
    ...MODES.rerank,
    answer: content,
    context: contexts,
    latencyMs: Date.now() - started,
    usage,
  };
}

// Run one pipeline in isolation so a failure (e.g. a bad API key) surfaces on
// that card only, instead of blanking the other two results.
async function safeRun(fn, meta) {
  const started = Date.now();
  try {
    return await fn();
  } catch (err) {
    return {
      ...meta,
      answer: "",
      context: [],
      error: err?.message || String(err),
      latencyMs: Date.now() - started,
      usage: null,
    };
  }
}

export async function ask(question) {
  const [noRag, vs, vsRerank] = await Promise.all([
    safeRun(() => pipelineNoRag(question), MODES.noRag),
    safeRun(() => pipelineVectorSearch(question), MODES.vectorSearch),
    safeRun(() => pipelineRerank(question), MODES.rerank),
  ]);
  return { question, results: [noRag, vs, vsRerank] };
}
