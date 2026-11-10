// Live, read-only probes against a provider's OAuth infrastructure.
// These are the only things the live agent labels "tested": it actually
// observed the response. Everything is GET-only with short timeouts.

import type { Probe } from "./types";

const UA = "oauth-guide-agent/1.0 (+read-only discovery probe)";

/** Only allow public https hostnames — user input decides which hosts we hit. */
export function safeHost(host: string): string | null {
  const h = host.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#:]/)[0];
  if (!h || !h.includes(".")) return null;
  if (/^[\d.]+$/.test(h) || h.includes("[") || /^(localhost|.*\.local|.*\.internal|.*\.lan|metadata\..*)$/.test(h)) return null;
  if (!/^[a-z0-9.-]+$/.test(h)) return null;
  // Reserved placeholder domains (RFC 2606): a model inventing these means it found nothing real.
  if (/(^|\.)example\.(com|org|net)$|\.(example|test|invalid|localhost)$/.test(h)) return null;
  return h;
}

async function getJson(url: string, timeoutMs = 7000): Promise<{ status: number; json?: Record<string, unknown> }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  let json: Record<string, unknown> | undefined;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) json = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  else await res.body?.cancel().catch(() => {});
  return { status: res.status, json };
}

export interface ProbeSummary {
  probes: Probe[];
  dcr: { host: string; registrationEndpoint: string } | null;
  discoveredHosts: string[];
}

/**
 * Look for OAuth/OIDC discovery documents on candidate hosts. A
 * `registration_endpoint` means the provider supports Dynamic Client
 * Registration (RFC 7591): an agent can create the OAuth client itself.
 */
export async function probeOAuth(candidateHosts: string[], today: string): Promise<ProbeSummary> {
  const hosts = [...new Set(candidateHosts.map(safeHost).filter((h): h is string => !!h))].slice(0, 5);
  const paths = ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"];
  const tasks = hosts.flatMap((host) => paths.map((path) => ({ host, path })));

  const results = await Promise.all(
    tasks.map(async ({ host, path }) => {
      const url = `https://${host}${path}`;
      try {
        const { status, json } = await getJson(url);
        const isDoc = !!json && (typeof json.authorization_endpoint === "string" || typeof json.issuer === "string");
        return { host, path, url, status, json: isDoc ? json : undefined };
      } catch (e) {
        return { host, path, url, status: 0, error: e instanceof Error ? e.name : "error" };
      }
    }),
  );

  const probes: Probe[] = [];
  let dcr: ProbeSummary["dcr"] = null;
  const discoveredHosts: string[] = [];
  for (const host of hosts) {
    // One probe entry per host. Prefer a document that advertises registration.
    const docs = results.filter((r) => r.host === host && r.json);
    if (!docs.length) continue;
    const best = docs.find((r) => typeof r.json!.registration_endpoint === "string") ?? docs[0];
    const json = best.json!;
    const reg = typeof json.registration_endpoint === "string" ? (json.registration_endpoint as string) : null;
    const authz = String(json.authorization_endpoint ?? "?");
    const pkce = Array.isArray(json.code_challenge_methods_supported)
      ? ` PKCE: ${(json.code_challenge_methods_supported as string[]).join(", ")}.`
      : "";
    if (reg && !dcr) dcr = { host, registrationEndpoint: reg };
    discoveredHosts.push(host);
    probes.push({
      name: `OAuth discovery on ${host}`,
      request: `GET ${docs.map((d) => d.url).join(" , ")}`,
      result: `${best.status}: discovery document found. authorization_endpoint: ${authz}.${pkce} ${
        reg
          ? `registration_endpoint: ${reg} → supports Dynamic Client Registration (an agent can register the OAuth client itself).`
          : "No registration_endpoint → no Dynamic Client Registration, so the OAuth app must be created by hand in the provider's developer portal."
      }`,
      status: "pass",
      checkedAt: today,
    });
  }
  // Report misses compactly (one line per host) so the guide shows what was tried.
  for (const host of hosts) {
    if (discoveredHosts.includes(host)) continue;
    const tried = results.filter((r) => r.host === host).map((r) => `${r.path} → ${r.status || "no response"}`);
    probes.push({
      name: `OAuth discovery on ${host}`,
      request: `GET https://${host}{${paths.join(",")}}`,
      result: `No discovery document (${tried.join("; ")}). Many providers don't publish one; this is not by itself a problem.`,
      status: "info",
      checkedAt: today,
    });
  }
  return { probes, dcr, discoveredHosts };
}

/** Check that a developer-portal URL the agent found actually resolves. */
export async function probeUrl(url: string, today: string): Promise<Probe | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !safeHost(u.hostname)) return null;
  try {
    const res = await fetch(u, { method: "GET", headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(7000) });
    await res.body?.cancel().catch(() => {});
    return {
      name: "Developer portal reachable",
      request: `GET ${u.href}`,
      result: `${res.status}${res.redirected ? ` (redirected to ${res.url})` : ""}`,
      status: res.status < 400 ? "pass" : res.status === 401 || res.status === 403 ? "info" : "fail",
      checkedAt: today,
    };
  } catch (e) {
    return { name: "Developer portal reachable", request: `GET ${u.href}`, result: `No response (${e instanceof Error ? e.name : "error"})`, status: "fail", checkedAt: today };
  }
}
