import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/saas/chrome";
import { MissionArchive } from "@/components/saas/MissionArchive";

export const metadata: Metadata = { title: "My discoveries — LUNARA" };

export default function MissionsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-extrabold">My discoveries</h1>
        <p className="mt-2 mb-8 text-muted-foreground">
          Every session is saved as a mission with its observations and a report. Reports stay available even when you
          have no exploration time left.
        </p>
        <MissionArchive />
      </main>
      <SiteFooter />
    </>
  );
}
