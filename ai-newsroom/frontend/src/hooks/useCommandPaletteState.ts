import * as React from "react";
import { useRouter } from "next/navigation";

import { api, type Agent, type InspirationAsset, type IntelligenceCard } from "@/lib/api";
import type { CommandPalettePanelState, CommandPaletteStep } from "@/components/shared/command-palette-types";
import { toast } from "@/components/ui/use-toast";

interface UseCommandPaletteStateParams {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  language: string;
  selectedCardIds: number[];
  selectedInspirationIds: number[];
  sourceTaskIds: number[];
}

export function useCommandPaletteState({
  open,
  onClose,
  agents,
  language,
  selectedCardIds,
  selectedInspirationIds,
  sourceTaskIds,
}: UseCommandPaletteStateParams) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [loadingAgentId, setLoadingAgentId] = React.useState<number | null>(null);
  const [step, setStep] = React.useState<CommandPaletteStep>("task_type");
  const [selectedTaskType, setSelectedTaskType] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [tempSelectedCards, setTempSelectedCards] = React.useState<number[]>([]);
  const [tempSelectedInspirations, setTempSelectedInspirations] = React.useState<number[]>([]);
  const [inspirations, setInspirations] = React.useState<InspirationAsset[]>([]);
  const [recentCards, setRecentCards] = React.useState<IntelligenceCard[]>([]);

  const writerAgents = React.useMemo(
    () => agents.filter((agent) => agent.role === "writer"),
    [agents],
  );

  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("task_type");
        setSelectedTaskType(null);
        setQuery("");
        setLoading(false);
        setLoadingAgentId(null);
        setTempSelectedCards([]);
        setTempSelectedInspirations([]);
      }, 200);
    } else {
      setTempSelectedCards([...selectedCardIds]);
      setTempSelectedInspirations([...selectedInspirationIds]);
    }
  }, [open, selectedCardIds, selectedInspirationIds]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (step === "agent") {
          setStep("task_type");
          setSelectedTaskType(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, step]);

  const handleDispatch = React.useCallback(async (taskType: string, agent: Agent | null) => {
    if (loading) return;
    setLoading(true);
    setLoadingAgentId(agent?.id ?? null);
    try {
      const task = await api.createTask({
        task_type: taskType,
        card_ids: tempSelectedCards,
        inspiration_ids: tempSelectedInspirations,
        source_task_ids: sourceTaskIds,
        config: {
          ...(agent ? { assigned_writer_id: agent.id } : {}),
          language,
        },
      });
      onClose();
      router.push(`/editor/${task.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "任务创建失败";
      toast.error("任务创建失败", message);
      console.error("Failed to create task:", error);
      setLoading(false);
      setLoadingAgentId(null);
    }
  }, [language, loading, onClose, router, sourceTaskIds, tempSelectedCards, tempSelectedInspirations]);

  const goToAgentStep = React.useCallback((type: string) => {
    if (writerAgents.length === 1) {
      void handleDispatch(type, writerAgents[0]);
    } else if (writerAgents.length === 0) {
      void handleDispatch(type, null);
    } else {
      setStep("agent");
    }
  }, [handleDispatch, writerAgents]);

  const handleTaskTypeSelect = React.useCallback(async (type: string) => {
    setSelectedTaskType(type);

    if (type === "multi_source_synthesis") {
      if (tempSelectedCards.length > 0 && tempSelectedInspirations.length === 0) {
        setStep("select_template");
        setLoading(true);
        try {
          const nextInspirations = await api.getInspirations();
          setInspirations(nextInspirations);
        } catch {
          // ignore fetch failure
        } finally {
          setLoading(false);
        }
        return;
      }

      if (tempSelectedInspirations.length > 0 && tempSelectedCards.length === 0) {
        setStep("select_facts");
        setLoading(true);
        try {
          const nextCards = await api.getCards();
          setRecentCards(nextCards);
        } catch {
          // ignore fetch failure
        } finally {
          setLoading(false);
        }
        return;
      }
    }

    goToAgentStep(type);
  }, [goToAgentStep, tempSelectedCards.length, tempSelectedInspirations.length]);

  const handleTemplateSelect = React.useCallback((inspirationId: number) => {
    setTempSelectedInspirations([inspirationId]);
    goToAgentStep("multi_source_synthesis");
  }, [goToAgentStep]);

  const handleToggleFact = React.useCallback((cardId: number) => {
    setTempSelectedCards((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  }, []);

  const handleConfirmFacts = React.useCallback(() => {
    goToAgentStep("multi_source_synthesis");
  }, [goToAgentStep]);

  const handleAgentSelect = React.useCallback((agent: Agent) => {
    if (!selectedTaskType) return;
    void handleDispatch(selectedTaskType, agent);
  }, [handleDispatch, selectedTaskType]);

  const sourceCount = tempSelectedCards.length + sourceTaskIds.length + tempSelectedInspirations.length;
  const panelState: CommandPalettePanelState = {
    step,
    loading,
    loadingAgentId,
    inspirations,
    recentCards,
    writerAgents,
    tempSelectedCards,
    canSelectAgent: selectedTaskType !== null,
  };

  return {
    loading,
    loadingAgentId,
    step,
    setStep,
    selectedTaskType,
    query,
    setQuery,
    tempSelectedCards,
    setTempSelectedCards,
    tempSelectedInspirations,
    setTempSelectedInspirations,
    inspirations,
    recentCards,
    writerAgents,
    panelState,
    sourceCount,
    handleDispatch,
    handleTaskTypeSelect,
    handleTemplateSelect,
    handleToggleFact,
    handleConfirmFacts,
    handleAgentSelect,
    goToAgentStep,
  };
}
