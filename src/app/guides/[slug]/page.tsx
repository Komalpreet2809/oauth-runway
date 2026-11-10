import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuide } from "@/lib/library";
import { GuideView } from "@/components/GuideView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await getGuide(slug);
  if (!found) return { title: "Guide not found" };
  const g = found.guide;
  return {
    title: `${g.app.name} OAuth app setup & approval`,
    description: `${g.summary.verdict} First test connection: ${g.summary.timeToFirstConnection.label}. Any user can connect: ${g.summary.timeToProduction.label}.`,
  };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const found = await getGuide(slug);
  if (!found) notFound();
  return <GuideView guide={found.guide} origin={found.origin} />;
}
