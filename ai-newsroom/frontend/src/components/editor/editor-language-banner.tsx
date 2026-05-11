"use client";

import { Button } from "@/components/ui/button";

interface EditorLanguageBannerProps {
  title: string;
  description: string;
  actionLabel: string;
  onTranslate: () => void | Promise<void>;
  onDismiss: () => void;
  disabled?: boolean;
}

export function EditorLanguageBanner({
  title,
  description,
  actionLabel,
  onTranslate,
  onDismiss,
  disabled = false,
}: EditorLanguageBannerProps) {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between z-10 shrink-0 shadow-sm relative">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <div>
          <div className="text-amber-600 dark:text-amber-500 text-[13px] font-semibold tracking-tight">
            {title}
          </div>
          <div className="text-muted-foreground text-[12px]">
            {description}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-3 text-[11px] font-medium border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50 transition-colors shadow-sm"
          disabled={disabled}
          onClick={onTranslate}
        >
          {actionLabel}
        </Button>
        <button
          onClick={onDismiss}
          className="p-1 rounded-md text-amber-500/70 hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
