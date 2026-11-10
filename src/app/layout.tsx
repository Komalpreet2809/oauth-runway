import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "OAuth Runway: OAuth app setup & approval guides", template: "%s · OAuth Runway" },
  description:
    "How long until your users can connect an app to your AI agent? Evidence-backed guides to creating and getting approval for provider OAuth apps, plus an agent that investigates any app live.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="no-print border-b border-line bg-card/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
              <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white text-xs">
                ✈
              </span>
              OAuth Runway
            </Link>
            <nav className="flex items-center gap-3 sm:gap-5 whitespace-nowrap text-xs sm:text-sm text-muted">
              <Link href="/#library" className="hover:text-foreground">Library</Link>
              <Link href="/#directory" className="hover:text-foreground">
                <span className="sm:hidden">All apps</span>
                <span className="hidden sm:inline">All 402 apps</span>
              </Link>
              <Link href="/method" className="hover:text-foreground">How it works</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="no-print border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-5xl px-4 py-6 flex flex-wrap gap-x-6 gap-y-2 justify-between">
            <span>Guides are a starting point, not legal or compliance advice. Provider policies change, so check the dated sources on each guide.</span>
            <span>
              App directory from{" "}
              <a className="underline" href="https://docs.composio.dev/toolkits/managed-auth">Composio managed OAuth apps</a>{" "}
              (captured 2026-11-05)
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
