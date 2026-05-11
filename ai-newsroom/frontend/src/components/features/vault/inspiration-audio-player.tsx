"use client";

import * as React from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InspirationAudioPlayerProps {
  audioUrl?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  language: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onTogglePlay: () => void;
  onSeek: (event: React.MouseEvent<HTMLDivElement>) => void;
  onTimeUpdate: (time: number) => void;
  onLoadedMetadata: (duration: number) => void;
  onEnded: () => void;
  onPlay: () => void;
  onPause: () => void;
}

function formatAudioTime(seconds: number) {
  if (!seconds || Number.isNaN(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function InspirationAudioPlayer({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  audioRef,
  onTogglePlay,
  onSeek,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onPlay,
  onPause,
}: InspirationAudioPlayerProps) {
  const displayUrl = React.useMemo(() => {
    if (!audioUrl) return undefined;
    if (audioUrl.includes('metalm-base-minio-sse:9000')) {
      return audioUrl.replace('http://metalm-base-minio-sse:9000', '');
    }
    return audioUrl;
  }, [audioUrl]);

  return (
    <div className="flex-1 flex items-center gap-3 max-w-md">
      <button
        onClick={onTogglePlay}
        disabled={!displayUrl}
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform",
          displayUrl ? "bg-zinc-900 dark:bg-white text-white dark:text-black hover:scale-105" : "bg-zinc-200 dark:bg-white/10 text-zinc-400 cursor-not-allowed",
        )}
      >
        {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
      </button>
      <span className="text-[12px] font-mono text-zinc-500">{formatAudioTime(currentTime)}</span>
      <div
        className="flex-1 h-[2px] bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden relative cursor-pointer group"
        onClick={onSeek}
      >
        <div
          className="absolute left-0 top-0 h-full bg-zinc-900 dark:bg-white rounded-full transition-all duration-100"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>
      <span className="text-[12px] font-mono text-zinc-500">{formatAudioTime(duration)}</span>
      <div className="flex items-center gap-2 text-zinc-400 shrink-0 ml-1">
        <Volume2 className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium font-mono">1x</span>
      </div>
      {displayUrl && (
        <audio
          ref={audioRef}
          src={displayUrl}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => onLoadedMetadata(event.currentTarget.duration)}
          onEnded={onEnded}
          onPlay={onPlay}
          onPause={onPause}
        />
      )}
    </div>
  );
}
