"use client";

import * as React from "react";
import { Link2, Loader2, Upload, Video, X } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export type InboxVideoImportMode = "url" | "file";

const VIDEO_FILE_ACCEPT = ".mp4,.mov,.m4v,.webm,video/mp4,video/quicktime,video/x-m4v,video/webm";

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

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
  mode,
  urlValue,
  selectedFile,
  loading = false,
  errorMessage,
  onModeChange,
  onUrlChange,
  onUrlSubmit,
  onFileSelect,
  onFileSubmit,
  className,
}: InboxVideoImportBarProps) {
  const { t } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const isUrlDisabled = loading || !urlValue.trim();
  const isFileDisabled = loading || !selectedFile;

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    onFileSelect(nextFile);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const nextFile = event.dataTransfer.files?.[0] ?? null;
    onFileSelect(nextFile);
  };

  return (
    <div
      className={cn(
        "mb-5 rounded-3xl border border-zinc-200/70 bg-zinc-50/85 px-4 py-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onModeChange("url")}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-all",
            mode === "url"
              ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
              : "bg-white text-zinc-600 ring-1 ring-zinc-200/70 hover:text-zinc-900 dark:bg-zinc-950/60 dark:text-zinc-300 dark:ring-white/[0.08]",
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
          {t("monitors.manualImportUrlTab")}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("file")}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-all",
            mode === "file"
              ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
              : "bg-white text-zinc-600 ring-1 ring-zinc-200/70 hover:text-zinc-900 dark:bg-zinc-950/60 dark:text-zinc-300 dark:ring-white/[0.08]",
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("monitors.manualImportFileTab")}
        </button>
      </div>

      {mode === "url" ? (
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
      ) : (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={VIDEO_FILE_ACCEPT}
            className="hidden"
            onChange={handleFileChange}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={handleChooseFile}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleChooseFile();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            className={cn(
              "rounded-2xl border border-dashed px-5 py-6 transition-all",
              dragActive
                ? "border-zinc-900 bg-zinc-100/90 dark:border-white dark:bg-white/[0.06]"
                : "border-zinc-300/90 bg-white/78 hover:border-zinc-400 dark:border-white/[0.12] dark:bg-zinc-950/40",
            )}
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900">
                <Video className="h-5 w-5" />
              </div>
              <p className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">
                {t("monitors.manualImportFileDropTitle")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t("monitors.manualImportFileDropDesc")}
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t("monitors.manualImportFileHint")}
              </p>
            </div>
          </div>

          {selectedFile ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-white/[0.08] dark:bg-zinc-950/50">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedFile.name}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t("monitors.manualImportFileSelected")} · {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onFileSelect(null)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
              >
                <X className="h-3.5 w-3.5" />
                {t("monitors.manualImportFileRemove")}
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <button
              type="button"
              onClick={handleChooseFile}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white px-4 text-[13px] font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:text-zinc-900 dark:border-white/[0.08] dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:border-white/15 dark:hover:text-white"
            >
              <Video className="h-3.5 w-3.5" />
              {t("monitors.manualImportFileChoose")}
            </button>
            <button
              type="button"
              onClick={onFileSubmit}
              disabled={isFileDisabled}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-[13px] font-medium text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:disabled:bg-zinc-700"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {loading ? t("monitors.manualImporting") : t("monitors.manualImportFileAction")}
            </button>
          </div>
        </div>
      )}

      {errorMessage ? (
        <p className="mt-3 text-[11px] leading-relaxed text-rose-600 dark:text-rose-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
