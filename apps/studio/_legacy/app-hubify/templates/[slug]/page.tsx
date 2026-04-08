import { notFound } from "next/navigation";
import { TEMPLATES } from "@/lib/template-data";
import { TemplateDetailPage } from "./TemplateDetailPage";

// Dynamic rendering — Clerk requires env vars at runtime, not build time
export const dynamic = "force-dynamic";

export default async function TemplateSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = TEMPLATES.find((t) => t.slug === slug);
  if (!template) notFound();
  return <TemplateDetailPage template={template} />;
}
