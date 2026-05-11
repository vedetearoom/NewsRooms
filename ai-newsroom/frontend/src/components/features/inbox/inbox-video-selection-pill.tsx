"use client";

import { Loader2, Sparkles, Trash2, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface InboxVideoSelectionPillProps {
  totalSelected: number;
  isAnyAnalyzing: boolean;
  isDeleting: boolean;
  onAnalyzeAll: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function InboxVideoSelectionPill({
  totalSelected,
  isAnyAnalyzing,
  isDeleting,
  onAnalyzeAll,
  onDelete,
  onClear,
}: InboxVideoSelectionPillProps) {
  const { t } = useTranslation();
  const isBusy = isAnyAnalyzing || isDeleting;

  if (!(totalSelected > 0 || isBusy)) return null;

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-zinc-900 border border-zinc-800 text-white px-5 py-2.5 rounded-full shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 duration-300">
      <span className="text-[13.5px] font-medium whitespace-nowrap">
        {t("monitors.selectedVideosPrefix")} <span className="text-white font-semibold">{totalSelected}</span> {t("monitors.selectedVideosSuffix")}
      </span>

      <div className="w-px h-4 bg-white/20" />

      <button
        onClick={onAnalyzeAll}
        disabled={isBusy}
        className="flex items-center gap-1.5 text-[13px] font-medium text-white hover:text-zinc-300 transition-colors disabled:opacity-50 whitespace-nowrap px-1 mr-1 disabled:cursor-not-allowed"
      >
        {isAnyAnalyzing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
            {t("monitors.analyzing")}
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-current" />
            {t("monitors.batchDeconstruct")}
          </>
        )}
      </button>

      <div className="w-px h-4 bg-white/20" />

      <button
        onClick={onDelete}
        disabled={isBusy}
        className="flex items-center gap-1.5 text-[13px] font-medium text-white hover:text-zinc-300 transition-colors disabled:opacity-50 whitespace-nowrap px-1 disabled:cursor-not-allowed"
      >
        {isDeleting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
            {t("monitors.deletingSelected")}
          </>
        ) : (
          <>
            <Trash2 className="w-3.5 h-3.5 text-current" />
            {t("monitors.deleteSelected")}
          </>
        )}
      </button>

      {!isBusy && (
        <button
          onClick={onClear}
          className="flex items-center justify-center ml-2 w-6 h-6 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          title={t("monitors.clearSelection")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
