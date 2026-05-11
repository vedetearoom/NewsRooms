import type { Critique, Draft, Task } from "@/lib/api";
import { normalizeTaskStatus } from "@/lib/task-status";

export interface TocItem {
  id: string;
  level: number;
  text: string;
}

export interface EditorRecoveryState {
  finalContent: string;
  revisedContent: string;
  critiques: Critique["critiques"];
  overallScore: number | null;
  overallComment: string | null;
  panelOpen: boolean;
  phase: "failed" | "completed" | "reviewed" | "written" | "reconnect-review";
}

export function buildToc(content: string): TocItem[] {
  if (!content) {
    return [];
  }

  const htmlHeadings = Array.from(content.matchAll(/<h([123])[^>]*>(.*?)<\/h\1>/g));
  if (htmlHeadings.length > 0) {
    return htmlHeadings.map((match, index) => {
      const idMatch = match[0].match(/id="([^"]+)"/);
      return {
        id: idMatch ? idMatch[1] : `heading-${index}`,
        level: parseInt(match[1], 10),
        text: match[2].replace(/<[^>]+>/g, "").trim(),
      };
    });
  }

  return Array.from(content.matchAll(/^(#{1,3})\s+(.+)$/gm)).map((match, index) => ({
    id: `heading-${index}`,
    level: match[1].length,
    text: match[2].replace(/\*\*/g, "").trim(),
  }));
}

export function replaceCritiqueTarget(content: string, quote: string, suggestion: string) {
  if (content.includes(quote)) {
    return content.replace(quote, suggestion);
  }

  const escaped = quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexiblePattern = escaped.split(/\s+/).join("[^<]*(?:<[^>]+>[^<]*)*\\s+");

  try {
    return content.replace(new RegExp(flexiblePattern, "i"), suggestion);
  } catch {
    return content;
  }
}

export function reindexCritiqueSet(oldSet: Set<number>, removedIndex: number) {
  const next = new Set<number>();

  oldSet.forEach((index) => {
    if (index < removedIndex) {
      next.add(index);
    } else if (index > removedIndex) {
      next.add(index - 1);
    }
  });

  return next;
}

export function stripCritiqueMarks(html: string) {
  return html.replace(
    /<span[^>]*data-critique-mark[^>]*>([\s\S]*?)<\/span>/gi,
    "$1",
  );
}

export function deriveEditorRecoveryState(task: Task, draft: Draft | null, critique: Critique | null): EditorRecoveryState {
  const finalContent = draft?.content || "";
  const revisedContent = draft?.revised_content || "";
  const critiques = critique?.critiques || [];
  const overallScore = critique?.overall_score ?? null;
  const overallComment = critique?.overall_comment ?? null;
  const panelOpen = Boolean(critique);
  const taskStatus = normalizeTaskStatus(task.status);

  if (taskStatus === "failed") {
    return { finalContent, revisedContent, critiques, overallScore, overallComment, panelOpen: false, phase: "failed" };
  }

  if (taskStatus === "completed") {
    return { finalContent, revisedContent, critiques, overallScore, overallComment, panelOpen: false, phase: "completed" };
  }

  if (taskStatus === "reviewing" && !critique) {
    return { finalContent, revisedContent, critiques, overallScore, overallComment, panelOpen: false, phase: "reconnect-review" };
  }

  if (taskStatus === "reviewing") {
    return { finalContent, revisedContent, critiques, overallScore, overallComment, panelOpen, phase: "reviewed" };
  }

  return {
    finalContent,
    revisedContent,
    critiques,
    overallScore,
    overallComment,
    panelOpen,
    phase: critique || draft?.revised_content ? "reviewed" : "written",
  };
}
