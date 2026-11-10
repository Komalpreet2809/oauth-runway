// Minimal OpenAI-compatible chat client with provider fallback, tried in order:
//   1. Gemini (free tier; large context)
//   2. Mistral (only if the account has API access; its free plan no longer
//      activates keys for new accounts, as we found on 2026-11-05)
//   3. Groq (free plan, fast, but only ~8k tokens/minute, so callers shrink the
//      prompt via `maxInputChars`)
// Providers without a key are skipped.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  model: string;
  /** Rough cap on prompt size this provider's free tier will accept in one call. */
  maxInputChars: number;
}

export function providers(): Provider[] {
  const list: Provider[] = [
    {
      // Google Gemini free tier via its OpenAI-compatible endpoint (no card needed).
      name: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
      maxInputChars: 120_000,
    },
    {
      // Free-tier quotas are per model, so a second Gemini model doubles daily
      // capacity and covers "high demand" (503) spikes on the first one.
      name: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite",
      maxInputChars: 120_000,
    },
    {
      name: "mistral",
      url: "https://api.mistral.ai/v1/chat/completions",
      key: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL || "mistral-medium-latest",
      maxInputChars: 120_000,
    },
    {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      maxInputChars: 14_000,
    },
  ];
  return list.filter((p) => p.key);
}

export class LlmError extends Error {}

async function callOnce(p: Provider, messages: ChatMessage[], maxTokens: number, timeoutMs: number) {
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
    body: JSON.stringify({
      model: p.model,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new LlmError(`${p.name} ${res.status}: ${text.slice(0, 300)}`);
    (err as LlmError & { status?: number; retryAfter?: number }).status = res.status;
    (err as LlmError & { retryAfter?: number }).retryAfter = Number(res.headers.get("retry-after")) || undefined;
    // A request quota of 0 means the account has no API access right now; retrying won't help.
    (err as LlmError & { noQuota?: boolean }).noQuota = res.headers.get("x-ratelimit-limit-req-minute") === "0";
    throw err;
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new LlmError(`${p.name}: empty response`);
  return content;
}

/** Parse a JSON object out of a model reply, tolerating code fences and stray prose. */
export function parseJsonObject<T = unknown>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new LlmError("Model did not return valid JSON");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask for a JSON object. `build(provider)` lets the caller size the prompt for
 * each provider. Tries each provider in order; on 429 waits briefly and retries once.
 */
export async function chatJson<T>(
  build: (p: Provider) => ChatMessage[],
  opts: {
    maxTokens?: number;
    timeoutMs?: number;
    /** Absolute time (ms since epoch) after which no new attempt starts. */
    deadline?: number;
    onFallback?: (from: string, reason: string) => void;
  } = {},
): Promise<{ data: T; provider: Provider }> {
  const list = providers();
  if (!list.length) throw new LlmError("No LLM API key configured (set GEMINI_API_KEY and/or GROQ_API_KEY).");
  let lastErr: unknown;
  for (const p of list) {
    // Gemini's free tier often answers "503 high demand" for a few seconds at a time;
    // waiting it out beats dropping to Groq, whose tiny budget gives thin guides.
    const maxAttempts = p.name === "gemini" ? 3 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Never start an attempt that can't finish before the platform kills us.
      const remaining = (opts.deadline ?? Infinity) - Date.now();
      if (remaining < 15_000) {
        throw new LlmError("The AI models were too slow to respond in time. Please try again in a minute.");
      }
      try {
        const text = await callOnce(p, build(p), opts.maxTokens ?? 6000, Math.min(opts.timeoutMs ?? 120_000, remaining - 3_000));
        return { data: parseJsonObject<T>(text), provider: p };
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number }).status;
        const retryAfter = (e as { retryAfter?: number }).retryAfter;
        if ((e as { noQuota?: boolean }).noQuota) break;
        const retryable = status === 429 || status === 503 || e instanceof SyntaxError || (e instanceof LlmError && /valid JSON/.test(e.message));
        if (retryable && attempt < maxAttempts - 1) {
          // Back off harder on "busy" (503) than on a malformed reply.
          const waitMs = status === 503 ? 4000 * (attempt + 1) : (retryAfter ?? 2) * 1000;
          await sleep(Math.min(waitMs, 8000));
          continue;
        }
        break;
      }
    }
    opts.onFallback?.(p.name, lastErr instanceof Error ? lastErr.message : String(lastErr));
  }
  throw lastErr instanceof Error ? lastErr : new LlmError(String(lastErr));
}
