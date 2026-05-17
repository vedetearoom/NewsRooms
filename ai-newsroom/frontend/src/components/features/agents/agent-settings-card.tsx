"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AgentSettingsCardProps {
  title: React.ReactNode;
  description?: string;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AgentSettingsCard({
  title,
  description,
  footerLeft,
  footerRight,
  children,
  className,
}: AgentSettingsCardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-[#111214] rounded-xl shadow-sm shadow-black/[0.03] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] ring-1 ring-zinc-950/[0.03] dark:ring-white/[0.06] flex flex-col dark:hover:ring-white/[0.1] transition-all duration-300",
        className,
      )}
    >
      <div className="px-6 pt-6 pb-5">
        <h3 className="flex text-[15px] font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
        <div className="mt-5">{children}</div>
      </div>
      {(footerLeft || footerRight) && (
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-50/50 dark:bg-white/[0.02] border-t border-zinc-100/60 dark:border-white/[0.05] rounded-b-xl">
          <div className="text-[12px] text-muted-foreground">{footerLeft}</div>
          <div>{footerRight}</div>
        </div>
      )}
    </div>
  );
}
