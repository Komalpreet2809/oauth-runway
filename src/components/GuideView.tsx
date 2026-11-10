import Link from "next/link";
import type { Guide, Requirement } from "@/lib/types";
import { DifficultyBadge, EvidenceBadge, OwnerChip } from "./badges";
import { CopyButton } from "./CopyButton";
import { evidenceCounts } from "@/lib/evidence";

const PHASE_LABEL = { setup: "Set up", test: "Test", review: "Review", launch: "Launch" } as const;
const NEEDED_LABEL: Record<Requirement["neededFor"], string> = {
  setup: "To create the app",
  testing: "To test it",
  production: "To launch to all users",
};

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 mt-10">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="text-sm text-muted mt-0.5">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Stat cards should scan at a glance: show a short headline in bold and push any
 * longer explanation into the muted note ("About 1 hour of setup. Then 2–5 days…"
 * becomes headline "About 1 hour of setup" plus the rest as detail).
 */
function splitHeadline(value: string): [string, string] {
  if (value.length <= 48) return [value, ""];
  const m = /^(.{8,90}?)(?:[.;:]\s+|,\s+(?=then\b|plus\b|and\b|but\b)|\s+\((?=[^)]{12,}))/i.exec(value);
  if (m) return [m[1].replace(/[\s,;:.]+$/, ""), value.slice(m[0].length).replace(/\)$/, "").trim()];
  return [value, ""];
}

function Stat({ label, value, note }: { label: string; value?: string; note?: string }) {
  if (!value) return null;
  const [head, rest] = splitHeadline(value);
  const detail = [rest && rest.charAt(0).toUpperCase() + rest.slice(1), note].filter(Boolean).join(" ");
  return (
    <div className="rounded-lg border border-line bg-card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-semibold leading-snug">{head}</div>
      {detail ? <div className="mt-1 text-xs text-muted leading-snug">{detail}</div> : null}
    </div>
  );
}

export function GuideView({ guide: g, origin }: { guide: Guide; origin: "library" | "generated" }) {
  const counts = evidenceCounts(g);
  const managed = g.app.composio?.managedOAuthAvailable;
  const reqGroups = (["setup", "testing", "production"] as const)
    .map((k) => ({ k, items: g.requirements.filter((r) => r.neededFor === k) }))
    .filter((x) => x.items.length);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted">
            {[g.app.provider, g.app.category].filter(Boolean).join(" · ")}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">{g.app.name}: OAuth app setup &amp; approval</h1>
        </div>
        <DifficultyBadge d={g.summary.difficulty} size="lg" />
      </div>
      <p className="mt-4 text-[17px] leading-relaxed">{g.summary.verdict}</p>
      {g.summary.difficultyReason ? <p className="mt-2 text-sm text-muted">{g.summary.difficultyReason}</p> : null}

      <div className="no-print mt-4 flex flex-wrap items-center gap-2 text-xs">
        <CopyButton text={`/guides/${g.slug}`} absolute label="Copy share link" />
        <a href={`/guides/${g.slug}/markdown`} className="rounded-md border border-line bg-card px-2.5 py-1 font-medium hover:bg-background">Markdown</a>
        <a href={`/api/guides/${g.slug}`} className="rounded-md border border-line bg-card px-2.5 py-1 font-medium hover:bg-background">JSON (for agents)</a>
        {origin === "generated" ? (
          <Link href={`/generate?q=${encodeURIComponent(g.app.name)}&force=1`} className="rounded-md border border-line bg-card px-2.5 py-1 font-medium hover:bg-background">
            Regenerate
          </Link>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted">
        {origin === "library" ? "Library guide, researched by agents and reviewed" : "Generated live by the research agent"}
        {" · "}last checked {g.meta.lastVerifiedAt ?? g.meta.generatedAt}
        {g.meta.model ? ` · ${g.meta.model}` : ""}
        {g.meta.durationMs ? ` · ${Math.round(g.meta.durationMs / 1000)}s` : ""}
        {" · "}
        <a href="#evidence" className="underline">
          {g.probes.length} live checks · claims: {counts.tested} tested, {counts.sourced} sourced, {counts.uncertain} unverified
        </a>
        {g.meta.verification
          ? ` · ${g.meta.verification.matched}/${g.meta.verification.checked} quotes matched their source`
          : ""}
      </p>

      {origin === "generated" && g.meta.model?.startsWith("groq/") ? (
        <div className="no-print mt-6 rounded-lg border border-stone-300 bg-stone-50 p-4 text-sm">
          <div className="font-semibold">Written by the backup model</div>
          <p className="mt-1 text-foreground/80">
            The main model was busy, so a smaller backup model wrote this guide from a shorter reading of the docs. Expect
            fewer cited sources and more &ldquo;Unverified&rdquo; claims.{" "}
            <Link href={`/generate?q=${encodeURIComponent(g.app.name)}&force=1`} className="underline font-medium">Regenerate it</Link> in a few minutes for a fuller guide.
          </p>
        </div>
      ) : null}

      {/* Do you even need this? */}
      {managed === true ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="font-semibold text-emerald-900">You may not need your own OAuth app</div>
          <p className="mt-1 text-emerald-900/90">
            Composio provides a managed OAuth app for {g.app.composio?.toolkit ? <code className="text-xs">{g.app.composio.toolkit}</code> : g.app.name}, so your users can connect today
            with no setup. {g.app.composio?.whenYouNeedYourOwnApp ?? "Create your own when you need your branding on the consent screen, custom scopes, or dedicated quota."}
          </p>
        </div>
      ) : managed === false ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-semibold text-amber-900">You need your own OAuth app</div>
          <p className="mt-1 text-amber-900/90">
            Composio has no managed OAuth app for {g.app.name}, so it&apos;s bring-your-own. {g.app.composio?.whenYouNeedYourOwnApp ?? ""}
          </p>
        </div>
      ) : null}

      {/* At a glance */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="First test connection" value={g.summary.timeToFirstConnection?.label} note={g.summary.timeToFirstConnection?.note} />
        <Stat label="Any user can connect" value={g.summary.timeToProduction?.label} note={g.summary.timeToProduction?.note} />
        <Stat label="Your hands-on effort" value={g.summary.handsOnEffort} />
        <Stat label="Approval wait" value={g.summary.approvalWait} />
        <Stat label="Costs" value={g.summary.costs} />
      </div>
      <div className="mt-2">
        <EvidenceBadge ev={g.summary.evidence} />
      </div>

      {/* Path */}
      <Section id="path" title="Your path, step by step" subtitle="Who does each step: you, an agent, or waiting on someone else.">
        <div className="no-print mb-4 flex flex-wrap items-center gap-1 text-[11px]">
          {g.stages.map((s, i) => (
            <a
              key={s.id + i}
              href={`#stage-${i + 1}`}
              className={`rounded px-2 py-1 font-medium ring-1 ring-inset ${
                s.owner === "agent"
                  ? "bg-indigo-50 text-indigo-800 ring-indigo-200"
                  : s.owner === "provider"
                    ? "bg-amber-50 text-amber-900 ring-amber-200"
                    : "bg-stone-100 text-stone-800 ring-stone-200"
              }`}
            >
              {i + 1}. {s.title}
            </a>
          ))}
        </div>
        <ol className="space-y-4">
          {g.stages.map((s, i) => (
            <li key={s.id + i} id={`stage-${i + 1}`} className="scroll-mt-20 rounded-lg border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Number and title stay on one line, even on phones */}
                <div className="flex min-w-0 basis-full items-start gap-2 sm:basis-auto">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-semibold">{i + 1}</span>
                  <h3 className="font-semibold leading-snug">{s.title}</h3>
                </div>
                <span className="text-xs text-muted">{PHASE_LABEL[s.phase] ?? s.phase}</span>
                <span className="ml-auto flex items-center gap-2">
                  {s.estimate ? <span className="text-xs text-muted">⏱ {s.estimate}</span> : null}
                  <OwnerChip owner={s.owner} />
                </span>
              </div>
              {s.steps.length ? (
                <ol className="mt-3 list-decimal pl-5 space-y-1.5 text-sm leading-relaxed marker:text-muted">
                  {s.steps.map((st, j) => (
                    <li key={j} className="whitespace-pre-line">{st}</li>
                  ))}
                </ol>
              ) : null}
              {s.agentHelp ? (
                <div className="mt-3 rounded-md bg-indigo-50/70 p-3 text-sm text-indigo-950">
                  <span className="font-medium">🤖 Agent help: </span>
                  <span className="whitespace-pre-line">{s.agentHelp}</span>
                </div>
              ) : null}
              <div className="mt-3">
                <EvidenceBadge ev={s.evidence} />
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {reqGroups.length ? (
        <Section id="requirements" title="What you need before you start">
          <div className="space-y-4">
            {reqGroups.map(({ k, items }) => (
              <div key={k}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted">{NEEDED_LABEL[k]}</div>
                <ul className="mt-2 space-y-2">
                  {items.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span aria-hidden className="mt-0.5 text-muted">☐</span>
                      <span className="flex-1">{r.item} <EvidenceBadge ev={r.evidence} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {g.limitsBeforeApproval.length ? (
        <Section id="limits" title="Limits until you're approved" subtitle="What works, and what doesn't, while you wait.">
          <ul className="space-y-2">
            {g.limitsBeforeApproval.map((l, i) => (
              <li key={i} className="rounded-md border border-line bg-card p-3 text-sm">
                {l.limit} <EvidenceBadge ev={l.evidence} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {g.blockers.length ? (
        <Section id="blockers" title="If you get stuck" subtitle="Common blockers and what to do about them.">
          <div className="space-y-3">
            {g.blockers.map((b, i) => (
              <div key={i} className="rounded-lg border border-line bg-card p-4 text-sm">
                <div className="font-semibold">{b.title}</div>
                {b.symptom ? <p className="mt-1 text-muted"><span className="font-medium text-foreground/80">You see: </span>{b.symptom}</p> : null}
                <p className="mt-1"><span className="font-medium">What to do: </span>{b.whatToDo}</p>
                <div className="mt-2"><EvidenceBadge ev={b.evidence} /></div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {g.nuances.length ? (
        <Section id="nuances" title="Things that catch people out">
          <ul className="space-y-2">
            {g.nuances.map((n, i) => (
              <li key={i} className="text-sm leading-relaxed border-l-2 border-accent/40 pl-3">
                {n.text} <EvidenceBadge ev={n.evidence} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section id="agent" title="What an agent can do vs. what you must do">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="text-sm font-semibold text-indigo-950">🤖 An agent can</div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-indigo-950/90">
              {g.agentVsYou.agentCan.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-card p-4">
            <div className="text-sm font-semibold">👤 You must</div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
              {g.agentVsYou.youMust.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      {g.composioSetup ? (
        <Section id="composio" title="Plug it into Composio">
          <div className="rounded-lg border border-line bg-card p-4 text-sm space-y-3">
            {g.composioSetup.redirectUri ? (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted">Redirect / callback URL</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-background px-2 py-1 text-xs break-all">{g.composioSetup.redirectUri}</code>
                  <CopyButton text={g.composioSetup.redirectUri} />
                </div>
              </div>
            ) : null}
            {g.composioSetup.steps?.length ? (
              <ol className="list-decimal pl-5 space-y-1">
                {g.composioSetup.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            ) : null}
            {g.composioSetup.notes ? <p className="text-muted">{g.composioSetup.notes}</p> : null}
          </div>
        </Section>
      ) : null}

      {/* Evidence */}
      <Section id="evidence" title="Evidence" subtitle="What was tested live, what sources say, and what we could not verify.">
        {g.probes.length ? (
          <div>
            <h3 className="text-sm font-semibold">Live checks</h3>
            <ul className="mt-2 space-y-2">
              {g.probes.map((p, i) => (
                <li key={i} id={`probe-${i + 1}`} className="scroll-mt-20 rounded-md border border-line bg-card p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.status === "pass" ? "bg-emerald-500" : p.status === "fail" ? "bg-rose-500" : "bg-stone-400"}`} />
                    <span className="font-medium">P{i + 1}. {p.name}</span>
                    {p.checkedAt ? <span className="ml-auto text-muted">{p.checkedAt}</span> : null}
                  </div>
                  <code className="mt-1 block break-all text-muted">{p.request}</code>
                  <p className="mt-1 leading-relaxed">{p.result}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {g.corrections.length ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">What we corrected</h3>
            <p className="text-xs text-muted">Claims from existing guides or common belief that primary sources or tests contradicted.</p>
            <ul className="mt-2 space-y-2">
              {g.corrections.map((c, i) => (
                <li key={i} className="rounded-md border border-line bg-card p-3 text-sm">
                  <div className="text-muted line-through decoration-rose-400/70">{c.claim}</div>
                  <div className="mt-1">{c.finding}</div>
                  {c.source ? <a href={c.source} className="mt-1 block text-xs text-accent hover:underline break-all" target="_blank" rel="noreferrer">{c.source}</a> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {g.openQuestions.length ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">What we couldn&apos;t verify</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
              {g.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        ) : null}

        {g.sources.length ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Sources</h3>
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-xs">
              {g.sources.map((s, i) =>
                s.type === "probe" ? (
                  // Probe URLs deliberately return errors (fake client IDs, no token), so don't make them clickable.
                  <li key={i}>
                    <span className="font-medium">{s.title || "Live check"}</span>{" "}
                    <span className="text-muted">(live check, see above): </span>
                    <code className="break-all text-muted">{s.url}</code>
                  </li>
                ) : (
                  <li key={i}>
                    <a href={s.url} className="text-accent hover:underline break-all" target="_blank" rel="noreferrer">{s.title || s.url}</a>
                    {s.type && s.type !== "official" ? <span className="ml-1 text-muted">({s.type})</span> : null}
                  </li>
                ),
              )}
            </ol>
          </div>
        ) : null}
      </Section>
    </article>
  );
}
