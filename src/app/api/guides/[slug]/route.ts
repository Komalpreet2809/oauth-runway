// GET /api/guides/:slug — the guide as JSON, so other agents and tools can consume it.
import type { NextRequest } from "next/server";
import { getGuide } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/guides/[slug]">) {
  const { slug } = await ctx.params;
  const found = await getGuide(slug);
  if (!found) return Response.json({ error: "Guide not found" }, { status: 404 });
  return Response.json({ origin: found.origin, ...found.guide }, { headers: { "Cache-Control": "public, max-age=60" } });
}
