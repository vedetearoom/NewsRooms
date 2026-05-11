"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import { Archive, CheckSquare, ChevronRight, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface FloatingActionBarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function FloatingActionBarButton({
  children,
  onClick,
  disabled = false,
  className,
}: FloatingActionBarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 text-[12px] font-medium px-2 py-1 rounded-lg transition-colors whitespace-nowrap",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface FloatingActionBarIconButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export function FloatingActionBarIconButton({
  children,
  onClick,
  className,
}: FloatingActionBarIconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface FloatingActionBarShellProps {
  children: React.ReactNode;
}

export function FloatingActionBarShell({
  children,
}: FloatingActionBarShellProps) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
      <motion.div
        layout
        transition={{ layout: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } }}
        className="flex items-center gap-1.5 pl-4 pr-2 py-2 rounded-xl bg-zinc-900 dark:bg-[#1c1c1e] border border-transparent dark:border-white/10 text-white shadow-2xl"
      >
        {children}
      </motion.div>
    </div>
  );
}

interface FloatingActionBarCountProps {
  selectedCount: number;
  label: string;
}

export function FloatingActionBarCount({
  selectedCount,
  label,
}: FloatingActionBarCountProps) {
  return (
    <>
      <span className="text-[12px] font-semibold tabular-nums whitespace-nowrap">
        {selectedCount} {label}
      </span>
      <div className="h-3.5 w-px bg-white/15 mx-0.5" />
    </>
  );
}

interface FloatingActionBarSelectAllProps {
  visible: boolean;
  isAllSelected?: boolean;
  selectAllLabel: string;
  deselectAllLabel: string;
  onSelectAll?: () => void;
}

export function FloatingActionBarSelectAll({
  visible,
  isAllSelected,
  selectAllLabel,
  deselectAllLabel,
  onSelectAll,
}: FloatingActionBarSelectAllProps) {
  if (!visible || !onSelectAll) return null;

  return (
    <FloatingActionBarButton
      onClick={onSelectAll}
      className="text-zinc-300 hover:text-white"
    >
      <CheckSquare className="w-3.5 h-3.5" />
      {isAllSelected ? deselectAllLabel : selectAllLabel}
    </FloatingActionBarButton>
  );
}

interface FloatingActionBarDispatchProps {
  label: string;
  shortcut: string;
  onDispatch: () => void;
}

export function FloatingActionBarDispatch({
  label,
  shortcut,
  onDispatch,
}: FloatingActionBarDispatchProps) {
  return (
    <FloatingActionBarButton
      onClick={onDispatch}
      className="gap-1 px-2.5 bg-white/10 hover:bg-white/20"
    >
      {label}
      <kbd className="text-[9px] bg-white/10 rounded px-1 py-px font-mono ml-0.5 text-zinc-300">{shortcut}</kbd>
    </FloatingActionBarButton>
  );
}

interface FloatingActionBarExpandableActionsProps {
  expanded: boolean;
  showArchiveAction: boolean;
  showDeleteAction: boolean;
  isArchiving?: boolean;
  isRestore?: boolean;
  isDeleting?: boolean;
  archiveLabel: string;
  archiveLoadingLabel: string;
  restoreLabel: string;
  onExpand: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function FloatingActionBarExpandableActions({
  expanded,
  showArchiveAction,
  showDeleteAction,
  isArchiving,
  isRestore,
  isDeleting,
  archiveLabel,
  archiveLoadingLabel,
  restoreLabel,
  onExpand,
  onArchive,
  onDelete,
}: FloatingActionBarExpandableActionsProps) {
  const showExpandableActions = showArchiveAction || showDeleteAction;

  return (
    <AnimatePresence mode="popLayout">
      {showExpandableActions && !expanded ? (
        <motion.div
          key="expand-btn"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
        >
          <FloatingActionBarIconButton
            onClick={onExpand}
            className="ml-1 text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </FloatingActionBarIconButton>
        </motion.div>
      ) : null}

      {showExpandableActions && expanded ? (
        <motion.div
          key="expanded-actions"
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center gap-1 overflow-hidden ml-1"
        >
          {showArchiveAction && onArchive ? (
            <FloatingActionBarButton
              onClick={onArchive}
              disabled={isArchiving}
              className="gap-1 text-zinc-300 hover:text-white hover:bg-white/10"
            >
              <Archive className="w-3 h-3" />
              {isArchiving ? archiveLoadingLabel : isRestore ? restoreLabel : archiveLabel}
            </FloatingActionBarButton>
          ) : null}

          {showDeleteAction && onDelete ? (
            <FloatingActionBarButton
              onClick={onDelete}
              disabled={isDeleting}
              className="justify-center text-rose-400 hover:text-rose-300 hover:bg-white/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </FloatingActionBarButton>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
