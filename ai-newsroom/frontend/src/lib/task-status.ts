export const TASK_STATUS_VALUES = [
  "pending",
  "writing",
  "written",
  "reviewing",
  "completed",
  "failed",
] as const;

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];
export type TaskBoardStage = "pending" | "writing" | "reviewing" | "completed" | "failed";
export type TaskLibraryBucket = "drafts" | "finalized" | null;

const LEGACY_TASK_STATUS_ALIASES: Record<string, TaskStatus> = {
  draft_ready: "written",
  in_progress: "writing",
};

const TASK_STATUS_SET = new Set<string>(TASK_STATUS_VALUES);

export function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
  if (!status) {
    return "pending";
  }

  const normalized = status.trim().toLowerCase();
  if (normalized in LEGACY_TASK_STATUS_ALIASES) {
    return LEGACY_TASK_STATUS_ALIASES[normalized];
  }

  if (TASK_STATUS_SET.has(normalized)) {
    return normalized as TaskStatus;
  }

  return "pending";
}

export function getTaskBoardStage(status: string | null | undefined): TaskBoardStage {
  switch (normalizeTaskStatus(status)) {
    case "writing":
      return "writing";
    case "written":
    case "reviewing":
      return "reviewing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "pending":
    default:
      return "pending";
  }
}

export function getTaskLibraryBucket(status: string | null | undefined): TaskLibraryBucket {
  switch (normalizeTaskStatus(status)) {
    case "writing":
    case "written":
    case "reviewing":
      return "drafts";
    case "completed":
      return "finalized";
    default:
      return null;
  }
}

export function isTaskVisibleInLibrary(status: string | null | undefined) {
  return getTaskLibraryBucket(status) !== null;
}

export function isEditorRecoverableTaskStatus(status: string | null | undefined) {
  const normalized = normalizeTaskStatus(status);
  return (
    normalized === "writing" ||
    normalized === "written" ||
    normalized === "reviewing" ||
    normalized === "completed" ||
    normalized === "failed"
  );
}
