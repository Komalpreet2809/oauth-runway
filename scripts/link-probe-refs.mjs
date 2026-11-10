// Evidence that cites a live probe should jump to that probe's result on the page
// (#probe-N), not open the raw probe URL — those URLs intentionally return errors
// (fake client IDs, missing tokens), which looks like a broken link to a reader.
// Idempotent. Usage: node scripts/link-probe-refs.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../data/guides/", import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const g = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  let changed = 0;
  const probeFor = (url) => {
    const clean = url.replace(/[?#].*$/, "");
    return g.probes.findIndex((p) => p.request.includes(url) || p.request.includes(clean));
  };
  const fix = (ev) => {
    for (const s of ev?.sources ?? []) {
      if (!s.url?.startsWith("http")) continue;
      const isProbeSource = g.sources.some((x) => x.url === s.url && x.type === "probe");
      const idx = probeFor(s.url);
      if (idx >= 0 && (isProbeSource || !g.sources.some((x) => x.url === s.url && x.type !== "probe"))) {
        s.url = `#probe-${idx + 1}`;
        s.title = s.title || g.probes[idx].name;
        delete s.quote;
        changed++;
      }
    }
  };
  fix(g.summary.evidence);
  for (const k of ["stages", "requirements", "limitsBeforeApproval", "blockers", "nuances"]) for (const it of g[k]) fix(it.evidence);
  writeFileSync(new URL(f, dir), JSON.stringify(g, null, 2) + "\n");
  console.log(`${f}: ${changed} evidence links now point to on-page live checks`);
}
