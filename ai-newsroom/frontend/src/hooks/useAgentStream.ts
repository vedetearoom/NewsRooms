import { useState, useCallback, useRef, useEffect } from "react";
import { api, CritiqueItem, type AgentRunEvent } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { EditorPhase } from "@/lib/editor-phase";
import {
  showEditorReviewConnectionToast,
  showEditorReviewTimeoutToast,
  showEditorWriteStreamErrorToast,
} from "@/lib/async-feedback";

interface UseAgentStreamProps {
  taskId: number;
  t: (key: string, fallback?: string) => string;
  onPhaseChange: (phase: EditorPhase) => void;
  onContentChange: (content: string, isFinal: boolean) => void;
  onToolEvent: (event: AgentRunEvent) => void;
  onCritiqueReady: (
    critiques: CritiqueItem[],
    score: number | null,
    comment: string | null,
    revisedContent: string
  ) => void;
}

interface StreamConnection {
  close: () => void;
}

interface StreamEventMessage {
  event: string;
  data: string;
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json() as { detail?: string | { message?: string }; message?: string };
      if (typeof payload.detail === "object" && payload.detail?.message) return payload.detail.message;
      if (typeof payload.detail === "string") return payload.detail;
      if (payload.message) return payload.message;
    } catch {
      // Fall through to text parsing.
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text) return text;
  } catch {
    // Ignore secondary parsing failures.
  }

  return `Request failed: ${response.status} ${response.statusText}`;
}

function parseStreamEvent(rawEvent: string): StreamEventMessage | null {
  const lines = rawEvent.split(/\r?\n/);
  let event = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event" && value) {
      event = value;
    } else if (field === "data") {
      data.push(value);
    }
  }

  if (!data.length) return null;
  return { event, data: data.join("\n") };
}

async function readEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEventMessage) => void,
  signal: AbortSignal
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const rawEvents = buffer.split(/\r?\n\r?\n/);
      buffer = rawEvents.pop() ?? "";

      for (const rawEvent of rawEvents) {
        const parsed = parseStreamEvent(rawEvent);
        if (parsed) onEvent(parsed);
      }
    }

    buffer += decoder.decode();
    const trailingEvent = parseStreamEvent(buffer);
    if (trailingEvent && !signal.aborted) {
      onEvent(trailingEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

function openAuthenticatedEventStream(
  url: string,
  handlers: {
    onEvent: (event: StreamEventMessage) => void;
    onClose?: () => void;
    onError: (error: Error) => void;
  }
): StreamConnection {
  const controller = new AbortController();

  void (async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      await readEventStream(response.body, handlers.onEvent, controller.signal);

      if (!controller.signal.aborted) {
        handlers.onClose?.();
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      handlers.onError(error instanceof Error ? error : new Error("Unknown stream error"));
    }
  })();

  return {
    close: () => controller.abort(),
  };
}

function parseEventData<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useAgentStream({
  taskId,
  t,
  onPhaseChange,
  onContentChange,
  onToolEvent,
  onCritiqueReady,
}: UseAgentStreamProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<StreamConnection | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startWriting = useCallback(() => {
    onPhaseChange("writing");
    setIsStreaming(true);
    
    eventSourceRef.current?.close();
    let streamEnded = false;

    // ── Smooth token drip buffer ──
    let serverAccumulated = "";
    let renderedLength = 0;
    let dripActive = false;
    let isDone = false;

    // Normal typing is ~2 chars per frame (120 chars/sec).
    // If the server sends a large chunk and we fall behind, speed up slightly.
    const CHARS_PER_FRAME = 2;     
    const CATCH_UP_CHARS = 8;     

    function dripLoop() {
      if (renderedLength >= serverAccumulated.length) {
        dripActive = false;
        if (isDone) {
          onContentChange(serverAccumulated, true);
        }
        return;
      }

      // Calculate step
      const behind = serverAccumulated.length - renderedLength;
      const step = behind > 100 ? CATCH_UP_CHARS : CHARS_PER_FRAME;
      
      // Advance exactly by `step` chars, no word snapping, for smooth typewriter feel
      renderedLength = Math.min(renderedLength + step, serverAccumulated.length);
      onContentChange(serverAccumulated.slice(0, renderedLength), false);

      requestAnimationFrame(dripLoop);
    }

    function startDrip() {
      if (!dripActive) {
        dripActive = true;
        requestAnimationFrame(dripLoop);
      }
    }

    const finalizeWriting = () => {
      isDone = true;
      streamEnded = true;
      eventSourceRef.current?.close();
      // If drip is still running, it will emit final when caught up.
      // If drip is idle, flush immediately.
      if (!dripActive) {
        renderedLength = serverAccumulated.length;
        onContentChange(serverAccumulated, true);
        onPhaseChange("written");
        setIsStreaming(false);
      } else {
        // Wait for drip to finish, then finalize
        const checkDone = () => {
          if (renderedLength >= serverAccumulated.length) {
            onPhaseChange("written");
            setIsStreaming(false);
          } else {
            requestAnimationFrame(checkDone);
          }
        };
        requestAnimationFrame(checkDone);
      }
    };

    const handleWriteError = (error: Error) => {
      const errorMsg = error.message || t("editor.writeStreamFailedDesc");
      console.error("Writer stream error:", error);
      showEditorWriteStreamErrorToast(errorMsg, t);
      isDone = true;
      streamEnded = true;
      if (serverAccumulated) {
        // Flush all remaining content immediately
        renderedLength = serverAccumulated.length;
        onContentChange(serverAccumulated, true);
        onPhaseChange("written"); 
      } else {
        onPhaseChange("failed");
      }
      setIsStreaming(false);
      eventSourceRef.current?.close();
    };

    eventSourceRef.current = openAuthenticatedEventStream(api.streamWriteUrl(taskId), {
      onEvent: ({ event, data }) => {
        if (event === "tooling_start") {
          const parsed = parseEventData<{ plugin_count?: number; writer_agent_id?: number }>(data);
          onPhaseChange("tooling");
          onToolEvent({
            job_id: `task-${taskId}`,
            run_id: `task-${taskId}`,
            phase: "plugin_prepare_write",
            event_type: "start",
            level: "info",
            message: `Starting plugin preparation (${parsed?.plugin_count || 0} plugin${(parsed?.plugin_count || 0) === 1 ? "" : "s"})`,
            payload_json: parsed || {},
            seq: 0,
            created_at: new Date().toISOString(),
          });
          return;
        }

        if (event === "tool_log" || event === "tool_artifact") {
          const parsed = parseEventData<{
            job_id?: string;
            run_id?: string;
            phase?: string;
            event_type?: string;
            level?: string;
            message?: string;
            payload?: Record<string, unknown>;
            seq?: number;
            created_at?: string | null;
          }>(data);
          if (parsed) {
            onToolEvent({
              job_id: parsed.job_id || `task-${taskId}`,
              run_id: parsed.run_id || `task-${taskId}`,
              phase: parsed.phase || "plugin_prepare_write",
              event_type: event === "tool_artifact" ? "artifact" : (parsed.event_type || "log"),
              level: parsed.level || "info",
              message: parsed.message || "",
              payload_json: parsed.payload || {},
              seq: parsed.seq ?? Date.now(),
              created_at: parsed.created_at || new Date().toISOString(),
            });
          }
          return;
        }

        if (event === "tooling_done") {
          const parsed = parseEventData<{ job_id?: string; run_id?: string; artifacts?: string[] }>(data);
          onToolEvent({
            job_id: parsed?.job_id || `task-${taskId}`,
            run_id: parsed?.run_id || `task-${taskId}`,
            phase: "plugin_prepare_write",
            event_type: "done",
            level: "info",
            message: "Plugin preparation finished",
            payload_json: parsed || {},
            seq: Date.now(),
            created_at: new Date().toISOString(),
          });
          onPhaseChange("writing");
          return;
        }

        if (event === "chunk") {
          const parsed = parseEventData<{ text?: string }>(data);
          serverAccumulated += parsed?.text || "";
          startDrip();
          return;
        }

        if (event === "done") {
          finalizeWriting();
          return;
        }

        if (event === "error") {
          const parsed = parseEventData<{ message?: string }>(data);
          handleWriteError(new Error(parsed?.message || t("editor.writeStreamFailedDesc")));
        }
      },
      onClose: () => {
        if (!streamEnded) {
          handleWriteError(new Error(t("editor.writeStreamFailedDesc")));
        }
      },
      onError: handleWriteError,
    });
  }, [taskId, onPhaseChange, onContentChange, onToolEvent, t]);

  const startReview = useCallback((agentId?: number, pollOnly?: boolean) => {
    // If not just polling, tell the UI it's reviewing
    onPhaseChange("reviewing");
    
    eventSourceRef.current?.close();
    let streamEnded = false;
    let currentCritiques: CritiqueItem[] = [];
    let currentScore: number | null = null;
    let currentComment: string | null = null;
    let docRevisedContent = "";
    let completed = false;

    // Timeout: if no response within 120s, treat as error
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!completed) {
        console.warn("Review stream timed out after 120s");
        showEditorReviewTimeoutToast(t);
        completed = true;
        streamEnded = true;
        onPhaseChange("written");
        eventSourceRef.current?.close();
      }
    }, 120_000);

    const handleReviewConnectionError = (error?: Error) => {
      if (completed) return;
      completed = true;
      streamEnded = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (error) {
        console.error("Assassin stream error:", error);
      }
      showEditorReviewConnectionToast(t);
      onPhaseChange("written"); 
      eventSourceRef.current?.close();
    };

    eventSourceRef.current = openAuthenticatedEventStream(api.streamReviewUrl(taskId, agentId, pollOnly), {
      onEvent: ({ event, data }) => {
        if (event === "start") {
          return;
        }

        if (event === "critique") {
          const parsed = parseEventData<{
            critiques?: CritiqueItem[];
            overall_score?: number | null;
            overall_comment?: string | null;
          }>(data);
          currentCritiques = parsed?.critiques || [];
          currentScore = parsed?.overall_score ?? null;
          currentComment = parsed?.overall_comment ?? null;
          onCritiqueReady(currentCritiques, currentScore, currentComment, docRevisedContent);
          return;
        }

        if (event === "revised") {
          const parsed = parseEventData<{ revised_content?: string }>(data);
          docRevisedContent = parsed?.revised_content || "";
          onCritiqueReady(currentCritiques, currentScore, currentComment, docRevisedContent);
          return;
        }

        if (event === "done") {
          completed = true;
          streamEnded = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          onPhaseChange("reviewed");
          eventSourceRef.current?.close();
          return;
        }

        if (event === "error") {
          const parsed = parseEventData<{ message?: string }>(data);
          const message = parsed?.message || "";
          if (message.toLowerCase().includes("timed out")) {
            if (completed) return;
            completed = true;
            streamEnded = true;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            showEditorReviewTimeoutToast(t);
            onPhaseChange("written");
            eventSourceRef.current?.close();
            return;
          }

          handleReviewConnectionError(new Error(message || "Review stream failed"));
        }
      },
      onClose: () => {
        if (!streamEnded) {
          handleReviewConnectionError(new Error("Review stream closed unexpectedly"));
        }
      },
      onError: handleReviewConnectionError,
    });
  }, [taskId, onPhaseChange, onCritiqueReady, t]);

  const abortStream = useCallback(() => {
    eventSourceRef.current?.close();
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { startWriting, startReview, abortStream, isStreaming };
}
