import type { AuthSession, AuthUser, AuthRole, AuthPermission } from "@/lib/auth";
import { getAuthToken, getAuthHeader } from "@/lib/auth";

const API_BASE =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000"
    : "";

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  quota_key?: string;
  limit?: number | null;
  used?: number;
  remaining?: number | null;
}

export class ApiError extends Error {
  status: number;
  detail: ApiErrorDetail | string | null;
  code?: string;

  constructor(message: string, status: number, detail: ApiErrorDetail | string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = typeof detail === "object" && detail !== null ? detail.code : undefined;
  }
}

async function parseAPIErrorResponse(res: Response): Promise<{ message: string; detail: ApiErrorDetail | string | null }> {
  let message = `${res.status} ${res.statusText}`;
  let detail: ApiErrorDetail | string | null = null;

  try {
    const errData = await res.json();
    if (errData && (errData.detail || errData.error)) {
      detail = errData.detail || errData.error;
      if (typeof detail === "object" && detail !== null && "message" in detail) {
        message = String(detail.message || message);
      } else {
        message = typeof detail === "string" ? detail : JSON.stringify(detail);
      }
    }
  } catch {
    // Ignore json parse errors and keep the HTTP status message.
  }

  return { message, detail };
}

function isPublicApiPath(path: string): boolean {
  return path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register") || path.startsWith("/api/health");
}

function isTokenRefreshableError(detail: ApiErrorDetail | string | null): boolean {
  const message = typeof detail === "string" ? detail : detail?.message || detail?.code || "";
  const normalized = message.toLowerCase();
  return normalized.includes("token") || normalized.includes("bearer") || normalized.includes("authentication token");
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  let token = getAuthToken();
  if (!token) {
    const { fetchClerkToken, hasClerkTokenGetter } = await import("@/lib/auth");
    if (hasClerkTokenGetter()) {
      token = await fetchClerkToken();
    }
  }
  if (!token && !isPublicApiPath(path)) {
    throw new ApiError("Authentication token is not ready", 401, "Authentication token is not ready");
  }
  const buildHeaders = (nextToken: string | null) => ({
    "Content-Type": "application/json",
    ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
    ...options?.headers,
  });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: buildHeaders(token),
    });
    if (res.status === 401) {
      const { detail } = await parseAPIErrorResponse(res.clone());
      if (isTokenRefreshableError(detail)) {
        const { fetchClerkToken } = await import("@/lib/auth");
        token = await fetchClerkToken(true);
        if (token) {
          res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: buildHeaders(token),
          });
        }
      }
    }
  } catch (error) {
    const target = `${API_BASE}${path}` || path;
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Network request failed";
    throw new Error(`无法连接后端接口: ${target} (${message})`);
  }
  if (!res.ok) {
    const { message, detail } = await parseAPIErrorResponse(res);
    throw new ApiError(message, res.status, detail);
  }
  return res.json();
}

// --- Types ---
export interface Source {
  id: number;
  name: string;
  url: string;
  source_type: string;
  is_active: boolean;
  extractor_prompt: string | null;
  last_fetched_at: string | null;
  created_at: string;
}

export interface IntelligenceCard {
  id: number;
  title: string;
  summary: string;
  key_points: string[];
  source_urls: string[];
  raw_article_ids: number[];
  tags: string[];
  category: string | null;
  importance_score: number;
  cover_image: string | null;
  is_read: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  pinned_by: number | null;
  pinned_at: string | null;
  content_type: string;  // "article" | "video"
  extra_data: Record<string, unknown>;
  audio_url?: string;
  created_at: string;
  published_date: string;
}

export interface Agent {
  id: number;
  name: string;
  role: string;
  model_ref: string;
  system_prompt: string;
  api_key?: string | null;
  audio_model_ref?: string | null;
  audio_api_key?: string | null;
  context_text: string | null;
  system_skills: string[];
  is_system: boolean;
  is_active: boolean;
  execution_mode: "native" | "plugin_augmented";
  sandbox_enabled: boolean;
  attached_plugins: AgentPluginSummary[];
  created_at: string;
  updated_at: string;
}

export interface Plugin {
  id: number;
  name: string;
  source_url: string;
  github_owner: string;
  github_repo: string;
  git_ref: string;
  commit_sha?: string | null;
  subdir?: string | null;
  install_status: string;
  runtime_profile: "light";
  entry_hint?: string | null;
  detected_files: string[];
  requires_sandbox: boolean;
  root_relpath?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentPluginSummary {
  id: number;
  name: string;
  install_status: string;
  runtime_profile: "light";
  source_url: string;
  github_owner: string;
  github_repo: string;
  git_ref: string;
  commit_sha?: string | null;
  entry_hint?: string | null;
  detected_files: string[];
  is_enabled: boolean;
  sort_order: number;
}

export interface AgentSkillParameter {
  name: string;
  label: string;
  type: string;
  required: boolean;
  description?: string | null;
}

export interface AgentSkillCatalogItem {
  key: string;
  label: string;
  description: string;
  roles: string[];
  requires_confirmation: boolean;
  parameters: AgentSkillParameter[];
}

export interface AgentActionProposal {
  id: number;
  thread_id: number;
  message_id: number;
  action_type: string;
  payload_json: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  result_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: number;
  thread_id: number;
  role: "user" | "assistant" | "tool";
  content_md: string;
  tool_name?: string | null;
  tool_payload_json: Record<string, unknown>;
  created_at: string;
  action_proposals: AgentActionProposal[];
}

export interface AgentThread {
  id: number;
  agent_id: number;
  title: string;
  linked_task_id?: number | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunEvent {
  id?: number;
  task_id?: number | null;
  job_id: string;
  run_id: string;
  phase: string;
  event_type: string;
  level: string;
  message: string;
  payload_json: Record<string, unknown>;
  seq: number;
  created_at: string;
}

export interface PluginInstallQueuedResponse {
  plugin: Plugin;
  job_id: string;
}

export interface QuotaSnapshotItem {
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface QuotaSnapshot {
  limits: Record<string, number | null>;
  resources: Record<string, QuotaSnapshotItem>;
  daily: Record<string, QuotaSnapshotItem>;
  usage_date: string;
  timezone: string;
}

export interface Task {
  id: number;
  task_type: string;
  title: string | null;
  card_ids: number[];
  source_task_ids: number[];
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Draft {
  id: number;
  task_id: number;
  content: string;
  revised_content: string | null;
  version: number;
  agent: string;
  created_at: string;
}

export interface CritiqueItem {
  target_quote: string;
  critique: string;
  suggestion: string;
}

export interface Critique {
  id: number;
  task_id: number;
  draft_id: number;
  critiques: CritiqueItem[];
  overall_score: number | null;
  overall_comment: string | null;
  created_at: string;
}

export interface RawArticle {
  id: number;
  title: string;
  url: string;
  source_id: number | null;
  source_name: string;
  author: string | null;
  is_processed: boolean;
  fetched_at: string | null;
  published_at: string | null;
  content_preview: string;
}

export interface SourceStat {
  id: number;
  name: string;
  source_type: string;
  url: string;
  last_fetched_at: string | null;
  article_count: number;
  pending_count: number;
}

export interface PipelineStats {
  total_articles: number;
  processed: number;
  unprocessed: number;
  sources: SourceStat[];
}

export interface DiscoveredVideo {
  title: string;
  url: string;
  published: string;
  thumbnail: string;
  source_kind?: "url" | "file";
  original_filename?: string | null;
  file_size_bytes?: number | null;
  is_sticky?: boolean;
  note_type?: string | null;
  already_analyzed: boolean;
  analyzed_card_id?: number | null;
  last_analyzed_at?: string | null;
  view_count?: number;
  like_count?: number;
  favorite_count?: number;
  duration_seconds?: number;
}

export type MonitorDiscoveryMode = "rsshub" | "cookie";

export interface MonitorTarget {
  id: number;
  name: string;
  platform: string;
  platform_id: string;
  homepage_url: string;
  rss_url?: string | null;
  discovery_mode: MonitorDiscoveryMode;
  is_active: boolean;
  last_checked_at: string | null;
  cached_videos: DiscoveredVideo[];
  active_jobs: Record<string, string>;
  last_check_job_id?: string | null;
  last_check_status?: string | null;
  last_check_error?: string | null;
  created_at: string;
}

export interface MonitorCheckQueuedResponse {
  ok: boolean;
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
}

export interface MonitorCheckStatus {
  job_id?: string | null;
  status: "idle" | "queued" | "running" | "completed" | "failed";
  error: string;
  videos: DiscoveredVideo[];
  last_checked_at?: string | null;
}

export interface ManualVideoInboxItem {
  id: number;
  source_kind: "url" | "file";
  original_url: string;
  normalized_url: string;
  platform: string;
  author?: string | null;
  title: string;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  published?: string | null;
  thumbnail: string;
  duration_seconds?: number | null;
  view_count?: number | null;
  like_count?: number | null;
  favorite_count?: number | null;
  status: "pending" | "submitting" | "queued" | "done" | "error";
  active_job_id?: string | null;
  linked_card_id?: number | null;
  last_analyzed_at?: string | null;
  error_message?: string | null;
  already_analyzed: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface InspirationAsset {
  id: number;
  title: string;
  hook_text: string | null;
  hook_technique: string | null;
  template_skeleton: string | null;
  source_url: string | null;
  platform: string | null;
  author: string | null;
  tags?: string[];
  audio_url?: string;
  extra_data?: Record<string, unknown>;
  created_at: string;
}

export interface JobStatus {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  result: unknown;
  error: string;
  created_at: string;
}

export interface RSSHubServerPlatformConfig {
  key: string;
  label: string;
  env_var: string;
  hint: string;
  value_masked: string;
  is_configured: boolean;
}

export interface RSSHubServerConfig {
  service_name: string;
  docker_compose_dir: string;
  compose_file_path: string;
  compose_file_exists: boolean;
  env_file_path: string;
  env_file_exists: boolean;
  docker_command: string;
  restart_required: boolean;
  platforms: RSSHubServerPlatformConfig[];
}

export interface RSSHubServerActionResult {
  ok: boolean;
  message: string;
  restart_required: boolean;
  restarted: boolean;
  restart_message: string;
}

export type Permission = AuthPermission;
export type Role = AuthRole;
export type CurrentUser = AuthUser;
export type AuthResponse = AuthSession;

/** Polls a background job until it completes or fails. Returns the final job state. */
async function pollJob(
  jobId: string,
  opts?: { intervalMs?: number; onTick?: (elapsedMs: number) => void }
): Promise<JobStatus> {
  const interval = opts?.intervalMs ?? 1500;
  const startTime = Date.now();
  while (true) {
    const status = await fetchAPI<JobStatus>(`/api/jobs/${jobId}`);
    opts?.onTick?.(Date.now() - startTime);
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

// --- API Functions ---
export const api = {
  // Auth
  auth: {
    login: (data: { username: string; password: string }) =>
      fetchAPI<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
    register: (data: { username: string; email: string; display_name: string; password: string }) =>
      fetchAPI<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
    me: () => fetchAPI<CurrentUser>("/api/auth/me"),
    changePassword: (data: { current_password: string; new_password: string }) =>
      fetchAPI<CurrentUser>("/api/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
  },

  admin: {
    getUsers: () => fetchAPI<CurrentUser[]>("/api/admin/users"),
    createUser: (data: { username: string; email: string; display_name: string; password: string; role_codes: string[]; is_active: boolean }) =>
      fetchAPI<CurrentUser>("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
    deleteUser: (id: number) =>
      fetchAPI<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" }),
    updateUser: (id: number, data: Partial<{ email: string; display_name: string; role_codes: string[]; is_active: boolean }>) =>
      fetchAPI<CurrentUser>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    updateUserStatus: (id: number, is_active: boolean) =>
      fetchAPI<CurrentUser>(`/api/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ is_active }) }),
    resetUserPassword: (id: number, new_password: string) =>
      fetchAPI<{ ok: boolean }>(`/api/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ new_password }) }),
    getRoles: () => fetchAPI<Role[]>("/api/admin/roles"),
    createRole: (data: { name: string; code: string; description?: string | null; permission_codes: string[]; quota_limits?: Record<string, number | null> }) =>
      fetchAPI<Role>("/api/admin/roles", { method: "POST", body: JSON.stringify(data) }),
    updateRole: (id: number, data: Partial<{ name: string; code: string; description?: string | null; permission_codes: string[]; quota_limits: Record<string, number | null> }>) =>
      fetchAPI<Role>(`/api/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteRole: (id: number) =>
      fetchAPI<{ ok: boolean }>(`/api/admin/roles/${id}`, { method: "DELETE" }),
    getPermissions: () => fetchAPI<Permission[]>("/api/admin/permissions"),
    getQuota: () => fetchAPI<QuotaSnapshot>("/api/quota"),
    getRSSHubServerConfig: () => fetchAPI<RSSHubServerConfig>("/api/admin/server/rsshub"),
    updateRSSHubServerConfig: (data: { cookies: Record<string, string>; restart_after_save?: boolean }) =>
      fetchAPI<RSSHubServerActionResult>("/api/admin/server/rsshub", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    restartRSSHub: () =>
      fetchAPI<RSSHubServerActionResult>("/api/admin/server/rsshub/restart", {
        method: "POST",
      }),
  },

  // Jobs
  getJobs: () => fetchAPI<(JobStatus & { job_id: string })[]>("/api/jobs"),
  getQuota: () => fetchAPI<QuotaSnapshot>("/api/quota"),

  // Sources
  getSources: () => fetchAPI<Source[]>("/api/sources"),
  createSource: (data: { name: string; url: string; source_type: string; extractor_prompt?: string }) =>
    fetchAPI<Source>("/api/sources", { method: "POST", body: JSON.stringify(data) }),
  updateSource: (id: number, data: { name: string; url: string; source_type: string; extractor_prompt?: string }) =>
    fetchAPI<Source>(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  toggleSource: (id: number) => fetchAPI<{ ok: boolean }>(`/api/sources/${id}/toggle`, { method: "PATCH" }),
  triggerSourceScrape: (id: number) => fetchAPI<{ ok: boolean; job_id: string }>(`/api/sources/${id}/scrape`, { method: "POST" }),
  deleteSource: (id: number) =>
    fetchAPI(`/api/sources/${id}`, { method: "DELETE" }),

  // Cards
  getCards: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchAPI<IntelligenceCard[]>(`/api/cards${qs}`);
  },
  getTodayCards: () => fetchAPI<IntelligenceCard[]>("/api/cards/today"),
  getCategories: () =>
    fetchAPI<{ name: string; count: number }[]>("/api/cards/categories"),
  markRead: (id: number) =>
    fetchAPI(`/api/cards/${id}/read`, { method: "PATCH" }),
  archiveCard: (id: number) =>
    fetchAPI(`/api/cards/${id}/archive`, { method: "PATCH" }),
  getCardsByIds: (ids: number[]) =>
    Promise.all(ids.map((id) => 
      fetchAPI<IntelligenceCard>(`/api/cards/${id}`)
        .catch(() => null)
    )).then(cards => cards.filter((c): c is IntelligenceCard => c !== null)),
  deleteCard: (id: number) =>
    fetchAPI(`/api/cards/${id}`, { method: "DELETE" }),
  getPinnedCards: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchAPI<IntelligenceCard[]>(`/api/cards/pinned${qs}`);
  },
  togglePin: (id: number) =>
    fetchAPI<{ ok: boolean; is_pinned: boolean; pinned_by: number | null; pinned_at: string | null }>(
      `/api/cards/${id}/pin`,
      { method: "PATCH" }
    ),

  // Tasks
  getTasks: () => fetchAPI<Task[]>("/api/tasks"),
  createTask: (data: { task_type: string; card_ids?: number[]; inspiration_ids?: number[]; source_task_ids?: number[]; config?: Record<string, unknown>; initial_draft?: string }) =>
    fetchAPI<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  getTask: (id: number) => fetchAPI<Task>(`/api/tasks/${id}`),
  deleteTask: (id: number) => fetchAPI(`/api/tasks/${id}`, { method: "DELETE" }),
  getDraft: (taskId: number) => fetchAPI<Draft | null>(`/api/tasks/${taskId}/draft`),
  getCritique: (taskId: number) => fetchAPI<Critique | null>(`/api/tasks/${taskId}/critique`),
  acceptDraft: (taskId: number) =>
    fetchAPI(`/api/tasks/${taskId}/accept`, { method: "PATCH" }),
  revertTask: (taskId: number) =>
    fetchAPI(`/api/tasks/${taskId}/revert`, { method: "PATCH" }),
  regenerateTask: (taskId: number, agentId?: number) =>
    fetchAPI(`/api/tasks/${taskId}/regenerate`, { 
      method: "PATCH",
      ...(agentId ? { body: JSON.stringify({ agent_id: agentId }) } : {})
    }),
  translateTask: (taskId: number, language: string) =>
    fetchAPI(`/api/tasks/${taskId}/translate`, { method: "PATCH", body: JSON.stringify({ language }) }),
  updateTaskTitle: (taskId: number, title: string) =>
    fetchAPI(`/api/tasks/${taskId}/title`, { method: "PATCH", body: JSON.stringify({ title }) }),
  updateTaskStatus: (taskId: number, status: string) =>
    fetchAPI(`/api/tasks/${taskId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  updateDraft: (taskId: number, content: string) =>
    fetchAPI(`/api/tasks/${taskId}/draft`, { method: "PATCH", body: JSON.stringify({ content }) }),
  getTaskExecutionLog: (taskId: number) =>
    fetchAPI<AgentRunEvent[]>(`/api/tasks/${taskId}/execution-log`),

  // Triggers
  seedDemo: () => fetchAPI("/api/seed", { method: "POST" }),
  triggerScrape: () => fetchAPI<{ ok: boolean; job_id: string }>("/api/trigger/scrape", { method: "POST" }),
  triggerProcess: () => fetchAPI<{ ok: boolean; job_id: string }>("/api/trigger/process", { method: "POST" }),

  // Video Analysis
  analyzeVideo: (url: string) =>
    fetchAPI<{ ok: boolean; job_id: string }>("/api/analyze/video", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  // Raw Articles (Pipeline)
  getRawArticles: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchAPI<RawArticle[]>(`/api/raw-articles${qs}`);
  },
  getPipelineStats: () => fetchAPI<PipelineStats>("/api/raw-articles/stats"),
  processSelected: (articleIds: number[]) =>
    fetchAPI<{ ok: boolean; job_id: string }>("/api/raw-articles/process-selected", {
      method: "POST",
      body: JSON.stringify({ article_ids: articleIds }),
    }),
  deleteRawArticle: (id: number) =>
    fetchAPI(`/api/raw-articles/${id}`, { method: "DELETE" }),

  // SSE stream URLs
  streamWriteUrl: (taskId: number) => `${API_BASE}/api/stream/${taskId}/write`,
  streamReviewUrl: (taskId: number, agentId?: number, pollOnly?: boolean) => {
    const url = `${API_BASE}/api/stream/${taskId}/review`;
    const params = new URLSearchParams();
    if (agentId) params.append("reviewer_id", agentId.toString());
    if (pollOnly) params.append("poll_only", "true");
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  },

  // Agents
  getAgents: () => fetchAPI<Agent[]>("/api/agents"),
  createAgent: (data: Partial<Agent>) =>
    fetchAPI<Agent>("/api/agents", { method: "POST", body: JSON.stringify(data) }),
  updateAgent: (id: number, data: Partial<Agent>) =>
    fetchAPI<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAgent: (id: number) => fetchAPI(`/api/agents/${id}`, { method: "DELETE" }),
  rewriteText: (text: string, instruction: string) =>
    fetchAPI<{ rewritten_text: string }>("/api/agents/rewrite", { method: "POST", body: JSON.stringify({ text, instruction }) }),
  activateAgent: (id: number) => fetchAPI<Agent>(`/api/agents/${id}/activate`, { method: "PATCH" }),
  getAgentSkillCatalog: () => fetchAPI<AgentSkillCatalogItem[]>("/api/agent-skills/catalog"),
  getAgentThreads: (agentId: number) => fetchAPI<AgentThread[]>(`/api/agents/${agentId}/threads`),
  createAgentThread: (agentId: number, data: { title?: string | null } = {}) =>
    fetchAPI<AgentThread>(`/api/agents/${agentId}/threads`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  clearAgentThreadContext: (agentId: number, threadId: number) =>
    fetchAPI<AgentThread>(`/api/agents/${agentId}/threads/${threadId}/clear`, {
      method: "POST",
    }),
  deleteAgentThread: (agentId: number, threadId: number) =>
    fetchAPI<{ ok: boolean }>(`/api/agents/${agentId}/threads/${threadId}`, {
      method: "DELETE",
    }),
  getAgentThreadMessages: (agentId: number, threadId: number) =>
    fetchAPI<AgentMessage[]>(`/api/agents/${agentId}/threads/${threadId}/messages`),
  approveAgentAction: (agentId: number, threadId: number, actionId: number) =>
    fetchAPI<AgentActionProposal>(`/api/agents/${agentId}/threads/${threadId}/actions/${actionId}/approve`, {
      method: "POST",
    }),
  rejectAgentAction: (agentId: number, threadId: number, actionId: number) =>
    fetchAPI<AgentActionProposal>(`/api/agents/${agentId}/threads/${threadId}/actions/${actionId}/reject`, {
      method: "POST",
    }),
  streamAgentThreadChat: async (agentId: number, threadId: number, prompt: string, signal?: AbortSignal) =>
    fetch(`${API_BASE}/api/agents/${agentId}/threads/${threadId}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({ prompt }),
      signal,
    }),
  getPlugins: () => fetchAPI<Plugin[]>("/api/plugins"),
  getPlugin: (id: number) => fetchAPI<Plugin>(`/api/plugins/${id}`),
  installPlugin: (data: { source_url: string; name?: string; runtime_profile?: "light" }) =>
    fetchAPI<PluginInstallQueuedResponse>("/api/plugins/install", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePlugin: (id: number) => fetchAPI<{ ok: boolean }>(`/api/plugins/${id}`, { method: "DELETE" }),
  bindPluginToAgent: (
    agentId: number,
    pluginId: number,
    data: { sort_order?: number; is_enabled?: boolean } = {},
  ) =>
    fetchAPI<Agent>(`/api/agents/${agentId}/plugins/${pluginId}`, {
      method: "POST",
      body: JSON.stringify({
        sort_order: data.sort_order ?? 0,
        is_enabled: data.is_enabled ?? true,
      }),
    }),
  unbindPluginFromAgent: (agentId: number, pluginId: number) =>
    fetchAPI<Agent>(`/api/agents/${agentId}/plugins/${pluginId}`, { method: "DELETE" }),

  // Context Lab Stream
  streamLabChat: async (inspirationIds: number[], prompt: string, agentType: string, signal?: AbortSignal) =>
    fetch(`${API_BASE}/api/agents/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({ inspiration_ids: inspirationIds, prompt, agent_type: agentType }),
      signal
    }),

  // Jobs
  getJobStatus: (jobId: string) => fetchAPI<JobStatus>(`/api/jobs/${jobId}`),
  pollJob,

  // Image Upload
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
      headers: {
        ...(await getAuthHeader()),
      },
      // Note: Do NOT set Content-Type header — browser auto-sets multipart boundary
    });
    if (!res.ok) {
      const { message, detail } = await parseAPIErrorResponse(res);
      throw new ApiError(message, res.status, detail);
    }
    return res.json();
  },

  generateImage: async (prompt: string, aspect_ratio: string = "16:9"): Promise<{url: string}> => {
    const result = await fetchAPI<{url?: string; ok?: false; error_code?: string}>("/api/generate-image", {
      method: "POST",
      body: JSON.stringify({ prompt, aspect_ratio }),
    });
    if (result.ok === false) {
      throw new Error(result.error_code || "IMAGE_GENERATION_FAILED");
    }
    if (!result.url) {
      throw new Error("IMAGE_GENERATION_FAILED");
    }
    return { url: result.url };
  },

  deleteImage: async (imageUrl: string): Promise<void> => {
    // Extract filename from URL (e.g. from "http://localhost:9000/bucket/img_xxx.png")
    const filename = imageUrl.split('/').pop();
    if (!filename || !(filename.startsWith('img_') || filename.startsWith('gen_img_'))) return;
    
    const res = await fetch(`${API_BASE}/api/upload/${filename}`, {
      method: "DELETE",
      headers: {
        ...(await getAuthHeader()),
      },
    });
    if (!res.ok) {
      console.error(`Failed to delete image ${filename}`);
    }
  },

  // ── Video Monitors ──
  getMonitors: () => fetchAPI<MonitorTarget[]>("/api/monitors"),
  createMonitor: (data: { url: string; name?: string; discovery_mode?: MonitorDiscoveryMode }) =>
    fetchAPI<MonitorTarget>("/api/monitors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMonitor: (id: number, data: { name?: string; url?: string; discovery_mode?: MonitorDiscoveryMode }) =>
    fetchAPI<MonitorTarget>(`/api/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteMonitor: (id: number) =>
    fetchAPI<{ ok: boolean }>(`/api/monitors/${id}`, { method: "DELETE" }),
  toggleMonitor: (id: number) =>
    fetchAPI<MonitorTarget>(`/api/monitors/${id}/toggle`, { method: "PATCH" }),
  checkMonitor: (id: number) =>
    fetchAPI<MonitorCheckQueuedResponse>(`/api/monitors/${id}/check`, { method: "POST" }),
  getMonitorCheckStatus: (id: number) =>
    fetchAPI<MonitorCheckStatus>(`/api/monitors/${id}/check-status`),
  dispatchAnalysis: (id: number, urls: string[], force = false) =>
    fetchAPI<{ ok: boolean; dispatched: { url: string; job_id?: string; card_id?: number; status?: string; already_exists?: boolean }[]; skipped?: { url: string; reason: string }[] }>(`/api/monitors/${id}/dispatch`, {
      method: "POST",
      body: JSON.stringify({ urls, force }),
    }),
  deleteMonitorCachedVideos: (id: number, urls: string[]) =>
    fetchAPI<{ ok: boolean; removed: number }>(`/api/monitors/${id}/delete-videos`, {
      method: "POST",
      body: JSON.stringify({ urls }),
    }),
  getMonitorJobStatus: (id: number) =>
    fetchAPI<{ statuses: Record<string, string>; errors?: Record<string, string> }>(`/api/monitors/${id}/job-status`),
  getManualVideoInboxItems: () =>
    fetchAPI<ManualVideoInboxItem[]>("/api/monitors/manual-videos"),
  importManualVideoUrls: (urls: string[]) =>
    fetchAPI<ManualVideoInboxItem[]>("/api/monitors/manual-videos/import", {
      method: "POST",
      body: JSON.stringify({ urls }),
    }),
  uploadManualVideo: async (file: File): Promise<ManualVideoInboxItem> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/monitors/manual-videos/upload`, {
      method: "POST",
      body: formData,
      headers: {
        ...(await getAuthHeader()),
      },
    });
    if (!res.ok) {
      const { message, detail } = await parseAPIErrorResponse(res);
      throw new ApiError(message, res.status, detail);
    }
    return res.json();
  },
  analyzeManualVideoInboxItem: (itemId: number, force = false) =>
    fetchAPI<{ ok: boolean; card_id?: number; job_id?: string; url: string; status?: string; already_exists?: boolean }>(`/api/monitors/manual-videos/${itemId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ force }),
    }),
  analyzeManualVideoInboxItems: (itemIds: number[]) =>
    fetchAPI<{ ok: boolean; dispatched: { item_id: number; url: string; job_id?: string; card_id?: number; status?: string; already_exists?: boolean }[]; skipped?: { item_id?: number; url?: string; reason: string }[] }>("/api/monitors/manual-videos/analyze-batch", {
      method: "POST",
      body: JSON.stringify({ item_ids: itemIds }),
    }),
  deleteManualVideoInboxItems: (itemIds: number[]) =>
    fetchAPI<{ ok: boolean; removed: number }>("/api/monitors/manual-videos/delete", {
      method: "POST",
      body: JSON.stringify({ item_ids: itemIds }),
    }),
  getManualVideoJobStatus: () =>
    fetchAPI<{ statuses: Record<string, string>; errors?: Record<string, string> }>("/api/monitors/manual-videos/job-status"),

  getMonitorCredentials: () =>
    fetchAPI<{ platforms: CookiePlatformConfig[] }>("/api/monitors/credentials"),
  saveMonitorCredential: (platform: string, cookie: string) =>
    fetchAPI<{ ok: boolean; message: string; platform: string }>(`/api/monitors/credentials/${platform}`, {
      method: "PUT",
      body: JSON.stringify({ cookie }),
    }),
  deleteMonitorCredential: (platform: string) =>
    fetchAPI<{ ok: boolean }>(`/api/monitors/credentials/${platform}`, {
      method: "DELETE",
    }),
  getCookieConfig: () =>
    fetchAPI<{ platforms: CookiePlatformConfig[] }>("/api/monitors/credentials"),
  saveCookieConfig: async (cookies: Record<string, string>) => {
    const entries = Object.entries(cookies);
    if (entries.length === 0) {
      return { ok: true, message: "No changes" };
    }

    await Promise.all(
      entries.map(([platform, cookie]) =>
        cookie.trim()
          ? fetchAPI<{ ok: boolean; message: string }>(`/api/monitors/credentials/${platform}`, {
              method: "PUT",
              body: JSON.stringify({ cookie }),
            })
          : fetchAPI<{ ok: boolean }>(`/api/monitors/credentials/${platform}`, {
              method: "DELETE",
            }),
      ),
    );

    return { ok: true, message: "Cookie 已保存" };
  },

  // ── Inspiration Vault ──
  getInspirations: () => fetchAPI<InspirationAsset[]>("/api/inspirations"),
  saveInspiration: (data: Partial<InspirationAsset>) =>
    fetchAPI<InspirationAsset>("/api/inspirations", { method: "POST", body: JSON.stringify(data) }),
  deleteInspiration: (id: number) => fetchAPI<{ ok: boolean }>(`/api/inspirations/${id}`, { method: "DELETE" }),
};

export interface CookiePlatformConfig {
  key: string;
  label: string;
  hint: string;
  cookie_masked: string;
  is_configured: boolean;
  last_validated_at?: string | null;
  last_validation_status?: string | null;
  last_validation_error?: string | null;
}
