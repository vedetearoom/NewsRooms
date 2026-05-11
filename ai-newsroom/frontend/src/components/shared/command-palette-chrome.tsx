"use client";

import * as React from "react";

import { ChevronRight } from "lucide-react";

import type { CommandPaletteStep } from "./command-palette-types";

interface CommandPaletteHeaderProps {
  step: CommandPaletteStep;
  selectedTypeLabel?: string;
  query: string;
  onQueryChange: (value: string) => void;
  t: (key: string) => string;
}

export function CommandPaletteHeader({
  step,
  selectedTypeLabel,
  query,
  onQueryChange,
  t,
}: CommandPaletteHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-white/[0.04]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] text-muted-foreground">
          {t("commandPalette.title")}
        </span>
        {selectedTypeLabel ? (
          <>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-[12px] font-medium text-foreground">{selectedTypeLabel}</span>
          </>
        ) : null}
      </div>

      {step === "task_type" ? (
        <input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("commandPalette.search")}
          className="w-full text-[13px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40"
        />
      ) : null}

      {step === "agent" ? (
        <p className="text-[13px] text-muted-foreground">{t("commandPalette.chooseAgent")}</p>
      ) : null}

      {step === "select_template" ? (
        <p className="text-[13px] text-muted-foreground">
          {t("commandPalette.selectTemplate")}
        </p>
      ) : null}

      {step === "select_facts" ? (
        <p className="text-[13px] text-muted-foreground">
          {t("commandPalette.selectFacts")}
        </p>
      ) : null}
    </div>
  );
}

interface CommandPaletteFooterProps {
  sourceCount: number;
  step: CommandPaletteStep;
  t: (key: string) => string;
}

export function CommandPaletteFooter({
  sourceCount,
  step,
  t,
}: CommandPaletteFooterProps) {
  return (
    <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground/60">
        {sourceCount === 1
          ? t("commandPalette.sourceCount_one")
          : t("commandPalette.sourceCount_other").replace("{count}", String(sourceCount))}
      </span>
      <kbd className="text-[10px] text-muted-foreground/50">
        {step === "agent" ? t("commandPalette.escGoBack") : t("commandPalette.escClose")}
      </kbd>
    </div>
  );
}
