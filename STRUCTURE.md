# Project Structure

A file-by-file guide to **AI Day 2026 — MongoDB Atlas Vector Search in RAG**.
For the architecture and design rationale, see [DESIGN.md](DESIGN.md); for setup and usage, see [README.md](README.md).

---

## Overview

The project has three concerns:

1. **Data setup** (`seed/`) — one-time: insert the corpus and create the vector index.
2. **Backend** (`server/`) — an Express API that runs the three RAG pipelines.
3. **Frontend** (`public/`) — a static page that renders the three answers side-by-side.

Embeddings and reranking run **inside MongoDB Atlas** (`autoEmbed` index + native `$rerank`). The only external model call is the DeepSeek chat completion.

---

## Directory tree

```
ai-day-demo-2026/
├── server/                    # Express backend (runtime)
│   ├── index.js               # App entry: static hosting, /health, /api/ask
│   ├── config.js              # Loads .env, exports a typed config object
│   ├── db.js                  # MongoDB client + $vectorSearch / $rerank helpers
│   ├── askService.js          # Orchestrates the three RAG pipelines
│   └── llmClient.js           # DeepSeek (OpenAI-compatible) chat client
├── seed/                      # One-time data setup
│   ├── corpus.js              # Fictional "Orbital" knowledge base (10 docs / 24 chunks)
│   └── seed.js                # Inserts chunks + creates the autoEmbed vector index
├── public/                    # Frontend (no build step)
│   ├── index.html             # Page shell
│   ├── styles.css             # Leafygreen-inspired styles
│   └── app.js                 # Fetch + render the three result cards
├── .vscode/
│   └── launch.json            # VS Code debug configurations
├── .env.example               # Environment variable template (placeholders)
├── .env                       # Local secrets (git-ignored)
├── .gitignore
├── package.json               # Dependencies + npm scripts
├── package-lock.json          # Locked dependency versions
├── DESIGN.md                  # Design document
├── README.md                  # Setup / usage / troubleshooting
├── STRUCTURE.md               # This file
└── LICENSE                    # MIT
```

---

## `server/` — Express backend

### `server/index.js`
The application entry point and HTTP layer.

- Serves `public/` as static files (`express.static`).
- `GET /health` — reports MongoDB connectivity, whether the LLM key is set, and the configured models.
- `POST /api/ask` — validates `question`, connects to MongoDB, calls `askService.ask()`, returns JSON.
- Starts the server with `app.listen(config.port)`.

It contains **no pipeline logic** — that lives in `askService.js`.

### `server/config.js`
Loads `.env` (via `dotenv`) and exports a single `config` object with typed defaults:

```js
config = {
  mongo:  { uri, db, collection, indexName },
  rerank: { model, topK },
  llm:    { baseUrl, apiKey, model, temperature },
  port,
}
```

Every other module imports `config` instead of reading `process.env` directly, so defaults and parsing live in one place.

### `server/db.js`
Owns the MongoDB connection and all database queries.

- `connect()` — creates a **singleton** `MongoClient` (15 s server-selection timeout) and returns the collection.
- `getCollection()` — returns the connected collection (throws if not connected).
- `ping()` — `db.command({ ping: 1 })`, used by `/health`.
- `close()` — closes the client (used by the seed script).
- `vectorSearch(query, { numCandidates, limit })` — plain vector retrieval; returns chunks with a `score` (`$meta: "vectorSearchScore"`). Used by pipeline **B**.
- `vectorSearchWithRerank(query, { numCandidates, limit, rerankLimit, model })` — one aggregation that:
  1. `$vectorSearch` (top 20),
  2. `$project` (keeps `text` + `vectorScore`),
  3. `$setWindowFields` (preserves the original `vectorRank` for the UI),
  4. `$rerank` (Voyage reranker, `numDocsToRerank: 20`),
  5. `$addFields` (`rerankScore` from `$meta: "score"`),
  6. `$limit` (top `rerankLimit`).
  Used by pipeline **C**.

Note: the app sends **raw query text**; Atlas embeds it automatically because the index uses `autoEmbed`.

### `server/askService.js`
The core orchestrator. It defines the three pipelines and runs them in parallel.

- `NO_RAG_SYSTEM` / `RAG_SYSTEM` — system prompts (the RAG one requires citing sources and refusing to guess).
- `buildRagSystem(contexts)` — formats retrieved chunks into a numbered context block.
- `toContext(hit)` — trims a DB hit to `{ title, section, text }`.
- `pipelineNoRag(question)` — **A**: calls the LLM with no retrieval.
- `pipelineVectorSearch(question)` — **B**: `vectorSearch` (top 8) → LLM.
- `pipelineRerank(question)` — **C**: `vectorSearchWithRerank` → LLM; context carries `relevanceScore` and `vectorRank`.
- `safeRun(fn, meta)` — runs one pipeline in isolation; on failure it returns an error object for that card only.
- `ask(question)` — `Promise.all` over the three pipelines; returns `{ question, results: [A, B, C] }`.

### `server/llmClient.js`
A minimal **OpenAI-compatible** chat client.

- `chat(messages)` → `POST {baseUrl}/chat/completions` with `{ model, messages, temperature, stream: false }`.
- Parses `choices[0].message.content` and normalizes `usage` (`promptTokens`, `completionTokens`, `totalTokens`).
- Provider-agnostic: swapping `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` switches to any OpenAI-compatible endpoint.

---

## `seed/` — one-time data setup

### `seed/corpus.js`
The fictional **Orbital** knowledge base: 10 documents, 24 chunks. Each document is `{ docId, source, title, chunks: [{ section, text }] }`. Two documents (`company-history`, `industry-blog`) are deliberately generic **distractors** used to demonstrate reranking. There are no vectors here — Atlas generates them.

### `seed/seed.js`
Executed by `npm run seed`:

1. Flattens the corpus into 24 documents and writes them to `rag_demo.knowledge_base` (`deleteMany` + `insertMany`).
2. Creates the `vectorSearch` index with an **`autoEmbed`** field (`path: "text"`, `model: "voyage-4"`, 1024 dims, `cosine`); drops and recreates it if it already exists.
3. Polls `listSearchIndexes()` until the index is `queryable` (or `READY`).

It is **not part of the running server** — run it once before the demo.

---

## `public/` — frontend

### `public/index.html`
The page shell: dark header, question input + **Ask** button, four sample-question chips, a results container, and a footer. Includes `aria-label`, `role`, and `aria-live` attributes.

### `public/styles.css`
Leafygreen-inspired styling using CSS custom properties (green/ink/gray palette), a responsive 3-column card grid (stacking on narrow screens), score badges, collapsible context, a loading skeleton, and `prefers-reduced-motion` support.

### `public/app.js`
Client-side behavior, no framework or build step:

- `escapeHtml()` / `renderMarkdown()` — a small, **XSS-safe** Markdown renderer (bold, inline code, code blocks, headings, lists).
- `renderContext()` — renders retrieved chunks with `cosine` / `rerank` score badges, plus `vector #N` when present.
- `renderCard()` — renders one pipeline result (label, latency, token usage, answer, collapsible context); shows an error box if that pipeline failed.
- `run()` — `POST /api/ask`, shows a skeleton while loading, then renders the three cards.
- Event wiring for the Ask button, Enter key, and chips; keeps `aria-expanded` in sync with `<details>`.

---

## Root files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies (`express`, `mongodb`, `dotenv`) and scripts: `start`, `dev`, `seed`, `debug`. |
| `package-lock.json` | Pins exact dependency versions. |
| `.env.example` | Template for all environment variables (placeholders only). |
| `.env` | Real credentials (MongoDB URI, DeepSeek key). Git-ignored. |
| `.gitignore` | Ignores `node_modules/`, `.npm-cache/`, `.env`, logs, `.DS_Store`. |
| `.vscode/launch.json` | Three debug configs: `Debug Server`, `Debug Seed`, `Attach to Server`. |
| `DESIGN.md` | Design document: scenario, architecture, data model, pipelines, decisions. |
| `README.md` | Setup, configuration, pipelines, troubleshooting. |
| `STRUCTURE.md` | This file. |
| `LICENSE` | MIT. |

---

## Request flow

```
Browser
  └─ public/app.js        POST /api/ask { question }
       └─ server/index.js  route handler
            ├─ server/db.js            connect()
            └─ server/askService.js    ask()
                 ├─ pipelineNoRag        ──────────────► llmClient → DeepSeek
                 ├─ pipelineVectorSearch ──► db.vectorSearch (top 8)  → llmClient
                 └─ pipelineRerank       ──► db.vectorSearchWithRerank (top 20 → $rerank → top 5) → llmClient
       ◄─ JSON { results: [A, B, C] }
  └─ public/app.js        renderCard() × 3
```

---

## Configuration

All runtime configuration is environment-based (see `.env.example`):

| Variable | Used by | Default |
|----------|---------|---------|
| `MONGODB_URI` | `db.js` | — |
| `MONGODB_DB` | `db.js` | `rag_demo` |
| `MONGODB_COLLECTION` | `db.js` | `knowledge_base` |
| `VECTOR_INDEX_NAME` | `db.js`, `seed.js` | `vector_index` |
| `RERANK_MODEL` | `db.js`, `askService.js` | `rerank-3` |
| `RERANK_TOP_K` | `askService.js` | `5` |
| `LLM_BASE_URL` | `llmClient.js` | `https://api.deepseek.com` |
| `LLM_API_KEY` | `llmClient.js` | — |
| `LLM_MODEL` | `llmClient.js` | `deepseek-flash` |
| `LLM_TEMPERATURE` | `llmClient.js` | `0.2` |
| `PORT` | `index.js` | `3000` |

---

## Design notes

- **ESM throughout** (`"type": "module"`); requires Node.js 18+ (for global `fetch`).
- **No frontend build step** — HTML/CSS/JS are served directly by Express.
- **Atlas does the retrieval work**: `autoEmbed` for embeddings, native `$rerank` for reranking. The app has no embedding or rerank API client.
- **Single external dependency for models**: DeepSeek, via an OpenAI-compatible `/chat/completions` call.
