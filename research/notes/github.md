# GitHub research log (2026-11-05)

Agent: library-research-agent. Output: `data/guides/github.json`. No login, no forms submitted, no credentials written.

## Method
- Primary source: GitHub docs fetched as raw markdown via `https://docs.github.com/api/article/body?pathname=<path>`. This works without auth and avoids summarizer paraphrase, so quotes in the guide are verbatim from these files.
- Composio docs via WebFetch. WebFetch refused verbatim reproduction of composio.dev/auth/github, so that page is paraphrased in the guide (no quotes from it).
- Probes: `curl -s -m 20`, read-only.

## Probe outputs (raw, trimmed headers)
```
GET https://github.com/login/oauth/authorize?client_id=invalid_client_id_test
HTTP/1.1 302 Found
Location: https://github.com/login?client_id=invalid_client_id_test&return_to=%2Flogin%2Foauth%2Fauthorize%3Fclient_id%3Dinvalid_client_id_test
-> client_id is not validated before login; can't detect a bad client_id unauthenticated.

POST https://github.com/login/oauth/access_token -d client_id=x  (Accept: application/json)
HTTP/1.1 404 Not Found
{"error":"Not Found"}
(no Accept header -> text/plain "Not Found")

POST https://github.com/login/oauth/access_token -d client_id=Iv1.0000000000000000 -d client_secret=bogus -d code=bogus
HTTP/1.1 404 Not Found
{"error":"Not Found"}

POST https://github.com/login/device/code -d client_id=invalid_client_id_test -d scope=repo
HTTP/1.1 404 Not Found
{"error":"Not Found"}

GET https://github.com/.well-known/openid-configuration            -> 404 text/plain
GET https://github.com/.well-known/oauth-authorization-server      -> 404 text/plain
GET https://github.com/login/oauth/.well-known/oauth-authorization-server -> 404
GET https://github.com/.well-known/openid-configuration/login/oauth -> 404

GET https://github.com/login/oauth/.well-known/openid-configuration -> 200
{"issuer":"https://github.com/login/oauth","jwks_uri":"https://github.com/login/oauth/.well-known/jwks",
 "subject_types_supported":["public"],"response_types_supported":["code"],
 "claims_supported":["sub","aud","exp","nbf","iat","iss","act"],"id_token_signing_alg_values_supported":["RS256"],
 "scopes_supported":["openid","offline_access"],"authorization_endpoint":"https://github.com/login/oauth/authorize",
 "token_endpoint":"https://github.com/login/oauth/access_token","response_modes_supported":["query"],
 "grant_types_supported":["authorization_code","refresh_token","urn:ietf:params:oauth:grant-type:device_code"],
 "device_authorization_endpoint":"https://github.com/login/device/code",
 "service_documentation":"https://docs.github.com/apps/creating-github-apps/registering-a-github-app/registering-a-github-app"}

GET https://github.com/.well-known/oauth-authorization-server/login/oauth -> 200
{"issuer":"https://github.com/login/oauth","authorization_endpoint":"https://github.com/login/oauth/authorize",
 "token_endpoint":"https://github.com/login/oauth/access_token","response_types_supported":["code"],
 "grant_types_supported":["authorization_code","refresh_token","urn:ietf:params:oauth:grant-type:device_code"],
 "code_challenge_methods_supported":["S256"],"device_authorization_endpoint":"https://github.com/login/device/code",
 "authorization_response_iss_parameter_supported":true,"scopes_supported":["offline_access"], ...}
-> No registration_endpoint anywhere: no DCR.

GET https://github.com/login/oauth/.well-known/jwks -> 200, one RS256 key.

GET https://api.github.com/.well-known/oauth-protected-resource -> 404
GET https://api.githubcopilot.com/.well-known/oauth-protected-resource/mcp/ -> 200
{"resource":"https://api.githubcopilot.com/mcp/","authorization_servers":["https://github.com/login/oauth"],
 "scopes_supported":["repo","read:org","read:user","user:email","read:packages","write:packages","read:project","project","gist","notifications"], ...}

GET https://api.github.com/rate_limit (unauth) -> 200, X-RateLimit-Limit: 60 (core), search 10, graphql 0.

POST https://api.github.com/app-manifests/bogus_code_test/conversions (no auth)
HTTP/1.1 404 {"message":"Not Found","documentation_url":"https://docs.github.com/rest/apps/apps#create-a-github-app-from-a-manifest","status":"404"}
-> no 401: endpoint is callable without credentials, as documented.

GET https://backend.composio.dev/api/v3/toolkits/auth/callback -> 302 https://apollo.composio.dev/api/v3/toolkits/auth/callback
GET https://backend.composio.dev/api/v1/auth-apps/add           -> 302 https://apollo.composio.dev/api/v1/auth-apps/add
GET https://backend.composio.dev/api/v3/toolkits/github (no key) -> 401 {"error":{"message":"No authentication provided","code":906,...}}
```

## Key findings, with sources
- **Aug 2026 GitHub platform change** (changelog 2026-08-14 + docs): OAuth Apps now allow up to 10 callback URLs with per-URL wildcard matching. Apps with a single callback URL before Aug 3, 2026 keep wildcard on. New OAuth Apps have "Expire user access tokens" checked by default (8 h access / 6-month refresh). This invalidates the "one callback URL" belief, and Composio's guide never mentions token expiry.
- **Org OAuth app access restrictions** are enabled by default for new orgs (about-oauth-app-access-restrictions). Unapproved apps get no API access to org private resources and no privileged writes on public org resources. User request path: Settings → Applications → Authorized OAuth Apps → app → Request access. Owner approval path: Org Settings → Third-party Access → OAuth app policy → Review → Grant access.
- GitHub Apps are not subject to org application policies, but they need installation. User tokens reach only accounts where the app is installed, and a user can authorize without installing. A private app can only be installed on the owner account.
- SAML SSO: an active SSO session is required at authorization time; otherwise revoke and reauthorize.
- EMU: managed users can't install GitHub Apps on their user accounts unless the app is privileged.
- Rate limits: user tokens (OAuth App or GitHub App) count against the user's shared 5,000/hr. A GitHub App owned by a GHEC org gets 15,000/hr; an OAuth App owned or approved by a GHEC org gets 15,000 for members. Secondary limit: 2,000 OAuth token requests/hr per app. Installation tokens scale up to 12,500/hr (15,000 on GHEC).
- Token limits: 10 tokens per user/app/scope, and 10 tokens created per hour (beyond that, GitHub prompts the user to re-authorize).
- Tokens unused for 1 year are revoked, and tokens pushed to public repos are revoked.
- Scopes: `repo` is full read/write on all private repos plus some org resources. GitHub Apps ignore `scope` except `offline_access`.
- Manifest flow: POST a form to /settings/apps/new (or /organizations/ORG/settings/apps/new) with a `manifest` JSON (`url` required; also callback_urls ≤10, redirect_url, public, default_permissions, hook_attributes{url required, active}, request_oauth_on_install). The human names the app and clicks Create. Redirect brings `code`; POST /app-manifests/{code}/conversions within 1 h returns id, client_id, client_secret, pem, webhook_secret.
- No review: neither the OAuth App nor the GitHub App registration doc has a review or verification step. Marketplace is optional. Its rules (privacy policy, support link, pricing plan, webhook for plan events, logo/screenshots, value beyond authentication) apply only to listings, and paid listings need a verified publisher org.
- Composio: GitHub is in the managed list. The toolkit page says you can bring a GitHub App via its client ID/secret, but install is separate and the install link isn't automated ("Built-in installation-link handling is being worked on"). App permissions come from the app, not auth config scopes. Check runs need a GitHub App token. The white-labeling doc names the v3 callback and says some toolkit defaults use legacy v1. Programmatic: `composio.authConfigs.create(toolkit, {type:'use_custom_auth', authScheme:'OAUTH2', credentials:{client_id, client_secret, oauth_redirect_uri}})`.
- Composio guide (composio.dev/auth/github) baseline: OAuth App path, example scopes repo/user/gist/notifications/project/workflow/codespace, a v1 callback screenshot with a note to use the v3 URL, and a brief mention of the org "Request" button. It omits token expiry, SSO, EMU, GitHub App trade-offs, rate-limit specifics and redirect-mismatch troubleshooting.

## Sources read (raw markdown saved in scratchpad, not in repo)
creating-an-oauth-app; authorizing-oauth-apps (dev); differences-between-github-apps-and-oauth-apps; scopes-for-oauth-apps; troubleshooting-authorization-request-errors; using-oauth-apps/authorizing-oauth-apps (user); registering-a-github-app; about-the-user-authorization-callback-url; making-a-github-app-public-or-private; authenticating-with-a-github-app-on-behalf-of-a-user; refreshing-user-access-tokens; generating-a-user-access-token-for-a-github-app; registering-a-github-app-from-a-manifest; rest/apps/apps; about-oauth-app-access-restrictions; approving-oauth-apps-for-your-organization; requesting-organization-approval-for-oauth-apps; limiting-oauth-app-and-github-app-access-requests-and-installations; about-authentication-with-single-sign-on; saml-and-github-apps (GHEC); abilities-and-restrictions-of-managed-user-accounts (GHEC); rate-limits-for-the-rest-api; rate-limits-for-github-apps; token-expiration-and-revocation; requirements-for-listing-an-app; GitHub changelog 2026-08-14. Composio: toolkits/managed-auth, toolkits/github, docs/custom-app-vs-managed-app, docs/authentication/white-labeling-authentication, docs/auth-configuration/programmatic-auth-configs, composio.dev/auth/github.

## Dead ends / caveats
- `docs.composio.dev/docs/custom-app-vs-managed-app.md` returned 404. The HTML page worked.
- The Composio managed-auth polling interval differs between doc versions in search results (2 min on the live page vs 15 min in other versions), so the guide doesn't use it.
- Couldn't confirm that Composio refreshes GitHub tokens: the search summary said yes, but the fetched expiry-events page didn't state it. Marked uncertain.
- Couldn't read Composio's default GitHub scopes (API needs a key; the toolkit page is ~1.2 MB and the first 100k characters had none).
- Downloading `docs.composio.dev/toolkits/github.md` via curl was interrupted (the tool permission prompt closed), so it was not retried.
- Wildcard-matching default for newly created apps is not stated explicitly; the docs only imply it is off.
- The browser part of the manifest flow and real consent screens weren't exercised (that would need a login).
