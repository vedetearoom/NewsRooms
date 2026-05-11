import type { Metadata } from "next";
import { AgentStudioModulePage } from "@/components/landing/v2/module-pages";

export const metadata: Metadata = {
  title: "Agent Studio — AI Newsroom",
  description: "Configure extractor, writer, reviewer, illustrator agents, models, prompts, knowledge, and plugins.",
};

export default function Page() {
  return <AgentStudioModulePage />;
}
