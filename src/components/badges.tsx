import type { Difficulty, Evidence, Owner } from "@/lib/types";

const DIFF: Record<Difficulty, { label: string; cls: string; dots: number }> = {
  easy: { label: "Easy", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dots: 1 },
  moderate: { label: "Moderate", cls: "bg-amber-50 text-amber-800 ring-amber-200", dots: 2 },
  hard: { label: "Hard", cls: "bg-orange-50 text-orange-800 ring-orange-200", dots: 3 },
  very_hard: { label: "Very hard", cls: "bg-rose-50 text-rose-800 ring-rose-200", dots: 4 },
};

export function DifficultyBadge({ d, size = "sm" }: { d: Difficulty; size?: "sm" | "lg" }) {
  const x = DIFF[d] ?? DIFF.moderate;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full ring-1 ring-inset font-medium ${x.cls} ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= x.dots ? "bg-current" : "bg-current opacity-20"}`} />
        ))}
      </span>
      {x.label}
    </span>
  );
}

const OWNER: Record<Owner, { label: string; icon: string; cls: string }> = {
  agent: { label: "Agent can do this", icon: "🤖", cls: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  you: { label: "You", icon: "👤", cls: "bg-stone-100 text-stone-800 ring-stone-200" },
  provider: { label: "Waiting on others", icon: "⏳", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
};

export function OwnerChip({ owner }: { owner: Owner }) {
  const x = OWNER[owner] ?? OWNER.you;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${x.cls}`}>
      <span aria-hidden>{x.icon}</span>
      {x.label}
    </span>
  );
}

const EV = {
  tested: { label: "Tested", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", hint: "We observed this directly (live probe or setup attempt)." },
  sourced: { label: "Sourced", cls: "bg-sky-50 text-sky-800 ring-sky-200", hint: "Stated in a cited source; the quote is shown." },
  uncertain: { label: "Unverified", cls: "bg-stone-100 text-stone-700 ring-stone-300 border-dashed", hint: "Inferred, secondary-only, or could not be confirmed." },
} as const;

/** Evidence badge that expands (no JS) to show sources, quotes and notes. */
export function EvidenceBadge({ ev }: { ev?: Evidence }) {
  if (!ev) return null;
  const x = EV[ev.level] ?? EV.uncertain;
  const hasDetail = (ev.sources && ev.sources.length > 0) || ev.note;
  const badge = (
    <span
      title={x.hint}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${x.cls} ${
        hasDetail ? "cursor-pointer" : ""
      }`}
    >
      {x.label}
      {ev.sources && ev.sources.length > 0 ? ` · ${ev.sources.length}` : ""}
      {hasDetail ? <span aria-hidden className="ml-1">▾</span> : null}
    </span>
  );
  if (!hasDetail) return badge;
  return (
    <details className="group inline-block align-middle [&[open]]:block [&[open]]:my-2">
      <summary className="inline-block">{badge}</summary>
      <div className="mt-2 rounded-md border border-line bg-background p-3 text-xs space-y-2">
        <p className="text-muted">{x.hint}</p>
        {ev.sources?.map((s, i) => (
          <div key={i}>
            <a href={s.url} className="font-medium text-accent hover:underline break-all" target={s.url.startsWith("#") ? undefined : "_blank"} rel="noreferrer">
              {s.title || s.url}
            </a>
            {s.quote ? <blockquote className="mt-1 border-l-2 border-line pl-2 italic text-foreground/80">“{s.quote}”</blockquote> : null}
          </div>
        ))}
        {ev.note ? <p className="text-foreground/80"><span className="font-medium">Note: </span>{ev.note}</p> : null}
      </div>
    </details>
  );
}
