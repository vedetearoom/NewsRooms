"use client";

import { Link2, Loader2 } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export type InboxVideoImportMode = "url" | "file";

interface InboxVideoImportBarProps {
  mode: InboxVideoImportMode;
  urlValue: string;
  selectedFile: File | null;
  loading?: boolean;
  errorMessage?: string;
  onModeChange: (mode: InboxVideoImportMode) => void;
  onUrlChange: (value: string) => void;
  onUrlSubmit: () => void;
  onFileSelect: (file: File | null) => void;
  onFileSubmit: () => void;
  className?: string;
}

export function InboxVideoImportBar({
  urlValue,
  loading = false,
  errorMessage,
  onUrlChange,
  onUrlSubmit,
  className,
}: InboxVideoImportBarProps) {
  const { t } = useTranslation();
  const isUrlDisabled = loading || !urlValue.trim();

  return (
    <div
      className={cn(
        "mb-5 rounded-3xl border border-zinc-200/70 bg-zinc-50/85 px-4 py-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-3 text-[12px] font-medium text-white shadow-sm dark:bg-white dark:text-zinc-900">
          <Link2 className="h-3.5 w-3.5" />
          {t("monitors.manualImportUrlTab")}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/[0.08]">
          <Link2 className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="url"
              value={urlValue}
              onChange={(event) => onUrlChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onUrlSubmit();
                }
              }}
              placeholder={t("monitors.manualImportPlaceholder")}
              className="h-11 w-full rounded-xl border border-zinc-200/80 bg-white px-4 text-[13.5px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-4 focus:ring-zinc-900/5 dark:border-white/[0.08] dark:bg-zinc-950/60 dark:text-zinc-100 dark:focus:border-white/15 dark:focus:ring-white/10"
            />
            <button
              type="button"
              onClick={onUrlSubmit}
              disabled={isUrlDisabled}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-[13px] font-medium text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:disabled:bg-zinc-700"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {loading ? t("monitors.manualImporting") : t("monitors.manualImportAction")}
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t("monitors.manualImportHint")}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-3 text-[11px] leading-relaxed text-rose-600 dark:text-rose-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
