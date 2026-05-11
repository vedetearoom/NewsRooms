"use client";

import * as React from "react";

import { cn, getRelativeTime } from "@/lib/utils";
import type { PipelineStats, Source } from "@/lib/api";
import { ExternalLink, MoreHorizontal, Pencil, RefreshCw, Rss, Trash2 } from "lucide-react";
import { PageEmptyState, PageStateBoundary } from "@/components/shared/page-states";

interface SourcesTextGridProps {
  loading: boolean;
  sources: Source[];
  filteredSources: Source[];
  searchQuery: string;
  pipelineStats: PipelineStats | null;
  language: string;
  openMenuId: number | null;
  t: (key: string, fallback?: string) => string;
  getRunningJobForSource: (sourceId: number) => unknown;
  onStartCreate: () => void;
  onScrapeSource: (sourceId: number) => void;
  onToggleMenu: (id: number | null) => void;
  onEditSource: (source: Source) => void;
  onDeleteSource: (sourceId: number) => void;
}

export function SourcesTextGrid({
  loading,
  sources,
  filteredSources,
  searchQuery,
  pipelineStats,
  language,
  openMenuId,
  t,
  getRunningJobForSource,
  onStartCreate,
  onScrapeSource,
  onToggleMenu,
  onEditSource,
  onDeleteSource,
}: SourcesTextGridProps) {
  return (
    <PageStateBoundary
      loading={loading}
      isEmpty={sources.length === 0 || (filteredSources.length === 0 && searchQuery.trim().length > 0)}
      loadingLabel={t("common.loading", "Loading...")}
      emptyState={
        sources.length === 0 ? (
          <PageEmptyState
            icon={Rss}
            title={t("sources.noSources")}
            description={t("sources.noSourcesDesc")}
            action={{
              label: t("sources.addFirstSource"),
              onClick: onStartCreate,
            }}
          />
        ) : (
          <PageEmptyState
            icon={Rss}
            title={t("pipeline.emptyTitle")}
            description={t("pipeline.emptySource")}
          />
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredSources.map((source) => {
        const srcStat = pipelineStats?.sources.find((item) => item.id === source.id);
        const lastSync = source.last_fetched_at
          ? getRelativeTime(source.last_fetched_at, language)
          : t("sources.neverFetched", "Never");
        const isRunning = Boolean(getRunningJobForSource(source.id));

        return (
          <div
            key={source.id}
            className="group relative flex flex-col items-start gap-3 p-5 rounded-[20px] bg-zinc-50/80 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/[0.045] dark:hover:border-white/[0.14] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_-16px_rgba(0,0,0,0.5)] transition-all duration-300"
            onClick={() => onToggleMenu(null)}
          >
            <div className="w-full flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-zinc-900 text-white dark:bg-gradient-to-br dark:from-white/[0.15] dark:to-white/[0.06] dark:text-zinc-200 font-bold text-lg dark:ring-1 dark:ring-white/[0.08] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                {source.name.charAt(0).toUpperCase()}
              </div>

              <div className="relative flex items-center gap-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onScrapeSource(source.id);
                  }}
                  disabled={isRunning}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors",
                    isRunning && "opacity-50 cursor-not-allowed",
                  )}
                  title={t("sources.fetchNow", "Fetch now")}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isRunning && "animate-spin text-blue-500")} />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleMenu(openMenuId === source.id ? null : source.id);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {openMenuId === source.id && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-[#111214] border border-border dark:border-white/[0.08] shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-lg overflow-hidden py-1 z-10 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditSource(source);
                        onToggleMenu(null);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] font-medium text-foreground hover:bg-background transition-colors flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> {t("vault.edit")}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteSource(source.id);
                        onToggleMenu(null);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t("inbox.delete")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 w-full flex flex-col gap-1 min-w-0 mt-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-foreground truncate tracking-tight">
                  {source.name}
                </h3>
                {!source.is_active && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500">
                    {t("sources.inactive", "Inactive")}
                  </span>
                )}
              </div>

              <div className="text-xs text-zinc-500 mt-1 flex flex-wrap items-center w-full leading-relaxed">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shadow-sm",
                    source.is_active ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" : "bg-zinc-300",
                  )} />
                  {source.is_active ? t("sources.statusActive", "Active") : t("sources.inactive", "Inactive")}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600 mx-1.5 shrink-0">·</span>
                <span className="shrink-0">{lastSync}</span>
                {srcStat && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600 mx-1.5 shrink-0">·</span>
                    <span className="shrink-0">
                      {t("sources.fetchedCountPrefix", "")}{srcStat.article_count}{t("sources.fetchedCountSuffix", " fetched")}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-2 w-full pt-4 border-t border-zinc-200/60 dark:border-white/[0.06]">
              {(() => {
                let domain = source.url;
                try {
                  domain = new URL(source.url).hostname.replace("www.", "");
                } catch {
                  /* ignore invalid URLs */
                }

                return (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 truncate hover:underline transition-colors w-full group/link"
                  >
                    <span className="truncate">{domain}</span>
                    <ExternalLink className="w-3 h-3 opacity-50 group-hover/link:opacity-100 shrink-0 transition-opacity" />
                  </a>
                );
              })()}
            </div>
          </div>
        );
        })}
      </div>
    </PageStateBoundary>
  );
}
