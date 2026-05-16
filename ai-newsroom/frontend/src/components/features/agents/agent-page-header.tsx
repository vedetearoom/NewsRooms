"use client";

import * as React from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/api";

interface AgentPageHeaderProps {
  activeId: number | "new" | null;
  activeAgent: Agent | null;
  isSystem: boolean;
  isCurrentlyActiveSlot: boolean;
  isProfileDirty: boolean;
  t: (key: string, fallback?: string) => string;
  getLocalizedAgentName: (agent: Agent | null | undefined) => string;
  onActivate: () => void;
  onClone: () => void;
  onDelete: () => void;
}

export function AgentPageHeader({
  activeId,
  activeAgent,
  isSystem,
  isCurrentlyActiveSlot,
  isProfileDirty,
  t,
  getLocalizedAgentName,
  onActivate,
  onClone,
  onDelete,
}: AgentPageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100/80 bg-background/88 backdrop-blur-xl dark:border-white/[0.04]">
      <div className="mx-auto flex h-[56px] max-w-5xl items-center justify-between px-10">
        <div className="flex min-h-8 items-center gap-2.5">
          <h1 className="text-[17px] font-semibold leading-8 text-foreground tracking-tight">
            {activeId === "new" ? t("agents.createNewAgent") : activeAgent ? getLocalizedAgentName(activeAgent) : ""}
          </h1>
          {activeAgent?.is_system && (
            <span className="text-[10px] font-medium leading-none text-muted-foreground/65">
              {t("agents.sysAgentBadge")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {activeId !== "new" && !isCurrentlyActiveSlot && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "mr-1 h-8 border-zinc-200/80 bg-white/70 px-3 text-xs font-medium text-muted-foreground shadow-none hover:border-zinc-300 hover:bg-white hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
                isProfileDirty && "cursor-not-allowed opacity-50",
              )}
              onClick={isProfileDirty ? undefined : onActivate}
              title={isProfileDirty ? t("agents.saveChangesBeforeSetting", "Save changes before setting as active") : ""}
            >
              {t("agents.setActive", "Set Active")}
            </Button>
          )}
          {activeAgent && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-white/[0.06]"
              onClick={onClone}
              title={t("agents.cloneBtn")}
              aria-label={t("agents.cloneBtn")}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          {activeId !== "new" && !isSystem && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              onClick={onDelete}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("agents.deleteBtn")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
