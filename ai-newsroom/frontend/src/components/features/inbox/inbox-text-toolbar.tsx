"use client";

import {
  ArticlePipelineToolbar,
  type ArticlePipelineStatusFilter,
} from "@/components/shared/article-pipeline-toolbar";

interface InboxTextToolbarProps {
  filterOpen: boolean;
  filterRef: React.RefObject<HTMLDivElement | null>;
  statusFilter: ArticlePipelineStatusFilter;
  statusFilterCount: number;
  searchQuery: string;
  pendingCount: number;
  processing: boolean;
  t: (key: string, fallback?: string) => string;
  onFilterToggle: () => void;
  onStatusFilterChange: (value: ArticlePipelineStatusFilter) => void;
  onClearFilters: () => void;
  onSearchChange: (value: string) => void;
  onProcess: () => void;
}

export function InboxTextToolbar({
  filterOpen,
  filterRef,
  statusFilter,
  statusFilterCount,
  searchQuery,
  pendingCount,
  processing,
  t,
  onFilterToggle,
  onStatusFilterChange,
  onClearFilters,
  onSearchChange,
  onProcess,
}: InboxTextToolbarProps) {
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
      onFilterToggle={onFilterToggle}
      onStatusFilterChange={onStatusFilterChange}
      onClearFilters={onClearFilters}
      onSearchChange={onSearchChange}
      onProcess={onProcess}
      shellClassName="bg-transparent mb-4"
    />
  );
}
