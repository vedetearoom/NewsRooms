import useSWR from 'swr';
import { api, Task, Agent, Plugin, AgentSkillCatalogItem, AgentThread, AgentMessage, ModelProvider } from '@/lib/api';

const DEDUP = { dedupingInterval: 5000 };

export function useTasks() {
  const { data, error, isLoading, mutate } = useSWR<Task[]>('/api/tasks', api.getTasks, {
    refreshInterval: 5000,
    ...DEDUP,
  });
  return { tasks: data || [], isLoading, isError: error, mutate };
}

export function useTask(taskId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<Task>(
    taskId ? `/api/tasks/${taskId}` : null,
    () => api.getTask(taskId as number),
    DEDUP,
  );
  return { task: data, isLoading, isError: error, mutate };
}

export function useSources() {
    const { data, error, isLoading, mutate } = useSWR('/api/sources', () => api.getSources(), DEDUP);
    return { sources: data || [], isLoading, isError: error, mutate };
}

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<Agent[]>('/api/agents', api.getAgents, DEDUP);
  return { agents: data || [], isLoading, isError: error, mutate };
}

export function usePlugins() {
  const { data, error, isLoading, mutate } = useSWR<Plugin[]>('/api/plugins', api.getPlugins, {
    refreshInterval: 4000,
    ...DEDUP,
  });
  return { plugins: data || [], isLoading, isError: error, mutate };
}

export function useAgentSkillCatalog() {
  const { data, error, isLoading, mutate } = useSWR<AgentSkillCatalogItem[]>('/api/agent-skills/catalog', api.getAgentSkillCatalog, DEDUP);
  return { skills: data || [], isLoading, isError: error, mutate };
}

export function useModelProviders() {
  const { data, error, isLoading, mutate } = useSWR<ModelProvider[]>('/api/model-providers', api.getModelProviders, DEDUP);
  return { providers: data || [], isLoading, isError: error, mutate };
}

export function useAgentThreads(agentId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AgentThread[]>(
    agentId ? `/api/agents/${agentId}/threads` : null,
    () => api.getAgentThreads(agentId as number),
    DEDUP,
  );
  return { threads: data || [], isLoading, isError: error, mutate };
}

export function useAgentThreadMessages(agentId: number | null, threadId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AgentMessage[]>(
    agentId && threadId ? `/api/agents/${agentId}/threads/${threadId}/messages` : null,
    () => api.getAgentThreadMessages(agentId as number, threadId as number),
    DEDUP,
  );
  return { messages: data || [], isLoading, isError: error, mutate };
}
