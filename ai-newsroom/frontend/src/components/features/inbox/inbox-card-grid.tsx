"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { NewsCard } from "@/components/inbox/news-card";
import { VideoCard } from "@/components/inbox/video-card";
import { type IntelligenceCard } from "@/lib/api";
import { formatArchiveDate, type InboxContentTab, type InboxTimeTab } from "@/hooks/useInboxCardsView";

const fadeSectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.08, ease: [0.22, 1, 0.36, 1] } },
  static: { opacity: 1 },
};

interface InboxCardGridProps {
  contentTab: InboxContentTab;
  activeTab: InboxTimeTab;
  activeTag: string;
  archiveDateFilter: string | null;
  displayCards: IntelligenceCard[];
  selectedCardIds: Set<number>;
  t: (key: string, fallback?: string) => string;
  onCardClick: (card: IntelligenceCard, rect: DOMRect) => void;
  onToggleCard: (id: number) => void;
  onClearArchiveFilter: () => void;
  canPin?: boolean;
  canSaveInspiration?: boolean;
  onTogglePin?: (cardId: number) => void;
}

export function InboxCardGrid({
  contentTab,
  activeTab,
  activeTag,
  archiveDateFilter,
  displayCards,
  selectedCardIds,
  t,
  onCardClick,
  onToggleCard,
  onClearArchiveFilter,
  canPin,
  canSaveInspiration,
  onTogglePin,
}: InboxCardGridProps) {
  const isPinnedView = contentTab === "pinned";
  const viewKey = `${contentTab}:${activeTab}:${archiveDateFilter ?? "all"}:${activeTag}`;
  const hasData = displayCards.length > 0;
  const [previousView, setPreviousView] = React.useState<{ key: string; hasData: boolean } | null>(null);
  const shouldAnimateTransition =
    previousView !== null &&
    previousView.key !== viewKey &&
    previousView.hasData &&
    hasData;

  React.useEffect(() => {
    setPreviousView((current) => {
      if (current?.key === viewKey && current.hasData === hasData) {
        return current;
      }

      return { key: viewKey, hasData };
    });
  }, [viewKey, hasData]);

  return (
    <div className="w-full">
      <motion.section
        key={viewKey}
        className="w-full"
        variants={fadeSectionVariants}
        initial={shouldAnimateTransition ? "hidden" : "static"}
        animate={shouldAnimateTransition ? "visible" : "static"}
      >
        {displayCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {contentTab === "pinned" ? (
              <div className="flex flex-col items-center gap-4 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-zinc-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">{t("inbox.pinnedEmptyTitle")}</h3>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{t("inbox.pinnedEmpty")}</p>
                </div>
              </div>
            ) : activeTag !== "all" && activeTab === "older" && archiveDateFilter ? (
              <>
                <div className="mb-4">
                  {t("inbox.emptyArchiveFilter")
                    .replace("{date}", formatArchiveDate(archiveDateFilter))
                    .replace("{tag}", activeTag === "__other__" ? "Other" : activeTag)}
                </div>
                <Button variant="outline" onClick={onClearArchiveFilter}>
                  {t("inbox.clearFilter")}
                </Button>
              </>
            ) : activeTag !== "all" ? (
              t("inbox.emptyTag").replace("{tag}", activeTag === "__other__" ? "Other" : activeTag)
            ) : activeTab === "today" ? (
              t("inbox.emptyToday")
            ) : activeTab === "thisWeek" ? (
              t("inbox.emptyWeek")
            ) : (
              t("inbox.emptyArchive")
            )}
          </div>
        ) : (
          <div className="bento-grid">
            {displayCards.map((card) => (
              card.content_type === "video" ? (
                <VideoCard
                  key={card.id}
                  card={card}
                  isSelected={isPinnedView ? false : selectedCardIds.has(card.id)}
                  onToggle={isPinnedView ? () => {} : onToggleCard}
                  onClick={onCardClick}
                  isFeatured={false}
                  canPin={isPinnedView ? false : canPin}
                  canSaveInspiration={isPinnedView ? false : canSaveInspiration}
                  onTogglePin={isPinnedView ? undefined : onTogglePin}
                  selectable={!isPinnedView}
                />
              ) : (
                <NewsCard
                  key={card.id}
                  card={card}
                  isSelected={isPinnedView ? false : selectedCardIds.has(card.id)}
                  onToggle={isPinnedView ? () => {} : onToggleCard}
                  onClick={onCardClick}
                  isFeatured={false}
                  canPin={isPinnedView ? false : canPin}
                  canSaveInspiration={isPinnedView ? false : canSaveInspiration}
                  onTogglePin={isPinnedView ? undefined : onTogglePin}
                  selectable={!isPinnedView}
                />
              )
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
