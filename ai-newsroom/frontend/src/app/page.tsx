"use client";

import * as React from "react";
import { api, type IntelligenceCard } from "@/lib/api";
import { ExpandedFlipCard } from "@/components/inbox/expanded-flip-card";
import { ExpandedVideoCard } from "@/components/inbox/expanded-video-card";
import { FloatingActionBar } from "@/components/shared/floating-action-bar";
import { CommandPalette } from "@/components/shared/command-palette";
import { AnimatePresence } from "framer-motion";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useTranslation } from "@/hooks/useTranslation";
import { useTabsStore } from "@/store/tabs";
import { useUrlTab } from "@/hooks/useUrlTab";
import { Suspense } from "react";
import { InboxToolbar } from "@/components/features/inbox/inbox-toolbar";
import { useInboxCardsView, type InboxTimeTab } from "@/hooks/useInboxCardsView";
import { useSelectionStore } from "@/store/selection-store";
import { InboxLoadingGrid } from "@/components/features/inbox/inbox-loading-grid";
import { InboxEmptyState } from "@/components/features/inbox/inbox-empty-state";
import { InboxTimeTabs } from "@/components/features/inbox/inbox-time-tabs";
import { InboxCardGrid } from "@/components/features/inbox/inbox-card-grid";
import { PageShellFallback } from "@/components/shared/page-shell-fallback";

export default function InboxPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const [cards, setCards] = React.useState<IntelligenceCard[]>([]);
  const { selectedCardIds, selectedInspirationIds, toggleCard, setAllCards, clearSelection } = useSelectionStore();
  const [activeCard, setActiveCard] = React.useState<IntelligenceCard | null>(null);
  const [originRect, setOriginRect] = React.useState<DOMRect | null>(null);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [archivedCards, setArchivedCards] = React.useState<IntelligenceCard[]>([]);
  const { t } = useTranslation();

  // Content type tab — article vs video
  const setContentTabAction = useTabsStore(s => s.setDiscoverContentTab);
  const [contentTab, setContentTab] = useUrlTab<"article" | "video">("type", "article", setContentTabAction);

  // Tag filter — resets when time tab changes
  const [activeTag, setActiveTag] = React.useState<string>("all");

  // Archive date filter
  const [archiveDateFilter, setArchiveDateFilter] = React.useState<string | null>(null);
  const [archiveDropdownOpen, setArchiveDropdownOpen] = React.useState(false);
  const setActiveTabAction = useTabsStore(s => s.setDiscoverTimeTab);
  const [activeTab, setActiveTab] = useUrlTab<InboxTimeTab>("time", "today", setActiveTabAction);

  const fetchCards = React.useCallback(async () => {
    try {
      const [data, archived] = await Promise.all([
        api.getCards(),
        api.getCards({ archived: "true" }),
      ]);
      setCards(data);
      setArchivedCards(archived);
    } catch { console.warn("Failed to fetch cards"); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { fetchCards(); }, [fetchCards]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (selectedCardIds.size > 0) setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedCardIds]);
  // Keyboard Shortcuts via useEffect hook handled above

  const handleCardClick = (card: IntelligenceCard, rect: DOMRect) => {
    setOriginRect(rect);
    setActiveCard(card);
  };

  const handleDeleteSelected = async () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteCards = async () => {
    setIsDeleting(true);
    await Promise.all(Array.from(selectedCardIds).map((id) => api.deleteCard(id)));
    clearSelection();
    fetchCards();
    setIsDeleting(false);
  };

  const handleArchiveSelected = async () => {
    setIsArchiving(true);
    try {
      await Promise.all(Array.from(selectedCardIds).map((id) => api.archiveCard(id)));
      clearSelection();
      await fetchCards();
    } catch (e) {
      console.error("Failed to archive:", e);
    } finally {
      setIsArchiving(false);
    }
  };

  const selectAllVisible = () => {
    const allSelected = displayCards.length > 0 && displayCards.every(c => selectedCardIds.has(c.id));
    if (allSelected && displayCards.length > 0) {
      setAllCards([]);
    } else {
      setAllCards(displayCards.map(c => c.id));
    }
  };

  // Reset tag filter when switching time tabs
  const handleTabSwitch = (tab: InboxTimeTab) => {
    if (tab === "older") {
      if (activeTab === "older") {
        setArchiveDropdownOpen(prev => !prev);
      } else {
        setActiveTab(tab);
        setActiveTag("all");
      }
    } else {
      setActiveTab(tab);
      setActiveTag("all");
      setArchiveDropdownOpen(false);
    }
  };

  const { timeGroupedCards, displayCards, topTags, overflowTags, totalCount } = useInboxCardsView({
    cards,
    archivedCards,
    contentTab,
    activeTab,
    activeTag,
    archiveDateFilter,
  });
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#08090b] overflow-hidden">
      {/* Header */}
      <InboxToolbar
        contentTab={contentTab}
        setContentTab={setContentTab}
        activeTag={activeTag}
        setActiveTag={setActiveTag}
        topTags={topTags}
        overflowTags={overflowTags}
        totalCount={totalCount}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Bento Grid Content */}
        <div className="flex-1 flex flex-col overflow-y-scroll px-8 py-6 pt-8">
        {loading ? (
          <InboxLoadingGrid />
        ) : cards.length === 0 ? (
          <InboxEmptyState contentTab={contentTab} t={t} />
        ) : (
          <div className="space-y-8">
            <InboxTimeTabs
              activeTab={activeTab}
              archiveDateFilter={archiveDateFilter}
              archiveDropdownOpen={archiveDropdownOpen}
              archivedCards={archivedCards}
              timeGroupedCards={timeGroupedCards}
              t={t}
              onTabSwitch={handleTabSwitch}
              onCloseArchiveDropdown={() => setArchiveDropdownOpen(false)}
              onSelectArchiveDate={setArchiveDateFilter}
            />

            <InboxCardGrid
              contentTab={contentTab}
              activeTab={activeTab}
              activeTag={activeTag}
              archiveDateFilter={archiveDateFilter}
              displayCards={displayCards}
              selectedCardIds={selectedCardIds}
              t={t}
              onCardClick={handleCardClick}
              onToggleCard={toggleCard}
              onClearArchiveFilter={() => setArchiveDateFilter(null)}
            />
          </div>
        )}
        </div>
        
        <AnimatePresence>
          {activeCard && originRect && (
            activeCard.content_type === "video"
              ? <ExpandedVideoCard key={`expanded-v-${activeCard.id}`} card={activeCard} originRect={originRect} onClose={() => { setActiveCard(null); setOriginRect(null); }} onSelect={toggleCard} isSelected={selectedCardIds.has(activeCard.id)} />
              : <ExpandedFlipCard key={`expanded-${activeCard.id}`} card={activeCard} originRect={originRect} onClose={() => { setActiveCard(null); setOriginRect(null); }} onSelect={toggleCard} isSelected={selectedCardIds.has(activeCard.id)} />
          )}
        </AnimatePresence>
        
      </div>

      <FloatingActionBar
        selectedCount={selectedCardIds.size}
        onDispatch={() => setCommandOpen(true)}
        onArchive={handleArchiveSelected}
        onDelete={handleDeleteSelected}
        onSelectAll={selectAllVisible}
        isAllSelected={displayCards.length > 0 && displayCards.every(c => selectedCardIds.has(c.id))}
        onClearSelection={() => clearSelection()}
        isArchiving={isArchiving}
        isRestore={activeTab === "older"}
        isDeleting={isDeleting}
      />
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        selectedCardIds={Array.from(selectedCardIds)}
        selectedInspirationIds={Array.from(selectedInspirationIds)}
      />
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteCards}
        title={t('inbox.confirmDeleteTitle')}
        description={t('inbox.confirmDeleteDesc').replace('{count}', String(selectedCardIds.size))}
        confirmText={t('inbox.confirmDeleteBtn')}
      />
    </div>
  );
}
