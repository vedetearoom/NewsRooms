"use client";

import * as React from "react";

import { ChevronRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface CommandPaletteEmptyStateProps {
  loading: boolean;
  emptyLabel: string;
}

export function CommandPaletteEmptyState({
  loading,
  emptyLabel,
}: CommandPaletteEmptyStateProps) {
  return (
    <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : emptyLabel}
    </div>
  );
}

interface CommandPaletteOptionRowProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function CommandPaletteOptionRow({
  icon,
  title,
  description,
  trailing,
  onClick,
  disabled = false,
  compact = false,
}: CommandPaletteOptionRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors group",
        compact ? "px-2 py-2 gap-3 rounded-lg" : "px-4 py-3 gap-3.5",
      )}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        {description ? (
          <div className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{description}</div>
        ) : null}
      </div>
      {trailing ?? (
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      )}
    </button>
  );
}
