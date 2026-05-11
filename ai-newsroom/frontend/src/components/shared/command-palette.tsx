"use client";

import * as React from "react";
import { useAgents } from "@/hooks/useApi";
import { useTranslation } from "@/hooks/useTranslation";
import { useCommandPaletteState } from "@/hooks/useCommandPaletteState";
import { CommandPalettePanels } from "./command-palette-panels";
import { CommandPaletteFooter, CommandPaletteHeader } from "./command-palette-chrome";
import { getCommandPaletteTaskTypes } from "./command-palette-task-types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  selectedCardIds?: number[];
  selectedInspirationIds?: number[];
  sourceTaskIds?: number[];
}

export function CommandPalette({ open, onClose, selectedCardIds = [], selectedInspirationIds = [], sourceTaskIds = [] }: CommandPaletteProps) {
  const { agents } = useAgents();
  const { t, language } = useTranslation();
  const hasPreselectedSources = selectedCardIds.length > 0 || selectedInspirationIds.length > 0;
  const {
    step,
    selectedTaskType,
    query,
    setQuery,
    tempSelectedCards,
    tempSelectedInspirations,
    panelState,
    sourceCount,
    handleTaskTypeSelect,
    handleTemplateSelect,
    handleToggleFact,
    handleConfirmFacts,
    handleAgentSelect,
  } = useCommandPaletteState({
    open,
    onClose,
    agents,
    language,
    selectedCardIds,
    selectedInspirationIds,
    sourceTaskIds,
  });
  const showMultiSource =
    hasPreselectedSources || tempSelectedCards.length > 0 || tempSelectedInspirations.length > 0;

  const translatedTaskTypes = React.useMemo(() => {
    return getCommandPaletteTaskTypes(t, showMultiSource);
  }, [showMultiSource, t]);

  const filteredTaskTypes = React.useMemo(() => {
    return translatedTaskTypes.filter(item =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, translatedTaskTypes]);

  const selectedType = translatedTaskTypes.find(item => item.type === selectedTaskType);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 150ms ease" }}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-[520px] rounded-xl bg-white dark:bg-[#1c1c1e] shadow-2xl shadow-black/10 dark:shadow-black/50 border border-zinc-200/80 dark:border-white/[0.06] overflow-hidden"
        style={{ animation: "slideUp 150ms ease" }}
      >
        <CommandPaletteHeader
          step={step}
          selectedTypeLabel={selectedType?.label}
          query={query}
          onQueryChange={setQuery}
          t={t}
        />

        {/* Content */}
        <div className="py-2 max-h-[360px] overflow-y-auto">
          <CommandPalettePanels
            panelState={panelState}
            filteredTaskTypes={filteredTaskTypes}
            t={t}
            onSelectTaskType={handleTaskTypeSelect}
            onSelectTemplate={handleTemplateSelect}
            onToggleFact={handleToggleFact}
            onConfirmFacts={handleConfirmFacts}
            onSelectAgent={handleAgentSelect}
          />
        </div>

        <CommandPaletteFooter
          sourceCount={sourceCount}
          step={step}
          t={t}
        />
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
