"use client";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { api, type IntelligenceCard } from "@/lib/api";
import { Bookmark, Loader2, Star } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "@/components/ui/use-toast";

interface VideoCardProps {
  card: IntelligenceCard;
  isSelected: boolean;
  onToggle: (id: number) => void;
  onClick: (card: IntelligenceCard, rect: DOMRect) => void;
  isFeatured?: boolean;
  canPin?: boolean;
  canSaveInspiration?: boolean;
  onTogglePin?: (cardId: number) => void;
  selectable?: boolean;
}

/* Score color */
function scoreColor(score: number): string {
  if (score >= 0.8) return "text-rose-400";
  if (score >= 0.6) return "text-amber-400";
  return "text-emerald-400";
}

/* Platform icon & label */
function platformInfo(platform: string): { icon: string; label: string } {
  switch (platform) {
    case "bilibili":
      return { icon: "📺", label: "B站" };
    case "youtube":
      return { icon: "▶️", label: "YouTube" };
    case "xiaohongshu":
      return { icon: "📕", label: "小红书" };
    default:
      return { icon: "🎬", label: "Video" };
  }
}

/* Format seconds to MM:SS */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoCard({ card, isSelected, onToggle, onClick, isFeatured = false, canPin, canSaveInspiration, onTogglePin, selectable = true }: VideoCardProps) {
  const { language } = useTranslation();
  const meta = (card.extra_data || {}) as Record<string, unknown>;
  const platform = (meta.platform as string) || "";
  const author = (meta.author as string) || "";
  const duration = (meta.duration_seconds as number) || 0;
  const hookAnalysis = (meta.hook_analysis as Record<string, string>) || {};
  const hookText = hookAnalysis.hook_text || card.summary;
  const hookTechnique = hookAnalysis.technique || "";
  const templateSkeleton = (meta.template_skeleton as string) || "";
  const videoUrl = (meta.video_url as string) || "";
  const thumbnailUrl = (meta.thumbnail_url as string) || card.cover_image || "";
  const isMetadataOnly = meta.metadata_only === true || meta.analysis_mode === "metadata_only";
  const pInfo = platformInfo(platform);

  const [isSavedInspiration, setIsSavedInspiration] = React.useState(false);
  const [isSavingInspiration, setIsSavingInspiration] = React.useState(false);

  React.useEffect(() => {
    try {
      const savedUrls = JSON.parse(localStorage.getItem("newsroom:saved_inspirations") || "[]");
      if (videoUrl && savedUrls.includes(videoUrl)) {
        setIsSavedInspiration(true);
      }
    } catch (e) { console.error("Failed to parse saved inspirations", e); }
  }, [videoUrl]);

  const handleSaveInspiration = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isSavingInspiration || !templateSkeleton) return;

    // Local toggle off without deleting backend asset
    if (isSavedInspiration) {
      setIsSavedInspiration(false);
      try {
        const savedUrls = JSON.parse(localStorage.getItem("newsroom:saved_inspirations") || "[]");
        const updatedUrls = savedUrls.filter((u: string) => u !== videoUrl);
        localStorage.setItem("newsroom:saved_inspirations", JSON.stringify(updatedUrls));
      } catch (e) { console.error("Failed to unsave inspiration", e); }
      return;
    }

    setIsSavingInspiration(true);
    try {
      await api.saveInspiration({
        title: card.title || "Untitled Video",
        hook_text: hookText,
        hook_technique: hookTechnique,
        template_skeleton: templateSkeleton,
        source_url: videoUrl,
        platform: platform,
        author: author,
        tags: card.tags || [],
        audio_url: card.audio_url,
        extra_data: {
          ...card.extra_data,
          original_summary: card.summary,
          original_key_points: card.key_points
        }
      });
      setIsSavedInspiration(true);
      try {
        const savedUrls = JSON.parse(localStorage.getItem("newsroom:saved_inspirations") || "[]");
        if (videoUrl && !savedUrls.includes(videoUrl)) {
          savedUrls.push(videoUrl);
          localStorage.setItem("newsroom:saved_inspirations", JSON.stringify(savedUrls));
        }
      } catch (e) { console.error("Failed to update saved inspirations", e); }
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存灵感失败";
      toast.error("保存灵感失败", message);
      console.error("Failed to save inspiration", err);
    } finally {
      setIsSavingInspiration(false);
    }
  };

  // Determine grid spans
  let spanClass = "col-span-1 row-span-1";
  if (isFeatured || card.importance_score >= 0.95) {
    spanClass = "col-span-2 row-span-2";
  } else if (card.importance_score >= 0.8) {
    spanClass = "col-span-2 row-span-1";
  } else if (card.importance_score >= 0.7) {
    spanClass = "col-span-1 row-span-2";
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onClick(card, rect);
  };

  return (
    <div
      className={cn(
        "card-surface group relative overflow-hidden cursor-pointer",
        spanClass,
        isSelected && "ring-2 ring-white/30"
      )}
      onClick={handleClick}
    >
      {/* ── Background Thumbnail ── */}
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/80 via-indigo-900/70 to-slate-900/90" />
      )}
      {/* ── Darken Overlay on Hover ── */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-[5]" />

      {/* ── Gradient Overlay (Max 50% height) ── */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none z-[5]" />

      {/* ── Top Meta ── */}
      <div className="absolute top-2.5 left-2.5 right-3 flex justify-between items-start z-10">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex h-5.5 w-5.5 items-center justify-center rounded-full bg-black/30 text-white/75 backdrop-blur-[2px] border border-white/10 shadow-sm transition-all duration-200",
              isSelected ? "opacity-0 scale-90" : "opacity-100 group-hover:opacity-0 group-hover:scale-90",
            )}
          >
            <svg className="h-2.5 w-2.5 ml-[1px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div
            className={cn(
              "pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/90 shadow-sm flex items-center gap-1.5 transition-all duration-200",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <span>{pInfo.label}</span>
            {isMetadataOnly && (
              <>
                <span className="text-white/40">·</span>
                <span>{language === "zh" ? "元信息分析" : "Metadata"}</span>
              </>
            )}
            {duration > 0 && (
              <>
                <span className="text-white/40">·</span>
                <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {selectable ? (
          <div
            className="relative p-3 -mt-3 -mr-3 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(card.id);
            }}
          >
            <span className={cn(
              "text-[12px] font-bold tabular-nums drop-shadow-md transition-opacity duration-150",
              isSelected ? "opacity-0" : "group-hover:opacity-0",
              scoreColor(card.importance_score)
            )}>
              {Math.round(card.importance_score * 100)}
            </span>
            <div className={cn(
              "absolute inset-0 flex items-center justify-end p-3 transition-opacity duration-150",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <Checkbox
                checked={isSelected}
                className="border-white/50 w-4 h-4 data-[state=checked]:bg-white data-[state=checked]:text-black pointer-events-none"
              />
            </div>
          </div>
          ) : (
            <span className={cn(
              "text-[12px] font-bold tabular-nums drop-shadow-md p-3 -mt-3 -mr-3 opacity-100",
              scoreColor(card.importance_score)
            )}>
              {Math.round(card.importance_score * 100)}
            </span>
          )}
        </div>
      </div>

      {/* ── Bottom Content ── */}
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 z-10 flex flex-col justify-end">
        {/* Author */}
        {author && (
          <span className="text-[11px] text-white/60 font-medium mb-1 truncate drop-shadow-sm">
            @{author}
          </span>
        )}

        {/* Title */}
        <h3 className={cn(
          "font-bold text-white leading-[1.3] tracking-tight drop-shadow-md mb-2",
          spanClass.includes("row-span-2") && spanClass.includes("col-span-2") ? "text-[18px] line-clamp-2" :
            spanClass.includes("col-span-2") ? "text-[15px] line-clamp-2" :
              "text-[14px] line-clamp-3"
        )}>
          {card.title}
        </h3>

        {/* Abstract (only on Big Hero) */}
        {spanClass.includes("row-span-2") && spanClass.includes("col-span-2") && card.summary && (
          <p className="text-white/70 text-[12px] leading-relaxed line-clamp-2 mb-3 max-w-[95%] drop-shadow-sm font-medium">
            {card.summary}
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between mt-auto gap-2">
          {/* Tags (Hidden only on the smallest square cards) */}
          {spanClass.includes("col-span-2") || spanClass.includes("row-span-2") || !spanClass ? (
            <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-2">
              {(card.tags || []).slice(0, spanClass.includes("col-span-2") ? 3 : 2).map((tag) => (
                <span key={tag} className="text-[10px] font-medium text-white/60 bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10">
                  #{tag}
                </span>
              ))}
            </div>
          ) : <div className="flex-1" />}

          <div className="flex items-center gap-2">
            {canPin && onTogglePin ? (
              <div
                className={cn(
                  "p-1 rounded-full cursor-pointer transition-all duration-200 pointer-events-auto shrink-0",
                  card.is_pinned
                    ? "text-amber-400 hover:text-amber-300 opacity-100"
                    : "text-white/40 hover:text-white/80 opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(card.id);
                }}
                title={card.is_pinned ? "取消精选" : "设为精选"}
              >
                <Star className={cn("w-3.5 h-3.5", card.is_pinned ? "fill-amber-400" : "fill-none")} />
              </div>
            ) : null}
            {canSaveInspiration ? (
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200 pointer-events-auto shrink-0",
                  isSavedInspiration
                    ? "w-6 p-1 opacity-100"
                    : "w-0 p-0 opacity-0 group-hover:w-6 group-hover:p-1 group-hover:opacity-100",
                  "text-white/40 hover:text-white/80 rounded-full cursor-pointer"
                )}
                onClick={handleSaveInspiration}
                title={isSavedInspiration ? "已收藏至灵感武器库" : "收藏结构至灵感武器库"}
              >
                {isSavingInspiration ? (
                  <Loader2 className="w-3.5 h-3.5 text-white/70 animate-spin drop-shadow-md" />
                ) : (
                  <Bookmark
                    className={cn(
                      "w-3.5 h-3.5 drop-shadow-md transition-colors",
                      isSavedInspiration ? "text-white/90 fill-white/90" : "text-white/40 hover:text-white/90"
                    )}
                  />
                )}
              </div>
            ) : null}
            <span className="text-[10.5px] font-medium text-white/40 tracking-wide mt-0.5 shrink-0 tabular-nums">
              {new Date(card.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
