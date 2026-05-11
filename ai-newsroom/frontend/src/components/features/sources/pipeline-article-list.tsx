"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { RawArticle } from "@/lib/api";
import { ExternalLink, FileText, Sparkles, Trash2 } from "lucide-react";
import { PageEmptyState, PageErrorState, PageStateBoundary } from "@/components/shared/page-states";

type TranslationFn = (key: string, fallback?: string) => string;

interface RunningJob {
  startTime: number;
}

function TimerDisplay({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const updateElapsed = () => setElapsed(Math.max(0, Date.now() - startTime));
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const secs = Math.floor(elapsed / 1000);
  return <span className="text-zinc-400 dark:text-zinc-500 font-mono w-[22px] text-right inline-block">{secs}s</span>;
}

interface PipelineArticleListProps {
  loading: boolean;
  error?: string | null;
  filteredArticles: RawArticle[];
  selectedIds: Set<number>;
  t: TranslationFn;
  statusFilter: "all" | "pending" | "processed";
  formatTime: (iso: string | null) => string;
  getRunningJobForArticle: (articleId: number) => RunningJob | undefined;
  onToggleSelect: (id: number) => void;
  onProcessSingle: (articleId: number) => void;
  onDeleteArticle: (articleId: number) => void;
}

export function PipelineArticleList({
  loading,
  error,
  filteredArticles,
  selectedIds,
  t,
  statusFilter,
  formatTime,
  getRunningJobForArticle,
  onToggleSelect,
  onProcessSingle,
  onDeleteArticle,
}: PipelineArticleListProps) {
  return (
    <PageStateBoundary
      loading={loading}
      error={error}
      isEmpty={filteredArticles.length === 0}
      loadingLabel={t("common.loading", "Loading...")}
      errorState={
        <PageErrorState
          title={t("common.loadFailed", "Failed to load")}
          description={error ?? undefined}
        />
      }
      emptyState={
        <PageEmptyState
          icon={FileText}
          title={t("pipeline.emptyTitle")}
          description={
            statusFilter === "pending"
              ? t("pipeline.emptyPending")
              : statusFilter === "processed"
                ? t("pipeline.emptyProcessed")
                : t("pipeline.emptySource")
          }
        />
      }
    >
      <div>
        {filteredArticles.map((article) => {
        const isSelected = selectedIds.has(article.id);
        const isPending = !article.is_processed;
        const runningJob = getRunningJobForArticle(article.id);

        return (
          <div
            key={article.id}
            className={cn(
              "group flex items-center gap-4 px-6 py-2.5 border-b border-zinc-100 dark:border-white/[0.04] hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer",
              article.is_processed && !isSelected && "opacity-60",
            )}
            onClick={() => onToggleSelect(article.id)}
          >
            <div className="shrink-0 w-8 flex items-center justify-center">
              <div
                className={cn(
                  "w-[16px] h-[16px] rounded-[3px] flex items-center justify-center transition-all opacity-100",
                  isSelected
                    ? "bg-foreground border border-foreground"
                    : "border-[1.5px] border-zinc-300 dark:border-zinc-500 bg-white dark:bg-zinc-900",
                )}
              >
                {isSelected && (
                  <svg className="w-2.5 h-2.5 text-background" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <p
                className={cn(
                  "text-[13.5px] font-normal leading-snug transition-colors truncate",
                  article.is_processed
                    ? "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-400"
                    : "text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100",
                )}
              >
                {article.title || t("pipeline.untitled")}
              </p>
              <p className="text-[11.5px] text-zinc-400 dark:text-zinc-600 mt-px truncate">
                {article.author || ""}
              </p>
            </div>

            <div className="relative flex items-center justify-end min-w-[140px] shrink-0 h-6 overflow-hidden">
              {runningJob ? (
                <div className="absolute right-0 flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full text-[11px] font-medium border border-zinc-200/50 dark:border-white/[0.05] shadow-sm shadow-black/5 dark:shadow-none">
                  <svg className="w-3.5 h-3.5 animate-spin text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t("pipeline.processing")}</span>
                  <TimerDisplay startTime={runningJob.startTime} />
                </div>
              ) : (
                <>
                  <div className="absolute right-0 flex items-center gap-4 transition-transform duration-200 group-hover:translate-x-[150%]">
                    <span className="w-[64px] text-right text-[11.5px] text-zinc-400 dark:text-zinc-600 tabular-nums">
                      {formatTime(article.fetched_at)}
                    </span>
                    <div className="flex items-center justify-end w-[72px]">
                      {article.is_processed ? (
                        <span className="text-[11.5px] font-medium text-zinc-400 dark:text-zinc-600 whitespace-nowrap">
                          {t("pipeline.status.processed")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100/80 dark:bg-[#15161a] border border-zinc-200/50 dark:border-white/[0.05]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-600 dark:bg-blue-500 dark:shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-400 whitespace-nowrap">
                            {t("pipeline.status.pending")}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="absolute right-0 flex items-center gap-1 transition-transform duration-200 translate-x-[150%] group-hover:translate-x-0 w-full justify-end bg-gradient-to-l from-zinc-50 via-zinc-50 to-transparent dark:from-[#0f1013] dark:via-[#0f1013] pl-8">
                    {isPending && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onProcessSingle(article.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors shadow-sm bg-white dark:bg-[#1a1b1e]"
                        title={t("pipeline.processArticle")}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors shadow-sm bg-white dark:bg-[#1a1b1e]"
                        title={t("pipeline.openArticle")}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteArticle(article.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shadow-sm bg-white dark:bg-[#1a1b1e]"
                      title={t("pipeline.removeArticle")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
        })}
      </div>
    </PageStateBoundary>
  );
}
