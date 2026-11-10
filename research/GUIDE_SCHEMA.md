# Guide schema (v1)

Every guide is one JSON file: `data/guides/<slug>.json`. Library guides (researched ahead of time) and live guides (generated on demand) use the same shape, so the UI renders both the same way.

## Design intent

A developer opening a guide should be able to answer, in this order:

1. **Do I even need my own OAuth app?** (Composio may already provide a managed one.)
2. **How hard is this, and how long until (a) I can test it and (b) any user can connect?** Those are two different clocks; the second one is usually dominated by provider review.
3. **What exactly do I do, in what order, and who does each step** — an agent, me, or am I waiting on the provider?
4. **What do I need before I start** (accounts, domain, privacy policy, demo video, business verification, fees)?
5. **What is limited until approval**, and what can block me?
6. **How much should I trust each statement?** Every item carries evidence.

## Evidence levels (on every claim-bearing item)

| level | meaning |
|---|---|
| `tested` | We observed it directly: an HTTP probe, a discovery document, an error page, a registration attempt. Record what was run and what came back. |
| `sourced` | Stated by a primary source (the provider's own docs, policy, or changelog). Include the URL and a short verbatim quote. Secondary sources (blogs, forums) are allowed only if marked so, and should push toward `uncertain` when they are the only support. |
| `uncertain` | Inferred, reported only by secondary sources, conflicting, or likely to change. Say why in `note`. |

Never present `uncertain` information as fact. Prefer an honest range (`"2–6 weeks"`) plus a note over a falsely precise number.

## JSON shape

```jsonc
{
  "schemaVersion": 1,
  "slug": "gmail",
  "app": {
    "name": "Gmail",
    "provider": "Google",
    "website": "https://mail.google.com",
    "developerPortal": "https://console.cloud.google.com/auth/overview",
    "category": "Email",
    "composio": {
      "toolkit": "gmail",
      "managedOAuthAvailable": true,           // from https://docs.composio.dev/toolkits/managed-auth
      "whenYouNeedYourOwnApp": "Only for your own branding on the consent screen, custom scopes, or dedicated quota."
    }
  },
  "meta": {
    "generatedAt": "2026-11-05",
    "generatedBy": "library-research-agent",   // or "live-agent"
    "lastVerifiedAt": "2026-11-05"
  },

  "summary": {
    "verdict": "Plain-English bottom line in 1–2 sentences.",
    "difficulty": "easy",                      // "easy" | "moderate" | "hard" | "very_hard"
    "difficultyReason": "Why, in one sentence.",
    "timeToFirstConnection": { "label": "10–20 min", "note": "You connecting your own account in a test/dev mode." },
    "timeToProduction": { "label": "4–8 weeks", "note": "Until any user can connect without warnings or caps." },
    "handsOnEffort": "About 1 hour of setup + 1–2 days preparing review materials.",
    "approvalWait": "Provider review typically N–M weeks; none if X.",
    "costs": "Free, unless … (e.g. security assessment fee).",
    "evidence": { "level": "sourced", "sources": [{ "url": "...", "quote": "..." }], "note": "" }
  },

  "stages": [
    {
      "id": "create-app",
      "title": "Create the OAuth app",
      "phase": "setup",                         // "setup" | "test" | "review" | "launch"
      "owner": "you",                           // "agent" | "you" | "provider"  (provider = waiting on them)
      "estimate": "10 min",
      "steps": [
        "Concrete, imperative, specific step with exact UI names / URLs.",
        "Set the redirect URI to https://backend.composio.dev/api/v3/toolkits/auth/callback"
      ],
      "agentHelp": "What an agent can do for this stage (e.g. generate a manifest, pre-fill text, run a probe) — or null.",
      "evidence": { "level": "sourced", "sources": [{ "url": "...", "quote": "..." }] }
    }
  ],

  "requirements": [
    { "item": "Verified domain you own", "neededFor": "production", "evidence": { "level": "sourced", "sources": [] } }
    // neededFor: "setup" | "testing" | "production"
  ],

  "limitsBeforeApproval": [
    { "limit": "Max 100 test users; refresh tokens expire after 7 days in Testing mode.", "evidence": { ... } }
  ],

  "blockers": [
    {
      "title": "Short name of the blocker",
      "symptom": "What the developer sees (error text, rejection reason).",
      "whatToDo": "Concrete workaround or next action.",
      "evidence": { ... }
    }
  ],

  "nuances": [
    { "text": "Something that surprises people and changes decisions (rate limits for unreviewed apps, per-org approval, one callback URL per app, etc.)", "evidence": { ... } }
  ],

  "agentVsYou": {
    "agentCan": ["Things an agent can actually do (probe endpoints, register via DCR, draft scope justifications, generate manifests)."],
    "youMust": ["Things only a human/legal entity can do (accept ToS, verify domain, pay, record a demo video, sign agreements)."]
  },

  "composioSetup": {
    "redirectUri": "https://backend.composio.dev/api/v3/toolkits/auth/callback",
    "steps": ["Dashboard → Auth Configs → Create Auth Config → <toolkit> → OAuth2 → Use your own developer credentials → paste Client ID/Secret."],
    "notes": "Toolkit-specific notes, e.g. scopes Composio requests by default if known."
  },

  "probes": [
    {
      "name": "OAuth discovery document",
      "request": "GET https://example.com/.well-known/oauth-authorization-server",
      "result": "200 — registration_endpoint present (supports Dynamic Client Registration)",
      "status": "pass",                          // "pass" | "fail" | "info"
      "checkedAt": "2026-11-05"
    }
  ],

  "corrections": [
    {
      "claim": "What a common/secondary source (or an existing guide) says.",
      "finding": "What primary sources / tests actually show.",
      "source": "https://..."
    }
  ],

  "openQuestions": ["What we could not verify and how someone could find out."],

  "sources": [
    { "url": "https://...", "title": "Page title", "type": "official" }   // "official" | "secondary" | "probe"
  ]
}
```

## Writing rules

- Write for a developer who has never done this before, and who will share the page with a teammate. No marketing language.
- Steps are imperative and specific: exact menu names, URLs, field values.
- Use the Composio redirect URI `https://backend.composio.dev/api/v3/toolkits/auth/callback` (Composio's docs say the older `https://backend.composio.dev/api/v1/auth-apps/add` is still supported; whichever is used must match exactly in both places).
- Every stage, requirement, limit, blocker, and nuance has an `evidence` object. Quotes are short (≤ 30 words) and verbatim.
- Two clocks always: `timeToFirstConnection` (you, testing) and `timeToProduction` (anyone, no caps/warnings).
- Separate *active effort* (`handsOnEffort`) from *waiting* (`approvalWait`).
- If a step is only needed for a marketplace/app-store listing (not for OAuth to work for other users), say so explicitly — many developers think they need a listing when they don't.
