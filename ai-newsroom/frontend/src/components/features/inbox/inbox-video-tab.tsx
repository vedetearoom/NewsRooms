"use client";

import * as React from "react";
import { api } from "@/lib/api";
import type { ManualVideoInboxItem, MonitorTarget, DiscoveredVideo } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { Play, ChevronDown, Link2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "@/components/ui/use-toast";
import { InboxSourceTabs } from "./inbox-source-tabs";
import { InboxVideoSelectionPill } from "./inbox-video-selection-pill";
import { useGroupedSelectableSet } from "@/hooks/useGroupedSelectableSet";
import { MONITOR_PLATFORM_META, getMonitorRelativeTime } from "@/lib/monitor-video-ui";
import { PageEmptyState, PageStateBoundary } from "@/components/shared/page-states";
import { showMonitorSkippedToast } from "@/lib/async-feedback";
import { InboxVideoListCard } from "./inbox-video-list-card";
import { InboxVideoImportBar, type InboxVideoImportMode } from "./inbox-video-import-bar";
import { useUrlTab } from "@/hooks/useUrlTab";
import { useTabsStore } from "@/store/tabs";

type VideoInboxEntry = {
  video: DiscoveredVideo;
  manualItem?: ManualVideoInboxItem;
};

type VideoInboxSection =
  | {
      id: string;
      kind: "monitor";
      monitor: MonitorTarget;
      entries: VideoInboxEntry[];
    }
  | {
      id: "manual";
      kind: "manual";
      entries: VideoInboxEntry[];
    };

function getVideoIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (parsed.hostname.includes("xiaohongshu")) {
      if (parts[0] === "explore" && parts[1]) return `xiaohongshu:${parts[1]}`;
      if (parts[0] === "discovery" && parts[1] === "item" && parts[2]) return `xiaohongshu:${parts[2]}`;
      if (parts[0] === "user" && parts[1] === "profile" && parts[3]) return `xiaohongshu:${parts[3]}`;
    }
  } catch {
    return url;
  }

  return url;
}

function reconcileSelectedUrls(urls: string[], availableVideos: DiscoveredVideo[]): string[] {
  const availableByIdentity = new Map(
    availableVideos.map((video) => [getVideoIdentity(video.url), video.url]),
  );
  return Array.from(
    new Set(urls.map((url) => availableByIdentity.get(getVideoIdentity(url)) || url)),
  );
}

export function InboxVideoTab({
  onCountChange,
  showImportBar = false,
}: {
  onCountChange?: (count: number) => void;
  showImportBar?: boolean;
}) {
  const { t, language } = useTranslation();
  const [monitors, setMonitors] = React.useState<MonitorTarget[]>([]);
  const [manualItems, setManualItems] = React.useState<ManualVideoInboxItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [importMode, setImportMode] = React.useState<InboxVideoImportMode>("url");
  const [importUrl, setImportUrl] = React.useState("");
  const [importError, setImportError] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const setVideoSourceIdAction = useTabsStore(s => s.setInboxVideoSourceId);
  const [activeSourceId, setActiveSourceId] = useUrlTab<string>("v_source", "all", setVideoSourceIdAction);
  const resolvedActiveSourceId = React.useMemo(() => {
    if (activeSourceId === "all" || activeSourceId === "manual" || activeSourceId.startsWith("monitor:")) {
      return activeSourceId;
    }
    return /^\d+$/.test(activeSourceId) ? `monitor:${activeSourceId}` : activeSourceId;
  }, [activeSourceId]);

  // Discovery & Status state
  const [videos, setVideos] = React.useState<Record<number, DiscoveredVideo[]>>({});
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const { selectedByGroup: selectedVideos, toggle: toggleVideo, clear: clearSelectedVideos, totalSelected } = useGroupedSelectableSet<string, string>();
  const [analyzing, setAnalyzing] = React.useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = React.useState(false);
  const [videoStatus, setVideoStatus] = React.useState<Record<string, "queued" | "submitting" | "done" | "error">>({});

  const markSubmitting = React.useCallback((urls: string[]) => {
    setVideoStatus((prev) => {
      const next = { ...prev };
      urls.forEach((url) => {
        next[url] = "submitting";
      });
      return next;
    });
  }, []);

  const markQueued = React.useCallback((urls: string[]) => {
    setVideoStatus((prev) => {
      const next = { ...prev };
      urls.forEach((url) => {
        if (next[url] !== "error") next[url] = "queued";
      });
      return next;
    });
  }, []);

  const markError = React.useCallback((urls: string[]) => {
    setVideoStatus((prev) => {
      const next = { ...prev };
      urls.forEach((url) => {
        if (url) next[url] = "error";
      });
      return next;
    });
  }, []);

  const fetchMonitors = React.useCallback(async () => {
    try {
      const [monitorData, manualData] = await Promise.all([
        api.getMonitors(),
        api.getManualVideoInboxItems(),
      ]);
      setMonitors(monitorData);
      setManualItems(manualData);
      // Populate videos from cache
      setVideos(() => {
        const next: Record<number, DiscoveredVideo[]> = {};
        monitorData.forEach(m => {
          if (m.cached_videos && m.cached_videos.length > 0) {
            next[m.id] = m.cached_videos;
          }
        });
        return next;
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  React.useEffect(() => {
    if (onCountChange) {
      let count = 0;
      for (const vIds of Object.values(videos)) {
        if (vIds) count += vIds.length;
      }
      count += manualItems.length;
      onCountChange(count);
    }
  }, [manualItems.length, onCountChange, videos]);

  const manualEntries = React.useMemo<VideoInboxEntry[]>(() => {
    return manualItems.map((item) => ({
      manualItem: item,
      video: {
        title: item.title,
        url: item.normalized_url,
        published: item.published || (item.source_kind === "file" ? item.created_at : ""),
        thumbnail: item.thumbnail,
        source_kind: item.source_kind,
        original_filename: item.original_filename,
        file_size_bytes: item.file_size_bytes,
        already_analyzed: item.already_analyzed,
        analyzed_card_id: item.linked_card_id,
        last_analyzed_at: item.last_analyzed_at,
        view_count: item.view_count ?? undefined,
        like_count: item.like_count ?? undefined,
        favorite_count: item.favorite_count ?? undefined,
        duration_seconds: item.duration_seconds ?? undefined,
      },
    }));
  }, [manualItems]);

  const monitorSections = React.useMemo<Extract<VideoInboxSection, { kind: "monitor" }>[]>(() => {
    return monitors.filter(m => m.is_active && videos[m.id] && videos[m.id].length > 0)
                   .map(m => {
                     return {
                       id: `monitor:${m.id}`,
                       kind: "monitor" as const,
                       monitor: m,
                       entries: videos[m.id].map(video => ({ video })),
                     };
                   });
  }, [monitors, videos]);

  const allSections = React.useMemo<VideoInboxSection[]>(() => {
    const sections: VideoInboxSection[] = [];
    if (manualEntries.length > 0) {
      sections.push({
        id: "manual",
        kind: "manual",
        entries: manualEntries,
      });
    }
    sections.push(...monitorSections);
    return sections;
  }, [manualEntries, monitorSections]);

  const totalVideos = React.useMemo(() => {
    return allSections.reduce((acc, section) => acc + section.entries.length, 0);
  }, [allSections]);

  const filteredSections = React.useMemo(() => {
    if (resolvedActiveSourceId === "all") return allSections;
    return allSections.filter(section => section.id === resolvedActiveSourceId);
  }, [allSections, resolvedActiveSourceId]);

  const sourceTabItems = React.useMemo(() => {
    const monitorItems = monitorSections.map((section) => ({
      id: section.id,
      label: section.monitor.name,
      count: section.entries.length,
    }));
    if (manualEntries.length === 0) {
      return monitorItems;
    }
    return [
      {
        id: "manual",
        label: t("monitors.manualImportTitle"),
        count: manualEntries.length,
      },
      ...monitorItems,
    ];
  }, [manualEntries.length, monitorSections, t]);

  const manualSourceBadgeLabel = React.useMemo(() => {
    const hasFile = manualItems.some((item) => item.source_kind === "file");
    const hasUrl = manualItems.some((item) => item.source_kind !== "file");

    if (hasFile && hasUrl) {
      return t("monitors.manualImportMixedSubtitle");
    }
    if (hasFile) {
      return t("monitors.manualImportLocalSubtitle");
    }
    return t("monitors.manualImportSubtitle");
  }, [manualItems, t]);

  const manualItemByUrl = React.useMemo(() => {
    return new Map(manualItems.map(item => [item.normalized_url, item]));
  }, [manualItems]);

  // ── Analyze all selected ──
  const handleAnalyzeAll = async () => {
    const monitorSelections: Record<number, string[]> = {};
    const manualSelections: string[] = [];

    for (const [monitorId, urls] of Object.entries(selectedVideos)) {
      if (urls.size > 0) {
        if (monitorId === "manual") {
          manualSelections.push(...Array.from(urls));
        } else if (monitorId.startsWith("monitor:")) {
          const numericMonitorId = Number(monitorId.replace("monitor:", ""));
          monitorSelections[numericMonitorId] = reconcileSelectedUrls(
            Array.from(urls),
            videos[numericMonitorId] || [],
          );
        }
      }
    }
    
    if (Object.keys(monitorSelections).length === 0 && manualSelections.length === 0) return;

    for (const [mIdStr, urls] of Object.entries(monitorSelections)) {
      const monitorId = Number(mIdStr);
      const groupId = `monitor:${monitorId}`;
      setAnalyzing(prev => ({ ...prev, [groupId]: true }));
      markSubmitting(urls);
      
      try {
        const res = await api.dispatchAnalysis(monitorId, urls);
        if (res.skipped?.length) {
          for (const s of res.skipped) {
            showMonitorSkippedToast(s.reason, t);
            if (s.url) markError([s.url]);
          }
        }
        markQueued(urls);
      } catch (e) {
        console.error("Dispatch failed", e);
        markError(urls);
      } finally {
        setAnalyzing(prev => ({ ...prev, [groupId]: false }));
      }
    }

    if (manualSelections.length > 0) {
      markQueued(manualSelections);
    }

    clearSelectedVideos();
    await fetchMonitors();
  };

  const handleReanalyzeMonitor = async (monitorId: number, url: string) => {
    const groupId = `monitor:${monitorId}`;
    setAnalyzing(prev => ({ ...prev, [groupId]: true }));
    const [resolvedUrl] = reconcileSelectedUrls([url], videos[monitorId] || []);
    markSubmitting([resolvedUrl]);

    try {
      const res = await api.dispatchAnalysis(monitorId, [resolvedUrl]);
      if (res.skipped?.length) {
        for (const s of res.skipped) {
          showMonitorSkippedToast(s.reason, t);
          markError([s.url]);
        }
      }
    } catch (error) {
      console.error("Re-dispatch failed", error);
      markError([resolvedUrl]);
    } finally {
      setAnalyzing(prev => ({ ...prev, [groupId]: false }));
    }

    fetchMonitors();
  };

  const handleDeleteSelected = async () => {
    const deleteRequests: Promise<{ ok: boolean; removed: number }>[] = [];
    const manualItemIds: number[] = [];

    for (const [groupId, urls] of Object.entries(selectedVideos)) {
      if (urls.size === 0) continue;

      if (groupId === "manual") {
        for (const url of urls) {
          const item = manualItemByUrl.get(url);
          if (item) {
            manualItemIds.push(item.id);
          }
        }
        continue;
      }

      if (!groupId.startsWith("monitor:")) continue;

      const numericMonitorId = Number(groupId.replace("monitor:", ""));
      const resolvedUrls = reconcileSelectedUrls(
        Array.from(urls),
        videos[numericMonitorId] || [],
      );

      if (resolvedUrls.length > 0) {
        deleteRequests.push(api.deleteMonitorCachedVideos(numericMonitorId, resolvedUrls));
      }
    }

    const uniqueManualItemIds = Array.from(new Set(manualItemIds));
    if (uniqueManualItemIds.length > 0) {
      deleteRequests.push(api.deleteManualVideoInboxItems(uniqueManualItemIds));
    }

    if (deleteRequests.length === 0) {
      clearSelectedVideos();
      return;
    }

    setDeleting(true);
    try {
      const results = await Promise.all(deleteRequests);
      const removedCount = results.reduce((sum, result) => sum + (result.removed || 0), 0);
      clearSelectedVideos();
      await fetchMonitors();
      toast.success(
        t("monitors.deleteSelectedSuccessTitle"),
        t("monitors.deleteSelectedSuccessDesc").replace("{count}", String(removedCount)),
      );
    } catch (error) {
      console.error("Delete selected inbox videos failed", error);
      const message = error instanceof Error ? error.message : t("monitors.deleteSelectedFailedDesc");
      toast.error(t("monitors.deleteSelectedFailedTitle"), message);
    } finally {
      setDeleting(false);
    }
  };

  const handleImportManualVideo = async () => {
    const value = importUrl.trim();
    if (!value) return;

    setImporting(true);
    setImportError("");
    try {
      await api.importManualVideoUrls([value]);
      setImportUrl("");
      await fetchMonitors();
    } catch (error) {
      console.error("Manual video import failed", error);
      const message = error instanceof Error ? error.message : t("monitors.manualImportFailedDesc");
      setImportError(message);
      toast.error(t("monitors.manualImportFailedTitle"), message);
    } finally {
      setImporting(false);
    }
  };

  const isAnyAnalyzing = Object.values(analyzing).some(Boolean);

  return (
    <div className="flex flex-col w-full relative">
      <AnimatePresence initial={false}>
        {showImportBar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <InboxVideoImportBar
                mode={importMode}
                urlValue={importUrl}
                selectedFile={null}
                loading={importing}
                errorMessage={importError}
                onModeChange={(mode) => {
                  setImportMode(mode);
                  setImportError("");
                }}
                onUrlChange={(value) => {
                  setImportUrl(value);
                  if (importError) setImportError("");
                }}
                onUrlSubmit={handleImportManualVideo}
                onFileSelect={() => {}}
                onFileSubmit={() => {}}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Monitor filters ── */}
      <div className="shrink-0 pb-0 pt-0 mb-4 px-1 min-h-[42px]">
        {allSections.length > 0 && !loading && (
          <InboxSourceTabs
            items={sourceTabItems}
            activeId={resolvedActiveSourceId}
            allLabel={t("inbox.all")}
            allCount={totalVideos}
            dividerAfterAll={true}
            onChange={(id) => {
              setActiveSourceId(String(id));
              clearSelectedVideos();
            }}
          />
        )}
      </div>

          <div className="w-full pt-1">
        {/* Video Sections */}
        <PageStateBoundary
          loading={loading}
          isEmpty={allSections.length === 0 || filteredSections.length === 0}
          loadingLabel={t("common.loading")}
          emptyState={
            allSections.length === 0 ? (
              <PageEmptyState
                icon={Play}
                title={t("monitors.manualImportEmptyTitle")}
                description={t("monitors.manualImportEmptyDesc")}
              />
            ) : (
              <PageEmptyState
                icon={Play}
                title={t("pipeline.emptyTitle")}
                description={t("inbox.videoFilteredEmptyDesc")}
              />
            )
          }
        >
          <div className="flex flex-col space-y-5 pb-24">
            {filteredSections.map((section) => {
              const selected = selectedVideos[section.id] || new Set<string>();
              const pMeta = section.kind === "monitor"
                ? (MONITOR_PLATFORM_META[section.monitor.platform] || { icon: "🎬", label: section.monitor.platform, color: "bg-zinc-100 text-zinc-600" })
                : null;
              const isCollapsed = collapsed.has(section.id);

              return (
                <div
                  key={section.id}
                  className="group flex flex-col overflow-hidden rounded-[22px] bg-[#fbfbfa] shadow-[0_1px_0_rgba(15,23,42,0.03),0_10px_24px_rgba(15,23,42,0.025)] transition-all dark:bg-white/[0.02]"
                >
                  {/* Monitor Section Header */}
                  <div 
                    onClick={() => toggleCollapse(section.id)}
                    className="flex cursor-pointer items-center px-5 py-4.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400">
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isCollapsed && "-rotate-90")} />
                      </span>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/65 text-[14px] font-bold text-zinc-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.03)] transition-colors dark:bg-white/[0.04] dark:text-zinc-500 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                        {section.kind === "manual" ? <Link2 className="w-4 h-4" /> : section.monitor.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-zinc-900/92 dark:text-zinc-100">
                            {section.kind === "manual" ? t("monitors.manualImportTitle") : section.monitor.name}
                          </span>
                          {section.kind === "manual" ? (
                            <span className="rounded-full bg-white/72 px-2 py-0.5 text-[10px] font-medium leading-none text-zinc-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.03)] dark:bg-white/[0.045] dark:text-zinc-300 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
                              {manualSourceBadgeLabel}
                            </span>
                          ) : (
                            <>
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap", pMeta?.color)}>
                                {MONITOR_PLATFORM_META[section.monitor.platform] ? t(`monitors.platforms.${section.monitor.platform}`) : section.monitor.platform}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                                {t('monitors.manual')}
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[12px] text-zinc-400/90 font-mono">
                          {section.kind === "manual"
                            ? `${section.entries.length} ${t("monitors.manualImportedVideos")}`
                            : section.monitor.last_checked_at
                              ? getMonitorRelativeTime(section.monitor.last_checked_at, language)
                              : t("monitors.neverChecked")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Monitor Videos Grid */}
                  {!isCollapsed && (
                    <div className="px-5 pb-5 pt-1.5">
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                        {section.entries.map((entry) => {
                          const video = entry.video;
                          const isSelected = selected.has(video.url);
                          const isAnalyzed = entry.manualItem ? entry.manualItem.already_analyzed : video.already_analyzed;
                          const vStatus = videoStatus[video.url]
                            ?? (entry.manualItem?.status === "error"
                              ? "error"
                              : entry.manualItem?.status === "submitting"
                                ? "submitting"
                                : entry.manualItem?.status === "queued"
                                  ? "queued"
                                  : undefined);

                          return (
                            <InboxVideoListCard
                              key={video.url}
                              video={video}
                              isSelected={isSelected}
                              isAnalyzed={isAnalyzed}
                              vStatus={vStatus}
                              onToggle={() => toggleVideo(section.id, video.url)}
                              onReanalyze={section.kind === "monitor" ? () => {
                                void handleReanalyzeMonitor(section.monitor.id, video.url);
                              } : undefined}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PageStateBoundary>
      </div>

      {/* ══ Floating Action Bar (Pill) ══ */}
      <InboxVideoSelectionPill
        totalSelected={totalSelected as number}
        isAnyAnalyzing={isAnyAnalyzing}
        isDeleting={deleting}
        onAnalyzeAll={handleAnalyzeAll}
        onDelete={handleDeleteSelected}
        onClear={clearSelectedVideos}
      />
    </div>
  );
}
