"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { AgentEvent, Probe } from "@/lib/types";

type StepState = { id: string; label: string; status: "running" | "done" | "error" | "skipped"; detail?: string };

export function LiveAgent() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const force = params.get("force") === "1";

  const [steps, setSteps] = useState<StepState[]>([]);
  const [sources, setSources] = useState<{ url: string; title?: string }[]>([]);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [doneSlug, setDoneSlug] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!q || started.current) return;
    started.current = true;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);

    const handle = (e: AgentEvent) => {
      if (e.type === "step") {
        setSteps((prev) => {
          const i = prev.findIndex((s) => s.id === e.id);
          const next = { id: e.id, label: e.label, status: e.status, detail: e.detail };
          if (i === -1) return [...prev, next];
          const copy = prev.slice();
          copy[i] = next;
          return copy;
        });
      } else if (e.type === "source") {
        setSources((prev) => (prev.some((s) => s.url === e.url) ? prev : [...prev, { url: e.url, title: e.title }]));
      } else if (e.type === "probe") {
        setProbes((prev) => [...prev, e.probe]);
      } else if (e.type === "log" && e.message !== "…") {
        setLogs((prev) => [...prev, e.message]);
      } else if (e.type === "error") {
        setError(e.message);
        // Whatever was in progress has stopped; don't leave a spinner running.
        setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)));
      } else if (e.type === "done") {
        setDoneSlug(e.slug);
        setTimeout(() => router.push(`/guides/${e.slug}`), e.cached ? 300 : 1200);
      }
    };

    (async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, force }),
        });
        if (!res.ok || !res.body) {
          const msg = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
          setError(msg.error ?? `Request failed (${res.status})`);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) {
              try {
                handle(JSON.parse(line) as AgentEvent);
              } catch {
                /* ignore partial line */
              }
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        clearInterval(timer);
      }
    })();
    return () => clearInterval(timer);
  }, [q, force, router]);

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm">
        Nothing to investigate. <Link className="underline" href="/">Go back</Link> and enter an app name or website.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-sm text-muted">Research agent</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        Investigating <span className="text-accent">{q}</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        It reads the provider&apos;s docs, probes their OAuth endpoints, drafts a guide, then checks every quote against its source. Usually 20–60 seconds.
        <span className="ml-2 font-mono text-xs">{elapsed}s</span>
      </p>

      <ol className="mt-6 space-y-3">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-3">
            <span className="mt-0.5 w-5 text-center" aria-hidden>
              {s.status === "running" ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : s.status === "done" ? "✓" : s.status === "error" ? "✕" : "–"}
            </span>
            <div className="flex-1">
              <div className={`text-sm font-medium ${s.status === "running" ? "" : "text-foreground/80"}`}>{s.label}</div>
              {s.detail ? <div className="text-xs text-muted mt-0.5 break-words">{s.detail}</div> : null}
            </div>
          </li>
        ))}
      </ol>

      {logs.length ? (
        <div className="mt-4 text-xs text-amber-800 space-y-1">{logs.map((l, i) => <div key={i}>{l}</div>)}</div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <div className="font-semibold">The agent couldn&apos;t finish</div>
          <p className="mt-1">{error}</p>
          <p className="mt-2">
            <Link href="/" className="underline">Try another app</Link>, or check the <Link href="/#library" className="underline">library</Link>.
          </p>
        </div>
      ) : null}

      {doneSlug ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Guide ready. <Link className="underline font-medium" href={`/guides/${doneSlug}`}>Open it</Link> (redirecting…)
        </div>
      ) : null}

      {probes.length && !error ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold">Live checks</h2>
          <ul className="mt-2 space-y-1.5 text-xs">
            {probes.map((p, i) => (
              <li key={i} className="rounded border border-line bg-card p-2">
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${p.status === "pass" ? "bg-emerald-500" : p.status === "fail" ? "bg-rose-500" : "bg-stone-400"}`} />
                <span className="font-medium">{p.name}</span>
                <div className="text-muted mt-0.5 break-words">{p.result}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sources.length && !error ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold">Pages read ({sources.length})</h2>
          <ul className="mt-2 space-y-1 text-xs">
            {sources.map((s) => (
              <li key={s.url} className="truncate">
                <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.title || s.url}</a>
                <span className="text-muted"> · {(() => { try { return new URL(s.url).hostname; } catch { return ""; } })()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
