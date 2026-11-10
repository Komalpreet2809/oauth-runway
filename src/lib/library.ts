import { promises as fs } from "node:fs";
import path from "node:path";
import type { Guide } from "./types";
import { getGenerated } from "./store";

const LIB_DIR = path.join(process.cwd(), "data", "guides");

export async function listLibrary(): Promise<Guide[]> {
  const files = await fs.readdir(LIB_DIR).catch(() => [] as string[]);
  const guides = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => JSON.parse(await fs.readFile(path.join(LIB_DIR, f), "utf8")) as Guide),
  );
  const order: Record<string, number> = { easy: 0, moderate: 1, hard: 2, very_hard: 3 };
  return guides.sort((a, b) => (order[a.summary.difficulty] ?? 9) - (order[b.summary.difficulty] ?? 9));
}

export async function getLibraryGuide(slug: string): Promise<Guide | null> {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  try {
    return JSON.parse(await fs.readFile(path.join(LIB_DIR, `${safe}.json`), "utf8")) as Guide;
  } catch {
    return null;
  }
}

/** Library guides win over generated ones with the same slug. */
export async function getGuide(slug: string): Promise<{ guide: Guide; origin: "library" | "generated" } | null> {
  const lib = await getLibraryGuide(slug);
  if (lib) return { guide: lib, origin: "library" };
  const gen = await getGenerated(slug);
  if (gen) return { guide: gen, origin: "generated" };
  return null;
}
