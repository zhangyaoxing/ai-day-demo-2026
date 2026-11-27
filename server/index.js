import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { connect, ping } from "./db.js";
import { ask } from "./askService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", async (req, res) => {
  let mongoConnected = false;
  try {
    await ping();
    mongoConnected = true;
  } catch {
    mongoConnected = false;
  }
  res.json({
    status: "ok",
    mongoConnected,
    llmConfigured: Boolean(config.llm.apiKey),
    models: {
      llm: config.llm.model,
      rerank: `${config.rerank.model} ($rerank)`,
      embed: "voyage-4 (Atlas autoEmbed)",
    },
  });
});

app.post("/api/ask", async (req, res) => {
  const question = (req.body?.question ?? "").trim();
  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }
  try {
    await connect();
    const result = await ask(question);
    res.json(result);
  } catch (err) {
    console.error("[api/ask]", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`AI Day demo listening on http://localhost:${config.port}`);
});
