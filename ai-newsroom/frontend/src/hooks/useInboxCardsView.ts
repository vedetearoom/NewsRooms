import * as React from "react";
import type { IntelligenceCard } from "@/lib/api";

const TOP_TAG_COUNT = 5;

export type InboxContentTab = "pinned" | "article" | "video";
export type InboxTimeTab = "today" | "thisWeek" | "older";

type TimeGroupedCards = Record<InboxTimeTab, IntelligenceCard[]>;

interface UseInboxCardsViewParams {
  cards: IntelligenceCard[];
  archivedCards: IntelligenceCard[];
  pinnedCards: IntelligenceCard[];
  contentTab: InboxContentTab;
  activeTab: InboxTimeTab;
  activeTag: string;
  archiveDateFilter: string | null;
}

function getLocalDateString(dateObj: Date) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function getVideoFallbackTag(card: IntelligenceCard): string {
  const platform = normalizeLabel(card.extra_data?.platform)?.toLowerCase();

  switch (platform) {
    case "xiaohongshu":
      return "小红书";
    case "bilibili":
      return "B站";
    case "youtube":
      return "YouTube";
    case "upload":
      return "本地视频";
    default:
      return "其他视频";
  }
}

function getCardTag(card: IntelligenceCard, contentTab: InboxContentTab) {
  if (contentTab === "pinned") {
    if (card.content_type === "video") {
      return normalizeLabel(card.extra_data?.author) || getVideoFallbackTag(card);
    }
    return card.category || "Other";
  }
  if (contentTab === "video") {
    return normalizeLabel(card.extra_data?.author) || getVideoFallbackTag(card);
  }
  return card.category || "Other";
}

function buildTimeGroups(
  cards: IntelligenceCard[],
  archivedCards: IntelligenceCard[],
  archiveDateFilter: string | null,
  contentTab: InboxContentTab,
): TimeGroupedCards {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredArchive = archiveDateFilter
    ? archivedCards.filter((card) => getLocalDateString(new Date(card.created_at)) === archiveDateFilter)
    : archivedCards;

  const groups: TimeGroupedCards = {
    today: [],
    thisWeek: [],
    older: filteredArchive,
  };

  cards.forEach((card) => {
    // Pinned tab: archived cards always go to 归档 regardless of age
    if (contentTab === "pinned" && card.is_archived) {
      groups.older.push(card);
      return;
    }

    const cardDate = new Date(card.created_at);
    cardDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today.getTime() - cardDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      groups.today.push(card);
    } else if (diffDays <= 7) {
      groups.thisWeek.push(card);
    } else {
      groups.older.push(card);
    }
  });

  return groups;
}

export function formatArchiveDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(month, 10)}月${parseInt(day, 10)}日`;
}

export function useInboxCardsView({
  cards,
  archivedCards,
  pinnedCards,
  contentTab,
  activeTab,
  activeTag,
  archiveDateFilter,
}: UseInboxCardsViewParams) {
  const contentFilteredCards = React.useMemo(() => {
    if (contentTab === "pinned") return pinnedCards;
    return cards.filter((card) => (card.content_type || "article") === contentTab);
  }, [cards, pinnedCards, contentTab]);

  const contentFilteredArchived = React.useMemo(() => {
    if (contentTab === "pinned") return [];
    return archivedCards.filter((card) => (card.content_type || "article") === contentTab);
  }, [archivedCards, contentTab]);

  const timeGroupedCards = React.useMemo(
    () => buildTimeGroups(contentFilteredCards, contentFilteredArchived, archiveDateFilter, contentTab),
    [contentFilteredCards, contentFilteredArchived, archiveDateFilter, contentTab],
  );

  const currentSliceCards = timeGroupedCards[activeTab];

  const { topTags, overflowTags, totalCount } = React.useMemo(() => {
    const tagCount = new Map<string, number>();

    currentSliceCards.forEach((card) => {
      const tag = getCardTag(card, contentTab);
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    });

    const sorted = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]);

    return {
      topTags: sorted.slice(0, TOP_TAG_COUNT),
      overflowTags: sorted.slice(TOP_TAG_COUNT),
      totalCount: currentSliceCards.length,
    };
  }, [currentSliceCards, contentTab]);

  const displayCards = React.useMemo(() => {
    if (activeTag === "all") {
      return currentSliceCards;
    }

    if (activeTag === "__other__") {
      const overflowSet = new Set(overflowTags.map(([tag]) => tag));
      return currentSliceCards.filter((card) => overflowSet.has(getCardTag(card, contentTab)));
    }

    return currentSliceCards.filter((card) => getCardTag(card, contentTab) === activeTag);
  }, [currentSliceCards, activeTag, overflowTags, contentTab]);

  return {
    timeGroupedCards,
    displayCards,
    topTags,
    overflowTags,
    totalCount,
  };
}
