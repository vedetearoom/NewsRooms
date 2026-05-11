"use client";

import * as React from "react";
import { api, type InspirationAsset } from "@/lib/api";
import { Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTabsStore } from "@/store/tabs";
import { useUrlTab } from "@/hooks/useUrlTab";
import { useVaultLabStore } from "@/store/vault-lab-store";
import { Suspense } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ContextLabView } from "@/components/features/vault/context-lab-view";
import { InspirationSidebar } from "@/components/features/vault/inspiration-sidebar";
import { InspirationDetailHeader } from "@/components/features/vault/inspiration-detail-header";
import { InspirationDetailTabs } from "@/components/features/vault/inspiration-detail-tabs";
import { InspirationTabContent } from "@/components/features/vault/inspiration-tab-content";
import { PageEmptyState, PageErrorState } from "@/components/shared/page-states";
import { PageShellFallback } from "@/components/shared/page-shell-fallback";

export default function InspirationsPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <InspirationsContent />
    </Suspense>
  );
}

function InspirationsContent() {
  const { t, language } = useTranslation();

  type HookAnalysisData = {
    analysis?: string;
  };

  type InspirationExtraData = InspirationAsset["extra_data"] & {
    media_type?: string;
    source_urls?: string[];
    hook_analysis?: HookAnalysisData;
    original_key_points?: string[];
    original_summary?: string;
  };

  const [inspirations, setInspirations] = React.useState<InspirationAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const setVaultInspirationIdAction = useTabsStore(s => s.setVaultInspirationId);
  const [activeIdStr, setActiveIdStr] = useUrlTab<string>("id", "", (value) => {
    setVaultInspirationIdAction(value ? Number(value) : null);
  });
  
  // We use the ID from the URL/Store as the source of truth, but we still need the full object for rendering
  const viewingInspiration = React.useMemo(() => {
    if (!activeIdStr) return inspirations.length > 0 ? inspirations[0] : null;
    const target = inspirations.find(i => String(i.id) === activeIdStr);
    return target || (inspirations.length > 0 ? inspirations[0] : null);
  }, [inspirations, activeIdStr]);

  const setViewingInspiration = React.useCallback((item: InspirationAsset | null) => {
    setActiveIdStr(item ? String(item.id) : "");
  }, [setActiveIdStr]);
  const setDetailTabAction = useTabsStore(s => s.setVaultDetailTab);
  const [detailTab, setDetailTab] = useUrlTab<"summary" | "structure" | "transcript" | "fulltext">("tab", "summary", setDetailTabAction);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [showFullStructure, setShowFullStructure] = React.useState(false);
  const [showFullTranscript, setShowFullTranscript] = React.useState(false);
  
  const { selectedInspirationIds, toggleSelection, clearSelection } = useVaultLabStore();

  const extraData = (viewingInspiration?.extra_data || {}) as InspirationExtraData;
  const isText = viewingInspiration?.platform === 'article' || extraData.media_type === 'text';
  const effectiveTab = isText ? (['summary', 'fulltext'].includes(detailTab) ? detailTab : 'summary') : detailTab;

  // Audio Player State
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = React.useState(0);
  const [audioDuration, setAudioDuration] = React.useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const fetchInspirations = React.useCallback(async () => {
    try {
      setLoadError("");
      const data = await api.getInspirations();
      setInspirations(data);
      // We don't need to manually set viewingInspiration here anymore, 
      // the useMemo hook will automatically select the target based on URL ID or default to data[0].
    } catch (e) {
      console.error("Failed to load inspirations", e);
      setLoadError(t("vault.inspirationsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    fetchInspirations();
  }, [fetchInspirations]);

  React.useEffect(() => {
    // Reset audio state when viewing different inspiration
    setIsPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [viewingInspiration]);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      const assetToDelete = inspirations.find(i => i.id === deletingId);
      await api.deleteInspiration(deletingId);
      const updated = inspirations.filter(i => i.id !== deletingId);
      setInspirations(updated);
      
      // Sync with localStorage so Inbox cards reflect the unsaved state
      if (assetToDelete && assetToDelete.source_url) {
        try {
          const savedUrls = JSON.parse(localStorage.getItem("newsroom:saved_inspirations") || "[]");
          const updatedUrls = savedUrls.filter((u: string) => u !== assetToDelete.source_url);
          localStorage.setItem("newsroom:saved_inspirations", JSON.stringify(updatedUrls));
        } catch(e) { console.error("Failed to sync delete to localStorage", e); }
      }

      if (viewingInspiration?.id === deletingId) {
        setViewingInspiration(updated[0] || null);
      }
    } catch (e) {
      console.error("Failed to delete", e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };

  // Group by platform
  const groupedInspirations = React.useMemo(() => {
    const groups: Record<string, InspirationAsset[]> = {};
    inspirations.forEach(insp => {
      const p = (insp.platform || "Uncategorized").toUpperCase();
      if (!groups[p]) groups[p] = [];
      groups[p].push(insp);
    });
    return groups;
  }, [inspirations]);

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-[#0b0c0f]">
      <InspirationSidebar
        inspirations={inspirations}
        groupedInspirations={groupedInspirations}
        viewingInspiration={viewingInspiration}
        loading={loading}
        loadError={loadError}
        selectedInspirationIds={selectedInspirationIds}
        onSelectInspiration={setViewingInspiration}
        onToggleSelection={toggleSelection}
        onClearSelection={clearSelection}
        onDelete={handleDelete}
        onRetry={fetchInspirations}
      />

      {/* ── Detail View / Context Lab ── */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0b0c0f] relative overflow-hidden transition-opacity duration-200 ease-in-out">
        {selectedInspirationIds.length >= 2 ? (
          <ContextLabView 
            inspirations={inspirations} 
            selectedIds={selectedInspirationIds} 
          />
        ) : viewingInspiration ? (
          <div className="flex-1 overflow-y-auto relative animate-in fade-in duration-300">
            
            <div className="px-10 lg:px-16 pt-16 pb-32 max-w-5xl mx-auto w-full relative">
              
              <InspirationDetailHeader
                viewingInspiration={viewingInspiration}
                extraData={extraData}
                isText={isText}
                isPlaying={isPlaying}
                audioCurrentTime={audioCurrentTime}
                audioDuration={audioDuration}
                audioRef={audioRef}
                formatDate={formatDate}
                onTogglePlay={togglePlay}
                onSeek={(e) => {
                  if (!audioRef.current || !audioDuration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  audioRef.current.currentTime = percent * audioDuration;
                }}
                onTimeUpdate={setAudioCurrentTime}
                onLoadedMetadata={setAudioDuration}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              <InspirationDetailTabs
                isText={isText}
                effectiveTab={effectiveTab}
                onSelectTab={setDetailTab}
              />

              <InspirationTabContent
                effectiveTab={effectiveTab}
                isText={isText}
                viewingInspiration={viewingInspiration}
                extraData={extraData}
                showFullStructure={showFullStructure}
                showFullTranscript={showFullTranscript}
                onCopy={handleCopy}
                onToggleFullStructure={setShowFullStructure}
                onToggleFullTranscript={setShowFullTranscript}
              />

            </div>



          </div>
        ) : !loading && loadError ? (
          <PageErrorState
            title={t("vault.inspirationsLoadFailed")}
            description={loadError}
            action={{
              label: t("vault.retry"),
              onClick: fetchInspirations,
            }}
          />
        ) : (
          !loading && (
            <PageEmptyState
              className="flex-1"
              icon={Sparkles}
              title={t("vault.inspirationDetailEmptyTitle")}
              description={t("vault.inspirationDetailEmptyDesc")}
            />
          )
        )}
      </div>

      <ConfirmModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title={t("vault.deleteInspirationTitle")}
        description={t("vault.deleteInspirationDesc")}
        confirmText={t("vault.deleteInspirationConfirm")}
        cancelText={t("pipeline.cancel")}
        isDestructive={true}
      />
    </div>
  );
}
