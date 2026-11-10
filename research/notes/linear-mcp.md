# Linear MCP — research log (2026-11-05)

Read-only run: GET probes only. No POST to /register, no login, no account creation, no credentials written.

## Probes (curl -s -m 20 -i, GET)

1. `GET https://mcp.linear.app/.well-known/oauth-authorization-server` → 200
   ```
   {"issuer":"https://mcp.linear.app","authorization_endpoint":"https://mcp.linear.app/authorize","token_endpoint":"https://mcp.linear.app/token","registration_endpoint":"https://mcp.linear.app/register","scopes_supported":["read","write","openid","email"],"response_types_supported":["code"],"response_modes_supported":["query"],"grant_types_supported":["authorization_code","refresh_token","urn:ietf:params:oauth:grant-type:jwt-bearer"],"authorization_grant_profiles_supported":["urn:ietf:params:oauth:grant-profile:id-jag"],"token_endpoint_auth_methods_supported":["client_secret_basic","client_secret_post","none"],"revocation_endpoint":"https://mcp.linear.app/token","code_challenge_methods_supported":["S256"],"authorization_response_iss_parameter_supported":true,"client_id_metadata_document_supported":true,"resource":"https://mcp.linear.app/mcp","resource_metadata":"https://mcp.linear.app/.well-known/oauth-protected-resource/mcp"}
   ```
2. `GET /.well-known/openid-configuration` → 200, same plus `jwks_uri` https://mcp.linear.app/.well-known/jwks.json (RS256, kid `mcp-prod-1`), claims sub/iss/aud/exp/iat/email/email_verified.
3. `GET /.well-known/oauth-protected-resource/mcp` → 200
   `{"resource":"https://mcp.linear.app/mcp","authorization_servers":["https://mcp.linear.app"],"scopes_supported":["read","write"],"bearer_methods_supported":["header"]}`
   `GET /.well-known/oauth-protected-resource` (root) → 200, resource `https://mcp.linear.app`, same otherwise.
   `GET /.well-known/oauth-protected-resource/mcp/readonly` → 200, scopes_supported `["read"]`.
4. `GET https://mcp.linear.app/mcp` (no token) → 401
   `WWW-Authenticate: Bearer realm="OAuth", resource_metadata="https://mcp.linear.app/.well-known/oauth-protected-resource/mcp", scope="read write"`
   `GET /mcp/readonly` → 401, resource_metadata points at `/mcp/readonly` PRM (header still says scope="read write").
5. `GET https://mcp.linear.app/sse` → 404 `404 Not Found` (also with `Accept: text/event-stream`). Docs still call /sse a "deprecated fallback". Possibly removed, or only answers authenticated clients — not resolved.
6. `GET https://mcp.linear.app/register` → 405 `{"error":"invalid_request","error_description":"Method not allowed"}`. Route exists; POST deliberately not sent.
7. `GET /authorize?client_id=invalid&response_type=code&redirect_uri=https://backend.composio.dev/api/v3/toolkits/auth/callback` → 400 `Invalid client_id` (text/plain). No login page reached.
8. `GET /authorize` (no params) → 400 `client_id is required`.
9. `GET /authorize?client_id=https%3A%2F%2Fexample.com%2Fclient-metadata.json&...&code_challenge_method=S256` → 400 `CIMD fetch failed for https://example.com/client-metadata.json: Failed to fetch client metadata: HTTP 404`. So CIMD is live: Linear fetches URL client_ids.
10. `GET https://mcp.linear.app/` → 302 to https://linear.app/docs/mcp.
11. `GET https://backend.composio.dev/api/v3.1/toolkits/linear_mcp` (and v3) → 401 `Auth_NoAuthProvided`. Need an API key to read `composio_managed_auth_schemes`.

## Sources read

- linear.app/docs/mcp (raw HTML + markdown). Key lines: "The interactive setup flow uses OAuth 2.1 with dynamic client registration."; read-only via `read` scope or `/mcp/readonly`; bearer token / API key accepted ("integrate with an existing Linear OAuth application without an extra authentication hop"); one auth context per workspace; /sse deprecated; enterprise-managed auth via Okta; Claude auto-connect (beta, Business/Enterprise, Workspace settings → Security → "Claude-issued authentication for MCP"). No mention of review, approval or rate limits for MCP clients.
- linear.app/docs/third-party-application-approvals: paid plans; admins (owners on Enterprise) toggle in Settings > Administration > Security; members get a request-approval screen. Does not mention MCP/DCR.
- linear.app/developers/oauth-2-0-authentication(.md): app creation at linear.app/settings/api/applications/new; scopes read/write/issues:create/comments:create/timeSchedule:write/admin; actor=user|app; PKCE plain|S256; "All OAuth2 applications were migrated to the new refresh token system on April 1, 2026."; example `expires_in: 86399`; refresh rotation with 30-minute grace; client_credentials tokens (app actor, 30 days, must be toggled on).
- linear.app/developers/oauth-app-manifests: `distribution` private|public, default private.
- linear.app/developers/agents: actor=app install needs admin; actor=app cannot request admin scope.
- linear.app/developers/integration-directory: listing is curated ("built by formal companies"), optional.
- linear.app/developers/rate-limiting: OAuth app 5,000/hr per user; API key 2,500/hr; unauthenticated 600/hr per IP.
- MCP spec 2025-11-25 authorization (.md): CIMD SHOULD, DCR MAY ("included for backwards compatibility"); priority pre-registered > CIMD > DCR; redirect URIs must be localhost or HTTPS; RFC 8707 `resource` param required.
- RFC 7591 (txt): POST JSON to registration endpoint; default token_endpoint_auth_method client_secret_basic; 201 response; client_secret_expires_at.
- Composio: toolkits/linear_mcp.md ("Auth: DCR_OAUTH", managed "No", 78 tools, 0 triggers, version 20261018_00); toolkits/linear.md (OAUTH2, API_KEY; managed "Yes"; 48 tools, 12 triggers); toolkits/managed-auth.md (Linear MCP in BYO list; rule "register your own OAuth app and supply its client ID and client secret"); llms-full.txt Custom MCP section (DCR_OAUTH with discovery_url — Composio performs DCR; "OAuth works only through Dynamic Client Registration (DCR)... CIMD... aren't supported"; DCR grants usually not revoked server-side); SDK reference lists "Composio-managed OAuth (OAuth1, OAuth2, DCR_OAUTH)"; custom-app-vs-managed-app.md.

## Conclusions / interpretation

- No human portal work on Linear's side. Registration = one POST (DCR) or a hosted metadata URL (CIMD).
- Composio's "bring your own" label for Linear MCP looks like a side-effect of the directory rule (DCR_OAUTH not in composio_managed_auth_schemes), not a requirement to create a portal app. Strong signal that Composio does DCR itself (Custom MCP docs, DCR_OAUTH treated as a Composio-managed scheme in SDK docs), but not confirmed for the built-in LINEAR_MCP auth config. Marked uncertain.
- Human steps: Linear user consent per workspace; possibly admin approval in paid workspaces with third-party approvals on (unconfirmed for MCP clients).

## Dead ends

- Composio docs have no Linear-MCP-specific setup page, no changelog entry on DCR, nothing in the KB.
- Composio toolkit API needs a key (401).
- Grep with long regexes on the 750 KB Linear HTML hung (backgrounded, stopped); switched to the `.md` variants Linear serves (`<url>.md`).
- MCP-issued token lifetimes and MCP rate limits: not documented anywhere found.

## Pending (needs user approval)

- Live `POST https://mcp.linear.app/register` with redirect_uris = Composio v3 callback and token_endpoint_auth_method client_secret_post, to confirm 201 + client_secret.
- Opening the Composio dashboard Linear MCP auth config form (or the toolkit API with a key).
