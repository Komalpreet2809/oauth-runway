import { Suspense } from "react";
import type { Metadata } from "next";
import { LiveAgent } from "@/components/LiveAgent";

export const metadata: Metadata = { title: "Investigating an app" };

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Loading…</div>}>
      <LiveAgent />
    </Suspense>
  );
}
