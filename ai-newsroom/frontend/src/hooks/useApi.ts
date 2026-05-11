import useSWR from 'swr';
import { api, Task, Agent, Plugin, AgentSkillCatalogItem, AgentThread, AgentMessage } from '@/lib/api';

export function useTasks() {
  const { data, error, isLoading, mutate } = useSWR<Task[]>('/api/tasks', api.getTasks, {
    refreshInterval: 5000,
  });
  return { tasks: data || [], isLoading, isError: error, mutate };
}

export function useTask(taskId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<Task>(
    taskId ? `/api/tasks/${taskId}` : null,
    () => api.getTask(taskId as number)
  );
  return { task: data, isLoading, isError: error, mutate };
}

export function useSources() {
    const { data, error, isLoading, mutate } = useSWR('/api/sources', () => api.getSources());
    return { sources: data || [], isLoading, isError: error, mutate };
}

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<Agent[]>('/api/agents', api.getAgents);
  return { agents: data || [], isLoading, isError: error, mutate };
}

export function usePlugins() {
  const { data, error, isLoading, mutate } = useSWR<Plugin[]>('/api/plugins', api.getPlugins, {
    refreshInterval: 4000,
  });
  return { plugins: data || [], isLoading, isError: error, mutate };
}

export function useAgentSkillCatalog() {
  const { data, error, isLoading, mutate } = useSWR<AgentSkillCatalogItem[]>('/api/agent-skills/catalog', api.getAgentSkillCatalog);
  return { skills: data || [], isLoading, isError: error, mutate };
}

export function useAgentThreads(agentId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AgentThread[]>(
    agentId ? `/api/agents/${agentId}/threads` : null,
    () => api.getAgentThreads(agentId as number),
  );
  return { threads: data || [], isLoading, isError: error, mutate };
}

export function useAgentThreadMessages(agentId: number | null, threadId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AgentMessage[]>(
    agentId && threadId ? `/api/agents/${agentId}/threads/${threadId}/messages` : null,
    () => api.getAgentThreadMessages(agentId as number, threadId as number),
  );
  return { messages: data || [], isLoading, isError: error, mutate };
}
