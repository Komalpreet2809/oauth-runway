// Applies the independent verification results (research/verification-sample.json)
// to the library guides: rewrites the four "partly" claims precisely and records
// each fix in the guide's `corrections` list. Idempotent: safe to run twice.
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../data/guides/", import.meta.url);
const load = (s) => JSON.parse(readFileSync(new URL(`${s}.json`, dir), "utf8"));
const save = (s, g) => writeFileSync(new URL(`${s}.json`, dir), JSON.stringify(g, null, 2) + "\n");
const TAG = "Independent check (2026-11-05): ";

function replaceIn(obj, from, to) {
  let n = 0;
  const walk = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && v.includes(from) && k !== "quote" && k !== "url") {
        o[k] = v.split(from).join(to);
        n++;
      } else if (v && typeof v === "object") walk(v);
    }
  };
  walk(obj);
  return n;
}
function addCorrection(g, c) {
  if (!g.corrections.some((x) => x.claim.startsWith(TAG) && x.claim.includes(c.key))) {
    g.corrections.unshift({ claim: TAG + c.claim, finding: c.finding, source: c.source });
  }
}
function setLastVerified(g) {
  g.meta.lastVerifiedAt = "2026-11-05";
}

// --- GitHub (G4) ------------------------------------------------------------
{
  const g = load("github");
  const n =
    replaceIn(g, "(e.g. an app owned by your GitHub Enterprise Cloud org for 15,000 req/hr)", "(e.g. an OAuth app owned or approved by your GitHub Enterprise Cloud org, which gets 15,000 req/hr for that org's members)") +
    replaceIn(g, "only matters if you want the 15,000 req/hr limit.", "only matters if you want the 15,000 req/hr limit, which applies to users who are members of that org.") +
    replaceIn(g, "The exception is an app owned by a GitHub Enterprise Cloud org, which gets 15,000/hour.", "The exception: an OAuth app owned or approved by a GitHub Enterprise Cloud org gets 15,000/hour, but only for users who are members of that org.") +
    replaceIn(g, "Real gains are an app owned by a GitHub Enterprise Cloud org (15,000/hr)", "Real gains are an OAuth app owned or approved by a GitHub Enterprise Cloud org (15,000/hr for that org's members)");
  addCorrection(g, {
    key: "15,000",
    claim: "Our draft said the 15,000/hour limit applies to an app owned by a GitHub Enterprise Cloud org.",
    finding: "Partly right. GitHub's docs say it applies to OAuth apps owned OR approved by a GitHub Enterprise Cloud org, and only for users who are members of that org.",
    source: "https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api",
  });
  setLastVerified(g);
  save("github", g);
  console.log("github: replaced", n);
}

// --- Slack (S5) ---------------------------------------------------------------
{
  const g = load("slack");
  const n =
    replaceIn(g, "(needed only to lift the conversations.history/replies throttle and to use the Real-time Search API or Slack MCP server)", "(needed only by distributed apps, to lift the conversations.history/replies throttle and to use the Real-time Search API or Slack MCP server; internal single-workspace apps can use those without a listing)") +
    replaceIn(g, "You need this only if you want unthrottled conversations.history/replies in customers' workspaces, or the Real-time Search API or Slack MCP server.", "You need this only if your app is distributed to other workspaces and you want unthrottled conversations.history/replies there, or the Real-time Search API or Slack MCP server. Internal single-workspace apps can use search and MCP without a listing.") +
    replaceIn(g, "Slack Marketplace approval, needed only for unthrottled conversations.history/replies in other workspaces, the Real-time Search API and the Slack MCP server", "Slack Marketplace approval, needed only for a distributed app to get unthrottled conversations.history/replies, the Real-time Search API and the Slack MCP server in other workspaces");
  if (!g.nuances.some((x) => x.text.includes("does not support Dynamic Client Registration"))) {
    g.nuances.push({
      text: "Slack's own MCP server (mcp.slack.com) does not support Dynamic Client Registration, so even for MCP you need a regular Slack app with a client ID and secret. It's also limited to Marketplace and internal apps.",
      evidence: { level: "sourced", sources: [{ url: "https://docs.slack.dev/ai/slack-mcp-server", quote: "Only apps published in the Slack Marketplace and internal apps can use MCP at this time; unlisted apps are prohibited from using MCP." }], note: "The DCR point comes from the independent check of the same page." },
    });
  }
  addCorrection(g, {
    key: "Real-time Search",
    claim: "Parts of our draft implied a Marketplace listing is needed for any app to use the Real-time Search API or the Slack MCP server.",
    finding: "Partly right. The ban covers unlisted DISTRIBUTED apps. Internal (single-workspace) apps can use both without a listing. The Slack MCP server also doesn't support Dynamic Client Registration.",
    source: "https://docs.slack.dev/ai/slack-mcp-server",
  });
  setLastVerified(g);
  save("slack", g);
  console.log("slack: replaced", n);
}

// --- Gmail (M4, M6) ---------------------------------------------------------------
{
  const g = load("gmail");
  const n =
    replaceIn(g, "Google's Health API docs quote $500–$4,500 USD depending on app complexity, and it repeats at least every 12 months.", "Google's Health API docs quote $500–$4,500 USD depending on app complexity, but labs set their own prices (quotes seen from about $540 to $5,400), and it repeats at least every 12 months for apps that access restricted data through a server.") +
    replaceIn(g, "Budget $500–$4,500 and 2–3+ weeks every year,", "Budget roughly $500–$5,000+ (lab prices vary) and 2–3+ weeks every year,") +
    replaceIn(g, "Google's Workspace data policy (updated 2026-09-03) now names MCPs and agentic tools. It expects granular in-context consent for agent actions and bans using Gmail data to train generalized AI/ML models.", "Google's Workspace data policy now names MCPs and agentic tools (added around July 2026; the page shows 'last updated 2026-09-03'). It expects granular in-context consent for agent actions. Separately, its long-standing rule (since at least 2024) bans using Workspace data to train generalized AI/ML models.") +
    replaceIn(g, "Google Workspace user data and developer policy (updated 2026-09-03)", "Google Workspace user data and developer policy");
  addCorrection(g, {
    key: "CASA",
    claim: "Our draft gave the CASA Tier 2 cost as $500–$4,500.",
    finding: "Partly right. Google's Health API docs quote that range, but Google and the App Defense Alliance publish no official price list and labs set their own (quotes seen from about $540 to $5,400). Self-scan deprecation and the annual reassessment are confirmed.",
    source: "https://appdefensealliance.dev/casa/tier-2/tier2-overview",
  });
  addCorrection(g, {
    key: "MCP",
    claim: "Our draft said Google's 2026-09-03 policy update added MCP/agent rules and the ban on training AI with user data.",
    finding: "Partly right. The MCP and agent language was added around 2026-07-13 (the page's 'last updated' date is later). The AI-training ban dates from 2024 or earlier, so it isn't new.",
    source: "https://developers.google.com/workspace/workspace-api-user-data-developer-policy",
  });
  setLastVerified(g);
  save("gmail", g);
  console.log("gmail: replaced", n);
}
