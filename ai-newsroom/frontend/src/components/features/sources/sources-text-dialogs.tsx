"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { Source } from "@/lib/api";

interface SourcesTextDialogsProps {
  showAddModal: boolean;
  editingSourceId: number | null;
  name: string;
  url: string;
  sourceType: string;
  extractorPrompt: string;
  sourceToDelete?: Source;
  t: (key: string, fallback?: string) => string;
  onCloseAddModal: () => void;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onSourceTypeChange: (value: string) => void;
  onExtractorPromptChange: (value: string) => void;
  onResetEditing: () => void;
  onSubmit: (event: React.FormEvent) => void;
  deleteSourceId: number | null;
  onCloseDeleteDialog: () => void;
  onConfirmDelete: () => void;
}

export function SourcesTextDialogs({
  showAddModal,
  editingSourceId,
  name,
  url,
  sourceType,
  extractorPrompt,
  sourceToDelete,
  t,
  onCloseAddModal,
  onNameChange,
  onUrlChange,
  onSourceTypeChange,
  onExtractorPromptChange,
  onResetEditing,
  onSubmit,
  deleteSourceId,
  onCloseDeleteDialog,
  onConfirmDelete,
}: SourcesTextDialogsProps) {
  return (
    <>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">{editingSourceId ? t("sources.editSource") : t("sources.addNewSource")}</h3>
                <p className="text-sm text-muted-foreground">{editingSourceId ? t("sources.editSourceDesc") : t("sources.addNewSourceDesc")}</p>
              </div>
              <button
                onClick={() => {
                  onCloseAddModal();
                  onResetEditing();
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">{t("sources.sourceName")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder={t("sources.sourceNamePlaceholder")}
                  required
                  autoFocus
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">{t("sources.feedUrl")}</label>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  placeholder={t("sources.feedUrlPlaceholder", "https://example.com/feed.xml")}
                  required
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-foreground">{t("sources.type")}</label>
                <select
                  value={sourceType}
                  onChange={(event) => onSourceTypeChange(event.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                >
                  <option value="rss">{t("sources.rssFeed")}</option>
                  <option value="web">{t("sources.webScrape")}</option>
                </select>
              </div>

              {sourceType === "web" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[13px] font-semibold text-foreground flex justify-between">
                    <span>{t("sources.extractorPromptLabel", "AI Extractor Prompt (Optional)")}</span>
                    <span className="text-muted-foreground font-normal text-[11px] bg-zinc-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                      {t("sources.extractorPromptModel", "Gemini 2.5 Flash")}
                    </span>
                  </label>
                  <textarea
                    value={extractorPrompt}
                    onChange={(event) => onExtractorPromptChange(event.target.value)}
                    placeholder={t("sources.extractorPromptPlaceholder", "e.g. Extract only announcements about AI models. Ignore pricing details.")}
                    className="w-full h-20 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all placeholder:text-muted-foreground/50 resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("sources.extractorPromptDesc", "Uses LLM to filter and format the raw webpage content before putting it in the pipeline.")}
                  </p>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onCloseAddModal();
                    onResetEditing();
                  }}
                >
                  {t("sources.cancel")}
                </Button>
                <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90">
                  {editingSourceId ? t("sources.saveChanges") : t("sources.connectSource")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteSourceId}
        onClose={onCloseDeleteDialog}
        onConfirm={onConfirmDelete}
        title={t("sources.confirmDeleteTitle")}
        description={`${t("sources.confirmDeleteDesc1")}${sourceToDelete?.name || ""}${t("sources.confirmDeleteDesc2")}`}
        confirmText={t("sources.confirmDeleteBtn")}
      />
    </>
  );
}
