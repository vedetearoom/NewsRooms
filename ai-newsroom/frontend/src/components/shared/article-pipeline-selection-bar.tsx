"use client";

import { CheckSquare, Sparkles, Trash2, X } from "lucide-react";

import type { RawArticle } from "@/lib/api";

interface ArticlePipelineSelectionBarProps {
  selectedCount: number;
  filteredArticles: RawArticle[];
  selectedIds: Set<number>;
  processing: boolean;
  t: (key: string, fallback?: string) => string;
  onSelectAllVisible: () => void;
  onProcess: () => void;
  onDelete: () => void;
  onClear: () => void;
  className?: string;
}

export function ArticlePipelineSelectionBar({
  selectedCount,
  filteredArticles,
  selectedIds,
  processing,
  t,
  onSelectAllVisible,
  onProcess,
  onDelete,
  onClear,
  className,
}: ArticlePipelineSelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  const selectedArticles = filteredArticles.filter((article) => selectedIds.has(article.id));
  const hasProcessedSelected = selectedArticles.some((article) => article.is_processed);
  const allVisibleSelected =
    filteredArticles.length > 0 && filteredArticles.every((article) => selectedIds.has(article.id));

  return (
    <div
      className={
        className ??
        "fixed bottom-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-white shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 duration-300"
      }
    >
      <span className="whitespace-nowrap text-[13.5px] font-medium">
        {selectedCount} {selectedCount === 1 ? t("pipeline.itemSelected") : t("pipeline.selected")}
      </span>
      <div className="h-4 w-px bg-white/20" />

      <div className="flex items-center gap-2">
        <button
          onClick={onSelectAllVisible}
          className="mr-2 flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-zinc-300 transition-colors hover:text-white"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {allVisibleSelected ? t("pipeline.deselectAll") : t("pipeline.selectAll")}
        </button>

        {!hasProcessedSelected ? (
          <button
            onClick={onProcess}
            disabled={processing}
            className="mr-1 flex items-center gap-1.5 whitespace-nowrap px-1 text-[13px] font-medium text-white transition-colors hover:text-zinc-300 disabled:opacity-50"
          >
            {processing ? (
              <svg className="h-3.5 w-3.5 animate-spin text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-current" />
            )}
            {processing ? t("pipeline.processing") : t("pipeline.process")}
          </button>
        ) : null}

        <button
          onClick={onDelete}
          className="ml-2 flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-red-400 transition-colors hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" /> {t("pipeline.delete")}
        </button>
        <button
          onClick={onClear}
          className="ml-2 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          title={t("pipeline.clearSelection")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
