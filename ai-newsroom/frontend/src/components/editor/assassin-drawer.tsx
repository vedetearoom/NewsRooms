"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { CritiqueItem } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";

interface AssassinDrawerProps {
  open: boolean;
  onClose: () => void;
  critiques: CritiqueItem[];
  overallScore: number | null;
  overallComment: string | null;
  onHighlightQuote: (quote: string) => void;
  activeQuote: string | null;
  onAcceptAll?: () => void;
  showDiff?: boolean;
  onToggleDiff?: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 10) * circumference;
  const color =
    score >= 8 ? "text-emerald-500" : score >= 6 ? "text-amber-500" : "text-rose-500";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" className="stroke-[var(--border)]" strokeWidth="3" />
        <circle
          cx="32" cy="32" r={radius} fill="none"
          className={color}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <span className="absolute text-[15px] font-bold score-label text-foreground">{score.toFixed(1)}</span>
    </div>
  );
}

export function AssassinDrawer({
  open,
  onClose,
  critiques,
  overallScore,
  overallComment,
  onHighlightQuote,
  activeQuote,
  onAcceptAll,
  showDiff,
  onToggleDiff,
}: AssassinDrawerProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "h-full bg-[var(--card)] rounded-2xl shadow-sm ring-1 ring-[var(--card-border)] overflow-y-auto custom-scrollbar transition-all duration-300",
        open ? "w-[360px] min-w-[360px] opacity-100 animate-slide-in-right ml-4" : "w-0 min-w-0 opacity-0 overflow-hidden ml-0"
      )}
    >
      {open && (
        <div className="p-6">
          {/* Header with integrated actions */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t('editor.editorialReview')}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-[var(--nav-hover-bg)] hover:text-foreground transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Score */}
          {overallScore !== null && (
            <div className="text-center mb-6 pb-6">
              <ScoreRing score={overallScore} />
              {overallComment && (
                <p className="text-[13px] text-muted-foreground mt-4 leading-relaxed max-w-[280px] mx-auto">
                  {overallComment}
                </p>
              )}
            </div>
          )}

          {/* Action Header */}
          {critiques.length > 0 && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
              <div className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                {critiques.length === 1 
                  ? t('editor.issuesRemaining_one') 
                  : t('editor.issuesRemaining_other').replace('{count}', String(critiques.length))}
              </div>
              <div className="flex items-center gap-2">
                {onToggleDiff && (
                  <button
                    onClick={onToggleDiff}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-[var(--pill-bg)] text-muted-foreground hover:text-foreground hover:bg-[var(--nav-hover-bg)] transition-colors cursor-pointer"
                  >
                    {showDiff ? "Editor" : "Diff"}
                  </button>
                )}
                {onAcceptAll && (
                  <button
                    onClick={onAcceptAll}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-foreground text-[var(--card)] hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {t('editor.acceptAll')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Critiques */}
          <div className="space-y-4">
            {critiques.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "bg-[var(--pill-bg)] rounded-xl p-4 cursor-pointer transition-all hover:bg-[var(--card)] hover:shadow-md hover:ring-1 hover:ring-[var(--card-border)]",
                  activeQuote === item.target_quote 
                    ? "bg-[var(--card)] shadow-md ring-1 ring-amber-500/30" 
                    : ""
                )}
                onClick={() => onHighlightQuote(item.target_quote)}
              >
                <div className="flex items-start gap-2.5 mb-3">
                  <span className="text-amber-500 mt-0.5 shrink-0 text-[13px]">⚠</span>
                  <p className="text-[13px] text-muted-foreground italic leading-relaxed line-clamp-2">
                    &ldquo;{item.target_quote}&rdquo;
                  </p>
                </div>
                <p className="text-[14px] text-foreground leading-relaxed mb-3 pl-6">
                  {item.critique}
                </p>
                <div className="pl-6">
                  <p className="text-[13px] text-emerald-700 dark:text-emerald-400 leading-relaxed bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-3.5 py-2.5">
                    → {item.suggestion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
