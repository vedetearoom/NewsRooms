"use client";

import { PageLoadingState } from "@/components/shared/page-states";

interface PageShellFallbackProps {
  label?: string;
}

export function PageShellFallback({
  label = "Loading...",
}: PageShellFallbackProps) {
  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0b0c0f]">
      <PageLoadingState className="min-h-screen" label={label} />
    </div>
  );
}
