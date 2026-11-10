import type { Evidence, Guide } from "./types";

/** Every evidence object in a guide, for counts and summaries. */
export function allEvidence(g: Guide): Evidence[] {
  return [
    g.summary.evidence,
    ...g.stages.map((s) => s.evidence),
    ...g.requirements.map((r) => r.evidence),
    ...g.limitsBeforeApproval.map((l) => l.evidence),
    ...g.blockers.map((b) => b.evidence),
    ...g.nuances.map((n) => n.evidence),
  ].filter((e): e is Evidence => !!e);
}

export function evidenceCounts(g: Guide) {
  const c = { tested: 0, sourced: 0, uncertain: 0 };
  for (const e of allEvidence(g)) c[e.level] = (c[e.level] ?? 0) + 1;
  return c;
}
