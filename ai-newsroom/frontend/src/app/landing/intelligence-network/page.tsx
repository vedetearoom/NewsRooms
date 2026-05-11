import type { Metadata } from "next";
import { IntelligenceNetworkPage } from "@/components/landing/v2/module-pages";

export const metadata: Metadata = {
  title: "Intelligence Network — AI Newsroom",
  description: "Manage RSS, websites, newsletters, video creators, ingestion health, and source governance.",
};

export default function Page() {
  return <IntelligenceNetworkPage />;
}
