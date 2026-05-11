/**
 * AI image generation utilities for the TipTap editor.
 *
 * Module-level pending image generation tracker that survives
 * component unmounts. When the API returns after the user
 * navigated away, it patches the DB draft directly so the image
 * appears when the editor reloads.
 */

import { api } from "@/lib/api";

export const SKELETON_SVG = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjNmNGY2Ii8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlNWU3ZWIiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmM2Y0ZjYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjlmYWZiIiByeD0iMTAiLz48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIiByeD0iMTAiIG9wYWNpdHk9IjAuNSIvPjxjaXJjbGUgY3g9IjQwMCIgY3k9IjE3MCIgcj0iMjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2QxZDVkYiIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1kYXNoYXJyYXk9IjE2IDgiIG9wYWNpdHk9IjAuNyIvPjxyZWN0IHg9IjMwMCIgeT0iMjIwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwIiByeD0iNSIgZmlsbD0iI2U1ZTdlYiIvPjxyZWN0IHg9IjMzMCIgeT0iMjQ0IiB3aWR0aD0iMTQwIiBoZWlnaHQ9IjgiIHJ4PSI0IiBmaWxsPSIjZTVlN2ViIiBvcGFjaXR5PSIwLjYiLz48L3N2Zz4K";

export const SKELETON_REGEX = new RegExp(`<img[^>]*src=["']${SKELETON_SVG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*/?>`);

export interface PendingGeneration {
  promise: Promise<void>;
  /** Called if the editor is still alive when the API returns */
  onEditorUpdate?: (imageUrl: string, errorCode?: string) => void;
}

export const pendingImageGenerations = new Map<number, PendingGeneration>();

export function fireImageGeneration(
  taskId: number,
  prompt: string,
  aspectRatio: string,
  onEditorUpdate?: (imageUrl: string, errorCode?: string) => void,
) {
  // Store the callback so the component can attach/detach it
  const entry: PendingGeneration = { promise: Promise.resolve(), onEditorUpdate };

  entry.promise = api.generateImage(prompt, aspectRatio)
    .then(async (res) => {
      // 1. Always persist to DB (survives unmount)
      try {
        const draft = await api.getDraft(taskId);
        if (draft) {
          const imageHtml = `<img src="${res.url}" alt="AI Generated Image" />`;
          const content = draft.content || "";
          const updated = content.includes(res.url)
            ? content
            : content.includes(SKELETON_SVG)
              ? content.replace(SKELETON_REGEX, imageHtml)
              : `${content}${content ? "\n" : ""}<p>${imageHtml}</p>`;
          if (updated !== content) {
            await api.updateDraft(taskId, updated);
          }
        }
      } catch { /* ignore */ }
      // 2. If editor is still alive, update DOM directly for instant feedback
      try {
        entry.onEditorUpdate?.(res.url);
      } catch { /* ignore */ }
    })
    .catch(async (err) => {
      // Clean up skeleton from DB on failure
      try {
        const draft = await api.getDraft(taskId);
        if (draft?.content && draft.content.includes(SKELETON_SVG)) {
          const cleaned = draft.content.replace(SKELETON_REGEX, '');
          await api.updateDraft(taskId, cleaned);
        }
      } catch { /* ignore */ }
      // If editor is still alive, notify with empty string to trigger cleanup
      entry.onEditorUpdate?.('', err instanceof Error ? err.message : undefined);
    })
    .finally(() => {
      pendingImageGenerations.delete(taskId);
    });

  pendingImageGenerations.set(taskId, entry);
  return entry;
}
