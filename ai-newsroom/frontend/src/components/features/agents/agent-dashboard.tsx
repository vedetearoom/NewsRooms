"use client";

import { motion } from "framer-motion";
import { Inbox, Zap, Pen, Search, Image as ImageIcon, Send, ChevronRight } from "lucide-react";
import type { Agent } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PipelineNodeDef {
  id: string;
  labelKey: string;
  descKey?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  glow: string;
}

const PIPELINE_NODES: PipelineNodeDef[] = [
  { id: "input", labelKey: "agents.pipelineInput", descKey: "agents.pipelineInputDesc", icon: Inbox, accent: "text-zinc-400 dark:text-zinc-500", glow: "" },
  { id: "extractor", labelKey: "agents.pipelineExtract", icon: Zap, accent: "text-amber-500 dark:text-amber-400", glow: "shadow-[0_0_12px_rgba(245,158,11,0.15)]" },
  { id: "writer", labelKey: "agents.pipelineWrite", icon: Pen, accent: "text-blue-500 dark:text-blue-400", glow: "shadow-[0_0_12px_rgba(59,130,246,0.15)]" },
  { id: "reviewer", labelKey: "agents.pipelineReview", icon: Search, accent: "text-violet-500 dark:text-violet-400", glow: "shadow-[0_0_12px_rgba(139,92,246,0.15)]" },
  { id: "illustrator", labelKey: "agents.pipelineIllustrate", icon: ImageIcon, accent: "text-emerald-500 dark:text-emerald-400", glow: "shadow-[0_0_12px_rgba(16,185,129,0.15)]" },
  { id: "output", labelKey: "agents.pipelineOutput", descKey: "agents.pipelineOutputDesc", icon: Send, accent: "text-zinc-400 dark:text-zinc-500", glow: "" },
];

interface AgentDashboardProps {
  agents: Agent[];
  isLoading: boolean;
  roleGroups: { id: string; label: string; icon: React.ReactNode }[];
  t: (key: string, fallback?: string) => string;
  getLocalizedAgentName: (agent: Agent) => string;
  onSelect: (id: number | "new") => void;
}

export function AgentDashboard({
  agents,
  t,
  getLocalizedAgentName,
  onSelect,
}: AgentDashboardProps) {
  const getAgentForRole = (roleId: string): Agent | null => {
    const group = agents
      .filter((a) => a.role === roleId)
      .sort((a, b) => Number(b.is_system) - Number(a.is_system) || a.id - b.id);
    return group[0] ?? null;
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-10 py-12">
      {/* Header */}
      <motion.div
        className="mb-12 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[20px] font-bold tracking-tight text-foreground">
          {t("agents.title", "Agent Studio")}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {t("agents.dashboardSubtitle", "Automated news pipeline")}
        </p>
      </motion.div>

      {/* Pipeline */}
      <div className="flex w-full max-w-xl flex-col items-center gap-3">
        {PIPELINE_NODES.map((node, index) => {
          const isTerminal = index === 0 || index === PIPELINE_NODES.length - 1;
          const agent = !isTerminal ? getAgentForRole(node.id) : null;
          const isActive = Boolean(agent?.is_active);
          const Icon = node.icon;
          const label = t(node.labelKey, node.labelKey);
          const desc = node.descKey ? t(node.descKey, "") : undefined;

          return (
            <motion.div
              key={node.id}
              className="flex w-full flex-col items-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.07, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Connector line (above) with data flow particle */}
              {index > 0 && (
                <div
                  className="relative flex h-6 w-px flex-col items-center"
                  style={{ "--i": index } as React.CSSProperties}
                >
                  {/* Base line */}
                  <div className="h-full w-px bg-gradient-to-b from-zinc-200 to-zinc-300 dark:from-white/[0.08] dark:to-white/[0.12]" />
                  {/* Active glow */}
                  {isActive && (
                    <div className="absolute top-0 h-full w-px animate-pulse bg-gradient-to-b from-emerald-400/60 to-emerald-500/30" />
                  )}
                  {/* Traveling data particle */}
                  <div
                    className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
                    style={{
                      animation: `dataFlow 1.8s ${index * 0.3}s ease-in-out infinite`,
                    }}
                  >
                    <div className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6),0_0_8px_rgba(52,211,153,0.3)]" />
                  </div>
                </div>
              )}

              {/* Node */}
              {isTerminal ? (
                /* Input / Output terminal nodes */
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-200/80 dark:border-white/[0.08] px-5 py-3 transition-colors hover:border-zinc-300 dark:hover:border-white/[0.14]">
                  <Icon className={cn("h-4 w-4", node.accent)} />
                  <div>
                    <p className="text-[12px] font-medium text-foreground">{label}</p>
                    {desc && (
                      <p className="text-[11px] text-muted-foreground/60">{desc}</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Role agent node */
                <motion.button
                  type="button"
                  onClick={() => agent && onSelect(agent.id)}
                  whileHover={agent ? { scale: 1.01, y: -1 } : undefined}
                  whileTap={agent ? { scale: 0.995 } : undefined}
                  className={cn(
                    "group w-full rounded-2xl border px-5 py-4 text-left transition-all duration-300",
                    "border-zinc-200/60 dark:border-white/[0.06]",
                    "bg-white dark:bg-white/[0.02]",
                    agent
                      ? "hover:border-zinc-300 dark:hover:border-white/[0.12] hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.2)] cursor-pointer"
                      : "opacity-60 cursor-default",
                    isActive && cn("border-emerald-200/60 dark:border-emerald-500/20", node.glow),
                  )}
                  disabled={!agent}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
                          "bg-zinc-50 dark:bg-white/[0.05]",
                          node.accent,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-muted-foreground/70">{label}</p>
                        <p className="text-[13px] font-semibold text-foreground">
                          {agent ? getLocalizedAgentName(agent) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {agent && (
                        <>
                          <span className="text-[11px] text-muted-foreground/50">
                            {agent.model_ref}
                          </span>
                          {isActive && (
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
                        </>
                      )}
                    </div>
                  </div>
                </motion.button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
