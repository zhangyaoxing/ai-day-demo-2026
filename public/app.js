const input = document.getElementById("question");
const askBtn = document.getElementById("ask-btn");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const chips = document.querySelectorAll(".chip");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Minimal, safe markdown renderer for LLM answers (escapes everything first).
function renderMarkdown(md) {
  const lines = String(md ?? "").split("\n");
  const out = [];
  let listOpen = false;
  let para = [];
  let code = [];
  let inCode = false;

  const inline = (s) =>
    escapeHtml(s)
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.join("<br>")}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };

  for (const line of lines) {
    if (inCode) {
      if (/^```/.test(line)) {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^```/.test(line)) {
      inCode = true;
      flushPara();
      closeList();
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushPara();
      closeList();
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara();
      closeList();
      const level = h[1].length + 2;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    const li = line.match(/^\s*[-*+]\s+(.*)$/) || line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (li) {
      flushPara();
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }

    closeList();
    para.push(inline(line));
  }

  if (inCode) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushPara();
  closeList();
  return out.join("");
}

function renderContext(context) {
  if (!context || context.length === 0) {
    return `<p class="context-empty">No internal context used.</p>`;
  }
  const items = context
    .map((c) => {
      const score =
        c.relevanceScore != null
          ? `<span class="score score--rerank">rerank ${Number(c.relevanceScore).toFixed(3)}</span>`
          : c.score != null
            ? `<span class="score">cosine ${Number(c.score).toFixed(3)}</span>`
            : "";
      const vectorRank =
        c.vectorRank != null ? `<span class="score score--muted">vector #${c.vectorRank}</span>` : "";
      const section = c.section ? `<span class="ctx__section">${escapeHtml(c.section)}</span>` : "";
      return `
        <li class="ctx__item">
          <div class="ctx__head"><strong>${escapeHtml(c.title)}</strong>${section}${score}${vectorRank}</div>
          <p class="ctx__text">${escapeHtml(c.text)}</p>
        </li>`;
    })
    .join("");
  return `<ol class="ctx__list">${items}</ol>`;
}

function renderCard(r) {
  const isBest = r.mode === "vector-search-rerank";
  const usage =
    r.usage && r.usage.promptTokens != null
      ? `<span class="meta">${r.usage.promptTokens} in / ${r.usage.completionTokens} out tokens</span>`
      : "";
  const latency = r.latencyMs != null ? `<span class="meta">${r.latencyMs} ms</span>` : "";
  const ctxId = `ctx-${r.mode}`;
  const labelId = `label-${r.mode}`;
  const answerHtml = r.error
    ? `<p class="card__error"><strong>Pipeline error.</strong> ${escapeHtml(r.error)}</p>`
    : renderMarkdown(r.answer);
  const contexts = Array.isArray(r.context) ? r.context : [];
  return `
    <article class="card${isBest ? " card--best" : ""}" aria-labelledby="${labelId}">
      <div class="card__head">
        <span class="badge badge--${r.mode}" id="${labelId}">${escapeHtml(r.label)}</span>
        ${latency}
        ${usage}
      </div>
      <p class="card__desc">${escapeHtml(r.description)}</p>
      <div class="card__answer">${answerHtml}</div>
      <details class="ctx">
        <summary aria-controls="${ctxId}" aria-expanded="false">Retrieved context (${contexts.length})</summary>
        <div id="${ctxId}">${renderContext(contexts)}</div>
      </details>
    </article>`;
}

async function run(question) {
  setStatus("Running all three pipelines…");
  resultsEl.innerHTML = `<div class="skeleton-grid">${[0, 1, 2]
    .map(() => `<div class="skeleton"></div>`)
    .join("")}</div>`;
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    const data = await res.json();
    resultsEl.innerHTML = data.results.map(renderCard).join("");
    setStatus("");
  } catch (err) {
    resultsEl.innerHTML = "";
    setStatus(`Error: ${err.message}`);
  }
}

askBtn.addEventListener("click", () => {
  const q = input.value.trim();
  if (q) run(q);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = input.value.trim();
    if (q) run(q);
  }
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.textContent.trim();
    run(input.value);
  });
});

// Keep aria-expanded in sync with the native <details> open state.
document.addEventListener(
  "toggle",
  (e) => {
    if (e.target.tagName === "DETAILS") {
      const summary = e.target.querySelector("summary");
      if (summary) summary.setAttribute("aria-expanded", String(e.target.open));
    }
  },
  true
);
