// Records the real setup attempt on Linear's MCP server (run 2026-11-11, with the
// author's approval) into the Linear MCP guide:
//   1. POST /register with Composio's redirect URI → 201 in ~0.6s; client_id (16 chars)
//      and a 32-char client_secret issued; the secret has an expiry timestamp.
//   2. GET /authorize with the new client + Composio's redirect + PKCE → 200 (Linear's
//      sign-in/consent page). We did not sign in.
//   3. Same client with a different redirect URI → 400 "Invalid redirect URI".
// No credential values were printed or stored. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../data/guides/linear-mcp.json", import.meta.url);
const g = JSON.parse(readFileSync(file, "utf8"));
const DAY = "2026-11-11";
const REDIRECT = "https://backend.composio.dev/api/v3/toolkits/auth/callback";

const newProbes = [
  {
    name: "Real Dynamic Client Registration with Composio's redirect URI",
    request: `POST https://mcp.linear.app/register {"client_name":"OAuth Runway setup test (Composio redirect)","redirect_uris":["${REDIRECT}"],"grant_types":["authorization_code","refresh_token"],"response_types":["code"],"token_endpoint_auth_method":"client_secret_post"}`,
    result: "201 Created in 0.6s. Linear issued a client_id (16 characters) and a client_secret (32 characters), echoed Composio's redirect URI as registered, and set client_secret_expires_at, so the secret expires. No account, form or review was involved. The credential values were not recorded.",
    status: "pass",
    checkedAt: DAY,
  },
  {
    name: "Authorize with the newly registered client",
    request: `GET https://mcp.linear.app/authorize?response_type=code&client_id=<new client>&redirect_uri=${REDIRECT}&code_challenge=<S256>&code_challenge_method=S256`,
    result: "200: Linear serves its sign-in/consent page, so it accepts the new client together with Composio's redirect URI. We stopped here and did not sign in.",
    status: "pass",
    checkedAt: DAY,
  },
  {
    name: "Same client, different redirect URI",
    request: "GET https://mcp.linear.app/authorize?…&client_id=<new client>&redirect_uri=https://evil.example.org/cb",
    result: "400 \"Invalid redirect URI\". Linear enforces the registered redirect exactly, so it must match the Composio auth config character for character.",
    status: "pass",
    checkedAt: DAY,
  },
];
for (const p of newProbes) if (!g.probes.some((x) => x.name === p.name)) g.probes.push(p);
const ref = (name) => ({ url: `#probe-${g.probes.findIndex((p) => p.name === name) + 1}`, title: name });
const [regRef, authRef, badRef] = newProbes.map((p) => ref(p.name));

// Stage: register by API is now tested end to end up to the consent page.
const st = g.stages.find((s) => /Register an OAuth client by API/i.test(s.title));
st.evidence = {
  level: "tested",
  sources: [regRef, authRef, badRef, ...st.evidence.sources.filter((s) => s.url.startsWith("#probe-") && s.url !== regRef.url)],
  note: "Tested live on 2026-11-11: registration with Composio's redirect URI succeeded in under a second, and Linear's authorize step accepted the new client. Signing in and Composio's side of the flow were not tested.",
};
if (!st.steps.some((s) => /expires/i.test(s))) {
  st.steps.push("Linear returns a client_secret with an expiry time (client_secret_expires_at). Store it securely and plan to register again or rotate it before it expires.");
}

// Summary + clocks no longer claim "no registration was performed".
g.summary.timeToFirstConnection.note = g.summary.timeToFirstConnection.note.replace(
  "Not tested end to end: no registration or login was performed.",
  "Registration with Composio's redirect URI was tested live (201 in under a second). Signing in and Composio's side were not tested.",
);
g.summary.evidence.note = "Registration was tested live on 2026-11-11 and took under a second with no review. Other timings are estimates. Linear's MCP docs mention no review or approval process for MCP clients.";
if (!g.summary.evidence.sources.some((s) => s.url === regRef.url)) g.summary.evidence.sources.push(regRef);

// Resolve the open question we just answered, and add the new one we discovered.
g.openQuestions = g.openQuestions.filter((q) => !/Does POST https:\/\/mcp\.linear\.app\/register accept/i.test(q));
const expiryQ = "How long does a client_secret from mcp.linear.app/register stay valid, and what happens to connected users when it expires? Inspect client_secret_expires_at on a registration you keep.";
if (!g.openQuestions.includes(expiryQ)) g.openQuestions.unshift(expiryQ);

// New nuance from the test.
const expiryNuance = "Dynamically registered clients get a client_secret that expires (Linear sets client_secret_expires_at). Treat the registration as something to monitor and renew, not a one-time setup.";
if (!g.nuances.some((n) => n.text === expiryNuance)) g.nuances.unshift({ text: expiryNuance, evidence: { level: "tested", sources: [regRef] } });

// Record what the test changed.
const correction = {
  claim: "Our first draft could only say the registration endpoint exists. Whether Linear would accept Composio's redirect URI was unverified.",
  finding: "Tested on 2026-11-11: a real registration with Composio's redirect URI returned 201 in 0.6s, the authorize step accepted it, and a different redirect URI was rejected with 400.",
  source: regRef.url,
};
if (!g.corrections.some((c) => c.finding.startsWith("Tested on 2026-11-11"))) g.corrections.unshift(correction);

g.meta.lastVerifiedAt = DAY;
writeFileSync(file, JSON.stringify(g, null, 2) + "\n");
console.log("probes:", g.probes.length, "| stage evidence:", st.evidence.level, "| open questions:", g.openQuestions.length);
