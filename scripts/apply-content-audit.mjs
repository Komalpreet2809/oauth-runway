// Applies the reviewed fixes from research/content-audit.json (an independent
// "AI blunder" review of the library guides). Each fix was read and accepted
// by hand; a few suggestions were adapted (quotes stay verbatim, our own
// corrections stay visible). Every edit checks the current text first, so
// running it twice is harmless. Usage: node scripts/apply-content-audit.mjs
import { readFileSync, writeFileSync } from "node:fs";

const audit = JSON.parse(readFileSync(new URL("../research/content-audit.json", import.meta.url), "utf8"));
const dir = new URL("../data/guides/", import.meta.url);
const guides = Object.fromEntries(
  ["github", "slack", "gmail", "linear-mcp"].map((s) => [s, JSON.parse(readFileSync(new URL(`${s}.json`, dir), "utf8"))]),
);
const log = [];

const parse = (path) => path.split(/\.|\[|\]/).filter(Boolean).map((k) => (/^\d+$/.test(k) ? Number(k) : k));
const get = (obj, path) => parse(path).reduce((o, k) => (o == null ? o : o[k]), obj);
function set(obj, path, value) {
  const keys = parse(path);
  const last = keys.pop();
  const parent = keys.reduce((o, k) => o[k], obj);
  parent[last] = value;
}
const fix = (n) => audit.issues[n].suggestedFix;
const issue = (n) => audit.issues[n];

/** Replace a whole field with the reviewer's text (only if not already applied). */
function replaceField(n, value = fix(n)) {
  const { guide, path } = issue(n);
  const g = guides[guide];
  if (get(g, path) === value) return log.push(`#${n} already applied`);
  set(g, path, value);
  log.push(`#${n} ${guide} ${path}`);
}
/** Replace a substring inside a field. */
function replaceIn(n, from, to) {
  const { guide, path } = issue(n);
  const g = guides[guide];
  const cur = get(g, path);
  if (typeof cur !== "string" || !cur.includes(from)) return log.push(`#${n} skipped (text not found / already applied)`);
  set(g, path, cur.split(from).join(to));
  log.push(`#${n} ${guide} ${path}`);
}

// ---- GitHub ---------------------------------------------------------------
replaceField(0);
{ // #1: add the verbatim OAuth-app sentence the independent check found, as a second source.
  const g = guides.github;
  const ev = g.nuances[0].evidence;
  const url = "https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api";
  if (!ev.sources.some((s) => s.quote?.includes("owned or approved"))) {
    ev.sources.push({ url, title: "Rate limits for the REST API", quote: "OAuth app that is owned or approved by a GitHub Enterprise Cloud organization have a higher rate limit of 15,000 requests per hour if you are a member" });
  }
  log.push("#1 github nuances[0] second source");
}
{ // #2: the quote didn't support the requirement; drop it rather than invent one.
  const ev = guides.github.requirements[2].evidence;
  ev.sources = ev.sources.filter((s) => !s.quote?.startsWith("Some toolkit defaults use the supported legacy callback"));
  ev.sources.push({ url: "https://docs.composio.dev/docs/custom-auth-configs", title: "Composio: Custom auth configs" });
  ev.level = "sourced";
  ev.note = "Composio's docs give this callback URL; it must match the auth config exactly.";
  log.push("#2 github requirements[2] evidence");
}
replaceField(3, "you");
{ // #4: waiting on the customer's org owner, not GitHub; make the title say so.
  const st = guides.github.stages[5];
  st.title = "Get each customer organization to approve your app (you wait on their org owner, not GitHub)";
  log.push("#4 github stages[5].title");
}

// ---- Slack ----------------------------------------------------------------
for (const n of [6, 7, 8, 9]) replaceField(n);
replaceField(10, "you");
{ // #11: tell Slack developers to pass the auth config ID (the other guides do).
  const steps = guides.slack.stages[3].steps;
  if (!steps.some((s) => s.includes("authConfigs"))) steps.push(fix(11));
  log.push("#11 slack stages[3] step added");
}
{ // #12: duplicate DCR nuance with leftover process text.
  const ns = guides.slack.nuances;
  const dupIdx = ns.findIndex((x) => x.evidence?.note === "The DCR point comes from the independent check of the same page.");
  if (dupIdx >= 0) {
    const keep = ns.findIndex((x, i) => i !== dupIdx && /Dynamic Client Registration/i.test(x.text));
    if (keep >= 0 && !/Marketplace and internal apps/.test(ns[keep].text)) ns[keep].text += " It is also limited to Marketplace and internal apps.";
    ns.splice(dupIdx, 1);
  }
  log.push("#12 slack duplicate nuance removed");
}
replaceIn(13, "until September 2, 2025 March 3, 2026", "until [struck through: September 2, 2025] March 3, 2026");
{ // #13b: same flattening in the probe result text.
  for (const p of guides.slack.probes) p.result = p.result.replace("September 2, 2025 March 3, 2026", "[struck through: September 2, 2025] March 3, 2026");
}
{ // #14: the decision-relevant part is inference; cite the on-page snapshot probe.
  const ev = guides.slack.nuances[0].evidence;
  ev.level = "sourced";
  if (!ev.sources.some((s) => s.url === "#probe-10")) ev.sources.push({ url: "#probe-10", title: guides.slack.probes[9]?.name ?? "Snapshot comparison" });
  log.push("#14 slack nuances[0].evidence");
}
{ // #16: unsupported delisting claim.
  const st = guides.slack.stages[9];
  const i = st.steps.findIndex((s) => /delist/i.test(s));
  if (i >= 0) st.steps[i] = fix(16);
  log.push("#16 slack stages[9] delisting claim");
}
replaceIn(17, "setup takes about 15 minutes", "setup takes about 30 minutes");
replaceField(18);
replaceIn(19, "normal Tier 3 limits", "normal limits that internal apps get (Slack's 'Tier 3': 50+ requests per minute, up to 1,000 messages per call)");

// ---- Gmail ----------------------------------------------------------------
replaceField(20, "45–70 min");
{ // #21: brand verification is the developer's work; the wait goes in the estimate.
  const st = guides.gmail.stages[7];
  st.owner = "you";
  st.estimate = "Minutes (automated); 2–3 business days if manual";
  log.push("#21 gmail stages[7]");
}
{ // #22: split "submit for verification" (you) from "Google reviews it" (provider).
  const st = guides.gmail.stages[8];
  if (st.owner !== "you") {
    const wait = st.estimate;
    st.owner = "you";
    st.estimate = "About 1 hour to submit";
    guides.gmail.stages.splice(9, 0, {
      id: "google-review-wait",
      title: "Wait for Google's restricted-scope review",
      phase: "review",
      owner: "provider",
      estimate: wait || "Several weeks",
      steps: [
        "Google's Trust & Safety team reviews your scopes, homepage, privacy policy and demo video. Expect follow-up questions by email.",
        "Reply quickly. Each round of questions restarts part of the wait.",
        "Keep the app in Testing for your own testers while you wait. The 100-user cap and 7-day re-consent still apply.",
      ],
      agentHelp: "An agent can draft replies to reviewer questions from your scope justifications and privacy policy.",
      evidence: st.evidence,
    });
  }
  log.push("#22 gmail stages[8] split into submit + wait");
}
replaceField(23);
replaceField(24);
replaceField(25, "uncertain");
replaceField(28);
replaceField(29);

// ---- Linear MCP -------------------------------------------------------------
{ // #30: cite the probe that actually shows the CIMD fetch.
  const ev = guides["linear-mcp"].nuances[0].evidence;
  ev.sources = [
    { url: "#probe-9", title: "Authorize with a CIMD-style URL client_id" },
    { url: "#probe-1", title: "OAuth authorization server metadata" },
  ];
  log.push("#30 linear-mcp nuances[0] sources");
}
{ // #31: a probe that was never sent isn't a probe result.
  const ps = guides["linear-mcp"].probes;
  const i = ps.findIndex((p) => /not sent|Not attempted/i.test(`${p.request} ${p.result}`));
  if (i >= 0) ps.splice(i, 1);
  log.push("#31 linear-mcp unsent probe removed");
}
replaceField(32);
{ // #32b: same workflow leak in openQuestions.
  const oq = guides["linear-mcp"].openQuestions;
  for (let i = 0; i < oq.length; i++) oq[i] = oq[i].replace(/\s*A live registration test is pending user approval\.?/i, " A live registration was not performed: it would create a real client on Linear's server.");
}
replaceField(33);
{ // #34: cite the protected-resource probe the step relies on.
  const ev = guides["linear-mcp"].stages[1].evidence;
  if (!ev.sources.some((s) => s.url === "#probe-3")) ev.sources.push({ url: "#probe-3", title: "Protected resource metadata (/mcp)" });
  log.push("#34 linear-mcp stages[1] source");
}
replaceField(35, "uncertain");
replaceIn(36, "Linear exposes revocation at https://mcp.linear.app/token (revocation_endpoint)", "Linear serves token revocation from the same URL as the token endpoint, https://mcp.linear.app/token (its revocation_endpoint)");
replaceField(37, "15–20 min");
replaceField(38, "https://linear.app/docs/mcp");
replaceField(39);

// ---- Our own corrections: keep them (the brief asks what we corrected), but
// word them as what they are rather than leaking internal process text. ----
for (const g of Object.values(guides)) {
  for (const c of g.corrections) {
    c.claim = c.claim.replace(/^Independent check \(2026-11-05\): Our draft (said|gave)/, "Our first draft $1").replace(/^Independent check \(2026-11-05\): Parts of our draft/, "Parts of our first draft");
  }
  g.meta.lastVerifiedAt = "2026-11-11";
}

for (const [slug, g] of Object.entries(guides)) writeFileSync(new URL(`${slug}.json`, dir), JSON.stringify(g, null, 2) + "\n");
console.log(log.join("\n"));
