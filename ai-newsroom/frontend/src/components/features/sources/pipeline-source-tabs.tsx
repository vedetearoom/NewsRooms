"use client";

import { InboxSourceTabs } from "@/components/features/inbox/inbox-source-tabs";
import type { PipelineStats } from "@/lib/api";

interface PipelineSourceTabsProps {
  stats: PipelineStats | null;
  activeSourceId: number | null;
  t: (key: string, fallback?: string) => string;
  onSelectSource: (id: number | null) => void;
}

export function PipelineSourceTabs({
  stats,
  activeSourceId,
  t,
  onSelectSource,
}: PipelineSourceTabsProps) {
  if (!stats || stats.sources.length === 0) {
    return <div className="min-h-[42px]" />;
  }

  return (
    <InboxSourceTabs
      items={stats.sources.map((src) => ({
        id: src.id,
        label: src.name,
        count: src.article_count,
      }))}
      activeId={activeSourceId ?? "all"}
      allLabel={t("pipeline.all")}
      allCount={stats.total_articles}
      dividerAfterAll
      onChange={(id) => onSelectSource(id === "all" ? null : Number(id))}
    />
  );
}
