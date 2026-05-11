import * as React from "react";
import { Tv, PlaySquare, BookHeart } from "lucide-react";

export interface MonitorVideoStatusMap {
  [url: string]: "queued" | "submitting" | "done" | "error";
}

export const MONITOR_PLATFORM_META: Record<string, { icon: React.ReactNode; color: string; disabledKey?: string }> = {
  bilibili: { icon: <Tv className="w-5 h-5" />, color: "text-zinc-600 bg-zinc-100 border border-zinc-200 dark:text-zinc-400 dark:bg-white/5 dark:border-white/10" },
  youtube: { icon: <PlaySquare className="w-5 h-5" />, color: "text-zinc-600 bg-zinc-100 border border-zinc-200 dark:text-zinc-400 dark:bg-white/5 dark:border-white/10" },
  xiaohongshu: { icon: <BookHeart className="w-5 h-5" />, color: "text-zinc-600 bg-zinc-100 border border-zinc-200 dark:text-zinc-400 dark:bg-white/5 dark:border-white/10" },
};

export function getMonitorRelativeTime(dateStr: string, language: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffInMinutes < 1) return language === "zh" ? "刚刚检查" : "Checked just now";
  if (diffInMinutes < 60) return language === "zh" ? `${diffInMinutes} 分钟前检查` : `Checked ${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return language === "zh" ? `${diffInHours} 小时前检查` : `Checked ${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return language === "zh" ? `${diffInDays} 天前检查` : `Checked ${diffInDays}d ago`;
  return `${date.toLocaleDateString()}`;
}
