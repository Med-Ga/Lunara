import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DESTINATIONS, DESTINATION_IDS, isDestinationId } from "@/config/destinations";
import { ExploreDestination } from "@/components/exploration/ExploreDestination";

export function generateStaticParams() {
  return DESTINATION_IDS.map((destination) => ({ destination }));
}

export async function generateMetadata({ params }: { params: Promise<{ destination: string }> }): Promise<Metadata> {
  const { destination } = await params;
  return { title: isDestinationId(destination) ? `${DESTINATIONS[destination].name} session — LUNARA` : "LUNARA" };
}

// Only allowlisted destinations exist; anything else is a 404 (no client-chosen destinations).
async function Explore({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params;
  if (!isDestinationId(destination)) notFound();
  return <ExploreDestination destinationId={destination} />;
}

export default function ExplorePage(props: { params: Promise<{ destination: string }> }) {
  return (
    <Suspense fallback={null}>
      <Explore {...props} />
    </Suspense>
  );
}
