import type { Metadata } from "next";
import { IntelligencePanoramaPage } from "@/components/landing/v2/module-pages";

export const metadata: Metadata = {
  title: "Intelligence Panorama — AI Newsroom",
  description: "A live intelligence wall for articles, videos, tags, scores, and editorial discovery.",
};

export default function Page() {
  return <IntelligencePanoramaPage />;
}
