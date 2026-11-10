// Checks every library guide against the shape the UI expects (src/lib/types.ts).
// Usage: node scripts/validate-guides.mjs
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../data/guides/", import.meta.url);
const LEVELS = ["tested", "sourced", "uncertain"];
let failed = 0;

for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const errs = [];
  const warn = [];
  let g;
  try {
    g = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  } catch (e) {
    console.log(`✕ ${f}: invalid JSON (${e.message})`);
    failed++;
    continue;
  }
  const need = (cond, msg) => cond || errs.push(msg);
  const ev = (e, where) => {
    if (!e) return warn.push(`${where}: no evidence`);
    if (!LEVELS.includes(e.level)) errs.push(`${where}: bad evidence level "${e.level}"`);
    if (e.level === "sourced" && !(e.sources ?? []).length) warn.push(`${where}: sourced without sources`);
    for (const s of e.sources ?? []) if (typeof s.url !== "string") errs.push(`${where}: source without url`);
  };

  need(g.slug + ".json" === f, `slug "${g.slug}" doesn't match filename`);
  need(g.app?.name, "app.name missing");
  need(g.meta?.generatedAt, "meta.generatedAt missing");
  const s = g.summary ?? {};
  need(s.verdict, "summary.verdict missing");
  need(["easy", "moderate", "hard", "very_hard"].includes(s.difficulty), `summary.difficulty "${s.difficulty}"`);
  need(s.timeToFirstConnection?.label, "summary.timeToFirstConnection.label missing");
  need(s.timeToProduction?.label, "summary.timeToProduction.label missing");
  ev(s.evidence, "summary");
  for (const k of ["stages", "requirements", "limitsBeforeApproval", "blockers", "nuances", "probes", "corrections", "openQuestions", "sources"]) {
    need(Array.isArray(g[k]), `${k} must be an array`);
  }
  need(Array.isArray(g.agentVsYou?.agentCan) && Array.isArray(g.agentVsYou?.youMust), "agentVsYou.agentCan/youMust must be arrays");
  (g.stages ?? []).forEach((st, i) => {
    need(st.title, `stages[${i}].title missing`);
    need(["setup", "test", "review", "launch"].includes(st.phase), `stages[${i}].phase "${st.phase}"`);
    need(["agent", "you", "provider"].includes(st.owner), `stages[${i}].owner "${st.owner}"`);
    need(Array.isArray(st.steps), `stages[${i}].steps must be an array`);
    ev(st.evidence, `stages[${i}]`);
  });
  (g.requirements ?? []).forEach((r, i) => {
    need(["setup", "testing", "production"].includes(r.neededFor), `requirements[${i}].neededFor "${r.neededFor}"`);
    ev(r.evidence, `requirements[${i}]`);
  });
  (g.limitsBeforeApproval ?? []).forEach((l, i) => { need(l.limit, `limits[${i}].limit missing`); ev(l.evidence, `limits[${i}]`); });
  (g.blockers ?? []).forEach((b, i) => { need(b.title && b.whatToDo, `blockers[${i}] needs title + whatToDo`); ev(b.evidence, `blockers[${i}]`); });
  (g.nuances ?? []).forEach((n, i) => { need(n.text, `nuances[${i}].text missing`); ev(n.evidence, `nuances[${i}]`); });
  (g.probes ?? []).forEach((p, i) => need(["pass", "fail", "info"].includes(p.status), `probes[${i}].status "${p.status}"`));

  const counts = { tested: 0, sourced: 0, uncertain: 0 };
  const all = [s.evidence, ...(g.stages ?? []), ...(g.requirements ?? []), ...(g.limitsBeforeApproval ?? []), ...(g.blockers ?? []), ...(g.nuances ?? [])]
    .map((x) => (x && "level" in x ? x : x?.evidence)).filter(Boolean);
  for (const e of all) counts[e.level] = (counts[e.level] ?? 0) + 1;

  if (errs.length) failed++;
  console.log(`${errs.length ? "✕" : "✓"} ${f}: ${g.stages?.length} stages, ${g.probes?.length} probes, ${g.sources?.length} sources · tested ${counts.tested} / sourced ${counts.sourced} / unverified ${counts.uncertain}`);
  for (const e of errs) console.log(`    error: ${e}`);
  for (const w of warn.slice(0, 5)) console.log(`    warn:  ${w}`);
}
process.exit(failed ? 1 : 0);
