# AI Day Demo 2026 — MongoDB Atlas Vector Search in RAG

A web demo that shows, **for the same question**, how an LLM's answer improves as we add retrieval over an internal knowledge base:

| Pipeline | Retrieval | Rerank / Model |
|----------|-----------|----------------|
| A. **LLM only** | none | DeepSeek |
| B. **Vector Search** | Atlas Vector Search (top 8) | Voyage 4 (Atlas automated embedding) |
| C. **Vector Search + Rerank** | Atlas (top 20) → `$rerank` top 5 | Voyage 4 + Voyage rerank-3 |

The demo uses a fictional product, **"Orbital"**, with an internal knowledge base of facts the LLM cannot know (prices, release dates, certifications, hard limits), so the three pipelines produce visibly different answers.

See [DESIGN.md](DESIGN.md) for the full design.

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (M10+), **MongoDB 9.0+**
- A [DeepSeek](https://platform.deepseek.com/api_keys) API key

### Atlas prerequisites

- **Automated Embedding** (used by the vector index): enable **storage auto-scaling** on your M10+ cluster and configure a **Voyage AI model API key** in Atlas (*Search & Vector Search → Model API Keys*). Atlas then embeds the `text` field with `voyage-4` automatically.
- **Native Reranking** (used by pipeline C): in Atlas → *Project Settings* → **Native Reranking** → toggle **On**. Requires MongoDB 9.0+ and an M10+ cluster.

## Setup

```bash
cp .env.example .env
# edit .env and fill in MONGODB_URI and LLM_API_KEY

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
| `RERANK_MODEL` | Voyage rerank model used by `$rerank` | `rerank-3` |
| `RERANK_TOP_K` | Chunks kept after rerank | `5` |
| `LLM_BASE_URL` | LLM base (OpenAI-compatible) | `https://api.deepseek.com` |
| `LLM_API_KEY` | DeepSeek API key | — |
| `LLM_MODEL` | DeepSeek model | `deepseek-flash` |
| `PORT` | HTTP port | `3000` |

> Embedding **and** reranking both run inside Atlas: embeddings via the `autoEmbed` index, reranking via the native `$rerank` stage. There is no Voyage API key in `.env`.

## How it works

- `POST /api/ask` with `{ "question": "..." }` runs the three pipelines in parallel and returns all three results side-by-side, including retrieved context, scores, latency, and token usage.
- `GET /health` reports connectivity and the configured models.

### Pipeline details

- **A — LLM only:** DeepSeek answers with no retrieval.
- **B — Vector Search:** `$vectorSearch` with the raw question text (Atlas auto-embeds it with Voyage 4), top 8 chunks, then DeepSeek answers.
- **C — Vector Search + Rerank:** `$vectorSearch` top 20 candidates → native `$rerank` (Voyage `rerank-3`) → top 5 → DeepSeek answers.

## Project structure

```
server/        Express app, config, DB/LLM clients, ask orchestrator
seed/          Fictional "Orbital" corpus + seed script (creates the index)
public/        Static frontend (HTML/CSS/JS, Leafygreen-styled, accessible)
DESIGN.md      Full design document
STRUCTURE.md   File-by-file guide
```

See [STRUCTURE.md](STRUCTURE.md) for a file-by-file guide.

## Notes

- The frontend has no build step — it is plain HTML/CSS/JS served by Express.
- `.env` is git-ignored; credentials are never committed.

## Troubleshooting

**`$rerank is not enabled for ... Enable the $rerank Project Setting`**

Enable **Native Reranking** in Atlas → *Project Settings*. Requires MongoDB 9.0+ and an M10+ cluster.

**Port `3000` in use (`EADDRINUSE`)**

Another instance is already running. Stop it (`Ctrl+C` in its terminal) or start on another port: `PORT=3100 npm start`.
