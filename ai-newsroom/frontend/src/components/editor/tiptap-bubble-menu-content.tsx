"use client";

import * as React from "react";
import { ArrowRight, Check, Image as ImageIcon, Sparkles, X } from "lucide-react";

interface TipTapBubbleMenuContentProps {
  rewritePreview: string | null;
  rewriteInput: string;
  isRewriting: boolean;
  selectedLength: number;
  imageRatio: string;
  onRewriteInputChange: (value: string) => void;
  onRewrite: () => void;
  onRewriteReplace: () => void;
  onRewriteDiscard: () => void;
  onGenerateImage: () => void;
  onImageRatioChange: (value: string) => void;
}

export function TipTapBubbleMenuContent({
  rewritePreview,
  rewriteInput,
  isRewriting,
  selectedLength,
  imageRatio,
  onRewriteInputChange,
  onRewrite,
  onRewriteReplace,
  onRewriteDiscard,
  onGenerateImage,
  onImageRatioChange,
}: TipTapBubbleMenuContentProps) {
  if (rewritePreview) {
    return (
      <div className="w-[300px] flex flex-col">
        <div className="px-2.5 py-2.5 text-[13px] leading-[1.6] font-medium text-zinc-800 dark:text-zinc-100 border-b border-zinc-100 dark:border-white/10 max-h-[180px] overflow-y-auto custom-scrollbar shadow-inner bg-zinc-50/50 dark:bg-black/20">
          {rewritePreview}
        </div>
        <div className="flex gap-1 p-1">
          <button
            type="button"
            onClick={onRewriteReplace}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Replace
          </button>
          <button
            type="button"
            onClick={onRewriteDiscard}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[280px]">
      {selectedLength > 500 && (
        <div className="px-2 py-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100/50 dark:border-amber-500/20 leading-tight">
          选中的文本过长 ({selectedLength} 字符)。AI 可能只会提取摘要。
        </div>
      )}
      <div className="flex items-center gap-1 px-1 py-0.5">
        <div className="pl-2 pr-1 flex items-center opacity-80">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
        </div>
        <input
          type="text"
          maxLength={500}
          placeholder="要求 AI 重写... (<500 字)"
          className="bg-transparent border-none outline-none text-[13px] font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 flex-1 px-1 py-1.5 h-8 min-w-0"
          value={rewriteInput}
          onChange={(event) => onRewriteInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onRewrite();
            }
          }}
          disabled={isRewriting}
        />
        <button
          type="button"
          onClick={onRewrite}
          disabled={isRewriting || !rewriteInput.trim()}
          className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-md disabled:opacity-50 transition-colors cursor-pointer mr-0.5"
        >
          {isRewriting ? (
            <div className="w-3.5 h-3.5 border-2 border-zinc-300 dark:border-white/20 border-t-zinc-600 dark:border-t-white rounded-full animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="border-t border-zinc-100 dark:border-white/10 my-0.5 mx-1" />
      <div className="px-1 pb-0.5 flex gap-1">
        <button
          type="button"
          onClick={onGenerateImage}
          disabled={isRewriting}
          className="flex flex-1 items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer disabled:opacity-50"
        >
          <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
          画张图
        </button>
        <select
          value={imageRatio}
          onChange={(event) => onImageRatioChange(event.target.value)}
          className="text-[11px] bg-[var(--nav-hover-bg)] hover:bg-[var(--nav-active-bg)] border border-zinc-200 dark:border-white/10 rounded-md px-1.5 py-1 text-zinc-600 dark:text-zinc-300 outline-none cursor-pointer appearance-none text-center font-medium transition-colors"
          title="图片比例"
        >
          <option value="16:9">16:9 横版</option>
          <option value="9:16">9:16 竖版</option>
          <option value="1:1">1:1 方图</option>
          <option value="4:3">4:3 横版</option>
          <option value="3:4">3:4 竖版</option>
        </select>
      </div>
    </div>
  );
}
