"use client";

import * as React from "react";
import { Bot, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/api";
import { PageEmptyState, PageLoadingState } from "@/components/shared/page-states";

interface RoleGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface AgentSidebarProps {
  agents: Agent[];
  isLoading: boolean;
  activeId: number | "new" | null;
  roleGroups: RoleGroup[];
  t: (key: string, fallback?: string) => string;
  getLocalizedAgentName: (agent: Agent | null | undefined) => string;
  onSelect: (id: number | "new") => void;
}

export function AgentSidebar({
  agents,
  isLoading,
  activeId,
  roleGroups,
  t,
  getLocalizedAgentName,
  onSelect,
}: AgentSidebarProps) {
  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-zinc-200/70 bg-white/95 dark:border-white/[0.05] dark:bg-[#0a0b0d]">
      <div className="flex h-[56px] shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground/80" />
          <span className="text-[13px] font-semibold tracking-tight text-foreground">{t("agents.title")}</span>
        </div>
        <button
          onClick={() => onSelect("new")}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-white/[0.06]"
          title={t("agents.createNewAgent")}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <PageLoadingState compact label={t("common.loading", "Loading...")} />
        ) : agents.length === 0 ? (
          <PageEmptyState
            compact
            icon={Bot}
            title={t("agents.emptyTitle", "No agents yet")}
            description={t("agents.emptyDesc", "Create your first agent to start customizing workflows.")}
          />
        ) : (
          roleGroups.map((group) => {
            const groupAgents = agents
              .filter((agent) => agent.role === group.id)
              .sort((a, b) => Number(b.is_system) - Number(a.is_system) || a.id - b.id);

            if (groupAgents.length === 0) return null;

            const hasActive = groupAgents.some((agent) => agent.is_active);

            return (
              <div key={group.id}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <div className="flex w-4 shrink-0 items-center justify-center text-muted-foreground/70">{group.icon}</div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/45">{group.label}</span>
                </div>
                <div className="space-y-1">
                  {groupAgents.map((agent) => {
                    const isActiveSlot = agent.is_active || (!hasActive && agent.is_system);

                    return (
                      <button
                        key={agent.id}
                        onClick={() => onSelect(agent.id)}
                        className={cn(
                          "group relative flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] transition-all",
                          activeId === agent.id
                            ? "bg-zinc-50 text-foreground dark:bg-white/[0.04]"
                            : "text-muted-foreground hover:bg-zinc-50/70 hover:text-foreground dark:hover:bg-white/[0.03]",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute inset-y-2 left-0 w-0.5 rounded-full bg-transparent transition-colors",
                            activeId === agent.id && "bg-zinc-950 dark:bg-white",
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate pr-2",
                            activeId === agent.id ? "font-semibold text-foreground" : "font-medium",
                          )}
                        >
                          {getLocalizedAgentName(agent)}
                        </span>
                        <div className="flex min-w-[68px] shrink-0 items-center justify-end gap-2">
                          {agent.is_system && (
                            <span className="text-[10px] font-medium text-muted-foreground/55">
                              {t("agents.sysAgentBadge")}
                            </span>
                          )}
                          {isActiveSlot ? (
                            <span
                              className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                              title={t("agents.activeDefaultHint", "Active default for this role")}
                              aria-label={t("agents.activeDefaultHint", "Active default for this role")}
                            />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 p-3">
        <button
          onClick={() => onSelect("new")}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 text-[13px] font-medium text-foreground transition-all hover:bg-zinc-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.07] dark:hover:border-white/[0.14] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("agents.createNewAgent")}
        </button>
      </div>
    </div>
  );
}
