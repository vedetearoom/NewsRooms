"use client";

import { cn } from "@/lib/utils";

export function InboxLoadingGrid() {
  return (
    <div className="bento-grid">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "card-surface overflow-hidden",
            index === 0 ? "col-span-1 md:col-span-2 row-span-2" : "col-span-1 row-span-1",
          )}
        >
          <div className="p-4 md:p-5 space-y-3">
            <div className="skeleton h-3 w-1/4 mb-3" />
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-5 w-4/5" />
            <div className="skeleton h-3 w-full mt-3" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
