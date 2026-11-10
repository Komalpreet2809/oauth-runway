"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = ["Notion MCP", "Zoom", "https://www.pipedrive.com", "Xero", "Spotify"];

export function SearchBox({ librarySlugs }: { librarySlugs: { slug: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const go = (value: string) => {
    const v = value.trim();
    if (v.length < 2) return;
    const lower = v.toLowerCase();
    const hit = librarySlugs.find((g) => g.name.toLowerCase() === lower || g.slug === lower);
    if (hit) router.push(`/guides/${hit.slug}`);
    else router.push(`/generate?q=${encodeURIComponent(v)}`);
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="App name or website, e.g. Pipedrive or pipedrive.com"
          aria-label="App name or website"
          className="flex-1 rounded-lg border border-line bg-card px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button type="submit" className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
          Get guide
        </button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Try an app outside the library:</span>
        {EXAMPLES.map((x) => (
          <button key={x} type="button" onClick={() => go(x)} className="rounded-full border border-line bg-card px-2.5 py-0.5 hover:text-foreground">
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}
