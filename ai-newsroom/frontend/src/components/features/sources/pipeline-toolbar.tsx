"use client";

import {
  ArticlePipelineToolbar,
  type ArticlePipelineStatusFilter,
} from "@/components/shared/article-pipeline-toolbar";

interface PipelineToolbarProps {
  filterOpen: boolean;
  filterRef: React.RefObject<HTMLDivElement | null>;
  statusFilter: ArticlePipelineStatusFilter;
  statusFilterCount: number;
  searchQuery: string;
  pendingCount: number;
  processing: boolean;
  t: (key: string, fallback?: string) => string;
  onToggleFilter: () => void;
  onSetStatusFilter: (value: ArticlePipelineStatusFilter) => void;
  onSearchQueryChange: (value: string) => void;
  onProcess: () => void;
  onCloseFilter: () => void;
}

export function PipelineToolbar({
  filterOpen,
  filterRef,
  statusFilter,
  statusFilterCount,
  searchQuery,
  pendingCount,
  processing,
  t,
  onToggleFilter,
  onSetStatusFilter,
  onSearchQueryChange,
  onProcess,
  onCloseFilter,
}: PipelineToolbarProps) {
  return (
    <ArticlePipelineToolbar
      filterOpen={filterOpen}
      filterRef={filterRef}
      statusFilter={statusFilter}
      statusFilterCount={statusFilterCount}
      searchQuery={searchQuery}
      pendingCount={pendingCount}
      processing={processing}
      t={t}
      onFilterToggle={onToggleFilter}
      onStatusFilterChange={onSetStatusFilter}
      onClearFilters={() => {
        onSetStatusFilter("all");
        onCloseFilter();
      }}
      onSearchChange={onSearchQueryChange}
      onProcess={onProcess}
      shellClassName="bg-white dark:bg-[#0b0c0f]"
      contentClassName="mx-auto w-full max-w-5xl px-2"
    />
  );
}
