"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { type Task } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { useAgents } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { getEditorPhaseState, type EditorPhase } from "@/lib/editor-phase";

/**
 * Convert editor HTML to clean plain text suitable for social media
 * (e.g. Xiaohongshu, WeChat, Weibo). Preserves structure via line breaks
 * and Unicode formatting, strips all HTML tags and internal markup.
 */
function htmlToSocialText(html: string): string {
  if (!html) return "";

  let text = html;

  // 1. Remove images (keep alt text if meaningful)
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/gi, (_, alt) => {
    if (!alt || alt === 'generating...' || alt === 'uploading' || alt === 'AI Generated Image') return '';
    return `[${alt}]`;
  });
  text = text.replace(/<img[^>]*\/?>/gi, '');

  // 2. Strip critique marks (data-critique-mark spans)
  text = text.replace(/<span[^>]*data-critique-mark[^>]*>/gi, '');
  text = text.replace(/<\/span>/gi, '');

  // 3. Convert headings to plain text with line breaks
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n');

  // 4. Convert blockquotes
  text = text.replace(/<blockquote[^>]*>\s*<p>(.*?)<\/p>\s*<\/blockquote>/gi, '\n$1\n');
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n$1\n');

  // 5. Convert list items
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  text = text.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  // 6. Convert <hr> to separator
  text = text.replace(/<hr\s*\/?>/gi, '\n─────────────────\n');

  // 7. Convert <br> to newline
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // 8. Convert <p> to blocks with line breaks
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

  // 9. Convert inline formatting
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1');
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '$1');
  text = text.replace(/<s[^>]*>(.*?)<\/s>/gi, '$1');
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)');

  // 10. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 11. Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');

  // 12. Clean up excessive whitespace while preserving paragraph structure
  text = text.replace(/[ \t]+/g, ' ');        // collapse horizontal whitespace
  text = text.replace(/\n{4,}/g, '\n\n\n');   // max 3 consecutive newlines
  text = text.replace(/^\n+/, '');              // trim leading newlines
  text = text.replace(/\n+$/, '');              // trim trailing newlines
  text = text.replace(/\n +/g, '\n');           // trim leading spaces after newline

  return text.trim();
}

interface EditorHeaderProps {
  task: Task | null | undefined;
  phase: EditorPhase;
  hasUserEdits: boolean;
  isRerunning: boolean;
  isRegenerating: boolean;
  panelOpen: boolean;
  finalContent: string;
  onRerunReview: () => void;
  onStartReview: (agentId?: number) => void;
  onTogglePanel: () => void;
  onRevertTask: () => void;
  onRegenerate: (agentId?: number) => void;
  onMarkComplete: () => void;
}

export function EditorHeader({
  task,
  phase,
  isRerunning,
  isRegenerating,
  panelOpen,
  finalContent,
  onStartReview,
  onTogglePanel,
  onRevertTask,
  onRegenerate,
  onMarkComplete
}: EditorHeaderProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { agents } = useAgents();
  const phaseState = getEditorPhaseState(phase, { isRegenerating, isRerunning });

  const getLocalizedAgentName = React.useCallback((agent: { is_system?: boolean; name: string }) => {
    if (!agent?.is_system) return agent?.name || "";
    const nameMap: Record<string, string> = {
      "默认提取器": t('agents.defaultExtractor'),
      "Default Extractor": t('agents.defaultExtractor'),
      "标准写作助手": t('agents.standardWriter'),
      "Standard Writer": t('agents.standardWriter'),
      "格式与语气审核": t('agents.formatReviewer'),
      "Format & Tone Reviewer": t('agents.formatReviewer'),
      "默认插画师": t('agents.defaultIllustrator'),
      "Default Illustrator": t('agents.defaultIllustrator'),
    };
    return nameMap[agent.name] || agent.name;
  }, [t]);

  const writers = React.useMemo(() => agents.filter(a => a.role === "writer"), [agents]);
  const reviewers = React.useMemo(() => agents.filter(a => a.role === "reviewer"), [agents]);

  const phaseLabel = React.useMemo(() => {
    switch (phase) {
      case 'idle': return t('editor.phases.idle');
      case 'tooling': return "Tooling";
      case 'writing': return t('editor.phases.writing');
      case 'written': return t('editor.phases.written');
      case 'reviewing': return t('editor.phases.reviewing');
      case 'reviewed': return t('editor.phases.reviewed');
      case 'diff': return t('editor.phases.diff');
      case 'completed': return t('editor.phases.completed');
      default: return "";
    }
  }, [phase, t]);

  return (
    <header className="shrink-0 bg-[var(--background)] z-30">
      <div className="flex items-center justify-between px-5 h-[52px]">
        {/* Left: Home icon */}
        <button
          onClick={() => router.push("/vault")}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors cursor-pointer"
          title={t("editor.backToVault")}
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>

        {/* Center: Breadcrumb + Phase Status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[12px] text-muted-foreground/40 font-medium">
          <span>{t('editor.pipelineCrumb')}</span>
          <span className="text-muted-foreground/20">/</span>
          <span>{task ? (task.task_type ? t(`vault.taskTypes.${task.task_type}`) : '') : ''}</span>
          <span className="text-muted-foreground/20">—</span>
          <span>{task ? new Date(task.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: "short", day: "numeric", year: "numeric" }) : ''}</span>
          <span className="text-muted-foreground/20 px-1">·</span>
          <span className={cn(
             "text-muted-foreground/40", 
             (phase === "writing" || phaseState.isReviewProcessing) && "animate-pulse"
          )}>
            {phaseLabel}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">

          {phaseState.canRegenerate && (
            <div className="relative group">
              <button
                onClick={() => onRegenerate()}
                disabled={phaseState.anyProcessing}
                title={isRegenerating ? t("editor.regenerating") : t("editor.regenerate")}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200",
                  "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300",
                  "hover:bg-zinc-100 dark:hover:bg-white/[0.06]",
                  phaseState.anyProcessing ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                )}
              >
                {isRegenerating ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
              {writers.length > 0 && !phaseState.anyProcessing && (
                <div className="absolute right-0 top-full pt-1.5 w-[200px] z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                  <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200/80 dark:border-white/10 rounded-xl shadow-xl shadow-black/8 p-1.5 flex flex-col gap-0.5">
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('agents.writersGroup')}
                    </div>
                    {writers.map(writer => (
                      <button 
                        key={writer.id}
                        onClick={() => onRegenerate(writer.id)} 
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors font-medium text-foreground text-left"
                      >
                        <span className="truncate">{getLocalizedAgentName(writer)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Review — only in "written" phase (reviewed phase has it in sidebar) */}
          {phaseState.canStartReview && (
            <div className="relative group">
              <button
                onClick={() => onStartReview()}
                disabled={phaseState.anyProcessing}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all duration-200",
                  "text-zinc-500 dark:text-zinc-400",
                  phaseState.anyProcessing
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:text-zinc-800 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-white/[0.06] cursor-pointer"
                )}
              >
                <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                {t("editor.sendToReview")}
              </button>
              {reviewers.length > 0 && !phaseState.anyProcessing && (
                <div className="absolute right-0 top-full pt-1.5 w-[200px] z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                  <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200/80 dark:border-white/10 rounded-xl shadow-xl shadow-black/8 p-1.5 flex flex-col gap-0.5">
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('agents.reviewers')}
                    </div>
                    {reviewers.map(reviewer => (
                      <button 
                        key={reviewer.id}
                        onClick={() => onStartReview(reviewer.id)} 
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors font-medium text-foreground text-left"
                      >
                        <span className="truncate">{getLocalizedAgentName(reviewer)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reviewing spinner — shown during review processing */}
          {phaseState.isReviewProcessing && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-zinc-400 dark:text-zinc-500">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t("editor.reviewingStatus")}
            </div>
          )}

          {/* Status-tag: Mark Complete — light, breathable */}
          {phaseState.canMarkComplete && (
            <button
              onClick={onMarkComplete}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-200 cursor-pointer",
                "text-zinc-600 dark:text-zinc-300",
                "hover:bg-zinc-100 dark:hover:bg-white/[0.06]",
                "border border-zinc-200/60 dark:border-white/[0.08]"
              )}
            >
              <span className="w-[6px] h-[6px] rounded-full bg-emerald-400/70 dark:bg-emerald-400/60 shrink-0" />
              {t("editor.markComplete")}
            </button>
          )}

          {/* Divider + Panel Toggle */}
          {phaseState.canTogglePanel && (
            <>
              <div className="w-px h-4 bg-zinc-200 dark:bg-white/10 mx-1" />
              <button onClick={onTogglePanel}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 cursor-pointer",
                  "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300",
                  "hover:bg-zinc-100 dark:hover:bg-white/[0.06]",
                  panelOpen ? "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300" : ""
                )}
                title={panelOpen ? t('editor.hideNotes') : t('editor.showNotes')}
              >
                <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
                  <path d="M15 3v18" strokeWidth={1.5} />
                </svg>
              </button>
            </>
          )}

          {/* Completed phase: Reopen + Export */}
          {phaseState.isCompleted && (
            <>
              <button onClick={onRevertTask}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-200 disabled:opacity-50",
                  "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
                  "border border-transparent hover:bg-white dark:hover:bg-[#1a1b1e] hover:border-zinc-200 dark:hover:border-white/[0.08] hover:shadow-sm"
                )}
              >
                {t('editor.reopenTask')}
              </button>
              <div className="relative group">
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-200 disabled:opacity-50",
                    "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
                    "border border-transparent hover:bg-white dark:hover:bg-[#1a1b1e] hover:border-zinc-200 dark:hover:border-white/[0.08] hover:shadow-sm"
                  )}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  {t('editor.export')}
                </button>
                <div className="absolute right-0 top-full pt-1.5 w-[200px] z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                  <div className="bg-white dark:bg-[#1c1c1e] border border-zinc-200/80 dark:border-white/10 rounded-xl shadow-xl shadow-black/8 p-1.5 flex flex-col gap-0.5">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(finalContent);
                        toast.success(t("editor.copiedTitle"), t("editor.copiedMarkdownDesc"));
                      }} 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors font-medium text-foreground"
                    >
                      <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      {t("editor.copyMarkdown")}
                    </button>
                    <button 
                      onClick={() => {
                        const text = htmlToSocialText(finalContent);
                        navigator.clipboard.writeText(text);
                        toast.success(t("editor.copiedTitle"), t("editor.copiedPlainTextDesc"));
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors font-medium text-foreground"
                    >
                      <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      {t("editor.copyPlainText")}
                    </button>
                    <div className="h-px bg-zinc-100 dark:bg-white/5 mx-1 my-0.5" />
                    <button 
                      onClick={() => alert("Simulating webhook push...")} 
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors font-medium text-muted-foreground"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      {t("editor.deployWebhook")}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
