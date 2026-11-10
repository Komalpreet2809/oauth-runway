# Slack research log (2026-11-05)

Guide: `data/guides/slack.json`. All probes were read-only or used deliberately invalid input. We created no accounts, logged in nowhere, and stored no credentials.

## What I checked
1. **Non-Marketplace rate limits.** Sources: the live changelog, its `.md` export, the Japanese translation, the related changelog entries, and Wayback Machine history.
2. **Distribution and app creation.** Sources: the distribution guide, the app manifests guide, the manifest reference, apps.manifest.create, installing-with-oauth, oauth.v2.access errors, and token rotation.
3. **Marketplace.** Sources: the review guide, the guidelines, and the July 2025, September 2026 and November 2026 changelog entries on install thresholds.
4. **AI surfaces.** Sources: the Real-time Search API page and the Slack MCP server page. Both are limited to Marketplace and internal apps.
5. **Workspace blockers.** Sources: the app approvals page (docs plus help center), organization-ready apps, and the auto-uninstall rules.
6. **Composio's existing guides.** Sources: composio.dev/auth/slack (managed) and composio.dev/auth/slack_custom (BYO), the Composio KB Slack page, and the managed-auth list.

## Key findings
- **Throttle.** On May 29, 2025, Slack moved `conversations.history` and `conversations.replies` from Tier 3 to Tier 1 for commercially distributed apps that are not in the Marketplace: **1 request per minute and at most 15 objects per call**, with the `limit` default and maximum both 15. It applies immediately to new unlisted apps and to new installs of existing ones. Marketplace apps and internal customer-built apps are exempt and keep 50+ requests per minute and 1,000 objects per call.
- **Existing-installs date history (from Wayback):**
  - 2025-05-30 (api.slack.com FAQ): "Beginning September 2, 2025, existing installations and apps that are not Marketplace-approved will be subject to the new posted limits."
  - 2025-06-21: added "(excluding internal customer-built apps created before May 29th, 2025)".
  - 2025-09-10 → 2026-02-12 (docs.slack.dev): "~~September 2, 2025~~ March 3, 2026".
  - 2026-03-10 → live: "The new rate limits will not be applied to existing installations of unlisted, distributed applications published outside the Marketplace."
  - Secondary sources (dev.to, the zeroclaw GitHub issue, and web-search summaries) still claim March 3, 2026 enforcement. That claim is outdated.
- **Docs disagree.** The method reference pages for conversations.history still show "Tier 3: 50+ per minute" and a limit of "Maximum of 999". The rate-limits page doesn't mention the non-Marketplace change at all.
- **Marketplace entry bar.**
  - Before July 2025 the minimum was 10 active workspaces. From August 11, 2025 it was lowered to 5. As of July 2026 it is back to 10, and the app must stay at 10 or more for the whole review (changelog dated September 1, 2026).
  - Since November 2, 2026, a submission with fewer than 10 active workspaces **and** fewer than 20 monthly active users is not reviewed, and the developer can't resubmit for 30 days.
  - Review times: the preliminary review takes up to 10 business days, and the queue resets on each resubmission. The functional review takes up to 10 weeks for new apps and 6 weeks for updates.
  - A demo video and test credentials are required. Reviewers can't use the developer's test Slack workspace.
- **Unsuitable for the Marketplace (selected):** apps that provide only an MCP server without meaningful in-Slack functionality, apps with no functionality in Slack, apps that train LLMs on Slack data, and apps that use the restricted scopes `admin.*`, `identity.*`, `search:read`, `workflow.steps:execute` or `triggers:*`.
- **Terms of Service (May 29, 2025).** The Marketplace is "the only appropriate channel" for commercial distribution, whether the app is unlisted or a "templatized one-off custom app". Asking each customer to create their own app to dodge the throttle is therefore a ToS risk.
- **RTS API and MCP server.** Only directory-published apps and internal apps can use them. The MCP server supports no DCR and no SSE.
- **App creation by API.** `apps.manifest.create` needs a config token. A person generates it under "Your App Configuration Tokens", it lasts 12 hours, and generating it installs the "Slack Tooling Tokens Vendor" app in the workspace. The response returns client_id, client_secret, verification_token, signing_secret and oauth_authorize_url.
- **Manifest features.** New fields: `bot_optional` and `user_optional` (optional scopes, March 2026), `pkce_enabled` (PKCE GA in March 2026, and enabling it is one-way), and `is_mcp_enabled`. Up to 1,000 redirect URLs are allowed. If `long_description` is set it must be at least 174 characters.
- **Redirect rule.** The `redirect_uri` must match the configured Redirect URL or be a subdirectory of it, must use HTTPS, and can't contain `#`. If the values differ between the authorize and token steps, the token exchange fails with `bad_redirect_uri`.
- **Distribution.** Steps: Manage Distribution → complete the checklist → Activate Public Distribution. Slack's docs list no review step. Deactivating distribution uninstalls the app from every workspace except the home one.

## Raw probe outputs (2026-11-05, run from India via `curl -s -m 20`)
```
GET https://slack.com/oauth/v2/authorize?client_id=invalid&scope=channels:read
-> HTTP/1.1 200 OK, text/html 5099 bytes; JS: window.location.href = ".../oauth/v2/authorize?client_id=invalid&scope=channels:read&tracked=1"
GET same + &tracked=1 (with cookie jar)
-> HTTP/1.1 302 Found, location: https://slack.com/workspace-signin?redir=%2Foauth%3Fclient_id%3Dinvalid%26scope%3Dchannels%253Aread%26user_scope%3D%26redirect_uri%3D%26state%3D%26granular_bot_scope%3D1...
   (client_id not validated before sign-in)

GET https://slack.com/.well-known/openid-configuration -> 200
{"issuer":"https://slack.com","authorization_endpoint":"https://slack.com/openid/connect/authorize","token_endpoint":"https://slack.com/api/openid.connect.token","userinfo_endpoint":"https://slack.com/api/openid.connect.userInfo","jwks_uri":"https://slack.com/openid/connect/keys","scopes_supported":["openid","profile","email"],...,"token_endpoint_auth_methods_supported":["client_secret_post","client_secret_basic"]}
  (no registration_endpoint)

GET https://slack.com/.well-known/oauth-authorization-server -> 404

GET https://mcp.slack.com/.well-known/oauth-authorization-server -> 200
{"issuer":"https://mcp.slack.com","authorization_endpoint":"https://slack.com/oauth/v2_user/authorize","token_endpoint":"https://slack.com/api/oauth.v2.user.access","grant_types_supported":["authorization_code","refresh_token","urn:ietf:params:oauth:grant-type:jwt-bearer"],"token_endpoint_auth_methods_supported":["client_secret_post"],"code_challenge_methods_supported":["S256"],...}
GET https://mcp.slack.com/.well-known/oauth-protected-resource -> 200 {"resource":"https://mcp.slack.com","authorization_servers":["https://mcp.slack.com"],...}

GET https://slack.com/openid/connect/authorize?response_type=code&client_id=invalid&scope=openid&redirect_uri=https://example.com/cb
-> 404, <title>There's been a glitch… | Slack</title> (Error404)
GET https://slack.com/oauth/v2_user/authorize?client_id=invalid&scope=search:read.public
-> 200 JS interstitial -> &tracked=1 (same pattern as v2/authorize)

POST https://slack.com/api/oauth.v2.access client_id=invalid&client_secret=invalid&code=invalid&redirect_uri=<v3 callback>
-> 200 {"ok":false,"error":"invalid_code"}
POST https://slack.com/api/oauth.v2.access (no params) -> 200 {"ok":false,"error":"invalid_code"}
POST https://slack.com/api/apps.manifest.validate (no token) -> 200 {"ok":false,"error":"not_authed"}
POST https://slack.com/api/tooling.tokens.rotate refresh_token=invalid -> 200 {"ok":false,"error":"invalid_refresh_token"}
GET https://slack.com/api/auth.test (no token) -> 200 {"ok":false,"error":"not_authed"}
GET https://slack.com/api/api.test -> 200 {"ok":true,"args":{}}

GET https://backend.composio.dev/api/v3/toolkits/auth/callback -> 302 -> https://apollo.composio.dev/api/v3/toolkits/auth/callback (cloudflare)
GET https://api.slack.com/changelog/2025-05-terms-rate-limit-update-and-faq -> 302 -> docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps

Wayback CDX for docs.slack.dev changelog: snapshots 20250721 ... 20261015 (digest changes at 20250910, 20260310 among others).
Wayback CDX for api.slack.com FAQ: 20250530 ... 20250726, then 302 from 20260715.
```

## Composio's existing guides: gaps found
- `/auth/slack` (managed): it works as written, but it doesn't say whether the managed app is in the Marketplace or which rate limits it gets.
- `/auth/slack_custom`:
  - It says "Choose from scratch" (a manifest would be faster) and uses the v1 redirect `https://backend.composio.dev/api/v1/auth-apps/add`.
  - It asks for the Verification Token, which Slack has deprecated in favor of the Signing Secret.
  - It doesn't mention Activate Public Distribution, the non-Marketplace throttle, token rotation, admin approval or Enterprise installs.
  - Its scope list begins `calls:read,calls:write,channels:read,channels:history,channels:write,chat:write,chat:write.public,emoji:read,...`. I couldn't extract the full list from the HTML.
- Composio KB says a customer's own app with "Agents & AI Apps" unblocks `assistant.search.context`. Slack's RTS docs say unlisted distributed apps aren't eligible, so this holds only for internal apps.

## Dead ends / not verified
- I found no Composio listing on the Slack Marketplace through search. That doesn't prove it isn't listed, so this is an open question.
- The Activate Public Distribution checklist item names come only from secondary sources (Nango, Trailhead), because the checklist sits behind login.
- The `invalid_team_for_non_distributed_app` error code comes only from Nango. It isn't listed in the oauth.v2.access errors I grepped.
- The help center app-approval quote came through WebFetch extraction, not a raw page dump.
- One tool call was interrupted by the session abort and re-run afterwards with no side effects.
- I didn't test the manifest with `apps.manifest.validate`, because that needs a config token.
- Whether the home-workspace install keeps internal limits after distribution is activated is inferred and untested.
