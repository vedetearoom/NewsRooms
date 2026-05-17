import * as React from "react";
import type { Agent } from "@/lib/api";

export type AgentWithAudio = Agent & {
  audio_model_ref?: string | null;
  audio_api_key?: string | null;
};

const DEFAULT_ROLE = "extractor";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_AUDIO_MODEL = "gemini-2.5-flash";

// English default prompts (matching backend DEFAULT_USER_AGENTS)
const EN_DEFAULT_PROMPTS: Record<string, string> = {
  extractor: "You are an expert news analyst. Extract key points and entities from the provided source text.",
  writer: "You are a professional journalist. Synthesize the provided intelligence cards into a cohesive, neutral, and well-structured article.",
  reviewer: "You are a strict editorial reviewer. Read the draft text and ensure it adheres to professional journalistic standards. Provide specific quotes to fix if there are overly speculative or biased statements.",
};

function localizePrompt(role: string, prompt: string, localizedPrompts?: Record<string, string>): string {
  if (EN_DEFAULT_PROMPTS[role] && prompt === EN_DEFAULT_PROMPTS[role] && localizedPrompts?.[role]) {
    return localizedPrompts[role];
  }
  return prompt;
}

export function denormalizePrompt(role: string, prompt: string, localizedPrompts: Record<string, string>): string {
  if (EN_DEFAULT_PROMPTS[role]) {
    const localized = localizedPrompts[role];
    if (localized && prompt === localized) {
      return EN_DEFAULT_PROMPTS[role];
    }
  }
  return prompt;
}

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
  t: (key: string) => string;
}

function getDefaultFormState(localizedPrompts: Record<string, string>) {
  return {
    name: "",
    role: DEFAULT_ROLE,
    modelType: DEFAULT_MODEL,
    providerId: null as number | null,
    audioModelType: DEFAULT_AUDIO_MODEL,
    audioApiKey: "",
    systemPrompt: localizedPrompts[DEFAULT_ROLE] || EN_DEFAULT_PROMPTS[DEFAULT_ROLE] || "",
    contextText: "",
    systemSkills: getDefaultSkillsForRole(DEFAULT_ROLE),
  };
}

function getAgentFormState(activeAgent: AgentWithAudio, getLocalizedAgentName: (agent: AgentWithAudio | null | undefined) => string, localizedPrompts: Record<string, string>) {
  return {
    name: getLocalizedAgentName(activeAgent),
    role: activeAgent.role,
    modelType: activeAgent.model_ref,
    providerId: (activeAgent as Agent).provider_id ?? null,
    audioModelType: activeAgent.audio_model_ref || DEFAULT_AUDIO_MODEL,
    audioApiKey: activeAgent.audio_api_key || "",
    systemPrompt: localizePrompt(activeAgent.role, activeAgent.system_prompt, localizedPrompts),
    contextText: activeAgent.context_text || "",
    systemSkills: activeAgent.system_skills || [],
  };
}

export function useAgentFormState({ activeId, activeAgent, getLocalizedAgentName, t }: UseAgentFormStateParams) {
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState(DEFAULT_ROLE);
  const [modelType, setModelType] = React.useState(DEFAULT_MODEL);
  const [providerId, setProviderId] = React.useState<number | null>(null);
  const [audioModelType, setAudioModelType] = React.useState(DEFAULT_AUDIO_MODEL);
  const [audioApiKey, setAudioApiKey] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [contextText, setContextText] = React.useState("");
  const [systemSkills, setSystemSkills] = React.useState<string[]>(getDefaultSkillsForRole(DEFAULT_ROLE));
  const [autoSystemSkills, setAutoSystemSkills] = React.useState<string[]>(getDefaultSkillsForRole(DEFAULT_ROLE));

  const applyFormState = React.useCallback((next: ReturnType<typeof getDefaultFormState>) => {
    setName(next.name);
    setRole(next.role);
    setModelType(next.modelType);
    setProviderId(next.providerId);
    setAudioModelType(next.audioModelType);
    setAudioApiKey(next.audioApiKey);
    setSystemPrompt(next.systemPrompt);
    setContextText(next.contextText);
    setSystemSkills(next.systemSkills);
    setAutoSystemSkills(next.systemSkills);
  }, []);

  const localizedPrompts = React.useMemo(() => ({
    extractor: t("agents.defaultPrompts.extractor"),
    writer: t("agents.defaultPrompts.writer"),
    reviewer: t("agents.defaultPrompts.reviewer"),
  }), [t]);

  React.useEffect(() => {
    if (activeAgent) {
      applyFormState(getAgentFormState(activeAgent, getLocalizedAgentName, localizedPrompts));
      return;
    }

    applyFormState(getDefaultFormState(localizedPrompts));
  }, [activeAgent, applyFormState, getLocalizedAgentName, localizedPrompts]);

  const isProfileDirty = React.useMemo(() => {
    const current = {
      name,
      role,
      modelType,
      providerId,
      audioModelType,
      audioApiKey,
    };

    if (activeId === "new") {
      return JSON.stringify(current) !== JSON.stringify({
        name: "",
        role: DEFAULT_ROLE,
        modelType: DEFAULT_MODEL,
        providerId: null,
        audioModelType: DEFAULT_AUDIO_MODEL,
        audioApiKey: "",
      });
    }

    if (!activeAgent) return false;

    const initial = getAgentFormState(activeAgent, getLocalizedAgentName, localizedPrompts);
    return current.name !== initial.name ||
      current.role !== initial.role ||
      current.modelType !== initial.modelType ||
      current.providerId !== initial.providerId ||
      current.audioModelType !== initial.audioModelType ||
      current.audioApiKey !== initial.audioApiKey;
  }, [activeAgent, activeId, audioApiKey, audioModelType, getLocalizedAgentName, localizedPrompts, modelType, name, providerId, role]);

  const isSkillsDirty = React.useMemo(() => {
    return JSON.stringify(systemSkills) !== JSON.stringify(autoSystemSkills);
  }, [systemSkills, autoSystemSkills]);

  const isPromptDirty = React.useMemo(() => {
    if (activeId === "new") return systemPrompt !== (localizedPrompts[role as keyof typeof localizedPrompts] || EN_DEFAULT_PROMPTS[role] || "");
    if (!activeAgent) return false;
    const initial = getAgentFormState(activeAgent, getLocalizedAgentName, localizedPrompts);
    return systemPrompt !== initial.systemPrompt;
  }, [activeAgent, activeId, systemPrompt, getLocalizedAgentName, localizedPrompts, role]);

  const isKnowledgeDirty = React.useMemo(() => {
    if (activeId === "new") return contextText !== "";
    if (!activeAgent) return false;
    return contextText !== (activeAgent.context_text || "");
  }, [activeAgent, activeId, contextText]);

  const populateFromAgent = React.useCallback((agent: AgentWithAudio, suffix = "") => {
    const next = getAgentFormState(agent, getLocalizedAgentName, localizedPrompts);
    applyFormState({
      ...next,
      name: `${next.name}${suffix}`,
    });
  }, [applyFormState, getLocalizedAgentName, localizedPrompts]);

  const updateRoleWithDefaults = React.useCallback((nextRole: string) => {
    setRole(nextRole);
    if (activeId === "new") {
      const defaultSkills = getDefaultSkillsForRole(nextRole);
      setSystemSkills(defaultSkills);
      setAutoSystemSkills(defaultSkills);
      setSystemPrompt(localizedPrompts[nextRole as keyof typeof localizedPrompts] || EN_DEFAULT_PROMPTS[nextRole] || "");
    }
  }, [activeId, localizedPrompts]);

  return {
    name,
    setName,
    role,
    setRole: updateRoleWithDefaults,
    modelType,
    setModelType,
    providerId,
    setProviderId,
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
    isSkillsDirty,
    isPromptDirty,
    isKnowledgeDirty,
    populateFromAgent,
  };
}
