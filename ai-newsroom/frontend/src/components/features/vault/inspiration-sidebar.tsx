"use client";

import * as React from "react";
import { Check, Trash2, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspirationAsset } from "@/lib/api";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/shared/page-states";
import { useTranslation } from "@/hooks/useTranslation";

interface InspirationSidebarProps {
  inspirations: InspirationAsset[];
  groupedInspirations: Record<string, InspirationAsset[]>;
  viewingInspiration: InspirationAsset | null;
  loading: boolean;
  loadError?: string;
  selectedInspirationIds: number[];
  onSelectInspiration: (item: InspirationAsset) => void;
  onToggleSelection: (id: number) => void;
  onClearSelection: () => void;
  onDelete: (event: React.MouseEvent, id: number) => void;
  onRetry?: () => void;
}

export function InspirationSidebar({
  inspirations,
  groupedInspirations,
  viewingInspiration,
  loading,
  loadError,
  selectedInspirationIds,
  onSelectInspiration,
  onToggleSelection,
  onClearSelection,
  onDelete,
  onRetry,
}: InspirationSidebarProps) {
  const { t } = useTranslation();
  return (
    <div className="w-[320px] shrink-0 bg-zinc-50/50 dark:bg-white/[0.01] flex flex-col h-full relative z-10">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {loading ? (
          <PageLoadingState compact label={t("common.loading", "Loading...")} />
        ) : loadError ? (
          <PageErrorState
            compact
            title={t("vault.inspirationsLoadFailed")}
            description={loadError}
            action={onRetry ? { label: t("vault.retry"), onClick: onRetry } : undefined}
          />
        ) : inspirations.length === 0 ? (
          <PageEmptyState
            compact
            title={t("vault.inspirationSidebarEmptyTitle")}
            description={t("vault.inspirationSidebarEmptyDesc")}
          />
        ) : (
          <div className="space-y-6 pb-20">
            {Object.entries(groupedInspirations).map(([platform, items]) => (
              <div key={platform}>
                <h3 className="mb-2 text-[11px] font-semibold text-zinc-400 tracking-wide uppercase">
                  {platform} ({items.length})
                </h3>
                <div className="flex flex-col gap-1">
                  {items.map((item) => {
                    const isActive = viewingInspiration?.id === item.id;
                    const isChecked = selectedInspirationIds.includes(item.id);
                    const isMaxSelection = selectedInspirationIds.length >= 10 && !isChecked;
                    const showCheckbox = selectedInspirationIds.length > 0;

                    return (
                      <div key={item.id} className={cn("relative flex items-center group", isMaxSelection && "opacity-50 pointer-events-none")}>
                        <div
                          className={cn(
                            "absolute left-0 w-8 h-full flex items-center justify-center z-20 cursor-pointer",
                            showCheckbox ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleSelection(item.id);
                          }}
                        >
                          <div
                            className={cn(
                              "w-[16px] h-[16px] rounded-full border flex items-center justify-center transition-all",
                              isChecked
                                ? "bg-zinc-900 border-zinc-900 dark:bg-white dark:border-white text-white dark:text-zinc-900"
                                : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900",
                            )}
                          >
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (selectedInspirationIds.length > 0) {
                              onToggleSelection(item.id);
                            } else {
                              onSelectInspiration(item);
                            }
                          }}
                          className={cn(
                            "relative w-full text-left py-2.5 transition-colors cursor-pointer rounded-r-md flex items-center pr-3",
                            showCheckbox ? "pl-8" : "pl-3 group-hover:pl-8",
                            !isActive && "hover:bg-zinc-100/50 dark:hover:bg-white/[0.02]",
                          )}
                        >
                          {!showCheckbox && isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[20px] bg-zinc-900 dark:bg-white rounded-r-full" />
                          )}
                          <div className={cn("transition-opacity flex items-center justify-between w-full", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
                            <h4 className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate leading-snug flex-1 mr-2">
                              {item.title || item.hook_text || t("vault.inspirationUntitled")}
                            </h4>
                            {!showCheckbox && (
                              <div
                                className="opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1 rounded-md transition-all shrink-0 z-30"
                                onClick={(event) => onDelete(event, item.id)}
                                title={t("vault.deleteInspirationConfirm")}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-500 transition-colors" />
                              </div>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedInspirationIds.length > 0 ? (
        <div className="absolute bottom-4 left-4 right-4 bg-zinc-100/95 dark:bg-zinc-800/95 backdrop-blur-md text-zinc-700 dark:text-zinc-300 text-[12px] font-medium rounded-full py-2 px-4 flex items-center justify-between shadow-lg border border-zinc-200/50 dark:border-white/10 animate-in slide-in-from-bottom-4">
          <span>{t("vault.inspirationSelectedCount").replace("{count}", String(selectedInspirationIds.length))}</span>
          <button
            onClick={onClearSelection}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            {t("vault.inspirationClearSelection")}
          </button>
        </div>
      ) : (
        <div className="absolute bottom-4 left-4 right-4 bg-zinc-100/80 dark:bg-zinc-800/80 backdrop-blur-md text-zinc-500 dark:text-zinc-400 text-[11px] font-medium rounded-full py-2 px-4 flex items-center justify-center border border-zinc-200/50 dark:border-white/5 shadow-sm pointer-events-none animate-in fade-in duration-500">
          <Wand2 className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
          {t("vault.inspirationMultiSelectHint")}
        </div>
      )}
    </div>
  );
}
