import * as React from "react";
import type { Agent } from "@/lib/api";

export type AgentWithAudio = Agent & {
  audio_model_ref?: string | null;
  audio_api_key?: string | null;
};

const DEFAULT_ROLE = "extractor";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_AUDIO_MODEL = "gemini-2.5-flash";

function getDefaultSkillsForRole(role: string) {
  if (role === "extractor") {
    return ["sources.list", "sources.create", "sources.scrape", "sources.delete", "sources.read_recent_articles"];
  }
  if (role === "writer") {
    return ["sources.list", "cards.list", "cards.read", "vault.inspirations.list", "tasks.create_article"];
  }
  return [];
}

interface UseAgentFormStateParams {
  activeId: number | "new" | null;
  activeAgent: AgentWithAudio | null;
  getLocalizedAgentName: (agent: AgentWithAudio | null | undefined) => string;
}

function getDefaultFormState() {
  return {
    name: "",
    role: DEFAULT_ROLE,
    modelType: DEFAULT_MODEL,
    apiKey: "",
    audioModelType: DEFAULT_AUDIO_MODEL,
    audioApiKey: "",
    systemPrompt: "",
    contextText: "",
    systemSkills: getDefaultSkillsForRole(DEFAULT_ROLE),
  };
}

function getAgentFormState(activeAgent: AgentWithAudio, getLocalizedAgentName: (agent: AgentWithAudio | null | undefined) => string) {
  return {
    name: getLocalizedAgentName(activeAgent),
    role: activeAgent.role,
    modelType: activeAgent.model_ref,
    apiKey: activeAgent.api_key || "",
    audioModelType: activeAgent.audio_model_ref || DEFAULT_AUDIO_MODEL,
    audioApiKey: activeAgent.audio_api_key || "",
    systemPrompt: activeAgent.system_prompt,
    contextText: activeAgent.context_text || "",
    systemSkills: activeAgent.system_skills || [],
  };
}

export function useAgentFormState({ activeId, activeAgent, getLocalizedAgentName }: UseAgentFormStateParams) {
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState(DEFAULT_ROLE);
  const [modelType, setModelType] = React.useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = React.useState("");
  const [audioModelType, setAudioModelType] = React.useState(DEFAULT_AUDIO_MODEL);
  const [audioApiKey, setAudioApiKey] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [contextText, setContextText] = React.useState("");
  const [systemSkills, setSystemSkills] = React.useState<string[]>(getDefaultSkillsForRole(DEFAULT_ROLE));

  const applyFormState = React.useCallback((next: ReturnType<typeof getDefaultFormState>) => {
    setName(next.name);
    setRole(next.role);
    setModelType(next.modelType);
    setApiKey(next.apiKey);
    setAudioModelType(next.audioModelType);
    setAudioApiKey(next.audioApiKey);
    setSystemPrompt(next.systemPrompt);
    setContextText(next.contextText);
    setSystemSkills(next.systemSkills);
  }, []);

  React.useEffect(() => {
    if (activeAgent) {
      applyFormState(getAgentFormState(activeAgent, getLocalizedAgentName));
      return;
    }

    applyFormState(getDefaultFormState());
  }, [activeAgent, applyFormState, getLocalizedAgentName]);

  const isProfileDirty = React.useMemo(() => {
    const current = {
      name,
      role,
      modelType,
      apiKey,
      audioModelType,
      audioApiKey,
      systemSkills,
    };

    if (activeId === "new") {
      return JSON.stringify(current) !== JSON.stringify({
        name: "",
        role: DEFAULT_ROLE,
        modelType: DEFAULT_MODEL,
        apiKey: "",
        audioModelType: DEFAULT_AUDIO_MODEL,
        audioApiKey: "",
        systemSkills: getDefaultSkillsForRole(DEFAULT_ROLE),
      });
    }

    if (!activeAgent) return false;

    const initial = getAgentFormState(activeAgent, getLocalizedAgentName);
    return current.name !== initial.name ||
      current.role !== initial.role ||
      current.modelType !== initial.modelType ||
      current.apiKey !== initial.apiKey ||
      current.audioModelType !== initial.audioModelType ||
      current.audioApiKey !== initial.audioApiKey ||
      JSON.stringify(current.systemSkills) !== JSON.stringify(initial.systemSkills);
  }, [activeAgent, activeId, apiKey, audioApiKey, audioModelType, getLocalizedAgentName, modelType, name, role, systemSkills]);

  const isPromptDirty = React.useMemo(() => {
    if (activeId === "new") return systemPrompt !== "";
    if (!activeAgent) return false;
    return systemPrompt !== activeAgent.system_prompt;
  }, [activeAgent, activeId, systemPrompt]);

  const isKnowledgeDirty = React.useMemo(() => {
    if (activeId === "new") return contextText !== "";
    if (!activeAgent) return false;
    return contextText !== (activeAgent.context_text || "");
  }, [activeAgent, activeId, contextText]);

  const populateFromAgent = React.useCallback((agent: AgentWithAudio, suffix = "") => {
    const next = getAgentFormState(agent, getLocalizedAgentName);
    applyFormState({
      ...next,
      name: `${next.name}${suffix}`,
    });
  }, [applyFormState, getLocalizedAgentName]);

  const updateRoleWithDefaults = React.useCallback((nextRole: string) => {
    setRole(nextRole);
    setSystemSkills((prev) => {
      if (activeId !== "new") return prev;
      return getDefaultSkillsForRole(nextRole);
    });
  }, [activeId]);

  return {
    name,
    setName,
    role,
    setRole: updateRoleWithDefaults,
    modelType,
    setModelType,
    apiKey,
    setApiKey,
    audioModelType,
    setAudioModelType,
    audioApiKey,
    setAudioApiKey,
    systemPrompt,
    setSystemPrompt,
    contextText,
    setContextText,
    systemSkills,
    setSystemSkills,
    isProfileDirty,
    isPromptDirty,
    isKnowledgeDirty,
    populateFromAgent,
  };
}
