// Web search + page content via Tavily (free plan: 1,000 credits/month).
// Basic search costs 1 credit; we request raw page content in the same call
// so we don't spend extra credits on a separate extract step.

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  raw: string; // trimmed page content used for drafting and quote checking
}

const KEYWORDS = [
  "oauth", "client id", "client_id", "client secret", "redirect", "callback", "scope", "consent",
  "review", "approval", "approve", "verification", "verify", "publish", "marketplace", "app store",
  "submit", "listing", "rate limit", "partner", "developer account", "install", "distribution",
  "security assessment", "privacy policy", "business verification", "sandbox", "test user", "token",
  "refresh", "expire", "admin", "weeks", "business days", "days",
];

/**
 * Keep the paragraphs most relevant to OAuth setup/approval, in original order,
 * within a character budget. Pages are often 50k+ chars of nav and boilerplate.
 */
export function focusText(text: string, budget: number): string {
  if (!text) return "";
  const paras = text
    .split(/\n{2,}|(?<=\.)\s{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40);
  if (paras.join("\n").length <= budget) return paras.join("\n");
  const scored = paras.map((p, i) => {
    const l = p.toLowerCase();
    let score = 0;
    for (const k of KEYWORDS) if (l.includes(k)) score += 1;
    return { i, p, score };
  });
  const picked = new Set<number>();
  let used = 0;
  for (const s of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (s.score === 0) break;
    if (used + s.p.length > budget) continue;
    picked.add(s.i);
    used += s.p.length + 1;
  }
  return scored.filter((s) => picked.has(s.i)).map((s) => s.p).join("\n");
}

export async function tavilySearch(
  query: string,
  opts: { includeDomains?: string[]; maxResults?: number; perPageChars?: number } = {},
): Promise<SearchHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: opts.maxResults ?? 5,
      include_raw_content: "text",
      include_domains: opts.includeDomains?.length ? opts.includeDomains : undefined,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    results?: { url: string; title: string; content: string; raw_content?: string | null }[];
  };
  return (data.results ?? []).map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.content ?? "",
    raw: focusText(r.raw_content || r.content || "", opts.perPageChars ?? 7000),
  }));
}
