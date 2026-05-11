"use client";

import * as React from "react";
import { ChevronRight, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CookiePlatformConfig, DiscoveredVideo, MonitorTarget } from "@/lib/api";
import { getMonitorRelativeTime } from "@/lib/monitor-video-ui";
import { MonitorVideoCard } from "@/components/shared/monitor-video-card";

interface PlatformMeta {
  icon: React.ReactNode;
  color: string;
  disabledKey?: string;
}

interface MonitorListProps {
  monitors: MonitorTarget[];
  videos: Record<number, DiscoveredVideo[]>;
  checking: Record<number, boolean>;
  expanded: Set<number>;
  selectedVideos: Record<number, Set<string>>;
  checkErrors: Record<number, string>;
  videoStatus: Record<string, "queued" | "submitting" | "done" | "error">;
  cookiePlatforms: CookiePlatformConfig[];
  platformMeta: Record<string, PlatformMeta>;
  t: (key: string, fallback?: string) => string;
  language: string;
  onToggleExpanded: (id: number) => void;
  onCheckMonitor: (monitor: MonitorTarget) => void;
  onToggleVideo: (monitorId: number, url: string) => void;
  onEditMonitor: (monitor: MonitorTarget) => void;
  onDeleteMonitor: (monitor: MonitorTarget) => void;
  onOpenCookieDialog: () => void;
}

export function MonitorList({
  monitors,
  videos,
  checking,
  expanded,
  selectedVideos,
  checkErrors,
  videoStatus,
  cookiePlatforms,
  platformMeta,
  t,
  language,
  onToggleExpanded,
  onCheckMonitor,
  onToggleVideo,
  onEditMonitor,
  onDeleteMonitor,
  onOpenCookieDialog,
}: MonitorListProps) {
  return (
    <div className="flex flex-col space-y-4">
      {monitors.map((monitor) => {
        const pMeta = platformMeta[monitor.platform] || { icon: "🎬", color: "bg-zinc-100 text-zinc-600" };
        const monitorVideos = videos[monitor.id] || [];
        const isExpanded = expanded.has(monitor.id);
        const selected = selectedVideos[monitor.id] || new Set<string>();
        const checkError = checkErrors[monitor.id] || "";
        const isChecking = checking[monitor.id] || monitor.last_check_status === "queued" || monitor.last_check_status === "running";
        const statusLabel =
          monitor.last_check_status === "queued"
            ? t("monitors.queued", "Queued")
            : monitor.last_check_status === "running"
              ? t("monitors.checking", "Checking")
              : monitor.last_check_status === "failed"
                ? t("monitors.checkFailed", "Check failed")
                : null;

        return (
          <div
            key={monitor.id}
            className={cn(
              "group flex flex-col bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-white/[0.08] rounded-2xl transition-all shadow-sm",
              isExpanded ? "bg-zinc-50/50 dark:bg-zinc-900/50" : "hover:border-zinc-300 dark:hover:border-white/20",
            )}
          >
            <div
              className={cn(
                "px-4 py-4 flex items-center justify-between cursor-pointer rounded-2xl transition-colors",
                !isExpanded && "hover:bg-zinc-50/50 dark:hover:bg-white/[0.02]",
              )}
              onClick={() => onToggleExpanded(monitor.id)}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <ChevronRight className={cn("w-5 h-5 shrink-0 text-zinc-400 transition-transform duration-200", isExpanded && "rotate-90")} />

                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/60 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-zinc-500 dark:text-zinc-400 font-bold text-[14px]">
                  {monitor.name.charAt(0)}
                </div>

                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{monitor.name}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium leading-none whitespace-nowrap", pMeta.color)}>
                      {platformMeta[monitor.platform] ? t(`monitors.platforms.${monitor.platform}`) : monitor.platform}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                      {t("monitors.manual")}
                    </span>
                  </div>
                  <span className="text-[12px] text-zinc-400 font-mono">
                    {monitor.last_checked_at
                      ? getMonitorRelativeTime(monitor.last_checked_at, language)
                      : t("monitors.neverChecked")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 w-48" onClick={(event) => event.stopPropagation()}>
                {statusLabel && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      monitor.last_check_status === "failed"
                        ? "bg-red-50 text-red-500 dark:bg-red-500/10"
                        : "bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-300",
                    )}
                  >
                    {statusLabel}
                  </span>
                )}
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onCheckMonitor(monitor);
                  }}
                  disabled={isChecking}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                  title={t("monitors.check", "Check")}
                >
                  <RefreshCw className={cn("w-4 h-4", isChecking && "animate-spin")} />
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditMonitor(monitor);
                    }}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title={t("monitors.editMonitor")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteMonitor(monitor);
                    }}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                    title={t("monitors.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-zinc-100 dark:border-white/5 px-5 py-4">
                {checkError && (
                  <div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5">
                    <p className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium mb-1">{t("monitors.checkFailed")}</p>
                    <p className="text-[11px] text-zinc-500/80 dark:text-zinc-400/70 whitespace-pre-wrap">{checkError}</p>
                    {cookiePlatforms.find((platform) => platform.key === monitor.platform && !platform.is_configured) && (
                      <button
                        onClick={onOpenCookieDialog}
                        className="mt-2 text-[11px] font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer underline"
                      >
                        {t("monitors.clickToConfig")} {t(`monitors.platforms.${monitor.platform}`)} {t("monitors.cookie")}
                      </button>
                    )}
                  </div>
                )}

                {monitorVideos.length === 0 && !checkError ? (
                  <p className="text-[12px] text-muted-foreground/50 text-center py-6">
                    {t("monitors.noVideos")}
                  </p>
                ) : monitorVideos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {monitorVideos.map((video) => {
                      const isSelected = selected.has(video.url);
                      const isAnalyzed = video.already_analyzed;
                      const vStatus = videoStatus[video.url];

                      return (
                        <MonitorVideoCard
                          key={video.url}
                          video={video}
                          language={language}
                          isSelected={isSelected}
                          isAnalyzed={isAnalyzed}
                          status={vStatus}
                          variant="compact"
                          deconstructLabel={t("monitors.deconstruct")}
                          tooLongLabel={t("monitors.tooLong")}
                          submittingLabel={t("monitors.submitting")}
                          queuedLabel={t("monitors.queued")}
                          submitFailedLabel={t("monitors.submitFailed")}
                          alreadyAnalyzedLabel={t("monitors.alreadyAnalyzed")}
                          onClick={() => onToggleVideo(monitor.id, video.url)}
                          contentClassName="p-2"
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
