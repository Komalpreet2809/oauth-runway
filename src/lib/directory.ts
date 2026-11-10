import directoryData from "../../data/composio-directory.json";

export interface DirectoryApp {
  name: string;
  slug: string;
  managedOAuth: boolean;
  isMcp: boolean;
}

export const directory = directoryData as {
  source: string;
  capturedAt: string;
  counts: { total: number; managed: number; bringYourOwn: number; bringYourOwnMcp: number };
  apps: DirectoryApp[];
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Hosts where the domain alone is ambiguous (one company, many products) or
// where the brand changed. Checked before the generic "registrable name" rule.
const HOST_ALIASES: Record<string, string> = {
  "mail.google.com": "gmail",
  "gmail.com": "gmail",
  "calendar.google.com": "google calendar",
  "drive.google.com": "google drive",
  "docs.google.com": "google docs",
  "sheets.google.com": "google sheets",
  "slides.google.com": "google slides",
  "meet.google.com": "google meet",
  "tasks.google.com": "google tasks",
  "photos.google.com": "google photos",
  "classroom.google.com": "google classroom",
  "analytics.google.com": "google analytics",
  "ads.google.com": "google ads",
  "search.google.com": "google search console",
  "teams.microsoft.com": "microsoft teams",
  "outlook.com": "outlook",
  "outlook.live.com": "outlook",
  "outlook.office.com": "outlook",
  "onedrive.live.com": "onedrive",
  "x.com": "twitter",
  "twitter.com": "twitter",
  "web.whatsapp.com": "whatsapp",
};

/** Turn "https://www.notion.so/product" or "Notion" into a comparable key. */
export function normalizeQuery(q: string): string {
  let s = q.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/.test(s)) {
      const url = new URL(s.startsWith("http") ? s : `https://${s}`);
      const host = url.hostname.replace(/^www\./, "");
      const parts = host.split(".");
      // "mail.google.com" -> "gmail", "mcp.linear.app" -> "linear mcp", "shopify.com" -> "shopify"
      if (HOST_ALIASES[host]) s = HOST_ALIASES[host];
      else if (parts[0] === "mcp" && parts.length > 2) s = `${parts[1]} mcp`;
      else s = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    }
  } catch {
    /* not a URL */
  }
  return s.replace(/\s+/g, " ").trim();
}

// Words people (and models) append to a product name that aren't part of the toolkit name.
const GENERIC_SUFFIX = /-(api|apis|app|apps|crm|platform|developer|developers|oauth|integration|cloud|web)$/;

/** Best-effort match of a free-text query against Composio's OAuth directory. */
export function findInDirectory(query: string): DirectoryApp | null {
  let key = slugify(normalizeQuery(query));
  if (!key) return null;
  for (let i = 0; i < 3; i++) {
    const exact = directory.apps.find((a) => a.slug === key);
    if (exact) return exact;
    const stripped = key.replace(GENERIC_SUFFIX, "");
    if (stripped === key || !stripped) break;
    key = stripped; // "spotify-api" -> "spotify"
  }
  // Prefix match ("monday" -> "Monday"), but never guess: a bare name only maps to an
  // MCP variant if the query says "mcp", and several candidates means it's ambiguous
  // ("google" could be Gmail, Google Ads, Google Drive...).
  const wantsMcp = /(^|-)mcp($|-)/.test(key);
  const starts = directory.apps.filter((a) => a.slug.startsWith(key + "-") && (wantsMcp || !a.isMcp));
  return starts.length === 1 ? starts[0] : null;
}
