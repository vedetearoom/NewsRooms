import { useTranslation } from "@/hooks/useTranslation";
import type { DiscoveredVideo } from "@/lib/api";
import { MonitorVideoCard } from "@/components/shared/monitor-video-card";

export interface InboxVideoListCardProps {
  video: DiscoveredVideo;
  isSelected: boolean;
  isAnalyzed: boolean;
  vStatus?: 'queued' | 'submitting' | 'done' | 'error';
  onToggle: () => void;
  onReanalyze: () => void;
}

export function InboxVideoListCard({
  video,
  isSelected,
  isAnalyzed,
  vStatus,
  onToggle,
  onReanalyze,
}: InboxVideoListCardProps) {
  const { t, language } = useTranslation();

  return (
    <MonitorVideoCard
      video={video}
      language={language}
      isSelected={isSelected}
      isAnalyzed={isAnalyzed}
      status={vStatus}
      deconstructLabel={t("monitors.deconstruct")}
      tooLongLabel={t("monitors.tooLong")}
      submittingLabel={t("monitors.submitting")}
      queuedLabel={t("monitors.queued")}
      submitFailedLabel={t("monitors.submitFailed")}
      alreadyAnalyzedLabel={t("monitors.alreadyAnalyzed")}
      reanalyzeLabel={t("monitors.reanalyze")}
      reanalyzingLabel={t("monitors.reanalyzing")}
      lastAnalyzedAtLabel={t("monitors.lastAnalyzedAt")}
      reanalyzeHintLabel={t("monitors.reanalyzeHint")}
      onClick={onToggle}
      onReanalyze={onReanalyze}
    />
  );
}
