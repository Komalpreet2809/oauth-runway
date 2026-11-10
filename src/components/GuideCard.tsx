import Link from "next/link";
import type { Guide } from "@/lib/types";
import { DifficultyBadge } from "./badges";

export function GuideCard({ g }: { g: Guide }) {
  return (
    <Link href={`/guides/${g.slug}`} className="group block rounded-xl border border-line bg-card p-4 hover:border-accent/50 hover:shadow-sm transition">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold group-hover:text-accent">{g.app.name}</div>
        <DifficultyBadge d={g.summary.difficulty} />
      </div>
      <p className="mt-2 text-sm text-foreground/80 line-clamp-3">{g.summary.verdict}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">First test</dt>
          <dd className="font-medium">{g.summary.timeToFirstConnection.label}</dd>
        </div>
        <div>
          <dt className="text-muted">Any user</dt>
          <dd className="font-medium">{g.summary.timeToProduction.label}</dd>
        </div>
      </dl>
    </Link>
  );
}
