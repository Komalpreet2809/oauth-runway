"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", absolute = false, className = "" }: { text: string; label?: string; absolute?: boolean; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const value = absolute ? new URL(text, window.location.origin).href : text;
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked; ignore */
        }
      }}
      className={`inline-flex items-center gap-1 rounded-md border border-line bg-card px-2.5 py-1 text-xs font-medium hover:bg-background ${className}`}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
