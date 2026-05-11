"use client";

import * as React from "react";
import { Loader2, Plus, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonitorPageHeaderProps {
  activeCount: number;
  configuredCount: number;
  totalCookiePlatforms: number;
  t: (key: string, fallback?: string) => string;
  onOpenCookieDialog: () => void;
  onOpenAddDialog: () => void;
}

export function MonitorPageHeader({
  activeCount,
  configuredCount,
  totalCookiePlatforms,
  t,
  onOpenCookieDialog,
  onOpenAddDialog,
}: MonitorPageHeaderProps) {
  return (
    <header className="shrink-0 z-40 bg-white/90 dark:bg-[#0b0c0f]/90 backdrop-blur-xl border-b border-zinc-100 dark:border-white/5">
      <div className="px-8 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[14px] font-semibold tracking-[-0.02em]">{t("monitors.title")}</h1>
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {activeCount} {t("monitors.count")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCookieDialog}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t("monitors.cookie")}</span>
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                configuredCount === totalCookiePlatforms && totalCookiePlatforms > 0
                  ? "bg-emerald-500"
                  : configuredCount > 0
                    ? "bg-zinc-400"
                    : "bg-amber-500",
              )}
            />
            <span className="text-zinc-400 dark:text-zinc-500">{configuredCount}/{totalCookiePlatforms}</span>
          </button>
          <button
            onClick={onOpenAddDialog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-zinc-900 border border-zinc-900 text-white dark:bg-white dark:text-zinc-900 dark:border-white hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("monitors.addMonitor")}
          </button>
        </div>
      </div>
    </header>
  );
}

interface MonitorSelectionBarProps {
  totalSelected: number;
  isAnyAnalyzing: boolean;
  t: (key: string, fallback?: string) => string;
  onAnalyzeAll: () => void;
  onClearSelection: () => void;
}

export function MonitorSelectionBar({
  totalSelected,
  isAnyAnalyzing,
  t,
  onAnalyzeAll,
  onClearSelection,
}: MonitorSelectionBarProps) {
  if (!(totalSelected > 0 || isAnyAnalyzing)) return null;

  return (
    <div className="fixed bottom-8 left-[220px] right-0 z-50 flex justify-center pointer-events-none fade-in">
      <div className="pointer-events-auto flex items-center gap-3 px-1.5 py-1.5 rounded-full bg-zinc-900 border border-white/10 shadow-2xl shadow-black/40">
        <span className="pl-3 pr-1 text-[13px] text-zinc-300">
          {t("monitors.selectedVideosPrefix")} <span className="text-white font-semibold">{totalSelected}</span> {t("monitors.selectedVideosSuffix")}
        </span>

        <div className="w-px h-3.5 bg-zinc-700/60" />

        <button
          onClick={onAnalyzeAll}
          disabled={isAnyAnalyzing}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50 cursor-pointer outline-none"
        >
          {isAnyAnalyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              {t("monitors.analyzing")}
            </>
          ) : (
            <>{t("monitors.batchDeconstruct")} ⌘K</>
          )}
        </button>

        {!isAnyAnalyzing && (
          <button
            onClick={onClearSelection}
            className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer outline-none mr-1"
            title={t("monitors.clearSelection")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
