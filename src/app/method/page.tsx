import type { Metadata } from "next";
import Link from "next/link";
import sweep from "../../../research/mcp-dcr-sweep.json";
import verification from "../../../research/verification-sample.json";
import contentAudit from "../../../research/content-audit.json";
import { listLibrary } from "@/lib/library";
import { directory } from "@/lib/directory";
import { evidenceCounts } from "@/lib/evidence";

export const metadata: Metadata = { title: "How it works" };
export const dynamic = "force-dynamic";

type SweepRow = { name: string; server: string; found: boolean; dcr?: boolean; cimd?: boolean; via?: string; registrationEndpoint?: string | null };

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-20 mt-12 text-xl font-semibold tracking-tight">{children}</h2>;
}

export default async function MethodPage() {
  const library = await listLibrary();
  const corrections = library.flatMap((g) => g.corrections.map((c) => ({ ...c, app: g.app.name, slug: g.slug })));
  const sample = verification as { results: { id: string; claim: string; verdict: string; url?: string; quote?: string; note?: string }[] };
  const verdicts = sample.results.reduce<Record<string, number>>((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {});
  const rows = (sweep.results as SweepRow[]).slice().sort((a, b) => Number(b.found) - Number(a.found) || a.name.localeCompare(b.name));

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-[15px] leading-relaxed">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 text-foreground/80">
        What problem this solves, the product decisions behind it, how the research agent works, and how much to trust what it says.
      </p>

      <H2>Three things that get confused</H2>
      <ol className="mt-3 list-decimal pl-5 space-y-2">
        <li><strong>The provider OAuth app.</strong> You register it once with the provider (Google, Slack, Shopify…). It has a client ID and secret, a redirect URL, requested scopes, a name and logo on the consent screen, and often a review or verification status. <em>This is the slow, unfamiliar part.</em></li>
        <li><strong>Your integration (a Composio auth config).</strong> This points Composio at an OAuth app: either Composio&apos;s managed app or your own client ID and secret.</li>
        <li><strong>Your users&apos; connections.</strong> Each end user clicks through the consent screen and gets tokens. How many users can do that, what they see, and which rate limits apply depend on the status of the OAuth app in step 1.</li>
      </ol>
      <p className="mt-3">
        So &ldquo;can my users connect?&rdquo; mostly comes down to the state of the provider OAuth app. Of the {directory.counts.total} OAuth apps
        on Composio, {directory.counts.managed} have a Composio-managed OAuth app and {directory.counts.bringYourOwn} require you to bring your own.
      </p>

      <H2>Product decisions</H2>
      <ul className="mt-3 list-disc pl-5 space-y-2">
        <li><strong>Start with &ldquo;do you even need this?&rdquo;</strong> If Composio manages the app, the fastest path is no setup at all. Each guide says so first and lists the reasons you might still want your own app (branding, scopes, quota).</li>
        <li><strong>Two clocks, not one.</strong> &ldquo;First test connection&rdquo; (you, in a dev or test mode) and &ldquo;any user can connect&rdquo; (after review) can differ by weeks. Active effort is shown separately from waiting.</li>
        <li><strong>Every step has an owner:</strong> 🤖 an agent can do it, 👤 you must, or ⏳ you&apos;re waiting on someone else (the provider, or a customer&apos;s admin). This shows where automation helps and where a human or legal entity is needed.</li>
        <li><strong>Limits before approval and blockers get their own sections.</strong> Test-user caps, rate limits for unreviewed apps, and org-admin approval are what actually surprise teams.</li>
        <li><strong>Every claim carries evidence</strong>, and uncertainty is shown openly rather than smoothed over.</li>
        <li><strong>Shareable by default:</strong> stable URL, Markdown export for tickets and Slack, and JSON for other agents.</li>
      </ul>

      <H2 id="evidence">Evidence levels</H2>
      <ul className="mt-3 space-y-2">
        <li><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium uppercase text-emerald-800 ring-1 ring-emerald-200">Tested</span> We observed it: a live HTTP probe of the provider&apos;s OAuth endpoints, a discovery document, or an error response.</li>
        <li><span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs font-medium uppercase text-sky-800 ring-1 ring-sky-200">Sourced</span> A cited source says it, and the verbatim quote is shown.</li>
        <li><span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-medium uppercase text-stone-700 ring-1 ring-stone-300">Unverified</span> Inferred, only in secondary sources, conflicting, or the quote check failed.</li>
      </ul>

      <H2>The live research agent</H2>
      <ol className="mt-3 list-decimal pl-5 space-y-1.5">
        <li><strong>Understand.</strong> Check the library, the cache of earlier generated guides, and Composio&apos;s OAuth directory.</li>
        <li><strong>Identify.</strong> A web search plus one LLM call resolves the name or URL to a product, its company, and its official docs domains.</li>
        <li><strong>Research.</strong> Four targeted searches run in parallel: creating the app, review and verification, scopes and rate limits, and developer reports. Official domains come first.</li>
        <li><strong>Probe</strong> (in parallel). GET the provider&apos;s OAuth discovery documents. A <code>registration_endpoint</code> means an agent can register the client itself. Probes are the only thing labeled <em>Tested</em>.</li>
        <li><strong>Draft.</strong> The LLM writes the guide using only numbered sources and probes, citing a verbatim quote for every sourced claim.</li>
        <li><strong>Verify, in code rather than by the model.</strong> Every quote must appear on the page it cites. Claims that fail, and &ldquo;tested&rdquo; claims without a probe behind them, are downgraded to Unverified.</li>
        <li><strong>Publish.</strong> The guide is saved behind a stable URL, so the next developer to ask gets it instantly.</li>
      </ol>
      <p className="mt-3 text-sm text-muted">
        Free-tier stack: Gemini Flash-Lite (two models; Groq as a last resort) for the LLM, Tavily for search, Upstash Redis for storage, Vercel Hobby for hosting.
        Rate limits protect the free quotas. Library guides were researched by separate agents with much deeper reading
        and live probes, then reviewed.
      </p>

      <H2 id="mcp">Finding: most MCP servers can be set up by an agent</H2>
      <p className="mt-3">
        {directory.counts.bringYourOwnMcp} of the {directory.counts.bringYourOwn} bring-your-own apps on Composio are remote MCP servers. We sent
        read-only GET requests to the OAuth discovery documents (protected-resource metadata, then authorization-server metadata) of {sweep.summary.probed} of them
        on {sweep.summary.checkedAt}. <strong>{sweep.summary.dcrSupported} of the {sweep.summary.discoveryFound} that responded advertise Dynamic Client Registration</strong>,
        and {sweep.summary.cimdSupported} also support Client ID Metadata Documents.
      </p>
      <p className="mt-2 text-sm text-muted">
        Caveats: the server URLs are our best guesses, and a miss means &ldquo;not found at that URL&rdquo;, not &ldquo;no OAuth&rdquo;. A registration
        endpoint shows that self-registration is offered, not that a given server accepts Composio&apos;s redirect URL.
      </p>
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <div className="font-semibold">Real setup attempt: Linear MCP</div>
        <p className="mt-1">
          To move from &ldquo;offered&rdquo; to &ldquo;works&rdquo;, we registered one real OAuth client on Linear&apos;s MCP server with Composio&apos;s
          redirect URL (2026-11-11). It returned <strong>201 in 0.6 seconds</strong> with a client ID and an expiring secret, with no account, form or
          review. Linear&apos;s authorize step then accepted the new client, and a different redirect URL was rejected with 400. We stopped
          at the sign-in page. <Link href="/guides/linear-mcp#evidence" className="underline font-medium">See the live checks</Link>.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-xs">
          <thead className="bg-background text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">MCP server</th>
              <th className="px-3 py-2 font-medium">Discovery</th>
              <th className="px-3 py-2 font-medium">DCR</th>
              <th className="px-3 py-2 font-medium">Auth server</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-line">
                <td className="px-3 py-1.5 font-medium">{r.name}</td>
                <td className="px-3 py-1.5">{r.found ? "found" : <span className="text-muted">not found</span>}</td>
                <td className="px-3 py-1.5">{r.found ? (r.dcr ? <span className="text-emerald-700 font-medium">yes</span> : <span className="text-rose-700 font-medium">no</span>) : "–"}</td>
                <td className="px-3 py-1.5 text-muted break-all">{r.via?.replace("protected-resource → ", "") ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="verification">What we verified and corrected</H2>
      <p className="mt-3">
        After the library guides were written, a <strong>separate agent that hadn&apos;t written them</strong> took {sample.results.length} of the
        highest-stakes claims, phrased neutrally, and tried to confirm or refute each one against primary sources:{" "}
        <strong>{verdicts.confirmed ?? 0} confirmed, {verdicts.partly ?? 0} partly right, {verdicts.contradicted ?? 0} contradicted, {verdicts.unverifiable ?? 0} unverifiable</strong>.
        Every partly-right claim was rewritten in the guide and recorded under that guide&apos;s &ldquo;What we corrected&rdquo;.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-xs">
          <thead className="bg-background text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Claim checked</th>
              <th className="px-3 py-2 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {sample.results.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-2 font-mono text-muted">{r.id}</td>
                <td className="px-3 py-2">
                  {r.claim}
                  {r.verdict !== "confirmed" && r.note ? <div className="mt-1 text-muted">{r.note}</div> : null}
                  {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 block text-accent hover:underline break-all">{r.url}</a> : null}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${r.verdict === "confirmed" ? "bg-emerald-50 text-emerald-800" : r.verdict === "partly" ? "bg-amber-50 text-amber-900" : "bg-rose-50 text-rose-800"}`}>
                    {r.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6">
        A second fresh agent then read every library guide looking for <strong>AI blunders</strong>: contradictions inside a
        guide, steps given to the wrong owner, stale dates, unexplained jargon, and citations that don&apos;t support their claim.
        It found {contentAudit.issues.length} ({(["high", "medium", "low"] as const).map((sev) => `${contentAudit.issues.filter((i) => i.severity === sev).length} ${sev}`).join(", ")}).
        For example, one guide said &ldquo;about 10 weeks&rdquo; in its summary and &ldquo;about 12 weeks&rdquo; in a step, and another cited the wrong
        live check. All were fixed. Two kinds of suggestion were adapted: quotes stay verbatim, and our own corrections stay visible.
      </p>
      <p className="mt-6">Evidence across the library:</p>
      <ul className="mt-2 space-y-1 text-sm">
        {library.map((g) => {
          const c = evidenceCounts(g);
          return (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}#evidence`} className="font-medium text-accent hover:underline">{g.app.name}</Link>:{" "}
              {c.tested} tested · {c.sourced} sourced · {c.uncertain} unverified · {g.probes.length} live checks · {g.openQuestions.length} open questions
            </li>
          );
        })}
      </ul>
      {corrections.length ? (
        <>
          <h3 className="mt-6 font-semibold">Corrections</h3>
          <p className="text-sm text-muted">Places where an existing guide or common belief disagreed with primary sources or tests.</p>
          <ul className="mt-3 space-y-3">
            {corrections.map((c, i) => (
              <li key={i} className="rounded-lg border border-line bg-card p-3 text-sm">
                <div className="text-xs font-medium text-muted">{c.app}</div>
                <div className="mt-1 text-muted line-through decoration-rose-400/70">{c.claim}</div>
                <div className="mt-1">{c.finding}</div>
                {c.source ? <a href={c.source} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-accent hover:underline break-all">{c.source}</a> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <H2>Limitations</H2>
      <ul className="mt-3 list-disc pl-5 space-y-1.5">
        <li>No provider accounts were created and no approvals were submitted. &ldquo;Tested&rdquo; means live probes, plus one real client registration (Linear MCP), not completed end-to-end setups with a signed-in user.</li>
        <li>Review timelines are rarely published. When only developer reports exist, we give ranges marked Unverified.</li>
        <li>Live guides rely on what search returns in about a minute. They are lighter than library guides and can miss gated or JavaScript-rendered docs.</li>
        <li>The quote check confirms that a quote exists on the cited page, not that the model interpreted it correctly.</li>
        <li>Provider policies change. Every guide shows its check date, and the Regenerate button refreshes a live guide.</li>
      </ul>
    </article>
  );
}
