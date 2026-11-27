# AI Day Demo 2026 — MongoDB Atlas Vector Search in RAG

**Status:** Design approved — implementation in progress
**Repo:** `git@github.com:zhangyaoxing/ai-day-demo-2026.git`
**Stack:** Node.js + Express · MongoDB Atlas Vector Search (Automated Embedding, Voyage 4) · Atlas Native Reranking (`$rerank`) · DeepSeek LLM

---

## 1. Objective

Build a web demo that shows, **for the same user question**, how an LLM's answer improves as we progressively add retrieval on top of an internal knowledge base:

| # | Pipeline | Retrieval | Expected result |
|---|----------|-----------|-----------------|
| A | **LLM only (no internal data)** | None | Generic, hedged, or fabricated answer about the product |
| B | **Vector Search (Voyage 4 automated embedding)** | Top-k chunks from Atlas | Grounded answer using the retrieved chunks |
| C | **Vector Search + Native Reranking (`$rerank`)** | Top chunks re-ordered by reranker | Most relevant chunk ranked #1; tighter answer |

The demo targets a technical audience (an "AI Day" session), so the UI makes the *retrieved context*, *scores/ordering*, and *latency* visible, not just the final text. **The entire UI is in English.**

---

## 2. Demo scenario

We need a domain where the LLM has **no prior knowledge** but the "internal knowledge base" has **specific, checkable facts** (prices, dates, version numbers, certificates, hard limits) — so the three pipelines produce visibly different answers.

### 2.1 Fictional product

**"Orbital"** — a fictional data-observability SaaS platform.

### 2.2 Knowledge base corpus (seed data)

Each entry is a small, self-contained text chunk (≈150–300 tokens). Atlas generates embeddings **automatically** for the `text` field (see §4), so the corpus is plain text only — no vectors in the seed.

| ID | Document | Key facts the demo relies on |
|----|----------|------------------------------|
| `overview` | What Orbital is | Core capabilities, positioning |
| `pricing` | Plans & pricing | Free $0; **Pro $299/mo** (10M events/mo, 90-day retention, SSO add-on $99/mo); **Enterprise custom** (unlimited, custom retention, SOC 2 report, dedicated CSM) |
| `release-notes` | Version history | **v3.4.2 (2025-11-12)** fixed a >10s dashboard-load bug; v3.4.0 added "Anomaly Watch"; v3.3.0 added Slack alerts |
| `security` | Security & compliance | **SOC 2 Type II** (audited 2025-08), ISO 27001, GDPR, AES-256 at rest, TLS 1.3, AWS `us-east-1` / `eu-west-1`, DPA |
| `limits` | Known limitations | **Max ingestion 100,000 events/sec**, Free tier 30-day lookback, no cross-region failover on Free |
| `support` | Support & SLA | Community (Free) / Standard (Pro) / Premium (Enterprise); Premium 24/7, 15-min response |
| `integrations` | Integrations | Snowflake, BigQuery, Datadog, PagerDuty, Slack, CloudWatch, dbt, Airflow |
| `faq` | FAQ | Trial, event-volume definition, plan changes |

**Distractor documents** (semantically adjacent but not the answer — these demonstrate why reranking matters):

| ID | Document | Why it's a distractor |
|----|----------|-----------------------|
| `company-history` | Founding story & funding | Mentions "platform", "data", "product" |
| `industry-blog` | Generic article on observability trends | Talks about "pricing models" and "data pipelines" in general |

### 2.3 Curated demo questions (pre-filled; users can type their own)

1. **"What are Orbital's pricing tiers and what does each include?"** — the clearest rerank showcase: Vector Search ranks "Support tiers" #1, rerank promotes "Plan overview" to #1, and the answer becomes per-tier specific.
2. **"What does Orbital's Pro plan cost and what does it include?"**
3. **"When was the latest Orbital release, and what did it fix?"**
4. **"Is Orbital SOC 2 Type II certified, and what else does its compliance cover?"**
5. **"What is the maximum ingestion rate Orbital supports?"**

---

## 3. Architecture

```mermaid
flowchart LR
    subgraph Client
        UI[Web UI<br/>Leafygreen-styled, English]
    end

    subgraph Server [Node.js + Express]
        API[/api/ask]
        SVC[ask service]
        LLM[DeepSeek client]
    end

    subgraph Cloud
        MDB[(MongoDB Atlas<br/>knowledge_base<br/>+ autoEmbed index<br/>+ native $rerank)]
        DEEPSEEK[DeepSeek API]
    end

    UI -->|POST question| API
    API --> SVC
    SVC --> LLM --> DEEPSEEK
    SVC -->|$vectorSearch / $vectorSearch + $rerank| MDB
```

- **No build step** on the frontend: Express serves a static `public/` directory (HTML/CSS/JS) plus one JSON endpoint.
- The three pipelines run **server-side** and return together, so the UI renders them side-by-side.
- **Embeddings and reranking run inside Atlas** (automated embedding + native `$rerank`). The app never calls a Voyage API.

---

## 4. Data model & vector index

**Database:** `rag_demo` · **Collection:** `knowledge_base` (both configurable)

```js
{
  _id: ObjectId,
  docId: "pricing",              // logical document id
  source: "pricing",             // human-readable source name
  title: "Orbital Pricing",
  section: "Pro plan",           // optional heading the chunk came from
  chunkIndex: 2,                 // position within the document
  text: "The Pro plan costs $299/month ..."   // indexed by autoEmbed
}
```

> No `embedding` field is stored by the app. Atlas persists generated embeddings in a reserved internal database.

### Vector search index (Atlas Automated Embedding)

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "autoEmbed",
        "modality": "text",
        "path": "text",
        "model": "voyage-4",
        "numDimensions": 1024,
        "similarity": "cosine"
      }
    ]
  }
}
```

- The seed script creates this index via the driver's `createSearchIndex()` and polls until it is `queryable`.
- **Atlas prerequisites:** MongoDB 9.0+, storage **auto-scaling enabled** (required on M10+), a **Voyage AI model API key configured in Atlas** (for automated embedding), and **Native Reranking enabled** (Project Settings, for pipeline C). These are documented in the README.

---

## 5. The three pipelines

### 5.1 Pipeline A — LLM only (DeepSeek)

1. Send only a system prompt + the question to DeepSeek.
2. No database access, no embeddings.

```text
System: "You are a helpful assistant. Answer the question directly. If you are
         not certain about product-specific facts (prices, dates, version
         numbers, certifications), say so honestly instead of guessing."
```

### 5.2 Pipeline B — Vector Search (Voyage 4 automated embedding)

1. Run `$vectorSearch` with the **raw question text** — Atlas embeds it with `voyage-4` at query time.
2. Retrieve top 8 chunks, feed them as context into DeepSeek.

```js
collection.aggregate([
  { $vectorSearch: {
      index: "vector_index",
      path: "text",
      query: question,          // text; Atlas auto-embeds with voyage-4
      numCandidates: 100,
      limit: 8
  }},
  { $project: { _id: 1, docId: 1, title: 1, section: 1, text: 1,
                score: { $meta: "vectorSearchScore" } } }
])
```

### 5.3 Pipeline C — Vector Search + Native Reranking (`$rerank`)

1. `$vectorSearch` with a **larger candidate pool** → top 20 (`numCandidates: 200`, `limit: 20`).
2. Reorder the candidates in-pipeline with Atlas' native `$rerank` (Voyage `rerank-3`).
3. Keep the top 5 re-ordered chunks and feed them into DeepSeek.

```js
collection.aggregate([
  { $vectorSearch: {
      index: "vector_index",
      path: "text",
      query: question,
      numCandidates: 200,
      limit: 20
  }},
  { $project: { _id: 0, docId: 1, title: 1, section: 1, text: 1,
                vectorScore: { $meta: "vectorSearchScore" } } },
  { $setWindowFields: { sortBy: { vectorScore: -1 },
                        output: { vectorRank: { $documentNumber: {} } } } },
  { $rerank: { model: "rerank-3", query: { text: question },
               path: "text", numDocsToRerank: 20 } },
  { $addFields: { rerankScore: { $meta: "score" } } },
  { $limit: 5 }
])
```

**Why C beats B:** B orders chunks by vector similarity alone, so a semantically-adjacent distractor (e.g., the `industry-blog` chunk about "pricing models") can crowd out the exact `pricing` chunk. Rerank is a cross-encoder that jointly compares query↔document, so it reliably pushes the *precise* chunk to #1.

---

## 6. Model & API configuration

### 6.1 LLM — DeepSeek (OpenAI-compatible)

| Setting | Value |
|---------|-------|
| `LLM_BASE_URL` | `https://api.deepseek.com` |
| `LLM_MODEL` | `deepseek-flash` (alternative: `deepseek-v4-pro`) |
| `LLM_API_KEY` | user-provided |

Endpoint: `POST {LLM_BASE_URL}/chat/completions` with `Authorization: Bearer <key>`. `temperature: 0.2`.

### 6.2 Embeddings — Voyage 4 via Atlas Automated Embedding

- Model `voyage-4` (1024-dim) is set **in the index definition**, not in the app.
- Billing and the API key are managed **in Atlas** (Model API Keys).

### 6.3 Rerank — Atlas Native Reranking (`$rerank`)

| Setting | Value |
|---------|-------|
| `RERANK_MODEL` | `rerank-3` (alternatives: `rerank-3-lite`, `rerank-2.5`) |
| `RERANK_TOP_K` | `5` |

- Rerank runs **inside the aggregation** as the `$rerank` stage; the app makes no separate Voyage HTTP call.
- Requires MongoDB 9.0+, M10+, and **Native Reranking enabled** in Atlas Project Settings. Billing is handled by Atlas.

---

## 7. Backend API

### `POST /api/ask`

Request: `{ "question": "What does Orbital's Pro plan cost?" }`

Response (all three pipelines):

```json
{
  "question": "...",
  "results": [
    {
      "mode": "no-rag",
      "label": "LLM only",
      "answer": "...",
      "context": [],
      "latencyMs": 820,
      "usage": { "promptTokens": 34, "completionTokens": 61 }
    },
    {
      "mode": "vector-search",
      "label": "Vector Search (Voyage 4)",
      "answer": "...",
      "context": [ { "title": "Orbital Pricing", "section": "Pro plan", "text": "...", "score": 0.86 } ],
      "latencyMs": 1120,
      "usage": { "promptTokens": 1120, "completionTokens": 70 }
    },
    {
      "mode": "vector-search-rerank",
      "label": "Vector Search + Rerank (Voyage 4 + $rerank)",
      "answer": "...",
      "context": [ { "title": "Orbital Pricing", "section": "Pro plan", "text": "...", "relevanceScore": 0.94 } ],
      "latencyMs": 1280,
      "usage": { "promptTokens": 640, "completionTokens": 68 }
    }
  ]
}
```

### `GET /health`

Returns connectivity status (MongoDB reachable; DeepSeek key present; rerank model) for pre-flight checks.

---

## 8. Frontend design

Single static page (`public/index.html` + `styles.css` + `app.js`), styled to match MongoDB's design system (built on **Leafygreen UI**). English only.

### 8.1 Layout

1. **Header** — project title + MongoDB / Voyage AI branding.
2. **Question input** — a large search-input-style field with the four sample questions as clickable chips.
3. **Results area** — three cards side-by-side (one per pipeline), each showing:
   - Mode label (badge) + latency + token usage.
   - The LLM answer.
   - A collapsible **"Retrieved context"** section listing chunks with score/relevance badges.
4. **Footer** — repo link.

### 8.2 Visual tokens (Leafygreen-inspired)

| Token | Value | Use |
|-------|-------|-----|
| `--green-base` | `#00A35C` | Primary buttons, active accents |
| `--green-dark3` | `#023430` | Headings |
| `--ink` | `#001E2B` | Dark surfaces |
| `--brand-green` | `#00ED64` | Accent flourishes |
| `--gray-light1` | `#F9FBFA` | Page background |
| `--gray-light2` | `#E8EDEB` | Card borders |
| `--gray-base` | `#889397` | Secondary text |
| `--gray-dark3` | `#21313C` | Body text (4.5:1 on white) |
| `--white` | `#FFFFFF` | Card background |

Typography: `"Euclid Circular A", "Helvetica Neue", Arial, sans-serif` fallback stack.

### 8.3 Accessibility (maps to the referenced foundation page)

1. **Contrast** — body `#21313C` on `#FFFFFF`/`#F9FBFA` ≥ 4.5:1; headings `#023430` on white ≥ 4.5:1; interactive controls ≥ 3:1.
2. **Do not rely on color alone** — mode cards use label + icon, not just color; score badges pair a number with a text tier.
3. **Keyboard navigation** — all controls `Tab`-reachable; predictable order.
4. **ARIA** — visible label on the field; cards use `aria-labelledby`; context toggles use `aria-expanded`/`aria-controls`.
5. **Focus states** — visible 3:1 focus ring on every focusable element.
6. **Reduced motion** — `prefers-reduced-motion` disables animation.

---

## 9. Project structure

```
ai-day-demo-2026/
├── DESIGN.md
├── README.md
├── .env.example              # template, credentials blank
├── .env                      # local, git-ignored
├── .gitignore
├── package.json
├── server/
│   ├── index.js              # Express app entry
│   ├── config.js             # env loading + validation
│   ├── db.js                 # Mongo client + $vectorSearch / $rerank helpers
│   ├── llmClient.js          # DeepSeek (OpenAI-compatible) chat
│   └── askService.js         # orchestrates the three pipelines
├── seed/
│   ├── corpus.js             # the fictional Orbital knowledge base
│   └── seed.js               # insert → create autoEmbed index → poll ready
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

See [STRUCTURE.md](STRUCTURE.md) for a file-by-file guide.

Dependencies: `express`, `mongodb`, `dotenv`. Everything else uses the built-in `fetch` (Node 18+).

---

## 10. Configuration (`.env`)

```dotenv
# --- MongoDB Atlas ---
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.wy1z6.mongodb.net/?retryWrites=true&w=majority&appName=ai-day-demo
MONGODB_DB=rag_demo
MONGODB_COLLECTION=knowledge_base

# --- Rerank: Atlas Native Reranking ($rerank) ---
RERANK_MODEL=rerank-3
RERANK_TOP_K=5

# --- LLM: DeepSeek (OpenAI-compatible) ---
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=
LLM_MODEL=deepseek-flash

# --- Server ---
PORT=3000
```

`.env.example` contains **placeholders only**; `.env` (with real credentials) is git-ignored and never committed.

---

## 11. Setup & demo flow (in README)

1. In Atlas, configure a **Voyage AI model API key** (for automated embedding), enable storage auto-scaling (M10+), and enable **Native Reranking** (Project Settings).
2. `cp .env.example .env`, fill in credentials.
3. `npm install`
4. `npm run seed` — inserts the corpus and creates the `autoEmbed` vector index, then polls until ready.
5. `npm start` → open `http://localhost:3000`.
6. Click a sample question; compare the three cards and expand "Retrieved context".

---

## 12. Decision log (resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | LLM provider | **DeepSeek** (`deepseek-flash`), OpenAI-compatible, key in `.env` |
| 2 | Voyage models | **`voyage-4`** (embed, via Atlas autoEmbed) + **`rerank-3`** (rerank, via native `$rerank`) |
| 3 | UI language | **English** |
| 4 | Embedding approach | **Atlas Automated Embedding** (`autoEmbed` index); no external embedding in the app |

---

## 13. Out of scope

- Authentication / multi-tenancy.
- Hybrid search (BM25 + vector) — stretch goal.
- Streaming responses (SSE) — single JSON for simplicity.
- Automated test suite beyond a smoke check.
