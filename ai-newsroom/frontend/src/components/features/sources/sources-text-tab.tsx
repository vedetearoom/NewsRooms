"use client";
import * as React from "react";
import { useSources } from "@/hooks/useApi";
import { useTranslation } from "@/hooks/useTranslation";
import { useJobStore } from "@/hooks/useJobStore";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { type PipelineStats, type QuotaSnapshot } from "@/lib/api";
import { SourcesTextGrid } from "./sources-text-grid";
import { SourcesTextDialogs } from "./sources-text-dialogs";
import { usePipelineJobNotifications } from "@/hooks/usePipelineJobNotifications";

export function SourcesTextTab({ searchQuery = "", showAddModal = false, onOpenAddModal = () => {}, onCloseAddModal = () => {} }: { searchQuery?: string; showAddModal?: boolean; onOpenAddModal?: () => void; onCloseAddModal?: () => void; }) {
  const { sources, isLoading: loading, mutate: mutateSources } = useSources();
  const { t, language } = useTranslation();
  
  // Modal state
    const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [sourceType, setSourceType] = React.useState("rss");
  const [extractorPrompt, setExtractorPrompt] = React.useState("");
  const [editingSourceId, setEditingSourceId] = React.useState<number | null>(null);
  const [deleteSourceId, setDeleteSourceId] = React.useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = React.useState<number | null>(null);
  const sourceToDelete = sources?.find(s => s.id === deleteSourceId);

  const { jobs: activeJobs, submit: submitJob, getRunningJobForSource, getFinished, dismiss } = useJobStore();
  const [pipelineStats, setPipelineStats] = React.useState<PipelineStats | null>(null);
  const [quota, setQuota] = React.useState<QuotaSnapshot | null>(null);

  // Fetch pipeline stats for source health info
  React.useEffect(() => {
    api.getPipelineStats().then(setPipelineStats).catch(() => { });
    api.getQuota().then(setQuota).catch(() => { });
  }, []);

  const saveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    const payload = {
      name,
      url,
      source_type: sourceType,
      extractor_prompt: sourceType === "web" ? extractorPrompt : undefined
    };
    try {
      if (editingSourceId) {
        await api.updateSource(editingSourceId, payload);
      } else {
        await api.createSource(payload);
      }
      setName("");
      setUrl("");
      setSourceType("rss");
      setExtractorPrompt("");
      setEditingSourceId(null);
      onCloseAddModal();
      mutateSources();
      api.getQuota().then(setQuota).catch(() => { });
    }
    catch (e) {
      const message = e instanceof Error ? e.message : t("sources.saveFailed", "保存来源失败");
      toast.error(t("sources.saveFailed", "保存来源失败"), message);
      console.error("Failed to save source:", e);
    }
  };

  const confirmDelete = async () => {
    if (!deleteSourceId) return;
    await api.deleteSource(deleteSourceId);
    mutateSources();
    api.getQuota().then(setQuota).catch(() => { });
  };

  usePipelineJobNotifications({
    jobs: activeJobs,
    getFinished,
    dismiss,
    t,
    watchScrape: true,
    watchProcess: false,
    onScrapeHandled: () => {
      mutateSources();
    },
  });

  const filteredSources = React.useMemo(() => {
    if (!searchQuery.trim()) return sources;
    const q = searchQuery.toLowerCase();
    return sources.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.url && s.url.toLowerCase().includes(q))
    );
  }, [sources, searchQuery]);

  return (
    <div className="flex flex-col w-full">
      <div className="w-full">
        <div className="w-full mx-auto py-2">
          <SourcesTextGrid
            loading={loading}
            sources={sources}
            filteredSources={filteredSources}
            searchQuery={searchQuery}
            pipelineStats={pipelineStats}
            language={language}
            openMenuId={openMenuId}
            t={t}
            getRunningJobForSource={getRunningJobForSource}
            onStartCreate={() => {
              const remaining = quota?.resources?.text_sources?.remaining;
              if (remaining === 0) {
                toast.error("图文站点额度已用完", "请删除旧来源或联系管理员升级套餐。");
                return;
              }
              setEditingSourceId(null);
              setName("");
              setUrl("");
              setSourceType("rss");
              setExtractorPrompt("");
              onOpenAddModal();
            }}
            onScrapeSource={async (sourceId) => {
              const isRunning = !!getRunningJobForSource(sourceId);
              if (isRunning) return;
              try {
                const result = await api.triggerSourceScrape(sourceId);
                submitJob(result.job_id, { name: `scrape_source_${sourceId}`, sourceId });
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Failed to fetch feed.";
                toast.error("Error", message);
              }
            }}
            onToggleMenu={setOpenMenuId}
            onEditSource={(source) => {
              setEditingSourceId(source.id);
              setName(source.name);
              setUrl(source.url || "");
              setSourceType(source.source_type);
              setExtractorPrompt(source.extractor_prompt || "");
              onOpenAddModal();
            }}
            onDeleteSource={setDeleteSourceId}
          />
        </div>
      </div>

      <SourcesTextDialogs
        showAddModal={showAddModal}
        editingSourceId={editingSourceId}
        name={name}
        url={url}
        sourceType={sourceType}
        extractorPrompt={extractorPrompt}
        sourceToDelete={sourceToDelete}
        t={t}
        onCloseAddModal={onCloseAddModal}
        onNameChange={setName}
        onUrlChange={setUrl}
        onSourceTypeChange={setSourceType}
        onExtractorPromptChange={setExtractorPrompt}
        onResetEditing={() => setEditingSourceId(null)}
        onSubmit={saveSource}
        deleteSourceId={deleteSourceId}
        onCloseDeleteDialog={() => setDeleteSourceId(null)}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
}
