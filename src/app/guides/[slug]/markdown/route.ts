import type { NextRequest } from "next/server";
import { getGuide } from "@/lib/library";
import { guideToMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/guides/[slug]/markdown">) {
  const { slug } = await ctx.params;
  const found = await getGuide(slug);
  if (!found) return new Response("Guide not found", { status: 404 });
  const url = new URL(`/guides/${found.guide.slug}`, req.nextUrl.origin).href;
  return new Response(guideToMarkdown(found.guide, url), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `inline; filename="${found.guide.slug}-oauth-guide.md"` },
  });
}
