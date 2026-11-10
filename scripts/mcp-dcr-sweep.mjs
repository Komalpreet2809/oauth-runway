// Read-only sweep: which MCP servers from Composio's "bring your own OAuth app"
// list support Dynamic Client Registration (RFC 7591)? If they do, an agent can
// create the OAuth client itself, with no developer-portal work.
//
// Hosts are best guesses at each vendor's remote MCP server. A host that doesn't
// answer is reported as "not found", not as "no DCR".
//
// Usage: node scripts/mcp-dcr-sweep.mjs   → writes research/mcp-dcr-sweep.json

import { writeFileSync, mkdirSync } from "node:fs";

const CANDIDATES = {
  "Atlassian MCP": "https://mcp.atlassian.com/v1/sse",
  "Linear MCP": "https://mcp.linear.app/mcp",
  "Notion MCP": "https://mcp.notion.com/mcp",
  "Sentry MCP": "https://mcp.sentry.dev/mcp",
  "Stripe MCP": "https://mcp.stripe.com",
  "Canva MCP": "https://mcp.canva.com/mcp",
  "Vercel MCP": "https://mcp.vercel.com",
  "Supabase MCP": "https://mcp.supabase.com/mcp",
  "Neon MCP": "https://mcp.neon.tech/mcp",
  "PostHog MCP": "https://mcp.posthog.com/mcp",
  "Monday MCP": "https://mcp.monday.com/mcp",
  "ClickUp MCP": "https://mcp.clickup.com/mcp",
  "Box MCP": "https://mcp.box.com",
  "Wix MCP": "https://mcp.wix.com/mcp",
  "Granola MCP": "https://mcp.granola.ai/mcp",
  "Datadog MCP": "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp",
  "Ramp MCP": "https://mcp.ramp.com/mcp",
  "Close MCP": "https://mcp.close.com/mcp",
  "Todoist MCP": "https://ai.todoist.net/mcp",
  "Railway MCP": "https://mcp.railway.com",
  "Resend MCP": "https://mcp.resend.com",
  "Stytch MCP": "https://mcp.stytch.dev/mcp",
  "Apify MCP": "https://mcp.apify.com",
  "Semrush MCP": "https://mcp.semrush.com/v1/mcp",
  "Customer.io MCP": "https://mcp.customer.io/mcp",
  "Tavily MCP": "https://mcp.tavily.com/mcp",
  "Mercury MCP": "https://mcp.mercury.com/mcp",
  "Calendly MCP": "https://mcp.calendly.com",
  "Lucid MCP": "https://mcp.lucid.app/mcp",
  "Honeycomb MCP": "https://mcp.honeycomb.io/mcp",
  "Otter.ai MCP": "https://mcp.otter.ai/mcp",
  "Plain MCP": "https://mcp.plain.com/mcp",
  "Amplitude MCP": "https://mcp.amplitude.com/mcp",
  "Vantage MCP": "https://mcp.vantage.sh/mcp",
  "Netlify MCP": "https://netlify-mcp.netlify.app/mcp",
  "Cloudflare MCP": "https://bindings.mcp.cloudflare.com/mcp",
  "Magic Patterns MCP": "https://mcp.magicpatterns.com/mcp",
  "Kernel MCP": "https://mcp.onkernel.com/mcp",
  "QuickNode MCP": "https://mcp.quicknode.com/mcp",
  "Better Stack MCP": "https://mcp.betterstack.com",
  "Pylon MCP": "https://mcp.usepylon.com",
  "GoCardless MCP": "https://mcp.gocardless.com/mcp",
  "Parallel Task MCP": "https://task-mcp.parallel.ai/mcp",
  "Common Room MCP": "https://mcp.commonroom.io/mcp",
  "Trello MCP": "https://mcp.trello.com/mcp",
};

const UA = "oauth-guide-research/1.0 (read-only discovery probe)";
const get = async (url) => {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    const ct = r.headers.get("content-type") || "";
    const json = ct.includes("json") ? await r.json().catch(() => null) : (await r.body?.cancel(), null);
    return { status: r.status, json };
  } catch (e) {
    return { status: 0, json: null, error: e.name };
  }
};

async function check(name, serverUrl) {
  const u = new URL(serverUrl);
  const origin = u.origin;
  // 1) MCP spec: protected resource metadata names the authorization server.
  let asOrigin = origin;
  let via = "host";
  for (const p of [`/.well-known/oauth-protected-resource${u.pathname === "/" ? "" : u.pathname}`, "/.well-known/oauth-protected-resource"]) {
    const pr = await get(origin + p);
    const as = pr.json?.authorization_servers?.[0];
    if (as) {
      asOrigin = as.replace(/\/$/, "");
      via = `protected-resource → ${asOrigin}`;
      break;
    }
  }
  // 2) Authorization server metadata (RFC 8414), then OIDC as a fallback.
  const asUrl = new URL(asOrigin);
  const asPath = asUrl.pathname === "/" ? "" : asUrl.pathname;
  for (const p of [`/.well-known/oauth-authorization-server${asPath}`, `${asPath}/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration${asPath}`, `${asPath}/.well-known/openid-configuration`]) {
    const md = await get(asUrl.origin + p);
    if (md.json && (md.json.authorization_endpoint || md.json.issuer)) {
      return {
        name, server: serverUrl, discovery: asUrl.origin + p, via,
        found: true,
        dcr: typeof md.json.registration_endpoint === "string",
        registrationEndpoint: md.json.registration_endpoint ?? null,
        cimd: md.json.client_id_metadata_document_supported === true,
        pkce: md.json.code_challenge_methods_supported ?? null,
      };
    }
  }
  return { name, server: serverUrl, found: false };
}

const results = [];
const entries = Object.entries(CANDIDATES);
for (let i = 0; i < entries.length; i += 8) {
  results.push(...(await Promise.all(entries.slice(i, i + 8).map(([n, u]) => check(n, u)))));
}
const found = results.filter((r) => r.found);
const summary = {
  checkedAt: new Date().toISOString().slice(0, 10),
  probed: results.length,
  discoveryFound: found.length,
  dcrSupported: found.filter((r) => r.dcr).length,
  cimdSupported: found.filter((r) => r.cimd).length,
};
mkdirSync(new URL("../research/", import.meta.url), { recursive: true });
writeFileSync(new URL("../research/mcp-dcr-sweep.json", import.meta.url), JSON.stringify({ summary, results }, null, 2) + "\n");
console.log(summary);
for (const r of results) console.log(`${r.found ? (r.dcr ? "DCR " : "noDCR") : "  -  "}  ${r.name}${r.found ? `  (${r.via})` : ""}`);
