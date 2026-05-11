"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, type Task } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { KanbanColumn } from "@/components/history/kanban-column";
import { useTasks } from "@/hooks/useApi";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useClickOutside } from "@/hooks/useClickOutside";
import { PageEmptyState } from "@/components/shared/page-states";
import { FolderKanban } from "lucide-react";
import { getTaskBoardStage } from "@/lib/task-status";

/* ── SVG Icons ─────────────────────────────────────────────── */
const IconBacklog = ({ className }: { className?: string }) => (
  <svg className={cn("w-3.5 h-3.5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" strokeWidth="1.5" strokeDasharray="4 4" />
  </svg>
);
const IconTodo = ({ className }: { className?: string }) => (
  <svg className={cn("w-3.5 h-3.5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
  </svg>
);
const IconInProgress = ({ className }: { className?: string }) => (
  <svg className={cn("w-3.5 h-3.5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
    <path d="M12 4a8 8 0 000 16z" fill="currentColor" opacity="0.8" />
  </svg>
);
const IconDone = ({ className }: { className?: string }) => (
  <svg className={cn("w-3.5 h-3.5", className)} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" />
    <path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Stage config ──────────────────────────────────────────── */
const PIPELINE_STAGES = [
  { id: "pending",   label: "", Icon: IconBacklog,    color: "text-zinc-400 dark:text-zinc-500" },
  { id: "writing",   label: "", Icon: IconTodo,       color: "text-zinc-500 dark:text-zinc-400" },
  { id: "reviewing", label: "", Icon: IconInProgress, color: "text-amber-500 dark:text-amber-400/90" },
  { id: "completed", label: "", Icon: IconDone,       color: "text-blue-500 dark:text-blue-400/90" },
  { id: "failed",    label: "", Icon: IconBacklog,    color: "text-red-500 dark:text-red-400/90" },
];

export default function VaultPage() {
  const router = useRouter();
  const { tasks, isLoading: loading, mutate } = useTasks();
  const { t } = useTranslation();

  const stages = React.useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      let labelKey = "vault.backlog";
      if (stage.id === "writing") labelKey = "vault.todo";
      if (stage.id === "reviewing") labelKey = "vault.inProgress";
      if (stage.id === "completed") labelKey = "vault.done";
      if (stage.id === "failed") labelKey = "vault.failed";
      return { ...stage, label: t(labelKey) };
    });
  }, [t]);

  const [filterOpen, setFilterOpen] = React.useState(false);
  const [displayOpen, setDisplayOpen] = React.useState(false);

  const taskTypes = React.useMemo(() => Array.from(new Set(tasks.map(t => t.task_type))).filter(Boolean) as string[], [tasks]);
  const [selectedTypes, setSelectedTypes] = React.useState<Set<string>>(new Set());
  
  const [visibleStages, setVisibleStages] = React.useState<Set<string>>(new Set(PIPELINE_STAGES.map(s => s.id)));

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleStage = (stageId: string) => {
    setVisibleStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };
  
  const [deleteTaskId, setDeleteTaskId] = React.useState<number | null>(null);

  const handleDeleteTask = async (id: number) => {
    setDeleteTaskId(id);
  };

  const confirmDeleteTask = async () => {
    if (!deleteTaskId) return;
    await api.deleteTask(deleteTaskId);
    mutate(tasks.filter(t => t.id !== deleteTaskId), false);
  };

  const tasksByStage = React.useMemo(() => {
    const g: Record<string, Task[]> = { pending: [], writing: [], reviewing: [], completed: [], failed: [] };
    const filteredTasks = tasks.filter(t => selectedTypes.size === 0 || selectedTypes.has(t.task_type));
    filteredTasks.forEach((t) => {
      const status = getTaskBoardStage(t.status);
      if (g[status]) {
        g[status].push(t);
      } else {
        g.pending.push(t);
      }
    });
    return g;
  }, [tasks, selectedTypes]);
  const visibleStageList = React.useMemo(
    () => stages.filter((stage) => visibleStages.has(stage.id)),
    [stages, visibleStages],
  );
  const filteredTaskCount = React.useMemo(
    () => Object.values(tasksByStage).reduce((total, items) => total + items.length, 0),
    [tasksByStage],
  );
  const hasActiveTypeFilter = selectedTypes.size > 0;

  // Click outside to close overrides
  const filterRef = React.useRef<HTMLDivElement>(null);
  const displayRef = React.useRef<HTMLDivElement>(null);
  useClickOutside({
    ref: filterRef,
    enabled: filterOpen,
    onClickOutside: () => setFilterOpen(false),
  });
  useClickOutside({
    ref: displayRef,
    enabled: displayOpen,
    onClickOutside: () => setDisplayOpen(false),
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-[#08090b]">
      {/* ── Row 1: Header ── */}
      <div className="shrink-0 h-[52px] px-6 flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.05] frosted-bar">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold text-foreground dark:text-zinc-200">{t('vault.title')}</span>
          <span className="text-[11px] text-muted-foreground">{tasks.filter(t => selectedTypes.size === 0 || selectedTypes.has(t.task_type)).length} {t('vault.total')}</span>
        </div>
      </div>

      {/* ── Row 2: Toolbar ── */}
      <div className="shrink-0 h-[40px] px-6 flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.04] bg-white dark:bg-transparent frosted-bar">
        <div className="relative" ref={filterRef}>
          <button 
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-medium transition-colors px-2 py-1 rounded-md -ml-2",
              filterOpen ? "bg-zinc-100 dark:bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-white/5"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t('vault.filter')} {selectedTypes.size > 0 && <span className="ml-1 bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{selectedTypes.size}</span>}
          </button>
          
          {filterOpen && (
            <div className="absolute top-full left-0 mt-1 w-[200px] z-50 bg-white dark:bg-[#111214] border border-zinc-200 dark:border-white/[0.08] rounded-lg shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] py-2 flex flex-col items-start animate-in fade-in slide-in-from-top-1 dark:backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t('vault.filterByType')}
              </div>
              {taskTypes.length === 0 && <div className="px-3 py-2 text-[12px] text-muted-foreground">{t("vault.noTypesAvailable")}</div>}
              {taskTypes.map(type => {
                const transKey = `vault.taskTypes.${type}`;
                const label = t(transKey);
                const displayLabel = label === transKey ? type : label;
                return (
                <label key={type} className="flex items-center gap-2 px-3 py-1.5 w-full hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedTypes.has(type)}
                    onChange={() => toggleType(type)}
                    className="rounded border-zinc-300 dark:border-zinc-700 bg-transparent text-zinc-600 dark:text-zinc-400 focus:ring-zinc-400/30 accent-zinc-600 dark:accent-zinc-400"
                  />
                  <span className="text-[13px] text-foreground">{displayLabel}</span>
                </label>
                );
              })}
              {selectedTypes.size > 0 && (
                <div className="w-full px-3 pt-2 mt-1 border-t border-zinc-100 dark:border-white/5">
                  <button onClick={() => setSelectedTypes(new Set())} className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors w-full text-left">{t('vault.clearFields')}</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={displayRef}>
          <button 
            onClick={() => setDisplayOpen(!displayOpen)}
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-medium transition-colors px-2 py-1 rounded-md -mr-2",
              displayOpen ? "bg-zinc-100 dark:bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-white/5"
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            {t('vault.display')} {visibleStages.size !== PIPELINE_STAGES.length && <span className="ml-1 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{visibleStages.size}</span>}
          </button>

          {displayOpen && (
            <div className="absolute top-full right-0 mt-1 w-[200px] z-50 bg-white dark:bg-[#111214] border border-zinc-200 dark:border-white/[0.08] rounded-lg shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] py-2 flex flex-col items-start animate-in fade-in slide-in-from-top-1 dark:backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t('vault.visibleColumns')}
              </div>
              {stages.map(stage => (
                <label key={stage.id} className="flex items-center gap-2 px-3 py-1.5 w-full hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={visibleStages.has(stage.id)}
                    onChange={() => toggleStage(stage.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700 bg-transparent text-blue-500 focus:ring-blue-500/30"
                  />
                  <span className="text-[13px] text-foreground">{stage.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!loading && filteredTaskCount === 0 ? (
          <PageEmptyState
            icon={FolderKanban}
            title={hasActiveTypeFilter ? t("vault.noTasks") : t("vault.emptyBoardTitle")}
            description={
              hasActiveTypeFilter
                ? t("vault.emptyFilteredDesc")
                : t("vault.emptyBoardDesc")
            }
            action={
              hasActiveTypeFilter
                ? {
                    label: t("vault.clearFields"),
                    onClick: () => setSelectedTypes(new Set()),
                  }
                : undefined
            }
            className="flex-1"
          />
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="h-full flex gap-3 px-5 py-4 min-w-max items-start">
              {visibleStageList.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  tasks={tasksByStage[stage.id] ?? []}
                  loading={loading}
                  onTaskClick={(taskId) => router.push(`/editor/${taskId}`)}
                  onDeleteTask={handleDeleteTask}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTaskId}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={confirmDeleteTask}
        title={t('vault.confirmDeleteTitle')}
        description={`${t('vault.confirmDeleteDesc1')}TSK-${deleteTaskId}${t('vault.confirmDeleteDesc2')}`}
        confirmText={t('vault.confirmDeleteBtn')}
      />
    </div>
  );
}
