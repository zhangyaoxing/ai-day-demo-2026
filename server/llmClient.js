import { config } from "./config.js";

/**
 * DeepSeek chat completion (OpenAI-compatible /chat/completions).
 */
export async function chat(messages) {
  if (!config.llm.apiKey) throw new Error("LLM_API_KEY is not set.");
  const url = `${config.llm.baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: config.llm.model,
      messages,
      temperature: config.llm.temperature,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM chat failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? {};

  return {
    content,
    usage: {
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
    },
  };
}
