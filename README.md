# OAuth Runway

**How long until your users can connect an app to your AI agent?**

OAuth Runway gives developers clear, evidence-backed guides for setting up a provider OAuth app and getting it approved for use with [Composio](https://composio.dev). It has two parts:

- a **library** of in-depth guides chosen to cover different setup paths, and
- a **live research agent**: enter any app name or website and it reads the provider's docs, probes their OAuth endpoints, writes a shareable guide, and checks every quote against its source.

**Live demo:** https://oauth-runway-woad.vercel.app · **How it works:** https://oauth-runway-woad.vercel.app/method

---

## The problem, as I understood it

Three things get conflated:

1. **The provider OAuth app**, registered once with Google, Slack, Shopify and so on. It has a client ID and secret, redirect URL, scopes, consent-screen branding, and often a **review or verification status**.
2. **The integration**, a Composio auth config that points at either Composio's managed app or your own.
3. **Users' connections**: the tokens each end user grants.

Whether users can connect, how many of them, what warning screens they see, and which rate limits apply all depend on the state of item 1. That is the slow and unfamiliar part. Of the 402 OAuth apps on Composio, 127 have a Composio-managed OAuth app and **275 require you to bring your own** ([source](https://docs.composio.dev/toolkits/managed-auth)).

Composio's existing setup guides ([composio.dev/auth](https://composio.dev/auth)) cover *creating* the app. They don't cover approval, timelines, effort, limits before approval, or blockers. The Google guide, for example, says production "may need verification" but never mentions restricted scopes or the security assessment. That gap is what this project fills.

## Key decisions

- **Lead with "do you even need this?"** If Composio manages the app, a developer may need no setup at all, so each guide says this first.
- **Two clocks.** *First test connection* vs. *any user can connect*: these can differ by weeks. Hands-on effort is shown separately from waiting.
- **Every step has an owner:** 🤖 agent, 👤 you, or ⏳ waiting on someone else (the provider, or a customer's admin). This shows where agents help and where a human or legal entity is needed.
- **Limits before approval and blockers are first-class sections**, because that's where teams get surprised.
- **Evidence on every claim:** *Tested* (we observed it), *Sourced* (verbatim quote from a cited page), or *Unverified*. Uncertainty is shown, not hidden.
- **Verification is done in code, not by the model.** For live guides, every quote must appear on the page it cites, or the claim is downgraded to Unverified. Only live probes can produce "Tested".
- **Shareable:** stable URL, Markdown export (for tickets and Slack), and JSON (for other agents).
- **$0 to run:** every service is on a free plan with no card required: Gemini Flash-Lite (two models, since free quotas are per model) with Groq as a fallback, Tavily search, Upstash Redis, and Vercel Hobby. Generated guides are cached, and generation is rate-limited to protect the quotas. Mistral was the original choice, but its Free plan no longer activates API keys.

## Scope: why these apps

The library deliberately spans the range of setup paths:

| App | Path | Why it's included |
|---|---|---|
| Linear MCP | Agent can self-register (DCR) | Represents the many MCP servers on the bring-your-own list |
| GitHub | Self-serve, no review | Fast, but org admins can block access |
| Slack | Self-serve plus optional Marketplace review | Unreviewed apps face rate limits that matter for agents |
| Gmail | Verification plus security assessment | Weeks of waiting; restricted scopes |

## What I tested, what sources support, what's uncertain

- **MCP self-registration check** (`scripts/mcp-dcr-sweep.mjs`): read-only GETs against 45 MCP servers from Composio's bring-your-own list. **42 of the 43 that responded advertise Dynamic Client Registration**, so an agent can likely create the OAuth client itself.
- **Real setup attempt** (`scripts/record-linear-dcr-test.mjs`): to confirm self-registration works and isn't just advertised, one real OAuth client was registered on Linear's MCP server with Composio's redirect URL:
  - It returned **201 in 0.6s** with a client ID and an *expiring* client secret.
  - Linear's authorize step accepted the new client.
  - A different redirect URL was rejected with 400.
  - We stopped at the sign-in page, and no credential values were stored.

  For the other 41 MCP servers, acceptance of Composio's redirect URL remains untested.
- **Library guides:** each was researched by a separate agent against primary sources, with live read-only probes (discovery docs, authorize-endpoint error behaviour). Corrections and open questions are listed on each guide and on `/method`.
- **Independent fact-check** (`research/verification-sample.json`): a fresh agent that hadn't written the guides tested 20 high-stakes claims, phrased neutrally, against primary sources: **16 confirmed, 4 partly right, 0 contradicted**. The 4 partial claims were rewritten (`scripts/apply-verification.mjs`) and recorded in each guide's "What we corrected". Examples: GitHub's 15,000/hr limit also covers *approved* apps; Slack's search/MCP ban applies only to *distributed* unlisted apps; no official CASA price list exists.
- **"AI blunder" review** (`research/content-audit.json`): another fresh agent read all 4 library guides looking for internal contradictions, wrong step owners, stale dates, jargon and evidence that doesn't support its claim. It found 40 issues (1 high, 14 medium, 25 low). Examples: Slack's throttle described as hitting only new apps when it hits all new installs; "10 weeks" vs "12 weeks" in one guide; a citation pointing at the wrong probe. All were fixed (`scripts/apply-content-audit.mjs`). Two suggestions were adapted rather than applied as written: quotes stay verbatim, and our own corrections stay visible.
- **Live agent runs** on apps outside the library, each finishing in about 20–30s:

  | App | Quotes matched | Notes |
  |---|---|---|
  | Zoom | 15/16 | Unpublished apps work only in your own account |
  | Pipedrive (entered as a URL) | 10/10 | Draft apps limited to your own company |
  | Notion MCP | 5/5 | Self-registration detected live, so the agent owns setup |
  | Xero | 20/20 | 5-connection Starter cap; max 2 uncertified apps per org |

- **What testing changed in the agent:**
  - A model once told the developer to register an app by hand even though the probe had found self-registration, so that fact is now enforced in code.
  - Facts we observe ourselves are written into the guide by code, not left for the model to cite.
  - Vague time labels are disallowed.
- **Not done:** no provider accounts were created and no approvals were submitted. Apart from the Linear registration, "tested" means live read-only probes. Review timelines are rarely published, so they appear as ranges marked Unverified.

## How the live agent works

`understand → identify → research ∥ probe → draft → verify → publish` ([src/lib/agent.ts](src/lib/agent.ts))

1. Check the library, the cache, and Composio's directory.
2. Identify the product and its official docs domains (search + 1 LLM call).
3. Run 4 targeted searches (official domains first) and, in parallel, read-only OAuth discovery probes.
4. Draft the guide from numbered sources only, citing a verbatim quote per claim (1 LLM call).
5. Check each quote against the fetched page text in code ([src/lib/verify.ts](src/lib/verify.ts)) and downgrade failures.
6. Save to Redis behind `/guides/<slug>`. Progress streams to the browser the whole time.

## Setup

Requires Node 20+. All services have free plans with no card required.

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
```

| Variable | Get it from | Needed for |
|---|---|---|
| `GEMINI_API_KEY` | aistudio.google.com/apikey (free tier) | Live generation (primary LLM; Flash-Lite models) |
| `GROQ_API_KEY` | console.groq.com | Fallback LLM (optional; only about 8k tokens/min, so guides are thinner) |
| `MISTRAL_API_KEY` | console.mistral.ai | Optional. Accounts on Mistral's Free plan can't use API keys (as of Nov 2026) |
| `TAVILY_API_KEY` | tavily.com (1,000 free credits/month) | Live generation (search) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash, or Vercel Marketplace → Upstash | Storing generated guides in production (locally it falls back to `data/generated/`) |

Library guides work with no keys at all.

**Deploy:** push to GitHub → import in Vercel (Hobby) → add Upstash Redis from the Vercel Marketplace → add the API keys as environment variables.

## Repo map

```
data/guides/*.json          library guides (same schema as live guides)
data/composio-directory.json  402 OAuth apps from Composio's managed-auth page
research/                   guide schema, per-app research notes, MCP sweep results
scripts/                    directory builder, MCP DCR sweep
src/lib/agent.ts            live research agent
src/lib/verify.ts           deterministic quote verification
src/app/                    pages: library, guide, live generation, /method
```

## Limitations

- Live guides depend on what search returns in about a minute. They are lighter than library guides and can miss gated or JavaScript-rendered docs.
- The quote check proves a quote exists on the cited page, not that the model interpreted it correctly.
- Free-tier rate limits cap how many fresh guides can be generated per hour and per day.
- Provider policies change. Guides show their check date, and live guides can be regenerated.

## Path to 100 guides

The library format is the same JSON that the live agent emits. Scaling up means running the deeper research agent over the 275 bring-your-own apps, then reviewing the guides with the most Unverified claims. The MCP finding suggests about 40% of that list could be largely automated.
