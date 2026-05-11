"use client";

import * as React from "react";
import { diffWords } from "diff";
import { useTranslation } from "@/hooks/useTranslation";

interface DiffViewProps {
  original: string;
  revised: string;
}

// Strip HTML tags to get clean text for diffing
function stripHtml(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/g, (_, _level, text) => {
      return `\n${text.replace(/<[^>]+>/g, '')}\n`;
    })
    .replace(/<\/p>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<li>(.*?)<\/li>/g, '• $1\n')
    .replace(/<hr\s*\/?>/g, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/&ldquo;/g, '\u201c')
    .replace(/&rdquo;/g, '\u201d')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^---$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function DiffView({ original, revised }: DiffViewProps) {
  const diff = React.useMemo(() => {
    const cleanOriginal = stripHtml(original);
    const cleanRevised = stripHtml(revised);
    return diffWords(cleanOriginal, cleanRevised);
  }, [original, revised]);

  return (
    <div className="tiptap-editor">
      <div className="ProseMirror" style={{ minHeight: "auto", whiteSpace: "pre-wrap", lineHeight: "1.8" }}>
        {diff.map((part, i) => {
          if (part.added) {
            return (
              <span key={i} className="bg-emerald-500/15 text-emerald-300 dark:text-emerald-400 rounded px-0.5">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={i} className="bg-rose-500/15 text-rose-400 line-through opacity-60 rounded px-0.5">
                {part.value}
              </span>
            );
          }
          return <span key={i} className="text-foreground/70">{part.value}</span>;
        })}
      </div>
    </div>
  );
}

interface InlineDiffBlockProps {
  original: string;
  revised: string;
  onAccept: () => void;
  onReject: () => void;
}

export function InlineDiffBlock({ original, revised, onAccept, onReject }: InlineDiffBlockProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl p-5 my-4 bg-[var(--pill-bg)] transition-colors hover:bg-[var(--card)] hover:shadow-md hover:ring-1 hover:ring-[var(--card-border)]">
      <div className="text-[11px] font-semibold text-muted-foreground/70 mb-3 uppercase tracking-widest">
        {t('editor.suggestedEdit')}
      </div>
      <div className="text-[14px] leading-relaxed mb-4">
        <DiffView original={original} revised={revised} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
        >
          {t('editor.accept')}
        </button>
        <button
          onClick={onReject}
          className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
        >
          {t('editor.reject')}
        </button>
      </div>
    </div>
  );
}
