import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="text-sm font-medium text-muted">404</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">We don&apos;t have that guide (yet)</h1>
      <p className="mt-3 text-foreground/80">
        The link may be mistyped, or no one has generated a guide for this app. You can ask the research agent to write
        one. It takes about a minute.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/" className="rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:opacity-90">Look up an app</Link>
        <Link href="/#library" className="rounded-lg border border-line bg-card px-4 py-2 font-medium hover:bg-background">Browse the library</Link>
      </div>
    </div>
  );
}
