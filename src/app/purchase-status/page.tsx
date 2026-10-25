import { Suspense } from "react";
import { PageFallback, SiteFooter, SiteHeader } from "@/components/saas/chrome";
import { PurchaseStatusView } from "@/components/saas/PurchaseStatusView";

async function PurchaseStatusContent({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string; canceled?: string }>;
}) {
  const { purchase, canceled } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
        <PurchaseStatusView purchaseId={purchase ?? null} canceled={canceled === "1"} />
      </main>
      <SiteFooter />
    </>
  );
}

export default function Page(props: { searchParams: Promise<{ purchase?: string; canceled?: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PurchaseStatusContent {...props} />
    </Suspense>
  );
}
