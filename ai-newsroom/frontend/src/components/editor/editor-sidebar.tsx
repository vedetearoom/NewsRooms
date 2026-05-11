"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAgents } from "@/hooks/useApi";
import { type AgentRunEvent, type CritiqueItem } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { getEditorPhaseState, type EditorPhase } from "@/lib/editor-phase";
import { X } from "lucide-react";

interface EditorSidebarProps {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  activeTab: "review" | "trace";
  setActiveTab: (tab: "review" | "trace") => void;
  traceEvents: AgentRunEvent[];
  critiques: CritiqueItem[];
  overallScore: number | null;
  overallComment: string | null;
  hasUserEdits: boolean;
  phase: EditorPhase;
  modifiedCount: number;
  pendingCount: number;
  isRerunning: boolean;
  showDiff: boolean;
  setShowDiff: (show: boolean) => void;
  revisedContent: string;
  acceptedIndices: Set<number>;
  modifiedByUser: Set<number>;
  activeCritiqueIndex: number | null;
  onRerunReview: (agentId?: number) => void;
  onAcceptAll: () => void;
  onAcceptSingle: (index: number) => void;
  onUndoSingle: (index: number) => void;
  onDismissCritique: (index: number) => void;
  onCritiqueClick: (index: number, targetQuote: string) => void;
}

/* ── Score Ring ── */
function ScoreRing({ score }: { score: number }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 10) * circumference;
  const color = score >= 8 ? "text-emerald-500" : score >= 6 ? "text-amber-500" : "text-rose-500";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" className="stroke-[var(--border)]" strokeWidth="2.5" />
        <circle cx="28" cy="28" r={radius} fill="none" className={color} stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <span className="absolute text-[14px] font-bold score-label text-foreground">{score.toFixed(1)}</span>
    </div>
  );
}

export function EditorSidebar({
  panelOpen,
  setPanelOpen,
  activeTab,
  setActiveTab,
  traceEvents,
  critiques,
  overallScore,
  overallComment,
  hasUserEdits,
  phase,
  modifiedCount,
  pendingCount,
  isRerunning,
  showDiff,
  setShowDiff,
  revisedContent,
  acceptedIndices,
  modifiedByUser,
  activeCritiqueIndex,
  onRerunReview,
  onAcceptAll,
  onAcceptSingle,
  onUndoSingle,
  onDismissCritique,
  onCritiqueClick
}: EditorSidebarProps) {
  const { t } = useTranslation();
  const { agents } = useAgents();
  
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

  const phaseState = getEditorPhaseState(phase, { hasUserEdits, isRerunning });
  const [isRerunModalOpen, setIsRerunModalOpen] = React.useState(false);
  const reviewers = React.useMemo(() => agents.filter(a => a.role === "reviewer"), [agents]);

  const tabButtonClass = (tab: "review" | "trace") =>
    cn(
      "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer",
      activeTab === tab
        ? "bg-[var(--card)] text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  if (!panelOpen) return null;

  if (activeTab === "trace") {
    return (
      <div className="w-[340px] shrink-0 border-l border-[var(--border)] bg-[var(--pill-bg)] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Execution Trace
            </span>
            <button
              onClick={() => setPanelOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 rounded-lg bg-[var(--nav-hover-bg)] p-1 flex gap-1">
            <button className={tabButtonClass("review")} onClick={() => setActiveTab("review")}>
              Review
            </button>
            <button className={tabButtonClass("trace")} onClick={() => setActiveTab("trace")}>
              Trace
            </button>
          </div>

          {traceEvents.length === 0 ? (
            <div className="rounded-lg bg-[var(--card)] ring-1 ring-[var(--card-border)] px-4 py-5 text-[13px] text-muted-foreground leading-[1.7]">
              No trace events yet. When a plugin-enhanced writer starts, sandbox logs will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {traceEvents.map((event, index) => {
                const payloadArtifact = typeof event.payload_json?.artifact === "string" ? event.payload_json.artifact : null;
                return (
                  <div
                    key={`${event.job_id}-${event.run_id}-${event.seq}-${index}`}
                    className="rounded-lg bg-[var(--card)] ring-1 ring-[var(--card-border)] px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {event.event_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {event.created_at ? new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                      </span>
                    </div>
                    <p className="text-[12px] text-foreground/85 leading-[1.65] break-words">{event.message}</p>
                    {payloadArtifact && (
                      <p className="mt-2 rounded-md bg-zinc-100 dark:bg-white/[0.04] px-2.5 py-2 text-[11px] font-mono text-muted-foreground break-all">
                        {payloadArtifact}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[340px] shrink-0 border-l border-[var(--border)] bg-[var(--pill-bg)] overflow-y-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t('editor.editorialReview')}
          </span>
          <button
            onClick={() => setPanelOpen(false)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-[var(--nav-hover-bg)] p-1 flex gap-1">
          <button className={tabButtonClass("review")} onClick={() => setActiveTab("review")}>
            Review
          </button>
          <button className={tabButtonClass("trace")} onClick={() => setActiveTab("trace")}>
            Trace
          </button>
        </div>

        {/* Score */}
        {overallScore !== null && (
          <div className="text-center mb-4 pb-4 border-b border-[var(--border)]">
            <ScoreRing score={overallScore} />
            {overallComment && (
              <p className="text-[12px] text-muted-foreground mt-3 leading-[1.6] max-w-[260px] mx-auto">
                {overallComment}
              </p>
            )}
          </div>
        )}

        {/* Re-run Review Banner */}
        {phaseState.canShowRerunBanner && (
          <div className="mb-4 rerun-banner">
            <div className="rounded-lg bg-[var(--card)] ring-1 ring-[var(--card-border)] px-3.5 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-[12px] font-semibold text-foreground/80">
                  {t('editor.contentModified')}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-[1.5] mb-2.5">
                {modifiedCount > 0
                  ? (modifiedCount === 1 ? t('editor.annotationsAffected_one') : t('editor.annotationsAffected_other').replace('{count}', String(modifiedCount)))
                  : t('editor.madeChanges')}
                {' '}{t('editor.rerunFeedback')}
              </p>
              <button
                onClick={() => setIsRerunModalOpen(true)}
                disabled={isRerunning}
                className="w-full text-center text-[11px] font-semibold px-3 py-2 rounded-md bg-zinc-700 dark:bg-zinc-600 text-white hover:bg-zinc-600 dark:hover:bg-zinc-500 transition-colors cursor-pointer disabled:opacity-40"
              >
                {isRerunning ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <div className="w-3 h-3 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
                    {t('editor.rerunningReview')}
                  </span>
                ) : (
                  t('editor.rerunReviewBtn')
                )}
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        {!phaseState.isCompleted && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
              {pendingCount > 0
                ? (pendingCount === 1 ? t('editor.issuesRemaining_one') : t('editor.issuesRemaining_other').replace('{count}', String(pendingCount)))
                : modifiedCount > 0
                  ? (modifiedCount === 1 ? t('editor.modifiedCount_one') : t('editor.modifiedCount_other').replace('{count}', String(modifiedCount)))
                  : t('editor.allResolved')}
            </span>
            <div className="flex items-center gap-1.5">
              {showDiff ? (
                <button
                  onClick={() => setShowDiff(false)}
                  className="text-[11px] font-medium px-2 py-1 rounded-md bg-[var(--nav-hover-bg)] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {t('editor.editorView')}
                </button>
              ) : revisedContent ? (
                <button
                  onClick={() => setShowDiff(true)}
                  className="text-[11px] font-medium px-2 py-1 rounded-md bg-[var(--nav-hover-bg)] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {t('editor.diffView')}
                </button>
              ) : null}
              {phaseState.canEditCritiques && (
                <button
                  onClick={onAcceptAll}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-zinc-700 dark:bg-zinc-600 text-white hover:bg-zinc-600 dark:hover:bg-zinc-500 transition-colors cursor-pointer"
                >
                  {t('editor.acceptAll')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Critique cards */}
        {critiques.length === 0 ? (
          <div className="rounded-lg bg-[var(--card)] ring-1 ring-[var(--card-border)] px-4 py-5 text-[13px] text-muted-foreground leading-[1.7]">
            Review comments will appear here after the reviewer finishes. You can switch to Trace to inspect plugin execution logs.
          </div>
        ) : (
          <div className="space-y-3">
            {critiques.map((item, index) => {
            const isAccepted = acceptedIndices.has(index);
            const isModified = modifiedByUser.has(index);
            return (
              <div
                key={index}
                className={cn(
                  "rounded-lg overflow-hidden transition-all duration-300 relative group/card",
                  isAccepted
                    ? "bg-emerald-500/[0.08] ring-1 ring-emerald-500/20"
                    : isModified
                      ? "bg-zinc-500/[0.06] ring-1 ring-zinc-500/15 annotation-card-modified"
                      : activeCritiqueIndex === index
                        ? "bg-[var(--card)] shadow-sm ring-1 ring-amber-500/30"
                        : "bg-[var(--card)] shadow-sm ring-1 ring-[var(--card-border)] hover:ring-[var(--card-hover-border)]"
                )}
              >
                {/* Dismiss button — top-right, visible on hover */}
                {!isAccepted && phaseState.canEditCritiques && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDismissCritique(index); }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 z-10 cursor-pointer"
                    title={t("editor.dismissCritique")}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {isAccepted ? (
                  /* ── Accepted state ── */
                  <div className="flex items-center justify-between px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">{t('editor.applied')}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onUndoSingle(index); }}
                      className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors px-2 py-0.5 rounded-md hover:bg-[var(--nav-hover-bg)] cursor-pointer"
                    >
                      {t('editor.undo')}
                    </button>
                  </div>
                ) : isModified ? (
                  /* ── Modified by user state ── */
                  <div className="p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-zinc-500/15 flex items-center justify-center">
                        <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      <span className="text-[12px] text-muted-foreground font-medium">{t("editor.modifiedByYou")}</span>
                    </div>
                    {/* Original quote — struck through */}
                    <div className="flex items-start gap-2 mb-1.5 pl-1">
                      <p className="text-[12px] text-muted-foreground/40 italic leading-[1.5] line-through line-clamp-2">
                        &ldquo;{item.target_quote}&rdquo;
                      </p>
                    </div>
                    <p className="text-[12px] text-muted-foreground/50 leading-[1.55] pl-1 line-clamp-2">
                      {item.critique}
                    </p>
                  </div>
                ) : (
                  /* ── Normal critique ── */
                  <div
                    className="p-3.5 cursor-pointer"
                    onClick={() => onCritiqueClick(index, item.target_quote)}
                  >
                    {/* Target quote */}
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-amber-500 mt-0.5 shrink-0 text-[12px]">⚠</span>
                      <p className="text-[12px] text-muted-foreground italic leading-[1.5] line-clamp-2">
                        &ldquo;{item.target_quote}&rdquo;
                      </p>
                    </div>
                    {/* Critique */}
                    <p className="text-[13px] text-foreground/80 leading-[1.55] mb-2.5 pl-5">
                      {item.critique}
                    </p>
                    {/* Suggestion */}
                    <div className="pl-5 mb-3">
                      <p className="text-[12px] text-emerald-700 dark:text-emerald-400 leading-[1.55] bg-emerald-50 dark:bg-emerald-950/30 rounded-md px-2.5 py-2">
                        → {item.suggestion}
                      </p>
                    </div>
                    {/* Accept button */}
                    {phaseState.canEditCritiques && (
                      <div className="pl-5 flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); onAcceptSingle(index); }}
                          className="text-[11px] font-medium text-foreground bg-[var(--nav-hover-bg)] hover:bg-[var(--nav-active-bg)] px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          {t('editor.accept')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Rerun Modal */}
      {isRerunModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => setIsRerunModalOpen(false)} />
          <div 
            className="relative z-10 w-full max-w-sm bg-white dark:bg-[#111214] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-6"
            style={{ animation: "modalIn 200ms cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <button 
              onClick={() => setIsRerunModalOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-muted-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="mb-5">
              <h3 className="text-[17px] font-bold text-foreground tracking-tight mb-2">选择审核智能体</h3>
              <p className="text-[13px] text-muted-foreground">请选择你要用来重新审核当前内容的智能体。</p>
            </div>

            <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto">
              {reviewers.map(reviewer => (
                <button
                  key={reviewer.id}
                  onClick={() => {
                    setIsRerunModalOpen(false);
                    onRerunReview(reviewer.id);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all text-left"
                >
                  <span className="text-[14px] font-medium text-foreground">{getLocalizedAgentName(reviewer)}</span>
                </button>
              ))}
            </div>
            
            <div className="flex justify-end">
              <button 
                className="px-4 py-2 text-[13px] font-medium rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-foreground transition-colors"
                onClick={() => setIsRerunModalOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
