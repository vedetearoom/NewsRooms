"use client";

import { Combine, FileText, ListChecks, MessageSquare, Search } from "lucide-react";

export interface CommandPaletteTaskType {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

const BASE_TASK_TYPES: CommandPaletteTaskType[] = [
  {
    type: "daily_report",
    label: "Daily Intelligence Report",
    description: "Comprehensive briefing with executive summary and key stories",
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    type: "summary",
    label: "Executive Summary",
    description: "Concise 300-500 word summary of the most important intelligence items",
    icon: ListChecks,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  {
    type: "social_post",
    label: "Social Media Draft",
    description: "Repurpose content for Xiaohongshu, Twitter/X, and more",
    icon: MessageSquare,
    color: "text-sky-500",
    bg: "bg-sky-50 dark:bg-sky-500/10",
  },
  {
    type: "deep_dive",
    label: "Deep Dive Analysis",
    description: "In-depth 800–1200 word analysis of the most significant topic",
    icon: Search,
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-500/10",
  },
  {
    type: "multi_source_synthesis",
    label: "Multi-source Synthesis",
    description: "Merge facts from Inbox cards into structural skeletons from Vault",
    icon: Combine,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-500/10",
  },
];

export function getCommandPaletteTaskTypes(
  t: (key: string) => string,
  showMultiSource: boolean,
): CommandPaletteTaskType[] {
  const localizedTaskTypes = BASE_TASK_TYPES.map((taskType) => ({
    ...taskType,
    label: t(`commandPalette.tasks.${taskType.type}.label`) || taskType.label,
    description: t(`commandPalette.tasks.${taskType.type}.desc`) || taskType.description,
  }));

  if (!showMultiSource) {
    return localizedTaskTypes.filter((taskType) => taskType.type !== "multi_source_synthesis");
  }

  return localizedTaskTypes.sort((left, right) => {
    if (left.type === "multi_source_synthesis") return -1;
    if (right.type === "multi_source_synthesis") return 1;
    return 0;
  });
}
