"use client";

import type { Agent } from "@/lib/api";
import type { CommandPaletteTaskType } from "./command-palette-task-types";
import type { CommandPalettePanelState } from "./command-palette-types";
import {
  AgentSelectionPanel,
  FactSelectionPanel,
  TaskTypePanel,
  TemplateSelectionPanel,
} from "./command-palette-step-panels";

interface CommandPalettePanelsProps {
  panelState: CommandPalettePanelState;
  filteredTaskTypes: CommandPaletteTaskType[];
  t: (key: string) => string;
  onSelectTaskType: (type: string) => void;
  onSelectTemplate: (inspirationId: number) => void;
  onToggleFact: (cardId: number) => void;
  onConfirmFacts: () => void;
  onSelectAgent: (agent: Agent) => void;
}

export function CommandPalettePanels({
  panelState,
  filteredTaskTypes,
  t,
  onSelectTaskType,
  onSelectTemplate,
  onToggleFact,
  onConfirmFacts,
  onSelectAgent,
}: CommandPalettePanelsProps) {
  const {
    step,
    loading,
    loadingAgentId,
    inspirations,
    recentCards,
    writerAgents,
    tempSelectedCards,
    canSelectAgent,
  } = panelState;

  if (step === "task_type") {
    return (
      <TaskTypePanel
        loading={loading}
        filteredTaskTypes={filteredTaskTypes}
        t={t}
        onSelectTaskType={onSelectTaskType}
      />
    );
  }

  if (step === "select_template") {
    return (
      <TemplateSelectionPanel
        loading={loading}
        inspirations={inspirations}
        t={t}
        onSelectTemplate={onSelectTemplate}
      />
    );
  }

  if (step === "select_facts") {
    return (
      <FactSelectionPanel
        loading={loading}
        recentCards={recentCards}
        tempSelectedCards={tempSelectedCards}
        t={t}
        onToggleFact={onToggleFact}
        onConfirmFacts={onConfirmFacts}
      />
    );
  }

  return (
    <AgentSelectionPanel
      loading={loading}
      loadingAgentId={loadingAgentId}
      writerAgents={writerAgents}
      canSelectAgent={canSelectAgent}
      onSelectAgent={onSelectAgent}
    />
  );
}
