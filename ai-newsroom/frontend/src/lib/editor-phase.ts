export type EditorPhase =
  | "idle"
  | "tooling"
  | "writing"
  | "written"
  | "reviewing"
  | "reviewed"
  | "diff"
  | "completed"
  | "failed";

interface EditorPhaseOptions {
  hasUserEdits?: boolean;
  isRegenerating?: boolean;
  isRerunning?: boolean;
}

export function getEditorPhaseState(
  phase: EditorPhase,
  options: EditorPhaseOptions = {},
) {
  const isReviewProcessing = phase === "reviewing" || Boolean(options.isRerunning);
  const isTooling = phase === "tooling";
  const anyProcessing = Boolean(options.isRegenerating) || isReviewProcessing || isTooling;
  const isEditable = phase === "written" || phase === "reviewed";

  return {
    isTooling,
    isReviewProcessing,
    anyProcessing,
    isEditable,
    canRegenerate:
      (phase === "written" || phase === "reviewed" || Boolean(options.isRegenerating)) &&
      !isReviewProcessing,
    canStartReview: phase === "written" && !isReviewProcessing,
    canMarkComplete: isEditable && !anyProcessing,
    canTogglePanel: phase === "reviewed" || phase === "written" || phase === "tooling",
    canShowRerunBanner: phase === "reviewed" && Boolean(options.hasUserEdits),
    canShowReviewActions: phase === "written" || phase === "reviewed",
    canEditCritiques: phase === "written" || phase === "reviewed",
    isCompleted: phase === "completed",
  };
}
