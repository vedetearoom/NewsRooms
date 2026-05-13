import type { DiscoveredVideo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bookmark, Check, Eye, Inbox, Loader2, Pin, Play, RotateCw, ThumbsUp, Upload } from "lucide-react";

export function formatMonitorVideoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatMonitorVideoCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatMonitorVideoFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface MonitorVideoCardProps {
  video: DiscoveredVideo;
  language: string;
  isSelected: boolean;
  isAnalyzed: boolean;
  status?: "queued" | "submitting" | "done" | "error";
  variant?: "default" | "compact";
  deconstructLabel: string;
  submittingLabel: string;
  queuedLabel: string;
  submitFailedLabel: string;
  alreadyAnalyzedLabel: string;
  reanalyzeLabel?: string;
  reanalyzingLabel?: string;
  lastAnalyzedAtLabel?: string;
  reanalyzeHintLabel?: string;
  onClick?: () => void;
  onAnalyze?: () => void;
  onReanalyze?: () => void;
  className?: string;
  contentClassName?: string;
}

function formatLastAnalyzedAt(dateStr: string, language: string): string {
  const locale = language === "zh" ? "zh-CN" : "en-US";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  return date.toLocaleString(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MonitorVideoCard({
  video,
  language,
  isSelected,
  isAnalyzed,
  status,
  variant = "default",
  deconstructLabel,
  submittingLabel,
  queuedLabel,
  submitFailedLabel,
  alreadyAnalyzedLabel,
  reanalyzeLabel,
  reanalyzingLabel,
  lastAnalyzedAtLabel,
  reanalyzeHintLabel,
  onClick,
  onAnalyze,
  onReanalyze,
  className,
  contentClassName,
}: MonitorVideoCardProps) {
  const locale = language === "zh" ? "zh-CN" : "en-US";
  const isCompact = variant === "compact";
  const isXiaohongshu = video.url.includes("xiaohongshu.com") || video.url.includes("xhslink");
  const canReanalyze = isAnalyzed && !status && !!onReanalyze;
  const stickyLabel = language === "zh" ? "置顶" : "Pinned";
  const noteTypeLabel = video.note_type === "video" ? (language === "zh" ? "视频" : "Video") : null;
  const sourceKindLabel = video.source_kind === "file" ? (language === "zh" ? "本地视频" : "Local video") : null;
  const lastAnalyzedAtText = video.last_analyzed_at
    ? formatLastAnalyzedAt(video.last_analyzed_at, language)
    : null;

  return (
    <div
      onClick={() => (!isAnalyzed && !status || status === "error") && onClick?.()}
      className={cn(
        isCompact
          ? "relative rounded-lg overflow-hidden cursor-pointer group/card transition-all"
          : "relative flex flex-col overflow-hidden rounded-[22px] bg-white/96 shadow-[0_10px_24px_rgba(15,23,42,0.06),0_2px_4px_rgba(15,23,42,0.04)] cursor-pointer group/card transition-all dark:bg-[#18181b]",
        isCompact
          ? (
              (isAnalyzed || status === "done")
                ? "cursor-default ring-1 ring-zinc-200/60 dark:ring-white/[0.06]"
                : status === "submitting"
                    ? "ring-2 ring-zinc-900/50 dark:ring-white/50"
                    : status === "error"
                      ? "ring-2 ring-red-500/80"
                      : status === "queued"
                        ? "ring-1 border-dashed ring-zinc-400/50 opacity-70"
                        : isSelected
                          ? "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950"
                          : "ring-1 ring-zinc-200/60 dark:ring-white/[0.06] hover:ring-zinc-400/30"
            )
          : (
              (isAnalyzed || status === "done")
                ? `${onReanalyze ? "cursor-pointer" : "cursor-default"} hover:-translate-y-0.5`
                : status === "submitting"
                    ? "ring-2 ring-zinc-900/50 dark:ring-white/50"
                    : status === "error"
                      ? "ring-2 ring-red-500/80"
                      : status === "queued"
                        ? "ring-1 ring-zinc-300/70 opacity-70"
                        : isSelected
                          ? "ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-950"
                          : "hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]"
            ),
        className,
      )}
    >
      <div
        className={cn(
          "bg-zinc-100 dark:bg-white/5 relative overflow-hidden shrink-0",
          isXiaohongshu ? "aspect-[4/5]" : "aspect-video",
        )}
      >
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-6 h-6 text-muted-foreground/20" />
          </div>
        )}

        {video.duration_seconds != null && video.duration_seconds > 0 && (
          <span
            className={cn(
              "absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums shadow-sm",
              "bg-black/70 text-white/90",
            )}
          >
            {formatMonitorVideoDuration(video.duration_seconds)}
          </span>
        )}

        {!isAnalyzed && !status && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onAnalyze?.();
              }}
              className="flex items-center gap-2 px-4 py-1.5 bg-white text-zinc-900 rounded-full text-[13px] font-medium tracking-wide shadow-xl transform translate-y-2 group-hover/card:translate-y-0 transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95"
            >
              <Inbox className="w-3.5 h-3.5 text-zinc-400" />
              {deconstructLabel}
            </button>
          </div>
        )}

        {isSelected && !isAnalyzed && (
          <div className="absolute top-0 right-0">
            <div className="w-6 h-6 rounded-bl-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Check className="w-4 h-4 text-white dark:text-zinc-900" />
            </div>
          </div>
        )}

        {status === "submitting" && (
          <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span className="text-[9px] font-bold text-white drop-shadow">{submittingLabel}</span>
            </div>
          </div>
        )}
        {status === "queued" && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="px-2 py-1 rounded bg-black/50 text-[10px] font-medium text-white/70">{queuedLabel}</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 bg-red-500/25 flex items-center justify-center backdrop-blur-[1px]">
            <span className="px-2 py-1 rounded-md bg-red-600/90 shadow-lg text-[10px] font-medium text-white">{submitFailedLabel}</span>
          </div>
        )}

        {(isAnalyzed || status === "done") && (!status || status === "done") && (
          <div className="absolute inset-0 bg-black/34 transition-colors duration-200 group-hover/card:bg-black/46 flex items-center justify-center backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2.5 px-4 text-center">
              <span className="px-3 py-1.5 rounded-full bg-black/60 shadow-xl backdrop-blur-sm text-xs font-medium text-white shadow-black/20 border border-white/10 tracking-wide flex items-center gap-1 transition-all duration-200 group-hover/card:-translate-y-1 group-hover/card:opacity-0">
                {alreadyAnalyzedLabel}
                <Check className="w-3 h-3" />
              </span>

              <div className="absolute left-1/2 top-1/2 w-[min(86%,240px)] -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-200 group-hover/card:opacity-100">
                <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/52 px-3 py-3 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                  {lastAnalyzedAtText && (
                    <div className="mb-2 text-[11px] text-white/78">
                      <span className="text-white/52">{lastAnalyzedAtLabel}</span>
                      <span className="ml-1.5 font-medium text-white/88">{lastAnalyzedAtText}</span>
                    </div>
                  )}

                  {canReanalyze && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onReanalyze?.();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-900 shadow-lg transition-all hover:bg-zinc-100 active:scale-[0.98]"
                    >
                      <RotateCw className="h-3.5 w-3.5 text-zinc-500" />
                      {reanalyzeLabel}
                    </button>
                  )}

                  {canReanalyze && reanalyzeHintLabel && (
                    <p className="mt-2 text-[10px] leading-relaxed text-white/46">
                      {reanalyzeHintLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {(status === "submitting" || status === "queued") && isAnalyzed && (
          <div className="absolute inset-0 bg-black/42 flex items-center justify-center backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white/90 shadow-lg">
              {status === "submitting" && <Loader2 className="h-5 w-5 animate-spin" />}
              <span className="text-[11px] font-medium">
                {status === "submitting" ? (reanalyzingLabel || submittingLabel) : queuedLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={cn("p-2.5 flex-1 flex flex-col", (isAnalyzed || status === "done") && "opacity-60", contentClassName)}>
        <p className={cn("font-medium mb-auto", isCompact ? "text-[11px] line-clamp-2 leading-snug" : "text-[12px] line-clamp-2 leading-relaxed")}>
          {video.title}
        </p>
        <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground/55", isCompact ? "mt-1.5" : "mt-2")}>
          {sourceKindLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/75">
              <Upload className="h-3 w-3" />
              {sourceKindLabel}
            </span>
          )}
          {video.is_sticky && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/90 bg-rose-50/90 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
              <Pin className="h-3 w-3" />
              {stickyLabel}
            </span>
          )}
          {noteTypeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/75">
              <Play className="h-3 w-3" />
              {noteTypeLabel}
            </span>
          )}
          {video.published && (
            <span className="text-[10px] whitespace-nowrap">
              {new Date(video.published).toLocaleDateString(locale)}
            </span>
          )}
          {video.source_kind === "file" && video.file_size_bytes != null && (
            <span className="text-[10px] whitespace-nowrap">
              {formatMonitorVideoFileSize(video.file_size_bytes)}
            </span>
          )}
          {video.view_count != null && (
            <span className="flex items-center gap-0.5 text-[10px] whitespace-nowrap">
              <Eye className="w-3 h-3" />
              {formatMonitorVideoCount(video.view_count)}
            </span>
          )}
          {video.like_count != null && (
            <span className="flex items-center gap-0.5 text-[10px] whitespace-nowrap">
              <ThumbsUp className="w-3 h-3" />
              {formatMonitorVideoCount(video.like_count)}
            </span>
          )}
          {video.favorite_count != null && (
            <span className="flex items-center gap-0.5 text-[10px] whitespace-nowrap">
              <Bookmark className="w-3 h-3" />
              {formatMonitorVideoCount(video.favorite_count)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
