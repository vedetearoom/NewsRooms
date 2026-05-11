"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { Agent } from "@/lib/api";
import { FileText, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { CommandPaletteEmptyState, CommandPaletteOptionRow } from "./command-palette-panel-parts";
import type { CommandPaletteTaskType } from "./command-palette-task-types";
import type { CommandPalettePanelState } from "./command-palette-types";

interface TranslationProps {
  t: (key: string) => string;
}

interface TaskTypePanelProps extends TranslationProps {
  loading: boolean;
  filteredTaskTypes: CommandPaletteTaskType[];
  onSelectTaskType: (type: string) => void;
}

export function TaskTypePanel({
  loading,
  filteredTaskTypes,
  t,
  onSelectTaskType,
}: TaskTypePanelProps) {
  if (filteredTaskTypes.length === 0) {
    return <CommandPaletteEmptyState loading={false} emptyLabel={t("commandPalette.noMatch")} />;
  }

  return (
    <>
      {filteredTaskTypes.map((item) => {
        const Icon = item.icon;
        return (
          <CommandPaletteOptionRow
            key={item.type}
            onClick={() => onSelectTaskType(item.type)}
            disabled={loading}
            icon={
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                <Icon className={cn("w-4 h-4", item.color)} />
              </div>
            }
            title={item.label}
            description={item.description}
          />
        );
      })}
    </>
  );
}

interface TemplateSelectionPanelProps extends TranslationProps {
  loading: boolean;
  inspirations: CommandPalettePanelState["inspirations"];
  onSelectTemplate: (inspirationId: number) => void;
}

export function TemplateSelectionPanel({
  loading,
  inspirations,
  t,
  onSelectTemplate,
}: TemplateSelectionPanelProps) {
  if (inspirations.length === 0) {
    return <CommandPaletteEmptyState loading={loading} emptyLabel={t("commandPalette.emptyTemplate")} />;
  }

  return (
    <>
      {inspirations.map((inspiration) => (
        <CommandPaletteOptionRow
          key={inspiration.id}
          onClick={() => onSelectTemplate(inspiration.id)}
          disabled={loading}
          icon={
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-indigo-500" />
            </div>
          }
          title={inspiration.title}
          description={inspiration.hook_text}
        />
      ))}
    </>
  );
}

interface FactSelectionPanelProps extends TranslationProps {
  loading: boolean;
  recentCards: CommandPalettePanelState["recentCards"];
  tempSelectedCards: number[];
  onToggleFact: (cardId: number) => void;
  onConfirmFacts: () => void;
}

export function FactSelectionPanel({
  loading,
  recentCards,
  tempSelectedCards,
  t,
  onToggleFact,
  onConfirmFacts,
}: FactSelectionPanelProps) {
  if (recentCards.length === 0) {
    return <CommandPaletteEmptyState loading={loading} emptyLabel={t("commandPalette.emptyFacts")} />;
  }

  return (
    <div className="px-2">
      {recentCards.map((card) => {
        const isSelected = tempSelectedCards.includes(card.id);
        return (
          <CommandPaletteOptionRow
            key={card.id}
            onClick={() => onToggleFact(card.id)}
            disabled={loading}
            compact
            icon={<Checkbox checked={isSelected} className="pointer-events-none shrink-0" />}
            title={
              <div className="flex items-center gap-2 min-w-0">
                {card.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.cover_image} className="w-7 h-7 rounded object-cover shrink-0" alt="" />
                ) : null}
                <div className="truncate">{card.title}</div>
              </div>
            }
            trailing={null}
          />
        );
      })}
      <div className="pt-2 pb-1 px-1 border-t border-zinc-100 dark:border-white/[0.04] mt-2 sticky bottom-0 bg-white dark:bg-[#1c1c1e]">
        <button
          onClick={onConfirmFacts}
          disabled={tempSelectedCards.length === 0}
          className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
        >
          {t("commandPalette.confirmFacts").replace("{count}", String(tempSelectedCards.length))}
        </button>
      </div>
    </div>
  );
}

interface AgentSelectionPanelProps {
  loading: boolean;
  writerAgents: Agent[];
  canSelectAgent: boolean;
  onSelectAgent: (agent: Agent) => void;
}

export function AgentSelectionPanel({
  loading,
  writerAgents,
  canSelectAgent,
  onSelectAgent,
}: AgentSelectionPanelProps) {
  return (
    <>
      {writerAgents.map((agent) => (
        <CommandPaletteOptionRow
          key={agent.id}
          onClick={() => onSelectAgent(agent)}
          disabled={loading || !canSelectAgent}
          icon={
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/5 flex items-center justify-center shrink-0 text-muted-foreground">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </div>
          }
          title={agent.name}
          description={`${agent.system_prompt.slice(0, 70)}...`}
          trailing={
            <kbd className="text-[10px] bg-zinc-100 dark:bg-white/10 rounded px-1.5 py-0.5 text-muted-foreground shrink-0">
              Enter
            </kbd>
          }
        />
      ))}
    </>
  );
}
