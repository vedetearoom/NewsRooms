"use client";

import * as React from "react";

import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { cn, getRelativeTime } from "@/lib/utils";
import type { Task } from "@/lib/api";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface EditorOutlineSidebarProps {
  task?: Task;
  editableTitle: string;
  language: string;
  saveStatus: "saving" | "saved" | "error" | null;
  activeTocId: string | null;
  toc: TocItem[];
  onScrollToHeading: (id: string) => void;
  t: (key: string, fallback?: string) => string;
}

export function EditorOutlineSidebar({
  task,
  editableTitle,
  language,
  saveStatus,
  activeTocId,
  toc,
  onScrollToHeading,
  t,
}: EditorOutlineSidebarProps) {
  return (
    <div className="w-[220px] shrink-0 hidden lg:flex flex-col overflow-hidden">
      <div className="px-3 py-4 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mb-3 px-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-9 shrink-0 rounded-[5px] border border-[var(--card-border)] bg-[var(--card)] flex flex-col items-center justify-center gap-[3px] mt-0.5">
              <div className="w-4 h-[1.5px] rounded-full bg-muted-foreground/30" />
              <div className="w-4 h-[1.5px] rounded-full bg-muted-foreground/30" />
              <div className="w-2.5 h-[1.5px] rounded-full bg-muted-foreground/20" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-medium text-[13px] leading-snug text-zinc-500 dark:text-zinc-400 truncate"
                title={editableTitle || (task ? t(`commandPalette.tasks.${task.task_type}.label`) : "")}
              >
                {editableTitle || (task ? t(`commandPalette.tasks.${task.task_type}.label`) : "")}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 h-[16px] truncate whitespace-nowrap">
                <span>{task ? getRelativeTime(task.created_at, language) : t("editor.justNow")}</span>
                {saveStatus === "saving" && (
                  <span className="text-zinc-400 dark:text-zinc-500 animate-pulse">
                    · {t("editor.saving")}
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    · {t("editor.saved")}
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-destructive/70">
                    · {t("editor.saveError")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-2 mb-4">
          <div className="flex items-center bg-[var(--pill-bg)] p-0.5 rounded-lg">
            <button className="flex-1 flex justify-center items-center py-1.5 bg-[var(--card)] shadow-sm rounded-md text-foreground ring-1 ring-[var(--card-border)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
            </button>
            <button className="flex-1 flex justify-center items-center py-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button className="flex-1 flex justify-center items-center py-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          </div>
        </div>

        <h3 className="text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-2 px-2">
          {t("editor.toc")}
        </h3>
        {toc.length === 0 ? (
          <p className="text-[12px] text-muted-foreground/40 italic px-2">{t("editor.phases.writing")}</p>
        ) : (
          <nav className="space-y-px px-1">
            {toc.map((item) => (
              <button
                key={item.id}
                onClick={() => onScrollToHeading(item.id)}
                className={cn(
                  "block w-full text-left text-[13px] transition-colors px-2 py-1.5 rounded-md cursor-pointer",
                  activeTocId === item.id
                    ? "bg-[var(--nav-active-bg)] text-foreground font-medium"
                    : "text-muted-foreground hover:bg-[var(--nav-hover-bg)] hover:text-foreground",
                  item.level === 2 && "ml-2.5 text-[12px]",
                  item.level === 3 && "ml-5 text-[12px]",
                )}
              >
                <span className="line-clamp-1">{item.text}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="px-3 py-3 mt-auto shrink-0">
        <SidebarFooter />
      </div>
    </div>
  );
}
