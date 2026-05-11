import * as React from "react";
import { type Task } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";

const TYPE_LABELS: Record<string, string> = {
  daily_report:           "vault.taskTypes.daily_report",
  social_post:            "vault.taskTypes.social_post",
  deep_dive:              "vault.taskTypes.deep_dive",
  summary:                "vault.taskTypes.summary",
  multi_source_synthesis: "vault.taskTypes.multi_source_synthesis",
};

const IconDoc = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconSources = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);

const IconRobot = () => (
  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
);

const IconSignal = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
    <rect x="4" y="15" width="2.5" height="4" rx="0.5" />
    <rect x="10.5" y="10" width="2.5" height="9" rx="0.5" />
    <rect x="17" y="5" width="2.5" height="14" rx="0.5" opacity="0.3" />
  </svg>
);

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  icon: React.FC<{className?: string}>;
  iconColor: string;
}

export function TaskCard({ task, onClick, onDelete, icon: StatusIcon, iconColor }: TaskCardProps) {
  const { t } = useTranslation();
  const typeLabelKey = TYPE_LABELS[task.task_type];
  const typeLabel = typeLabelKey ? t(typeLabelKey) : task.task_type;

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-[#1c1c1e] rounded-lg px-3 py-3 cursor-pointer
                 shadow-sm dark:shadow-none transition-all border border-transparent dark:border-white/[0.06] hover:border-zinc-200 dark:hover:border-white/[0.12]"
    >
      {/* Top row: ID + Avatar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground dark:text-zinc-400/80 uppercase tracking-wider">
          TSK-{task.id}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(e);
            }}
            className="w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all cursor-pointer"
            title={t('vault.confirmDeleteBtn')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
          <div className="w-[18px] h-[18px] rounded-full bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/5 flex items-center justify-center shrink-0">
            <IconRobot />
          </div>
        </div>
      </div>

      {/* Middle row: Status Icon + Title */}
      <div className="flex items-start gap-1.5 mb-3">
        <div className="mt-[3px] shrink-0">
          <StatusIcon className={iconColor} />
        </div>
        <p className="text-[13px] font-medium text-foreground dark:text-zinc-200/90 leading-snug line-clamp-2">
          {task.title === `Task: ${task.task_type}` ? typeLabel : (task.title || "Untitled Intelligence Report")}
        </p>
      </div>

      {/* Bottom row: Metadata tags entirely flush left */}
      <div className="flex items-center flex-wrap gap-1.5">
        <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0 text-muted-foreground/30 dark:text-zinc-500">
          <IconSignal />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-1.5 py-[2px] rounded text-[10px] font-medium text-muted-foreground dark:text-zinc-400/90 border border-zinc-200 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <IconDoc />
            {typeLabel}
          </span>
          <span className="flex items-center gap-1 px-1.5 py-[2px] rounded text-[10px] font-medium text-muted-foreground dark:text-zinc-400/90 border border-zinc-200 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <IconSources />
            {task.card_ids?.length ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}
