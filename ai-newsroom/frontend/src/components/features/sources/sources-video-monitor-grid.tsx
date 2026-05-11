"use client";

import * as React from "react";
import type { DiscoveredVideo, MonitorTarget } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ExternalLink, MoreHorizontal, Pencil, Play, RefreshCw, Trash2 } from "lucide-react";
import { getMonitorRelativeTime } from "@/lib/monitor-video-ui";
import { PageEmptyState, PageStateBoundary } from "@/components/shared/page-states";

interface PlatformMetaItem {
  icon: React.ReactNode;
  color: string;
  disabledKey?: string;
}

interface SourcesVideoMonitorGridProps {
  loading: boolean;
  monitors: MonitorTarget[];
  searchQuery: string;
  videos: Record<number, DiscoveredVideo[]>;
  checking: Record<number, boolean>;
  checkErrors: Record<number, string>;
  openMenuId: number | null;
  language: string;
  t: (key: string, fallback?: string) => string;
  platformMeta: Record<string, PlatformMetaItem>;
  onOpenAddModal: () => void;
  onOpenCookieDialog: () => void;
  onCheck: (monitor: MonitorTarget) => void;
  onToggleMenu: (id: number | null) => void;
  onEdit: (monitor: MonitorTarget) => void;
  onDelete: (monitor: MonitorTarget) => void;
}

export function SourcesVideoMonitorGrid({
  loading,
  monitors,
  searchQuery,
  videos,
  checking,
  checkErrors,
  openMenuId,
  language,
  t,
  platformMeta,
  onOpenAddModal,
  onOpenCookieDialog,
  onCheck,
  onToggleMenu,
  onEdit,
  onDelete,
}: SourcesVideoMonitorGridProps) {
  const visibleMonitors = monitors.filter(
    (monitor) =>
      monitor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      monitor.homepage_url.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <PageStateBoundary
      loading={loading}
      isEmpty={monitors.length === 0 || visibleMonitors.length === 0}
      loadingLabel={t("common.loading", "Loading...")}
      emptyState={
        monitors.length === 0 ? (
          <PageEmptyState
            icon={Play}
            title={t("monitors.emptyTitle", "暂无监控博主")}
            description={t("monitors.emptyDesc", "添加对标博主的主页链接，系统会自动发现他们的最新视频。")}
            action={{
              label: t("monitors.addMonitor"),
              onClick: onOpenAddModal,
            }}
          />
        ) : (
          <PageEmptyState
            icon={Play}
            title={t("pipeline.emptyTitle")}
            description={t("monitors.emptySearchDesc", "No video monitors match this search.")}
          />
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {visibleMonitors.map((monitor) => {
        const pMeta = platformMeta[monitor.platform] || {
          icon: "🎬",
          color: "bg-zinc-100 text-zinc-600",
        };
        const monitorVideos = videos[monitor.id] || [];
        const isChecking = checking[monitor.id] || false;
        const checkError = checkErrors[monitor.id] || "";

        return (
          <div
            key={monitor.id}
            className="group relative flex flex-col items-start gap-3 p-5 rounded-[20px] bg-zinc-50/80 dark:bg-white/[0.02] border border-border/50 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-all duration-200"
          >
            <div className="w-full flex items-start justify-between">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]">
                {monitor.name.charAt(0)}
              </div>

              <div className="relative flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheck(monitor);
                  }}
                  disabled={isChecking}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors",
                    isChecking && "opacity-50 cursor-not-allowed",
                  )}
                  title={t("monitors.check")}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isChecking && "animate-spin text-blue-500")} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMenu(openMenuId === monitor.id ? null : monitor.id);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {openMenuId === monitor.id && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-[#1C1D21] border border-border shadow-xl rounded-lg overflow-hidden py-1 z-10 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(monitor);
                        onToggleMenu(null);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] font-medium text-foreground hover:bg-background transition-colors flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      {t("vault.edit")}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(monitor);
                        onToggleMenu(null);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("inbox.delete")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 w-full mt-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[15px] text-zinc-900 dark:text-white truncate">
                  {monitor.name}
                </h3>
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium leading-none whitespace-nowrap", pMeta.color)}>
                  {platformMeta[monitor.platform] ? t(`monitors.platforms.${monitor.platform}`) : monitor.platform}
                </span>
              </div>

              <div className="text-xs text-zinc-500 mt-1 flex flex-wrap items-center w-full leading-relaxed">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shadow-sm",
                      monitor.is_active !== false
                        ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-300",
                    )}
                  />
                  {monitor.is_active !== false ? t("monitors.active") : t("monitors.paused")}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600 mx-1.5 shrink-0">·</span>
                <span className="shrink-0">
                  {monitor.last_checked_at ? getMonitorRelativeTime(monitor.last_checked_at, language) : t("monitors.neverChecked")}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600 mx-1.5 shrink-0">·</span>
                <span className="shrink-0">
                  {t("monitors.fetchedCountPrefix", "")}{monitorVideos.length}{t("monitors.fetchedCountSuffix", " fetched")}
                </span>
              </div>
            </div>

            {checkError && (
              <div className="w-full bg-red-500/10 px-2 py-1.5 rounded-md mt-1">
                <div className="text-[11px] text-red-500 leading-relaxed line-clamp-2">{checkError}</div>
                {monitor.platform === "bilibili" && monitor.discovery_mode === "rsshub" && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenCookieDialog();
                    }}
                    className="mt-1 text-[11px] font-medium text-red-500 hover:text-red-600 underline underline-offset-2"
                  >
                    {t("monitors.cookieConfigTitle")}
                  </button>
                )}
              </div>
            )}

            <div className="mt-2 w-full pt-4 border-t border-zinc-200/60 dark:border-white/[0.04]">
              {(() => {
                let domain = monitor.homepage_url;
                try {
                  domain = new URL(monitor.homepage_url).hostname.replace("www.", "");
                } catch {
                  /* ignore invalid URLs */
                }

                return (
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={monitor.homepage_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex min-w-0 items-center gap-1.5 text-sm font-normal text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 truncate hover:underline transition-colors group/link"
                    >
                      <span className="truncate">{domain}</span>
                      <ExternalLink className="w-3 h-3 opacity-50 group-hover/link:opacity-100 shrink-0 transition-opacity" />
                    </a>
                    <span className="shrink-0 rounded-full border border-zinc-200/70 bg-zinc-100/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
                      {monitor.discovery_mode === "cookie"
                        ? t("monitors.discoveryModeCookieShort", "Cookie")
                        : t("monitors.discoveryModeRssShort", "RSS")}
                    </span>
                  </div>
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
