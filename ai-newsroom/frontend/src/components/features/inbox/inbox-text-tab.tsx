"use client";
import * as React from "react";
import { api, type RawArticle, type PipelineStats } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { useJobStore } from "@/hooks/useJobStore";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/use-toast";
import { FileText } from "lucide-react";
import { InboxTextListCard } from "./inbox-text-list-card";
import { InboxSourceTabs } from "./inbox-source-tabs";
import { InboxTextToolbar } from "./inbox-text-toolbar";
import { InboxTextSelectionPill } from "./inbox-text-selection-pill";
import { useUrlTab } from "@/hooks/useUrlTab";
import { useSelectableSet } from "@/hooks/useSelectableSet";
import { useTabsStore } from "@/store/tabs";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/shared/page-states";
import { useClickOutside } from "@/hooks/useClickOutside";
import { usePipelineJobNotifications } from "@/hooks/usePipelineJobNotifications";
import { ChevronLeft, ChevronRight } from "lucide-react";

type StatusFilter = "all" | "pending" | "processed";
type ProcessTarget = { ids: number[]; selectedOnly: boolean };
const PAGE_SIZE = 50;

export function InboxTextTab({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const { t } = useTranslation();
  const [stats, setStats] = React.useState<PipelineStats | null>(null);
  const [articles, setArticles] = React.useState<RawArticle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const { jobs: activeJobs, submit: submitJob, getRunningJobForArticle, hasRunning, getFinished, dismiss } = useJobStore();
  const processing = hasRunning('process');
  const { selected: selectedIds, toggle: toggleSelect, replaceAll: replaceSelectedIds, clear: clearSelectedIds, remove: removeSelectedId } = useSelectableSet<number>();
  const [batchDeleting, setBatchDeleting] = React.useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = React.useState(false);
  const [processTarget, setProcessTarget] = React.useState<ProcessTarget | null>(null);
  const setSourceIdAction = useTabsStore(s => s.setInboxTextSourceId);
  const [activeSourceIdStr, setActiveSourceIdStr] = useUrlTab<string>("t_source", "all", (value) => {
    setSourceIdAction(value === "all" ? "all" : value ? Number(value) : null);
  });
  
  const activeSourceId = activeSourceIdStr === "all" ? null : Number(activeSourceIdStr);
  const setActiveSourceId = React.useCallback((val: number | null) => {
    setActiveSourceIdStr(val === null ? "all" : String(val));
  }, [setActiveSourceIdStr]);
  const [deleteArticleId, setDeleteArticleId] = React.useState<number | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [statusFilter, setStatusFilterRaw] = React.useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    const saved = localStorage.getItem("newsroom:pipeline:filter");
    if (saved === "all" || saved === "pending" || saved === "processed") {
      setStatusFilterRaw(saved);
    }
  }, []);

  const setStatusFilter = (val: StatusFilter) => {
    setStatusFilterRaw(val);
    localStorage.setItem("newsroom:pipeline:filter", val);
  };
  const [searchQuery, setSearchQuery] = React.useState("");
  const filterRef = React.useRef<HTMLDivElement>(null);
  useClickOutside({
    ref: filterRef,
    enabled: filterOpen,
    onClickOutside: () => setFilterOpen(false),
  });

  const fetchData = React.useCallback(async () => {
    try {
      setLoadError("");
      const [s, a] = await Promise.all([api.getPipelineStats(), api.getRawArticles()]);
      setStats(s);
      setArticles(a);
      
      // Do not auto-select the first source. Let "all" stay "all".
    } catch (error) {
      console.error("Failed to fetch pipeline data", error);
      setLoadError(t("pipeline.loadFailed", "Failed to load pipeline articles. Please try again."));
    }
    finally { setLoading(false); }
  }, [t]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  React.useEffect(() => {
    if (onCountChange && stats) {
      onCountChange(stats.unprocessed);
    }
  }, [stats, onCountChange]);

  usePipelineJobNotifications({
    jobs: activeJobs,
    getFinished,
    dismiss,
    t,
    watchScrape: true,
    watchProcess: true,
    onScrapeHandled: fetchData,
    onProcessHandled: async () => {
      clearSelectedIds();
      await fetchData();
    },
  });

  // Derived data
  const filteredArticles = React.useMemo(() => {
    let list = articles;
    if (activeSourceId !== null) list = list.filter(a => a.source_id === activeSourceId);
    if (statusFilter === "pending") list = list.filter(a => !a.is_processed);
    if (statusFilter === "processed") list = list.filter(a => a.is_processed);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        (a.title || "").toLowerCase().includes(q) ||
        (a.author || "").toLowerCase().includes(q) ||
        (a.source_name || "").toLowerCase().includes(q)
      );
    }

    // Always sort so pending (unprocessed) articles appear at the top
    return [...list].sort((a, b) => {
      if (a.is_processed === b.is_processed) return 0;
      return a.is_processed ? 1 : -1;
    });
  }, [articles, activeSourceId, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const paginatedArticles = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredArticles.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredArticles]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeSourceId, statusFilter, searchQuery]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pendingCount = React.useMemo(() => {
    let list = articles;
    if (activeSourceId !== null) list = list.filter(a => a.source_id === activeSourceId);
    return list.filter(a => !a.is_processed).length;
  }, [articles, activeSourceId]);

  const handleSelectAllVisible = () => {
    const allSelected = paginatedArticles.length > 0 && paginatedArticles.every(a => selectedIds.has(a.id));
    if (allSelected) {
      clearSelectedIds();
    } else {
      replaceSelectedIds(paginatedArticles.map(a => a.id));
    }
  };

  const openProcessConfirm = () => {
    const targetIds = selectedIds.size > 0
      ? Array.from(selectedIds)
      : articles.filter(a => !a.is_processed).map(a => a.id);
    if (targetIds.length === 0) return;
    setProcessTarget({ ids: targetIds, selectedOnly: selectedIds.size > 0 });
  };

  const handleProcess = async (shouldPinCreatedCards: boolean) => {
    if (!processTarget) return;

    try {
      const r = processTarget.selectedOnly
        ? await api.processSelected(processTarget.ids, shouldPinCreatedCards)
        : await api.triggerProcess(shouldPinCreatedCards);
      submitJob(r.job_id, { name: 'process_batch', articleIds: processTarget.ids, shouldPinCreatedCards });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "AI processing encountered an error.";
      toast.error("Processing Failed", message);
    }
  };

  const handleProcessSingle = async (articleId: number) => {
    try {
      const r = await api.processSelected([articleId]);
      submitJob(r.job_id, { name: 'process_single', articleIds: [articleId] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Processing error.";
      toast.error("Failed", message);
    }
  };

  const handleDeleteArticle = async () => {
    if (!deleteArticleId) return;
    await api.deleteRawArticle(deleteArticleId);
    toast.success("Deleted", "Article removed.");
    setDeleteArticleId(null);
    removeSelectedId(deleteArticleId);
    await fetchData();
  };

  const handleBatchDelete = async () => {
    setBatchDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.deleteRawArticle(id)));
      toast.success("Deleted", `Removed ${selectedIds.size} article${selectedIds.size !== 1 ? 's' : ''}.`);
      clearSelectedIds();
      setConfirmBatchDelete(false);
      await fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not delete articles.";
      toast.error("Delete Failed", message);
    }
    finally { setBatchDeleting(false); }
  };
  const statusFilterCount = statusFilter !== "all" ? 1 : 0;
  const sourceTabItems = React.useMemo(() => {
    return stats?.sources.map((source) => ({
      id: source.id,
      label: source.name,
      count: source.article_count,
    })) ?? [];
  }, [stats]);
  const totalArticleCount = React.useMemo(() => {
    return stats?.sources.reduce((acc, source) => acc + source.article_count, 0) ?? 0;
  }, [stats]);

  return (
    <div className="flex flex-col w-full relative">
      {/* ── Source tabs ── */}
      <div className="shrink-0 pb-0 pt-0 min-h-[42px]">
        {stats && stats.sources.length > 0 && (
          <InboxSourceTabs
            items={sourceTabItems}
            activeId={activeSourceId ?? "all"}
            allLabel={t("inbox.all")}
            allCount={totalArticleCount}
            onChange={(id) => {
              setActiveSourceId(id === "all" ? null : Number(id));
              clearSelectedIds();
            }}
          />
        )}
      </div>

      {/* ── Toolbar: Search + Filter + Process ── */}
      <InboxTextToolbar
        filterOpen={filterOpen}
        filterRef={filterRef}
        statusFilter={statusFilter}
        statusFilterCount={statusFilterCount}
        searchQuery={searchQuery}
        pendingCount={pendingCount}
        processing={processing}
        t={t}
        onFilterToggle={() => setFilterOpen(!filterOpen)}
        onStatusFilterChange={setStatusFilter}
        onClearFilters={() => { setStatusFilter("all"); setFilterOpen(false); }}
        onSearchChange={setSearchQuery}
        onProcess={openProcessConfirm}
      />

      {/* ── Main ── */}
      <div className="flex-1 min-h-0">

        {/* ── Article list ── */}
        <div className="pb-24">
          {loading ? (
            <PageLoadingState label={t("common.loading", "Loading...")} compact />
          ) : loadError ? (
            <PageErrorState
              compact
              title={t("common.loadFailed", "Failed to load")}
              description={loadError}
            />
          ) : filteredArticles.length === 0 ? (
            <PageEmptyState
              compact
              icon={FileText}
              title={t('pipeline.emptyTitle')}
              description={
                statusFilter === "pending"
                  ? t('pipeline.emptyPending')
                  : statusFilter === "processed"
                    ? t('pipeline.emptyProcessed')
                    : t('pipeline.emptySource')
              }
            />
          ) : (
            <div>
              {paginatedArticles.map((article) => {
                const isSelected = selectedIds.has(article.id);
                const isPending = !article.is_processed;

                return (
                  <InboxTextListCard
                    key={article.id}
                    article={article}
                    isSelected={isSelected}
                    isPending={isPending}
                    runningJob={getRunningJobForArticle(article.id)}
                    onToggleSelect={toggleSelect}
                    onProcessSingle={handleProcessSingle}
                    onDelete={setDeleteArticleId}
                  />
                );
              })}

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-zinc-100 px-1 pt-4 dark:border-white/[0.05]">
                  <div className="text-[12px] text-zinc-400 tabular-nums dark:text-zinc-500">
                    {t("pipeline.paginationTotal", "共 {count} 篇文章").replace("{count}", String(filteredArticles.length))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      aria-label={t("pipeline.previousPage", "上一页")}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-500 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, index) => index + 1)
                        .filter((page) => (
                          totalPages <= 7
                            || page === 1
                            || page === totalPages
                            || Math.abs(page - currentPage) <= 1
                        ))
                        .map((page, index, pages) => {
                          const previousPage = pages[index - 1];
                          const showGap = previousPage && page - previousPage > 1;

                          return (
                            <React.Fragment key={page}>
                              {showGap && (
                                <span className="px-1 text-zinc-300 dark:text-zinc-600">...</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={
                                  page === currentPage
                                    ? "min-w-8 rounded-md bg-zinc-900 px-2.5 py-1.5 text-[12px] font-semibold text-white dark:bg-white dark:text-zinc-900"
                                    : "min-w-8 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
                                }
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      aria-label={t("pipeline.nextPage", "下一页")}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-500 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Pill for Multi-selection */}
      <InboxTextSelectionPill
        selectedCount={selectedIds.size}
        filteredArticles={paginatedArticles}
        selectedIds={selectedIds}
        processing={processing}
        t={t}
        onSelectAllVisible={handleSelectAllVisible}
        onProcess={openProcessConfirm}
        onDelete={() => setConfirmBatchDelete(true)}
        onClear={clearSelectedIds}
      />

      <ConfirmModal
        isOpen={!!processTarget}
        onClose={() => setProcessTarget(null)}
        onConfirm={() => handleProcess(true)}
        onCancelAction={() => handleProcess(false)}
        title={t('pipeline.confirmPinAfterProcessTitle')}
        description={t('pipeline.confirmPinAfterProcessDesc')}
        confirmText={t('pipeline.confirmPinAfterProcessBtn')}
        cancelText={t('pipeline.processOnlyBtn')}
        isDestructive={false}
      />

      {/* Delete Confirm (single) */}
      <ConfirmModal
        isOpen={!!deleteArticleId}
        onClose={() => setDeleteArticleId(null)}
        onConfirm={handleDeleteArticle}
        title={t('pipeline.confirmDeleteTitle')}
        description={t('pipeline.confirmDeleteDesc')}
        confirmText={t('pipeline.confirmDeleteBtn')}
        isDestructive={true}
      />

      {/* Delete Confirm (batch) */}
      <ConfirmModal
        isOpen={confirmBatchDelete}
        onClose={() => setConfirmBatchDelete(false)}
        onConfirm={handleBatchDelete}
        title={t('pipeline.confirmBatchDeleteTitle').replace('{count}', String(selectedIds.size))}
        description={t('pipeline.confirmBatchDeleteDesc')}
        confirmText={batchDeleting ? t('pipeline.deleting') : t('pipeline.confirmBatchDeleteBtn')}
        isDestructive={true}
      />
    </div>
  );
}
