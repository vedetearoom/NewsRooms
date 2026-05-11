import * as React from "react";
import { cn } from "@/lib/utils";
import type { IntelligenceCard } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";

interface SourceCardsPanelProps {
  sourceCards: IntelligenceCard[];
  sourceCardsExpanded: boolean;
  setSourceCardsExpanded: (expanded: boolean) => void;
}

export function SourceCardsPanel({ sourceCards, sourceCardsExpanded, setSourceCardsExpanded }: SourceCardsPanelProps) {
  const { t } = useTranslation();

  if (!sourceCards || sourceCards.length === 0) return null;

  const uniqueCards = sourceCards.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
  const COLLAPSED_MAX = 1;
  const visibleCards = sourceCardsExpanded ? uniqueCards : uniqueCards.slice(0, COLLAPSED_MAX);
  const hasMore = uniqueCards.length > COLLAPSED_MAX;

  return (
    <div className="mb-8">
      {/* Header row with count and toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t('editor.sourceCards')} · {t('editor.sourceCardsCount').replace('{count}', String(uniqueCards.length))}
        </span>
        {hasMore && (
          <button
            onClick={() => setSourceCardsExpanded(!sourceCardsExpanded)}
            className="text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1"
          >
            {sourceCardsExpanded ? t('editor.collapseCards') : t('editor.expandCards')}
            <svg className={cn("w-3 h-3 transition-transform", sourceCardsExpanded && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      <div className="space-y-2">
        {visibleCards.map((card) => {
          const firstUrl = card.source_urls?.[0] ?? null;
          const hostname = firstUrl ? (() => { try { return new URL(firstUrl).hostname.replace(/^www\./, ""); } catch { return firstUrl; } })() : null;
          const faviconUrl = hostname ? `https://api.iowen.cn/favicon/${hostname}.png` : null;
          return (
            <a
              key={card.id}
              href={firstUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-md border border-[var(--card-border)] bg-[var(--card)] overflow-hidden hover:shadow-sm transition-all no-underline"
            >
              {/* Top Layer: Bleed Image + Text */}
              <div className="flex h-[48px] sm:h-[52px]">
                {/* Left Image: Full Bleed */}
                <div className="w-[68px] sm:w-[76px] shrink-0 bg-zinc-100 dark:bg-[#1a1c20] border-r border-[var(--card-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.cover_image || "/default-card-thumb.png"}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/default-card-thumb.png"; }}
                  />
                </div>
                {/* Right Text Container */}
                <div className="flex flex-col justify-center px-3 py-1 grow overflow-hidden bg-[var(--card)]">
                  <h3 className="text-[13px] text-foreground font-medium truncate leading-tight">
                    {card.title}
                  </h3>
                  {card.summary && (
                    <p className="text-[11.5px] text-muted-foreground/80 truncate mt-0.5">
                      {card.summary}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Layer: URL Footer */}
              {hostname && (
                <div className="flex items-center px-3 py-1 bg-[var(--pill-bg)] border-t border-[var(--card-border)] text-[11px] text-muted-foreground/70">
                  {faviconUrl && (
                    <div className="w-3.5 h-3.5 bg-zinc-800 dark:bg-[#1a1c20] rounded-[3px] flex items-center justify-center mr-1.5 shrink-0 overflow-hidden shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={faviconUrl} alt="" className="w-2.5 h-2.5" />
                    </div>
                  )}
                  <span className="truncate">{firstUrl ?? hostname}</span>
                </div>
              )}
            </a>
          );
        })}
      </div>
      {/* Show collapsed count hint */}
      {!sourceCardsExpanded && hasMore && (
        <button
          onClick={() => setSourceCardsExpanded(true)}
          className="mt-2 w-full py-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors text-center"
        >
          +{uniqueCards.length - COLLAPSED_MAX} {t('editor.expandCards').toLowerCase()}
        </button>
      )}
      {/* Dashed divider */}
      <div className="mt-7 border-t border-dashed border-[var(--border)]" />
    </div>
  );
}
