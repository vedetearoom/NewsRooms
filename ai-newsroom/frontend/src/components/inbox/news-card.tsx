"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { api, type IntelligenceCard } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { Bookmark, Loader2, Star } from "lucide-react";
import * as React from "react";
import { toast } from "@/components/ui/use-toast";

interface NewsCardProps {
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

/* Deterministic image based on id */
function getImageUrl(card: IntelligenceCard): string {
  if (card.cover_image) return card.cover_image;
  // Use a predictable seed for the image based on card ID
  return `https://picsum.photos/seed/news_${card.id}/800/600`;
}

export function NewsCard({ card, isSelected, onToggle, onClick, isFeatured = false, canPin, canSaveInspiration, onTogglePin, selectable = true }: NewsCardProps) {
  const { t, language } = useTranslation();
  const meta = (card.extra_data || {}) as Record<string, unknown>;
  const author = (meta.author as string) || "";
  const templateSkeleton = (meta.template_skeleton as string) || card.summary || "";
  // Determine spans based on importance score
  let spanClass = "col-span-1 row-span-1";
  if (isFeatured || card.importance_score >= 0.95) {
    spanClass = "col-span-2 row-span-2";
  } else if (card.importance_score >= 0.8) {
    spanClass = "col-span-2 row-span-1";
  } else if (card.importance_score >= 0.7) {
    spanClass = "col-span-1 row-span-2";
  }

  const imageUrl = getImageUrl(card);

  const [isSavedInspiration, setIsSavedInspiration] = React.useState(false);
  const [isSavingInspiration, setIsSavingInspiration] = React.useState(false);
  const textSourceUrl = (card.source_urls && card.source_urls.length > 0) ? card.source_urls[0] : "";

  React.useEffect(() => {
    try {
      const savedUrls = JSON.parse(localStorage.getItem("newsroom:saved_inspirations") || "[]");
      if (textSourceUrl && savedUrls.includes(textSourceUrl)) {
        setIsSavedInspiration(true);
      }
    } catch (e) { console.error("Failed to parse saved inspirations", e); }
  }, [textSourceUrl]);

  const handleSaveInspiration = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isSavingInspiration) return;

    // Local toggle off without deleting backend asset
    if (isSavedInspiration) {
      setIsSavedInspiration(false);
      try {
        const savedUrls = JSON.parse(localStorage.getItem("newsroom:saved_inspirations") || "[]");
        const updatedUrls = savedUrls.filter((u: string) => u !== textSourceUrl);
        localStorage.setItem("newsroom:saved_inspirations", JSON.stringify(updatedUrls));
      } catch (e) { console.error("Failed to unsave inspiration", e); }
      return;
    }

    setIsSavingInspiration(true);
    try {
      await api.saveInspiration({
        title: card.title || "Untitled Article",
        hook_text: card.summary || "",
        hook_technique: "",
        template_skeleton: templateSkeleton,
        source_url: textSourceUrl,
        platform: "article",
        author,
        tags: card.tags || [],
        audio_url: "",
        extra_data: {
          ...card.extra_data,
          media_type: "text",
          original_summary: card.summary,
          original_key_points: card.key_points,
          source_urls: card.source_urls || []
        }
      });
      setIsSavedInspiration(true);
      try {
        const savedUrls = JSON.parse(localStorage.getItem("newsroom:saved_inspirations") || "[]");
        if (textSourceUrl && !savedUrls.includes(textSourceUrl)) {
          savedUrls.push(textSourceUrl);
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
      {/* ── Background Image ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        loading="lazy"
      />

      {/* ── Gradient Overlay ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10 transition-opacity duration-300 group-hover:opacity-90" />

      {/* ── Top Meta ── */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-medium tracking-wide text-white/90 shadow-sm flex items-center gap-1.5">
            {t(`categories.${card.category || "Other"}`) === `categories.${card.category || "Other"}` ? (card.category || "Other") : t(`categories.${card.category || "Other"}`)}
          </span>
        </div>
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

      {/* ── Bottom Content ── */}
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 z-10 flex flex-col justify-end">
        <h3 className={cn(
          "font-bold text-white leading-[1.25] tracking-tight drop-shadow-sm mb-1.5",
          spanClass.includes("row-span-2") && spanClass.includes("col-span-2") ? "text-xl md:text-2xl line-clamp-3" :
            spanClass.includes("col-span-2") ? "text-lg line-clamp-2" :
              "text-[15px] line-clamp-3"
        )}>
          {card.title}
        </h3>

        {spanClass.includes("col-span-2") && (
          <p className="text-white/70 text-[12px] leading-relaxed line-clamp-2 mb-2 max-w-[90%]">
            {card.summary}
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-1.5 mt-1">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-2">
            {(card.tags || []).slice(0, spanClass.includes("col-span-2") ? 3 : 2).map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-white/40">
                #{tag}
              </span>
            ))}
          </div>
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
                title={isSavedInspiration ? "已收藏至灵感武器库" : "收藏至灵感武器库"}
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
            <span className="text-[10px] text-white/40 tracking-wide mt-0.5 shrink-0 tabular-nums">
              {new Date(card.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
