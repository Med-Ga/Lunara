import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageFallback, SiteFooter, SiteHeader } from "@/components/saas/chrome";
import { MissionReportView } from "@/components/saas/MissionReportView";

export const metadata: Metadata = { title: "Mission report — LUNARA" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <MissionReportView missionId={id} />
      </main>
      <SiteFooter />
    </>
  );
}

export default function MissionPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Content {...props} />
    </Suspense>
  );
}
