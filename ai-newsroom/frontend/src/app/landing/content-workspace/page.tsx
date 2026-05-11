import type { Metadata } from "next";
import { ContentWorkspaceModulePage } from "@/components/landing/v2/module-pages";

export const metadata: Metadata = {
  title: "Content Workspace — AI Newsroom",
  description: "Turn intelligence cards, source material, and inspiration into production-ready editorial work.",
};

export default function Page() {
  return <ContentWorkspaceModulePage />;
}
