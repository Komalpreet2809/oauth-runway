"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DirectoryApp } from "@/lib/directory";

type Filter = "all" | "byo" | "managed" | "mcp";

export function DirectoryExplorer({
  apps,
  guideSlugs,
}: {
  apps: DirectoryApp[];
  /** directory slug → guide slug, for apps that already have a guide */
  guideSlugs: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("byo");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return apps.filter((a) => {
      if (filter === "byo" && a.managedOAuth) return false;
      if (filter === "managed" && !a.managedOAuth) return false;
      if (filter === "mcp" && !a.isMcp) return false;
      return !needle || a.name.toLowerCase().includes(needle);
    });
  }, [apps, q, filter]);

  const counts = {
    all: apps.length,
    byo: apps.filter((a) => !a.managedOAuth).length,
    managed: apps.filter((a) => a.managedOAuth).length,
    mcp: apps.filter((a) => a.isMcp).length,
  };
  const tabs: { k: Filter; label: string }[] = [
    { k: "byo", label: `Bring your own app (${counts.byo})` },
    { k: "mcp", label: `MCP servers (${counts.mcp})` },
    { k: "managed", label: `Composio-managed (${counts.managed})` },
    { k: "all", label: `All (${counts.all})` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setFilter(t.k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
              filter === t.k ? "bg-foreground text-background ring-foreground" : "bg-card ring-line hover:bg-background"
            }`}
          >
            {t.label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter…"
          aria-label="Filter apps"
          className="ml-auto w-40 rounded-md border border-line bg-card px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 text-sm">
        {rows.map((a) => {
          const guide = guideSlugs[a.slug];
          return (
            <li key={a.slug} className="flex items-center justify-between gap-2 border-b border-line py-1.5">
              <span className="truncate">
                {a.name}
                {a.managedOAuth ? <span className="ml-1.5 text-[10px] font-medium uppercase text-emerald-700">managed</span> : null}
              </span>
              {guide ? (
                <Link href={`/guides/${guide}`} className="shrink-0 text-xs font-medium text-accent hover:underline">Guide →</Link>
              ) : (
                <Link href={`/generate?q=${encodeURIComponent(a.name)}`} className="shrink-0 text-xs text-muted hover:text-accent">Generate</Link>
              )}
            </li>
          );
        })}
      </ul>
      {!rows.length ? <p className="mt-4 text-sm text-muted">No match. You can still <Link className="underline" href={`/generate?q=${encodeURIComponent(q)}`}>generate a guide for “{q}”</Link>.</p> : null}
    </div>
  );
}
