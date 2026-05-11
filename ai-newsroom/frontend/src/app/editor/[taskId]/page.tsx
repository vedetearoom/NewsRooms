"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTask } from "@/hooks/useApi";
import { TipTapEditor } from "@/components/editor/tiptap-editor";
import { DiffView } from "@/components/editor/diff-view";
import { Button } from "@/components/ui/button";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorLanguageBanner } from "@/components/editor/editor-language-banner";
import { EditorOutlineSidebar } from "@/components/editor/editor-outline-sidebar";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import { SourceCardsPanel } from "@/components/editor/source-cards-panel";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useEditorState } from "@/hooks/useEditorState";

export default function EditorPage() {
  const params = useParams();
  const taskId = Number(params.taskId);

  const { task, isError, mutate: mutateTask } = useTask(taskId);
  const { t, language } = useTranslation();
  
  const editorState = useEditorState({ taskId, task, isError, mutateTask, t });
  const {
    phase,
    finalContent,
    revisedContent,
    critiques,
    overallScore,
    overallComment,
    panelOpen, setPanelOpen,
    sidebarTab, setSidebarTab,
    traceEvents,
    setActiveQuote,
    activeCritiqueIndex, setActiveCritiqueIndex,
    showDiff, setShowDiff,
    acceptedIndices,
    activeTocId,
    editorScrollRef,
    editorRef,
    modifiedByUser,
    hasUserEdits,
    isRerunning,
    sourceCards,
    sourceCardsExpanded, setSourceCardsExpanded,
    isRegenerating,
    hideLangBanner, setHideLangBanner,
    saveStatus,
    startReview, isStreaming,
    editableTitle, handleTitleChange, handleTitleSave,
    toc, scrollToHeading,
    acceptSingle, undoSingle, acceptAll, dismissCritique, handleMarkComplete, revertTask,
    handleRegenerate, handleCritiqueModified, rerunReview, handleEditorContentChange,
    translateToCurrentLanguage,
    displayContent, pendingCount, modifiedCount, isEditable
  } = editorState;

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      <EditorHeader
        task={task}
        phase={phase}
        hasUserEdits={hasUserEdits}
        isRerunning={isRerunning}
        isRegenerating={isRegenerating}
        panelOpen={panelOpen}
        finalContent={finalContent}
        onRerunReview={rerunReview}
        onStartReview={startReview}
        onTogglePanel={() => setPanelOpen(!panelOpen)}
        onRevertTask={revertTask}
        onRegenerate={handleRegenerate}
        onMarkComplete={handleMarkComplete}
      />

      {/* ══ Main Area ══ */}
      
      {/* Translation Banner for Historical Mismatch */}
      {task && task.config?.language != null && task.config.language !== language && !hideLangBanner && (
        <EditorLanguageBanner
          title={t("editor.langMismatchTitle")}
          description={task.config.language === "en" ? t("editor.langMismatchDescEn") : t("editor.langMismatchDescZh")}
          actionLabel={t("editor.translateToCurrent")}
          disabled={phase === "writing" || phase === "reviewing"}
          onTranslate={() => translateToCurrentLanguage(language)}
          onDismiss={() => setHideLangBanner(true)}
        />
      )}

      <div className="flex-1 flex overflow-hidden px-4 pb-0 gap-0 mt-[1px]">
        <EditorOutlineSidebar
          task={task}
          editableTitle={editableTitle}
          language={language}
          saveStatus={saveStatus}
          activeTocId={activeTocId}
          toc={toc}
          onScrollToHeading={scrollToHeading}
          t={t}
        />

        {/* ── Unified Content Card: Article + Annotations ── */}
        <div className="flex-1 flex overflow-hidden bg-[var(--card)] rounded-t-xl shadow-sm border-t border-x border-[var(--card-border)]">

          {/* Article pane */}
          <div
            ref={editorScrollRef}
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
            <div className="max-w-[680px] mx-auto px-10 md:px-14 pt-12 pb-32">
              {/* ── Editable Article title ── */}
              <input
                type="text"
                value={editableTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                placeholder={t('editor.titlePlaceholder')}
                className="w-full text-[28px] font-bold leading-tight text-foreground mb-6 tracking-tight bg-transparent border-none outline-none placeholder:text-muted-foreground/30 focus:ring-0"
              />

              {/* ── Source cards (collapsible) ── */}
              <SourceCardsPanel
                sourceCards={sourceCards}
                sourceCardsExpanded={sourceCardsExpanded}
                setSourceCardsExpanded={setSourceCardsExpanded}
              />
              {(phase === "idle" || phase === "tooling") && (
                <div className="flex items-center justify-center py-32">
                  <div className="text-center">
                    <div className="w-5 h-5 border-[1.5px] border-muted-foreground/20 border-t-foreground rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-[13px] text-muted-foreground">
                      {phase === "tooling" ? "Running plugin tools..." : t('editor.preparing')}
                    </p>
                  </div>
                </div>
              )}
              {phase === "failed" && (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <p className="text-[14px] font-medium text-foreground mb-1">{t('editor.failedTitle', '生成异常阻断')}</p>
                  <p className="text-[13px] text-muted-foreground mb-6 max-w-[280px] text-center">{t('editor.failedDesc', '后台排队、接口限流或任务处理超时。您可以重新触发流水线。')}</p>
                  <Button onClick={() => handleRegenerate()} disabled={isRegenerating} className="gap-2 bg-foreground text-background shadow-lg hover:bg-foreground/90">
                    {isRegenerating ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    )}
                    {t('editor.regenerate')}
                  </Button>
                </div>
              )}
              {phase === "reviewing" && !critiques.length && (
                <div className="mb-6 flex items-center gap-2 text-[13px] text-muted-foreground">
                  <div className="w-3.5 h-3.5 border-[1.5px] border-muted-foreground/30 border-t-foreground/60 rounded-full animate-spin" />
                  {t('editor.reviewingDraft')}
                </div>
              )}
              {showDiff && revisedContent ? (
                <DiffView original={finalContent} revised={revisedContent} />
              ) : (
                <div className={cn(isStreaming && "typewriter-cursor")}>
                  <TipTapEditor
                    ref={editorRef}
                    content={displayContent}
                    editable={isEditable}
                    taskId={taskId}
                    critiques={panelOpen ? critiques.filter((_, i) => !acceptedIndices.has(i)) : []}
                    activeCritiqueIndex={activeCritiqueIndex}
                    onCritiqueModified={handleCritiqueModified}
                    onUpdate={handleEditorContentChange}
                  />
                </div>
              )}
            </div>
          </div>

          <EditorSidebar
            panelOpen={panelOpen}
            setPanelOpen={setPanelOpen}
            activeTab={sidebarTab}
            setActiveTab={setSidebarTab}
            traceEvents={traceEvents}
            critiques={critiques}
            overallScore={overallScore}
            overallComment={overallComment}
            hasUserEdits={hasUserEdits}
            phase={phase}
            modifiedCount={modifiedCount}
            pendingCount={pendingCount}
            isRerunning={isRerunning}
            showDiff={showDiff}
            setShowDiff={setShowDiff}
            revisedContent={revisedContent}
            acceptedIndices={acceptedIndices}
            modifiedByUser={modifiedByUser}
            activeCritiqueIndex={activeCritiqueIndex}
            onRerunReview={rerunReview}
            onAcceptAll={acceptAll}
            onAcceptSingle={acceptSingle}
            onUndoSingle={undoSingle}
            onDismissCritique={dismissCritique}
            onCritiqueClick={(index, quote) => {
              setActiveQuote(quote);
              setActiveCritiqueIndex(index);
              editorRef.current?.scrollToCritique(index);
            }}
          />
        </div>
      </div>
    </div>
  );
}
