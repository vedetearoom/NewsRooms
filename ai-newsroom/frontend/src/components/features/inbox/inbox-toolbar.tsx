import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { ChevronDown } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface InboxToolbarProps {
  contentTab: "pinned" | "article" | "video";
  setContentTab: (tab: "pinned" | "article" | "video") => void;
  activeTag: string;
  setActiveTag: (tag: string) => void;
  topTags: [string, number][];
  overflowTags: [string, number][];
  totalCount: number;
  pinnedCount: number;
}

export function InboxToolbar({
  contentTab,
  setContentTab,
  activeTag,
  setActiveTag,
  topTags,
  overflowTags,
  totalCount,
  pinnedCount,
}: InboxToolbarProps) {
  const { t } = useTranslation();

  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);
  useClickOutside({
    ref: moreRef,
    enabled: moreOpen,
    onClickOutside: () => setMoreOpen(false),
  });

  const overflowCount = overflowTags.reduce((sum, [, count]) => sum + count, 0);

  return (
    <header className="sticky top-0 z-[120] bg-white/90 dark:bg-transparent frosted-bar backdrop-blur-xl">
      <div className="px-8 h-[52px] flex items-center justify-between group">
        <div className="flex items-center gap-5">
          <h1 className="text-[14px] font-semibold tracking-[-0.02em]">{t('inbox.title')}</h1>
          {/* Content Type Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setContentTab("article"); setActiveTag("all"); }}
              className={cn(
                "px-3 py-1 rounded-md text-[13px] transition-colors cursor-pointer",
                contentTab === "article"
                  ? "text-foreground font-semibold bg-[var(--pill-bg)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--pill-hover-bg)]"
              )}
            >
              {t('inbox.textIntel')}
            </button>
            <button
              onClick={() => { setContentTab("video"); setActiveTag("all"); }}
              className={cn(
                "px-3 py-1 rounded-md text-[13px] transition-colors cursor-pointer",
                contentTab === "video"
                  ? "text-foreground font-semibold bg-[var(--pill-bg)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--pill-hover-bg)]"
              )}
            >
              {t('inbox.videoIntel')}
            </button>
            <button
              onClick={() => { setContentTab("pinned"); setActiveTag("all"); }}
              className={cn(
                "px-3 py-1 rounded-md text-[13px] transition-colors cursor-pointer",
                contentTab === "pinned"
                  ? "text-foreground font-semibold bg-[var(--pill-bg)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--pill-hover-bg)]"
              )}
            >
              {t('inbox.pinnedTab')}
            </button>
          </div>
          {/* Dynamic Trending Tags */}
          <div className="flex items-center gap-0.5">
            {/* All */}
            <button
              onClick={() => setActiveTag("all")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[12px] transition-colors cursor-pointer",
                activeTag === "all"
                  ? "text-foreground font-semibold bg-[var(--pill-bg)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--pill-hover-bg)]"
              )}
            >
              {t('inbox.all')}
              <span className={cn(
                "ml-1 text-[10px] tabular-nums",
                activeTag === "all" ? "opacity-50" : "opacity-30"
              )}>
                {totalCount}
              </span>
            </button>

            {topTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[12px] transition-colors cursor-pointer",
                  activeTag === tag
                    ? "text-foreground font-semibold bg-[var(--pill-bg)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-[var(--pill-hover-bg)]"
                )}
              >
                {t(`categories.${tag}`) === `categories.${tag}` ? tag : t(`categories.${tag}`)}
                <span className={cn(
                  "ml-1 text-[10px] tabular-nums",
                  activeTag === tag ? "opacity-50" : "opacity-30"
                )}>
                  {count}
                </span>
              </button>
            ))}

            {overflowTags.length > 0 && (
              <div className="relative z-[130]" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={cn(
                    "flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[12px] transition-colors cursor-pointer",
                    activeTag === "__other__" || overflowTags.some(([tagName]) => tagName === activeTag)
                      ? "text-foreground font-semibold bg-[var(--pill-bg)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-[var(--pill-hover-bg)]"
                  )}
                >
                  {t('inbox.more')}
                  <span className="ml-0.5 text-[10px] tabular-nums opacity-30">{overflowCount}</span>
                  <ChevronDown className={cn(
                    "w-3 h-3 ml-0.5 transition-transform",
                    moreOpen && "rotate-180"
                  )} />
                </button>

                {moreOpen && (
                  <div className="absolute top-full left-0 z-[140] mt-1.5 min-w-[160px] rounded-lg border border-zinc-200/60 bg-white py-1.5 shadow-lg shadow-black/10 animate-fade-in dark:border-white/[0.08] dark:bg-[#111214] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] dark:backdrop-blur-xl">
                    {overflowTags.map(([tag, count]) => (
                      <button
                        key={tag}
                        onClick={() => { setActiveTag(tag); setMoreOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-[12px] transition-colors flex items-center justify-between gap-4",
                          activeTag === tag
                            ? "text-foreground font-medium bg-zinc-100 dark:bg-white/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-white/5"
                        )}
                      >
                        <span>{t(`categories.${tag}`) === `categories.${tag}` ? tag : t(`categories.${tag}`)}</span>
                        <span className="text-[10px] tabular-nums opacity-40">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
