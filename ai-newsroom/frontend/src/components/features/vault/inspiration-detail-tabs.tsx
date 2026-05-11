"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface InspirationDetailTabsProps {
  isText: boolean;
  effectiveTab: "summary" | "structure" | "transcript" | "fulltext";
  onSelectTab: (tab: "summary" | "structure" | "transcript" | "fulltext") => void;
}

export function InspirationDetailTabs({
  isText,
  effectiveTab,
  onSelectTab,
}: InspirationDetailTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-white/10 mb-10">
      {(isText ? ["summary", "fulltext"] as const : ["summary", "structure", "transcript"] as const).map((tab) => {
        const isActive = effectiveTab === tab;
        return (
          <button
            key={tab}
            onClick={() => onSelectTab(tab)}
            className={cn(
              "pb-3 text-[13px] transition-colors relative",
              isActive
                ? "text-zinc-900 dark:text-zinc-100 font-medium"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-normal",
            )}
          >
            {tab === "summary" && (isText ? t("vault.inspirationSummaryText") : t("vault.inspirationSummaryVideo"))}
            {tab === "structure" && t("vault.inspirationStructure")}
            {tab === "fulltext" && t("vault.inspirationFullText")}
            {tab === "transcript" && t("vault.inspirationTranscript")}
            {isActive && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-zinc-900 dark:bg-zinc-100 rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
