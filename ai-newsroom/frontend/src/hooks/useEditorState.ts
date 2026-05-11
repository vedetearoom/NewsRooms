import * as React from "react";
import { useRouter } from "next/navigation";
import { api, type AgentRunEvent, type CritiqueItem, type IntelligenceCard, type Task } from "@/lib/api";
import { useAgentStream } from "@/hooks/useAgentStream";
import { markdownToHtml } from "@/lib/markdown-utils";
import { type TipTapEditorHandle } from "@/components/editor/tiptap-editor";
import { buildToc, deriveEditorRecoveryState, replaceCritiqueTarget, reindexCritiqueSet, stripCritiqueMarks } from "@/lib/editor-state-utils";
import { deleteManagedImages, extractManagedImageUrls, syncManagedImages } from "@/lib/editor-image-utils";
import { useEditorTitle } from "@/hooks/useEditorTitle";
import { isEditorRecoverableTaskStatus, normalizeTaskStatus } from "@/lib/task-status";
import { getEditorPhaseState, type EditorPhase } from "@/lib/editor-phase";
import { showEditorTranslationStartFailedToast } from "@/lib/async-feedback";

export interface EditorStateParams {
  taskId: number;
  task?: Task;
  isError?: unknown;
  mutateTask: () => Promise<unknown>;
  t: (key: string, fallback?: string) => string;
}

declare global {
  interface Window {
    __tiptapResetModified?: () => void;
  }
}

export function useEditorState({ taskId, task, isError, mutateTask, t }: EditorStateParams) {
  const router = useRouter();
  
  const [phase, setPhase] = React.useState<EditorPhase>("idle");
  const [streamContent, setStreamContent] = React.useState("");
  const [finalContent, setFinalContent] = React.useState("");
  const [revisedContent, setRevisedContent] = React.useState("");
  const [critiques, setCritiques] = React.useState<CritiqueItem[]>([]);
  const [overallScore, setOverallScore] = React.useState<number | null>(null);
  const [overallComment, setOverallComment] = React.useState<string | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [sidebarTab, setSidebarTab] = React.useState<"review" | "trace">("review");
  const [activeQuote, setActiveQuote] = React.useState<string | null>(null);
  const [activeCritiqueIndex, setActiveCritiqueIndex] = React.useState<number | null>(null);
  const [showDiff, setShowDiff] = React.useState(false);
  const [acceptedIndices, setAcceptedIndices] = React.useState<Set<number>>(new Set());
  const [activeTocId, setActiveTocId] = React.useState<string | null>(null);
  const [traceEvents, setTraceEvents] = React.useState<AgentRunEvent[]>([]);
  
  // Backup of content before each single-accept, for undo
  const [contentBeforeAccept, setContentBeforeAccept] = React.useState<Map<number, string>>(new Map());
  const editorScrollRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<TipTapEditorHandle>(null);
  const knownImagesRef = React.useRef<Set<string>>(new Set());

  // ── New state for inline editing ──
  const [modifiedByUser, setModifiedByUser] = React.useState<Set<number>>(new Set());
  const [hasUserEdits, setHasUserEdits] = React.useState(false);
  const [isRerunning, setIsRerunning] = React.useState(false);
  // ── Source cards (intelligence cards this report is based on) ──
  const [sourceCards, setSourceCards] = React.useState<IntelligenceCard[]>([]);
  const [sourceCardsExpanded, setSourceCardsExpanded] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [hideLangBanner, setHideLangBanner] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"saving" | "saved" | "error" | null>(null);

  const appendTraceEvent = React.useCallback((event: AgentRunEvent) => {
    setTraceEvents((prev) => {
      const exists = prev.some(
        (item) =>
          item.job_id === event.job_id &&
          item.run_id === event.run_id &&
          item.seq === event.seq &&
          item.event_type === event.event_type,
      );
      if (exists) return prev;
      return [...prev, event].sort((a, b) => {
        const seqDiff = (a.seq || 0) - (b.seq || 0);
        if (seqDiff !== 0) return seqDiff;
        return (a.created_at || "").localeCompare(b.created_at || "");
      });
    });
  }, []);

  const clearTraceState = React.useCallback(() => {
    setTraceEvents([]);
    setSidebarTab("trace");
  }, []);

  const { startWriting, startReview, isStreaming } = useAgentStream({
    taskId,
    t,
    onPhaseChange: (p) => {
      setPhase(p);
      // Open sidebar immediately when review begins so user sees progress
      if (p === "reviewing") {
        setPanelOpen(true);
        setSidebarTab("review");
      }
      if (p === "tooling") {
        setPanelOpen(true);
        setSidebarTab("trace");
      }
    },
    onContentChange: (content, isFinal) => {
      setStreamContent(content);
      if (isFinal) setFinalContent(content);
    },
    onToolEvent: appendTraceEvent,
    onCritiqueReady: (crts, score, comment, revised) => {
      setCritiques(crts);
      setOverallScore(score);
      setOverallComment(comment);
      setRevisedContent(revised);
    }
  });

  React.useEffect(() => {
    if (isError instanceof Error && isError.message.includes("404")) {
      router.push("/vault");
    }
  }, [isError, router]);

  React.useEffect(() => {
    if (!task) return;
    if (task.card_ids?.length && sourceCards.length === 0) {
      api.getCardsByIds(task.card_ids).then(setSourceCards).catch(console.error);
    }
  }, [task, sourceCards.length]);

  React.useEffect(() => {
    const taskStatus = normalizeTaskStatus(task?.status);
    if (!task || taskStatus === "pending") return;

    api.getTaskExecutionLog(taskId)
      .then((events) => {
        setTraceEvents(events);
        if (events.length > 0 && taskStatus !== "completed") {
          setPanelOpen(true);
        }
      })
      .catch(() => {
        // Best-effort trace hydration only.
      });
  }, [task, taskId]);

  React.useEffect(() => {
    const taskStatus = normalizeTaskStatus(task?.status);

    if (task && phase === "idle" && taskStatus === "pending") {
      clearTraceState();
      startWriting();
    } else if (task && phase === "idle" && isEditorRecoverableTaskStatus(taskStatus)) {
      Promise.all([api.getDraft(taskId), api.getCritique(taskId)]).then(([draft, critique]) => {
        const recovered = deriveEditorRecoveryState(task, draft, critique);
        setFinalContent(recovered.finalContent);
        setRevisedContent(recovered.revisedContent);
        setCritiques(recovered.critiques);
        setOverallScore(recovered.overallScore);
        setOverallComment(recovered.overallComment);
        setPanelOpen(recovered.panelOpen);

        if (recovered.phase === "reconnect-review") {
          startReview(undefined, true);
        } else {
          setPhase(recovered.phase);
        }
      });
    }
  }, [clearTraceState, phase, startReview, startWriting, task, taskId]);

  const clearReviewState = React.useCallback(() => {
    setCritiques([]);
    setOverallScore(null);
    setOverallComment(null);
    setRevisedContent("");
    setShowDiff(false);
    setAcceptedIndices(new Set());
    setContentBeforeAccept(new Map());
    setModifiedByUser(new Set());
    setHasUserEdits(false);
    setActiveCritiqueIndex(null);
    setActiveQuote(null);
  }, []);

  // ── Auto-save draft content ──
  React.useEffect(() => {
    if (!hasUserEdits || !finalContent || isStreaming || isRegenerating || taskId <= 0) return;
    
    setSaveStatus("saving");
    // Debounce save for 1.5s to avoid overwhelming the backend on rapid keystrokes/paste
    const timer = setTimeout(() => {
      api.updateDraft(taskId, finalContent)
        .then(() => setSaveStatus("saved"))
        .catch(e => {
          console.error("Auto-save failed:", e);
          setSaveStatus("error");
        });
    }, 1500);

    return () => clearTimeout(timer);
  }, [finalContent, hasUserEdits, isStreaming, isRegenerating, taskId]);

  // ── Re-run review after user edits ──
  const rerunReview = React.useCallback(async (agentId?: number) => {
    setIsRerunning(true);
    try {
      // Save current content to backend
      await api.updateDraft(taskId, finalContent);

      // Reset critique-related state
      clearReviewState();

      // Reset the editor's internal mark tracking
      if (window.__tiptapResetModified) {
        window.__tiptapResetModified();
      }

      // Trigger a new review
      startReview(agentId);
    } catch (e) {
      console.error("Failed to save draft for re-review:", e);
    } finally {
      setIsRerunning(false);
    }
  }, [clearReviewState, finalContent, startReview, taskId]);

  // ── Regenerate: reset task to pending and re-stream ──
  const handleRegenerate = React.useCallback(async (agentId?: number) => {
    if (isRegenerating || isStreaming) return;
    setIsRegenerating(true);
    try {
      deleteManagedImages(extractManagedImageUrls(finalContent));
      knownImagesRef.current.clear();

      // Reset all content state
      setStreamContent("");
      setFinalContent("");
      setPanelOpen(false);
      clearReviewState();
      clearTraceState();

      // Reset task lifecycle on backend then re-stream
      await api.regenerateTask(taskId, agentId);
      await mutateTask();
      startWriting();
    } catch (e) {
      console.error("Failed to regenerate:", e);
    } finally {
      setIsRegenerating(false);
    }
  }, [clearReviewState, clearTraceState, isRegenerating, isStreaming, taskId, mutateTask, startWriting, finalContent]);

  // ── Handle critique modification callback from TipTap ──
  const handleCritiqueModified = React.useCallback((indices: Set<number>) => {
    setModifiedByUser(new Set(indices));
    if (indices.size > 0) setHasUserEdits(true);
  }, []);

  const handleEditorContentChange = React.useCallback((html: string) => {
    const currentImages = extractManagedImageUrls(html);
    if (knownImagesRef.current.size > 0) {
      knownImagesRef.current = syncManagedImages(knownImagesRef.current, currentImages);
    } else {
      knownImagesRef.current = currentImages;
    }

    setFinalContent(html);
    setHasUserEdits(true);
  }, []);

  const translateToCurrentLanguage = React.useCallback(async (language: string) => {
    if (!task) return;
    try {
      await api.translateTask(task.id, language);
      setPhase("idle");
      await mutateTask();
    } catch {
      showEditorTranslationStartFailedToast(t);
    }
  }, [mutateTask, task, t]);

  const { editableTitle, setEditableTitle, handleTitleChange, handleTitleSave, articleTitle } = useEditorTitle({
    task,
    finalContent,
    mutateTask,
    t,
  });

  const toc = React.useMemo(() => {
    return buildToc(finalContent);
  }, [finalContent]);

  // ── Track active heading on scroll ──
  React.useEffect(() => {
    const container = editorScrollRef.current;
    if (!container || toc.length === 0) return;
    const handleScroll = () => {
      let current: string | null = null;
      for (const item of toc) {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150) current = item.id;
        }
      }
      setActiveTocId(current);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [toc]);

  const scrollToHeading = (id: string) => {
    // Use imperative handle for precise in-container scroll
    if (editorRef.current) {
      editorRef.current.scrollToHeading(id);
    } else {
      // Fallback
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // ── Accept single critique: replace target_quote with suggestion in content ──
  const acceptSingle = (index: number) => {
    const critique = critiques[index];
    if (!critique) return;

    // Save current content for undo
    setContentBeforeAccept((prev) => {
      const next = new Map(prev);
      next.set(index, finalContent);
      return next;
    });

    const updatedContent = replaceCritiqueTarget(finalContent, critique.target_quote, critique.suggestion);

    setFinalContent(updatedContent);
    setAcceptedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  // ── Undo single critique: revert content ──
  const undoSingle = (index: number) => {
    const savedContent = contentBeforeAccept.get(index);
    if (savedContent) {
      setFinalContent(savedContent);
      setContentBeforeAccept((prev) => {
        const next = new Map(prev);
        next.delete(index);
        return next;
      });
    }
    setAcceptedIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const acceptAll = async () => {
    // Apply revised content if available, but DON'T change phase
    if (revisedContent) {
      setFinalContent(revisedContent);
    }
    // Mark all critiques as accepted visually
    setAcceptedIndices(new Set(critiques.map((_, i) => i)));
    setShowDiff(false);
    // Save current content to DB
    try {
      await api.updateDraft(taskId, revisedContent || finalContent);
    } catch (e) {
      console.error("Failed to save after accept all:", e);
    }
  };

  const dismissCritique = (index: number) => {
    // Remove the critique from the array
    const newCritiques = critiques.filter((_, i) => i !== index);
    setCritiques(newCritiques);

    setAcceptedIndices(reindexCritiqueSet(acceptedIndices, index));
    setModifiedByUser(reindexCritiqueSet(modifiedByUser, index));

    // Clear active critique if it was the dismissed one
    if (activeCritiqueIndex === index) {
      setActiveCritiqueIndex(null);
      setActiveQuote(null);
    } else if (activeCritiqueIndex !== null && activeCritiqueIndex > index) {
      setActiveCritiqueIndex(activeCritiqueIndex - 1);
    }
  };

  const handleMarkComplete = React.useCallback(async () => {
    try {
      const cleanHtml = stripCritiqueMarks(finalContent);
      
      await api.updateDraft(taskId, cleanHtml);
      await api.acceptDraft(taskId);
      
      // Update local state
      setFinalContent(cleanHtml);
      setPhase("completed");
      setPanelOpen(false);
      clearReviewState();
      await mutateTask();
    } catch (e) {
      console.error("Failed to mark complete:", e);
    }
  }, [clearReviewState, finalContent, mutateTask, taskId]);

  const revertTask = React.useCallback(async () => {
    try {
      await api.revertTask(taskId);
      // Enter clean 'written' phase — no critiques, no panel
      setPhase("written");
      setPanelOpen(false);
      clearReviewState();
      mutateTask();
    } catch (e) {
      console.error("Failed to revert task:", e);
    }
  }, [clearReviewState, mutateTask, taskId]);

  const displayContent = React.useMemo(() => {
    const raw = isStreaming ? streamContent : finalContent;
    if (raw.trim().startsWith("<p>") || raw.trim().startsWith("<h")) return raw;
    return markdownToHtml(raw);
  }, [isStreaming, streamContent, finalContent]);

  const highlightQuotes = React.useMemo(() => {
    // Only highlight non-accepted critiques
    return critiques
      .filter((_, i) => !acceptedIndices.has(i))
      .map((c) => c.target_quote);
  }, [critiques, acceptedIndices]);

  const pendingCount = critiques.length - acceptedIndices.size - modifiedByUser.size;
  const modifiedCount = modifiedByUser.size;

  // Is the editor editable? Now includes "reviewed" phase for inline editing
  const isEditable = getEditorPhaseState(phase).isEditable;

  return {
    phase, setPhase,
    streamContent, setStreamContent,
    finalContent, setFinalContent,
    revisedContent, setRevisedContent,
    critiques, setCritiques,
    overallScore, setOverallScore,
    overallComment, setOverallComment,
    panelOpen, setPanelOpen,
    sidebarTab, setSidebarTab,
    traceEvents, setTraceEvents,
    activeQuote, setActiveQuote,
    activeCritiqueIndex, setActiveCritiqueIndex,
    showDiff, setShowDiff,
    acceptedIndices, setAcceptedIndices,
    activeTocId, setActiveTocId,
    contentBeforeAccept, setContentBeforeAccept,
    editorScrollRef,
    editorRef,
    knownImagesRef,
    modifiedByUser, setModifiedByUser,
    hasUserEdits, setHasUserEdits,
    isRerunning, setIsRerunning,
    sourceCards, setSourceCards,
    sourceCardsExpanded, setSourceCardsExpanded,
    isRegenerating, setIsRegenerating,
    hideLangBanner, setHideLangBanner,
    saveStatus, setSaveStatus,
    startWriting, startReview, isStreaming,
    editableTitle, setEditableTitle, handleTitleChange, handleTitleSave, articleTitle,
    toc, scrollToHeading,
    acceptSingle, undoSingle, acceptAll, dismissCritique, handleMarkComplete, revertTask,
    handleRegenerate, handleCritiqueModified, rerunReview,
    handleEditorContentChange, translateToCurrentLanguage,
    displayContent, highlightQuotes, pendingCount, modifiedCount, isEditable
  };
}
