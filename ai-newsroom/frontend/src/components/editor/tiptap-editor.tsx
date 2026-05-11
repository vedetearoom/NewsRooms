"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { api, type CritiqueItem } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";

// Extracted modules
import { CritiqueMark, HeadingWithId, SelectionPersist } from "./tiptap-extensions";
import {
  SKELETON_SVG,
  SKELETON_REGEX,
  pendingImageGenerations,
  fireImageGeneration,
} from "./image-generation";
import { TipTapBubbleMenuContent } from "./tiptap-bubble-menu-content";
import { handleEditorDrop, handleEditorPaste } from "./tiptap-image-handlers";
import { applyCritiqueMarks, applyLegacyHighlightQuotes, detectModifiedCritiqueMarks } from "./tiptap-critique-utils";
import {
  showEditorImageGenerationErrorToast,
  showEditorImageGenerationSuccessToast,
} from "@/lib/async-feedback";

declare global {
  interface Window {
    __tiptapResetModified?: () => void;
  }
}

/* ── Imperative handle exposed via forwardRef ───────────────── */
export interface TipTapEditorHandle {
  /** Scroll to the heading element with the given id */
  scrollToHeading: (id: string) => void;
  /** Scroll to the critique mark with the given index */
  scrollToCritique: (index: number) => void;
}

/* ── Props ──────────────────────────────────────────────────── */
interface TipTapEditorProps {
  content: string;
  editable?: boolean;
  onUpdate?: (content: string) => void;
  /** Task ID — needed for persisting image generation results to DB */
  taskId?: number;
  /** Full critiques array — used to apply inline marks */
  critiques?: CritiqueItem[];
  /** Index of the currently selected critique card */
  activeCritiqueIndex?: number | null;
  /** Fired whenever user edits text inside a critique mark */
  onCritiqueModified?: (modifiedIndices: Set<number>) => void;
  /** Legacy: plain highlight quotes (for backward compat during streaming) */
  highlightQuotes?: string[];
  className?: string;
}

export const TipTapEditor = React.forwardRef<TipTapEditorHandle, TipTapEditorProps>(
  function TipTapEditor(
    {
      content,
      editable = true,
      onUpdate,
      taskId,
      critiques = [],
      activeCritiqueIndex = null,
      onCritiqueModified,
      highlightQuotes = [],
      className = "",
    },
    ref
  ) {
  const { t } = useTranslation();
  // Track which critique indices have been modified by the user
  const modifiedRef = React.useRef<Set<number>>(new Set());
  // Suppress onChange mark-check while we're programmatically applying marks
  const applyingMarksRef = React.useRef(false);
  // Track if critique marks have been applied for the current critiques
  const appliedCritiquesRef = React.useRef<string>("");
  // Guard: don't overwrite content while the user is actively typing
  const isUserEditingRef = React.useRef(false);

  // -- Inline AI rewrite state --
  const [rewriteInput, setRewriteInput] = React.useState("");
  const [isRewriting, setIsRewriting] = React.useState(false);
  const [rewritePreview, setRewritePreview] = React.useState<string | null>(null);
  const [selectedLength, setSelectedLength] = React.useState(0);
  const [imageRatio, setImageRatio] = React.useState("16:9");
  
  // -- Inline Image Generation --
  // We utilize closures to allow multiple concurrent image generations from different selections.

  const handleGenerateImage = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText) return;
    if (!taskId || taskId <= 0) return; // Need taskId for persistence

    const startTime = Date.now();

    // Deselect so BubbleMenu disappears
    editor.commands.setTextSelection(to);

    // Insert skeleton placeholder into editor — it WILL be saved to DB
    // by the autosave mechanism, giving the background worker a marker
    editor.chain().focus().insertContent(`<p><img src="${SKELETON_SVG}" alt="generating..." /></p><p></p>`).run();

    // Fire a SINGLE API call at module level that survives unmount.
    // The callback updates the live editor DOM if still mounted.
    fireImageGeneration(taskId, selectedText, imageRatio, (imageUrl, errorCode) => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      if (!imageUrl) {
        // Generation failed — clean up skeleton from editor DOM
        if (!editor || editor.isDestroyed) return;
        const positionsToDelete: number[] = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'image' && node.attrs.src === SKELETON_SVG) {
            positionsToDelete.push(pos);
          }
        });
        for (const pos of positionsToDelete.reverse()) {
          editor.commands.command(({ tr, dispatch }) => {
            const node = tr.doc.nodeAt(pos);
            if (node && dispatch) tr.delete(pos, pos + node.nodeSize);
            return true;
          });
        }
        showEditorImageGenerationErrorToast(elapsed, t, errorCode);
        return;
      }

      // Success — replace skeleton with real image in editor DOM
      if (!editor || editor.isDestroyed) return;
      let found = false;
      editor.state.doc.descendants((node, pos) => {
        if (!found && node.type.name === 'image' && node.attrs.src === SKELETON_SVG) {
          editor.commands.command(({ tr, dispatch }) => {
            if (dispatch) {
              tr.setNodeMarkup(pos, null, { ...node.attrs, src: imageUrl, alt: 'AI Generated Image' });
            }
            return true;
          });
          found = true;
        }
      });

      if (!found) {
        editor.chain().focus().insertContent(`<p><img src="${imageUrl}" /></p>`).run();
      }

      showEditorImageGenerationSuccessToast(elapsed, t);
    });
  };

  // On unmount: detach the live-editor callback but let the background
  // generation continue — it will persist to DB independently.
  React.useEffect(() => {
    return () => {
      if (taskId && pendingImageGenerations.has(taskId)) {
        const entry = pendingImageGenerations.get(taskId)!;
        entry.onEditorUpdate = undefined; // detach editor callback
      }
    };
  }, [taskId]);

  const handleRewrite = async () => {
    if (!editor || !rewriteInput.trim()) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText) return;
    
    setIsRewriting(true);
    try {
      const res = await api.rewriteText(selectedText, rewriteInput);
      setRewritePreview(res.rewritten_text);
    } catch(e) {
      console.error("Rewrite failed:", e);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleRewriteReplace = () => {
    if (!editor || !rewritePreview) return;
    editor.chain().focus().insertContent(rewritePreview).run();
    setRewritePreview(null);
    setRewriteInput("");
  };

  const handleRewriteDiscard = () => {
    setRewritePreview(null);
    setRewriteInput("");
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable built-in heading — we use HeadingWithId below
        heading: false,
      }),
      HeadingWithId,
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: { class: "highlight" },
      }),
      SelectionPersist,
      CritiqueMark,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: "Your draft will appear here...",
      }),
    ],
    content: (() => {
      const raw = content || "";
      // Only strip skeletons on init if there's NO active generation for this task
      if (taskId && pendingImageGenerations.has(taskId)) return raw;
      return raw.replace(SKELETON_REGEX, '');
    })(),
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Let skeleton persist in saved content — the background worker needs it as a marker.
      // It will be replaced by the real image URL when generation completes.

      // Mark that user is editing so external content sync won't clobber them
      isUserEditingRef.current = true;
      onUpdate?.(html);

      // Skip checking marks if we're in the middle of applying them
      if (applyingMarksRef.current) return;

      // Check if any critique marks have been modified
      detectModifiedMarks(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      setSelectedLength(to - from);
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "ProseMirror custom-scrollbar",
      },
      // 🔮 Intercept paste: handle image files with optimistic upload
      handlePaste: (view, event) => handleEditorPaste(view, event),
      // 💡 Intercept drop: handle dragged image files
      handleDrop: (view, event, slice, moved) => handleEditorDrop(view, event, slice, moved),
    },
  });

  /* ── Detect modified critique marks ───────────────────────── */
  const detectModifiedMarks = React.useCallback(
    (ed: NonNullable<typeof editor>) => {
      const nextModified = detectModifiedCritiqueMarks(
        ed,
        critiques,
        appliedCritiquesRef.current,
        modifiedRef.current,
      );
      if (nextModified) {
        modifiedRef.current = nextModified;
        onCritiqueModified?.(new Set(nextModified));
      }
    },
    [critiques, onCritiqueModified]
  );

  /* ── Sync editable mode reactively ─────────────────────── */
  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable, false);
  }, [editor, editable]);

  /* ── Update content when it changes externally (streaming) ── */
  React.useEffect(() => {
    if (!editor) return;

    // If user is actively editing, the content prop is just an echo of what the
    // editor itself just emitted via onUpdate. Don't re-set it — that would reset
    // the cursor position and break typing.
    if (isUserEditingRef.current) {
      isUserEditingRef.current = false;
      return;
    }

    // Genuinely external content change (initial load, streaming, accept/undo).
    // Only update if content actually differs from what the editor currently has.
    const currentContent = editor.getHTML();
    // Allow empty string to clear the editor
    if (typeof content === "string" && content !== currentContent) {
      if (content === "") {
        // Clear explicitly
        editor.commands.clearContent(false);
      } else {
        applyingMarksRef.current = true;
        editor.commands.setContent(content, { emitUpdate: false });
        applyingMarksRef.current = false;
      }
    }
  }, [content, editor]);

  /* ── Apply critique marks when critiques change ─────────── */
  React.useEffect(() => {
    if (!editor) return;

    // Build a key from critiques to avoid re-applying on every render
    const critiquesKey = critiques.length === 0 ? "__empty__" : critiques.map((c) => c.target_quote).join("|||");
    if (appliedCritiquesRef.current === critiquesKey) return;

    // Wait a tick for editor content to settle
    const timeout = setTimeout(() => {
      applyingMarksRef.current = true;
      applyCritiqueMarks(editor, critiques);
      appliedCritiquesRef.current = critiquesKey;
      applyingMarksRef.current = false;
    }, 50);

    return () => clearTimeout(timeout);
  }, [critiques, editor]);

  /* ── Update active critique highlight ───────────────────── */
  React.useEffect(() => {
    if (!editor) return;

    // Update DOM classes for active critique
    const container = document.querySelector('.tiptap-editor');
    if (!container) return;

    // Remove all active classes
    container.querySelectorAll(".critique-mark-active").forEach((el) => {
      el.classList.remove("critique-mark-active");
    });

    // Add active class to current
    if (activeCritiqueIndex !== null && activeCritiqueIndex >= 0) {
      container
        .querySelectorAll(`[data-critique-index="${activeCritiqueIndex}"]`)
        .forEach((el) => {
          el.classList.add("critique-mark-active");
          scrollElIntoContainer(el as HTMLElement);
        });
    }
  }, [activeCritiqueIndex, editor]);

  /* ── Legacy: Apply simple highlights for streaming phase ── */
  React.useEffect(() => {
    if (!editor || highlightQuotes.length === 0 || critiques.length > 0) return;
    applyLegacyHighlightQuotes(editor, highlightQuotes);
  }, [highlightQuotes, editor, critiques]);

  /* ── Public method: reset modified tracking ─────────────── */
  // Exposed via a global callback so the parent can reset when re-running review
  React.useEffect(() => {
    window.__tiptapResetModified = () => {
      modifiedRef.current = new Set();
      appliedCritiquesRef.current = "";
    };
    return () => {
      delete window.__tiptapResetModified;
    };
  }, []);

  /* ── Expose imperative scroll methods to parent ─────────── */
  React.useImperativeHandle(ref, () => ({
    scrollToHeading(id: string) {
      const el = document.getElementById(id);
      if (el) scrollElIntoContainer(el);
    },
    scrollToCritique(index: number) {
      const container = document.querySelector('.tiptap-editor');
      if (!container) return;
      const el = container.querySelector(`[data-critique-index="${index}"]`) as HTMLElement | null;
      if (el) scrollElIntoContainer(el);
    },
  }), []);

  return (
    <div className={`tiptap-editor ${className}`}>
      {editor && (
        <BubbleMenu
          editor={editor}
          className="bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-white shadow-xl shadow-black/10 dark:shadow-black/30 rounded-xl border border-zinc-200 dark:border-white/10 p-1 flex flex-col overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 pointer-events-auto"
        >
          <TipTapBubbleMenuContent
            rewritePreview={rewritePreview}
            rewriteInput={rewriteInput}
            isRewriting={isRewriting}
            selectedLength={selectedLength}
            imageRatio={imageRatio}
            onRewriteInputChange={setRewriteInput}
            onRewrite={handleRewrite}
            onRewriteReplace={handleRewriteReplace}
            onRewriteDiscard={handleRewriteDiscard}
            onGenerateImage={handleGenerateImage}
            onImageRatioChange={setImageRatio}
          />
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
  }
);

/* ── Scroll helper: scroll element into nearest overflow container ──
   scrollIntoView() scrolls ALL ancestor containers including window.
   We find the nearest overflow-y:auto parent and use scrollTo()
   so only the article pane moves.
   ──────────────────────────────────────────────────────────────── */
function scrollElIntoContainer(el: HTMLElement) {
  let parent = el.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflow = style.overflowY;
    if (overflow === "auto" || overflow === "scroll") break;
    parent = parent.parentElement;
  }
  if (!parent) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const containerRect = parent.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const offset =
    elRect.top - containerRect.top + parent.scrollTop -
    containerRect.height / 2 + elRect.height / 2;
  parent.scrollTo({ top: offset, behavior: "smooth" });
}
