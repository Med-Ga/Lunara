import { Suspense } from "react";
import { AuthForm } from "@/components/saas/AuthForm";
import { PageFallback, SiteFooter, SiteHeader } from "@/components/saas/chrome";

async function RegisterContent({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
        <h1 className="text-4xl font-extrabold">Create your account</h1>
        <p className="mt-3 mb-8 text-muted-foreground">
          New accounts start with zero minutes. You&rsquo;ll pick a package next.
        </p>
        <AuthForm mode="register" next={next ?? null} />
      </main>
      <SiteFooter />
    </>
  );
}

export default function Page(props: { searchParams: Promise<{ next?: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <RegisterContent {...props} />
    </Suspense>
  );
}
