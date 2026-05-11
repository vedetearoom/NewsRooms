"use client";

import type { Agent, InspirationAsset, IntelligenceCard } from "@/lib/api";

export type CommandPaletteStep =
  | "task_type"
  | "select_template"
  | "select_facts"
  | "agent";

export interface CommandPalettePanelState {
  step: CommandPaletteStep;
  loading: boolean;
  inspirations: InspirationAsset[];
  recentCards: IntelligenceCard[];
  writerAgents: Agent[];
  tempSelectedCards: number[];
  canSelectAgent: boolean;
}
