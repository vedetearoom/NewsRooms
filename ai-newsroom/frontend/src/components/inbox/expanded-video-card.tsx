"use client";
import * as React from "react";
import { motion } from "framer-motion";
import type { IntelligenceCard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-rose-500 dark:text-rose-400";
  if (score >= 0.6) return "text-amber-500 dark:text-amber-400";
  return "text-emerald-500 dark:text-emerald-400";
}

function platformLabel(platform: string): string {
  switch (platform) {
    case "bilibili": return "Bilibili";
    case "youtube": return "YouTube";
    case "xiaohongshu": return "小红书";
    default: return "Video";
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface HookAnalysis {
  hook_text: string;
  technique: string;
  analysis: string;
}

interface ExpandedVideoCardProps {
  card: IntelligenceCard;
  originRect: DOMRect;
  onClose: () => void;
  onSelect: (id: number) => void;
  isSelected: boolean;
}

export function ExpandedVideoCard({ card, originRect, onClose, onSelect, isSelected }: ExpandedVideoCardProps) {
  const { t } = useTranslation();
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [showFullTemplate, setShowFullTemplate] = React.useState(false);
  const [windowSize, setWindowSize] = React.useState({ w: window.innerWidth, h: window.innerHeight });

  React.useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Extract metadata
  const meta = (card.extra_data || {}) as Record<string, unknown>;
  const platform = (meta.platform as string) || "";
  const author = (meta.author as string) || "";
  const videoUrl = (meta.video_url as string) || "";
  const duration = (meta.duration_seconds as number) || 0;
  const transcript = (meta.transcript as Array<{ time: string; text: string }>) || [];
  const hookAnalysis = (meta.hook_analysis as HookAnalysis) || {} as HookAnalysis;
  const templateSkeleton = (meta.template_skeleton as string) || "";
  const isMetadataOnly = meta.metadata_only === true || meta.analysis_mode === "metadata_only";

  // Modal positioning
  const modalW = Math.min(680, windowSize.w - 48);
  const modalH = Math.min(windowSize.h * 0.88, 780);
  const originCenterX = originRect.left + originRect.width / 2;
  const originCenterY = originRect.top + originRect.height / 2;
  const targetCenterX = windowSize.w / 2;
  const targetCenterY = windowSize.h / 2;
  const offsetX = originCenterX - targetCenterX;
  const offsetY = originCenterY - targetCenterY;
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
      <div className="fixed inset-0 z-[181] flex items-center justify-center pointer-events-none" style={{ perspective: "1200px" }}>
        <motion.div
          initial={{ x: offsetX, y: offsetY, scale: initialScale, rotateY: -80, opacity: 0.5 }}
          animate={{ x: 0, y: 0, scale: 1, rotateY: 0, opacity: 1 }}
          exit={{ x: offsetX, y: offsetY, scale: initialScale, rotateY: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 24, mass: 0.9, opacity: { duration: 0.3, ease: "easeOut" } }}
          style={{ width: modalW, maxHeight: modalH, transformStyle: "preserve-3d" }}
          className="flex flex-col bg-white dark:bg-[#111214] rounded-2xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto border border-zinc-200/80 dark:border-white/[0.08]"
        >
          {/* Header */}
          <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[13px] font-semibold tracking-tight text-foreground">视频解构报告</span>
              {isMetadataOnly && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-white/10 dark:text-zinc-300">
                  元信息分析
                </span>
              )}
              {duration > 0 && (
                <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums ml-1">
                  {formatDuration(duration)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className={cn("text-[13px] font-bold tabular-nums drop-shadow-sm", scoreColor(card.importance_score))}>
                {Math.round(card.importance_score * 100)}
              </span>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-white/10 transition-all duration-200">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-8">
            {/* Header Box Format */}
            <div className="mb-6 border-b border-zinc-100 dark:border-white/5 pb-8 relative">
              <div className="flex items-center gap-3 mb-5">
                <span className="px-3 py-1 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[11px] font-bold uppercase tracking-wider">
                  {platformLabel(platform)}
                </span>
                <span className="text-[12px] text-zinc-400 font-medium">
                  重要度：{card.importance_score.toFixed(2)}
                </span>
              </div>

              <h2 className="text-[22px] font-bold leading-[1.4] text-foreground tracking-tight mb-5">
                {card.title}
              </h2>

              <div className="flex justify-between items-center mt-6">
                <div className="flex flex-wrap gap-2">
                  {(card.tags || []).slice(0, 3).map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 rounded-md text-[12px] font-medium border border-zinc-100 dark:border-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[12px] text-zinc-400 font-medium shrink-0">
                  {author && <span>@{author}</span>}
                  <span className="tabular-nums">
                    {new Date(card.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {isMetadataOnly && (
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-4 text-[13px] leading-relaxed text-amber-800 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-100/80">
                  未下载视频，未生成音频或逐字稿；以下内容基于标题、简介和公开互动数据生成。
                </div>
              )}

              {/* Summary */}
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">📋 内容摘要</h4>
                <p className="text-[15px] leading-relaxed text-foreground/90">{card.summary}</p>
              </div>

              {/* Key Points (Promoted) */}
              {card.key_points && card.key_points.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">💡 关键要点</h4>
                  <ul className="space-y-2">
                    {card.key_points.map((pt, i) => (
                      <li key={i} className="text-[14px] leading-relaxed text-foreground/90 flex items-start gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500 mt-1.5 shrink-0 text-xs">●</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hook Analysis (Professional Cold Indigo) */}
              {hookAnalysis.hook_text && (
                <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-6 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
                  <h4 className="text-[12px] font-black uppercase tracking-wider text-gray-900 dark:text-gray-100 mb-4">黄金三秒钩子</h4>
                  <blockquote className="text-[16px] font-serif text-gray-800 dark:text-gray-300 leading-relaxed mb-4 pl-4 border-l-[3px] border-indigo-600 dark:border-indigo-500 italic">
                    &ldquo;{hookAnalysis.hook_text}&rdquo;
                  </blockquote>
                  {hookAnalysis.technique && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">手法</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[11px] font-medium border border-gray-200/50 dark:border-white/5">
                        {hookAnalysis.technique}
                      </span>
                    </div>
                  )}
                  {hookAnalysis.analysis && (
                    <p className="text-[13px] leading-relaxed text-foreground/70 mt-3">{hookAnalysis.analysis}</p>
                  )}
                </div>
              )}

              {/* Template Skeleton (Demoted & Code-Snippet styled) */}
              {templateSkeleton && (
                <div className="bg-zinc-50/80 dark:bg-[#0A0A0A] p-5 rounded-xl border border-zinc-200/80 dark:border-white/5 relative group/code">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      结构化图文写作摘要
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(templateSkeleton)}
                        className="text-[11px] px-2.5 py-1.5 rounded-md bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors font-medium flex items-center gap-1.5 opacity-0 group-hover/code:opacity-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        复制 Snippet
                      </button>
                    </div>
                  </div>
                  <div className={cn("relative transition-all duration-300", !showFullTemplate && templateSkeleton.split('\n').length > 15 ? "max-h-[340px] overflow-hidden" : "")}>
                    <pre className="text-[13px] leading-[1.7] text-zinc-700 dark:text-zinc-400 whitespace-pre-wrap font-mono relative z-0">
                      {templateSkeleton}
                    </pre>
                    {!showFullTemplate && templateSkeleton.split('\n').length > 15 && (
                      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-50 dark:from-[#0A0A0A] via-zinc-50/80 dark:via-[#0A0A0A]/80 to-transparent flex items-end justify-center pb-2 z-10">
                        <button
                          onClick={() => setShowFullTemplate(true)}
                          className="px-4 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 shadow-sm hover:text-zinc-900 dark:hover:text-white hover:shadow transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          展开全部代码
                        </button>
                      </div>
                    )}
                  </div>
                  {showFullTemplate && templateSkeleton.split('\n').length > 15 && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={() => setShowFullTemplate(false)}
                        className="px-4 py-1.5 rounded-full bg-transparent text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        收起
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript (collapsible) */}
              {transcript.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-3"
                  >
                    <svg className={cn("w-3 h-3 transition-transform", showTranscript && "rotate-90")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    📄 逐字稿 ({transcript.length} 段)
                  </button>
                  {showTranscript && (
                    <div className="bg-zinc-50/80 dark:bg-white/[0.02] p-4 rounded-xl border border-zinc-100 dark:border-white/5 max-h-[300px] overflow-y-auto space-y-2">
                      {transcript.map((seg, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-[11px] font-mono text-muted-foreground/50 w-10 shrink-0 tabular-nums pt-0.5">{seg.time}</span>
                          <span className="text-[13px] text-foreground/80 leading-relaxed">{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Source Link (数据来源) */}
              {videoUrl && (
                <div>
                  <h4 className="text-[13px] font-bold text-zinc-500 dark:text-zinc-400 mb-3 block">数据来源</h4>
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 bg-zinc-50/30 dark:bg-zinc-900/10 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 rounded-xl border border-zinc-100/50 dark:border-white/[0.02] transition-all group/link"
                  >
                    <div className="w-[26px] h-[26px] rounded-[6px] bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/50 dark:border-white/5 flex items-center justify-center shrink-0 group-hover/link:border-zinc-300 dark:group-hover/link:border-white/10 transition-colors">
                      <svg className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 group-hover/link:text-zinc-600 dark:group-hover/link:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    <span className="text-[13px] text-zinc-500 group-hover/link:text-zinc-700 dark:text-zinc-400 dark:group-hover/link:text-zinc-200 font-normal truncate max-w-[85%] transition-colors">
                      {videoUrl.replace(/^https?:\/\//, '')}
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="shrink-0 p-5 px-6 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#111214]">
            {isSelected ? (
              <div className="flex flex-col items-center">
                <button
                  className="w-full text-center py-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-xl font-medium transition-colors cursor-pointer"
                  onClick={() => onSelect(card.id)}
                >
                  {t('cardDetails.removeFromQueue')}
                </button>
              </div>
            ) : (
              <Button
                className="w-full font-medium h-11 rounded-xl"
                variant="default"
                onClick={() => onSelect(card.id)}
              >
                {t('cardDetails.addToQueue')}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
