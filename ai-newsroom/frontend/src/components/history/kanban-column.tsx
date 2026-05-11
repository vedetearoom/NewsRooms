import * as React from "react";
import { type Task } from "@/lib/api";
import { TaskCard } from "./task-card";
import { useTranslation } from "@/hooks/useTranslation";

interface StageConfig {
  id: string;
  label: string;
  Icon: React.FC<{className?: string}>;
  color: string;
}

interface KanbanColumnProps {
  stage: StageConfig;
  tasks: Task[];
  loading: boolean;
  onTaskClick: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
}

const IconDots = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

export function KanbanColumn({ stage, tasks, loading, onTaskClick, onDeleteTask }: KanbanColumnProps) {
  const { t } = useTranslation();
  
  return (
    <div key={stage.id} className="w-[274px] flex flex-col shrink-0 h-full group/col">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className="shrink-0"><stage.Icon className={stage.color} /></span>
          <span className="text-[12px] font-medium text-foreground dark:text-zinc-300">{stage.label}</span>
          <span className="text-[11px] text-muted-foreground/40 dark:text-zinc-500 tabular-nums">{tasks.length}</span>
        </div>
        {/* ··· and + actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity">
          <button className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5 transition-colors" title={t("vault.columnOptions", "Column options")}>
            <IconDots />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5 transition-colors" title={t("vault.newTask", "New task")}>
            <IconPlus />
          </button>
        </div>
      </div>

      {/* Column body */}
      <div className="flex-1 overflow-y-auto rounded-xl bg-zinc-50 dark:bg-white/[0.015] dark:border dark:border-white/[0.04] p-2 space-y-2 custom-scrollbar min-h-0">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-white/[0.03] rounded-lg p-3 space-y-2 dark:border dark:border-white/[0.06]">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          ))
        ) : tasks.length === 0 ? (
          <div className="h-14 flex items-center justify-center">
            <span className="text-[11px] text-muted-foreground/30 dark:text-zinc-600">{t('vault.noTasks')}</span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              icon={stage.Icon}
              iconColor={stage.color}
              onClick={() => onTaskClick(task.id)}
              onDelete={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
            />
          ))
        )}
      </div>
    </div>
  );
}
