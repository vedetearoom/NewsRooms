"use client";

import { cn } from "@/lib/utils";

interface InboxSourceTabItem {
  id: string | number;
  label: string;
  count: number;
}

interface InboxSourceTabsProps {
  items: InboxSourceTabItem[];
  activeId: string | number;
  allLabel?: string;
  allCount: number;
  onChange: (id: string | number) => void;
  className?: string;
  dividerAfterAll?: boolean;
}

export function InboxSourceTabs({
  items,
  activeId,
  allLabel = "All",
  allCount,
  onChange,
  className = "",
  dividerAfterAll = false,
}: InboxSourceTabsProps) {
  return (
    <div className={cn("flex items-end gap-5", className)}>
      <button
        onClick={() => onChange("all")}
        className={cn(
          "relative pb-2.5 pt-3 text-[13px] font-medium transition-colors outline-none",
          activeId === "all"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="flex items-center gap-1.5">
          {allLabel}
          <span className="text-[11px] tabular-nums text-muted-foreground/60">
            {allCount}
          </span>
        </span>
        {activeId === "all" && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full" />
        )}
      </button>

      {dividerAfterAll && (
        <div className="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mb-3" />
      )}

      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(isActive ? "all" : item.id)}
            className={cn(
              "relative pb-2.5 pt-3 text-[13px] font-medium transition-colors outline-none",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {item.label}
              <span className="text-[11px] tabular-nums text-muted-foreground/60">
                {item.count}
              </span>
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
