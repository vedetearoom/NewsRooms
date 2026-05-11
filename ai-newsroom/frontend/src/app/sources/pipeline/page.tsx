"use client";
import * as React from "react";
import { api, type RawArticle, type PipelineStats } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { useJobStore } from "@/hooks/useJobStore";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/use-toast";
import { PipelineSourceTabs } from "@/components/features/sources/pipeline-source-tabs";
import { PipelineToolbar } from "@/components/features/sources/pipeline-toolbar";
import { PipelineArticleList } from "@/components/features/sources/pipeline-article-list";
import { PipelineSelectionBar } from "@/components/features/sources/pipeline-selection-bar";
import { useClickOutside } from "@/hooks/useClickOutside";
import { usePipelineJobNotifications } from "@/hooks/usePipelineJobNotifications";
import { PageTopBar, PageTopBarBadge } from "@/components/shared/page-top-bar";
import { getRelativeTime } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "processed";

export default function PipelinePage() {
  const { t, language } = useTranslation();
  const [stats, setStats] = React.useState<PipelineStats | null>(null);
  const [articles, setArticles] = React.useState<RawArticle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const { jobs: activeJobs, submit: submitJob, getRunningJobForArticle, hasRunning, getFinished, dismiss } = useJobStore();
  const processing = hasRunning('process');
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [batchDeleting, setBatchDeleting] = React.useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = React.useState(false);
  const [activeSourceId, setActiveSourceIdRaw] = React.useState<number | null>(null);

  React.useEffect(() => {
    const saved = localStorage.getItem("newsroom:pipeline:source");
    if (saved && saved !== "null") {
      setActiveSourceIdRaw(Number(saved));
    }
  }, []);

  const setActiveSourceId = (val: number | null) => {
    setActiveSourceIdRaw(val);
    if (val !== null) {
      localStorage.setItem("newsroom:pipeline:source", val.toString());
    } else {
      localStorage.removeItem("newsroom:pipeline:source");
    }
  };
  const [deleteArticleId, setDeleteArticleId] = React.useState<number | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [statusFilter, setStatusFilterRaw] = React.useState<StatusFilter>("all");

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
    } catch (e) {
      console.error("Failed to fetch pipeline data", e);
      setLoadError(t("pipeline.loadFailed"));
    }
    finally { setLoading(false); }
  }, [t]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  usePipelineJobNotifications({
    jobs: activeJobs,
    getFinished,
    dismiss,
    t,
    watchScrape: true,
    watchProcess: true,
    onScrapeHandled: fetchData,
    onProcessHandled: async () => {
      setSelectedIds(new Set());
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

  const pendingCount = React.useMemo(() => {
    let list = articles;
    if (activeSourceId !== null) list = list.filter(a => a.source_id === activeSourceId);
    return list.filter(a => !a.is_processed).length;
  }, [articles, activeSourceId]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const allSelected = filteredArticles.length > 0 && filteredArticles.every(a => selectedIds.has(a.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArticles.map(a => a.id)));
    }
  };

  const handleProcess = async () => {
    const targetIds = selectedIds.size > 0
      ? Array.from(selectedIds)
      : articles.filter(a => !a.is_processed).map(a => a.id);
    if (targetIds.length === 0) return;

    try {
      let r: { ok: boolean; job_id: string };
      if (selectedIds.size > 0) {
        r = await api.processSelected(Array.from(selectedIds));
      } else {
        r = await api.triggerProcess();
      }
      submitJob(r.job_id, { name: 'process_batch', articleIds: targetIds });
      // Toast will be shown by the useEffect when the job completes
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteArticleId);
      return next;
    });
    await fetchData();
  };

  const handleBatchDelete = async () => {
    setBatchDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.deleteRawArticle(id)));
      toast.success("Deleted", `Removed ${selectedIds.size} article${selectedIds.size !== 1 ? 's' : ''}.`);
      setSelectedIds(new Set());
      setConfirmBatchDelete(false);
      await fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not delete articles.";
      toast.error("Delete Failed", message);
    }
    finally { setBatchDeleting(false); }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return getRelativeTime(iso, language);
  };

  const statusFilterCount = statusFilter !== "all" ? 1 : 0;

  return (
    <div className="min-h-screen w-full flex-1 flex flex-col pt-4 bg-white dark:bg-[#0b0c0f] relative">
      <PageTopBar
        title={t("sidebar.dataPipeline")}
        badge={<PageTopBarBadge text={`${stats?.total_articles ?? 0} ${t("pipeline.articles")}`} />}
        className="mb-10"
        innerClassName="mx-auto w-full max-w-5xl px-2"
      >
        <div />
      </PageTopBar>

      <div className="mx-auto w-full max-w-5xl px-2">
        <div className="mb-10 flex flex-col gap-3">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("sidebar.dataPipeline")}
          </h1>
          <div className="max-w-2xl text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            <p>{t("pipeline.desc", "Review incoming raw articles, filter the queue, and trigger processing when the batch is ready.")}</p>
          </div>
        </div>

        <div className="min-h-[42px]">
          <PipelineSourceTabs
            stats={stats}
            activeSourceId={activeSourceId}
            t={t}
            onSelectSource={(id) => {
              setActiveSourceId(id);
              setSelectedIds(new Set());
            }}
          />
        </div>
      </div>

      <PipelineToolbar
        filterOpen={filterOpen}
        filterRef={filterRef}
        statusFilter={statusFilter}
        statusFilterCount={statusFilterCount}
        searchQuery={searchQuery}
        pendingCount={pendingCount}
        processing={processing}
        t={t}
        onToggleFilter={() => setFilterOpen((prev) => !prev)}
        onSetStatusFilter={setStatusFilter}
        onSearchQueryChange={setSearchQuery}
        onProcess={handleProcess}
        onCloseFilter={() => setFilterOpen(false)}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-2">
          <PipelineArticleList
            loading={loading}
            error={loadError}
            filteredArticles={filteredArticles}
            selectedIds={selectedIds}
            t={t}
            statusFilter={statusFilter}
            formatTime={formatTime}
            getRunningJobForArticle={getRunningJobForArticle}
            onToggleSelect={toggleSelect}
            onProcessSingle={handleProcessSingle}
            onDeleteArticle={setDeleteArticleId}
          />
        </div>
      </div>

      <PipelineSelectionBar
        selectedIds={selectedIds}
        filteredArticles={filteredArticles}
        processing={processing}
        t={t}
        onSelectAllVisible={handleSelectAllVisible}
        onProcess={handleProcess}
        onDelete={() => setConfirmBatchDelete(true)}
        onClear={() => setSelectedIds(new Set())}
      />

      <ConfirmModal
        isOpen={!!deleteArticleId}
        onClose={() => setDeleteArticleId(null)}
        onConfirm={handleDeleteArticle}
        title={t('pipeline.confirmDeleteTitle')}
        description={t('pipeline.confirmDeleteDesc')}
        confirmText={t('pipeline.confirmDeleteBtn')}
        isDestructive={true}
      />

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
