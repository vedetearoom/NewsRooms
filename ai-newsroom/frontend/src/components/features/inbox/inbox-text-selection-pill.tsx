"use client";

import type { RawArticle } from "@/lib/api";
import { ArticlePipelineSelectionBar } from "@/components/shared/article-pipeline-selection-bar";

interface InboxTextSelectionPillProps {
  selectedCount: number;
  filteredArticles: RawArticle[];
  selectedIds: Set<number>;
  processing: boolean;
  t: (key: string, fallback?: string) => string;
  onSelectAllVisible: () => void;
  onProcess: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function InboxTextSelectionPill({
  selectedCount,
  filteredArticles,
  selectedIds,
  processing,
  t,
  onSelectAllVisible,
  onProcess,
  onDelete,
  onClear,
}: InboxTextSelectionPillProps) {
  return (
    <ArticlePipelineSelectionBar
      selectedCount={selectedCount}
      filteredArticles={filteredArticles}
      selectedIds={selectedIds}
      processing={processing}
      t={t}
      onSelectAllVisible={onSelectAllVisible}
      onProcess={onProcess}
      onDelete={onDelete}
      onClear={onClear}
    />
  );
}
