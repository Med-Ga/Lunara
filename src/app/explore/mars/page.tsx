import type { Metadata } from "next";
import { ExploreMars } from "@/components/exploration/ExploreMars";

export const metadata: Metadata = { title: "Mars session — LUNARA" };

export default function ExploreMarsPage() {
  return <ExploreMars />;
}
