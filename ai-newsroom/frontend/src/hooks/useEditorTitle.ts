import * as React from "react";
import { api, type Task } from "@/lib/api";
import { extractH1Title, TASK_LABELS } from "@/lib/markdown-utils";

interface UseEditorTitleParams {
  task?: Task;
  finalContent: string;
  mutateTask: () => Promise<unknown>;
  t: (key: string, fallback?: string) => string;
}

function getFallbackTitle(task: Task, t: (key: string, fallback?: string) => string) {
  if (task.title && task.title !== `Task: ${task.task_type}`) {
    return task.title;
  }

  const typeLabel = t(`vault.taskTypes.${task.task_type}`);
  return typeLabel !== `vault.taskTypes.${task.task_type}`
    ? typeLabel
    : (TASK_LABELS[task.task_type] ?? task.task_type);
}

export function useEditorTitle({ task, finalContent, mutateTask, t }: UseEditorTitleParams) {
  const [editableTitle, setEditableTitle] = React.useState("");
  const [userEditedTitle, setUserEditedTitle] = React.useState(false);

  React.useEffect(() => {
    if (!task || userEditedTitle) return;
    setEditableTitle(getFallbackTitle(task, t));
  }, [task, t, userEditedTitle]);

  React.useEffect(() => {
    if (!finalContent || !task || userEditedTitle) return;

    const extracted = extractH1Title(finalContent);
    if (extracted && extracted !== editableTitle) {
      setEditableTitle(extracted);
      api.updateTaskTitle(task.id, extracted).then(() => mutateTask()).catch(console.error);
    }
  }, [editableTitle, finalContent, mutateTask, task, userEditedTitle]);

  const handleTitleChange = React.useCallback((newTitle: string) => {
    setEditableTitle(newTitle);
    setUserEditedTitle(true);
  }, []);

  const handleTitleSave = React.useCallback(() => {
    if (!task) return;

    const trimmed = editableTitle.trim();
    if (!trimmed) {
      setEditableTitle(getFallbackTitle(task, t));
      return;
    }

    api.updateTaskTitle(task.id, trimmed).then(() => {
      mutateTask();
    }).catch(console.error);
  }, [editableTitle, mutateTask, task, t]);

  return {
    editableTitle,
    setEditableTitle,
    handleTitleChange,
    handleTitleSave,
    articleTitle: editableTitle || null,
  };
}
