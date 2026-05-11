"use client";

import type { RawArticle } from "@/lib/api";
import { ArticlePipelineSelectionBar } from "@/components/shared/article-pipeline-selection-bar";

interface PipelineSelectionBarProps {
  selectedIds: Set<number>;
  filteredArticles: RawArticle[];
  processing: boolean;
  t: (key: string) => string;
  onSelectAllVisible: () => void;
  onProcess: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function PipelineSelectionBar({
  selectedIds,
  filteredArticles,
  processing,
  t,
  onSelectAllVisible,
  onProcess,
  onDelete,
  onClear,
}: PipelineSelectionBarProps) {
  return (
    <ArticlePipelineSelectionBar
      selectedCount={selectedIds.size}
      filteredArticles={filteredArticles}
      selectedIds={selectedIds}
      processing={processing}
      t={t}
      onSelectAllVisible={onSelectAllVisible}
      onProcess={onProcess}
      onDelete={onDelete}
      onClear={onClear}
      className="absolute bottom-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-white shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 duration-300"
    />
  );
}
