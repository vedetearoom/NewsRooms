"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUp, Bot, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clipboard, Eraser, ExternalLink, Loader2, MessageSquarePlus, MoreHorizontal, Rss, Sparkles, Trash2, Wrench } from "lucide-react";

import { api, type Agent, type AgentActionProposal, type AgentMessage, type JobStatus } from "@/lib/api";
import { markdownToHtml } from "@/lib/markdown-utils";
import { PageEmptyState, PageLoadingState } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/use-toast";
import { useAgentThreadMessages, useAgentThreads } from "@/hooks/useApi";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { sanitizeErrorForUser } from "@/lib/async-feedback";

type StreamToolCall = {
  name: string;
  summary: string;
  payload?: Record<string, unknown>;
};

type ProposalActionHandlers = {
  onApprove: (proposal: AgentActionProposal) => void;
  onReject: (proposal: AgentActionProposal) => void;
  onOpenResult: (path: string) => void;
  onRetry: (proposal: AgentActionProposal) => void;
  onCopyPayload: (proposal: AgentActionProposal) => void;
  busyActionId: number | null;
};

interface AgentWorkbenchProps {
  activeAgent: Agent | null;
}

type TranslateFn = (path: string, fallback?: string) => string;

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function parseEventData<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStatusLabel(status: AgentActionProposal["status"], isExecuting: boolean, t: TranslateFn) {
  if (isExecuting) return t("agents.workbench.status.executing");
  if (status === "pending") return t("agents.workbench.status.pending");
  if (status === "executed") return t("agents.workbench.status.completed");
  if (status === "failed") return t("agents.workbench.status.failed");
  if (status === "rejected") return t("agents.workbench.status.cancelled");
  return status;
}

function getRedirectLabel(path: string, t: TranslateFn) {
  if (path.startsWith("/editor/")) return t("agents.workbench.redirect.editor");
  if (path.startsWith("/sources")) return t("agents.workbench.redirect.sources");
  return t("agents.workbench.redirect.result");
}

function getProposalDisplay(proposal: AgentActionProposal, t: TranslateFn) {
  const payload = proposal.payload_json || {};
  return {
    title: typeof payload.title === "string" ? payload.title : proposal.action_type,
    summary: typeof payload.summary === "string" ? payload.summary : "",
    cta: typeof payload.primary_cta_label === "string" ? payload.primary_cta_label : t("agents.workbench.actions.confirm"),
  };
}

function getJobStatusLabel(status: JobStatus["status"], t: TranslateFn) {
  if (status === "pending") return t("agents.workbench.job.pending");
  if (status === "running") return t("agents.workbench.job.running");
  if (status === "completed") return t("agents.workbench.job.completed");
  if (status === "failed") return t("agents.workbench.job.failed");
  return status;
}

function InlineStatus({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "pending" | "success" | "danger" | "muted";
}) {
  const styles = {
    neutral: { dot: "bg-zinc-400 dark:bg-zinc-500", text: "text-muted-foreground" },
    pending: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
    success: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
    danger: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
    muted: { dot: "bg-zinc-300 dark:bg-zinc-600", text: "text-muted-foreground" },
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] font-medium", styles.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}

function ActionPayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useTranslation();
  const sourceId = asNumber(payload.source_id);
  const sourceName = asString(payload.source_name) || asString(payload.name);
  const sourceUrl = asString(payload.source_url) || asString(payload.url);
  const taskType = asString(payload.task_type);
  const cardIds = Array.isArray(payload.card_ids) ? payload.card_ids.filter((item) => typeof item === "number") : [];

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-3.5 py-3 text-[12px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="space-y-1.5">
        {sourceName ? <p><span className="font-medium text-foreground">{t("agents.workbench.payload.source")}</span>{sourceName}</p> : null}
        {sourceId ? <p><span className="font-medium text-foreground">{t("agents.workbench.payload.sourceId")}</span>{sourceId}</p> : null}
        {sourceUrl ? <p className="break-all"><span className="font-medium text-foreground">{t("agents.workbench.payload.link")}</span>{sourceUrl}</p> : null}
        {taskType ? <p><span className="font-medium text-foreground">{t("agents.workbench.payload.taskType")}</span>{taskType}</p> : null}
        {cardIds.length ? <p><span className="font-medium text-foreground">{t("agents.workbench.payload.cards")}</span>{cardIds.join(", ")}</p> : null}
        {!sourceName && !sourceId && !sourceUrl && !taskType && !cardIds.length ? (
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(payload, null, 2)}</pre>
        ) : null}
      </div>
    </div>
  );
}

function getPayloadItems(payload?: Record<string, unknown>) {
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  return rawItems
    .map(asRecord)
    .filter((item) => Object.keys(item).length > 0)
    .slice(0, 5)
    .map((item) => {
      const id = asNumber(item.id);
      const title = asString(item.title) || asString(item.name) || asString(item.url) || (id ? `#${id}` : "");
      const subtitle = asString(item.summary) || asString(item.url) || asString(item.category) || "";
      const score = asNumber(item.importance_score);
      return {
        id,
        title,
        subtitle,
        score,
      };
    })
    .filter((item) => item.title);
}

function ToolPayloadCard({ name, summary, payload }: { name?: string | null; summary: string; payload?: Record<string, unknown> }) {
  const isSourceList = name === "sources.list";
  const items = getPayloadItems(payload);
  return (
    <div className="w-fit max-w-[85%] rounded-[22px] border border-zinc-200/80 bg-white px-4 py-3 text-[13px] text-foreground dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex items-center gap-2">
        {isSourceList ? <Rss className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground/90">{summary}</p>
        </div>
      </div>
      {items.length ? (
        <div className="mt-2.5 space-y-1.5 border-t border-zinc-200/70 pt-2.5 dark:border-white/[0.08]">
          {items.map((item) => (
            <div key={`${item.id ?? "item"}-${item.title}`} className="min-w-0 text-[12px] leading-5">
              <p className="truncate font-medium text-foreground/85">
                {item.id ? `#${item.id} ` : ""}
                {item.title}
              </p>
              {item.subtitle || item.score !== null ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.subtitle}
                  {item.score !== null ? `${item.subtitle ? " · " : ""}${item.score.toFixed(2)}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  if (message.role === "tool") {
    return (
      <ToolPayloadCard
        name={message.tool_name}
        summary={message.content_md}
        payload={message.tool_payload_json}
      />
    );
  }
  return (
    <div
      className={cn(
        "w-fit max-w-[85%] rounded-[22px] px-4 py-3.5 text-[13px] leading-6",
        message.role === "user"
          ? "ml-auto bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "border border-zinc-200/70 bg-zinc-50/70 text-foreground dark:border-white/[0.08] dark:bg-white/[0.03]",
      )}
    >
      {message.role === "assistant" ? (
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(message.content_md) }} />
      ) : (
        <div className="whitespace-pre-wrap">{message.content_md}</div>
      )}
    </div>
  );
}

function JobStatusInline({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const [jobStatus, setJobStatus] = React.useState<JobStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const status = await api.getJobStatus(jobId);
        if (cancelled) return;
        setJobStatus(status);
        setError(null);
        if (status.status !== "completed" && status.status !== "failed") {
          timer = setTimeout(() => void poll(), 1500);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("agents.workbench.job.queryFailed"));
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, t]);

  if (error) {
    return null;
  }
  if (!jobStatus) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        {t("agents.workbench.job.querying")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {jobStatus.status === "completed" ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : null}
      {jobStatus.status === "failed" ? <AlertTriangle className="w-3 h-3 text-red-500" /> : null}
      {interpolate(t("agents.workbench.job.label"), { status: getJobStatusLabel(jobStatus.status, t) })}
      {jobStatus.error ? ` (${jobStatus.error})` : ""}
    </span>
  );
}

function ActionProposalCard({
  proposal,
  busyActionId,
  onApprove,
  onReject,
  onOpenResult,
  onRetry,
  onCopyPayload,
  dashed = false,
  wide = false,
}: ProposalActionHandlers & {
  proposal: AgentActionProposal;
  dashed?: boolean;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const payload = proposal.payload_json || {};
  const actionPayload = asRecord(payload.payload);
  const { title, summary, cta } = getProposalDisplay(proposal, t);
  const result = proposal.result_json || {};
  const redirectPath = asString(result.redirect_path);
  const jobId = asString(result.job_id);
  const taskId = asNumber(result.task_id);
  const sourceId = asNumber(result.source_id);
  const sourceName = asString(result.source_name);
  const sourceUrl = asString(result.source_url);
  const error = asString(result.error);
  const isExecuting = busyActionId === proposal.id || proposal.status === "approved";
  const statusLabel = getStatusLabel(proposal.status, isExecuting, t);
  const statusTone = isExecuting
    ? "pending"
    : proposal.status === "executed"
      ? "success"
      : proposal.status === "failed"
        ? "danger"
        : proposal.status === "rejected"
          ? "muted"
          : "pending";

  return (
    <div
      className={cn(
        wide ? "w-full" : "max-w-[85%]",
        "rounded-[24px] border bg-white px-4 py-4 dark:bg-[#111214]",
        dashed
          ? "border-dashed border-zinc-300/90 bg-zinc-50/50 dark:border-white/[0.14] dark:bg-white/[0.03]"
          : "border-zinc-200/80 dark:border-white/[0.08]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{summary}</p>
        </div>
        {proposal.status === "executed" ? null : <InlineStatus label={statusLabel} tone={statusTone} />}
      </div>
      <ActionPayloadPreview payload={actionPayload} />
      {isExecuting ? (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t("agents.workbench.executingWait")}
        </div>
      ) : proposal.status === "pending" ? (
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            className="bg-zinc-900 px-3 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={() => onApprove(proposal)}
          >
            {cta}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-200/80 bg-white px-3 text-muted-foreground hover:bg-zinc-50 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
            onClick={() => onReject(proposal)}
          >
            {t("agents.workbench.actions.cancel")}
          </Button>
        </div>
      ) : proposal.result_json ? (
        <div
          className={cn(
            "mt-4 rounded-2xl border px-3.5 py-3 text-[12px]",
            proposal.status === "failed"
              ? "border-rose-200/80 bg-rose-50/40 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100"
              : "border-zinc-200/80 bg-zinc-50/80 text-foreground dark:border-white/[0.08] dark:bg-white/[0.03]",
          )}
        >
          {proposal.status === "executed" ? (
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-1.5 font-medium text-foreground dark:text-white">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {t("agents.workbench.actions.completed")}
              </p>
              {sourceId ? <p>{t("agents.workbench.payload.sourceId")}{sourceId}</p> : null}
              {sourceName ? <p>{t("agents.workbench.payload.sourceName")}{sourceName}</p> : null}
              {sourceUrl ? <p className="break-all">{t("agents.workbench.payload.sourceLink")}{sourceUrl}</p> : null}
              {taskId ? <p>{t("agents.workbench.payload.writingTask")}TSK-{taskId}</p> : null}
              {jobId ? <p>{t("agents.workbench.payload.taskId")}{jobId}</p> : null}
              {jobId ? <JobStatusInline jobId={jobId} /> : null}
              {redirectPath ? (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-200/80 bg-white text-muted-foreground hover:bg-zinc-50 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                    onClick={() => onOpenResult(redirectPath)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {getRedirectLabel(redirectPath, t)}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : proposal.status === "rejected" ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground dark:text-white">{t("agents.workbench.actions.cancelledAction")}</p>
              <p>{asString(proposal.result_json.message) || t("agents.workbench.actions.notExecuted")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="inline-flex items-center gap-1 font-medium text-rose-700 dark:text-rose-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("agents.workbench.actions.failed")}
              </p>
              <p>{sanitizeErrorForUser(error || "") || JSON.stringify(proposal.result_json)}</p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-200/80 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:bg-white/[0.02] dark:text-rose-200 dark:hover:bg-rose-500/10"
                  onClick={() => onRetry(proposal)}
                >
                  {t("agents.workbench.actions.retry")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-200/80 bg-white text-muted-foreground hover:bg-zinc-50 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                  onClick={() => onCopyPayload(proposal)}
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  {t("agents.workbench.actions.copyPayload")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ActionResultCompact({
  proposal,
  onOpenResult,
  onRetry,
  onCopyPayload,
  onDismiss,
}: {
  proposal: AgentActionProposal;
  onOpenResult: (path: string) => void;
  onRetry: (proposal: AgentActionProposal) => void;
  onCopyPayload: (proposal: AgentActionProposal) => void;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const { title } = getProposalDisplay(proposal, t);
  const result = proposal.result_json || {};
  const redirectPath = asString(result.redirect_path);
  const jobId = asString(result.job_id);
  const taskId = asNumber(result.task_id);
  const sourceId = asNumber(result.source_id);
  const sourceName = asString(result.source_name);
  const error = asString(result.error);
  const isFailed = proposal.status === "failed";
  const isRejected = proposal.status === "rejected";
  const isCompactSuccess = !isFailed && !isRejected;

  return (
    <div
      className={cn(
        "rounded-2xl border px-3.5 py-3 text-[12px]",
        isFailed
          ? "border-rose-200/80 bg-rose-50/40 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100"
          : "border-zinc-200/80 bg-white text-foreground dark:border-white/[0.08] dark:bg-white/[0.02]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {isFailed ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" /> : null}
            {isFailed ? <p className="shrink-0 font-semibold">{t("agents.workbench.actions.failed")}</p> : isRejected ? <p className="shrink-0 font-semibold">{t("agents.workbench.status.cancelled")}</p> : null}
            <p className={cn("truncate", isCompactSuccess ? "text-foreground" : "text-muted-foreground")}>{title}</p>
            {isCompactSuccess && taskId ? <span className="shrink-0 text-[11px] text-muted-foreground">TSK-{taskId}</span> : null}
          </div>
          {isCompactSuccess ? null : (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {sourceName ? <span className="max-w-[220px] truncate">{t("agents.workbench.payload.source")}{sourceName}</span> : null}
              {sourceId ? <span>ID {sourceId}</span> : null}
              {taskId ? <span>TSK-{taskId}</span> : null}
              {jobId ? <JobStatusInline jobId={jobId} /> : null}
            </div>
          )}
          {isFailed ? <p className="mt-1 line-clamp-2 text-[11px]">{sanitizeErrorForUser(error || "") || JSON.stringify(result)}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {redirectPath ? (
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-200/80 bg-white text-muted-foreground hover:bg-zinc-50 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
              onClick={() => onOpenResult(redirectPath)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {getRedirectLabel(redirectPath, t)}
            </Button>
          ) : null}
          {onDismiss ? (
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onDismiss}>
              {t("agents.workbench.actions.collapse")}
            </Button>
          ) : null}
        </div>
      </div>
      {isFailed ? (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-rose-200/80 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:bg-white/[0.02] dark:text-rose-200 dark:hover:bg-rose-500/10"
            onClick={() => onRetry(proposal)}
          >
            {t("agents.workbench.actions.retry")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-200/80 bg-white text-muted-foreground hover:bg-zinc-50 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
            onClick={() => onCopyPayload(proposal)}
          >
            <Clipboard className="h-3.5 w-3.5" />
            {t("agents.workbench.actions.copyPayload")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

async function consumeEventStream(
  stream: ReadableStream<Uint8Array>,
  handlers: {
    onChunk: (text: string) => void;
    onToolCall: (call: StreamToolCall) => void;
    onActionProposed: (proposal: AgentActionProposal) => void;
    onError: (message: string) => void;
  },
  fallbackErrorMessage: string,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushEvent = (rawEvent: string) => {
    const lines = rawEvent.split("\n");
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const data = dataLines.join("\n");
    if (event === "chunk") {
      const parsed = parseEventData<{ text?: string }>(data);
      handlers.onChunk(parsed?.text || "");
      return;
    }
    if (event === "tool_call") {
      const parsed = parseEventData<StreamToolCall>(data);
      if (parsed) handlers.onToolCall(parsed);
      return;
    }
    if (event === "action_proposed") {
      const parsed = parseEventData<AgentActionProposal>(data);
      if (parsed) handlers.onActionProposed(parsed);
      return;
    }
    if (event === "error") {
      const parsed = parseEventData<{ message?: string }>(data);
      handlers.onError(parsed?.message || fallbackErrorMessage);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      if (rawEvent.trim()) {
        flushEvent(rawEvent);
      }
      separatorIndex = buffer.indexOf("\n\n");
    }
  }
}

export function AgentWorkbench({ activeAgent }: AgentWorkbenchProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isSupportedRole = activeAgent ? ["writer", "extractor"].includes(activeAgent.role) : false;
  const { threads, isLoading: threadsLoading, mutate: mutateThreads } = useAgentThreads(activeAgent?.id ?? null);
  const [selectedThreadId, setSelectedThreadId] = React.useState<number | null>(null);
  const { messages, isLoading: messagesLoading, mutate: mutateMessages } = useAgentThreadMessages(
    activeAgent?.id ?? null,
    selectedThreadId,
  );

  const [draft, setDraft] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [isCreatingThread, setIsCreatingThread] = React.useState(false);
  const [liveUserPrompt, setLiveUserPrompt] = React.useState<string | null>(null);
  const [liveAssistant, setLiveAssistant] = React.useState("");
  const [liveToolCalls, setLiveToolCalls] = React.useState<StreamToolCall[]>([]);
  const [liveProposals, setLiveProposals] = React.useState<AgentActionProposal[]>([]);
  const [busyActionId, setBusyActionId] = React.useState<number | null>(null);
  const [recentActionResult, setRecentActionResult] = React.useState<AgentActionProposal | null>(null);
  const [highlightedActionId, setHighlightedActionId] = React.useState<number | null>(null);
  const [isCompletedTrayCollapsed, setIsCompletedTrayCollapsed] = React.useState(true);
  const [isThreadListCollapsed, setIsThreadListCollapsed] = React.useState(false);
  const [isThreadMenuOpen, setIsThreadMenuOpen] = React.useState(false);
  const [threadClearTarget, setThreadClearTarget] = React.useState<{ id: number; title: string } | null>(null);
  const [threadDeleteTarget, setThreadDeleteTarget] = React.useState<{ id: number; title: string } | null>(null);
  const threadMenuRef = React.useRef<HTMLDivElement>(null);
  const pendingActions = [
    ...messages.flatMap((message) => message.action_proposals),
    ...liveProposals,
  ].filter((proposal, index, all) => (
    proposal.status === "pending" && all.findIndex((item) => item.id === proposal.id) === index
  ));
  const primaryPendingAction = pendingActions[0] ?? null;
  const primaryPendingTitle = primaryPendingAction ? getProposalDisplay(primaryPendingAction, t).title : "";
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const completedActions = React.useMemo(() => {
    const actionMap = new Map<number, AgentActionProposal>();
    for (const proposal of messages.flatMap((message) => message.action_proposals)) {
      actionMap.set(proposal.id, proposal);
    }
    for (const proposal of liveProposals) {
      actionMap.set(proposal.id, proposal);
    }
    if (recentActionResult) {
      actionMap.set(recentActionResult.id, recentActionResult);
    }
    return Array.from(actionMap.values())
      .filter((proposal) => proposal.status === "executed")
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
  }, [liveProposals, messages, recentActionResult]);

  React.useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
      return;
    }
    if (selectedThreadId && !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0]?.id ?? null);
    }
  }, [selectedThreadId, threads]);

  React.useEffect(() => {
    setDraft("");
    setLiveUserPrompt(null);
    setLiveAssistant("");
    setLiveToolCalls([]);
    setLiveProposals([]);
    setRecentActionResult(null);
    setHighlightedActionId(null);
    setIsCompletedTrayCollapsed(true);
    setIsThreadMenuOpen(false);
  }, [activeAgent?.id, selectedThreadId]);

  useClickOutside({
    ref: threadMenuRef,
    enabled: isThreadMenuOpen,
    onClickOutside: () => setIsThreadMenuOpen(false),
  });

  const createThread = React.useCallback(async (title?: string) => {
    if (!activeAgent) return null;
    setIsCreatingThread(true);
    try {
      const thread = await api.createAgentThread(activeAgent.id, { title });
      await mutateThreads();
      setSelectedThreadId(thread.id);
      return thread;
    } catch (error) {
      toast.error(t("agents.workbench.toast.createThreadFailed"), error instanceof Error ? sanitizeErrorForUser(error.message) : t("agents.workbench.toast.tryLater"));
      return null;
    } finally {
      setIsCreatingThread(false);
    }
  }, [activeAgent, mutateThreads, t]);

  const refreshCurrentThread = React.useCallback(async () => {
    await Promise.all([mutateThreads(), mutateMessages()]);
  }, [mutateMessages, mutateThreads]);

  const handleSend = React.useCallback(async () => {
    const prompt = draft.trim();
    if (!activeAgent || !prompt || isSending) return;

    let threadId = selectedThreadId;
    if (!threadId) {
      const created = await createThread(prompt.slice(0, 32));
      threadId = created?.id ?? null;
    }
    if (!threadId) return;

    setIsSending(true);
    setLiveUserPrompt(prompt);
    setLiveAssistant("");
    setLiveToolCalls([]);
    setLiveProposals([]);
    setDraft("");

    try {
      const response = await api.streamAgentThreadChat(activeAgent.id, threadId, prompt);
      if (!response.ok || !response.body) {
        let message = `${response.status} ${response.statusText}`;
        try {
          const payload = await response.json() as { detail?: unknown };
          if (payload?.detail !== undefined && payload.detail !== null) {
            const detail = payload.detail;
            if (typeof detail === "string") {
              message = detail;
            } else if (typeof detail === "object" && "message" in detail && typeof (detail as Record<string, unknown>).message === "string") {
              message = (detail as Record<string, unknown>).message as string;
            } else if (typeof detail === "object") {
              try { message = JSON.stringify(detail); } catch { /* keep default */ }
            }
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      await consumeEventStream(response.body, {
        onChunk: (text) => setLiveAssistant((current) => current + text),
        onToolCall: (call) => setLiveToolCalls((current) => [...current, call]),
        onActionProposed: (proposal) => setLiveProposals((current) => [...current, proposal]),
        onError: (message) => {
          throw new Error(message);
        },
      }, t("agents.workbench.toast.streamRequestFailed"));
      await refreshCurrentThread();
    } catch (error) {
      toast.error(t("agents.workbench.toast.sendFailed"), error instanceof Error ? sanitizeErrorForUser(error.message) : t("agents.workbench.toast.tryLater"));
    } finally {
      setIsSending(false);
      setLiveUserPrompt(null);
      setLiveAssistant("");
      setLiveToolCalls([]);
      setLiveProposals([]);
    }
  }, [activeAgent, createThread, draft, isSending, refreshCurrentThread, selectedThreadId, t]);

  const handleApprove = React.useCallback(async (proposal: AgentActionProposal) => {
    if (!activeAgent || !selectedThreadId) return;
    setBusyActionId(proposal.id);
    try {
      const result = await api.approveAgentAction(activeAgent.id, selectedThreadId, proposal.id);
      setLiveProposals((current) => current.map((item) => item.id === result.id ? result : item));
      setRecentActionResult(result);
      await refreshCurrentThread();
      toast.success(t("agents.workbench.toast.actionExecuted"));
    } catch (error) {
      toast.error(t("agents.workbench.toast.approveFailed"), error instanceof Error ? sanitizeErrorForUser(error.message) : t("agents.workbench.toast.tryLater"));
    } finally {
      setBusyActionId(null);
    }
  }, [activeAgent, refreshCurrentThread, selectedThreadId, t]);

  const handleReject = React.useCallback(async (proposal: AgentActionProposal) => {
    if (!activeAgent || !selectedThreadId) return;
    setBusyActionId(proposal.id);
    try {
      const result = await api.rejectAgentAction(activeAgent.id, selectedThreadId, proposal.id);
      setLiveProposals((current) => current.map((item) => item.id === result.id ? result : item));
      setRecentActionResult(result);
      await refreshCurrentThread();
      toast.info(t("agents.workbench.toast.actionCancelled"));
    } catch (error) {
      toast.error(t("agents.workbench.toast.rejectFailed"), error instanceof Error ? error.message : t("agents.workbench.toast.tryLater"));
    } finally {
      setBusyActionId(null);
    }
  }, [activeAgent, refreshCurrentThread, selectedThreadId, t]);

  const handleOpenResult = React.useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const handleRetry = React.useCallback((proposal: AgentActionProposal) => {
    const payload = proposal.payload_json?.payload || {};
    setDraft(
      interpolate(t("agents.workbench.retryPrompt"), {
        actionType: proposal.action_type,
        payload: JSON.stringify(payload, null, 2),
      }),
    );
    toast.info(t("agents.workbench.toast.retryPromptLoaded"));
  }, [t]);

  const handleCopyPayload = React.useCallback((proposal: AgentActionProposal) => {
    const payload = proposal.payload_json?.payload || {};
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success(t("agents.workbench.toast.payloadCopied"));
  }, [t]);

  const requestClearThreadContext = React.useCallback((threadId: number, title: string) => {
    setThreadClearTarget({ id: threadId, title });
  }, []);

  const requestDeleteThread = React.useCallback((threadId: number, title: string) => {
    setThreadDeleteTarget({ id: threadId, title });
  }, []);

  const confirmClearThreadContext = React.useCallback(async () => {
    if (!activeAgent || !threadClearTarget) return;
    const threadId = threadClearTarget.id;
    try {
      if (selectedThreadId === threadId) {
        setRecentActionResult(null);
        setLiveUserPrompt(null);
        setLiveAssistant("");
        setLiveToolCalls([]);
        setLiveProposals([]);
      }
      await api.clearAgentThreadContext(activeAgent.id, threadId);
      await Promise.all([mutateThreads(), mutateMessages()]);
      toast.success(t("agents.workbench.toast.contextCleared"));
    } catch (error) {
      toast.error(t("agents.workbench.toast.clearContextFailed"), error instanceof Error ? error.message : t("agents.workbench.toast.tryLater"));
      throw error;
    }
  }, [activeAgent, mutateMessages, mutateThreads, selectedThreadId, threadClearTarget, t]);

  const confirmDeleteThread = React.useCallback(async () => {
    if (!activeAgent || !threadDeleteTarget) return;
    const threadId = threadDeleteTarget.id;
    try {
      await api.deleteAgentThread(activeAgent.id, threadId);
      const remainingThreads = threads.filter((thread) => thread.id !== threadId);
      if (selectedThreadId === threadId) {
        setSelectedThreadId(remainingThreads[0]?.id ?? null);
        setRecentActionResult(null);
        setLiveUserPrompt(null);
        setLiveAssistant("");
        setLiveToolCalls([]);
        setLiveProposals([]);
      }
      await mutateThreads();
      toast.success(t("agents.workbench.toast.threadDeleted"));
    } catch (error) {
      toast.error(t("agents.workbench.toast.deleteThreadFailed"), error instanceof Error ? error.message : t("agents.workbench.toast.tryLater"));
      throw error;
    }
  }, [activeAgent, mutateThreads, selectedThreadId, threadDeleteTarget, threads, t]);

  const focusActionCard = React.useCallback((proposalId: number) => {
    const element = document.getElementById(`agent-action-${proposalId}`);
    if (!element) {
      toast.info(t("agents.workbench.toast.actionCardRefreshing"));
      return;
    }
    setHighlightedActionId(proposalId);
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      setHighlightedActionId((current) => current === proposalId ? null : current);
    }, 1800);
  }, [t]);

  if (!activeAgent) {
    return (
        <PageEmptyState
          compact
          icon={Bot}
          title={t("agents.workbench.empty.selectAgentTitle")}
          description={t("agents.workbench.empty.selectAgentDesc")}
        />
      );
  }

  if (!isSupportedRole) {
    return (
        <PageEmptyState
          compact
          icon={Sparkles}
          title={t("agents.workbench.empty.unsupportedTitle")}
          description={t("agents.workbench.empty.unsupportedDesc")}
        />
      );
  }

  return (
    <>
    <div
      className={cn(
        "group/workbench relative grid h-[calc(100vh-196px)] max-h-[780px] min-h-[560px] overflow-hidden rounded-[28px] bg-[#e6e8eb] shadow-[0_30px_80px_-48px_rgba(24,24,27,0.18)] transition-[grid-template-columns] duration-300 dark:bg-[#111215] dark:shadow-none",
        isThreadListCollapsed ? "grid-cols-[0_minmax(0,1fr)]" : "grid-cols-[260px_minmax(0,1fr)]",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-col overflow-hidden bg-[#f7f8f9] transition-opacity duration-200 dark:bg-white/[0.025]",
          isThreadListCollapsed && "pointer-events-none opacity-0",
        )}
      >
        <div className="flex h-[58px] items-center justify-between bg-[#eceff3] px-4 shadow-[0_12px_28px_-28px_rgba(24,24,27,0.22)] dark:bg-white/[0.03] dark:shadow-none">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-foreground">{t("agents.workbench.title")}</p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void createThread()}
              disabled={isCreatingThread}
              title={t("agents.workbench.actions.newThread")}
              aria-label={t("agents.workbench.actions.newThread")}
              className="h-7 w-7 rounded-full text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-white/[0.06]"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {threadsLoading ? (
            <PageLoadingState compact label={t("agents.workbench.loading.threads")} />
          ) : threads.length === 0 ? (
            <PageEmptyState
              compact
              title={t("agents.workbench.empty.noThreadsTitle")}
              description={t("agents.workbench.empty.noThreadsDesc")}
              action={{ label: t("agents.workbench.actions.createFirstThread"), onClick: () => void createThread() }}
            />
          ) : (
            <div className="space-y-1 px-0 py-2">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className={cn(
                    "group flex items-center gap-2 px-4 py-2 transition-all",
                    selectedThreadId === thread.id
                      ? "bg-zinc-200/60 dark:bg-white/[0.06]"
                      : "hover:bg-zinc-50/70 dark:hover:bg-white/[0.03]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className={cn("truncate text-[11px] leading-5 text-foreground/88", selectedThreadId === thread.id ? "font-semibold text-foreground" : "font-medium")}>
                      {thread.title}
                    </p>
                  </button>
                  <button
                    type="button"
                    title={t("agents.workbench.actions.deleteThread")}
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDeleteThread(thread.id, thread.title);
                    }}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button
        size="icon"
        variant="ghost"
        title={isThreadListCollapsed ? t("agents.workbench.threadList.expand") : t("agents.workbench.threadList.collapse")}
        aria-label={isThreadListCollapsed ? t("agents.workbench.threadList.expand") : t("agents.workbench.threadList.collapse")}
        onClick={() => setIsThreadListCollapsed((current) => !current)}
        className={cn(
          "absolute top-[15px] z-20 h-7 w-7 rounded-lg bg-transparent text-muted-foreground/80 opacity-0 transition-all duration-150 group-hover/workbench:opacity-100 hover:bg-zinc-100 hover:text-foreground focus:opacity-100 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
          isThreadListCollapsed ? "left-2.5" : "left-[272px]",
        )}
      >
        {isThreadListCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      <div className="flex min-h-0 flex-col overflow-hidden bg-[#fcfcfd] dark:bg-[#0f1012]">
        <div className="flex h-[58px] shrink-0 items-center justify-end gap-4 bg-[#eef0f3] px-4 shadow-[0_12px_30px_-30px_rgba(24,24,27,0.2)] dark:bg-white/[0.03] dark:shadow-none">
          {selectedThread ? (
            <div className="relative" ref={threadMenuRef}>
              <Button
                size="icon"
                variant="ghost"
                title={t("agents.workbench.actions.more")}
                aria-label={t("agents.workbench.actions.more")}
                onClick={() => setIsThreadMenuOpen((current) => !current)}
                className={cn(
                  "h-8 w-8 rounded-full text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-white/[0.06]",
                  isThreadMenuOpen && "bg-zinc-100 text-foreground dark:bg-white/[0.06] dark:text-zinc-100",
                )}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
              {isThreadMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[160px] rounded-xl border border-zinc-200/80 bg-white p-1.5 shadow-xl dark:border-white/[0.08] dark:bg-[#181a1d]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsThreadMenuOpen(false);
                      requestClearThreadContext(selectedThread.id, selectedThread.title);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    {t("agents.workbench.actions.clearContext")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fbfbfc] px-5 py-5 dark:bg-[#101114]">
          <div
            className={cn(
              "mx-auto w-full space-y-4 transition-[max-width] duration-300",
              isThreadListCollapsed ? "max-w-[920px]" : "max-w-[760px]",
            )}
          >
            {!selectedThreadId ? (
              <PageEmptyState
                compact
                title={t("agents.workbench.empty.selectThreadTitle")}
                description={t("agents.workbench.empty.selectThreadDesc")}
              />
            ) : messagesLoading ? (
              <PageLoadingState compact label={t("agents.workbench.loading.messages")} />
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className={cn("space-y-3", message.role === "user" ? "items-end" : "")}>
                    <MessageBubble message={message} />

                    {message.action_proposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        id={`agent-action-${proposal.id}`}
                        className={cn(
                          "scroll-mt-6 rounded-2xl transition-all duration-300",
                          highlightedActionId === proposal.id ? "ring-2 ring-emerald-300 ring-offset-4 ring-offset-white dark:ring-emerald-400/50 dark:ring-offset-[#111214]" : "",
                        )}
                      >
                        <ActionProposalCard
                          proposal={proposal}
                          busyActionId={busyActionId}
                          onApprove={(item) => void handleApprove(item)}
                          onReject={(item) => void handleReject(item)}
                          onOpenResult={handleOpenResult}
                          onRetry={handleRetry}
                          onCopyPayload={handleCopyPayload}
                        />
                      </div>
                    ))}
                  </div>
                ))}

                {liveUserPrompt ? (
                  <div className="space-y-3">
                    <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-[22px] bg-zinc-800 px-4 py-3.5 text-[13px] leading-6 text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {liveUserPrompt}
                    </div>
                    {liveToolCalls.map((call, index) => (
                      <ToolPayloadCard
                        key={`${call.name}-${index}`}
                        name={call.name}
                        summary={call.summary}
                        payload={call.payload}
                      />
                    ))}
                    {liveProposals.map((proposal) => {
                      return (
                        <div
                          key={proposal.id}
                          id={`agent-action-${proposal.id}`}
                          className={cn(
                            "scroll-mt-6 rounded-2xl transition-all duration-300",
                            highlightedActionId === proposal.id ? "ring-2 ring-emerald-300 ring-offset-4 ring-offset-white dark:ring-emerald-400/50 dark:ring-offset-[#111214]" : "",
                          )}
                        >
                          <ActionProposalCard
                            proposal={proposal}
                            busyActionId={busyActionId}
                            onApprove={(item) => void handleApprove(item)}
                            onReject={(item) => void handleReject(item)}
                            onOpenResult={handleOpenResult}
                            onRetry={handleRetry}
                            onCopyPayload={handleCopyPayload}
                            dashed
                          />
                        </div>
                      );
                    })}
                    {liveAssistant ? (
                      <div className="w-fit max-w-[85%] rounded-[22px] border border-zinc-200/70 bg-zinc-50/70 px-4 py-3.5 text-[13px] leading-6 text-foreground dark:border-white/[0.08] dark:bg-white/[0.03]">
                        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(liveAssistant) }} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("agents.workbench.loading.generating")}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 bg-[#f1f3f5] px-5 py-4 shadow-[0_-16px_38px_-34px_rgba(24,24,27,0.22)] dark:bg-white/[0.025] dark:shadow-none">
          <div
            className={cn(
              "mx-auto w-full transition-[max-width] duration-300",
              isThreadListCollapsed ? "max-w-[920px]" : "max-w-[760px]",
            )}
          >
            {completedActions.length > 0 || pendingActions.length > 0 ? (
              <div className="mb-1 max-h-[136px] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                {completedActions.length > 0 ? (
                  <div className="px-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsCompletedTrayCollapsed((current) => !current)}
                      className="h-5 rounded-md px-1.5 text-[10px] font-medium text-foreground hover:bg-zinc-100/80 dark:hover:bg-white/[0.06]"
                      title={isCompletedTrayCollapsed ? t("agents.workbench.completed.expand") : t("agents.workbench.completed.collapse")}
                      aria-label={isCompletedTrayCollapsed ? t("agents.workbench.completed.expand") : t("agents.workbench.completed.collapse")}
                    >
                      <span className="truncate">{interpolate(t("agents.workbench.completed.summary"), { count: completedActions.length })}</span>
                      {isCompletedTrayCollapsed ? <ChevronDown className="ml-1 h-3 w-3" /> : <ChevronUp className="ml-1 h-3 w-3" />}
                    </Button>
                    {isCompletedTrayCollapsed ? null : (
                      <div className="mt-1 max-h-[96px] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                        {completedActions.map((proposal) => (
                          <ActionResultCompact
                            key={`completed-${proposal.id}`}
                            proposal={proposal}
                            onOpenResult={handleOpenResult}
                            onRetry={handleRetry}
                            onCopyPayload={handleCopyPayload}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {primaryPendingAction ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 px-3.5 py-3 dark:border-white/[0.08]">
                    <div className="flex min-w-0 items-center gap-3">
                      <InlineStatus label={t("agents.workbench.pending.label")} tone="pending" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-muted-foreground">
                          {interpolate(t("agents.workbench.pending.hint"), { title: primaryPendingTitle })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                          {pendingActions.length}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-zinc-200/80 bg-white text-muted-foreground hover:bg-zinc-50 hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
                        onClick={() => focusActionCard(primaryPendingAction.id)}
                      >
                          {t("agents.workbench.pending.locateCard")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="relative rounded-[22px] border border-zinc-200/80 bg-white px-4 py-2.5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] dark:border-white/[0.08] dark:bg-white/[0.02] dark:shadow-[0_24px_80px_-48px_rgba(0,0,0,0.7)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={activeAgent.role === "extractor" ? t("agents.workbench.placeholder.extractor") : t("agents.workbench.placeholder.writer")}
                className="h-[20px] max-h-[20px] w-full resize-none overflow-y-auto bg-transparent pr-9 text-[12px] leading-5 text-foreground outline-none placeholder:text-muted-foreground/45 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              />
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <Button
                  size="icon"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || isSending || isCreatingThread}
                  className="pointer-events-auto h-6 w-6 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-500 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-white/[0.08] dark:disabled:text-white/35"
                  title={t("agents.workbench.actions.send")}
                  aria-label={t("agents.workbench.actions.send")}
                >
                  {isSending ? <Loader2 className="h-2 w-2 animate-spin" /> : <ArrowUp className="h-2 w-2" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={Boolean(threadClearTarget)}
      onClose={() => setThreadClearTarget(null)}
      onConfirm={confirmClearThreadContext}
      title={t("agents.workbench.modal.clearContextTitle")}
      description={
        threadClearTarget
          ? interpolate(t("agents.workbench.modal.clearContextDesc"), { title: threadClearTarget.title })
          : ""
      }
      confirmText={t("agents.workbench.actions.clearContext")}
      cancelText={t("agents.workbench.actions.cancel")}
      isDestructive={false}
    />
    <ConfirmModal
      isOpen={Boolean(threadDeleteTarget)}
      onClose={() => setThreadDeleteTarget(null)}
      onConfirm={confirmDeleteThread}
      title={t("agents.workbench.modal.deleteThreadTitle")}
      description={
        threadDeleteTarget
          ? interpolate(t("agents.workbench.modal.deleteThreadDesc"), { title: threadDeleteTarget.title })
          : ""
      }
      confirmText={t("agents.workbench.actions.delete")}
      cancelText={t("agents.workbench.actions.cancel")}
      isDestructive
    />
    </>
  );
}
