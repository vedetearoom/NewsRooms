"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import type { InspirationAsset } from "@/lib/api";
import { InspirationAudioPlayer } from "@/components/features/vault/inspiration-audio-player";
import { useTranslation } from "@/hooks/useTranslation";

type HookAnalysisData = {
  analysis?: string;
};

type InspirationExtraData = InspirationAsset["extra_data"] & {
  media_type?: string;
  source_urls?: string[];
  hook_analysis?: HookAnalysisData;
  original_key_points?: string[];
  original_summary?: string;
};

interface InspirationDetailHeaderProps {
  viewingInspiration: InspirationAsset;
  extraData: InspirationExtraData;
  isText: boolean;
  isPlaying: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  formatDate: (dateStr: string) => string;
  onTogglePlay: () => void;
  onSeek: (event: React.MouseEvent<HTMLDivElement>) => void;
  onTimeUpdate: (time: number) => void;
  onLoadedMetadata: (duration: number) => void;
  onEnded: () => void;
  onPlay: () => void;
  onPause: () => void;
}

export function InspirationDetailHeader({
  viewingInspiration,
  extraData,
  isText,
  isPlaying,
  audioCurrentTime,
  audioDuration,
  audioRef,
  formatDate,
  onTogglePlay,
  onSeek,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onPlay,
  onPause,
}: InspirationDetailHeaderProps) {
  const { t, language } = useTranslation();
  return (
    <>
      <div className="flex items-start justify-between gap-8 mb-6">
        <h2 className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug pr-4 tracking-tight">
          {viewingInspiration.title || t("vault.inspirationUntitled")}
        </h2>
      </div>

      <div className="flex flex-col mb-12 border-y border-zinc-100 dark:border-white/5 py-1">
        <div className="flex items-center py-2.5">
          <div className="w-32 shrink-0 text-[13px] text-zinc-500 font-medium">
            {t("vault.inspirationCreated")}
          </div>
          <div className="flex-1 text-[13px] text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {formatDate(viewingInspiration.created_at)}
          </div>
        </div>

        <div className="flex items-center py-2.5">
          <div className="w-32 shrink-0 text-[13px] text-zinc-500 font-medium">
            {t("vault.inspirationSource")}
          </div>
          <div className="flex-1 text-[13px] text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="w-0.5 h-3 bg-sky-400 rounded-full" />
            <span className="lowercase">{viewingInspiration.platform || "bilibili"}</span>
            {(() => {
              const urls = extraData.source_urls || [];
              const displayUrls = urls.length > 0 ? urls : (viewingInspiration.source_url ? [viewingInspiration.source_url] : []);

              if (displayUrls.length === 0) return null;
              if (displayUrls.length === 1) {
                return (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700 mx-1">|</span>
                    <a href={displayUrls[0]} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors flex items-center gap-1.5 group">
                      <ExternalLink className="w-3 h-3 group-hover:text-zinc-900 dark:group-hover:text-zinc-300" />
                      {t("vault.inspirationViewOriginal")}
                    </a>
                  </>
                );
              }

              return (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700 mx-1">|</span>
                  <div className="flex items-center gap-3 flex-wrap">
                    {displayUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors flex items-center gap-1 group bg-zinc-50 dark:bg-white/[0.02] px-2 py-0.5 rounded-md border border-zinc-100 dark:border-white/5"
                      >
                        <ExternalLink className="w-3 h-3 group-hover:text-zinc-900 dark:group-hover:text-zinc-300" />
                        {t("vault.inspirationSourceLink").replace("{index}", String(index + 1))}
                      </a>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {!isText && viewingInspiration.audio_url && (
          <div className="flex items-center py-2.5">
            <div className="w-32 shrink-0 text-[13px] text-zinc-500 font-medium">
              {t("vault.inspirationAudio")}
            </div>
            <InspirationAudioPlayer
              audioUrl={viewingInspiration.audio_url}
              isPlaying={isPlaying}
              currentTime={audioCurrentTime}
              duration={audioDuration}
              language={language}
              audioRef={audioRef}
              onTogglePlay={onTogglePlay}
              onSeek={onSeek}
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMetadata}
              onEnded={onEnded}
              onPlay={onPlay}
              onPause={onPause}
            />
          </div>
        )}

        {viewingInspiration.tags && viewingInspiration.tags.length > 0 && (
          <div className="flex items-center py-2.5">
            <div className="w-32 shrink-0 text-[13px] text-zinc-500 font-medium">
              {t("vault.inspirationTags")}
            </div>
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {viewingInspiration.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 rounded-md text-[12px] font-medium border border-zinc-100 dark:border-white/5">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
