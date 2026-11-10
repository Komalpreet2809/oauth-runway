// Storage for live-generated guides so every guide gets a stable, shareable URL.
// Production: Upstash Redis over its REST API (free plan; no SDK needed).
// Local dev without Redis: JSON files under data/generated/ (gitignored).

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Guide } from "./types";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const storeKind = REDIS_URL && REDIS_TOKEN ? "redis" : process.env.VERCEL ? "tmp" : "file";

async function redis<T = unknown>(...command: (string | number)[]): Promise<T> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const data = (await res.json()) as { result?: T; error?: string };
  if (data.error) throw new Error(`Redis: ${data.error}`);
  return data.result as T;
}

const dir = () => (storeKind === "tmp" ? "/tmp/generated" : path.join(process.cwd(), "data", "generated"));
// Lowercase first so /guides/GitHub finds "github" instead of stripping the capitals.
export const safe = (slug: string) => slug.toLowerCase().replace(/[^a-z0-9-]/g, "");

/** Stable key for any query wording, including non-Latin text ("飞书"). */
function aliasKey(query: string): string {
  return createHash("sha1").update(query.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 20);
}

/** Remember that a query (e.g. "Spotify") produced a guide under another slug ("spotify-api"). */
export async function saveAlias(query: string, slug: string): Promise<void> {
  const k = aliasKey(query);
  try {
    if (storeKind === "redis") {
      await redis("SET", `alias:${k}`, safe(slug));
      return;
    }
    await fs.mkdir(dir(), { recursive: true });
    const file = path.join(dir(), "_aliases.json");
    const map = JSON.parse(await fs.readFile(file, "utf8").catch(() => "{}")) as Record<string, string>;
    map[k] = safe(slug);
    await fs.writeFile(file, JSON.stringify(map, null, 2));
  } catch {
    /* an alias is an optimisation; never fail a run over it */
  }
}

export async function getAlias(query: string): Promise<string | null> {
  const k = aliasKey(query);
  try {
    if (storeKind === "redis") return await redis<string | null>("GET", `alias:${k}`);
    const map = JSON.parse(await fs.readFile(path.join(dir(), "_aliases.json"), "utf8")) as Record<string, string>;
    return map[k] ?? null;
  } catch {
    return null;
  }
}

export async function getGenerated(slug: string): Promise<Guide | null> {
  const s = safe(slug);
  if (!s) return null;
  try {
    if (storeKind === "redis") {
      const raw = await redis<string | null>("GET", `guide:${s}`);
      return raw ? (JSON.parse(raw) as Guide) : null;
    }
    return JSON.parse(await fs.readFile(path.join(dir(), `${s}.json`), "utf8")) as Guide;
  } catch {
    return null;
  }
}

export async function saveGenerated(guide: Guide): Promise<void> {
  const s = safe(guide.slug);
  const body = JSON.stringify(guide);
  if (storeKind === "redis") {
    await redis("SET", `guide:${s}`, body);
    await redis("ZADD", "guides:recent", Date.now(), s);
    return;
  }
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), `${s}.json`), JSON.stringify(guide, null, 2));
}

export async function listRecentGenerated(limit = 12): Promise<{ slug: string; name: string; difficulty: string; generatedAt: string }[]> {
  try {
    let slugs: string[] = [];
    if (storeKind === "redis") {
      slugs = await redis<string[]>("ZRANGE", "guides:recent", 0, limit - 1, "REV");
    } else {
      const files = await fs.readdir(dir()).catch(() => [] as string[]);
      const withTime = await Promise.all(
        files.filter((f) => f.endsWith(".json") && !f.startsWith("_")).map(async (f) => ({ f, t: (await fs.stat(path.join(dir(), f))).mtimeMs })),
      );
      slugs = withTime.sort((a, b) => b.t - a.t).slice(0, limit).map((x) => x.f.replace(/\.json$/, ""));
    }
    const guides = await Promise.all(slugs.map(getGenerated));
    return guides
      .filter((g): g is Guide => !!g)
      .map((g) => ({ slug: g.slug, name: g.app.name, difficulty: g.summary.difficulty, generatedAt: g.meta.generatedAt }));
  } catch {
    return [];
  }
}

// --- Abuse protection for free-tier quotas -------------------------------
const memoryCounters = new Map<string, { n: number; resetAt: number }>();

/** Returns true if allowed. Fixed-window counter per key. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  if (storeKind === "redis") {
    try {
      const k = `rl:${key}`;
      const n = await redis<number>("INCR", k);
      if (n === 1) await redis("EXPIRE", k, windowSec);
      return n <= max;
    } catch {
      return true; // fail open: a Redis hiccup shouldn't block a demo
    }
  }
  const now = Date.now();
  const c = memoryCounters.get(key);
  if (!c || c.resetAt < now) {
    memoryCounters.set(key, { n: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  c.n++;
  return c.n <= max;
}
