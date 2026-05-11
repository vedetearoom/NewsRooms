"use client";

import { Search, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type ArticlePipelineStatusFilter = "all" | "pending" | "processed";

interface ArticlePipelineToolbarProps {
  filterOpen: boolean;
  filterRef: React.RefObject<HTMLDivElement | null>;
  statusFilter: ArticlePipelineStatusFilter;
  statusFilterCount: number;
  searchQuery: string;
  pendingCount: number;
  processing: boolean;
  t: (key: string, fallback?: string) => string;
  onFilterToggle: () => void;
  onStatusFilterChange: (value: ArticlePipelineStatusFilter) => void;
  onClearFilters: () => void;
  onSearchChange: (value: string) => void;
  onProcess: () => void;
  shellClassName?: string;
  contentClassName?: string;
}

export function ArticlePipelineToolbar({
  filterOpen,
  filterRef,
  statusFilter,
  statusFilterCount,
  searchQuery,
  pendingCount,
  processing,
  t,
  onFilterToggle,
  onStatusFilterChange,
  onClearFilters,
  onSearchChange,
  onProcess,
  shellClassName,
  contentClassName,
}: ArticlePipelineToolbarProps) {
  return (
    <div
      className={cn(
        "shrink-0 h-[48px] relative border-b border-zinc-100 dark:border-white/5",
        shellClassName,
      )}
    >
      <div className={cn("absolute inset-0 flex items-center justify-between", contentClassName)}>
        <div className="flex items-center gap-3">
          <div className="relative" ref={filterRef}>
            <button
              onClick={onFilterToggle}
              className={cn(
                "flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer",
                filterOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {t("pipeline.filter")}
              {statusFilterCount > 0 ? (
                <span className="ml-[2px] rounded-[4px] bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                  {statusFilterCount}
                </span>
              ) : null}
            </button>
            {filterOpen ? (
              <div className="absolute top-full left-0 z-50 mt-1.5 flex w-[200px] flex-col items-start rounded-xl border border-zinc-200 bg-white py-2 shadow-xl animate-in fade-in slide-in-from-top-1 dark:border-white/10 dark:bg-[#1a1b1e]">
                <div className="mb-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("pipeline.status.title")}
                </div>
                {(["pending", "processed"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => onStatusFilterChange(value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors",
                      statusFilter === value
                        ? "bg-zinc-50 text-foreground dark:bg-white/5"
                        : "text-muted-foreground hover:bg-zinc-50 hover:text-foreground dark:hover:bg-white/5",
                    )}
                  >
                    {value === "pending" ? t("pipeline.status.pending") : t("pipeline.status.processed")}
                  </button>
                ))}
                {statusFilterCount > 0 ? (
                  <div className="mt-1 w-full border-t border-zinc-100 pt-1.5 dark:border-white/5">
                    <button
                      onClick={onClearFilters}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-zinc-50 hover:text-foreground dark:hover:bg-white/5"
                    >
                      {t("pipeline.clearFilters")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="relative ml-3 flex items-center group">
            <Search className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("pipeline.search")}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-[30px] w-[200px] border-transparent bg-transparent pl-6 text-[13px] font-medium text-foreground shadow-none outline-0 placeholder:text-muted-foreground focus:border-transparent focus:outline-0 focus:ring-0 focus:shadow-none hover:text-foreground"
            />
          </div>
        </div>

        <div className="flex items-center">
          <button
            onClick={onProcess}
            disabled={processing}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all duration-200 disabled:opacity-50",
              "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
              "border border-transparent hover:bg-white hover:border-zinc-200 hover:shadow-sm dark:hover:bg-[#1a1b1e] dark:hover:border-white/[0.08]",
            )}
          >
            {processing ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{t("pipeline.processing")}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{`${t("pipeline.process")} ${pendingCount > 0 ? pendingCount : ""}`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
