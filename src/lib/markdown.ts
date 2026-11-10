import type { Evidence, Guide } from "./types";

const EV_LABEL = { tested: "Tested", sourced: "Sourced", uncertain: "Unverified" } as const;

function ev(e?: Evidence): string {
  if (!e) return "";
  const refs = (e.sources ?? [])
    .filter((s) => !s.url.startsWith("#"))
    .map((s) => `[${s.title ? s.title.slice(0, 40) : "source"}](${s.url})`)
    .join(", ");
  return ` _(${EV_LABEL[e.level]}${refs ? `: ${refs}` : ""}${e.note ? `. ${e.note}` : ""})_`;
}

/** A plain-Markdown version of a guide, for pasting into Slack, Notion, a ticket or a PR. */
export function guideToMarkdown(g: Guide, url: string): string {
  const L: string[] = [];
  L.push(`# ${g.app.name}: OAuth app setup & approval`, "");
  L.push(`**Difficulty:** ${g.summary.difficulty.replace("_", " ")} · **First test connection:** ${g.summary.timeToFirstConnection.label} · **Any user can connect:** ${g.summary.timeToProduction.label}`, "");
  L.push(g.summary.verdict + ev(g.summary.evidence), "");
  if (g.app.composio?.managedOAuthAvailable === true) {
    L.push(`> **You may not need your own OAuth app.** Composio provides a managed app for ${g.app.name}. ${g.app.composio.whenYouNeedYourOwnApp ?? ""}`, "");
  } else if (g.app.composio?.managedOAuthAvailable === false) {
    L.push(`> **You need your own OAuth app.** Composio has no managed app for ${g.app.name}.`, "");
  }
  const facts = [
    ["Hands-on effort", g.summary.handsOnEffort],
    ["Approval wait", g.summary.approvalWait],
    ["Costs", g.summary.costs],
  ].filter(([, v]) => v);
  for (const [k, v] of facts) L.push(`- **${k}:** ${v}`);
  L.push("", "## Steps", "");
  g.stages.forEach((s, i) => {
    const who = s.owner === "agent" ? "🤖 agent" : s.owner === "provider" ? "⏳ waiting on others" : "👤 you";
    L.push(`### ${i + 1}. ${s.title} (${who}${s.estimate ? `, ${s.estimate}` : ""})`);
    s.steps.forEach((st, j) => L.push(`${j + 1}. ${st}`));
    if (s.agentHelp) L.push("", `> Agent help: ${s.agentHelp}`);
    L.push("", ev(s.evidence).trim(), "");
  });
  if (g.requirements.length) {
    L.push("## What you need", "");
    for (const r of g.requirements) L.push(`- [ ] ${r.item} (${r.neededFor})${ev(r.evidence)}`);
    L.push("");
  }
  if (g.limitsBeforeApproval.length) {
    L.push("## Limits until approved", "");
    for (const l of g.limitsBeforeApproval) L.push(`- ${l.limit}${ev(l.evidence)}`);
    L.push("");
  }
  if (g.blockers.length) {
    L.push("## If you get stuck", "");
    for (const b of g.blockers) L.push(`- **${b.title}.** ${b.symptom ? `You see: ${b.symptom} ` : ""}What to do: ${b.whatToDo}${ev(b.evidence)}`);
    L.push("");
  }
  if (g.nuances.length) {
    L.push("## Things that catch people out", "");
    for (const n of g.nuances) L.push(`- ${n.text}${ev(n.evidence)}`);
    L.push("");
  }
  L.push("## Agent vs. you", "", "**An agent can:**");
  for (const x of g.agentVsYou.agentCan) L.push(`- ${x}`);
  L.push("", "**You must:**");
  for (const x of g.agentVsYou.youMust) L.push(`- ${x}`);
  L.push("");
  if (g.composioSetup?.redirectUri) {
    L.push("## Plug it into Composio", "", `Redirect URI: \`${g.composioSetup.redirectUri}\``, "");
    for (const s of g.composioSetup.steps ?? []) L.push(`- ${s}`);
    L.push("");
  }
  if (g.openQuestions.length) {
    L.push("## Not verified", "");
    for (const q of g.openQuestions) L.push(`- ${q}`);
    L.push("");
  }
  L.push(`---`, `Last checked ${g.meta.lastVerifiedAt ?? g.meta.generatedAt}. Full guide with evidence: ${url}`);
  return L.join("\n");
}
