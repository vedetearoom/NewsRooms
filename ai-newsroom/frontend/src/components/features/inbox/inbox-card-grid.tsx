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
}: InboxCardGridProps) {
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
          <div className="text-center py-20 text-muted-foreground text-sm">
            {activeTag !== "all" && activeTab === "older" && archiveDateFilter ? (
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
            {displayCards.map((card, index) => (
              card.content_type === "video" ? (
                <VideoCard
                  key={card.id}
                  card={card}
                  isSelected={selectedCardIds.has(card.id)}
                  onToggle={onToggleCard}
                  onClick={onCardClick}
                  isFeatured={index === 0 && activeTag === "all"}
                />
              ) : (
                <NewsCard
                  key={card.id}
                  card={card}
                  isSelected={selectedCardIds.has(card.id)}
                  onToggle={onToggleCard}
                  onClick={onCardClick}
                  isFeatured={index === 0 && activeTag === "all"}
                />
              )
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
