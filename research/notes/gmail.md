# Gmail research log (2026-11-05)

Output: `data/guides/gmail.json`. Session was interrupted once mid-research and resumed; no data lost (pages cached in scratchpad).

## What I checked

1. **Composio side**
   - `docs.composio.dev/toolkits/gmail.md` (fetched raw markdown): managed OAuth = Yes, version `20261103_00`, 63 tools, 2 triggers. FAQ covers "App is blocked", Gmail API not enabled, invalid_scope, consent shows "Composio", 401s, quota sharing, `gmail.settings.basic`, `gmail.metadata` incompatibility. **No default scope list anywhere on the page** (grep for `googleapis.com/auth` only hits settings.basic / metadata).
   - `docs/authentication/custom-app-vs-managed-app.md`: reasons for own app = consent branding, custom scopes, dedicated quota, faster polling (managed has 2-min minimum), custom instances.
   - `docs/authentication/white-labeling-authentication.md`: register v3 callback and set `oauth_redirect_uri` explicitly; legacy `/api/v1/auth-apps/add` still supported; **optional own-domain callback forwarder** (302 to Composio callback preserving query); "A 302 forwarder does not hide Composio"; forwarder sees `code`/`state`.
   - `docs/authentication/controlling-scopes.md`: `recommend_scopes`, `required_scopes`; scopes override possible on managed auth (generic doc).
   - KB `toolkits-gmail.md`: example scopes gmail.send/readonly/compose/modify/labels; "gmail.send ... granular sensitive scope and requires Google verification".
   - KB `platform-google-oauth.md`: unapproved scope can block consent; forwarder still redirects to Composio.
   - `composio.dev/auth/googleapps` (baseline guide): uses legacy v1 redirect; wizard only; "may need to submit the app for Google verification"; no Branding/Data Access/Verification Center, CASA, timelines.
   - Composio blog "How to Ship a Gmail Integration in 30 Minutes" (Shrijal, Sep 30 2026): author observed managed connection granted `https://mail.google.com/` + basic profile/email; "Not with managed auth. The scopes are fixed."; CASA "few hundred to a few thousand dollars a year" (third-party estimates). Treated as secondary.

2. **Google primary sources**
   - Gmail scopes page (last updated 2026-09-10): non-sensitive gmail.labels; sensitive gmail.send; restricted mail.google.com, readonly, compose, insert, modify, metadata, settings.basic, settings.sharing. "If you store restricted scope data on servers (or transmit), then you must go through a security assessment."
   - Manage App Audience (support 15549945): Testing ≤100 test users; test-user authorizations + refresh tokens expire 7 days after consent (exception only for openid/email/profile); lifetime 100-new-user cap, cannot be reset; Internal → org_internal for outsiders; restricted Gmail scopes may need Workspace admin config for internal apps.
   - Manage OAuth App Branding (support 15549049): all domains incl. client config must be pre-registered as Authorized domains; homepage on verified domain you own; links required for external production apps; "Without verification, only your application domain will be visible to users."; Verify Branding → Ready to publish → publish within 7 days.
   - Brand verification page: automated check "a few minutes", manual "2-3 business days"; **Authorized domains must include redirect URI domains; verify ownership of authorized domains in Search Console.**
   - Restricted scope verification page: "can potentially take several weeks"; brand step first; CASA via App Defense Alliance; reverify + assessment at least every 12 months after LOA; video = YouTube Unlisted, English, show client ID in address bar; task automation platforms must show workflows and data flow directions; privacy policy same domain + Limited Use.
   - OAuth2 overview: 100 refresh tokens per Google Account per client ID.
   - API Services User Data Policy + **Workspace user data and developer policy (updated 2026-09-03)**: approved Gmail use cases include "providing generative AI summaries"; disallowed include one-time export, mobile keyboards; policy now covers "MCPs" and says to "granularly require users to confirm the MCP, tool, skill, or other agentic behavior invocation"; no training of generalized AI/ML models; Limited Use statement wording.
   - Google Health API app-verification page: CASA "2-3 weeks for tier-2 ... 4-6 weeks for tier-3", fees "$500 to $4,500 USD"; "Trust and Safety will tell the developer when to start the CASA process." (Only Google page with numbers; not Gmail-specific.)

3. **CASA (appdefensealliance.dev)**
   - Tier 2 overview: "The CASA self scanning process is deprecated" — usable only as readiness check; Tier 2 = dev scans, authorized assessor validates, Letter of Validation.
   - Authorized labs page lists program but no prices. `casa-faq`, `casa-tiers` URLs 404'd/errored (dead ends).

4. **Authorized-domain nuance (composio.dev callback)**
   - Google requires the redirect URI's domain in Authorized domains and ownership verification of authorized domains → developer can't verify composio.dev.
   - Secondary: Google dev forum (Aug 2026) Supabase case — unverified consent screen showed redirect host as app name; automated branding rejection "app name ... does not match the app name on your home page". Supabase GitHub discussion: some passed after removing supabase.co from authorized domains or explaining; Auth0 threads say custom domain needed. Serverpod docs: production redirect URIs rejected until root domain added to Authorized domains.
   - Resolution in guide: use Composio's documented forwarder on your own domain. Marked the "does Google actually reject composio.dev" question as open.

## Raw probe outputs

```
$ curl -s -i -m 20 "https://accounts.google.com/o/oauth2/v2/auth?client_id=invalid&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly&redirect_uri=https://backend.composio.dev/api/v3/toolkits/auth/callback"
HTTP/1.1 302 Moved Temporarily
Location: https://accounts.google.com/signin/oauth/error?authError=Cg5pbnZhbGlkX2NsaWVudBIfVGhlIE9BdXRoIGNsaWVudCB3YXMgbm90IGZvdW5kLiCRAw&flowName=GeneralOAuthFlow&client_id=invalid&...
Server: GSE

$ echo Cg5pbnZhbGlkX2NsaWVudBIfVGhlIE9BdXRoIGNsaWVudCB3YXMgbm90IGZvdW5kLiCRAw== | base64 -d
\n\x0e invalid_client \x12\x1f The OAuth client was not found. \x20 \x91\x03   (varint 0x91 0x03 = 401)

$ curl -L ... (same URL)  -> final 200, page text contains:
Access blocked: Authorization Error
Error 401: invalid_client
The OAuth client was not found
```
Client ID is validated before redirect URI, so redirect_uri_mismatch could not be probed without a real client (not created, per rules).

```
$ curl -s https://backend.composio.dev/api/v3/toolkits/gmail
{"error":{"message":"No authentication provided","code":906,"slug":"Auth_NoAuthProvided","status":401,...}}   HTTP 401
$ curl -s https://backend.composio.dev/api/v3.1/toolkits/gmail   -> same 401
$ curl -s https://docs.composio.dev/toolkits/gmail.md   -> 200, 112 KB, managed OAuth Yes, Version 20261103_00
$ curl -s https://composio.dev/toolkits/gmail   -> 200, no scope strings in HTML
```

## Dead ends
- Composio default Gmail scopes: not in docs, llms.txt, KB, marketing page; API requires key. Only evidence is the Composio blog author's observation (mail.google.com + profile/email).
- Google OAuth help pages don't give restricted-review durations beyond "several weeks"; Gmail pages give no CASA cost. Used Google Health page for numbers and flagged it.
- appdefensealliance.dev FAQ/tier pages returned errors; no official lab price list.
- No official Google statement on third-party callback domains in Authorized domains.

## Corrections logged
v1 legacy redirect in Composio guide; "may need verification" understated for Gmail; Google Auth Platform's Branding/Data Access/Verification Center split not covered; brand verification now automated minutes (2–3 days only manual); CASA self-scan deprecated; 100-user cap is lifetime; gmail.compose is restricted (not like gmail.send); Composio FAQ "~50 refresh tokens per account" vs Google's 100 per account per client.
