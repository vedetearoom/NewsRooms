"use client";

interface InboxEmptyStateProps {
  contentTab: "article" | "video";
  t: (key: string, fallback?: string) => string;
}

export function InboxEmptyState({ contentTab, t }: InboxEmptyStateProps) {
  const sourceHref = contentTab === "video" ? "/sources?tab=video" : "/sources?tab=text";

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh] relative">
      <div className="absolute inset-0 pointer-events-none flex flex-wrap gap-4 md:gap-6 p-8 justify-center overflow-hidden opacity-[0.15] dark:opacity-5">
        <div className="w-[280px] md:w-[320px] h-[380px] border-2 border-dashed border-zinc-400 dark:border-zinc-500 rounded-2xl" />
        <div className="hidden md:block w-[320px] h-[280px] border-2 border-dashed border-zinc-400 dark:border-zinc-500 rounded-2xl mt-12" />
        <div className="hidden lg:block w-[320px] h-[400px] border-2 border-dashed border-zinc-400 dark:border-zinc-500 rounded-2xl mb-8" />
      </div>

      <div className="flex flex-col items-center text-center max-w-md p-8 relative z-10">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 flex items-center justify-center shadow-sm">
          <svg className="w-8 h-8 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">
          {t("inbox.emptyTitle")}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed max-w-sm">
          {t("inbox.emptyDesc")}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <a href={sourceHref} className="w-full sm:w-auto text-center bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-white px-5 py-2.5 rounded-lg text-[13px] font-medium transition-colors shadow-sm">
            {t("inbox.addSource")}
          </a>
        </div>

      </div>
    </div>
  );
}
