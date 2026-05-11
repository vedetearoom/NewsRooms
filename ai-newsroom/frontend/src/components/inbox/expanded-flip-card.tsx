"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { type IntelligenceCard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-rose-500 dark:text-rose-400";
  if (score >= 0.6) return "text-amber-500 dark:text-amber-400";
  return "text-emerald-500 dark:text-emerald-400";
}

interface ExpandedFlipCardProps {
  card: IntelligenceCard;
  originRect: DOMRect;
  onClose: () => void;
  onSelect: (id: number) => void;
  isSelected: boolean;
}

export function ExpandedFlipCard({ card, originRect, onClose, onSelect, isSelected }: ExpandedFlipCardProps) {
  const { t } = useTranslation();
  // Calculate the origin position relative to the viewport center
  const [windowSize, setWindowSize] = React.useState({ w: window.innerWidth, h: window.innerHeight });

  React.useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Target modal dimensions
  const modalW = Math.min(640, windowSize.w - 48);
  const modalH = Math.min(windowSize.h * 0.85, 720);

  // Origin center
  const originCenterX = originRect.left + originRect.width / 2;
  const originCenterY = originRect.top + originRect.height / 2;

  // Target center (screen center)
  const targetCenterX = windowSize.w / 2;
  const targetCenterY = windowSize.h / 2;

  // The offset from target center (where the card starts) to the screen center (where it ends)
  const offsetX = originCenterX - targetCenterX;
  const offsetY = originCenterY - targetCenterY;

  // Scale from card size to modal size
  const scaleX = originRect.width / modalW;
  const scaleY = originRect.height / modalH;
  const initialScale = Math.min(scaleX, scaleY);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed inset-0 z-[180] bg-black/60 backdrop-blur-[6px]"
        onClick={onClose}
      />

      {/* Card container */}
      <div
        className="fixed inset-0 z-[181] flex items-center justify-center pointer-events-none"
        style={{ perspective: "1200px" }}
      >
        <motion.div
          initial={{
            x: offsetX,
            y: offsetY,
            scale: initialScale,
            rotateY: -80,
            opacity: 0.5,
          }}
          animate={{
            x: 0,
            y: 0,
            scale: 1,
            rotateY: 0,
            opacity: 1,
          }}
          exit={{
            x: offsetX,
            y: offsetY,
            scale: initialScale,
            rotateY: 80,
            opacity: 0,
          }}
          transition={{
            type: "spring",
            stiffness: 180,
            damping: 24,
            mass: 0.9,
            opacity: { duration: 0.3, ease: "easeOut" },
          }}
          style={{
            width: modalW,
            maxHeight: modalH,
            transformStyle: "preserve-3d",
          }}
          className="flex flex-col bg-white dark:bg-[#111214] rounded-2xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto border border-zinc-200/80 dark:border-white/[0.08]"
        >
          {/* Header */}
          <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[13px] font-semibold tracking-tight text-foreground">{t('cardDetails.title')}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={cn("text-[13px] font-bold tabular-nums drop-shadow-sm", scoreColor(card.importance_score))}>
                  {Math.round(card.importance_score * 100)}
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-white/10 transition-all duration-200"
              >
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                {card.category ? (t(`categories.${card.category}`) === `categories.${card.category}` ? card.category : t(`categories.${card.category}`)) : t('cardDetails.uncategorized')}
              </span>
              <span className="text-[11px] text-muted-foreground/60 font-medium font-mono">
                {t('cardDetails.score')}: {card.importance_score.toFixed(2)}
              </span>
            </div>

            <h2 className="text-2xl font-bold leading-[1.3] text-foreground tracking-tight mb-4">
              {card.title}
            </h2>

            <div className="flex flex-wrap items-center gap-2 mb-8">
              {(card.tags || []).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50 text-[11px] font-medium tracking-wide shadow-sm">{tag}</span>
              ))}
              <span className="text-[11px] text-muted-foreground/50 ml-auto">
                {new Date(card.created_at).toLocaleString()}
              </span>
            </div>

            <div className="space-y-8">
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('cardDetails.executiveSummary')}</h4>
                <p className="text-[15px] leading-relaxed text-foreground/90">
                  {card.summary}
                </p>
              </div>

              {card.key_points && card.key_points.length > 0 && (
                <div className="bg-zinc-50/80 dark:bg-white/[0.02] p-5 rounded-xl border border-zinc-100 dark:border-white/5">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('cardDetails.keyPoints')}</h4>
                  <ul className="space-y-3">
                    {card.key_points.map((pt, i) => (
                      <li key={i} className="text-[14px] leading-relaxed text-foreground/90 flex items-start gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500 mt-1 shrink-0">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {card.source_urls && card.source_urls.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('cardDetails.sources')}</h4>
                  <div className="flex flex-col gap-2">
                    {card.source_urls.map((url, i) => (
                      <a 
                        key={i} 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2.5 group p-2.5 rounded-lg bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:border-zinc-200 dark:hover:border-white/10 transition-all max-w-[85%]"
                      >
                        <div className="w-6 h-6 rounded bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 group-hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        <span className="text-[13px] text-zinc-600 dark:text-zinc-400 group-hover:text-foreground transition-colors truncate w-full">
                          {url.replace(/^https?:\/\//, '')}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {card.raw_article_ids && card.raw_article_ids.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('cardDetails.dataLineage')}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-muted-foreground">
                      {card.raw_article_ids.length === 1 ? t('cardDetails.generatedFrom_one') : t('cardDetails.generatedFrom_other').replace('{count}', String(card.raw_article_ids.length))}
                    </span>
                    <a href="/sources/pipeline" className="text-[12px] font-medium text-foreground hover:underline flex items-center gap-1 bg-zinc-100 dark:bg-white/5 px-2 py-1 rounded">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      {t('cardDetails.viewInPipeline')}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="shrink-0 p-5 px-6 border-t border-zinc-100 dark:border-white/5 bg-white dark:bg-[#111214]">
            <Button
              className="w-full font-medium h-11"
              variant={isSelected ? "outline" : "default"}
              onClick={() => onSelect(card.id)}
            >
              {isSelected ? t('cardDetails.removeFromQueue') : t('cardDetails.addToQueue')}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
