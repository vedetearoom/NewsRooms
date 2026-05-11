"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArchiveDropdown } from "@/components/inbox/archive-dropdown";
import { type IntelligenceCard } from "@/lib/api";
import { formatArchiveDate, type InboxTimeTab } from "@/hooks/useInboxCardsView";

interface InboxTimeTabsProps {
  activeTab: InboxTimeTab;
  archiveDateFilter: string | null;
  archiveDropdownOpen: boolean;
  archivedCards: IntelligenceCard[];
  timeGroupedCards: Record<InboxTimeTab, IntelligenceCard[]>;
  t: (key: string, fallback?: string) => string;
  onTabSwitch: (tab: InboxTimeTab) => void;
  onCloseArchiveDropdown: () => void;
  onSelectArchiveDate: (date: string | null) => void;
}

export function InboxTimeTabs({
  activeTab: propActiveTab,
  archiveDateFilter,
  archiveDropdownOpen,
  archivedCards,
  timeGroupedCards,
  t,
  onTabSwitch,
  onCloseArchiveDropdown,
  onSelectArchiveDate,
}: InboxTimeTabsProps) {
  // Optimistic state to ensure instant animation
  const [optimisticTab, setOptimisticTab] = React.useState<InboxTimeTab>(propActiveTab);

  // Sync optimistic state with prop when it changes (e.g. on mount or router update)
  React.useEffect(() => {
    setOptimisticTab(propActiveTab);
  }, [propActiveTab]);

  const handleTabClick = (tab: InboxTimeTab) => {
    if (tab !== optimisticTab) {
      setOptimisticTab(tab);
    }
    onTabSwitch(tab);
  };

  return (
    <div className="relative z-[80] flex justify-center mb-10">
      <div className="relative z-[80] grid grid-cols-3 items-center p-1 rounded-2xl bg-zinc-100/80 dark:bg-white/5 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 min-w-[420px]">
        {(["today", "thisWeek", "older"] as const).map((tab) => {
          const isActive = optimisticTab === tab;
          
          return (
            <div key={tab} className="relative">
              <button
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "relative min-w-0 w-full px-6 py-2 rounded-xl text-[13px] font-bold tracking-tight transition-all duration-300 cursor-pointer outline-none group flex items-center justify-center",
                  isActive
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="time-tab-pill"
                    className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)] rounded-xl"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {tab === "today" ? t("inbox.today") : tab === "thisWeek" ? t("inbox.thisWeek") : (
                    archiveDateFilter ? (
                      <div className="flex items-center gap-1.5">
                        <span>{formatArchiveDate(archiveDateFilter)}</span>
                        <div
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectArchiveDate(null);
                            onCloseArchiveDropdown();
                          }}
                          className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <span>{t("inbox.archive")}</span>
                    )
                  )}
                  
                  {!(tab === "older" && archiveDateFilter) && (
                    <span
                      className={cn(
                        "text-[10px] tabular-nums font-medium transition-opacity",
                        isActive ? "opacity-40" : "opacity-30 group-hover:opacity-50",
                      )}
                    >
                      {timeGroupedCards[tab].length}
                    </span>
                  )}
                  
                  {tab === "older" && !archiveDateFilter && (
                    <svg className="w-3 h-3 opacity-30 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </span>
              </button>

              {tab === "older" && (
                <div className="absolute right-0 top-full mt-2 z-[90]">
                  <ArchiveDropdown
                    isOpen={archiveDropdownOpen}
                    onClose={onCloseArchiveDropdown}
                    cards={archivedCards}
                    selectedDate={archiveDateFilter}
                    onSelectDate={(date) => {
                      onSelectArchiveDate(date);
                      onCloseArchiveDropdown();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
