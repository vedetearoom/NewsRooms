"use client";

import * as React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  FloatingActionBarCount,
  FloatingActionBarDispatch,
  FloatingActionBarExpandableActions,
  FloatingActionBarIconButton,
  FloatingActionBarSelectAll,
  FloatingActionBarShell,
} from "./floating-action-bar-parts";

interface FloatingActionBarProps {
  selectedCount: number;
  onDispatch: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  onClearSelection: () => void;
  isArchiving?: boolean;
  isRestore?: boolean;
  isDeleting?: boolean;
  hideArchive?: boolean;
}

export function FloatingActionBar({
  selectedCount,
  onDispatch,
  onArchive,
  onDelete,
  onSelectAll,
  isAllSelected,
  onClearSelection,
  isArchiving,
  isRestore,
  isDeleting,
  hideArchive,
}: FloatingActionBarProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const showArchiveAction = Boolean(onArchive) && !hideArchive;

  React.useEffect(() => {
    if (selectedCount === 0) setExpanded(false);
  }, [selectedCount]);

  if (selectedCount === 0) return null;

  return (
    <FloatingActionBarShell>
      <FloatingActionBarCount
        selectedCount={selectedCount}
        label={t("inbox.selected")}
      />

      <FloatingActionBarSelectAll
        visible={Boolean(onSelectAll)}
        isAllSelected={isAllSelected}
        selectAllLabel={t("inbox.selectAll")}
        deselectAllLabel={t("inbox.deselectAll")}
        onSelectAll={onSelectAll}
      />

      <FloatingActionBarDispatch
        label={t("inbox.dispatch")}
        shortcut="⌘K"
        onDispatch={onDispatch}
      />

      <FloatingActionBarExpandableActions
        expanded={expanded}
        showArchiveAction={showArchiveAction}
        showDeleteAction={Boolean(onDelete)}
        isArchiving={isArchiving}
        isRestore={isRestore}
        isDeleting={isDeleting}
        archiveLabel={t("inbox.archiveBtn")}
        archiveLoadingLabel={t("inbox.archiving")}
        restoreLabel={t("inbox.restoreBtn")}
        onExpand={() => setExpanded(true)}
        onArchive={onArchive}
        onDelete={onDelete}
      />

      <FloatingActionBarIconButton
        onClick={onClearSelection}
        className="opacity-70 hover:opacity-100 hover:bg-white/10"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </FloatingActionBarIconButton>
    </FloatingActionBarShell>
  );
}
