// Deterministic evidence check for live-generated guides.
// The model must cite a numbered source and quote it verbatim. We then check,
// in code, that the quote really appears in the text we fetched. Anything that
// fails is downgraded to "uncertain" — the model never gets the last word on
// its own evidence.

import type { Evidence, Guide } from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    // Models often add or restyle quotation marks; ignore them entirely.
    .replace(/[‘’“”'"`]/g, "")
    .replace(/[^a-z0-9%$ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True if the quote (or ≥85% of its word 4-grams) occurs in the source text. */
export function quoteFound(quote: string, sourceText: string): boolean {
  const q = norm(quote);
  const t = norm(sourceText);
  if (!q || q.length < 12) return false;
  if (t.includes(q)) return true;
  const words = q.split(" ");
  if (words.length < 6) return false;
  const grams: string[] = [];
  for (let i = 0; i + 4 <= words.length; i++) grams.push(words.slice(i, i + 4).join(" "));
  const hit = grams.filter((g) => t.includes(g)).length;
  return hit / grams.length >= 0.85;
}

export interface VerifyStats {
  checked: number;
  matched: number;
  downgraded: number;
  unsupported: number;
}

/** Probe citations are rendered as in-page anchors to the probe log. */
export const isProbeRef = (url: string) => url.startsWith("#probe-");

/**
 * Walk every evidence object in the guide. `texts` maps source URL → the text
 * the agent actually read. "tested" is only kept when the evidence cites one of
 * the live probes (a `#probe-N` reference).
 */
export function verifyGuide(guide: Guide, texts: Map<string, string>): VerifyStats {
  const stats: VerifyStats = { checked: 0, matched: 0, downgraded: 0, unsupported: 0 };

  const fix = (ev: Evidence | undefined): Evidence => {
    const e: Evidence = ev && typeof ev === "object" ? { ...ev } : { level: "uncertain" };
    if (!["tested", "sourced", "uncertain"].includes(e.level)) e.level = "uncertain";
    e.sources = (e.sources ?? []).filter((s) => s && typeof s.url === "string");

    if (e.level === "tested") {
      if (e.sources.some((s) => isProbeRef(s.url))) return e;
      e.level = e.sources.length ? "sourced" : "uncertain";
      e.note = [e.note, "Marked 'tested' by the model but no live probe backs it."].filter(Boolean).join(" ");
      stats.downgraded++;
    }
    if (e.level !== "sourced") return e;

    if (!e.sources.length) {
      e.level = "uncertain";
      e.note = [e.note, "No source was cited."].filter(Boolean).join(" ");
      stats.unsupported++;
      return e;
    }
    let anyMatch = false;
    for (const s of e.sources) {
      if (!s.quote) continue;
      stats.checked++;
      const text = texts.get(s.url);
      if (text && quoteFound(s.quote, text)) {
        anyMatch = true;
        stats.matched++;
      }
    }
    if (!anyMatch) {
      e.level = "uncertain";
      e.note = [e.note, "The cited quote could not be found on the source page, so treat this as unverified."]
        .filter(Boolean)
        .join(" ");
      stats.downgraded++;
    }
    return e;
  };

  guide.summary.evidence = fix(guide.summary.evidence);
  for (const s of guide.stages) s.evidence = fix(s.evidence);
  for (const r of guide.requirements) r.evidence = fix(r.evidence);
  for (const l of guide.limitsBeforeApproval) l.evidence = fix(l.evidence);
  for (const b of guide.blockers) b.evidence = fix(b.evidence);
  for (const n of guide.nuances) n.evidence = fix(n.evidence);
  return stats;
}
