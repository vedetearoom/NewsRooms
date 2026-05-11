"use client";

import * as React from "react";
import { Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspirationAsset } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";

type HookAnalysisData = {
  analysis?: string;
};

type InspirationExtraData = InspirationAsset["extra_data"] & {
  media_type?: string;
  source_urls?: string[];
  hook_analysis?: HookAnalysisData;
  original_key_points?: string[];
  original_summary?: string;
  transcript?: Array<{ time: string; text: string }>;
};

interface InspirationTabContentProps {
  effectiveTab: "summary" | "structure" | "transcript" | "fulltext";
  isText: boolean;
  viewingInspiration: InspirationAsset;
  extraData: InspirationExtraData;
  showFullStructure: boolean;
  showFullTranscript: boolean;
  onCopy: (text: string) => void;
  onToggleFullStructure: (value: boolean) => void;
  onToggleFullTranscript: (value: boolean) => void;
}

export function InspirationTabContent({
  effectiveTab,
  isText,
  viewingInspiration,
  extraData,
  showFullStructure,
  showFullTranscript,
  onCopy,
  onToggleFullStructure,
  onToggleFullTranscript,
}: InspirationTabContentProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-[300px]">
      {effectiveTab === "summary" && (
        <div className="max-w-3xl space-y-8">
          {isText ? (
            <div className="space-y-10">
              {viewingInspiration.hook_text && (
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                    📋 {t("vault.inspirationSummaryText")}
                  </h4>
                  <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50/80 dark:bg-white/[0.02] p-5 rounded-xl border border-zinc-100 dark:border-white/5">
                    {viewingInspiration.hook_text}
                  </p>
                </div>
              )}
              {extraData.original_key_points && Array.isArray(extraData.original_key_points) && extraData.original_key_points.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                    💡 {t("vault.inspirationKeyPoints")}
                  </h4>
                  <ul className="space-y-2.5">
                    {extraData.original_key_points.map((point, index) => (
                      <li key={index} className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300 flex items-start gap-3">
                        <span className="text-zinc-300 dark:text-zinc-600 mt-1.5 shrink-0 text-[10px]">●</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : viewingInspiration.hook_text ? (
            <div className="bg-zinc-50/50 dark:bg-white/[0.02] p-6 rounded-xl border border-zinc-100 dark:border-white/5">
              <div className="flex items-center gap-2 mb-4 text-zinc-800 dark:text-zinc-200">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-[12px] font-black uppercase tracking-wider">{t("vault.inspirationHook")}</h4>
              </div>
              <blockquote className="text-[16px] font-serif text-zinc-800 dark:text-zinc-300 leading-relaxed mb-5 pl-4 border-l-[3px] border-zinc-300 dark:border-zinc-600 italic">
                &ldquo;{viewingInspiration.hook_text}&rdquo;
              </blockquote>
              {viewingInspiration.hook_technique && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t("vault.inspirationTechnique")}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium border border-zinc-200/50 dark:border-white/5">
                    {viewingInspiration.hook_technique}
                  </span>
                </div>
              )}
              {extraData.hook_analysis?.analysis && (
                <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 mt-2">
                  {extraData.hook_analysis.analysis}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[14px] text-zinc-500">{t("vault.inspirationNoHook")}</p>
          )}
        </div>
      )}

      {effectiveTab === "fulltext" && isText && (
        <div className="max-w-4xl">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-4 flex items-center gap-2">
            📄 {t("vault.inspirationFullText")}
          </h4>
          {viewingInspiration.template_skeleton ? (
            <div className="bg-zinc-50/80 dark:bg-[#0A0A0A] p-6 rounded-xl border border-zinc-200/80 dark:border-white/5 relative group/code shadow-sm">
              <div className="absolute top-4 right-4 z-20">
                <button onClick={() => onCopy(viewingInspiration.template_skeleton!)} className="bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-[12px] font-medium border border-zinc-200 dark:border-white/10 opacity-0 group-hover/code:opacity-100">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <div className={cn("relative transition-all duration-300", !showFullStructure && viewingInspiration.template_skeleton.split("\n").length > 15 ? "max-h-[500px] overflow-hidden" : "")}>
                <div className="text-[14px] leading-[1.8] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap pt-1 relative z-0">
                  {viewingInspiration.template_skeleton}
                </div>
                {!showFullStructure && viewingInspiration.template_skeleton.split("\n").length > 15 && (
                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-50 dark:from-[#0A0A0A] via-zinc-50/80 dark:via-[#0A0A0A]/80 to-transparent flex items-end justify-center pb-2 z-10">
                    <button
                      onClick={() => onToggleFullStructure(true)}
                      className="px-4 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 shadow-sm hover:text-zinc-900 dark:hover:text-white hover:shadow transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      {t("vault.inspirationReadMore")}
                    </button>
                  </div>
                )}
              </div>
              {showFullStructure && viewingInspiration.template_skeleton.split("\n").length > 15 && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => onToggleFullStructure(false)}
                    className="px-4 py-1.5 rounded-full bg-transparent text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    {t("vault.inspirationShowLess")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[14px] text-zinc-500">{t("vault.inspirationNoFullContent")}</p>
          )}
        </div>
      )}

      {effectiveTab === "structure" && !isText && (
        <div className="max-w-4xl space-y-10">
          {extraData.original_summary && (
            <div>
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                📋 {t("vault.inspirationSummaryVideo")}
              </h4>
              <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                {extraData.original_summary}
              </p>
            </div>
          )}

          {extraData.original_key_points && Array.isArray(extraData.original_key_points) && extraData.original_key_points.length > 0 && (
            <div>
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                💡 {t("vault.inspirationKeyPoints")}
              </h4>
              <ul className="space-y-2.5">
                {extraData.original_key_points.map((point, index) => (
                  <li key={index} className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300 flex items-start gap-3">
                    <span className="text-zinc-300 dark:text-zinc-600 mt-1.5 shrink-0 text-[10px]">●</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-4 flex items-center gap-2">
              🦴 {t("vault.inspirationStructureBreakdown")}
            </h4>
            {viewingInspiration.template_skeleton ? (
              <div className="bg-zinc-50/80 dark:bg-[#0A0A0A] p-6 rounded-xl border border-zinc-200/80 dark:border-white/5 relative group/code shadow-sm">
                <div className="absolute top-4 right-4 z-20">
                  <button onClick={() => onCopy(viewingInspiration.template_skeleton!)} className="bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-[12px] font-medium border border-zinc-200 dark:border-white/10 opacity-0 group-hover/code:opacity-100">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <div className={cn("relative transition-all duration-300", !showFullStructure && viewingInspiration.template_skeleton.split("\n").length > 15 ? "max-h-[340px] overflow-hidden" : "")}>
                  <pre className="text-[13px] leading-[1.8] text-zinc-700 dark:text-zinc-400 whitespace-pre-wrap font-mono tracking-tight pt-1 relative z-0">
                    {viewingInspiration.template_skeleton}
                  </pre>
                  {!showFullStructure && viewingInspiration.template_skeleton.split("\n").length > 15 && (
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-50 dark:from-[#0A0A0A] via-zinc-50/80 dark:via-[#0A0A0A]/80 to-transparent flex items-end justify-center pb-2 z-10">
                      <button
                      onClick={() => onToggleFullStructure(true)}
                      className="px-4 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 shadow-sm hover:text-zinc-900 dark:hover:text-white hover:shadow transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        {t("vault.inspirationShowMore")}
                      </button>
                    </div>
                  )}
                </div>
                {showFullStructure && viewingInspiration.template_skeleton.split("\n").length > 15 && (
                  <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => onToggleFullStructure(false)}
                    className="px-4 py-1.5 rounded-full bg-transparent text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      {t("vault.inspirationShowLess")}
                  </button>
                </div>
              )}
            </div>
          ) : (
              <p className="text-[14px] text-zinc-500">{t("vault.inspirationNoStructure")}</p>
            )}
          </div>
        </div>
      )}

      {effectiveTab === "transcript" && !isText && (
        <div className="max-w-3xl">
          {extraData.transcript && Array.isArray(extraData.transcript) && extraData.transcript.length > 0 ? (
            <div className="relative group/transcript bg-zinc-50/80 dark:bg-[#0A0A0A] p-6 rounded-xl border border-zinc-200/80 dark:border-white/5">
              <div className={cn("relative transition-all duration-300", !showFullTranscript && extraData.transcript.length > 20 ? "max-h-[600px] overflow-hidden" : "")}>
                <div className="text-[15px] text-zinc-800 dark:text-zinc-300 leading-relaxed font-normal">
                  {extraData.transcript.map((segment, index) => (
                    <p key={index} className="mb-4 flex items-start gap-4">
                      <span className="font-mono text-zinc-400 text-[13px] shrink-0 mt-[2px]">{segment.time}</span>
                      <span>{segment.text}</span>
                    </p>
                  ))}
                </div>
                {!showFullTranscript && extraData.transcript.length > 20 && (
                  <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-zinc-50 dark:from-[#0A0A0A] via-zinc-50/80 dark:via-[#0A0A0A]/80 to-transparent flex items-end justify-center pb-2 z-10">
                    <button
                      onClick={() => onToggleFullTranscript(true)}
                      className="px-4 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 shadow-sm hover:text-zinc-900 dark:hover:text-white hover:shadow transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      {t("vault.inspirationShowMoreTranscript")}
                    </button>
                  </div>
                )}
              </div>
              {showFullTranscript && extraData.transcript.length > 20 && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => onToggleFullTranscript(false)}
                    className="px-4 py-1.5 rounded-full bg-transparent text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    {t("vault.inspirationShowLess")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[14px] text-zinc-500">
              {t("vault.inspirationNoTranscript")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
