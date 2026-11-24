# AI Day Demo 2026 — MongoDB Atlas Vector Search in RAG

A web demo that shows, **for the same question**, how an LLM's answer improves as we add retrieval over an internal knowledge base:

| Pipeline | Retrieval | Model |
|----------|-----------|-------|
| A. **LLM only** | none | DeepSeek |
| B. **Vector Search** | Atlas Vector Search (top 8) | Voyage 4 (Atlas automated embedding) |
| C. **Vector Search + Rerank** | Atlas (top 20) → rerank top 5 | Voyage 4 + Voyage rerank-3 |

The demo uses a fictional product, **"Orbital"**, with an internal knowledge base of facts the LLM cannot know (prices, release dates, certifications, hard limits), so the three pipelines produce visibly different answers.

See [DESIGN.md](DESIGN.md) for the full design.

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (M10+), MongoDB 8.0+
- A [DeepSeek](https://platform.deepseek.com/api_keys) API key
- A [Voyage AI](https://docs.voyageai.com/docs/api-key-and-installation) API key

### Atlas prerequisites for Automated Embedding

The vector index uses **Atlas Automated Embedding** (`autoEmbed`), so Atlas generates Voyage 4 embeddings for the `text` field automatically. Before seeding:

1. Enable **storage auto-scaling** on your M10+ cluster (required for Automated Embedding).
2. Configure a **Voyage AI API key in Atlas**: Atlas UI → *Search & Vector Search* → *Model API Keys* (or generate the key directly from Voyage AI).

## Setup

```bash
cp .env.example .env
# edit .env and fill in MONGODB_URI, VOYAGE_API_KEY, and LLM_API_KEY

npm install
npm run seed    # inserts the corpus and creates the autoEmbed vector index
npm start       # → http://localhost:3000
```

## Configuration (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | Atlas connection string | — |
| `MONGODB_DB` | Database name | `rag_demo` |
| `MONGODB_COLLECTION` | Collection name | `knowledge_base` |
| `VOYAGE_BASE_URL` | Voyage rerank base. Atlas Model API keys → `https://ai.mongodb.com/v1`; Voyage-platform keys → `https://api.voyageai.com/v1` | `https://ai.mongodb.com/v1` |
| `VOYAGE_API_KEY` | Voyage API key (rerank) | — |
| `VOYAGE_RERANK_MODEL` | Rerank model | `rerank-3` |
| `LLM_BASE_URL` | LLM base (OpenAI-compatible) | `https://api.deepseek.com` |
| `LLM_API_KEY` | DeepSeek API key | — |
| `LLM_MODEL` | DeepSeek model | `deepseek-flash` |
| `PORT` | HTTP port | `3000` |

> Embeddings are generated **inside Atlas** (model `voyage-4`, set in the index definition), so there is no embedding API key in `.env`. The Voyage key in `.env` is used only for **reranking**.

## How it works

- `POST /api/ask` with `{ "question": "..." }` runs the three pipelines in parallel and returns all three results side-by-side, including retrieved context, scores, latency, and token usage.
- `GET /health` reports connectivity and which API keys are configured.

### Pipeline details

- **A — LLM only:** DeepSeek answers with no retrieval.
- **B — Vector Search:** `$vectorSearch` with the raw question text (Atlas auto-embeds it with Voyage 4), top 8 chunks, then DeepSeek answers.
- **C — Vector Search + Rerank:** `$vectorSearch` top 20 candidates → Voyage `rerank-3` → top 5 → DeepSeek answers.

## Project structure

```
server/        Express app, config, DB/LLM/Voyage clients, ask orchestrator
seed/          Fictional "Orbital" corpus + seed script (creates the index)
public/        Static frontend (HTML/CSS/JS, Leafygreen-styled, accessible)
DESIGN.md      Full design document
```

## Notes

- The frontend has no build step — it is plain HTML/CSS/JS served by Express.
- `.env` is git-ignored; credentials are never committed.

## Troubleshooting

**`Voyage rerank failed (403): This API key cannot access this endpoint...`**

The key and the endpoint belong to different families:

- **Atlas-created "Model API keys"** work with the MongoDB-hosted endpoint `https://ai.mongodb.com/v1` (and `eu.`/`us.` for geography-scoped keys).
- **Voyage-platform keys** work with `https://api.voyageai.com/v1`.

Set `VOYAGE_BASE_URL` to match the key you have. If you generated the key in the Atlas UI (*Search & Vector Search → Model API Keys*), use `https://ai.mongodb.com/v1` (or `eu.ai.mongodb.com` / `us.ai.mongodb.com` for a scoped key).

**Port `3000` in use (`EADDRINUSE`)**

Another instance is already running. Stop it (`Ctrl+C` in its terminal) or start on another port: `PORT=3100 npm start`.
